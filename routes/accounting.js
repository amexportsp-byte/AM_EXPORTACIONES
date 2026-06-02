"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/accounting/entries
router.get("/entries", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT je.*, w.first_name || ' ' || w.last_name AS created_by_name
       FROM journal_entries je
       LEFT JOIN workers w ON je.created_by = w.id
       ORDER BY je.entry_date DESC, je.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener asientos contables" });
  }
});

// POST /api/accounting/entries
router.post("/entries", auth, async (req, res) => {
  const { entry_date, description, debit_account, credit_account, amount, currency, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO journal_entries
       (entry_date, description, debit_account, credit_account, amount, currency, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [entry_date, description, debit_account, credit_account, amount,
       currency || "PEN", notes, req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear asiento contable" });
  }
});

// GET /api/accounting/plan
router.get("/plan", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM accounting_plan WHERE is_active = TRUE ORDER BY code"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener plan contable" });
  }
});

// GET /api/purchases
router.get("/purchases", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, s.business_name AS supplier_name
       FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.purchase_date DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener compras" });
  }
});

// GET /api/expenses
router.get("/expenses", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 200"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener gastos" });
  }
});

module.exports = router;
