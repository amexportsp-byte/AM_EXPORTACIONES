"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ─── MIDDLEWARE JWT ─── */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token requerido" });
  const token = header.replace("Bearer ", "");
  try {
    req.worker = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM workers WHERE username = $1 AND deleted_at IS NULL",
      [username]
    );
    const worker = rows[0];
    if (!worker) return res.status(401).json({ error: "Credenciales incorrectas" });

    const ok = await bcrypt.compare(password, worker.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales incorrectas" });

    if (worker.status === "suspendido" || worker.status === "cesado")
      return res.status(403).json({ error: "Cuenta no disponible" });

    await pool.query(
      "UPDATE workers SET last_login = NOW(), status = 'activo' WHERE id = $1",
      [worker.id]
    );

    const token = jwt.sign(
      { id: worker.id, role: worker.role, username: worker.username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Registrar sesión
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const tokenHash = require("crypto").createHash("sha256").update(token).digest("hex");
    await pool.query(
      `INSERT INTO worker_sessions (worker_id, token_hash, ip_address, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [worker.id, tokenHash, req.ip, expiresAt]
    );

    res.json({
      token,
      worker: {
        id: worker.id,
        username: worker.username,
        first_name: worker.first_name,
        last_name: worker.last_name,
        role: worker.role,
        avatar_color: worker.avatar_color,
        avatar_url: worker.avatar_url,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    const header = req.headers.authorization;
    const token = header.replace("Bearer ", "");
    const tokenHash = require("crypto").createHash("sha256").update(token).digest("hex");
    await pool.query(
      "UPDATE worker_sessions SET status = 'inactivo', revoked_at = NOW() WHERE token_hash = $1",
      [tokenHash]
    );
    await pool.query(
      "UPDATE workers SET status = 'desconectado' WHERE id = $1",
      [req.worker.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* ═══════════════════════════════════════════
   WORKERS (trabajadores.html)
═══════════════════════════════════════════ */

app.get("/api/workers", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, document_type, document_number,
              gender, birthday, email, phone, address, role, username,
              work_schedule, status, avatar_url, avatar_color,
              current_page, last_seen, last_login, created_at,
              antecedentes, ref_name, ref_phone
       FROM workers WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener trabajadores" });
  }
});

app.get("/api/workers/:id", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, document_type, document_number,
              gender, birthday, email, phone, address, role, username,
              work_schedule, status, avatar_url, avatar_color,
              current_page, last_seen, last_login, created_at,
              antecedentes, ref_name, ref_phone
       FROM workers WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Trabajador no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener trabajador" });
  }
});

app.post("/api/workers", authMiddleware, async (req, res) => {
  const {
    first_name, last_name, document_type, document_number,
    gender, birthday, email, phone, address, antecedentes,
    ref_name, ref_phone, role, username, password,
    work_schedule, avatar_color,
  } = req.body;

  if (!first_name || !last_name || !document_number || !role || !username || !password)
    return res.status(400).json({ error: "Campos requeridos incompletos" });

  try {
    const exists = await pool.query(
      "SELECT id FROM workers WHERE username = $1 OR document_number = $2",
      [username, document_number]
    );
    if (exists.rows.length > 0)
      return res.status(409).json({ error: "Usuario o documento ya existe" });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO workers
       (first_name, last_name, document_type, document_number, gender, birthday,
        email, phone, address, antecedentes, ref_name, ref_phone, role, username,
        password_hash, work_schedule, avatar_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id, first_name, last_name, role, username, status`,
      [first_name, last_name, document_type || "DNI", document_number,
       gender, birthday || null, email, phone, address,
       antecedentes || "No", ref_name, ref_phone,
       role, username, hash, work_schedule || "Lun-Vie 08:00-17:00",
       avatar_color || "#4F46E5"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear trabajador" });
  }
});

app.put("/api/workers/:id", authMiddleware, async (req, res) => {
  const {
    first_name, last_name, document_type, document_number,
    gender, birthday, email, phone, address, antecedentes,
    ref_name, ref_phone, role, work_schedule, status, avatar_color, password,
  } = req.body;

  try {
    let passwordClause = "";
    const values = [
      first_name, last_name, document_type, document_number,
      gender, birthday || null, email, phone, address,
      antecedentes, ref_name, ref_phone, role, work_schedule, status, avatar_color,
      req.params.id,
    ];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      passwordClause = ", password_hash = $18";
      values.splice(16, 0, hash);
    }

    await pool.query(
      `UPDATE workers SET
         first_name=$1, last_name=$2, document_type=$3, document_number=$4,
         gender=$5, birthday=$6, email=$7, phone=$8, address=$9,
         antecedentes=$10, ref_name=$11, ref_phone=$12,
         role=$13, work_schedule=$14, status=$15, avatar_color=$16,
         updated_at=NOW()${passwordClause}
       WHERE id=$17 AND deleted_at IS NULL`,
      values
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar trabajador" });
  }
});

app.delete("/api/workers/:id", authMiddleware, async (req, res) => {
  try {
    await pool.query(
      "UPDATE workers SET deleted_at = NOW(), status = 'cesado' WHERE id = $1",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar trabajador" });
  }
});

/* ═══════════════════════════════════════════
   PRODUCTS (registro.html)
═══════════════════════════════════════════ */

app.get("/api/products", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              c.name AS categoria, s.name AS subcategoria,
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
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );

    // Mapear campos de BD a los nombres usados en el frontend
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
      createdAt: p.created_at,
      // IDs de catálogo para edición
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
    console.error("Error products GET:", err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

app.post("/api/products", authMiddleware, async (req, res) => {
  const {
    nombre, categoria, subcategoria, marca, proveedor, origen,
    color, tamano, unidad, info, cantidadCompra, stock,
    precioVenta, precioCompra, descuento, fechaCompra, fechaVence, imageUrl,
  } = req.body;

  if (!nombre || !categoria)
    return res.status(400).json({ error: "Nombre y categoría son requeridos" });

  try {
    // Buscar o crear IDs de catálogo
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
       cantidadCompra || 0, stock || 0,
       precioVenta || 0, precioCompra || 0, descuento || 0,
       fechaCompra || null, fechaVence || null, imageUrl || null, req.worker.id]
    );

    // Registrar movimiento de inventario inicial
    if ((stock || 0) > 0) {
      await pool.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity, quantity_before, quantity_after,
          unit_cost, total_cost, reference_type, notes, performed_by)
         VALUES ($1,'entrada',$2,0,$2,$3,$4,'ingreso_inicial','Stock inicial al crear producto',$5)`,
        [rows[0].id, stock || 0, precioCompra || 0,
         (stock || 0) * (precioCompra || 0), req.worker.id]
      );
    }

    res.status(201).json({ id: rows[0].id, codigo: rows[0].product_code });
  } catch (err) {
    console.error("Error products POST:", err);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

app.put("/api/products/:id", authMiddleware, async (req, res) => {
  const {
    nombre, codigo, categoria, subcategoria, marca, proveedor, origen,
    color, tamano, unidad, info, cantidadCompra, stock,
    precioVenta, precioCompra, descuento, fechaCompra, fechaVence,
    imageUrl, codigoMotivo,
  } = req.body;

  try {
    const prev = await pool.query(
      "SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!prev.rows[0]) return res.status(404).json({ error: "Producto no encontrado" });
    const old = prev.rows[0];

    // Detectar cambio de código
    if (codigo && codigo !== old.product_code) {
      if (!codigoMotivo) return res.status(400).json({ error: "Motivo de cambio de código requerido" });
      await pool.query(
        `INSERT INTO product_code_history (product_id, old_code, new_code, reason, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, old.product_code, codigo, codigoMotivo, req.worker.id]
      );
      await pool.query(
        "UPDATE products SET old_product_code = $1 WHERE id = $2",
        [old.product_code, req.params.id]
      );
    }

    const cat = categoria ? await findOrCreate("categories", "name", categoria) : old.category_id;
    const sub = subcategoria ? await findOrCreate("subcategories", "name", subcategoria, { category_id: cat }) : old.subcategory_id;
    const brand = marca ? await findOrCreate("brands", "name", marca) : old.brand_id;
    const supp = proveedor ? await findOrCreateSupplier(proveedor) : old.supplier_id;
    const orig = origen ? await findOrCreate("origins", "name", origen) : old.origin_id;
    const col = color ? await findOrCreate("colors", "name", color) : old.color_id;
    const sz = tamano ? await findOrCreate("sizes", "name", tamano) : old.size_id;
    const un = unidad ? await findOrCreate("units", "name", unidad, { abbreviation: unidad }) : old.unit_id;

    // Si cambió el stock, registrar movimiento
    const newStock = stock !== undefined ? stock : old.stock;
    if (newStock !== old.stock) {
      const diff = newStock - old.stock;
      const type = diff > 0 ? "ajuste" : "ajuste";
      await pool.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity, quantity_before, quantity_after,
          reference_type, notes, performed_by)
         VALUES ($1,$2,$3,$4,$5,'ajuste_manual','Ajuste manual desde registro.html',$6)`,
        [req.params.id, type, Math.abs(diff), old.stock, newStock, req.worker.id]
      );
    }

    await pool.query(
      `UPDATE products SET
         product_code = COALESCE($1, product_code),
         name = $2, category_id = $3, subcategory_id = $4,
         brand_id = $5, supplier_id = $6, origin_id = $7,
         color_id = $8, size_id = $9, unit_id = $10,
         description = $11, purchase_quantity = $12, stock = $13,
         sale_price = $14, purchase_price = $15, discount = $16,
         purchase_date = $17, expiration_date = $18, image_url = $19,
         updated_by = $20, updated_at = NOW()
       WHERE id = $21`,
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
  } catch (err) {
    console.error("Error products PUT:", err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

app.delete("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    await pool.query(
      "UPDATE products SET deleted_at = NOW(), status = 'inactivo' WHERE id = $1",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

/* ═══════════════════════════════════════════
   CATÁLOGOS (categorías, marcas, proveedores, etc.)
═══════════════════════════════════════════ */

app.get("/api/catalogs", authMiddleware, async (req, res) => {
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

app.post("/api/catalogs/:type", authMiddleware, async (req, res) => {
  const typeMap = {
    categorias: "categories",
    marcas: "brands",
    proveedores: "suppliers",
    origenes: "origins",
    colores: "colors",
    tamanos: "sizes",
    unidades: "units",
    subcategorias: "subcategories",
  };
  const table = typeMap[req.params.type];
  if (!table) return res.status(400).json({ error: "Tipo inválido" });

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
    } else {
      const field = table === "units" ? ", abbreviation" : "";
      const val = table === "units" ? `, $2` : "";
      const params = table === "units" ? [name, name] : [name];
      const { rows } = await pool.query(
        `INSERT INTO ${table} (name${field}) VALUES ($1${val}) ON CONFLICT (name) DO NOTHING RETURNING id`,
        params
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

/* ═══════════════════════════════════════════
   CLIENTS (venta.html)
═══════════════════════════════════════════ */

app.get("/api/clients", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

app.post("/api/clients", authMiddleware, async (req, res) => {
  const {
    document_type, document_number, first_name, last_name,
    business_name, email, phone, address, district, city,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO clients
       (document_type, document_number, first_name, last_name,
        business_name, email, phone, address, district, city, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [document_type || "DNI", document_number, first_name, last_name,
       business_name, email, phone, address, district, city, req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

/* ═══════════════════════════════════════════
   SALES (venta.html)
═══════════════════════════════════════════ */

app.get("/api/sales", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              c.first_name || ' ' || COALESCE(c.last_name,'') AS client_name,
              c.document_number AS client_doc,
              w.first_name || ' ' || w.last_name AS worker_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN workers w ON s.worker_id = w.id
       WHERE s.deleted_at IS NULL
       ORDER BY s.sale_date DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener ventas" });
  }
});

app.post("/api/sales", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      client_id, sale_type, subtotal, discount, discount_pct, igv,
      total, amount_paid, change_given, currency, exchange_rate,
      total_pen, amount_paid_pen, change_given_pen, notes,
      invoice_type, details, payment_method_id,
    } = req.body;

    // Generar número de venta
    const year = new Date().getFullYear();
    const count = await client.query(
      "SELECT COUNT(*) FROM sales WHERE EXTRACT(YEAR FROM sale_date) = $1", [year]
    );
    const saleNum = `VEN-${year}${String(parseInt(count.rows[0].count) + 1).padStart(4, "0")}`;

    const { rows: saleRows } = await client.query(
      `INSERT INTO sales
       (sale_number, client_id, worker_id, sale_type,
        subtotal, discount, discount_pct, igv, total,
        amount_paid, change_given, currency, exchange_rate,
        total_pen, amount_paid_pen, change_given_pen, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'completada',$18)
       RETURNING id, sale_number`,
      [saleNum, client_id || null, req.worker.id, sale_type || "venta",
       subtotal || 0, discount || 0, discount_pct || 0, igv || 0, total || 0,
       amount_paid || 0, change_given || 0, currency || "PEN", exchange_rate || 1,
       total_pen || total || 0, amount_paid_pen || amount_paid || 0,
       change_given_pen || change_given || 0, notes || null, req.worker.id]
    );
    const saleId = saleRows[0].id;

    // Insertar detalles y actualizar stock
    if (details && details.length > 0) {
      for (const d of details) {
        await client.query(
          `INSERT INTO sale_details
           (sale_id, product_id, product_code, product_name, quantity,
            unit_price, discount_pct, discount_amount, igv_pct, igv_amount, subtotal, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [saleId, d.product_id, d.product_code, d.product_name, d.quantity,
           d.unit_price, d.discount_pct || 0, d.discount_amount || 0,
           d.igv_pct || 18, d.igv_amount || 0, d.subtotal, d.total]
        );

        // Restar stock
        await client.query(
          `UPDATE products SET stock = stock - $1 WHERE id = $2`,
          [d.quantity, d.product_id]
        );

        // Registrar movimiento
        const prev = await client.query("SELECT stock FROM products WHERE id = $1", [d.product_id]);
        await client.query(
          `INSERT INTO inventory_movements
           (product_id, movement_type, quantity, quantity_before, quantity_after,
            unit_cost, reference_type, reference_id, performed_by)
           VALUES ($1,'venta',$2,$3,$4,$5,'sale',$6,$7)`,
          [d.product_id, d.quantity, prev.rows[0].stock + d.quantity,
           prev.rows[0].stock, d.unit_price, saleId, req.worker.id]
        );
      }
    }

    // Emitir comprobante
    if (invoice_type) {
      const seqMap = { FAC: "invoice_fac_seq", BOL: "invoice_bol_seq", NV: "invoice_nv_seq" };
      const prefMap = { FAC: "FAC-", BOL: "BOL-", NV: "NV-" };
      const seq = await client.query(`SELECT nextval('${seqMap[invoice_type]}')`);
      const invNum = prefMap[invoice_type] + String(seq.rows[0].nextval).padStart(8, "0");

      await client.query(
        `INSERT INTO invoices
         (invoice_number, invoice_type, sale_id, client_id,
          subtotal, discount, igv, total, currency, exchange_rate, total_pen,
          status, issued_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'emitida',$12)`,
        [invNum, invoice_type, saleId, client_id || null,
         subtotal || 0, discount || 0, igv || 0, total || 0,
         currency || "PEN", exchange_rate || 1, total_pen || total || 0, req.worker.id]
      );
    }

    // Registrar pago
    if (payment_method_id) {
      await client.query(
        `INSERT INTO sale_payments
         (sale_id, payment_method_id, amount, currency, exchange_rate, amount_pen, registered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [saleId, payment_method_id, amount_paid || 0, currency || "PEN",
         exchange_rate || 1, amount_paid_pen || amount_paid || 0, req.worker.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id: saleId, sale_number: saleRows[0].sale_number });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error sales POST:", err);
    res.status(500).json({ error: "Error al registrar venta" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════
   PAYMENT METHODS
═══════════════════════════════════════════ */

app.get("/api/payment-methods", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY sort_order, name"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener métodos de pago" });
  }
});

/* ═══════════════════════════════════════════
   EXCHANGE RATES (cambio.html)
═══════════════════════════════════════════ */

app.get("/api/exchange-rates", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT er.*, c.code, c.name AS currency_name, c.symbol
       FROM exchange_rates er
       JOIN currencies c ON er.currency_id = c.id
       ORDER BY er.rate_date DESC, c.code
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener tipos de cambio" });
  }
});

app.post("/api/exchange-rates", authMiddleware, async (req, res) => {
  const { currency_id, buy_rate, sell_rate, rate_date, source } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO exchange_rates (currency_id, buy_rate, sell_rate, rate_date, source, registered_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (currency_id, rate_date) DO UPDATE
       SET buy_rate=$2, sell_rate=$3, source=$5, updated_at=NOW()
       RETURNING *`,
      [currency_id, buy_rate, sell_rate, rate_date || "NOW()", source || "manual", req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar tipo de cambio" });
  }
});

app.get("/api/currencies", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM currencies WHERE is_active = TRUE ORDER BY sort_order, code"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener monedas" });
  }
});

