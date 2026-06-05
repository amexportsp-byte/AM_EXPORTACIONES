"use strict";

const router     = require("express").Router();
const pool       = require("../db");
const auth       = require("../middleware/auth");
const appEvents  = require("../events");

// Helpers
async function findOrCreate(table, field, value, extra = {}) {
  if (!value) return null;
  const existing = await pool.query(`SELECT id FROM ${table} WHERE ${field} = $1`, [value]);
  if (existing.rows[0]) return existing.rows[0].id;
  const extraKeys = Object.keys(extra);
  const extraVals = Object.values(extra);
  const cols = extraKeys.length ? `, ${extraKeys.join(", ")}` : "";
  const phs = extraKeys.map((_, i) => `$${i + 2}`).join(", ");
  const vals = extraKeys.length ? `, ${phs}` : "";
  const { rows } = await pool.query(
    `INSERT INTO ${table} (${field}${cols}) VALUES ($1${vals}) ON CONFLICT DO NOTHING RETURNING id`,
    [value, ...extraVals]
  );
  if (rows[0]) return rows[0].id;
  const r = await pool.query(`SELECT id FROM ${table} WHERE ${field} = $1`, [value]);
  return r.rows[0]?.id || null;
}

async function findOrCreateSupplier(name) {
  if (!name) return null;
  const existing = await pool.query("SELECT id FROM suppliers WHERE business_name = $1", [name]);
  if (existing.rows[0]) return existing.rows[0].id;
  const { rows } = await pool.query(
    "INSERT INTO suppliers (business_name) VALUES ($1) RETURNING id", [name]
  );
  return rows[0].id;
}

async function nextProductCode() {
  const { rows } = await pool.query("SELECT nextval('product_code_seq') AS seq");
  return "PRO" + String(rows[0].seq).padStart(10, "0");
}

