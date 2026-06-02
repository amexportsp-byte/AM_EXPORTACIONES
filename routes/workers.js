"use strict";

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/workers
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, document_type, document_number,
              gender, birthday, email, phone, address, role, username,
              work_schedule, status, avatar_url, avatar_color,
              current_page, last_seen, last_login, created_at,
              antecedentes, ref_name, ref_phone
       FROM workers WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener trabajadores" });
  }
});

// GET /api/workers/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, document_type, document_number,
              gender, birthday, email, phone, address, role, username,
              work_schedule, status, avatar_url, avatar_color,
              current_page, last_seen, last_login, created_at,
              antecedentes, ref_name, ref_phone
       FROM workers WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Trabajador no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener trabajador" });
  }
});

// POST /api/workers
router.post("/", auth, async (req, res) => {
  const {
    first_name, last_name, document_type, document_number,
    gender, birthday, email, phone, address, antecedentes,
    ref_name, ref_phone, role, username, password, work_schedule, avatar_color,
  } = req.body;

  if (!first_name || !last_name || !document_number || !role || !username || !password)
    return res.status(400).json({ error: "Campos requeridos incompletos" });

  try {
    const exists = await pool.query(
      "SELECT id FROM workers WHERE username = $1 OR document_number = $2",
      [username, document_number]
    );
    if (exists.rows.length > 0)
      return res.status(409).json({ error: "Usuario o documento ya existe" });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO workers
       (first_name, last_name, document_type, document_number, gender, birthday,
        email, phone, address, antecedentes, ref_name, ref_phone, role, username,
        password_hash, work_schedule, avatar_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id, first_name, last_name, role, username, status`,
      [first_name, last_name, document_type || "DNI", document_number,
       gender, birthday || null, email, phone, address,
       antecedentes || "No", ref_name, ref_phone,
       role, username, hash, work_schedule || "Lun-Vie 08:00-17:00",
       avatar_color || "#4F46E5"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear trabajador" });
  }
});

// PUT /api/workers/:id
router.put("/:id", auth, async (req, res) => {
  const {
    first_name, last_name, document_type, document_number,
    gender, birthday, email, phone, address, antecedentes,
    ref_name, ref_phone, role, work_schedule, status, avatar_color, password,
  } = req.body;

  try {
    const values = [
      first_name, last_name, document_type, document_number,
      gender, birthday || null, email, phone, address,
      antecedentes, ref_name, ref_phone, role, work_schedule, status, avatar_color,
    ];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      values.push(hash);
      values.push(req.params.id);
      await pool.query(
        `UPDATE workers SET
           first_name=$1, last_name=$2, document_type=$3, document_number=$4,
           gender=$5, birthday=$6, email=$7, phone=$8, address=$9,
           antecedentes=$10, ref_name=$11, ref_phone=$12,
           role=$13, work_schedule=$14, status=$15, avatar_color=$16,
           password_hash=$17, updated_at=NOW()
         WHERE id=$18 AND deleted_at IS NULL`,
        values
      );
    } else {
      values.push(req.params.id);
      await pool.query(
        `UPDATE workers SET
           first_name=$1, last_name=$2, document_type=$3, document_number=$4,
           gender=$5, birthday=$6, email=$7, phone=$8, address=$9,
           antecedentes=$10, ref_name=$11, ref_phone=$12,
           role=$13, work_schedule=$14, status=$15, avatar_color=$16,
           updated_at=NOW()
         WHERE id=$17 AND deleted_at IS NULL`,
        values
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar trabajador" });
  }
});

// DELETE /api/workers/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE workers SET deleted_at = NOW(), status = 'cesado' WHERE id = $1",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar trabajador" });
  }
});

module.exports = router;