/* ═══════════════════════════════════════════
   ATTENDANCE (marcacion.html / trabajadores.html)
═══════════════════════════════════════════ */

app.get("/api/attendance", authMiddleware, async (req, res) => {
  const { date, worker_id } = req.query;
  try {
    let query = `SELECT a.*, w.first_name || ' ' || w.last_name AS worker_name
                 FROM attendance a
                 JOIN workers w ON a.worker_id = w.id
                 WHERE 1=1`;
    const params = [];
    if (date) { params.push(date); query += ` AND a.work_date = $${params.length}`; }
    if (worker_id) { params.push(worker_id); query += ` AND a.worker_id = $${params.length}`; }
    query += " ORDER BY a.work_date DESC, a.check_in DESC LIMIT 200";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener asistencia" });
  }
});

app.post("/api/attendance/checkin", authMiddleware, async (req, res) => {
  const { worker_id, method } = req.body;
  const targetId = worker_id || req.worker.id;
  try {
    const { rows } = await pool.query(
      `INSERT INTO attendance (worker_id, check_in, check_in_ip, mark_in_method, status)
       VALUES ($1, NOW(), $2, $3, 'presente')
       ON CONFLICT (worker_id, work_date)
       DO UPDATE SET check_in = COALESCE(attendance.check_in, NOW()),
                     check_in_ip = $2, mark_in_method = $3
       RETURNING *`,
      [targetId, req.ip, method || "credenciales"]
    );
    // Log de acceso
    await pool.query(
      `INSERT INTO attendance_access_log (worker_id, event_type, result, method, ip_address)
       VALUES ($1, 'ingreso', 'ok', $2, $3)`,
      [targetId, method || "credenciales", req.ip]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar entrada" });
  }
});

app.post("/api/attendance/checkout", authMiddleware, async (req, res) => {
  const { worker_id, method } = req.body;
  const targetId = worker_id || req.worker.id;
  try {
    const { rows } = await pool.query(
      `UPDATE attendance SET check_out = NOW(), check_out_ip = $1, mark_out_method = $2
       WHERE worker_id = $3 AND work_date = CURRENT_DATE
       RETURNING *`,
      [req.ip, method || "credenciales", targetId]
    );
    await pool.query(
      `INSERT INTO attendance_access_log (worker_id, event_type, result, method, ip_address)
       VALUES ($1, 'salida', 'ok', $2, $3)`,
      [targetId, method || "credenciales", req.ip]
    );
    res.json(rows[0] || { ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar salida" });
  }
});

app.get("/api/attendance/access-log", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT al.*, w.first_name || ' ' || w.last_name AS worker_name,
              w.role, w.avatar_color
       FROM attendance_access_log al
       LEFT JOIN workers w ON al.worker_id = w.id
       ORDER BY al.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener log de acceso" });
  }
});

/* ═══════════════════════════════════════════
   SESSIONS (control.html)
═══════════════════════════════════════════ */

app.get("/api/sessions", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ws.*, w.first_name || ' ' || w.last_name AS worker_name,
              w.role, w.avatar_color, w.avatar_url
       FROM worker_sessions ws
       JOIN workers w ON ws.worker_id = w.id
       WHERE ws.status = 'activo' AND ws.expires_at > NOW()
       ORDER BY ws.last_activity DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener sesiones" });
  }
});

