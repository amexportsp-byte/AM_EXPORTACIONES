"use strict";

/**
 * static-auth.js — Protección de archivos estáticos
 *
 * Intercepta peticiones de .html / .js / .css antes de que express.static
 * las sirva. Si el archivo no es público Y no hay una cookie de sesión válida,
 * devuelve 403 (para JS/CSS) o redirige al login (para HTML).
 *
 * Funciona sin cookie-parser: lee req.headers.cookie manualmente.
 * Usa el mismo JWT_SECRET que el resto del sistema.
 */

const jwt  = require("jsonwebtoken");
const path = require("path");

/* ── Archivos que SIEMPRE son accesibles sin sesión ── */
const ARCHIVOS_PUBLICOS = new Set([
  // Página de acceso y estilos/scripts inline (login.html no carga CSS externo)
  "login.html",

  // Tienda pública (vitrina)
  "inicio.html",
  "inicio.js",
  "inicio.css",

  // Guard: debe cargarse incluso antes de validar sesión
  "auth-guard.js",
]);

/* Extensiones que queremos proteger */
const EXTENSIONES_PROTEGIDAS = new Set([".html", ".js", ".css"]);

/* ── Parseo manual de cookies ── */
function parseCookie(header, name) {
  if (!header) return null;
  const entry = header
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(name + "="));
  if (!entry) return null;
  return decodeURIComponent(entry.slice(name.length + 1));
}

/* ── Middleware principal ── */
module.exports = function staticAuth(req, res, next) {
  const ext      = path.extname(req.path).toLowerCase();
  const filename = path.basename(req.path);

  // 1. Extensión no protegida (imágenes, fuentes, etc.) → pasar directamente
  if (!EXTENSIONES_PROTEGIDAS.has(ext)) return next();

  // 2. Archivo en lista blanca pública → pasar directamente
  if (ARCHIVOS_PUBLICOS.has(filename)) return next();

  // 3. Verificar cookie de sesión
  const token = parseCookie(req.headers.cookie, "am_session");

  if (!token) {
    return bloquear(req, res, ext);
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return next(); // Token válido → servir el archivo
  } catch {
    // Token inválido o expirado → limpiar cookie y bloquear
    res.setHeader(
      "Set-Cookie",
      "am_session=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/"
    );
    return bloquear(req, res, ext);
  }
};

/* Decide la respuesta según el tipo de archivo */
function bloquear(req, res, ext) {
  if (ext === ".html") {
    // Para páginas HTML: redirigir al login
    return res.redirect(302, "/login.html");
  }
  // Para JS / CSS: 403 vacío (el auth-guard ya habrá redirigido antes)
  res.status(403).end();
}
