"use strict";

/*
  Schema real (verificado):
  exchange_rates:  id, currency_code, rate_date, rate_to_pen (venta),
                   buy_rate, category, source, bank_id, notes, registered_by, created_at
  currencies:      id, code, name, symbol, flag_emoji, decimal_places,
                   is_base, is_active, sort_order, created_at, updated_at
  banks:           id, name, code, account_number, currency, color,
                   bank_type, notes, is_active, created_at, updated_at
  exchange_observations: id, obs_date, currency_code, category, description,
                          impact, source, registered_by, created_at
  UNIQUE en exchange_rates: (currency_code, rate_date)
*/

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middleware/auth");

/* ═══════════════════════════════════════════════════════════════════════
   HISTORIAL — GET /api/exchange-rates
   ═══════════════════════════════════════════════════════════════════════ */
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT er.id,
              er.currency_code   AS code,
              er.rate_date,
              er.rate_to_pen     AS sell_rate,
              er.buy_rate,
              er.category,
              er.notes           AS reason,
              er.source,
              er.created_at,
              c.name             AS currency_name,
              c.symbol,
              c.flag_emoji       AS flag,
              b.name             AS bank_name,
              w.first_name || ' ' || w.last_name AS worker_name
       FROM exchange_rates er
       JOIN  currencies c ON c.code = er.currency_code
       LEFT JOIN banks    b ON b.id  = er.bank_id
       LEFT JOIN workers  w ON w.id  = er.registered_by
       ORDER BY er.created_at DESC, er.rate_date DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   TASA ACTUAL POR MONEDA — GET /api/exchange-rates/latest
   ═══════════════════════════════════════════════════════════════════════ */
router.get("/latest", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (c.id)
              c.id               AS currency_id,
              c.code,
              c.name,
              c.symbol,
              c.flag_emoji       AS flag,
              c.decimal_places,
              c.sort_order,
              er.rate_to_pen     AS sell_rate,
              er.buy_rate,
              er.rate_date,
              er.source          AS bank_ref,
              b.name             AS bank_name,
              er.category,
              er.notes           AS reason,
              er.created_at      AS rate_updated_at,
              w.first_name || ' ' || w.last_name AS updated_by_name
       FROM currencies c
       LEFT JOIN exchange_rates er ON er.currency_code = c.code
       LEFT JOIN banks    b ON b.id  = er.bank_id
       LEFT JOIN workers  w ON w.id  = er.registered_by
       WHERE c.is_active = TRUE AND c.is_base = FALSE
       ORDER BY c.id, er.created_at DESC NULLS LAST, er.rate_date DESC NULLS LAST`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener tasas actuales" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   GUARDAR NUEVA TASA — POST /api/exchange-rates
   ═══════════════════════════════════════════════════════════════════════ */
router.post("/", auth, async (req, res) => {
  const { currency_code, buy_rate, sell_rate, rate_date, source, bank_id, category, reason } = req.body;
  try {
    const today = rate_date || new Date().toISOString().split("T")[0];
    const { rows } = await pool.query(
      `INSERT INTO exchange_rates
         (currency_code, rate_to_pen, buy_rate, rate_date,
          source, bank_id, category, notes, registered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (currency_code, rate_date) DO UPDATE
         SET rate_to_pen = $2,
             buy_rate    = $3,
             source      = $5,
             bank_id     = $6,
             category    = $7,
             notes       = $8
       RETURNING *`,
      [currency_code, sell_rate, buy_rate || null, today,
       source || null, bank_id || null,
       category || null, reason || null, req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar tipo de cambio" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   CURRENCIES
   ═══════════════════════════════════════════════════════════════════════ */

// GET /api/exchange-rates/currencies
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

// POST /api/exchange-rates/currencies
router.post("/currencies", auth, async (req, res) => {
  const { code, name, symbol, flag_emoji, decimal_places } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO currencies (code, name, symbol, flag_emoji, decimal_places, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,TRUE,99) RETURNING *`,
      [code.toUpperCase(), name, symbol || code, flag_emoji || "💱", decimal_places || 2]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === "23505")
      return res.status(409).json({ error: "Ya existe una moneda con ese código" });
    res.status(500).json({ error: "Error al guardar moneda" });
  }
});

// PUT /api/exchange-rates/currencies/:id
router.put("/currencies/:id", auth, async (req, res) => {
  const { code, name, symbol, flag_emoji, decimal_places } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE currencies
       SET code=$1, name=$2, symbol=$3, flag_emoji=$4, decimal_places=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [code.toUpperCase(), name, symbol, flag_emoji || "💱", decimal_places || 2, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Moneda no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar moneda" });
  }
});

// DELETE /api/exchange-rates/currencies/:id  (soft-delete)
router.delete("/currencies/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE currencies SET is_active=FALSE, updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al desactivar moneda" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   BANKS
   ═══════════════════════════════════════════════════════════════════════ */

// GET /api/exchange-rates/banks
router.get("/banks", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM banks WHERE is_active = TRUE ORDER BY name"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener bancos" });
  }
});

// POST /api/exchange-rates/banks
router.post("/banks", auth, async (req, res) => {
  const { name, code, account_number, currency, color, bank_type, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO banks (name, code, account_number, currency, color, bank_type, notes, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *`,
      [name, code.toUpperCase(), account_number || "—",
       currency || "USD", color || "#0B1C35",
       bank_type || "comercial", notes || ""]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === "23505")
      return res.status(409).json({ error: "Ya existe un banco con ese código" });
    res.status(500).json({ error: "Error al guardar banco" });
  }
});

// PUT /api/exchange-rates/banks/:id
router.put("/banks/:id", auth, async (req, res) => {
  const { name, code, account_number, currency, color, bank_type, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE banks
       SET name=$1, code=$2, account_number=$3, currency=$4,
           color=$5, bank_type=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, code.toUpperCase(), account_number || "—",
       currency || "USD", color || "#0B1C35",
       bank_type || "comercial", notes || "", req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Banco no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar banco" });
  }
});

// DELETE /api/exchange-rates/banks/:id  (soft-delete)
router.delete("/banks/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE banks SET is_active=FALSE, updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar banco" });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   OBSERVATIONS
   ═══════════════════════════════════════════════════════════════════════ */

// GET /api/exchange-rates/observations
router.get("/observations", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT eo.*,
              c.flag_emoji AS flag,
              w.first_name || ' ' || w.last_name AS created_by_name
       FROM exchange_observations eo
       LEFT JOIN currencies c  ON c.code = eo.currency_code
       LEFT JOIN workers    w  ON w.id   = eo.registered_by
       ORDER BY eo.obs_date DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener observaciones" });
  }
});

// POST /api/exchange-rates/observations
router.post("/observations", auth, async (req, res) => {
  const { currency_code, obs_date, category, description, impact, source } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO exchange_observations
         (currency_code, obs_date, category, description, impact, source, registered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [currency_code || null,
       obs_date || new Date().toISOString(),
       category || "otro", description,
       impact || "bajo", source || null,
       req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar observación" });
  }
});

// DELETE /api/exchange-rates/observations/:id
router.delete("/observations/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM exchange_observations WHERE id=$1", [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar observación" });
  }
});

module.exports = router;
