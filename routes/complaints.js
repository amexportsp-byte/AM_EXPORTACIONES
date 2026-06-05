"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

const STATUS_TO_DB = { "Pendiente": "pendiente", "En Proceso": "en_proceso", "Resuelto": "resuelto", "Cerrado": "cerrado" };
const STATUS_FROM_DB = { pendiente: "Pendiente", en_proceso: "En Proceso", resuelto: "Resuelto", cerrado: "Cerrado" };
const PRIORITY_TO_DB = { "Normal": "normal", "Alta": "alta", "Urgente": "urgente" };
const PRIORITY_FROM_DB = { normal: "Normal", alta: "Alta", urgente: "Urgente" };

async function getPerformerName(workerId) {
  const r = await pool.query(
    "SELECT first_name || ' ' || last_name AS name FROM workers WHERE id = $1",
    [workerId]
  );
  return r.rows[0]?.name || "Sistema";
}

function rowToFrontend(r) {
  let meta = {};
  try { meta = JSON.parse(r.subject || "{}"); } catch {}
  return {
    id: r.id,
    numero: r.complaint_number,
    tipo: meta.tipo || "Reclamo",
    numDocRef: meta.numDocRef || "",
    nombre: meta.nombre || "",
    documento: meta.documento || "",
    email: meta.email || "",
    celular: meta.celular || "",
    producto: meta.producto || "",
    descripcion: r.description || "",
    estado: STATUS_FROM_DB[r.status] || "Pendiente",
    prioridad: PRIORITY_FROM_DB[r.priority] || "Normal",
    fecha: new Date(r.created_at).toLocaleString("es-PE"),
    auditLog: [],
    _fromDB: true,
  };
}

// GET /api/complaints
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM complaints WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    res.json(rows.map(rowToFrontend));
  } catch (err) {
    console.error("GET /complaints:", err);
    res.status(500).json({ error: "Error al obtener reclamos" });
  }
});

// GET /api/complaints/:id/audit
router.get("/:id/audit", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM complaint_audit_log WHERE complaint_id = $1 ORDER BY performed_at",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /complaints/:id/audit:", err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// POST /api/complaints
router.post("/", auth, async (req, res) => {
  const { tipo, nombre, documento, email, celular, numDocRef, producto,
          descripcion, estado, prioridad } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: cnt } = await client.query("SELECT COUNT(*) FROM complaints");
    const num = String(parseInt(cnt[0].count) + 1).padStart(4, "0");
    const complaintNumber = `RC-${num}`;

    // Intentar resolver client_id y sale_id automáticamente
    let clientId = null;
    let saleId = null;
    if (documento) {
      const cRow = await client.query(
        "SELECT id FROM clients WHERE document_number = $1 AND deleted_at IS NULL LIMIT 1",
        [documento]
      );
      clientId = cRow.rows[0]?.id || null;
    }
    if (numDocRef) {
      const sRow = await client.query(
        "SELECT id FROM sales WHERE sale_number = $1 AND deleted_at IS NULL LIMIT 1",
        [numDocRef]
      );
      saleId = sRow.rows[0]?.id || null;
    }

    const subject = JSON.stringify({ tipo, nombre, documento, email, celular, numDocRef, producto });
    const { rows } = await client.query(
      `INSERT INTO complaints
       (complaint_number, client_id, sale_id, complaint_type, subject, description, status, priority)
       VALUES ($1, $2, $3, 'otro', $4, $5, $6, $7) RETURNING *`,
      [complaintNumber, clientId, saleId, subject, descripcion || "",
       STATUS_TO_DB[estado] || "pendiente",
       PRIORITY_TO_DB[prioridad] || "normal"]
    );
    const performerName = await getPerformerName(req.worker.id);
    await client.query(
      `INSERT INTO complaint_audit_log
       (complaint_id, complaint_number, event_type, label, detail, performed_by, performer_name)
       VALUES ($1, $2, 'crear', $3, $4, $5, $6)`,
      [rows[0].id, complaintNumber,
       `${tipo || "Reclamo"} registrado`,
       `Reclamante: ${nombre}${numDocRef ? " · Ref: " + numDocRef : ""}`,
       req.worker.id, performerName]
    );
    await client.query("COMMIT");
    res.status(201).json(rowToFrontend(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /complaints:", err);
    res.status(500).json({ error: "Error al registrar reclamo" });
  } finally {
    client.release();
  }
});

// PUT /api/complaints/:id
router.put("/:id", auth, async (req, res) => {
  const { tipo, nombre, documento, email, celular, numDocRef, producto,
          descripcion, estado, prioridad, auditEntries } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const subject = JSON.stringify({ tipo, nombre, documento, email, celular, numDocRef, producto });
    const { rows } = await client.query(
      `UPDATE complaints SET subject=$1, description=$2, status=$3, priority=$4
       WHERE id=$5 AND deleted_at IS NULL RETURNING *`,
      [subject, descripcion || "",
       STATUS_TO_DB[estado] || "pendiente",
       PRIORITY_TO_DB[prioridad] || "normal",
       req.params.id]
    );
    if (!rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Reclamo no encontrado" }); }
    const performerName = await getPerformerName(req.worker.id);
    for (const entry of auditEntries || []) {
      await client.query(
        `INSERT INTO complaint_audit_log
         (complaint_id, complaint_number, event_type, label, detail, changed_fields, performed_by, performer_name)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [req.params.id, rows[0].complaint_number,
         entry.event_type || "editar", entry.label || "",
         entry.detail || null, JSON.stringify(entry.diffs || []),
         req.worker.id, performerName]
      );
    }
    await client.query("COMMIT");
    res.json(rowToFrontend(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /complaints/:id:", err);
    res.status(500).json({ error: "Error al actualizar reclamo" });
  } finally {
    client.release();
  }
});

// DELETE /api/complaints/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE complaints SET deleted_at = NOW() WHERE id = $1 RETURNING complaint_number",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Reclamo no encontrado" });
    const performerName = await getPerformerName(req.worker.id);
    await pool.query(
      `INSERT INTO complaint_audit_log
       (complaint_id, complaint_number, event_type, label, performed_by, performer_name)
       VALUES ($1, $2, 'eliminar', 'Reclamo eliminado', $3, $4)`,
      [req.params.id, rows[0].complaint_number, req.worker.id, performerName]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /complaints/:id:", err);
    res.status(500).json({ error: "Error al eliminar reclamo" });
  }
});

module.exports = router;
