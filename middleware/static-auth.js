"use strict";

const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const path   = require("path");
const pool   = require("../db");

/* ── Archivos siempre accesibles sin sesión ── */
const ARCHIVOS_PUBLICOS = new Set([
  "login.html",
  "inicio.html", "inicio.js", "inicio.css",
  "api.js",
  "auth-guard.js",
]);

const EXTENSIONES_PROTEGIDAS = new Set([".html", ".js", ".css"]);

function parseCookie(header, name) {
  if (!header) return null;
  const entry = header
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(name + "="));
  if (!entry) return null;
  return decodeURIComponent(entry.slice(name.length + 1));
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", "am_session=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/");
}

function bloquear(res, ext) {
  if (ext === ".html") return res.redirect(302, "/login.html");
  res.status(403).end();
}

// Consulta a la BD con timeout de 5 s.
// Si la BD está en cold start y no responde a tiempo,
// resuelve con null en lugar de lanzar error (fail-open).
function checkSession(tokenHash) {
  return Promise.race([
    pool.query(
      `SELECT id FROM worker_sessions
       WHERE token_hash = $1 AND status = 'activo' AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    ),
    new Promise(resolve => setTimeout(() => resolve(null), 5000)),
  ]);
}

module.exports = async function staticAuth(req, res, next) {
  const ext      = path.extname(req.path).toLowerCase();
  const filename = path.basename(req.path);

  if (!EXTENSIONES_PROTEGIDAS.has(ext)) return next();
  if (ARCHIVOS_PUBLICOS.has(filename))  return next();

  const token = parseCookie(req.headers.cookie, "am_session");
  if (!token) return bloquear(res, ext);

  try {
    // 1. Verificar firma y expiración del JWT
    jwt.verify(token, process.env.JWT_SECRET);

    // 2. Para HTML: verificar sesión activa en BD con timeout de 5 s.
    //    Si la BD no responde (cold start), dejamos pasar al usuario
    //    porque el JWT ya fue validado. El auth-guard.js detectará
    //    sesiones revocadas en máximo 15 segundos desde el cliente.
    if (ext === ".html") {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const result    = await checkSession(tokenHash);

      if (result !== null && !result.rows.length) {
        // BD respondió y la sesión está revocada → bloquear
        clearCookie(res);
        return bloquear(res, ext);
      }
      // result === null → timeout de BD → fail-open (JWT válido = acceso concedido)
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    return next();
  } catch {
    clearCookie(res);
    return bloquear(res, ext);
  }
};
