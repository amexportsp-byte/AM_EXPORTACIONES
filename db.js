const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 60000,       // 1 min antes de liberar conexión idle
  connectionTimeoutMillis: 20000, // 20 s para que Neon despierte del cold start
});

pool.on("error", (err) => {
  // Reconexión silenciosa — Neon termina conexiones idle por su cuenta
  if (err.code !== "57P01") {
    console.error("Error inesperado en cliente PostgreSQL:", err.message);
  }
});

// Wrapper con 1 reintento automático para manejar conexiones cortadas por Neon
const _query = pool.query.bind(pool);
pool.query = async function retryQuery(...args) {
  try {
    return await _query(...args);
  } catch (err) {
    const isConnectionErr =
      err.message?.includes("Connection terminated") ||
      err.message?.includes("connection timeout") ||
      err.code === "57P01";
    if (isConnectionErr) {
      // Esperar 1 s y reintentar una vez
      await new Promise(r => setTimeout(r, 1000));
      return _query(...args);
    }
    throw err;
  }
};

module.exports = pool;
