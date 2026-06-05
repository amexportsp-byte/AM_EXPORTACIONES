"use strict";

const router   = require("express").Router();
const pool     = require("../db");
const jwt      = require("jsonwebtoken");
const custAuth = require("../middleware/customer-auth");

const JWT_SECRET  = process.env.JWT_SECRET;

function makeToken(payload) {
  return jwt.sign({ ...payload, type: "customer" }, JWT_SECRET, { expiresIn: "72h" });
}

// ─────────────────────────────────────────────
// POST /api/customers/login
// Body: { doc_type, doc_number }
// Retorna token si el documento existe
// ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { doc_type, doc_number } = req.body;
  if (!doc_type || !doc_number)
    return res.status(400).json({ error: "Tipo y número de documento son requeridos" });

  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, address, district, status
       FROM clients
       WHERE document_type = $1 AND document_number = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [doc_type, doc_number]
    );

    if (!rows.length)
      return res.status(404).json({ notFound: true, error: "Documento no registrado" });

    const c = rows[0];
    if (c.status !== "activo")
      return res.status(403).json({ error: "Cuenta inactiva o bloqueada" });

    const name  = `${c.first_name} ${c.last_name || ""}`.trim();
    const token = makeToken({ client_id: c.id, email: c.email || "", name });

    res.json({
      token, name,
      email:    c.email    || "",
      phone:    c.phone    || "",
      address:  c.address  || "",
      district: c.district || "",
    });
  } catch (err) {
    console.error("POST /customers/login:", err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// ─────────────────────────────────────────────
// POST /api/customers/register
// Body: { doc_type, doc_number, first_name, last_name, email, phone? }
// ─────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { doc_type, doc_number, first_name, last_name, email, phone } = req.body;

  if (!doc_type || !doc_number || !first_name || !last_name || !email)
    return res.status(400).json({ error: "Nombre, apellidos y correo son obligatorios" });

  try {
    // Documento no duplicado
    const dupDoc = await pool.query(
      "SELECT id FROM clients WHERE document_type=$1 AND document_number=$2 AND deleted_at IS NULL",
      [doc_type, doc_number]
    );
    if (dupDoc.rows.length)
      return res.status(400).json({ error: "Ese número de documento ya está registrado" });

    // Email no duplicado
    const dupEmail = await pool.query(
      "SELECT id FROM clients WHERE email=$1 AND deleted_at IS NULL", [email]
    );
    if (dupEmail.rows.length)
      return res.status(400).json({ error: "Ese correo electrónico ya está registrado" });

    const { rows: [client] } = await pool.query(
      `INSERT INTO clients (document_type, document_number, first_name, last_name, email, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'activo') RETURNING id`,
      [doc_type, doc_number, first_name.trim(), last_name.trim(), email.trim(), phone || null]
    );

    const name  = `${first_name.trim()} ${last_name.trim()}`;
    const token = makeToken({ client_id: client.id, email: email.trim(), name });
    res.status(201).json({ token, name, email: email.trim() });
  } catch (err) {
    console.error("POST /customers/register:", err);
    res.status(500).json({ error: "Error al crear cuenta" });
  }
});

// ─────────────────────────────────────────────
// GET /api/customers/me  (protegido)
// ─────────────────────────────────────────────
router.get("/me", custAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, address, district, city,
              document_type, document_number, created_at
       FROM clients WHERE id = $1 AND deleted_at IS NULL`,
      [req.customer.client_id]
    );
    if (!rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    const c = rows[0];
    res.json({
      id:        c.id,
      name:      `${c.first_name} ${c.last_name || ""}`.trim(),
      email:     c.email      || "",
      phone:     c.phone      || "",
      address:   c.address    || "",
      district:  c.district   || "",
      city:      c.city       || "",
      docType:   c.document_type   || "",
      docNumber: c.document_number || "",
      createdAt: c.created_at,
    });
  } catch (err) {
    console.error("GET /customers/me:", err);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

// ─────────────────────────────────────────────
// PUT /api/customers/me  (protegido)
// ─────────────────────────────────────────────
router.put("/me", custAuth, async (req, res) => {
  const { name, phone, address, district, city } = req.body;
  const parts     = (name || "").trim().split(" ");
  const firstName = parts[0] || "";
  const lastName  = parts.slice(1).join(" ") || "";
  try {
    await pool.query(
      `UPDATE clients SET first_name=$1, last_name=$2, phone=$3,
       address=$4, district=$5, city=$6, updated_at=NOW() WHERE id=$7`,
      [firstName, lastName, phone || null, address || null, district || null, city || null, req.customer.client_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /customers/me:", err);
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
});

// ─────────────────────────────────────────────
// GET /api/customers/orders  (protegido)
// ─────────────────────────────────────────────
router.get("/orders", custAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.order_number, o.status, o.total, o.created_at,
              json_agg(json_build_object(
                'name', od.product_name, 'qty', od.quantity,
                'price', od.unit_price, 'subtotal', od.subtotal
              )) AS items
       FROM orders o
       LEFT JOIN order_details od ON od.order_id = o.id
       WHERE o.client_id = $1 AND o.deleted_at IS NULL
       GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.customer.client_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /customers/orders:", err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

module.exports = router;
