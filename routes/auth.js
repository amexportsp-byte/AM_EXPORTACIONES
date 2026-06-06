"use strict";

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const pool   = require("../db");
const auth   = require("../middleware/auth");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.headers["x-forwarded-for"] || "desconocida";

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
      await pool.query(
        `INSERT INTO login_attempts (username, ip_address, success)
         VALUES ($1, $2, FALSE)`,
        [username, ip]
      ).catch(() => {}); // No interrumpir si la tabla aún no existe
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (worker.status === "suspendido" || worker.status === "cesado") {
      await pool.query(
        `INSERT INTO login_attempts (username, ip_address, success, detail)
         VALUES ($1, $2, FALSE, 'cuenta_inactiva')`,
        [username, ip]
      ).catch(() => {});
      return res.status(403).json({ error: "Cuenta no disponible" });
    }

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

    // Registrar login exitoso
    await pool.query(
      `INSERT INTO login_attempts (username, ip_address, success)
       VALUES ($1, $2, TRUE)`,
      [username, ip]
    ).catch(() => {});

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
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
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
