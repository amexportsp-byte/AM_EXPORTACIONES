const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000, // 30s — Neon free tier puede tardar hasta 25s en despertar
});

pool.on("error", (err) => {
  if (err.code !== "57P01") {
    console.error("Error inesperado en cliente PostgreSQL:", err.message);
  }
});

// Wrapper con 3 reintentos para manejar cold starts de Neon
const _query = pool.query.bind(pool);
pool.query = async function retryQuery(...args) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await _query(...args);
    } catch (err) {
      lastErr = err;
      const isRetryable =
        err.message?.includes("Connection terminated") ||
        err.message?.includes("connection timeout") ||
        err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT") ||
        err.code === "57P01";
      if (isRetryable && attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 1000)); // 1s, 2s entre intentos
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};

// Keep-alive: ping cada 4 minutos para mantener Neon despierto
// (Neon free tier duerme a los 5 min de inactividad)
setInterval(async () => {
  try {
    await _query("SELECT 1");
  } catch {
    // silencioso — solo mantiene la conexión viva
  }
}, 4 * 60 * 1000);

module.exports = pool;
