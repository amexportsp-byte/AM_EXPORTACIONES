"use strict";

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middleware/auth");

router.use(auth);

// ── GET /api/admin/customers ─────────────────
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.phone,
              c.address, c.district, c.city, c.status,
              c.document_type, c.document_number, c.created_at,
              (SELECT COUNT(*) FROM orders o
               WHERE o.client_id = c.id AND o.deleted_at IS NULL)::int AS total_orders,
              (SELECT COALESCE(SUM(s.total),0) FROM sales s
               WHERE s.client_id = c.id AND s.deleted_at IS NULL) AS total_spent
       FROM clients c
       WHERE c.deleted_at IS NULL
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /admin/customers:", err);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

// ── GET /api/admin/customers/:id ─────────────
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone,
              address, district, city, status,
              document_type, document_number, created_at, updated_at
       FROM clients WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /admin/customers/:id:", err);
    res.status(500).json({ error: "Error al obtener cliente" });
  }
});

// ── PUT /api/admin/customers/:id ─────────────
router.put("/:id", async (req, res) => {
  const { first_name, last_name, email, phone, address, district, city, status, document_type, document_number } = req.body;
  try {
    await pool.query(
      `UPDATE clients
       SET first_name     = COALESCE($1, first_name),
           last_name      = COALESCE($2, last_name),
           email          = COALESCE($3, email),
           phone          = $4,
           address        = $5,
           district       = $6,
           city           = $7,
           status         = COALESCE($8, status),
           document_type  = COALESCE($9, document_type),
           document_number= COALESCE($10, document_number),
           updated_at     = NOW()
       WHERE id = $11`,
      [first_name, last_name, email, phone || null, address || null,
       district || null, city || null, status || null,
       document_type || null, document_number || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /admin/customers/:id:", err);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

// ── GET /api/admin/customers/:id/orders ──────
router.get("/:id/orders", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.order_number, o.status, o.total, o.shipping_address,
              o.shipping_district, o.created_at, o.updated_at,
              json_agg(json_build_object(
                'name', od.product_name, 'qty', od.quantity,
                'price', od.unit_price, 'subtotal', od.subtotal
              ) ORDER BY od.created_at) AS items
       FROM orders o
       LEFT JOIN order_details od ON od.order_id = o.id
       WHERE o.client_id = $1 AND o.deleted_at IS NULL
       GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /admin/customers/:id/orders:", err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

// ── GET /api/admin/customers/:id/purchases ───
router.get("/:id/purchases", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.sale_number, s.status, s.total, s.total_pen,
              s.currency, s.sale_date, s.notes,
              w.first_name || ' ' || w.last_name AS vendedor,
              json_agg(json_build_object(
                'name', sd.product_name, 'qty', sd.quantity,
                'price', sd.unit_price, 'total', sd.total
              ) ORDER BY sd.created_at) AS items
       FROM sales s
       LEFT JOIN sale_details sd ON sd.sale_id = s.id
       LEFT JOIN workers w ON w.id = s.worker_id
       WHERE s.client_id = $1 AND s.deleted_at IS NULL
       GROUP BY s.id, w.first_name, w.last_name
       ORDER BY s.sale_date DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /admin/customers/:id/purchases:", err);
    res.status(500).json({ error: "Error al obtener compras" });
  }
});

// ── DELETE /api/admin/customers/:id ──────────
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE clients SET deleted_at=NOW(), status='inactivo' WHERE id=$1",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/customers/:id:", err);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

module.exports = router;
