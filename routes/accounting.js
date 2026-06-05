"use strict";

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middleware/auth");

const toDate = v => v || null;
const toNum  = v => parseFloat(v) || 0;
const toJson = v => typeof v === "string" ? v : JSON.stringify(v || []);

/* ═══════════════════════════════════════════════
   PLAN CONTABLE
═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
   HELPERS — normalizar fecha de Postgres
═══════════════════════════════════════════════ */
function isoDate(v) {
  if (!v) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return s.split("T")[0];
}

/* ═══════════════════════════════════════════════
   ASIENTOS (journal_entries)
═══════════════════════════════════════════════ */
function mapAsiento(row) {
  let log = [];
  try { log = Array.isArray(row.audit_log) ? row.audit_log : JSON.parse(row.audit_log || "[]"); } catch {}
  return {
    id:           row.id,
    correlativo:  row.correlativo || "",
    fecha:        isoDate(row.entry_date),
    tipo:         row.tipo || "ingreso",
    estado:       row.estado || "registrado",
    glosa:        row.description || "",
    codCuenta:    row.cod_cuenta || row.debit_account || "",
    denomCuenta:  row.denom_cuenta || "",
    debe:         toNum(row.debe),
    haber:        toNum(row.haber),
    monto:        toNum(row.amount || row.monto),
    moneda:       row.currency || "PEN",
    tipoDoc:      row.tipo_doc || "",
    serie:        row.serie || "",
    numero:       row.numero || "",
    medioPago:    row.medio_pago || "",
    rucDni:       row.ruc_dni || "",
    nombreCP:     row.nombre_cp || "",
    centro:       row.centro || "",
    categoria:    row.categoria || "",
    obs:          row.notes || "",
    usuario:      row.created_by_name || "Administrador",
    auditLog:     log,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

router.get("/entries", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT je.*, w.first_name || ' ' || w.last_name AS created_by_name
       FROM journal_entries je
       LEFT JOIN workers w ON je.created_by = w.id
       ORDER BY je.entry_date DESC, je.created_at DESC LIMIT 500`
    );
    res.json(rows.map(mapAsiento));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener asientos" });
  }
});

router.post("/entries", auth, async (req, res) => {
  const { correlativo, fecha, tipo, estado, glosa, codCuenta, denomCuenta,
          debe, haber, monto, moneda, tipoDoc, serie, numero, medioPago,
          rucDni, nombreCP, centro, categoria, obs, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO journal_entries
       (correlativo, entry_date, tipo, estado, description, cod_cuenta, denom_cuenta,
        debe, haber, amount, currency, tipo_doc, serie, numero, medio_pago,
        ruc_dni, nombre_cp, centro, categoria, notes, audit_log, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
       RETURNING *`,
      [correlativo || "", toDate(fecha), tipo || "ingreso", estado || "registrado",
       glosa || "", codCuenta || "", denomCuenta || "",
       toNum(debe), toNum(haber), toNum(monto || Math.max(toNum(debe), toNum(haber))),
       moneda || "PEN", tipoDoc || "", serie || "", numero || "", medioPago || "",
       rucDni || "", nombreCP || "", centro || "", categoria || "", obs || "",
       toJson(auditLog), req.worker.id]
    );
    res.status(201).json(mapAsiento(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear asiento" });
  }
});

router.put("/entries/:id", auth, async (req, res) => {
  const { correlativo, fecha, tipo, estado, glosa, codCuenta, denomCuenta,
          debe, haber, monto, moneda, tipoDoc, serie, numero, medioPago,
          rucDni, nombreCP, centro, categoria, obs, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE journal_entries SET
        correlativo=$1, entry_date=$2, tipo=$3, estado=$4, description=$5,
        cod_cuenta=$6, denom_cuenta=$7, debe=$8, haber=$9, amount=$10,
        currency=$11, tipo_doc=$12, serie=$13, numero=$14, medio_pago=$15,
        ruc_dni=$16, nombre_cp=$17, centro=$18, categoria=$19, notes=$20,
        audit_log=$21, updated_at=NOW()
       WHERE id=$22 RETURNING *`,
      [correlativo || "", toDate(fecha), tipo || "ingreso", estado || "registrado",
       glosa || "", codCuenta || "", denomCuenta || "",
       toNum(debe), toNum(haber), toNum(monto || Math.max(toNum(debe), toNum(haber))),
       moneda || "PEN", tipoDoc || "", serie || "", numero || "", medioPago || "",
       rucDni || "", nombreCP || "", centro || "", categoria || "", obs || "",
       toJson(auditLog), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Asiento no encontrado" });
    res.json(mapAsiento(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar asiento" });
  }
});

router.delete("/entries/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM journal_entries WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar asiento" });
  }
});

/* ═══════════════════════════════════════════════
   VENTAS del LIBRO (libro_ventas)
═══════════════════════════════════════════════ */
function mapVenta(row) {
  let log = [];
  try { log = Array.isArray(row.audit_log) ? row.audit_log : JSON.parse(row.audit_log || "[]"); } catch {}
  return {
    id:         row.id,
    _fuente:    row.fuente || "libro",
    fecha:      isoDate(row.fecha),
    cliente:    row.cliente || "",
    ruc:        row.ruc || "",
    tipoDoc:    row.tipo_doc || "",
    tipoComp:   row.tipo_comp || "",
    serie:      row.serie || "",
    numero:     row.numero || "",
    producto:   row.producto || "",
    cantidad:   toNum(row.cantidad),
    precioUnit: toNum(row.precio_unit),
    subtotal:   toNum(row.subtotal),
    igv:        toNum(row.igv),
    total:      toNum(row.total),
    medioPago:  row.medio_pago || "",
    estadoPago: row.estado_pago || "cobrado",
    cuenta:     row.cuenta || "7011",
    auditLog:   log,
    createdAt:  row.created_at,
  };
}

router.get("/libro-ventas", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM libro_ventas ORDER BY fecha DESC, created_at DESC LIMIT 300"
    );
    res.json(rows.map(mapVenta));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener ventas del libro" });
  }
});

// Ventas de venta.html (tabla sales) en formato libro
router.get("/ventas-from-sales", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         s.id,
         s.sale_number,
         s.sale_type,
         s.subtotal,
         s.discount,
         s.igv,
         s.total,
         s.currency,
         s.exchange_rate,
         s.sale_date,
         s.status,
         s.notes,
         s.created_at,

         /* Cliente */
         COALESCE(
           NULLIF(TRIM(c.business_name), ''),
           TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')),
           'Público general'
         ) AS client_name,
         COALESCE(c.document_number, '') AS client_doc,
         COALESCE(c.document_type, '') AS client_doc_type,

         /* Número de comprobante real (FAC/BOL/NV) desde tabla invoices */
         (SELECT inv.invoice_number
          FROM invoices inv
          WHERE inv.sale_id = s.id
          LIMIT 1) AS invoice_number,

         /* Tipo de comprobante */
         (SELECT inv.invoice_type
          FROM invoices inv
          WHERE inv.sale_id = s.id
          LIMIT 1) AS invoice_type,

         /* Productos: nombres concatenados desde sale_details */
         (SELECT STRING_AGG(sd.product_name, ', ' ORDER BY sd.product_name)
          FROM sale_details sd
          WHERE sd.sale_id = s.id) AS productos_detalle,

         /* Cantidad total */
         (SELECT COALESCE(SUM(sd.quantity), 0)
          FROM sale_details sd
          WHERE sd.sale_id = s.id) AS cantidad_total,

         /* Métodos de pago desde sale_payments */
         (SELECT STRING_AGG(COALESCE(pm.name, ''), ', ' ORDER BY pm.name)
          FROM sale_payments sp
          LEFT JOIN payment_methods pm ON sp.payment_method_id = pm.id
          WHERE sp.sale_id = s.id) AS metodos_pago

       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.deleted_at IS NULL
       ORDER BY s.sale_date DESC
       LIMIT 500`
    );

    const tipoMap = { FAC: "Factura", BOL: "Boleta", NV: "Nota de venta" };

    const ventas = rows.map(s => ({
      id:         s.id,
      _fuente:    "venta",
      fecha:      isoDate(s.sale_date),
      cliente:    (s.client_name || "Público general").trim(),
      ruc:        s.client_doc || "",
      tipoDoc:    s.client_doc_type || "",
      tipoComp:   tipoMap[s.invoice_type] || (s.sale_type === "venta" ? "Comprobante" : s.sale_type || "Comprobante"),
      serie:      "",
      numero:     s.invoice_number || s.sale_number || "",
      producto:   s.productos_detalle || "",
      cantidad:   toNum(s.cantidad_total),
      precioUnit: 0,
      subtotal:   toNum(s.subtotal),
      igv:        toNum(s.igv),
      total:      toNum(s.total),
      medioPago:  s.metodos_pago || "",
      estadoPago: "cobrado",
      cuenta:     "7011",
      auditLog:   [],
      createdAt:  s.created_at,
    }));

    res.json(ventas);
  } catch (err) {
    console.error("ventas-from-sales error:", err);
    res.status(500).json({ error: "Error al obtener ventas del módulo ventas" });
  }
});

