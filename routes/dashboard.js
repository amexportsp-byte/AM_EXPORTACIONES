"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/dashboard/stats
router.get("/stats", auth, async (req, res) => {
  try {
    const [products, sales, clients, workers, lowStock] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM products WHERE deleted_at IS NULL"),
      pool.query(
        "SELECT COUNT(*), COALESCE(SUM(total),0) AS total FROM sales WHERE status='completada' AND DATE(sale_date)=CURRENT_DATE"
      ),
      pool.query("SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL"),
      pool.query("SELECT COUNT(*) FROM workers WHERE status='activo' AND deleted_at IS NULL"),
      pool.query("SELECT COUNT(*) FROM products WHERE stock <= stock_min AND deleted_at IS NULL"),
    ]);
    res.json({
      total_products: parseInt(products.rows[0].count),
      sales_today: parseInt(sales.rows[0].count),
      revenue_today: parseFloat(sales.rows[0].total),
      total_clients: parseInt(clients.rows[0].count),
      active_workers: parseInt(workers.rows[0].count),
      low_stock_alerts: parseInt(lowStock.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

module.exports = router;
