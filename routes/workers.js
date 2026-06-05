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

// GET /api/workers/audit-all  — debe ir ANTES de /:id para que Express no lo capture como ID
router.get("/audit-all", auth, async (req, res) => {
  if (req.worker.role !== "admin")
    return res.status(403).json({ error: "Sin autorización" });
  try {
    const { rows } = await pool.query(
      `SELECT
         wa.id,
         wa.worker_id,
         w.first_name || ' ' || w.last_name  AS worker_name,
         wa.changed_by_id,
         wa.changed_by_name,
         wa.action,
         wa.description,
         wa.diffs,
         wa.ip_address,
         wa.created_at
       FROM worker_audit wa
       LEFT JOIN workers w ON w.id = wa.worker_id
       ORDER BY wa.created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener bitácora" });
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
  if (req.worker.role !== "admin")
    return res.status(403).json({ error: "Sin autorización" });
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

// PUT /api/workers/:id  — actualiza y registra auditoría automáticamente
router.put("/:id", auth, async (req, res) => {
  if (req.worker.role !== "admin")
    return res.status(403).json({ error: "Sin autorización" });
  const {
    first_name, last_name, document_type, document_number,
    gender, birthday, email, phone, address, antecedentes,
    ref_name, ref_phone, role, work_schedule, status, avatar_color, password,
  } = req.body;

  // Etiquetas legibles para los diffs
  const FIELD_LABELS = {
    first_name: "Nombre", last_name: "Apellidos",
    document_type: "Tipo Doc.", document_number: "N° Documento",
    gender: "Género", birthday: "Cumpleaños",
    email: "Correo", phone: "Celular", address: "Dirección",
    antecedentes: "Antecedentes", ref_name: "Ref. Nombre",
    ref_phone: "Ref. Celular", role: "Rol",
    work_schedule: "Horario", status: "Estado",
  };

  try {
    // 1. Leer estado actual antes del update
    const { rows: before } = await pool.query(
      `SELECT first_name, last_name, document_type, document_number,
              gender, birthday, email, phone, address, antecedentes,
              ref_name, ref_phone, role, work_schedule, status
       FROM workers WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const old = before[0] || {};

    const newData = {
      first_name, last_name, document_type, document_number,
      gender, birthday: birthday || null, email, phone, address,
      antecedentes, ref_name, ref_phone, role, work_schedule, status,
    };

    // 2. Calcular diferencias
    const diffs = Object.keys(FIELD_LABELS)
      .filter(k => String(old[k] ?? "") !== String(newData[k] ?? ""))
      .map(k => ({
        field: FIELD_LABELS[k],
        from:  String(old[k]     ?? "—"),
        to:    String(newData[k] ?? "—"),
      }));

    if (password) diffs.push({ field: "Contraseña", from: "••••••", to: "(actualizada)" });

    // 3. Ejecutar el UPDATE
    const values = [
      first_name, last_name, document_type, document_number,
      gender, birthday || null, email, phone, address,
      antecedentes, ref_name, ref_phone, role, work_schedule, status,
    ];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      values.push(hash, req.params.id);
      await pool.query(
        `UPDATE workers SET
           first_name=$1, last_name=$2, document_type=$3, document_number=$4,
           gender=$5, birthday=$6, email=$7, phone=$8, address=$9,
           antecedentes=$10, ref_name=$11, ref_phone=$12,
           role=$13, work_schedule=$14, status=$15,
           password_hash=$16, updated_at=NOW()
         WHERE id=$17 AND deleted_at IS NULL`,
        values
      );
    } else {
      values.push(req.params.id);
      await pool.query(
        `UPDATE workers SET
           first_name=$1, last_name=$2, document_type=$3, document_number=$4,
           gender=$5, birthday=$6, email=$7, phone=$8, address=$9,
           antecedentes=$10, ref_name=$11, ref_phone=$12,
           role=$13, work_schedule=$14, status=$15,
           updated_at=NOW()
         WHERE id=$16 AND deleted_at IS NULL`,
        values
      );
    }

    // 4. Guardar auditoría solo si hubo cambios
    if (diffs.length > 0) {
      const { rows: editor } = await pool.query(
        "SELECT first_name || ' ' || last_name AS full_name FROM workers WHERE id = $1",
        [req.worker.id]
      );
      const editorName = editor[0]?.full_name || "Administrador";

      await pool.query(
        `INSERT INTO worker_audit
           (worker_id, changed_by_id, changed_by_name, action, description, diffs, ip_address)
         VALUES ($1, $2, $3, 'Edición de datos',
                 $4, $5::jsonb, $6)`,
        [
          req.params.id,
          req.worker.id,
          editorName,
          `${diffs.length} campo(s) modificado(s)`,
          JSON.stringify(diffs),
          req.ip,
        ]
      );
    }

    res.json({ ok: true, changes: diffs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar trabajador" });
  }
});

// GET /api/workers/:id/audit  — historial de auditoría de un trabajador
router.get("/:id/audit", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, action, description, diffs, changed_by_name,
              ip_address, created_at
       FROM worker_audit
       WHERE worker_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener auditoría" });
  }
});

// POST /api/workers/:id/audit  — registrar evento manual (estado, asistencia, etc.)
router.post("/:id/audit", auth, async (req, res) => {
  const { action, description, diffs = [] } = req.body || {};
  if (!action) return res.status(400).json({ error: "action requerido" });
  try {
    const { rows: editor } = await pool.query(
      "SELECT first_name || ' ' || last_name AS full_name FROM workers WHERE id = $1",
      [req.worker.id]
    );
    await pool.query(
      `INSERT INTO worker_audit
         (worker_id, changed_by_id, changed_by_name, action, description, diffs, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        req.params.id,
        req.worker.id,
        editor[0]?.full_name || "Administrador",
        action,
        description || "",
        JSON.stringify(diffs),
        req.ip,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar auditoría" });
  }
});

// DELETE /api/workers/:id
router.delete("/:id", auth, async (req, res) => {
  if (req.worker.role !== "admin")
    return res.status(403).json({ error: "Sin autorización" });
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
