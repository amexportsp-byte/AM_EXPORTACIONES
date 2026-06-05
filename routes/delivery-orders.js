"use strict";

const router   = require("express").Router();
const pool     = require("../db");
const auth     = require("../middleware/auth");
const custAuth = require("../middleware/customer-auth");

// ─── Helper: generate PED-YYYYNNNN order number ─────────────────────────────
async function nextOrderNumber(client) {
  const year = new Date().getFullYear();
  const { rows } = await (client || pool).query(
    "SELECT COUNT(*) FROM delivery_orders WHERE EXTRACT(YEAR FROM created_at) = $1", [year]
  );
  return `PED-${year}${String(parseInt(rows[0].count) + 1).padStart(4, "0")}`;
}

// ─── Helper: generate stale-order alerts (lazy, called on GET /alerts) ───────
async function generateAlerts() {
  const checks = [
    {
      sql: `SELECT id, order_number FROM delivery_orders
            WHERE status = 'entrega' AND confirmed_at IS NULL AND deleted_at IS NULL
              AND delivered_at < NOW() - INTERVAL '6 hours'`,
      type: "sin_conformidad",
      msg:  r => `Pedido ${r.order_number}: entregado hace más de 6 h sin conformidad del cliente.`,
    },
    {
      sql: `SELECT id, order_number FROM delivery_orders
            WHERE status = 'en_curso' AND deleted_at IS NULL
              AND in_transit_at < NOW() - INTERVAL '4 hours'`,
      type: "demora_entrega",
      msg:  r => `Pedido ${r.order_number}: en camino hace más de 4 h sin registrar entrega.`,
    },
    {
      sql: `SELECT id, order_number FROM delivery_orders
            WHERE status = 'agendado' AND deleted_at IS NULL
              AND scheduled_at < NOW() - INTERVAL '24 hours'`,
      type: "demora_preparacion",
      msg:  r => `Pedido ${r.order_number}: agendado hace más de 24 h sin iniciar preparación.`,
    },
  ];

  for (const check of checks) {
    const { rows } = await pool.query(check.sql);
    for (const row of rows) {
      const exists = await pool.query(
        `SELECT id FROM delivery_order_alerts
         WHERE delivery_order_id = $1 AND alert_type = $2 AND is_read = FALSE`,
        [row.id, check.type]
      );
      if (!exists.rows.length) {
        await pool.query(
          "INSERT INTO delivery_order_alerts (delivery_order_id, alert_type, message) VALUES ($1,$2,$3)",
          [row.id, check.type, check.msg(row)]
        );
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  WORKER / ADMIN ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/delivery-orders — list all orders
router.get("/", auth, async (req, res) => {
  try {
    const { status } = req.query;
    const params     = [];
    const conditions = ["do2.deleted_at IS NULL"];
    if (status && status !== "todos") {
      params.push(status);
      conditions.push(`do2.status = $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT do2.id, do2.order_number, do2.status, do2.delivery_address, do2.delivery_reference,
              do2.scheduled_at, do2.preparing_at, do2.ready_at, do2.in_transit_at,
              do2.delivered_at, do2.confirmed_at, do2.cancelled_at, do2.notes, do2.cancel_reason,
              do2.client_id, do2.sale_id,
              c.first_name || ' ' || COALESCE(c.last_name,'') AS client_name,
              c.document_type, c.document_number, c.phone AS client_phone,
              s.sale_number,
              COALESCE(i.invoice_number, '') AS invoice_number,
              s.total AS sale_total, s.currency, s.total_pen,
              w.first_name || ' ' || COALESCE(w.last_name,'') AS assigned_worker_name
       FROM delivery_orders do2
       LEFT JOIN clients c  ON do2.client_id = c.id
       LEFT JOIN sales s    ON do2.sale_id = s.id
       LEFT JOIN invoices i ON i.sale_id = do2.sale_id AND i.id IS NOT NULL
       LEFT JOIN workers w  ON do2.assigned_worker_id = w.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY do2.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /delivery-orders:", err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

// GET /api/delivery-orders/alerts — active (unread) alerts
router.get("/alerts", auth, async (req, res) => {
  try {
    await generateAlerts();
    const { rows } = await pool.query(
      `SELECT a.*, do2.order_number, do2.status AS order_status
       FROM delivery_order_alerts a
       JOIN delivery_orders do2 ON a.delivery_order_id = do2.id
       WHERE a.is_read = FALSE
       ORDER BY a.created_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /delivery-orders/alerts:", err);
    res.status(500).json({ error: "Error al obtener alertas" });
  }
});

// PUT /api/delivery-orders/alerts/:id/read — mark alert read
router.put("/alerts/:id/read", auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE delivery_order_alerts SET is_read = TRUE WHERE id = $1", [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /delivery-orders/alerts/:id/read:", err);
    res.status(500).json({ error: "Error al marcar alerta" });
  }
});

// GET /api/delivery-orders/lookup-sale?q=VEN-20260001 or FAC-00000001
router.get("/lookup-sale", auth, async (req, res) => {
  const q = (req.query.q || "").trim().toUpperCase();
  if (!q) return res.status(400).json({ error: "Ingresa un número de venta o comprobante" });

  try {
    const { rows } = await pool.query(
      `SELECT s.id AS sale_id, s.sale_number, s.total, s.currency,
              s.total_pen, s.created_at AS sale_date, s.notes AS sale_notes, s.status AS sale_status,
              c.id AS client_id,
              c.first_name || ' ' || COALESCE(c.last_name,'') AS client_name,
              c.document_type, c.document_number, c.phone, c.email, c.address, c.district,
              COALESCE(i.invoice_number,'') AS invoice_number,
              COALESCE(i.invoice_type,'') AS invoice_type,
              (SELECT json_agg(json_build_object(
                 'product_name',  sd.product_name,
                 'product_code',  sd.product_code,
                 'quantity',      sd.quantity,
                 'unit_price',    sd.unit_price,
                 'discount_pct',  sd.discount_pct,
                 'discount_amount', sd.discount_amount,
                 'igv_pct',       sd.igv_pct,
                 'igv_amount',    sd.igv_amount,
                 'subtotal',      sd.subtotal,
                 'total',         sd.total,
                 'image_url',     p.image_url
              ) ORDER BY sd.id)
               FROM sale_details sd
               LEFT JOIN products p ON p.id = sd.product_id
               WHERE sd.sale_id = s.id) AS items,
              (SELECT json_agg(json_build_object(
                 'method_name', pm.name,
                 'amount',      sp.amount,
                 'currency',    sp.currency
              )) FROM sale_payments sp
                 JOIN payment_methods pm ON sp.payment_method_id = pm.id
                 WHERE sp.sale_id = s.id) AS payments
       FROM sales s
       LEFT JOIN clients  c ON s.client_id = c.id
       LEFT JOIN invoices i ON i.sale_id = s.id AND i.id IS NOT NULL
       WHERE s.deleted_at IS NULL
         AND (UPPER(s.sale_number) = $1 OR UPPER(i.invoice_number) = $1)
       LIMIT 1`,
      [q]
    );

    if (!rows.length)
      return res.status(404).json({ error: "No se encontró ninguna venta con ese código" });

    const sale = rows[0];

    // Último pedido de entrega para esta venta (puede ser cancelado)
    const existing = await pool.query(
      `SELECT id, order_number, status
       FROM delivery_orders WHERE sale_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [sale.sale_id]
    );

    const existingDelivery = existing.rows[0] || null;
    // Si el único pedido existente está cancelado, se puede re-agendar
    const canReschedule = existingDelivery?.status === 'cancelado';

    res.json({ ...sale, existing_delivery: existingDelivery, can_reschedule: canReschedule });
  } catch (err) {
    console.error("GET /delivery-orders/lookup-sale:", err);
    res.status(500).json({ error: "Error al buscar venta" });
  }
});

// GET /api/delivery-orders/workers-list — list active workers for assignment select
router.get("/workers-list", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name || ' ' || COALESCE(last_name,'') AS name, role
       FROM workers WHERE deleted_at IS NULL AND status = 'activo'
       ORDER BY first_name`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /delivery-orders/workers-list:", err);
    res.status(500).json({ error: "Error al obtener trabajadores" });
  }
});

// GET /api/delivery-orders/global-history — historial global de todos los pedidos
router.get("/global-history", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.id, h.from_status, h.to_status, h.changed_by_type, h.changed_by_name,
              h.notes, h.created_at,
              do2.id AS order_id, do2.order_number, do2.status AS current_status,
              s.sale_number,
              COALESCE(i.invoice_number,'') AS invoice_number,
              c.first_name || ' ' || COALESCE(c.last_name,'') AS client_name,
              c.document_number AS client_doc
       FROM delivery_order_history h
       JOIN delivery_orders do2 ON h.delivery_order_id = do2.id
       JOIN sales s             ON do2.sale_id = s.id
       LEFT JOIN clients  c     ON do2.client_id = c.id
       LEFT JOIN invoices i     ON i.sale_id = do2.sale_id
       WHERE do2.deleted_at IS NULL
       ORDER BY h.created_at DESC
       LIMIT 300`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /delivery-orders/global-history:", err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// GET /api/delivery-orders/:id — full detail with client info + history
router.get("/:id", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT do2.*,
              c.first_name, c.last_name,
              c.document_type, c.document_number,
              c.phone AS client_phone, c.email AS client_email,
              c.address AS client_address, c.district AS client_district,
              s.sale_number, s.total AS sale_total, s.currency, s.total_pen, s.notes AS sale_notes,
              COALESCE(i.invoice_number,'') AS invoice_number,
              COALESCE(i.invoice_type,'')   AS invoice_type,
              w.first_name || ' ' || COALESCE(w.last_name,'') AS assigned_worker_name,
              (SELECT json_agg(json_build_object(
                 'product_name', sd.product_name,
                 'quantity',     sd.quantity,
                 'unit_price',   sd.unit_price,
                 'total',        sd.total
              )) FROM sale_details sd WHERE sd.sale_id = do2.sale_id) AS items,
              (SELECT json_agg(json_build_object(
                 'from_status',      h.from_status,
                 'to_status',        h.to_status,
                 'changed_by_name',  h.changed_by_name,
                 'changed_by_type',  h.changed_by_type,
                 'notes',            h.notes,
                 'created_at',       h.created_at
              ) ORDER BY h.created_at ASC)
               FROM delivery_order_history h WHERE h.delivery_order_id = do2.id) AS history
       FROM delivery_orders do2
       LEFT JOIN clients  c ON do2.client_id = c.id
       LEFT JOIN sales    s ON do2.sale_id = s.id
       LEFT JOIN invoices i ON i.sale_id = do2.sale_id AND i.id IS NOT NULL
       LEFT JOIN workers  w ON do2.assigned_worker_id = w.id
       WHERE do2.id = $1 AND do2.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /delivery-orders/:id:", err);
    res.status(500).json({ error: "Error al obtener pedido" });
  }
});

// POST /api/delivery-orders — create delivery order from a sale
router.post("/", auth, async (req, res) => {
  const { sale_id, client_id, delivery_address, delivery_reference, assigned_worker_id, notes } = req.body;
  if (!sale_id) return res.status(400).json({ error: "sale_id es requerido" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const saleCheck = await client.query(
      "SELECT id FROM sales WHERE id = $1 AND deleted_at IS NULL", [sale_id]
    );
    if (!saleCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    // Solo bloquea si existe un pedido activo (no cancelado) para esta venta
    const existCheck = await client.query(
      `SELECT id FROM delivery_orders
       WHERE sale_id = $1 AND deleted_at IS NULL AND status != 'cancelado'`,
      [sale_id]
    );
    if (existCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Ya existe un pedido activo para esta venta" });
    }

    const orderNumber = await nextOrderNumber(client);

    const { rows } = await client.query(
      `INSERT INTO delivery_orders
       (order_number, sale_id, client_id, status, delivery_address, delivery_reference,
        assigned_worker_id, notes, created_by, scheduled_at)
       VALUES ($1,$2,$3,'agendado',$4,$5,$6,$7,$8,NOW())
       RETURNING id, order_number`,
      [orderNumber, sale_id, client_id || null, delivery_address || null,
       delivery_reference || null, assigned_worker_id || null, notes || null, req.worker.id]
    );

    await client.query(
      `INSERT INTO delivery_order_history
       (delivery_order_id, from_status, to_status, changed_by_type, changed_by_id, changed_by_name, notes)
       VALUES ($1, NULL, 'agendado', 'worker', $2, $3, 'Pedido agendado')`,
      [rows[0].id, req.worker.id, req.worker.username || "Trabajador"]
    );

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /delivery-orders:", err);
    res.status(500).json({ error: "Error al crear pedido de entrega" });
  } finally {
    client.release();
  }
});

// ─── Status advancement map ───────────────────────────────────────────────────
const WORKER_NEXT = {
  agendado:   "preparando",
  preparando: "alistado",
  alistado:   "en_curso",
  en_curso:   "entrega",
};
const STATUS_TS_COL = {
  preparando: "preparing_at",
  alistado:   "ready_at",
  en_curso:   "in_transit_at",
  entrega:    "delivered_at",
};

// PUT /api/delivery-orders/:id/status — worker advances status one step
router.put("/:id/status", auth, async (req, res) => {
  const { notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, order_number, status FROM delivery_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const order      = rows[0];
    const nextStatus = WORKER_NEXT[order.status];
    if (!nextStatus) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `No se puede avanzar desde el estado "${order.status}"` });
    }

    const tsCol   = STATUS_TS_COL[nextStatus];
    const tsExtra = tsCol ? `, ${tsCol} = NOW()` : "";

    await client.query(
      `UPDATE delivery_orders SET status = $1 ${tsExtra}, updated_at = NOW() WHERE id = $2`,
      [nextStatus, order.id]
    );

    await client.query(
      `INSERT INTO delivery_order_history
       (delivery_order_id, from_status, to_status, changed_by_type, changed_by_id, changed_by_name, notes)
       VALUES ($1,$2,$3,'worker',$4,$5,$6)`,
      [order.id, order.status, nextStatus, req.worker.id,
       req.worker.username || "Trabajador", notes || null]
    );

    await client.query("COMMIT");
    res.json({ ok: true, from: order.status, to: nextStatus });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /delivery-orders/:id/status:", err);
    res.status(500).json({ error: "Error al actualizar estado" });
  } finally {
    client.release();
  }
});

// PUT /api/delivery-orders/:id/worker-cancel — worker cancels an order
router.put("/:id/worker-cancel", auth, async (req, res) => {
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, order_number, status FROM delivery_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const order = rows[0];
    if (!["agendado", "preparando"].includes(order.status)) {
      await client.query("ROLLBACK");
      const msg = order.status === "alistado"
        ? "No se puede cancelar: el pedido ya fue alistado."
        : `No se puede cancelar en el estado actual (${order.status}).`;
      return res.status(400).json({ error: msg });
    }

    await client.query(
      `UPDATE delivery_orders
       SET status='cancelado', cancelled_at=NOW(), cancel_reason=$1, updated_at=NOW()
       WHERE id=$2`,
      [reason || null, order.id]
    );
    await client.query(
      `INSERT INTO delivery_order_history
       (delivery_order_id, from_status, to_status, changed_by_type, changed_by_id, changed_by_name, notes)
       VALUES ($1,$2,'cancelado','worker',$3,$4,$5)`,
      [order.id, order.status, req.worker.id,
       req.worker.username || "Trabajador", reason || "Cancelado por trabajador"]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /delivery-orders/:id/worker-cancel:", err);
    res.status(500).json({ error: "Error al cancelar pedido" });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  CUSTOMER ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/delivery-orders/customer/my-orders
router.get("/customer/my-orders", custAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT do2.id, do2.order_number, do2.status,
              do2.delivery_address, do2.delivery_reference,
              do2.scheduled_at, do2.preparing_at, do2.ready_at, do2.in_transit_at,
              do2.delivered_at, do2.confirmed_at, do2.cancelled_at,
              do2.notes, do2.cancel_reason,
              s.sale_number, s.total AS sale_total, s.currency, s.total_pen,
              COALESCE(i.invoice_number,'') AS invoice_number,
              COALESCE(i.invoice_type,'')   AS invoice_type,
              (SELECT json_agg(json_build_object(
                 'product_name', sd.product_name,
                 'quantity',     sd.quantity,
                 'unit_price',   sd.unit_price,
                 'total',        sd.total
              )) FROM sale_details sd WHERE sd.sale_id = do2.sale_id) AS items
       FROM delivery_orders do2
       LEFT JOIN sales    s ON do2.sale_id = s.id
       LEFT JOIN invoices i ON i.sale_id = do2.sale_id AND i.id IS NOT NULL
       WHERE do2.client_id = $1 AND do2.deleted_at IS NULL
       ORDER BY do2.created_at DESC`,
      [req.customer.client_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /delivery-orders/customer/my-orders:", err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

// PUT /api/delivery-orders/:id/confirm — customer confirms receipt (conformidad)
router.put("/:id/confirm", custAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, order_number, status, client_id FROM delivery_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const order = rows[0];
    if (order.client_id !== req.customer.client_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No tienes permiso para confirmar este pedido" });
    }
    if (order.status !== "entrega") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Solo puedes confirmar cuando el pedido está en estado 'entrega'" });
    }

    await client.query(
      "UPDATE delivery_orders SET status='conformidad', confirmed_at=NOW(), updated_at=NOW() WHERE id=$1",
      [order.id]
    );
    await client.query(
      `INSERT INTO delivery_order_history
       (delivery_order_id, from_status, to_status, changed_by_type, changed_by_id, changed_by_name)
       VALUES ($1,'entrega','conformidad','customer',$2,$3)`,
      [order.id, req.customer.client_id, req.customer.name || "Cliente"]
    );
    // Dismiss related alert
    await client.query(
      "UPDATE delivery_order_alerts SET is_read=TRUE WHERE delivery_order_id=$1 AND alert_type='sin_conformidad'",
      [order.id]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /delivery-orders/:id/confirm:", err);
    res.status(500).json({ error: "Error al confirmar entrega" });
  } finally {
    client.release();
  }
});

// PUT /api/delivery-orders/:id/cancel — customer cancels (only agendado or preparando)
router.put("/:id/cancel", custAuth, async (req, res) => {
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, order_number, status, client_id FROM delivery_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const order = rows[0];
    if (order.client_id !== req.customer.client_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "No tienes permiso para cancelar este pedido" });
    }
    if (!["agendado", "preparando"].includes(order.status)) {
      await client.query("ROLLBACK");
      const msg = order.status === "alistado"
        ? "No se puede cancelar: el pedido ya fue alistado y está listo para su entrega."
        : `No se puede cancelar en el estado actual (${order.status}).`;
      return res.status(400).json({ error: msg });
    }

    await client.query(
      `UPDATE delivery_orders
       SET status='cancelado', cancelled_at=NOW(), cancel_reason=$1, updated_at=NOW()
       WHERE id=$2`,
      [reason || null, order.id]
    );
    await client.query(
      `INSERT INTO delivery_order_history
       (delivery_order_id, from_status, to_status, changed_by_type, changed_by_id, changed_by_name, notes)
       VALUES ($1,$2,'cancelado','customer',$3,$4,$5)`,
      [order.id, order.status, req.customer.client_id,
       req.customer.name || "Cliente", reason || "Cancelado por el cliente"]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /delivery-orders/:id/cancel:", err);
    res.status(500).json({ error: "Error al cancelar pedido" });
  } finally {
    client.release();
  }
});

module.exports = router;
