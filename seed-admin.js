require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool   = require("./db");

// Contraseña leída desde variable de entorno o argumento CLI
// Uso:  node seed-admin.js            → usa ADMIN_PASSWORD del .env
//       node seed-admin.js MiClave123 → usa el argumento
const password = process.argv[2] || process.env.ADMIN_PASSWORD;

if (!password) {
  console.error("✗ Debes proveer la contraseña:");
  console.error("  node seed-admin.js <contraseña>");
  console.error("  o definir ADMIN_PASSWORD en .env");
  process.exit(1);
}

if (password.length < 8) {
  console.error("✗ La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

async function crearAdmin() {
  const hash = await bcrypt.hash(password, 12);
  try {
    await pool.query(
      `INSERT INTO workers
       (first_name, last_name, document_type, document_number,
        role, username, password_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'activo')
       ON CONFLICT (username) DO UPDATE SET password_hash = $7`,
      ["Admin", "Principal", "DNI", "00000001", "admin", "admin", hash]
    );
    console.log("✓ Usuario admin creado/actualizado.");
    console.log("  Usuario: admin");
    console.log("  Recuerda guardar la contraseña en un gestor seguro.");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

crearAdmin();
