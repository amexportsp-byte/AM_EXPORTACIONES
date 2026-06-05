"use strict";

const crypto = require("crypto");
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middleware/auth");

/* ══════════════════════════════════════════════════════════════
   GET /api/sessions  — sesiones activas (para el ticker)
══════════════════════════════════════════════════════════════ */
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ws.id,
        ws.worker_id,
        ws.current_page,
        ws.page_title,
        ws.last_activity,
        ws.login_at,
        ws.ip_address,
        w.first_name,
        w.last_name,
        w.first_name || ' ' || w.last_name AS worker_name,
        w.role,
        w.status        AS worker_status,
        w.avatar_color,
        w.avatar_url,
        -- Páginas activas ahora (heartbeat reciente Y no cerradas)
        COALESCE((
          SELECT json_agg(json_build_object(
            'page_url',         sp.page_url,
            'page_title',       sp.page_title,
            'last_activity',    sp.last_activity,
            'last_interaction', sp.last_interaction,
            'tab_id',           sp.tab_id
          ) ORDER BY sp.last_activity DESC)
          FROM session_pages sp
          WHERE sp.worker_id = ws.worker_id
            AND sp.closed_at IS NULL
            AND sp.last_activity > NOW() - INTERVAL '2 minutes'
        ), '[]'::json) AS active_pages,
        (
          SELECT COUNT(*)::int
          FROM session_pages sp
          WHERE sp.worker_id = ws.worker_id
            AND sp.closed_at IS NULL
            AND sp.last_activity > NOW() - INTERVAL '2 minutes'
        ) AS page_count
      FROM worker_sessions ws
      JOIN workers w ON ws.worker_id = w.id
      WHERE ws.status = 'activo' AND ws.expires_at > NOW()
      ORDER BY ws.last_activity DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener sesiones" });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/sessions/worker/:workerId
   Detalle completo: pestañas activas + cerradas + historial
