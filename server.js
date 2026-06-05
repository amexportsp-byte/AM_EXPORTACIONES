"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ─── Middleware global ─── */
app.use(cors());
app.use(express.json());

/* ─── Protección de archivos estáticos ─── */
// Debe ir ANTES de express.static para interceptar JS/CSS/HTML sin sesión.
app.use(require("./middleware/static-auth"));

/* ─── Frontend estático (carpeta public/) ─── */
app.use(express.static(path.join(__dirname, "public")));

/* ─── Server-Sent Events: notificación en tiempo real de cambios de productos ─── */
const appEvents = require("./events");

app.get("/api/products/events", (req, res) => {
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(": connected\n\n");

  // Keepalive cada 20 s para que el browser no corte la conexión
  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { clearInterval(keepalive); }
  }, 20000);

  function onUpdate() {
    try { res.write(`data: {"type":"products_updated"}\n\n`); } catch {}
  }

  appEvents.on("products_updated", onUpdate);

  req.on("close", () => {
    clearInterval(keepalive);
    appEvents.off("products_updated", onUpdate);
  });
});

/* ─── Rutas API ─── */
app.use("/api/auth",        require("./routes/auth"));
app.use("/api/products",    require("./routes/products"));
app.use("/api/workers",     require("./routes/workers"));
app.use("/api/catalogs",    require("./routes/catalogs"));
app.use("/api/sales",       require("./routes/sales"));
app.use("/api/clients",     require("./routes/clients"));
app.use("/api/attendance",  require("./routes/attendance"));
app.use("/api/sessions",    require("./routes/sessions"));
app.use("/api/exchange-rates", require("./routes/exchange"));
app.use("/api/currencies",  require("./routes/exchange")); // reutiliza el mismo router
app.use("/api/accounting",  require("./routes/accounting"));
app.use("/api/purchases",   require("./routes/accounting"));
app.use("/api/expenses",    require("./routes/accounting"));
app.use("/api/dashboard",   require("./routes/dashboard"));
app.use("/api/complaints",        require("./routes/complaints"));
app.use("/api/permissions",       require("./routes/permissions"));
app.use("/api/customers",         require("./routes/customers"));
app.use("/api/admin/customers",   require("./routes/admin-customers"));
app.use("/api/delivery-orders",   require("./routes/delivery-orders"));

/* ─── Raíz: redirige a la tienda pública ─── */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "inicio.html"));
});

/* ─── Fallback: cualquier ruta desconocida sirve el login ─── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ─── Migraciones automáticas al arrancar ─── */
const pool = require("./db");
pool.query(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS reset_code VARCHAR(128)`)
  .then(() => console.log("✓  Migración: client_accounts.reset_code OK"))
  .catch(err => console.error("✗  Migración client_accounts.reset_code:", err.message));

pool.query(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMPTZ`)
  .then(() => console.log("✓  Migración: client_accounts.reset_code_expires OK"))
  .catch(err => console.error("✗  Migración client_accounts.reset_code_expires:", err.message));

pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS document_number VARCHAR(30)`)
  .then(() => console.log("✓  Migración: clients.document_number OK"))
  .catch(err => console.error("✗  Migración clients.document_number:", err.message));

pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE`)
  .then(() => console.log("✓  Migración: categories.visible OK"))
  .catch(err => console.error("✗  Migración categories.visible:", err.message));

pool.query(`ALTER TABLE session_pages ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ`)
  .then(() => console.log("✓  Migración: last_interaction OK"))
  .catch(err => console.error("✗  Migración last_interaction:", err.message));

