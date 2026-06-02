"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/sessions
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ws.*, w.first_name || ' ' || w.last_name AS worker_name,
              w.role, w.avatar_color, w.avatar_url
       FROM worker_sessions ws JOIN workers w ON ws.worker_id = w.id
       WHERE ws.status = 'activo' AND ws.expires_at > NOW()
       ORDER BY ws.last_activity DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener sesiones" });
  }
});

// POST /api/sessions/:id/revoke
router.post("/:id/revoke", auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE worker_sessions
       SET status = 'revocada', revoked_at = NOW(), revoked_by = $1
       WHERE id = $2`,
      [req.worker.id, req.params.id]
    );
    const session = await pool.query(
      "SELECT worker_id FROM worker_sessions WHERE id = $1", [req.params.id]
    );
    if (session.rows[0]) {
      await pool.query(
        "UPDATE workers SET status = 'desconectado' WHERE id = $1",
        [session.rows[0].worker_id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al revocar sesión" });
  }
});

module.exports = router;
