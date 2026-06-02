"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/attendance
router.get("/", auth, async (req, res) => {
  const { date, worker_id } = req.query;
  try {
    let query = `SELECT a.*, w.first_name || ' ' || w.last_name AS worker_name
                 FROM attendance a JOIN workers w ON a.worker_id = w.id WHERE 1=1`;
    const params = [];
    if (date) { params.push(date); query += ` AND a.work_date = $${params.length}`; }
    if (worker_id) { params.push(worker_id); query += ` AND a.worker_id = $${params.length}`; }
    query += " ORDER BY a.work_date DESC, a.check_in DESC LIMIT 200";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener asistencia" });
  }
});

// POST /api/attendance/checkin
router.post("/checkin", auth, async (req, res) => {
  const { worker_id, method } = req.body;
  const targetId = worker_id || req.worker.id;
  try {
    const { rows } = await pool.query(
      `INSERT INTO attendance (worker_id, check_in, check_in_ip, mark_in_method, status)
       VALUES ($1, NOW(), $2, $3, 'presente')
       ON CONFLICT (worker_id, work_date)
       DO UPDATE SET check_in = COALESCE(attendance.check_in, NOW()),
                     check_in_ip = $2, mark_in_method = $3
       RETURNING *`,
      [targetId, req.ip, method || "credenciales"]
    );
    await pool.query(
      `INSERT INTO attendance_access_log (worker_id, event_type, result, method, ip_address)
       VALUES ($1, 'ingreso', 'ok', $2, $3)`,
      [targetId, method || "credenciales", req.ip]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar entrada" });
  }
});

// POST /api/attendance/checkout
router.post("/checkout", auth, async (req, res) => {
  const { worker_id, method } = req.body;
  const targetId = worker_id || req.worker.id;
  try {
    const { rows } = await pool.query(
      `UPDATE attendance SET check_out = NOW(), check_out_ip = $1, mark_out_method = $2
       WHERE worker_id = $3 AND work_date = CURRENT_DATE RETURNING *`,
      [req.ip, method || "credenciales", targetId]
    );
    await pool.query(
      `INSERT INTO attendance_access_log (worker_id, event_type, result, method, ip_address)
       VALUES ($1, 'salida', 'ok', $2, $3)`,
      [targetId, method || "credenciales", req.ip]
    );
    res.json(rows[0] || { ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar salida" });
  }
});

// GET /api/attendance/access-log
router.get("/access-log", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT al.*, w.first_name || ' ' || w.last_name AS worker_name,
              w.role, w.avatar_color
       FROM attendance_access_log al
       LEFT JOIN workers w ON al.worker_id = w.id
       ORDER BY al.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener log de acceso" });
  }
});

module.exports = router;
