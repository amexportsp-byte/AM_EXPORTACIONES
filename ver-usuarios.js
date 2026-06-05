require("dotenv").config();
const pool = require("./db");

async function verUsuarios() {
  try {
    const { rows } = await pool.query(
      `SELECT username, first_name || ' ' || last_name AS nombre,
              role, status, last_login
       FROM workers WHERE deleted_at IS NULL ORDER BY created_at`
    );
    if (rows.length === 0) {
      console.log("No hay usuarios registrados.");
    } else {
      console.log("\n══════ USUARIOS REGISTRADOS ══════");
      rows.forEach((u) => {
        console.log(`Usuario:   ${u.username}`);
        console.log(`Nombre:    ${u.nombre}`);
        console.log(`Rol:       ${u.role}`);
        console.log(`Estado:    ${u.status}`);
        console.log(`Último login: ${u.last_login || "Nunca"}`);
        console.log("──────────────────────────────────");
      });
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

verUsuarios();
