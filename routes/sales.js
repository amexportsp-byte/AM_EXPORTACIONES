"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/sales
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              c.first_name || ' ' || COALESCE(c.last_name,'') AS client_name,
              c.document_number AS client_doc,
              w.first_name || ' ' || w.last_name AS worker_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN workers w ON s.worker_id = w.id
       WHERE s.deleted_at IS NULL ORDER BY s.sale_date DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener ventas" });
  }
});

// POST /api/sales
router.post("/", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      client_id, sale_type, subtotal, discount, discount_pct, igv,
      total, amount_paid, change_given, currency, exchange_rate,
      total_pen, amount_paid_pen, change_given_pen, notes,
      invoice_type, details, payment_method_id,
    } = req.body;

    const year = new Date().getFullYear();
    const count = await client.query(
      "SELECT COUNT(*) FROM sales WHERE EXTRACT(YEAR FROM sale_date) = $1", [year]
    );
    const saleNum = `VEN-${year}${String(parseInt(count.rows[0].count) + 1).padStart(4, "0")}`;

    const { rows: saleRows } = await client.query(
      `INSERT INTO sales
       (sale_number, client_id, worker_id, sale_type,
        subtotal, discount, discount_pct, igv, total,
        amount_paid, change_given, currency, exchange_rate,
        total_pen, amount_paid_pen, change_given_pen, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'completada',$18)
       RETURNING id, sale_number`,
      [saleNum, client_id || null, req.worker.id, sale_type || "venta",
       subtotal || 0, discount || 0, discount_pct || 0, igv || 0, total || 0,
       amount_paid || 0, change_given || 0, currency || "PEN", exchange_rate || 1,
       total_pen || total || 0, amount_paid_pen || amount_paid || 0,
       change_given_pen || change_given || 0, notes || null, req.worker.id]
    );
    const saleId = saleRows[0].id;

    if (details && details.length > 0) {
      for (const d of details) {
        await client.query(
          `INSERT INTO sale_details
           (sale_id, product_id, product_code, product_name, quantity,
            unit_price, discount_pct, discount_amount, igv_pct, igv_amount, subtotal, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [saleId, d.product_id, d.product_code, d.product_name, d.quantity,
           d.unit_price, d.discount_pct || 0, d.discount_amount || 0,
           d.igv_pct || 18, d.igv_amount || 0, d.subtotal, d.total]
        );
        const prev = await client.query("SELECT stock FROM products WHERE id = $1", [d.product_id]);
        const prevStock = parseInt(prev.rows[0]?.stock || 0);
        await client.query(
          "UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2",
          [d.quantity, d.product_id]
        );
        await client.query(
          `INSERT INTO inventory_movements
           (product_id, movement_type, quantity, quantity_before, quantity_after,
            unit_cost, reference_type, reference_id, performed_by)
           VALUES ($1,'venta',$2,$3,$4,$5,'sale',$6,$7)`,
          [d.product_id, d.quantity, prevStock, Math.max(0, prevStock - d.quantity),
           d.unit_price, saleId, req.worker.id]
        );
      }
    }

    if (invoice_type) {
      const seqMap = { FAC: "invoice_fac_seq", BOL: "invoice_bol_seq", NV: "invoice_nv_seq" };
      const prefMap = { FAC: "FAC-", BOL: "BOL-", NV: "NV-" };
      const seq = await client.query(`SELECT nextval('${seqMap[invoice_type]}')`);
      const invNum = prefMap[invoice_type] + String(seq.rows[0].nextval).padStart(8, "0");
      await client.query(
        `INSERT INTO invoices
         (invoice_number, invoice_type, sale_id, client_id,
          subtotal, discount, igv, total, currency, exchange_rate, total_pen,
          status, issued_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'emitida',$12)`,
        [invNum, invoice_type, saleId, client_id || null,
         subtotal || 0, discount || 0, igv || 0, total || 0,
         currency || "PEN", exchange_rate || 1, total_pen || total || 0, req.worker.id]
      );
    }

    if (payment_method_id) {
      await client.query(
        `INSERT INTO sale_payments
         (sale_id, payment_method_id, amount, currency, exchange_rate, amount_pen, registered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [saleId, payment_method_id, amount_paid || 0, currency || "PEN",
         exchange_rate || 1, amount_paid_pen || amount_paid || 0, req.worker.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id: saleId, sale_number: saleRows[0].sale_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /sales:", err);
    res.status(500).json({ error: "Error al registrar venta" });
  } finally {
    client.release();
  }
});

// GET /api/sales/payment-methods
router.get("/payment-methods", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY sort_order, name"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener métodos de pago" });
  }
});

// GET /api/clients
router.get("/clients", auth, async (req, res) => {
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
router.post("/clients", auth, async (req, res) => {
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

// GET /api/sales/:id — detalle completo (debe ir al final para no bloquear rutas específicas)
router.get("/:id", auth, async (req, res) => {
  try {
    const { rows: saleRows } = await pool.query(
      `SELECT s.*,
              c.document_type  AS client_doc_type,
              c.document_number AS client_doc_num,
              c.first_name     AS client_first_name,
              c.last_name      AS client_last_name,
              c.email          AS client_email,
              c.phone          AS client_phone,
              w.first_name || ' ' || w.last_name AS worker_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN workers w ON s.worker_id = w.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!saleRows[0]) return res.status(404).json({ error: "Venta no encontrada" });
    const sale = saleRows[0];

    const { rows: items } = await pool.query(
      `SELECT sd.*, p.image_url, p.name AS product_display_name
       FROM sale_details sd
       LEFT JOIN products p ON sd.product_id = p.id
       WHERE sd.sale_id = $1 ORDER BY sd.created_at`,
      [req.params.id]
    );

    const { rows: payments } = await pool.query(
      `SELECT sp.*, pm.name AS method_name, pm.code AS method_code,
              pm.type AS method_type, pm.currency AS method_currency
       FROM sale_payments sp
       LEFT JOIN payment_methods pm ON sp.payment_method_id = pm.id
       WHERE sp.sale_id = $1`,
      [req.params.id]
    );

    res.json({ ...sale, items, payments });
  } catch (err) {
    console.error("GET /sales/:id:", err);
    res.status(500).json({ error: "Error al obtener venta" });
  }
});

module.exports = router;