pool.query(`ALTER TABLE session_pages ADD COLUMN IF NOT EXISTS admin_closed BOOLEAN NOT NULL DEFAULT FALSE`)
  .then(() => console.log("✓  Migración: admin_closed OK"))
  .catch(err => console.error("✗  Migración admin_closed:", err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS worker_audit (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    changed_by_id   UUID        REFERENCES workers(id) ON DELETE SET NULL,
    changed_by_name TEXT        NOT NULL DEFAULT 'Sistema',
    action          VARCHAR(100) NOT NULL,
    description     TEXT,
    diffs           JSONB       NOT NULL DEFAULT '[]',
    ip_address      VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: worker_audit OK"))
  .catch(err => console.error("✗  Migración worker_audit:", err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS worker_permissions (
    worker_id  UUID        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    page_url   VARCHAR(120) NOT NULL,
    allowed    BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (worker_id, page_url)
  )
`).then(() => console.log("✓  Migración: worker_permissions OK"))
  .catch(err => console.error("✗  Migración worker_permissions:", err.message));

/* ─── Migraciones contables — tablas del libro.html ─── */

// Columnas adicionales para journal_entries (asientos)
const jeColumns = [
  ["correlativo",  "VARCHAR(10)  DEFAULT ''"],
  ["tipo",         "VARCHAR(30)  DEFAULT 'ingreso'"],
  ["estado",       "VARCHAR(20)  DEFAULT 'registrado'"],
  ["cod_cuenta",   "VARCHAR(10)  DEFAULT ''"],
  ["denom_cuenta", "TEXT         DEFAULT ''"],
  ["debe",         "NUMERIC(14,2) DEFAULT 0"],
  ["haber",        "NUMERIC(14,2) DEFAULT 0"],
  ["tipo_doc",     "VARCHAR(30)  DEFAULT ''"],
  ["serie",        "VARCHAR(10)  DEFAULT ''"],
  ["numero",       "VARCHAR(20)  DEFAULT ''"],
  ["medio_pago",   "VARCHAR(30)  DEFAULT ''"],
  ["ruc_dni",      "VARCHAR(20)  DEFAULT ''"],
  ["nombre_cp",    "TEXT         DEFAULT ''"],
  ["centro",       "TEXT         DEFAULT ''"],
  ["categoria",    "TEXT         DEFAULT ''"],
  ["audit_log",    "JSONB        DEFAULT '[]'"],
  ["updated_at",   "TIMESTAMPTZ DEFAULT NOW()"],
];
jeColumns.forEach(([col, def]) => {
  pool.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS ${col} ${def}`)
    .catch(err => console.error(`✗  Migración journal_entries.${col}:`, err.message));
});

// Tabla ventas del libro (distintas de venta.html)
pool.query(`
  CREATE TABLE IF NOT EXISTS libro_ventas (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha        DATE         NOT NULL,
    cliente      TEXT         NOT NULL DEFAULT '',
    ruc          VARCHAR(20)  DEFAULT '',
    tipo_doc     VARCHAR(20)  DEFAULT '',
    tipo_comp    VARCHAR(30)  DEFAULT '',
    serie        VARCHAR(10)  DEFAULT '',
    numero       VARCHAR(20)  DEFAULT '',
    producto     TEXT         DEFAULT '',
    cantidad     NUMERIC(10,2) DEFAULT 1,
    precio_unit  NUMERIC(14,2) DEFAULT 0,
    subtotal     NUMERIC(14,2) DEFAULT 0,
    igv          NUMERIC(14,2) DEFAULT 0,
    total        NUMERIC(14,2) DEFAULT 0,
    medio_pago   VARCHAR(30)  DEFAULT '',
    estado_pago  VARCHAR(20)  DEFAULT 'cobrado',
    cuenta       VARCHAR(10)  DEFAULT '7011',
    fuente       VARCHAR(20)  DEFAULT 'libro',
    audit_log    JSONB        DEFAULT '[]',
    created_by   UUID         REFERENCES workers(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: libro_ventas OK"))
  .catch(err => console.error("✗  Migración libro_ventas:", err.message));

// Tabla compras del libro
pool.query(`
  CREATE TABLE IF NOT EXISTS libro_compras (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha        DATE         NOT NULL,
    proveedor    TEXT         NOT NULL DEFAULT '',
    ruc          VARCHAR(20)  DEFAULT '',
    tipo_comp    VARCHAR(30)  DEFAULT '',
    serie        VARCHAR(10)  DEFAULT '',
    numero       VARCHAR(20)  DEFAULT '',
    categoria    TEXT         DEFAULT '',
    descripcion  TEXT         DEFAULT '',
    subtotal     NUMERIC(14,2) DEFAULT 0,
    igv          NUMERIC(14,2) DEFAULT 0,
    total        NUMERIC(14,2) DEFAULT 0,
    medio_pago   VARCHAR(30)  DEFAULT '',
    estado_pago  VARCHAR(20)  DEFAULT 'pagado',
    cuenta       VARCHAR(10)  DEFAULT '6011',
    audit_log    JSONB        DEFAULT '[]',
    created_by   UUID         REFERENCES workers(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: libro_compras OK"))
  .catch(err => console.error("✗  Migración libro_compras:", err.message));

// Tabla gastos del libro
pool.query(`
  CREATE TABLE IF NOT EXISTS libro_gastos (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha        DATE         NOT NULL,
    categoria    TEXT         DEFAULT '',
    descripcion  TEXT         NOT NULL DEFAULT '',
    proveedor    TEXT         DEFAULT '',
    tipo_comp    VARCHAR(30)  DEFAULT '',
    serie        VARCHAR(10)  DEFAULT '',
    numero       VARCHAR(20)  DEFAULT '',
    subtotal     NUMERIC(14,2) DEFAULT 0,
    igv          NUMERIC(14,2) DEFAULT 0,
    total        NUMERIC(14,2) DEFAULT 0,
    medio_pago   VARCHAR(30)  DEFAULT '',
    estado_pago  VARCHAR(20)  DEFAULT 'pagado',
    centro       TEXT         DEFAULT '',
    cuenta       VARCHAR(10)  DEFAULT '94',
    audit_log    JSONB        DEFAULT '[]',
    created_by   UUID         REFERENCES workers(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: libro_gastos OK"))
  .catch(err => console.error("✗  Migración libro_gastos:", err.message));

// Tabla inversiones del libro
pool.query(`
  CREATE TABLE IF NOT EXISTS libro_inversiones (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha         DATE         NOT NULL,
    tipo          TEXT         DEFAULT '',
    nombre        TEXT         NOT NULL DEFAULT '',
    monto         NUMERIC(14,2) DEFAULT 0,
    fuente_financ TEXT         DEFAULT '',
    retorno_esp   NUMERIC(14,2) DEFAULT 0,
    retorno_real  NUMERIC(14,2) DEFAULT 0,
    plazo         TEXT         DEFAULT '',
    estado        VARCHAR(20)  DEFAULT 'activa',
    obs           TEXT         DEFAULT '',
    audit_log     JSONB        DEFAULT '[]',
    created_by    UUID         REFERENCES workers(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: libro_inversiones OK"))
  .catch(err => console.error("✗  Migración libro_inversiones:", err.message));

// Tabla cuentas por cobrar extra (libro_cxc)
pool.query(`
  CREATE TABLE IF NOT EXISTS libro_cxc (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha        DATE         NOT NULL,
    cliente      TEXT         NOT NULL DEFAULT '',
    ruc          VARCHAR(20)  DEFAULT '',
    tipo_comp    VARCHAR(30)  DEFAULT '',
    numero       VARCHAR(20)  DEFAULT '',
    concepto     TEXT         DEFAULT '',
    total        NUMERIC(14,2) DEFAULT 0,
    cobrado      NUMERIC(14,2) DEFAULT 0,
    saldo        NUMERIC(14,2) DEFAULT 0,
    vencimiento  DATE,
    estado_pago  VARCHAR(20)  DEFAULT 'pendiente',
    audit_log    JSONB        DEFAULT '[]',
    created_by   UUID         REFERENCES workers(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: libro_cxc OK"))
  .catch(err => console.error("✗  Migración libro_cxc:", err.message));

// Tabla cuentas por pagar extra (libro_cxp)
pool.query(`
  CREATE TABLE IF NOT EXISTS libro_cxp (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha        DATE         NOT NULL,
    proveedor    TEXT         NOT NULL DEFAULT '',
    ruc          VARCHAR(20)  DEFAULT '',
    tipo_comp    VARCHAR(30)  DEFAULT '',
    numero       VARCHAR(20)  DEFAULT '',
    concepto     TEXT         DEFAULT '',
    total        NUMERIC(14,2) DEFAULT 0,
    pagado       NUMERIC(14,2) DEFAULT 0,
    saldo        NUMERIC(14,2) DEFAULT 0,
    vencimiento  DATE,
    estado_pago  VARCHAR(20)  DEFAULT 'pendiente',
    audit_log    JSONB        DEFAULT '[]',
    created_by   UUID         REFERENCES workers(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: libro_cxp OK"))
  .catch(err => console.error("✗  Migración libro_cxp:", err.message));

/* ─── Migraciones: sistema de pedidos de entrega ─── */
pool.query(`
  CREATE TABLE IF NOT EXISTS delivery_orders (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        VARCHAR(20)  NOT NULL UNIQUE,
    sale_id             UUID         NOT NULL REFERENCES sales(id),
    client_id           UUID         REFERENCES clients(id),
    status              VARCHAR(20)  NOT NULL DEFAULT 'agendado',
    delivery_address    TEXT,
    delivery_reference  TEXT,
    assigned_worker_id  UUID         REFERENCES workers(id) ON DELETE SET NULL,
    scheduled_at        TIMESTAMPTZ  DEFAULT NOW(),
    preparing_at        TIMESTAMPTZ,
    ready_at            TIMESTAMPTZ,
    in_transit_at       TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    confirmed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    notes               TEXT,
    cancel_reason       TEXT,
    created_by          UUID         REFERENCES workers(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
  )
`).then(() => console.log("✓  Migración: delivery_orders OK"))
  .catch(err => console.error("✗  Migración delivery_orders:", err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS delivery_order_history (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id   UUID         NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
    from_status         VARCHAR(20),
    to_status           VARCHAR(20)  NOT NULL,
    changed_by_type     VARCHAR(20)  NOT NULL DEFAULT 'worker',
    changed_by_id       UUID,
    changed_by_name     TEXT         NOT NULL DEFAULT 'Sistema',
    notes               TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: delivery_order_history OK"))
  .catch(err => console.error("✗  Migración delivery_order_history:", err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS delivery_order_alerts (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id   UUID         NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
    alert_type          VARCHAR(50)  NOT NULL,
    message             TEXT         NOT NULL,
    is_read             BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`).then(() => console.log("✓  Migración: delivery_order_alerts OK"))
  .catch(err => console.error("✗  Migración delivery_order_alerts:", err.message));

/* ─── Inicio ─── */
const server = app.listen(PORT, () => {
  console.log(`✓  A&M Importaciones corriendo en http://localhost:${PORT}`);
  console.log(`✓  Base de datos: Neon PostgreSQL`);
  console.log(`✓  Frontend servido desde: ./public/`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n✗  El puerto ${PORT} ya está en uso.`);
    console.error(`   Ejecuta este comando y vuelve a intentar:\n`);
    console.error(`   taskkill /F /IM node.exe\n`);
  } else {
    console.error("Error al iniciar servidor:", err);
  }
  process.exit(1);
});
