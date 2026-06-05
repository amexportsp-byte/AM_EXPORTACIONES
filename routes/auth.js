"use strict";

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");
const auth = require("../middleware/auth");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM workers WHERE username = $1 AND deleted_at IS NULL",
      [username]
    );
    const worker = rows[0];
    if (!worker) return res.status(401).json({ error: "Credenciales incorrectas" });

    const ok = await bcrypt.compare(password, worker.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales incorrectas" });

    if (worker.status === "suspendido" || worker.status === "cesado")
      return res.status(403).json({ error: "Cuenta no disponible" });

    await pool.query(
      "UPDATE workers SET last_login = NOW(), status = 'activo' WHERE id = $1",
      [worker.id]
    );

    const token = jwt.sign(
      { id: worker.id, role: worker.role, username: worker.username },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await pool.query(
      `INSERT INTO worker_sessions (worker_id, token_hash, ip_address, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [worker.id, tokenHash, req.ip, expiresAt]
    );

    // Cookie HTTP-only: el navegador la envía automáticamente en CADA petición
    // (incluidas las de archivos .js/.css), sin que el JS del cliente pueda leerla.
    const isProduction = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      [
        `am_session=${token}`,
        "HttpOnly",
        "SameSite=Strict",
        `Max-Age=${8 * 3600}`,   // 8 horas, igual que el JWT
        "Path=/",
        ...(isProduction ? ["Secure"] : []),
      ].join("; ")
    );

    res.json({
      token,
      worker: {
        id: worker.id,
        username: worker.username,
        first_name: worker.first_name,
        last_name: worker.last_name,
        role: worker.role,
        avatar_color: worker.avatar_color,
        avatar_url: worker.avatar_url,
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
    const token = req.headers.authorization.replace("Bearer ", "");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      "UPDATE worker_sessions SET status = 'inactivo', revoked_at = NOW() WHERE token_hash = $1",
      [tokenHash]
    );
    await pool.query(
      "UPDATE workers SET status = 'desconectado', current_page = NULL WHERE id = $1",
      [req.worker.id]
    );
    // Marcar todas las pestañas activas como cerradas al logout
    await pool.query(
      "UPDATE session_pages SET closed_at = NOW() WHERE worker_id = $1 AND closed_at IS NULL",
      [req.worker.id]
    );

    // Borrar la cookie de sesión HTTP-only
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

// GET /api/auth/verify  — valida que el token siga activo (usado por auth-guard.js)
router.get("/verify", auth, (req, res) => {
  res.json({ ok: true, worker_id: req.worker.id, role: req.worker.role });
});

// GET /api/auth/config  — configuración pública (Cloudinary)
router.get("/config", (req, res) => {
  res.json({
    cloudinary: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
    },
  });
});

module.exports = router;
