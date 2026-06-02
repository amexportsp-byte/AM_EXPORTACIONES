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

/* ─── Frontend estático (carpeta public/) ─── */
app.use(express.static(path.join(__dirname, "public")));

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

/* ─── Fallback: todo lo que no sea API sirve el login ─── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

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
