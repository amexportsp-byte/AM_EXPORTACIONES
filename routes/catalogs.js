"use strict";

const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /api/catalogs — todos los catálogos en un solo request
router.get("/", auth, async (req, res) => {
  try {
    const [cats, subs, brands, suppliers, origins, colors, sizes, units] =
      await Promise.all([
        pool.query("SELECT id, name FROM categories WHERE status='activo' ORDER BY sort_order, name"),
        pool.query("SELECT id, name, category_id FROM subcategories WHERE status='activo' ORDER BY sort_order, name"),
        pool.query("SELECT id, name FROM brands WHERE status='activo' ORDER BY name"),
        pool.query("SELECT id, business_name AS name FROM suppliers WHERE status='activo' ORDER BY business_name"),
        pool.query("SELECT id, name FROM origins WHERE status='activo' ORDER BY name"),
        pool.query("SELECT id, name FROM colors WHERE status='activo' ORDER BY name"),
        pool.query("SELECT id, name FROM sizes WHERE status='activo' ORDER BY name"),
        pool.query("SELECT id, name FROM units WHERE status='activo' ORDER BY name"),
      ]);
    res.json({
      categorias: cats.rows,
      subcategorias: subs.rows,
      marcas: brands.rows,
      proveedores: suppliers.rows,
      origenes: origins.rows,
      colores: colors.rows,
      tamanos: sizes.rows,
      unidades: units.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener catálogos" });
  }
});

// POST /api/catalogs/:type — crear nueva opción en un catálogo
router.post("/:type", auth, async (req, res) => {
  const tableMap = {
    categorias: "categories",
    marcas: "brands",
    proveedores: "suppliers",
    origenes: "origins",
    colores: "colors",
    tamanos: "sizes",
    unidades: "units",
    subcategorias: "subcategories",
  };
  const table = tableMap[req.params.type];
  if (!table) return res.status(400).json({ error: "Tipo de catálogo inválido" });

  const { name, category_id } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });

  try {
    let id;
    if (table === "suppliers") {
      const { rows } = await pool.query(
        "INSERT INTO suppliers (business_name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id",
        [name]
      );
      id = rows[0]?.id;
      if (!id) {
        const r = await pool.query("SELECT id FROM suppliers WHERE business_name = $1", [name]);
        id = r.rows[0].id;
      }
    } else if (table === "subcategories" && category_id) {
      const { rows } = await pool.query(
        "INSERT INTO subcategories (name, category_id) VALUES ($1,$2) ON CONFLICT (category_id, name) DO NOTHING RETURNING id",
        [name, category_id]
      );
      id = rows[0]?.id;
    } else if (table === "units") {
      const { rows } = await pool.query(
        "INSERT INTO units (name, abbreviation) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING RETURNING id",
        [name, name]
      );
      id = rows[0]?.id;
      if (!id) {
        const r = await pool.query("SELECT id FROM units WHERE name = $1", [name]);
        id = r.rows[0]?.id;
      }
    } else {
      const { rows } = await pool.query(
        `INSERT INTO ${table} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
        [name]
      );
      id = rows[0]?.id;
      if (!id) {
        const r = await pool.query(`SELECT id FROM ${table} WHERE name = $1`, [name]);
        id = r.rows[0]?.id;
      }
    }
    res.status(201).json({ id, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear catálogo" });
  }
});

module.exports = router;
