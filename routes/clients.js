"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

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

// POST /api/clients
router.post("/", auth, async (req, res) => {
  const { document_type, document_number, first_name, last_name,
          business_name, email, phone, address, district, city } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO clients
       (document_type, document_number, first_name, last_name,
        business_name, email, phone, address, district, city, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [document_type || "DNI", document_number, first_name, last_name,
       business_name, email, phone, address, district, city, req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

module.exports = router;