══════════════════════════════════════════════════════════════ */
router.get("/worker/:workerId", auth, async (req, res) => {
  const { workerId } = req.params;
  try {
    // Páginas activas AHORA (sin cerrar, heartbeat reciente)
    const { rows: activePages } = await pool.query(
      `SELECT page_url, page_title, last_activity, last_interaction, tab_id, NULL AS closed_at
       FROM session_pages
       WHERE worker_id = $1
         AND closed_at IS NULL
         AND last_activity > NOW() - INTERVAL '2 minutes'
       ORDER BY last_activity DESC`,
      [workerId]
    );

    // Páginas recientemente cerradas (últimas 24h con closed_at)
    const { rows: closedPages } = await pool.query(
      `SELECT page_url, page_title, last_activity, closed_at, tab_id
       FROM session_pages
       WHERE worker_id = $1
         AND closed_at IS NOT NULL
         AND closed_at > NOW() - INTERVAL '24 hours'
       ORDER BY closed_at DESC
       LIMIT 50`,
      [workerId]
    );

    // Historial completo de sesiones (últimas 30)
    const { rows: history } = await pool.query(
      `SELECT ws.id,
              ws.status,
              ws.login_at,
              ws.last_activity,
              ws.expires_at,
              ws.revoked_at,
              ws.ip_address,
              ws.current_page,
              ws.page_title,
              rw.first_name || ' ' || rw.last_name AS revoked_by_name
       FROM worker_sessions ws
       LEFT JOIN workers rw ON rw.id = ws.revoked_by
       WHERE ws.worker_id = $1
       ORDER BY ws.login_at DESC
       LIMIT 30`,
      [workerId]
    );

    res.json({ active_pages: activePages, closed_pages: closedPages, session_history: history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener detalle del trabajador" });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/sessions/heartbeat
   Cada pestaña reporta su presencia. Las pestañas sin heartbeat
   > 2 min quedan marcadas como closed_at (no se borran).
══════════════════════════════════════════════════════════════ */
router.post("/heartbeat", auth, async (req, res) => {
  const { page_url, page_title, tab_id } = req.body;
  const token     = req.headers.authorization.replace("Bearer ", "");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  try {
    // 1. Actualizar sesión principal
    await pool.query(
      `UPDATE worker_sessions
         SET current_page  = $1,
             page_title    = $2,
             last_activity = NOW()
       WHERE token_hash = $3 AND status = 'activo'`,
      [page_url || null, page_title || null, tokenHash]
    );

    // 2. Actualizar worker
    await pool.query(
      `UPDATE workers SET current_page = $1, last_seen = NOW() WHERE id = $2`,
      [page_url || null, req.worker.id]
    );

    if (tab_id) {
      // 3a. Verificar si el admin cerró esta pestaña a la fuerza
      const { rows: tabState } = await pool.query(
        `SELECT admin_closed FROM session_pages WHERE worker_id = $1 AND tab_id = $2`,
        [req.worker.id, tab_id]
      );
      if (tabState.length > 0 && tabState[0].admin_closed) {
        return res.json({ ok: true, force_close: true });
      }

      const { last_interaction } = req.body;
      const interactionTs = last_interaction ? new Date(last_interaction) : null;

      // 3b. Upsert de esta pestaña (restablecer closed_at si estaba marcada)
      await pool.query(
        `INSERT INTO session_pages (worker_id, tab_id, page_url, page_title, last_activity, last_interaction, closed_at)
         VALUES ($1, $2, $3, $4, NOW(), $5, NULL)
         ON CONFLICT (worker_id, tab_id) DO UPDATE
           SET page_url         = $3,
               page_title       = $4,
               last_activity    = NOW(),
               last_interaction = COALESCE($5, session_pages.last_interaction),
               closed_at        = NULL`,
        [req.worker.id, tab_id, page_url || null, page_title || null, interactionTs]
      );

      // 4. Marcar como cerradas las pestañas sin heartbeat > 2 min
      //    (en lugar de borrarlas, las conservamos con closed_at)
      await pool.query(
        `UPDATE session_pages
         SET closed_at = last_activity
         WHERE worker_id = $1
           AND closed_at IS NULL
           AND last_activity < NOW() - INTERVAL '2 minutes'`,
        [req.worker.id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en heartbeat" });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/sessions/admin-close-page
   Admin cierra una pestaña específica de otro trabajador.
   Usa auth normal (token en cabecera).
══════════════════════════════════════════════════════════════ */
router.post("/admin-close-page", auth, async (req, res) => {
  if (req.worker.role !== "admin")
    return res.status(403).json({ error: "Sin autorización" });

  const { worker_id, tab_id } = req.body || {};
  if (!worker_id || !tab_id) return res.status(400).json({ error: "Faltan worker_id o tab_id" });

  try {
    const { rowCount } = await pool.query(
      `UPDATE session_pages
         SET closed_at    = NOW(),
             admin_closed = TRUE
       WHERE worker_id = $1
         AND tab_id    = $2
         AND closed_at IS NULL`,
      [worker_id, tab_id]
    );
    res.json({ ok: true, closed: rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cerrar pestaña" });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/sessions/page-close
   Marca una pestaña como cerrada de inmediato (via sendBeacon).
   El token viaja en el body porque sendBeacon no admite cabeceras.
══════════════════════════════════════════════════════════════ */
router.post("/page-close", async (req, res) => {
  const { tab_id, token } = req.body || {};
  if (!tab_id || !token) return res.json({ ok: false });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  try {
    const { rows } = await pool.query(
      `SELECT worker_id FROM worker_sessions
       WHERE token_hash = $1 AND status = 'activo'`,
      [tokenHash]
    );
    if (!rows.length) return res.json({ ok: false });

    await pool.query(
      `UPDATE session_pages
         SET closed_at = NOW()
       WHERE worker_id = $1
         AND tab_id    = $2
         AND closed_at IS NULL`,
      [rows[0].worker_id, tab_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/sessions/:id/revoke
══════════════════════════════════════════════════════════════ */
router.post("/:id/revoke", auth, async (req, res) => {
  try {
    const session = await pool.query(
      "SELECT worker_id FROM worker_sessions WHERE id = $1",
      [req.params.id]
    );
    await pool.query(
      `UPDATE worker_sessions
         SET status = 'revocada', revoked_at = NOW(), revoked_by = $1
       WHERE id = $2`,
      [req.worker.id, req.params.id]
    );
    if (session.rows[0]) {
      const wid = session.rows[0].worker_id;
      await pool.query(
        `UPDATE workers SET status = 'desconectado', current_page = NULL WHERE id = $1`,
        [wid]
      );
      // Marcar todas las pestañas activas como cerradas (no borrar)
      await pool.query(
        `UPDATE session_pages SET closed_at = NOW()
         WHERE worker_id = $1 AND closed_at IS NULL`,
        [wid]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al revocar sesión" });
  }
});

module.exports = router;
