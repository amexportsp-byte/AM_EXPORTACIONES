require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./db");

// ══════════════════════════════════════
//  EDITA ESTOS DATOS ANTES DE CORRER
// ══════════════════════════════════════
const NUEVO_USUARIO = {
  first_name:      "Admin",
  last_name:       "Principal",
  document_type:   "DNI",           // DNI | CE | PASAPORTE | RUC
  document_number: "00000001",
  role:            "admin",         // admin | cajero | vendedor | almacen | supervisor | contabilidad | soporte
  username:        "admin",
  password:        "admin123",
};
// ══════════════════════════════════════

async function crearUsuario() {
  const hash = await bcrypt.hash(NUEVO_USUARIO.password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO workers
       (first_name, last_name, document_type, document_number,
        role, username, password_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'activo')
       ON CONFLICT (username) DO UPDATE SET password_hash = $7
       RETURNING username, role`,
      [
        NUEVO_USUARIO.first_name,
        NUEVO_USUARIO.last_name,
        NUEVO_USUARIO.document_type,
        NUEVO_USUARIO.document_number,
        NUEVO_USUARIO.role,
        NUEVO_USUARIO.username,
        hash,
      ]
    );
    console.log("\n✓ Usuario creado/actualizado:");
    console.log(`  Usuario:    ${rows[0].username}`);
    console.log(`  Contraseña: ${NUEVO_USUARIO.password}`);
    console.log(`  Rol:        ${rows[0].role}`);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

crearUsuario();
