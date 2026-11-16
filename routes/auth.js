"use strict";

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const QRCode = require("qrcode");
const pool   = require("../db");
const auth   = require("../middleware/auth");
const totp   = require("../services/totp");

// Token temporal entre "contraseña correcta" y "código 2FA correcto".
// Se firma con una clave DISTINTA para que nunca sirva como sesión.
const PENDING_SECRET = () => (process.env.JWT_SECRET || "") + ":2fa-pending";
const PENDING_TTL = "5m";

function clientIp(req) {
  return req.ip || req.headers["x-forwarded-for"] || "desconocida";
}

async function logAttempt(username, ip, success, detail = null) {
  await pool.query(
    `INSERT INTO login_attempts (username, ip_address, success, detail) VALUES ($1, $2, $3, $4)`,
    [username, ip, success, detail]
  ).catch(() => {}); // No interrumpir si la tabla aún no existe
}

// Crea la sesión real (tras pasar contraseña + 2FA) y responde al cliente.
async function issueSession(worker, ip, res) {
  // Revocar sesiones anteriores y cerrar pestañas — no crítico para el login
  await pool.query(
    `UPDATE worker_sessions SET status = 'revocada', revoked_at = NOW()
     WHERE worker_id = $1 AND status = 'activo'`,
    [worker.id]
  ).catch(e => console.warn("revoke sessions:", e.message));

  await pool.query(
    `UPDATE session_pages SET closed_at = NOW()
     WHERE worker_id = $1 AND closed_at IS NULL`,
    [worker.id]
  ).catch(e => console.warn("close tabs:", e.message));

  await pool.query(
    "UPDATE workers SET last_login = NOW(), status = 'activo' WHERE id = $1",
    [worker.id]
  ).catch(e => console.warn("update last_login:", e.message));

  const token = jwt.sign(
    { id: worker.id, role: worker.role, username: worker.username },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  const expiresAt  = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const tokenHash  = crypto.createHash("sha256").update(token).digest("hex");

  await pool.query(
    `INSERT INTO worker_sessions (worker_id, token_hash, ip_address, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [worker.id, tokenHash, ip, expiresAt]
  );

  await logAttempt(worker.username, ip, true);

  const isProduction = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    [
      `am_session=${token}`,
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${8 * 3600}`,
      "Path=/",
      ...(isProduction ? ["Secure"] : []),
    ].join("; ")
  );

  res.json({
    token,
    worker: {
      id:          worker.id,
      username:    worker.username,
      first_name:  worker.first_name,
      last_name:   worker.last_name,
      role:        worker.role,
      avatar_color: worker.avatar_color,
      avatar_url:  worker.avatar_url,
    },
  });
}

