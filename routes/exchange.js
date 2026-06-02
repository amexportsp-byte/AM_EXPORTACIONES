"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/exchange-rates
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT er.*, c.code, c.name AS currency_name, c.symbol
       FROM exchange_rates er JOIN currencies c ON er.currency_id = c.id
       ORDER BY er.rate_date DESC, c.code LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener tipos de cambio" });
  }
});

// POST /api/exchange-rates
router.post("/", auth, async (req, res) => {
  const { currency_id, buy_rate, sell_rate, rate_date, source } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO exchange_rates (currency_id, buy_rate, sell_rate, rate_date, source, registered_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (currency_id, rate_date) DO UPDATE
       SET buy_rate=$2, sell_rate=$3, source=$5, updated_at=NOW()
       RETURNING *`,
      [currency_id, buy_rate, sell_rate, rate_date || new Date().toISOString().split("T")[0],
       source || "manual", req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar tipo de cambio" });
  }
});

// GET /api/currencies
router.get("/currencies", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM currencies WHERE is_active = TRUE ORDER BY sort_order, code"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener monedas" });
  }
});

module.exports = router;