// GET /api/products/public — sin autenticación (tienda web pública)
router.get("/public", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.product_code, p.name, p.description,
              p.sale_price, p.discount, p.stock, p.image_url,
              c.name AS categoria, b.name AS marca, s.name AS subcategoria
       FROM products p
       LEFT JOIN categories    c ON p.category_id    = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       LEFT JOIN brands        b ON p.brand_id       = b.id
       WHERE p.deleted_at IS NULL AND p.stock > 0
         AND (c.visible IS NULL OR c.visible = TRUE)
       ORDER BY p.created_at DESC`
    );
    res.json(rows.map(p => ({
      id:           p.id,
      codigo:       p.product_code,
      nombre:       p.name,
      descripcion:  p.description  || "",
      precioVenta:  parseFloat(p.sale_price),
      descuento:    parseFloat(p.discount) || 0,
      stock:        p.stock,
      imageUrl:     p.image_url    || "",
      categoria:    p.categoria    || "",
      subcategoria: p.subcategoria || "",
      marca:        p.marca        || "",
    })));
  } catch (err) {
    console.error("GET /products/public:", err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

// GET /api/products
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              c.name AS categoria, c.visible AS cat_visible, s.name AS subcategoria,
              b.name AS marca, su.business_name AS proveedor,
              o.name AS origen, co.name AS color,
              sz.name AS tamano, u.name AS unidad
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN suppliers su ON p.supplier_id = su.id
       LEFT JOIN origins o ON p.origin_id = o.id
       LEFT JOIN colors co ON p.color_id = co.id
       LEFT JOIN sizes sz ON p.size_id = sz.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC`
    );
    const mapped = rows.map((p) => ({
      id: p.id,
      codigo: p.product_code,
      nombre: p.name,
      categoria: p.categoria || "",
      subcategoria: p.subcategoria || "",
      marca: p.marca || "",
      proveedor: p.proveedor || "",
      origen: p.origen || "",
      color: p.color || "",
      tamano: p.tamano || "",
      unidad: p.unidad || "",
      info: p.description || "",
      cantidadCompra: p.purchase_quantity,
      stock: p.stock,
      precioVenta: parseFloat(p.sale_price),
      precioCompra: parseFloat(p.purchase_price),
      descuento: parseFloat(p.discount),
      fechaCompra: p.purchase_date ? p.purchase_date.toISOString().split("T")[0] : "",
      fechaVence: p.expiration_date ? p.expiration_date.toISOString().split("T")[0] : "",
      imageUrl: p.image_url || "",
      status: p.status,
      cat_visible: p.cat_visible !== false,
      createdAt: p.created_at,
      category_id: p.category_id,
      subcategory_id: p.subcategory_id,
      brand_id: p.brand_id,
      supplier_id: p.supplier_id,
      origin_id: p.origin_id,
      color_id: p.color_id,
      size_id: p.size_id,
      unit_id: p.unit_id,
    }));
    res.json(mapped);
  } catch (err) {
    console.error("GET /products:", err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

// POST /api/products
router.post("/", auth, async (req, res) => {
  if (!["admin", "almacen", "supervisor"].includes(req.worker.role))
    return res.status(403).json({ error: "Sin autorización" });

  const {
    nombre, categoria, subcategoria, marca, proveedor, origen,
    color, tamano, unidad, info, cantidadCompra, stock,
    precioVenta, precioCompra, descuento, fechaCompra, fechaVence, imageUrl,
  } = req.body;

  if (!nombre || !categoria)
    return res.status(400).json({ error: "Nombre y categoría son requeridos" });

  try {
    const cat = await findOrCreate("categories", "name", categoria);
    const sub = subcategoria ? await findOrCreate("subcategories", "name", subcategoria, { category_id: cat }) : null;
    const brand = marca ? await findOrCreate("brands", "name", marca) : null;
    const supp = proveedor ? await findOrCreateSupplier(proveedor) : null;
    const orig = origen ? await findOrCreate("origins", "name", origen) : null;
    const col = color ? await findOrCreate("colors", "name", color) : null;
    const sz = tamano ? await findOrCreate("sizes", "name", tamano) : null;
    const un = unidad ? await findOrCreate("units", "name", unidad, { abbreviation: unidad }) : null;
    const code = await nextProductCode();

    const { rows } = await pool.query(
      `INSERT INTO products
       (product_code, name, category_id, subcategory_id, brand_id, supplier_id,
        origin_id, color_id, size_id, unit_id, description,
        purchase_quantity, stock, sale_price, purchase_price, discount,
        purchase_date, expiration_date, image_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id, product_code`,
      [code, nombre, cat, sub, brand, supp, orig, col, sz, un, info || null,
       cantidadCompra || 0, stock || 0, precioVenta || 0, precioCompra || 0,
       descuento || 0, fechaCompra || null, fechaVence || null, imageUrl || null, req.worker.id]
    );

    if ((stock || 0) > 0) {
      await pool.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity, quantity_before, quantity_after,
          unit_cost, total_cost, reference_type, notes, performed_by)
         VALUES ($1,'entrada',$2,0,$2,$3,$4,'ingreso_inicial','Stock inicial',$5)`,
        [rows[0].id, stock, precioCompra || 0, (stock || 0) * (precioCompra || 0), req.worker.id]
      );
    }
    res.status(201).json({ id: rows[0].id, codigo: rows[0].product_code });
    appEvents.emit("products_updated");
  } catch (err) {
    console.error("POST /products:", err);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

// PUT /api/products/:id
router.put("/:id", auth, async (req, res) => {
  if (!["admin", "almacen", "supervisor"].includes(req.worker.role))
    return res.status(403).json({ error: "Sin autorización" });

  const {
    nombre, codigo, categoria, subcategoria, marca, proveedor, origen,
    color, tamano, unidad, info, cantidadCompra, stock,
    precioVenta, precioCompra, descuento, fechaCompra, fechaVence,
    imageUrl, codigoMotivo,
  } = req.body;

  try {
    const prev = await pool.query(
      "SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL", [req.params.id]
    );
    if (!prev.rows[0]) return res.status(404).json({ error: "Producto no encontrado" });
    const old = prev.rows[0];

    if (codigo && codigo !== old.product_code) {
      if (!codigoMotivo) return res.status(400).json({ error: "Motivo de cambio de código requerido" });
      await pool.query(
        `INSERT INTO product_code_history (product_id, old_code, new_code, reason, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, old.product_code, codigo, codigoMotivo, req.worker.id]
      );
      await pool.query("UPDATE products SET old_product_code = $1 WHERE id = $2", [old.product_code, req.params.id]);
    }

    const cat = categoria ? await findOrCreate("categories", "name", categoria) : old.category_id;
    const sub = subcategoria ? await findOrCreate("subcategories", "name", subcategoria, { category_id: cat }) : old.subcategory_id;
    const brand = marca ? await findOrCreate("brands", "name", marca) : old.brand_id;
    const supp = proveedor ? await findOrCreateSupplier(proveedor) : old.supplier_id;
    const orig = origen ? await findOrCreate("origins", "name", origen) : old.origin_id;
    const col = color ? await findOrCreate("colors", "name", color) : old.color_id;
    const sz = tamano ? await findOrCreate("sizes", "name", tamano) : old.size_id;
    const un = unidad ? await findOrCreate("units", "name", unidad, { abbreviation: unidad }) : old.unit_id;

    const newStock = stock !== undefined ? stock : old.stock;
    if (newStock !== old.stock) {
      await pool.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity, quantity_before, quantity_after,
          reference_type, notes, performed_by)
         VALUES ($1,'ajuste',$2,$3,$4,'ajuste_manual','Ajuste manual',$5)`,
        [req.params.id, Math.abs(newStock - old.stock), old.stock, newStock, req.worker.id]
      );
    }

    await pool.query(
      `UPDATE products SET
         product_code = COALESCE($1, product_code),
         name=$2, category_id=$3, subcategory_id=$4, brand_id=$5, supplier_id=$6,
         origin_id=$7, color_id=$8, size_id=$9, unit_id=$10, description=$11,
         purchase_quantity=$12, stock=$13, sale_price=$14, purchase_price=$15,
         discount=$16, purchase_date=$17, expiration_date=$18, image_url=$19,
         updated_by=$20, updated_at=NOW()
       WHERE id=$21`,
      [codigo || null, nombre || old.name, cat, sub, brand, supp,
       orig, col, sz, un, info !== undefined ? info : old.description,
       cantidadCompra !== undefined ? cantidadCompra : old.purchase_quantity,
       newStock, precioVenta !== undefined ? precioVenta : old.sale_price,
       precioCompra !== undefined ? precioCompra : old.purchase_price,
       descuento !== undefined ? descuento : old.discount,
       fechaCompra || old.purchase_date || null,
       fechaVence || old.expiration_date || null,
       imageUrl !== undefined ? imageUrl : old.image_url,
       req.worker.id, req.params.id]
    );
    res.json({ ok: true });
    appEvents.emit("products_updated");
  } catch (err) {
    console.error("PUT /products/:id:", err.message, err.detail || "");
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", auth, async (req, res) => {
  if (req.worker.role !== "admin")
    return res.status(403).json({ error: "Sin autorización" });
  try {
    await pool.query(
      "UPDATE products SET deleted_at = NOW(), status = 'inactivo' WHERE id = $1",
      [req.params.id]
    );
    res.json({ ok: true });
    appEvents.emit("products_updated");
  } catch (err) {
    console.error("DELETE /products/:id:", err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

module.exports = router;
