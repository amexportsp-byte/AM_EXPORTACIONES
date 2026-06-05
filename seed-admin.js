require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./db");

async function crearAdmin() {
  const hash = await bcrypt.hash("admin123", 10);
  try {
    await pool.query(
      `INSERT INTO workers
       (first_name, last_name, document_type, document_number,
        role, username, password_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'activo')
       ON CONFLICT (username) DO UPDATE SET password_hash = $7`,
      ["Admin", "Principal", "DNI", "00000001", "admin", "admin", hash]
    );
    console.log("✓ Usuario admin creado:");
    console.log("  Usuario:    admin");
    console.log("  Contraseña: admin123");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

crearAdmin();
