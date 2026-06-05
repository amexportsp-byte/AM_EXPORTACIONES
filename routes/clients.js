"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

async function getPerformerName(workerId) {
  const r = await pool.query(
    "SELECT first_name || ' ' || last_name AS name FROM workers WHERE id = $1",
    [workerId]
  );
  return r.rows[0]?.name || "Sistema";
}

// GET /api/clients
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

// GET /api/clients/:id/audit
router.get("/:id/audit", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM client_audit_log WHERE client_id = $1 ORDER BY performed_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /clients/:id/audit:", err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// POST /api/clients
router.post("/", auth, async (req, res) => {
  const { document_type, document_number, first_name, last_name,
          business_name, email, phone, address, district, city } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO clients
       (document_type, document_number, first_name, last_name,
        business_name, email, phone, address, district, city, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [document_type || "DNI", document_number, first_name, last_name,
       business_name || null, email || null, phone || null,
       address || null, district || null, city || null, req.worker.id]
    );
    const performerName = await getPerformerName(req.worker.id);
    await client.query(
      `INSERT INTO client_audit_log
       (client_id, client_doc, event_type, label, detail, performed_by, performer_name)
       VALUES ($1, $2, 'crear', 'Cliente registrado', $3, $4, $5)`,
      [rows[0].id, document_number,
       `Tipo: ${document_type} · Doc: ${document_number}`,
       req.worker.id, performerName]
    );
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /clients:", err);
    res.status(500).json({ error: "Error al crear cliente" });
  } finally {
    client.release();
  }
});

// PUT /api/clients/:id
router.put("/:id", auth, async (req, res) => {
  const { document_type, document_number, first_name, last_name,
          email, phone, diffs } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE clients SET document_type=$1, document_number=$2,
       first_name=$3, last_name=$4, email=$5, phone=$6
       WHERE id=$7 AND deleted_at IS NULL RETURNING *`,
      [document_type, document_number, first_name, last_name,
       email || null, phone || null, req.params.id]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cliente no encontrado" });
    }
    const performerName = await getPerformerName(req.worker.id);
    const label = diffs?.length
      ? `${diffs.length} campo(s) modificado(s)`
      : "Ficha guardada sin cambios";
    await client.query(
      `INSERT INTO client_audit_log
       (client_id, client_doc, event_type, label, changed_fields, performed_by, performer_name)
       VALUES ($1, $2, 'editar', $3, $4::jsonb, $5, $6)`,
      [req.params.id, document_number, label,
       JSON.stringify(diffs || []), req.worker.id, performerName]
    );
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /clients/:id:", err);
    res.status(500).json({ error: "Error al actualizar cliente" });
  } finally {
    client.release();
  }
});

// DELETE /api/clients/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE clients SET deleted_at = NOW() WHERE id = $1 RETURNING document_number",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    const performerName = await getPerformerName(req.worker.id);
    await pool.query(
      `INSERT INTO client_audit_log
       (client_id, client_doc, event_type, label, performed_by, performer_name)
       VALUES ($1, $2, 'eliminar', 'Cliente eliminado', $3, $4)`,
      [req.params.id, rows[0].document_number, req.worker.id, performerName]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /clients/:id:", err);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

module.exports = router;