router.post("/libro-ventas", auth, async (req, res) => {
  const { fecha, cliente, ruc, tipoDoc, tipoComp, serie, numero, producto,
          cantidad, precioUnit, subtotal, igv, total, medioPago, estadoPago, cuenta, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO libro_ventas
       (fecha, cliente, ruc, tipo_doc, tipo_comp, serie, numero, producto,
        cantidad, precio_unit, subtotal, igv, total, medio_pago, estado_pago, cuenta, fuente, audit_log, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'libro',$17,$18) RETURNING *`,
      [toDate(fecha), cliente || "", ruc || "", tipoDoc || "", tipoComp || "",
       serie || "", numero || "", producto || "",
       toNum(cantidad) || 1, toNum(precioUnit),
       toNum(subtotal), toNum(igv), toNum(total),
       medioPago || "", estadoPago || "cobrado", cuenta || "7011",
       toJson(auditLog), req.worker.id]
    );
    res.status(201).json(mapVenta(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear venta" });
  }
});

router.put("/libro-ventas/:id", auth, async (req, res) => {
  const { fecha, cliente, ruc, tipoDoc, tipoComp, serie, numero, producto,
          cantidad, precioUnit, subtotal, igv, total, medioPago, estadoPago, cuenta, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE libro_ventas SET
        fecha=$1, cliente=$2, ruc=$3, tipo_doc=$4, tipo_comp=$5, serie=$6, numero=$7, producto=$8,
        cantidad=$9, precio_unit=$10, subtotal=$11, igv=$12, total=$13,
        medio_pago=$14, estado_pago=$15, cuenta=$16, audit_log=$17, updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [toDate(fecha), cliente || "", ruc || "", tipoDoc || "", tipoComp || "",
       serie || "", numero || "", producto || "",
       toNum(cantidad) || 1, toNum(precioUnit),
       toNum(subtotal), toNum(igv), toNum(total),
       medioPago || "", estadoPago || "cobrado", cuenta || "7011",
       toJson(auditLog), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Venta no encontrada" });
    res.json(mapVenta(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar venta" });
  }
});

router.delete("/libro-ventas/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM libro_ventas WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar venta" });
  }
});

/* ═══════════════════════════════════════════════
   COMPRAS (libro_compras)
═══════════════════════════════════════════════ */
function mapCompra(row) {
  let log = [];
  try { log = Array.isArray(row.audit_log) ? row.audit_log : JSON.parse(row.audit_log || "[]"); } catch {}
  return {
    id:          row.id,
    fecha:       isoDate(row.fecha),
    proveedor:   row.proveedor || "",
    ruc:         row.ruc || "",
    tipoComp:    row.tipo_comp || "",
    serie:       row.serie || "",
    numero:      row.numero || "",
    categoria:   row.categoria || "",
    descripcion: row.descripcion || "",
    subtotal:    toNum(row.subtotal),
    igv:         toNum(row.igv),
    total:       toNum(row.total),
    medioPago:   row.medio_pago || "",
    estadoPago:  row.estado_pago || "pagado",
    cuenta:      row.cuenta || "6011",
    auditLog:    log,
    createdAt:   row.created_at,
  };
}

router.get("/libro-compras", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM libro_compras ORDER BY fecha DESC, created_at DESC LIMIT 300"
    );
    res.json(rows.map(mapCompra));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener compras" });
  }
});

router.post("/libro-compras", auth, async (req, res) => {
  const { fecha, proveedor, ruc, tipoComp, serie, numero, categoria, descripcion,
          subtotal, igv, total, medioPago, estadoPago, cuenta, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO libro_compras
       (fecha, proveedor, ruc, tipo_comp, serie, numero, categoria, descripcion,
        subtotal, igv, total, medio_pago, estado_pago, cuenta, audit_log, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [toDate(fecha), proveedor || "", ruc || "", tipoComp || "",
       serie || "", numero || "", categoria || "", descripcion || "",
       toNum(subtotal), toNum(igv), toNum(total),
       medioPago || "", estadoPago || "pagado", cuenta || "6011",
       toJson(auditLog), req.worker.id]
    );
    res.status(201).json(mapCompra(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear compra" });
  }
});

router.put("/libro-compras/:id", auth, async (req, res) => {
  const { fecha, proveedor, ruc, tipoComp, serie, numero, categoria, descripcion,
          subtotal, igv, total, medioPago, estadoPago, cuenta, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE libro_compras SET
        fecha=$1, proveedor=$2, ruc=$3, tipo_comp=$4, serie=$5, numero=$6,
        categoria=$7, descripcion=$8, subtotal=$9, igv=$10, total=$11,
        medio_pago=$12, estado_pago=$13, cuenta=$14, audit_log=$15, updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [toDate(fecha), proveedor || "", ruc || "", tipoComp || "",
       serie || "", numero || "", categoria || "", descripcion || "",
       toNum(subtotal), toNum(igv), toNum(total),
       medioPago || "", estadoPago || "pagado", cuenta || "6011",
       toJson(auditLog), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Compra no encontrada" });
    res.json(mapCompra(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar compra" });
  }
});

router.delete("/libro-compras/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM libro_compras WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar compra" });
  }
});

/* ═══════════════════════════════════════════════
   GASTOS (libro_gastos)
═══════════════════════════════════════════════ */
function mapGasto(row) {
  let log = [];
  try { log = Array.isArray(row.audit_log) ? row.audit_log : JSON.parse(row.audit_log || "[]"); } catch {}
  return {
    id:          row.id,
    fecha:       isoDate(row.fecha),
    categoria:   row.categoria || "",
    descripcion: row.descripcion || "",
    proveedor:   row.proveedor || "",
    tipoComp:    row.tipo_comp || "",
    serie:       row.serie || "",
    numero:      row.numero || "",
    subtotal:    toNum(row.subtotal),
    igv:         toNum(row.igv),
    total:       toNum(row.total),
    medioPago:   row.medio_pago || "",
    estadoPago:  row.estado_pago || "pagado",
    centro:      row.centro || "",
    cuenta:      row.cuenta || "94",
    auditLog:    log,
    createdAt:   row.created_at,
  };
}

router.get("/libro-gastos", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM libro_gastos ORDER BY fecha DESC, created_at DESC LIMIT 300"
    );
    res.json(rows.map(mapGasto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener gastos" });
  }
});

router.post("/libro-gastos", auth, async (req, res) => {
  const { fecha, categoria, descripcion, proveedor, tipoComp, serie, numero,
          subtotal, igv, total, medioPago, estadoPago, centro, cuenta, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO libro_gastos
       (fecha, categoria, descripcion, proveedor, tipo_comp, serie, numero,
        subtotal, igv, total, medio_pago, estado_pago, centro, cuenta, audit_log, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [toDate(fecha), categoria || "", descripcion || "", proveedor || "",
       tipoComp || "", serie || "", numero || "",
       toNum(subtotal), toNum(igv), toNum(total),
       medioPago || "", estadoPago || "pagado", centro || "", cuenta || "94",
       toJson(auditLog), req.worker.id]
    );
    res.status(201).json(mapGasto(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear gasto" });
  }
});

router.put("/libro-gastos/:id", auth, async (req, res) => {
  const { fecha, categoria, descripcion, proveedor, tipoComp, serie, numero,
          subtotal, igv, total, medioPago, estadoPago, centro, cuenta, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE libro_gastos SET
        fecha=$1, categoria=$2, descripcion=$3, proveedor=$4, tipo_comp=$5, serie=$6, numero=$7,
        subtotal=$8, igv=$9, total=$10, medio_pago=$11, estado_pago=$12,
        centro=$13, cuenta=$14, audit_log=$15, updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [toDate(fecha), categoria || "", descripcion || "", proveedor || "",
       tipoComp || "", serie || "", numero || "",
       toNum(subtotal), toNum(igv), toNum(total),
       medioPago || "", estadoPago || "pagado", centro || "", cuenta || "94",
       toJson(auditLog), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Gasto no encontrado" });
    res.json(mapGasto(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar gasto" });
  }
});

router.delete("/libro-gastos/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM libro_gastos WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar gasto" });
  }
});

/* ═══════════════════════════════════════════════
   INVERSIONES (libro_inversiones)
═══════════════════════════════════════════════ */
function mapInversion(row) {
  let log = [];
  try { log = Array.isArray(row.audit_log) ? row.audit_log : JSON.parse(row.audit_log || "[]"); } catch {}
  return {
    id:          row.id,
    _fuente:     "libro",
    fecha:       isoDate(row.fecha),
    tipo:        row.tipo || "",
    nombre:      row.nombre || "",
    monto:       toNum(row.monto),
    fuente:      row.fuente_financ || "",
    retornoEsp:  toNum(row.retorno_esp),
    retornoReal: toNum(row.retorno_real),
    plazo:       row.plazo || "",
    estado:      row.estado || "activa",
    obs:         row.obs || "",
    auditLog:    log,
    createdAt:   row.created_at,
  };
}

router.get("/libro-inversiones", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM libro_inversiones ORDER BY fecha DESC, created_at DESC LIMIT 200"
    );
    res.json(rows.map(mapInversion));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener inversiones" });
  }
});

router.post("/libro-inversiones", auth, async (req, res) => {
  const { fecha, tipo, nombre, monto, fuente, retornoEsp, retornoReal,
          plazo, estado, obs, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO libro_inversiones
       (fecha, tipo, nombre, monto, fuente_financ, retorno_esp, retorno_real, plazo, estado, obs, audit_log, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [toDate(fecha), tipo || "", nombre || "", toNum(monto), fuente || "",
       toNum(retornoEsp), toNum(retornoReal), plazo || "", estado || "activa", obs || "",
       toJson(auditLog), req.worker.id]
    );
    res.status(201).json(mapInversion(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear inversión" });
  }
});

router.put("/libro-inversiones/:id", auth, async (req, res) => {
  const { fecha, tipo, nombre, monto, fuente, retornoEsp, retornoReal,
          plazo, estado, obs, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE libro_inversiones SET
        fecha=$1, tipo=$2, nombre=$3, monto=$4, fuente_financ=$5,
        retorno_esp=$6, retorno_real=$7, plazo=$8, estado=$9, obs=$10,
        audit_log=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [toDate(fecha), tipo || "", nombre || "", toNum(monto), fuente || "",
       toNum(retornoEsp), toNum(retornoReal), plazo || "", estado || "activa", obs || "",
       toJson(auditLog), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Inversión no encontrada" });
    res.json(mapInversion(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar inversión" });
  }
});

router.delete("/libro-inversiones/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM libro_inversiones WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar inversión" });
  }
});

/* ═══════════════════════════════════════════════
   CxC — Cuentas por Cobrar (libro_cxc)
═══════════════════════════════════════════════ */
function mapCxc(row) {
  let log = [];
  try { log = Array.isArray(row.audit_log) ? row.audit_log : JSON.parse(row.audit_log || "[]"); } catch {}
  return {
    id:          row.id,
    tipo:        "manual",
    fecha:       isoDate(row.fecha),
    cliente:     row.cliente || "",
    ruc:         row.ruc || "",
    tipoComp:    row.tipo_comp || "",
    numero:      row.numero || "",
    concepto:    row.concepto || "",
    total:       toNum(row.total),
    cobrado:     toNum(row.cobrado),
    saldo:       toNum(row.saldo),
    vencimiento: isoDate(row.vencimiento),
    estadoPago:  row.estado_pago || "pendiente",
    auditLog:    log,
    createdAt:   row.created_at,
  };
}

router.get("/libro-cxc", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM libro_cxc ORDER BY fecha DESC, created_at DESC LIMIT 200"
    );
    res.json(rows.map(mapCxc));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener CxC" });
  }
});

router.post("/libro-cxc", auth, async (req, res) => {
  const { fecha, cliente, ruc, tipoComp, numero, concepto,
          total, cobrado, saldo, vencimiento, estadoPago, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO libro_cxc
       (fecha, cliente, ruc, tipo_comp, numero, concepto, total, cobrado, saldo, vencimiento, estado_pago, audit_log, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [toDate(fecha), cliente || "", ruc || "", tipoComp || "", numero || "", concepto || "",
       toNum(total), toNum(cobrado), toNum(saldo), toDate(vencimiento) || null,
       estadoPago || "pendiente", toJson(auditLog), req.worker.id]
    );
    res.status(201).json(mapCxc(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear CxC" });
  }
});

router.put("/libro-cxc/:id", auth, async (req, res) => {
  const { fecha, cliente, ruc, tipoComp, numero, concepto,
          total, cobrado, saldo, vencimiento, estadoPago, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE libro_cxc SET
        fecha=$1, cliente=$2, ruc=$3, tipo_comp=$4, numero=$5, concepto=$6,
        total=$7, cobrado=$8, saldo=$9, vencimiento=$10, estado_pago=$11,
        audit_log=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [toDate(fecha), cliente || "", ruc || "", tipoComp || "", numero || "", concepto || "",
       toNum(total), toNum(cobrado), toNum(saldo), toDate(vencimiento) || null,
       estadoPago || "pendiente", toJson(auditLog), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "CxC no encontrada" });
    res.json(mapCxc(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar CxC" });
  }
});

router.delete("/libro-cxc/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM libro_cxc WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar CxC" });
  }
});

/* ═══════════════════════════════════════════════
   CxP — Cuentas por Pagar (libro_cxp)
═══════════════════════════════════════════════ */
function mapCxp(row) {
  let log = [];
  try { log = Array.isArray(row.audit_log) ? row.audit_log : JSON.parse(row.audit_log || "[]"); } catch {}
  return {
    id:          row.id,
    tipo:        "manual",
    fecha:       isoDate(row.fecha),
    proveedor:   row.proveedor || "",
    ruc:         row.ruc || "",
    tipoComp:    row.tipo_comp || "",
    numero:      row.numero || "",
    concepto:    row.concepto || "",
    total:       toNum(row.total),
    pagado:      toNum(row.pagado),
    saldo:       toNum(row.saldo),
    vencimiento: isoDate(row.vencimiento),
    estadoPago:  row.estado_pago || "pendiente",
    auditLog:    log,
    createdAt:   row.created_at,
  };
}

router.get("/libro-cxp", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM libro_cxp ORDER BY fecha DESC, created_at DESC LIMIT 200"
    );
    res.json(rows.map(mapCxp));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener CxP" });
  }
});

router.post("/libro-cxp", auth, async (req, res) => {
  const { fecha, proveedor, ruc, tipoComp, numero, concepto,
          total, pagado, saldo, vencimiento, estadoPago, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO libro_cxp
       (fecha, proveedor, ruc, tipo_comp, numero, concepto, total, pagado, saldo, vencimiento, estado_pago, audit_log, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [toDate(fecha), proveedor || "", ruc || "", tipoComp || "", numero || "", concepto || "",
       toNum(total), toNum(pagado), toNum(saldo), toDate(vencimiento) || null,
       estadoPago || "pendiente", toJson(auditLog), req.worker.id]
    );
    res.status(201).json(mapCxp(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear CxP" });
  }
});

router.put("/libro-cxp/:id", auth, async (req, res) => {
  const { fecha, proveedor, ruc, tipoComp, numero, concepto,
          total, pagado, saldo, vencimiento, estadoPago, auditLog } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE libro_cxp SET
        fecha=$1, proveedor=$2, ruc=$3, tipo_comp=$4, numero=$5, concepto=$6,
        total=$7, pagado=$8, saldo=$9, vencimiento=$10, estado_pago=$11,
        audit_log=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [toDate(fecha), proveedor || "", ruc || "", tipoComp || "", numero || "", concepto || "",
       toNum(total), toNum(pagado), toNum(saldo), toDate(vencimiento) || null,
       estadoPago || "pendiente", toJson(auditLog), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "CxP no encontrada" });
    res.json(mapCxp(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar CxP" });
  }
});

router.delete("/libro-cxp/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM libro_cxp WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar CxP" });
  }
});

/* ═══════════════════════════════════════════════
   LEGACY — endpoints heredados usados por server.js
═══════════════════════════════════════════════ */
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