app.post("/api/sessions/:id/revoke", authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE worker_sessions
       SET status = 'revocada', revoked_at = NOW(), revoked_by = $1
       WHERE id = $2`,
      [req.worker.id, req.params.id]
    );
    const session = await pool.query(
      "SELECT worker_id FROM worker_sessions WHERE id = $1", [req.params.id]
    );
    if (session.rows[0]) {
      await pool.query(
        "UPDATE workers SET status = 'desconectado' WHERE id = $1",
        [session.rows[0].worker_id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al revocar sesión" });
  }
});

/* ═══════════════════════════════════════════
   ACCOUNTING / LIBRO (libro.html)
═══════════════════════════════════════════ */

app.get("/api/accounting/entries", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT je.*, w.first_name || ' ' || w.last_name AS created_by_name
       FROM journal_entries je
       LEFT JOIN workers w ON je.created_by = w.id
       ORDER BY je.entry_date DESC, je.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener asientos contables" });
  }
});

app.post("/api/accounting/entries", authMiddleware, async (req, res) => {
  const { entry_date, description, debit_account, credit_account, amount, currency, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO journal_entries
       (entry_date, description, debit_account, credit_account, amount, currency, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [entry_date, description, debit_account, credit_account, amount,
       currency || "PEN", notes, req.worker.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear asiento contable" });
  }
});

app.get("/api/accounting/plan", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM accounting_plan WHERE is_active = TRUE ORDER BY code"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener plan contable" });
  }
});

app.get("/api/purchases", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, s.business_name AS supplier_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.purchase_date DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener compras" });
  }
});

app.get("/api/expenses", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 200"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener gastos" });
  }
});

/* ═══════════════════════════════════════════
   DASHBOARD / STATS (inicio.html)
═══════════════════════════════════════════ */

app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
  try {
    const [products, sales, clients, workers, lowStock] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM products WHERE deleted_at IS NULL"),
      pool.query("SELECT COUNT(*), COALESCE(SUM(total),0) AS total FROM sales WHERE status='completada' AND DATE(sale_date)=CURRENT_DATE"),
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

/* ═══════════════════════════════════════════
   ORDERS (inicio.html portal clientes)
═══════════════════════════════════════════ */

app.get("/api/orders", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, c.first_name || ' ' || COALESCE(c.last_name,'') AS client_name
       FROM orders o
       LEFT JOIN clients c ON o.client_id = c.id
       WHERE o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

/* ═══════════════════════════════════════════
   HELPER FUNCTIONS
═══════════════════════════════════════════ */

async function findOrCreate(table, field, value, extra = {}) {
  if (!value) return null;
  const existing = await pool.query(
    `SELECT id FROM ${table} WHERE ${field} = $1`, [value]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const extraKeys = Object.keys(extra);
  const extraVals = Object.values(extra);
  const placeholders = extraKeys.map((_, i) => `$${i + 2}`).join(", ");
  const columns = extraKeys.length ? `, ${extraKeys.join(", ")}` : "";
  const vals = extraKeys.length ? `, ${placeholders}` : "";

  const { rows } = await pool.query(
    `INSERT INTO ${table} (${field}${columns}) VALUES ($1${vals}) ON CONFLICT DO NOTHING RETURNING id`,
    [value, ...extraVals]
  );
  if (rows[0]) return rows[0].id;
  const r = await pool.query(`SELECT id FROM ${table} WHERE ${field} = $1`, [value]);
  return r.rows[0]?.id || null;
}

async function findOrCreateSupplier(name) {
  if (!name) return null;
  const existing = await pool.query(
    "SELECT id FROM suppliers WHERE business_name = $1", [name]
  );
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

/* ═══════════════════════════════════════════
   SERVIR FRONTEND
═══════════════════════════════════════════ */

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

/* ═══════════════════════════════════════════
   INICIO
═══════════════════════════════════════════ */

app.listen(PORT, () => {
  console.log(`✓ A&M Importaciones corriendo en http://localhost:${PORT}`);
  console.log(`✓ Conectado a Neon PostgreSQL`);
});
