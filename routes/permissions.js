"use strict";

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middleware/auth");

// Lista canónica de páginas con permisos.
// Agregar aquí cuando se cree una nueva página del sistema.
const PERM_PAGES = [
  { url: "inicio.html",       label: "🏠 Portal",    short: "Portal"     },
  { url: "venta.html",        label: "🛒 Ventas",     short: "Ventas"     },
  { url: "cambio.html",       label: "💱 T. Cambio",  short: "T.Cambio"   },
  { url: "registro.html",     label: "📦 Inventario", short: "Inventario" },
  { url: "libro.html",        label: "📒 Libro",      short: "Libro"      },
  { url: "marcacion.html",    label: "🕐 Marcación",  short: "Marcación"  },
  { url: "trabajadores.html", label: "👥 Personal",   short: "Personal"   },
  { url: "clientes.html",     label: "👤 Clientes",   short: "Clientes"   },
  { url: "catalogo.html",     label: "📋 Catálogo",   short: "Catálogo"   },
  { url: "pedidos.html",      label: "📦 Pedidos",    short: "Pedidos"    },
];

/* GET /api/permissions/pages — lista de páginas gestionadas */
router.get("/pages", auth, (req, res) => res.json(PERM_PAGES));

/* ══════════════════════════════════════════════════════════
   GET /api/permissions
   Devuelve todos los permisos de todos los trabajadores
══════════════════════════════════════════════════════════ */
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT wp.worker_id, wp.page_url, wp.allowed,
              w.first_name || ' ' || w.last_name AS worker_name,
              w.role, w.status, w.avatar_color
       FROM worker_permissions wp
       JOIN workers w ON w.id = wp.worker_id
       ORDER BY w.first_name, wp.page_url`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener permisos" });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/permissions/my-access?page=X
   Verifica si el trabajador actual puede acceder a una página.
   Admins siempre tienen acceso.
══════════════════════════════════════════════════════════ */
router.get("/my-access", auth, async (req, res) => {
  const { page } = req.query;
  if (!page) return res.json({ allowed: true });

  if (req.worker.role === "admin") return res.json({ allowed: true });

  try {
    const { rows } = await pool.query(
      `SELECT allowed FROM worker_permissions
       WHERE worker_id = $1 AND page_url = $2`,
      [req.worker.id, page]
    );
    // Sin registro → denegado por defecto
    res.json({ allowed: rows.length > 0 && rows[0].allowed === true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al verificar permiso" });
  }
});

/* ══════════════════════════════════════════════════════════
   PUT /api/permissions
   Establece o actualiza un permiso individual
   Body: { worker_id, page_url, allowed }
══════════════════════════════════════════════════════════ */
router.put("/", auth, async (req, res) => {
  const { worker_id, page_url, allowed } = req.body || {};
  if (!worker_id || !page_url || allowed === undefined)
    return res.status(400).json({ error: "Faltan datos (worker_id, page_url, allowed)" });

  try {
    await pool.query(
      `INSERT INTO worker_permissions (worker_id, page_url, allowed, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (worker_id, page_url) DO UPDATE
         SET allowed    = $3,
             updated_at = NOW()`,
      [worker_id, page_url, !!allowed]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar permiso" });
  }
});

/* ══════════════════════════════════════════════════════════
   PUT /api/permissions/bulk
   Establece todos los permisos de un trabajador a la vez
   Body: { worker_id, permissions: { "venta.html": true, ... } }
══════════════════════════════════════════════════════════ */
router.put("/bulk", auth, async (req, res) => {
  const { worker_id, permissions } = req.body || {};
  if (!worker_id || !permissions)
    return res.status(400).json({ error: "Faltan datos" });

  const entries = Object.entries(permissions);
  if (!entries.length) return res.json({ ok: true });

  try {
    const values = entries
      .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}, NOW())`)
      .join(", ");
    const params = [worker_id, ...entries.flatMap(([page, val]) => [page, !!val])];

    await pool.query(
      `INSERT INTO worker_permissions (worker_id, page_url, allowed, updated_at)
       VALUES ${values}
       ON CONFLICT (worker_id, page_url) DO UPDATE
         SET allowed = EXCLUDED.allowed, updated_at = NOW()`,
      params
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar permisos masivos" });
  }
});

module.exports = router;
