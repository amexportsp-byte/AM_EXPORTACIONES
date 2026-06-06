"use strict";

const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const path   = require("path");
const pool   = require("../db");

/* ── Archivos siempre accesibles sin sesión ── */
const ARCHIVOS_PUBLICOS = new Set([
  "login.html",
  "inicio.html", "inicio.js", "inicio.css",
  "catalogo.html",
  "api.js",
  "auth-guard.js",
]);

const EXTENSIONES_PROTEGIDAS = new Set([".html", ".js", ".css"]);

/* ── Destinos válidos para JS y CSS (cargados como recurso, no navegados directamente) ──
   Sec-Fetch-Dest lo envía el navegador automáticamente:
   - "script"   → <script src="...">
   - "style"    → <link rel="stylesheet">
   - "worker"   → Web Worker
   - "empty"    → fetch() / XMLHttpRequest
   - "document" → el usuario escribió la URL directamente (BLOQUEAR)
   - sin header → curl, Postman u otros clientes (BLOQUEAR para .js/.css)
*/
const DESTINOS_VALIDOS_JS  = new Set(["script", "worker", "empty", "serviceworker"]);
const DESTINOS_VALIDOS_CSS = new Set(["style", "empty"]);

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
  // Para JS/CSS: 404 en lugar de 403 para no revelar que el archivo existe
  res.status(404).end();
}

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

  // Archivos públicos: solo para .js y .css públicos cuando vienen como recurso legítimo
  if (ARCHIVOS_PUBLICOS.has(filename)) {
    if (ext === ".js" || ext === ".css") {
      const dest = req.headers["sec-fetch-dest"] || "";
      const valid = ext === ".js" ? DESTINOS_VALIDOS_JS : DESTINOS_VALIDOS_CSS;
      // Bloquear si se navega directamente (dest=document o modo=navigate)
      if (dest === "document" || req.headers["sec-fetch-mode"] === "navigate") {
        return res.status(404).end();
      }
      // Si el navegador envía sec-fetch-dest y no es válido → bloquear
      if (dest && !valid.has(dest)) return res.status(404).end();
    }
    return next();
  }

  // ── Archivos protegidos ──────────────────────────────────────────────────

  // Para JS/CSS: bloquear acceso directo vía URL (Sec-Fetch-Dest=document o navigate)
  if (ext === ".js" || ext === ".css") {
    const dest = req.headers["sec-fetch-dest"] || "";
    const mode = req.headers["sec-fetch-mode"] || "";
    if (dest === "document" || mode === "navigate") return res.status(404).end();

    const valid = ext === ".js" ? DESTINOS_VALIDOS_JS : DESTINOS_VALIDOS_CSS;
    // Si el navegador declara un destino inválido → bloquear
    if (dest && !valid.has(dest)) return res.status(404).end();
  }

  // Verificar sesión
  const token = parseCookie(req.headers.cookie, "am_session");
  if (!token) return bloquear(res, ext);

  try {
    jwt.verify(token, process.env.JWT_SECRET);

    if (ext === ".html") {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const result    = await checkSession(tokenHash);
      if (result !== null && !result.rows.length) {
        clearCookie(res);
        return bloquear(res, ext);
      }
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    return next();
  } catch {
    clearCookie(res);
    return bloquear(res, ext);
  }
};