// POST /api/auth/login — paso 1: usuario y contraseña
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const ip = clientIp(req);

  if (!username || !password)
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM workers WHERE username = $1 AND deleted_at IS NULL",
      [username]
    );
    const worker = rows[0];

    // Credenciales incorrectas — registrar intento fallido
    if (!worker || !(await bcrypt.compare(password, worker.password_hash))) {
      await logAttempt(username, ip, false);
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (worker.status === "suspendido" || worker.status === "cesado") {
      await logAttempt(username, ip, false, "cuenta_inactiva");
      return res.status(403).json({ error: "Cuenta no disponible" });
    }

    // Paso 2 obligatorio: verificación con app autenticadora
    const pendingToken = jwt.sign(
      { id: worker.id, purpose: "2fa" },
      PENDING_SECRET(),
      { expiresIn: PENDING_TTL }
    );

    if (worker.totp_enabled && worker.totp_secret) {
      return res.json({ twofa: "verify", pendingToken });
    }

    // Primera vez: generar (o reutilizar el ya mostrado) secreto y QR para vincular
    let secret = null;
    try { secret = worker.totp_secret ? totp.decrypt(worker.totp_secret) : null; } catch { secret = null; }
    if (!secret) {
      secret = totp.generateSecret();
      await pool.query(
        "UPDATE workers SET totp_secret = $1, totp_enabled = FALSE, totp_last_step = NULL WHERE id = $2",
        [totp.encrypt(secret), worker.id]
      );
    }
    const qr = await QRCode.toDataURL(totp.otpauthUrl(secret, worker.username), { margin: 1, width: 220 });

    res.json({
      twofa: "setup",
      pendingToken,
      qr,
      secret: secret.replace(/(.{4})/g, "$1 ").trim(), // para escribirlo a mano
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/auth/login/2fa — paso 2: código de 6 dígitos de la app
router.post("/login/2fa", async (req, res) => {
  const { pendingToken, code } = req.body || {};
  const ip = clientIp(req);

  let pending;
  try {
    pending = jwt.verify(String(pendingToken || ""), PENDING_SECRET());
    if (pending.purpose !== "2fa") throw new Error("purpose");
  } catch {
    return res.status(401).json({
      error: "La verificación expiró. Ingresa tu usuario y contraseña de nuevo.",
      restart: true,
    });
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM workers WHERE id = $1 AND deleted_at IS NULL",
      [pending.id]
    );
    const worker = rows[0];
    if (!worker || worker.status === "suspendido" || worker.status === "cesado")
      return res.status(403).json({ error: "Cuenta no disponible", restart: true });
    if (!worker.totp_secret)
      return res.status(401).json({ error: "La verificación fue reiniciada. Ingresa de nuevo.", restart: true });

    const secret = totp.decrypt(worker.totp_secret);
    const step = totp.verify(secret, code);

    // Código incorrecto, o el mismo código ya usado (anti-reutilización)
    if (step === null || (worker.totp_last_step != null && step <= Number(worker.totp_last_step))) {
      await logAttempt(worker.username, ip, false, "2fa_fallido");
      return res.status(401).json({ error: "Código incorrecto o ya usado. Espera el siguiente código de la app." });
    }

    await pool.query(
      `UPDATE workers
          SET totp_last_step = $1,
              totp_enabled = TRUE,
              totp_enabled_at = COALESCE(totp_enabled_at, NOW())
        WHERE id = $2`,
      [step, worker.id]
    );

    await issueSession(worker, ip, res);
  } catch (err) {
    console.error("Login 2FA error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/auth/2fa/reset/:workerId — admin: desvincula el 2FA (p. ej. celular perdido).
// En su próximo ingreso el trabajador verá un QR nuevo para vincular.
router.post("/2fa/reset/:workerId", auth, async (req, res) => {
  if (req.worker.role !== "admin")
    return res.status(403).json({ error: "Solo un administrador puede resetear el 2FA" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE workers
          SET totp_secret = NULL, totp_enabled = FALSE, totp_last_step = NULL, totp_enabled_at = NULL
        WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.workerId]
    );
    if (!rowCount) return res.status(404).json({ error: "Trabajador no encontrado" });
    // Cerrar sus sesiones abiertas para que vuelva a vincular al entrar
    await pool.query(
      `UPDATE worker_sessions SET status = 'revocada', revoked_at = NOW()
        WHERE worker_id = $1 AND status = 'activo'`,
      [req.params.workerId]
    ).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("2FA reset error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/auth/logout
router.post("/logout", auth, async (req, res) => {
  try {
    const token     = req.headers.authorization.replace("Bearer ", "");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await pool.query(
      "UPDATE worker_sessions SET status = 'revocada', revoked_at = NOW() WHERE token_hash = $1",
      [tokenHash]
    );
    await pool.query(
      "UPDATE workers SET status = 'desconectado', current_page = NULL WHERE id = $1",
      [req.worker.id]
    );
    await pool.query(
      "UPDATE session_pages SET closed_at = NOW() WHERE worker_id = $1 AND closed_at IS NULL",
      [req.worker.id]
    );

    res.setHeader(
      "Set-Cookie",
      "am_session=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/"
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/auth/verify — verifica token Y sesión activa en BD
router.get("/verify", auth, async (req, res) => {
  try {
    const token     = req.headers.authorization?.replace("Bearer ", "");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { rows } = await pool.query(
      `SELECT id FROM worker_sessions
       WHERE token_hash = $1 AND status = 'activo' AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    if (!rows.length)
      return res.status(401).json({ error: "Sesión revocada" });

    res.json({ ok: true, worker_id: req.worker.id, role: req.worker.role });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/auth/config — configuración pública (Cloudinary)
router.get("/config", (req, res) => {
  res.json({
    cloudinary: {
      cloud_name:     process.env.CLOUDINARY_CLOUD_NAME,
      upload_preset:  process.env.CLOUDINARY_UPLOAD_PRESET,
    },
  });
});

module.exports = router;
