/* =============================================
   A&M — registro.js
   Sistema de Gestión de Inventario
   CRUD + Historial de Auditoría Completo
   ============================================= */

"use strict";

/* ============= ESTADO GLOBAL ============= */
const State = {
  products: [],
  filtered: [],
  currentView: "grid",
  editingId: null,
  deletingId: null,
  viewingId: null,
  addingOptionType: null,
  activeAuditFilter: "all",
  options: {
    categorias: [
      "Electrónica",
      "Ropa",
      "Alimentos",
      "Hogar",
      "Deportes",
      "Belleza",
      "Juguetes",
      "Libros",
    ],
    subcategorias: [
      "Smartphones",
      "Laptops",
      "Camisetas",
      "Pantalones",
      "Lácteos",
      "Snacks",
      "Muebles",
      "Accesorios",
    ],
    marcas: [
      "Samsung",
      "Apple",
      "Sony",
      "Nike",
      "Adidas",
      "Nestlé",
      "LG",
      "HP",
      "Zara",
      "H&M",
    ],
    tamanos: ["XS", "S", "M", "L", "XL", "XXL", "1L", "500ml", "1kg", "250g"],
    unidades: [
      "Unidad",
      "Par",
      "Caja",
      "Bolsa",
      "Litro",
      "Kg",
      "Gramo",
      "Metro",
      "Docena",
    ],
    colores: [
      "Negro",
      "Blanco",
      "Rojo",
      "Azul",
      "Verde",
      "Amarillo",
      "Gris",
      "Plateado",
      "Dorado",
    ],
    proveedores: [
      "TechWorld SAC",
      "Global Import",
      "Distribuidora Lima",
      "Fashion House",
      "AlimentiCorp",
    ],
    origenes: [
      "Perú",
      "China",
      "USA",
      "Alemania",
      "Japón",
      "Brasil",
      "Colombia",
      "España",
    ],
    informaciones: [
      "Premium",
      "Orgánico",
      "Importado",
      "Nacional",
      "Ecológico",
      "Edición Limitada",
      "Oferta",
    ],
  },
};

/* ============= CONSTANTES DE AUDITORÍA ============= */
const AUDIT_TYPES = {
  CREATE: "create",
  EDIT: "edit",
  CODE_CHANGE: "code",
  IMAGE: "image",
  STOCK: "stock",
  PRICE: "price",
  DELETE: "delete",
  INFO: "info",
};

const AUDIT_ICONS = {
  create: "✨",
  edit: "✏️",
  code: "🔢",
  image: "🖼️",
  stock: "📦",
  price: "💰",
  delete: "🗑️",
  info: "ℹ️",
};

const AUDIT_LABELS = {
  create: "Producto creado",
  edit: "Datos editados",
  code: "Código actualizado",
  image: "Imagen actualizada",
  stock: "Stock modificado",
  price: "Precio modificado",
  delete: "Eliminado",
  info: "Información",
};

/* ============= HELPERS ============= */
const EMOJIS = [
  "📱",
  "💻",
  "👕",
  "👖",
  "🥛",
  "🍫",
  "🛋️",
  "🏃",
  "💄",
  "🎮",
  "📚",
  "🎧",
  "⌚",
  "🎒",
  "🔌",
];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(yearsAgo, futureDays = 0) {
  const d = new Date();
  if (futureDays) d.setDate(d.getDate() + futureDays);
  else d.setFullYear(d.getFullYear() - Math.random() * yearsAgo);
  return d.toISOString().split("T")[0];
}

function nowStr() {
  return new Date().toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmt(n) {
  return "S/ " + Number(n).toFixed(2);
}

function isExpired(fecha) {
  if (!fecha) return false;
  return new Date(fecha) < new Date();
}

function getStatus(p) {
  if (isExpired(p.fechaVence)) return { label: "Vencido", cls: "danger" };
  if (p.stock === 0) return { label: "Sin stock", cls: "danger" };
  if (p.stock <= 5) return { label: "Stock bajo", cls: "warning" };
  if (p.descuento > 0) return { label: "Oferta", cls: "gold" };
  return { label: "Activo", cls: "success" };
}

async function loadFromAPI() {
  try {
    const [products, catalogs] = await Promise.all([
      API.products.list(),
      API.catalogs.list(),
    ]);

    // Agregar emoji por defecto a cada producto
    products.forEach((p, i) => {
      if (!p.emoji) p.emoji = EMOJIS[i % EMOJIS.length];
      if (!p.auditLog) p.auditLog = [];
    });

    State.products = products;

    // Poblar opciones desde la BD
    if (catalogs) {
      State.options.categorias = catalogs.categorias.map((c) => c.name);
      State.options.subcategorias = catalogs.subcategorias.map((c) => c.name);
      State.options.marcas = catalogs.marcas.map((c) => c.name);
      State.options.proveedores = catalogs.proveedores.map((c) => c.name);
      State.options.origenes = catalogs.origenes.map((c) => c.name);
      State.options.colores = catalogs.colores.map((c) => c.name);
      State.options.tamanos = catalogs.tamanos.map((c) => c.name);
      State.options.unidades = catalogs.unidades.map((c) => c.name);
      State._catalogIds = catalogs; // guardar IDs para referencias
    }
  } catch (err) {
    console.warn("No se pudo cargar desde API, usando datos en memoria:", err);
  }
}

function refreshAfterProductChange() {
  applyFilters();
  populateFilterDropdowns();
  renderDashboard();
  renderInventario();
  renderProductosMgmt();
  const badge = document.getElementById("badge-catalogo");
  if (badge) badge.textContent = State.products.length;
}

/* ============= AUDITORÍA ============= */
/**
 * Crea una entrada de auditoría.
 * @param {string} type       - AUDIT_TYPES constant
 * @param {string} label      - Título visible
 * @param {string} detail     - Descripción en texto
 * @param {Array}  diffs      - [{field, from, to}]
 * @param {string} imageSnap  - URL de imagen (para eventos tipo image)
 */
function createAuditEntry(
  type,
  label,
  detail = "",
  diffs = [],
  imageSnap = null,
) {
  return {
    id: genId(),
    type,
    label,
    detail,
    diffs,
    imageSnap,
    timestamp: nowStr(),
    user: "Admin",
  };
}

/**
 * Compara dos snapshots de producto y retorna array de diffs [{field, from, to}].
 * Solo registra campos que cambiaron.
 */
const FIELD_LABELS = {
  nombre: "Nombre",
  codigo: "Código",
  categoria: "Categoría",
  subcategoria: "Subcategoría",
  marca: "Marca",
  tamano: "Tamaño",
  unidad: "Unidad",
  color: "Color",
  info: "Descripción",
  precioVenta: "Precio Venta",
  precioCompra: "Precio Compra",
  stock: "Stock",
  descuento: "Descuento %",
  cantidadCompra: "Cant. Compra",
  fechaCompra: "F. Compra",
  fechaVence: "F. Vencimiento",
  proveedor: "Proveedor",
  origen: "Origen",
  imageUrl: "Imagen URL",
};

const PRICE_FIELDS = ["precioVenta", "precioCompra"];
const STOCK_FIELDS = ["stock", "cantidadCompra"];
const CODE_FIELD = "codigo";
const IMAGE_FIELD = "imageUrl";

function diffProducts(oldP, newP) {
  const diffs = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const oldVal = String(oldP[key] ?? "");
    const newVal = String(newP[key] ?? "");
    if (oldVal !== newVal) {
      diffs.push({ field: FIELD_LABELS[key] || key, from: oldVal, to: newVal });
    }
  }
  return diffs;
}

/**
 * Aplica auditoría inteligente: detecta qué tipo de cambio fue y genera las entradas correctas.
 * - Código cambiado       → entrada tipo CODE_CHANGE (con reason)
 * - Imagen cambiada       → entrada tipo IMAGE
 * - Precio cambiado       → entrada tipo PRICE
 * - Stock cambiado        → entrada tipo STOCK
 * - Resto de campos       → entrada tipo EDIT (agrupados)
 */
function buildAuditEntries(oldP, newP, codeReason) {
  const entries = [];
  const allDiffs = diffProducts(oldP, newP);

  if (!allDiffs.length) return entries;

  const codeDiff = allDiffs.find((d) => d.field === FIELD_LABELS[CODE_FIELD]);
  const imageDiff = allDiffs.find((d) => d.field === FIELD_LABELS[IMAGE_FIELD]);
  const priceDiffs = allDiffs.filter((d) =>
    PRICE_FIELDS.map((f) => FIELD_LABELS[f]).includes(d.field),
  );
  const stockDiffs = allDiffs.filter((d) =>
    STOCK_FIELDS.map((f) => FIELD_LABELS[f]).includes(d.field),
  );
  const editDiffs = allDiffs.filter((d) => {
    if (codeDiff && d.field === FIELD_LABELS[CODE_FIELD]) return false;
    if (imageDiff && d.field === FIELD_LABELS[IMAGE_FIELD]) return false;
    if (priceDiffs.find((x) => x.field === d.field)) return false;
    if (stockDiffs.find((x) => x.field === d.field)) return false;
    return true;
  });

  if (codeDiff) {
    entries.push(
      createAuditEntry(
        AUDIT_TYPES.CODE_CHANGE,
        "Código actualizado",
        codeReason || "Sin motivo registrado",
        [codeDiff],
      ),
    );
  }

  if (imageDiff) {
    entries.push(
      createAuditEntry(
        AUDIT_TYPES.IMAGE,
        "Imagen actualizada",
        newP.imageUrl
          ? "Se asignó nueva imagen al producto"
          : "Imagen removida del producto",
        [],
        newP.imageUrl || null,
      ),
    );
  }

  if (priceDiffs.length) {
    entries.push(
      createAuditEntry(
        AUDIT_TYPES.PRICE,
        "Precio modificado",
        `Se actualizaron ${priceDiffs.length} campo(s) de precio`,
        priceDiffs,
      ),
    );
  }

  if (stockDiffs.length) {
    entries.push(
      createAuditEntry(
        AUDIT_TYPES.STOCK,
        "Stock modificado",
        `Se actualizaron ${stockDiffs.length} campo(s) de stock`,
        stockDiffs,
      ),
    );
  }

  if (editDiffs.length) {
    entries.push(
      createAuditEntry(
        AUDIT_TYPES.EDIT,
        `${editDiffs.length} campo(s) editados`,
        editDiffs.map((d) => d.field).join(", "),
        editDiffs,
      ),
    );
  }

  return entries;
}

/* ============= DATOS MOCK ============= */
function generateMockProducts() {
  const names = [
    "Smartphone Galaxy X12",
    "Laptop UltraBook Pro",
    "Camiseta Deportiva Premium",
    "Pantalón Cargo Slim",
    "Leche Entera 1L",
    "Chocolate Noir 70%",
    "Sofá Modular 3P",
    "Zapatillas Running Pro",
    "Crema Hidratante SPF50",
    "Control PS5 DualSense",
    "Enciclopedia Ilustrada",
    "Auriculares BT Pro",
    "Smartwatch Series 9",
    "Mochila Urbana 30L",
    "Cable HDMI 4K 2m",
    'Tablet Android 11"',
    "Teclado Mecánico RGB",
    "Mouse Inalámbrico Ergonómico",
    "Perfume Aqua Men",
    "Zapatillas Casual Urban",
    "Polo Oversize Cotton",
    "Shorts Gym Flex",
    "Yogur Griego Natural",
    "Galletas Integrales 200g",
    "Silla Gamer Pro",
    "Lámpara LED Smart",
    "Termo Acero 750ml",
  ];

  const products = [];
  for (let i = 0; i < names.length; i++) {
    const precioCompra = +(Math.random() * 200 + 10).toFixed(2);
    const precioVenta = +(precioCompra * (1.2 + Math.random() * 0.8)).toFixed(
      2,
    );
    const stock = Math.floor(Math.random() * 120);
    const descuento =
      Math.random() > 0.65 ? Math.floor(Math.random() * 40) + 5 : 0;
    const fechaVence =
      Math.random() > 0.5
        ? randomDate(0, Math.floor(Math.random() * 400) - 60)
        : "";
    const createdAt = randomDate(2);

    const p = {
      id: genId(),
      nombre: names[i],
      codigo: "SKU-" + String(i + 1).padStart(4, "0"),
      categoria: randomOf(State.options.categorias),
      subcategoria: randomOf(State.options.subcategorias),
      marca: randomOf(State.options.marcas),
      tamano: randomOf(State.options.tamanos),
      unidad: randomOf(State.options.unidades),
      color: randomOf(State.options.colores),
      info: randomOf(State.options.informaciones),
      cantidadCompra: Math.floor(Math.random() * 50) + 1,
      stock,
      precioVenta,
      precioCompra,
      descuento,
      fechaCompra: randomDate(1),
      fechaVence,
      proveedor: randomOf(State.options.proveedores),
      origen: randomOf(State.options.origenes),
      emoji: EMOJIS[i % EMOJIS.length],
      imageUrl: "",
      createdAt,
      auditLog: [],
    };

    // Entrada de creación en el log
    p.auditLog.push({
      id: genId(),
      type: AUDIT_TYPES.CREATE,
      label: "Producto creado",
      detail: `Código inicial asignado: ${p.codigo}`,
      diffs: [],
      imageSnap: null,
      timestamp: createdAt + " 08:00:00",
      user: "Admin",
    });

    products.push(p);
  }
  return products;
}

/* ============= TOAST ============= */
function toast(msg, type = "success") {
  const icons = { success: "✓", danger: "✕", warning: "⚠", info: "ℹ" };
  const tc = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || "•"}</span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => {
    t.style.animation = "toastOut .3s ease forwards";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* ============= NAVIGATION ============= */
function navigate(section) {
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.add("active");
  const nav = document.querySelector(`[data-section="${section}"]`);
  if (nav) nav.classList.add("active");

  if (section === "dashboard") renderDashboard();
  if (section === "catalogo") renderCatalogo();
  if (section === "inventario") renderInventario();
  if (section === "productos") renderProductosMgmt();
  if (section === "reportes") renderReportes();
  if (section === "configuracion") renderConfiguracion();

  document.getElementById("sidebar").classList.remove("open");
}

/* ============= DASHBOARD ============= */
function renderDashboard() {
  const products = State.products;
  const today = new Date();

  const expired = products.filter((p) => isExpired(p.fechaVence));
  const noStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const discount = products.filter((p) => p.descuento > 0);
  const totalValue = products.reduce((a, p) => a + p.precioVenta * p.stock, 0);

  document.getElementById("currentDate").textContent = today.toLocaleDateString(
    "es-PE",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );

  const stats = [
    {
      label: "Total Productos",
      value: products.length,
      icon: statIconBox(),
      cls: "accent",
    },
    {
      label: "Productos Vencidos",
      value: expired.length,
      icon: statIconWarn(),
      cls: "danger",
    },
    {
      label: "Sin Stock",
      value: noStock.length,
      icon: statIconX(),
      cls: "danger",
    },
    {
      label: "Valor Total Inv.",
      value: fmt(totalValue),
      icon: statIconDollar(),
      cls: "success",
    },
    {
      label: "En Descuento",
      value: discount.length,
      icon: statIconTag(),
      cls: "gold",
    },
    {
      label: "Stock Bajo (≤5)",
      value: lowStock.length,
      icon: statIconWarn(),
      cls: "warning",
    },
  ];

  document.getElementById("statsGrid").innerHTML = stats
    .map(
      (s) => `
    <div class="stat-card ${s.cls}">
      <div class="stat-icon ${s.cls}">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `,
    )
    .join("");

  const alerts = [];
  if (expired.length)
    alerts.push({
      type: "danger",
      icon: "🚫",
      msg: `<strong>${expired.length}</strong> productos vencidos requieren atención inmediata.`,
    });
  if (noStock.length)
    alerts.push({
      type: "danger",
      icon: "📭",
      msg: `<strong>${noStock.length}</strong> productos están sin stock.`,
    });
  if (lowStock.length)
    alerts.push({
      type: "warning",
      icon: "⚠️",
      msg: `<strong>${lowStock.length}</strong> productos con stock bajo (≤5 unidades).`,
    });
  if (discount.length)
    alerts.push({
      type: "info",
      icon: "🏷️",
      msg: `<strong>${discount.length}</strong> productos con descuento activo.`,
    });

  document.getElementById("alertsContainer").innerHTML = alerts
    .map(
      (a) => `
    <div class="alert-banner ${a.type}">
      <span>${a.icon}</span><span>${a.msg}</span>
    </div>
  `,
    )
    .join("");

  document
    .getElementById("notifDot")
    .classList.toggle("visible", expired.length > 0 || noStock.length > 0);
  document.getElementById("badge-catalogo").textContent = products.length;

  const statGroups = [
    {
      label: "Activos",
      count: products.filter((p) => getStatus(p).cls === "success").length,
      color: "#22c55e",
    },
    { label: "Vencidos", count: expired.length, color: "#e05252" },
    { label: "Sin stock", count: noStock.length, color: "#7a2e2e" },
    { label: "Oferta", count: discount.length, color: "#c9a84c" },
    { label: "Stock bajo", count: lowStock.length, color: "#d97706" },
  ].filter((g) => g.count > 0);
  renderDonut("donutChart", "donutLegend", statGroups, products.length);

  const catValues = {};
  products.forEach((p) => {
    catValues[p.categoria] =
      (catValues[p.categoria] || 0) + p.precioVenta * p.stock;
  });
  const catArr = Object.entries(catValues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxVal = catArr[0]?.[1] || 1;
  document.getElementById("barChart").innerHTML = catArr
    .map(
      ([cat, val]) => `
    <div class="bar-row">
      <span class="bar-label">${cat}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${((val / maxVal) * 100).toFixed(1)}%"></div></div>
      <span class="bar-val">${fmt(val)}</span>
    </div>
  `,
    )
    .join("");

  const critItems = [
    ...expired.slice(0, 3).map((p) => ({
      dot: "danger",
      msg: `<strong>${p.nombre}</strong> — Vencido el ${p.fechaVence}`,
    })),
    ...noStock.slice(0, 3).map((p) => ({
      dot: "warning",
      msg: `<strong>${p.nombre}</strong> — Sin stock disponible`,
    })),
    ...lowStock.slice(0, 2).map((p) => ({
      dot: "info",
      msg: `<strong>${p.nombre}</strong> — Solo ${p.stock} unidades`,
    })),
  ].slice(0, 7);

  document.getElementById("criticalAlerts").innerHTML = critItems.length
    ? critItems
        .map(
          (a) => `
      <div class="alert-item">
        <div class="alert-dot ${a.dot}"></div>
        <span class="alert-text">${a.msg}</span>
      </div>`,
        )
        .join("")
    : '<p style="font-size:13px;color:var(--text-muted);padding:10px 0">Sin alertas críticas 🎉</p>';

  const recent = [...products].slice(0, 8);
  document.getElementById("recentTableBody").innerHTML = recent
    .map((p) => {
      const st = getStatus(p);
      return `<tr>
      <td><div class="product-cell">
        <div class="product-thumb" style="background:var(--bg-input);border-radius:6px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px">
          ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:32px;height:32px;object-fit:cover;border-radius:6px">` : p.emoji}
        </div>
        <span class="product-name">${p.nombre}</span>
      </div></td>
      <td>${p.categoria}</td>
      <td>${p.stock}</td>
      <td>${fmt(p.precioVenta)}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
    </tr>`;
    })
    .join("");
}

/* ============= DONUT CHART ============= */
function renderDonut(svgId, legendId, groups, total) {
  const svgEl = document.getElementById(svgId);
  const legEl = document.getElementById(legendId);
  if (!svgEl || !groups.length) return;
  const cx = 100,
    cy = 100,
    r = 70,
    strokeW = 22;
  const circ = 2 * Math.PI * r;
  let offset = 0,
    paths = "";
  groups.forEach((g) => {
    const pct = total > 0 ? g.count / total : 0;
    const dash = pct * circ;
    const gap = circ - dash;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${g.color}" stroke-width="${strokeW}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset * circ).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += pct;
  });
  paths += `
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#f0f0f5" font-family="Syne,sans-serif" font-size="22" font-weight="700">${total}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="#55556a" font-family="DM Sans,sans-serif" font-size="11">Total</text>
  `;
  svgEl.innerHTML = paths;
  legEl.innerHTML = groups
    .map(
      (g) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${g.color}"></div>
      <span>${g.label} (${g.count})</span>
    </div>
  `,
    )
    .join("");
}

/* ============= CATÁLOGO ============= */
function renderCatalogo() {
  applyFilters();
  populateFilterDropdowns();
}

function populateFilterDropdowns() {
  const productCats = [...new Set(State.products.map((p) => p.categoria))];
  const productSubs = [...new Set(State.products.map((p) => p.subcategoria))];
  const productBrands = [...new Set(State.products.map((p) => p.marca))];
  const productProvs = [...new Set(State.products.map((p) => p.proveedor))];
  const productOrigins = [...new Set(State.products.map((p) => p.origen))];
  setSelectOptions("filterCategory", productCats, "Todas las categorías");
  setSelectOptions("filterSubcategory", productSubs, "Subcategorías");
  setSelectOptions("filterBrand", productBrands, "Todas las marcas");
  setSelectOptions("filterProveedor", productProvs, "Todos los proveedores");
  setSelectOptions("filterOrigen", productOrigins, "Todos los orígenes");
}

function setSelectOptions(id, options, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    options
      .map(
        (o) =>
          `<option value="${o}" ${o === current ? "selected" : ""}>${o}</option>`,
      )
      .join("");
}

function applyFilters() {
  const name = (
    document.getElementById("filterName")?.value || ""
  ).toLowerCase();
  const code = (
    document.getElementById("filterCode")?.value || ""
  ).toLowerCase();
  const cat = document.getElementById("filterCategory")?.value || "";
  const sub = document.getElementById("filterSubcategory")?.value || "";
  const brand = document.getElementById("filterBrand")?.value || "";
  const prov = document.getElementById("filterProveedor")?.value || "";
  const orig = document.getElementById("filterOrigen")?.value || "";
  const priceMin =
    parseFloat(document.getElementById("filterPriceMin")?.value) || 0;
  const priceMax =
    parseFloat(document.getElementById("filterPriceMax")?.value) || Infinity;
  const expired = document.getElementById("filterExpired")?.checked;
  const noStock = document.getElementById("filterNoStock")?.checked;
  const discount = document.getElementById("filterDiscount")?.checked;
  const sort = document.getElementById("filterSort")?.value || "";

  let filtered = State.products.filter((p) => {
    if (
      name &&
      !p.nombre.toLowerCase().includes(name) &&
      !p.codigo.toLowerCase().includes(name)
    )
      return false;
    if (code && !p.codigo.toLowerCase().includes(code)) return false;
    if (cat && p.categoria !== cat) return false;
    if (sub && p.subcategoria !== sub) return false;
    if (brand && p.marca !== brand) return false;
    if (prov && p.proveedor !== prov) return false;
    if (orig && p.origen !== orig) return false;
    if (p.precioVenta < priceMin || p.precioVenta > priceMax) return false;
    if (expired && !isExpired(p.fechaVence)) return false;
    if (noStock && p.stock !== 0) return false;
    if (discount && p.descuento <= 0) return false;
    return true;
  });

  if (sort === "name-asc")
    filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (sort === "name-desc")
    filtered.sort((a, b) => b.nombre.localeCompare(a.nombre));
  if (sort === "price-asc")
    filtered.sort((a, b) => a.precioVenta - b.precioVenta);
  if (sort === "price-desc")
    filtered.sort((a, b) => b.precioVenta - a.precioVenta);
  if (sort === "stock-asc") filtered.sort((a, b) => a.stock - b.stock);
  if (sort === "stock-desc") filtered.sort((a, b) => b.stock - a.stock);

  State.filtered = filtered;
  const rc = document.getElementById("resultsCount");
  if (rc) rc.textContent = `${filtered.length} productos`;
  renderCurrentView();
}

function renderCurrentView() {
  if (State.currentView === "grid") renderGrid();
  if (State.currentView === "list") renderList();
  if (State.currentView === "table") renderTable();
}

function renderGrid() {
  const container = document.getElementById("productGrid");
  if (!container) return;
  if (!State.filtered.length) {
    container.innerHTML = emptyState();
    return;
  }
  container.innerHTML = State.filtered
    .map((p) => {
      const st = getStatus(p);
      const finalPrice =
        p.descuento > 0
          ? +(p.precioVenta * (1 - p.descuento / 100)).toFixed(2)
          : p.precioVenta;
      return `
    <div class="product-card">
      <div class="product-card-img">
        ${
          p.imageUrl
            ? `<img src="${p.imageUrl}" alt="${p.nombre}" onerror="this.style.display='none'">`
            : `<span style="font-size:44px">${p.emoji}</span>`
        }
        <div class="product-card-badges">
          <span class="badge ${st.cls}" style="font-size:10px">${st.label}</span>
          ${p.descuento > 0 ? `<span class="badge gold" style="font-size:10px">-${p.descuento}%</span>` : ""}
        </div>
      </div>
      <div class="product-card-body">
        <div class="product-card-name">${p.nombre}</div>
        <div class="product-card-meta">${p.categoria} · ${p.marca}</div>
        <div class="product-card-meta" style="font-size:11px;color:var(--text-muted)">${p.codigo}</div>
        <div class="product-card-price">
          ${fmt(finalPrice)}
          ${p.descuento > 0 ? `<span class="original">${fmt(p.precioVenta)}</span>` : ""}
        </div>
        <div class="product-card-stock" style="color:${p.stock === 0 ? "var(--danger)" : p.stock <= 5 ? "var(--warning)" : "var(--text-muted)"}">
          Stock: ${p.stock} ${p.unidad}
        </div>
      </div>
      <div class="product-card-actions">
        <button class="btn-icon view" onclick="openDetail('${p.id}')" title="Ver detalle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="btn-icon edit" onclick="openEdit('${p.id}')" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon del" onclick="confirmDelete('${p.id}')" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
    })
    .join("");
}

function renderList() {
  const container = document.getElementById("productList");
  if (!container) return;
  if (!State.filtered.length) {
    container.innerHTML = emptyState();
    return;
  }
  container.innerHTML = State.filtered
    .map((p) => {
      const st = getStatus(p);
      const finalPrice =
        p.descuento > 0
          ? +(p.precioVenta * (1 - p.descuento / 100)).toFixed(2)
          : p.precioVenta;
      return `
    <div class="product-list-item">
      <div class="product-list-thumb">
        ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.nombre}" onerror="this.style.display='none'">` : p.emoji}
      </div>
      <div class="product-list-info">
        <div class="product-list-name">${p.nombre}</div>
        <div class="product-list-meta">${p.codigo} · ${p.categoria} · ${p.marca} · Stock: ${p.stock}</div>
      </div>
      <div class="product-list-right">
        <span class="badge ${st.cls}">${st.label}</span>
        ${p.descuento > 0 ? `<span class="badge gold">-${p.descuento}%</span>` : ""}
        <div class="product-list-price">${fmt(finalPrice)}</div>
        <div class="action-btns">
          <button class="btn-icon view" onclick="openDetail('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="btn-icon edit" onclick="openEdit('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon del" onclick="confirmDelete('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </div>
    </div>`;
    })
    .join("");
}

function renderTable() {
  const tbody = document.getElementById("fullTableBody");
  if (!tbody) return;
  if (!State.filtered.length) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:40px;color:var(--text-muted)">Sin resultados</td></tr>`;
    return;
  }
  tbody.innerHTML = State.filtered
    .map((p) => {
      const st = getStatus(p);
      return `<tr>
      <td><div style="width:34px;height:34px;border-radius:6px;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden">
        ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:34px;height:34px;object-fit:cover">` : p.emoji}
      </div></td>
      <td><code style="font-size:11px;color:var(--text-muted)">${p.codigo}</code></td>
      <td style="color:var(--text-primary);font-weight:600;max-width:180px;white-space:normal">${p.nombre}</td>
      <td>${p.categoria}</td><td>${p.marca}</td>
      <td style="color:${p.stock === 0 ? "var(--danger)" : p.stock <= 5 ? "var(--warning)" : "inherit"};font-weight:${p.stock <= 5 ? 600 : 400}">${p.stock}</td>
      <td style="color:var(--text-primary);font-weight:600">${fmt(p.precioVenta)}</td>
      <td>${fmt(p.precioCompra)}</td>
      <td>${p.descuento > 0 ? `<span class="badge gold">-${p.descuento}%</span>` : "—"}</td>
      <td style="color:${isExpired(p.fechaVence) ? "var(--danger)" : "inherit"}">${p.fechaVence || "—"}</td>
      <td>${p.proveedor}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon view" onclick="openDetail('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="btn-icon edit" onclick="openEdit('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-icon del" onclick="confirmDelete('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div></td>
    </tr>`;
    })
    .join("");
}

function emptyState() {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
    <p>No se encontraron productos</p>
  </div>`;
}

/* ============= INVENTARIO ============= */
function renderInventario() {
  const products = State.products;
  const expired = products.filter((p) => isExpired(p.fechaVence));
  const noStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const totalVal = products.reduce((a, p) => a + p.precioVenta * p.stock, 0);
  const totalBuy = products.reduce((a, p) => a + p.precioCompra * p.stock, 0);

  document.getElementById("invStats").innerHTML = [
    { label: "Total SKUs", value: products.length, cls: "accent" },
    { label: "Valor Inventario", value: fmt(totalVal), cls: "success" },
    { label: "Costo Total", value: fmt(totalBuy), cls: "info" },
    { label: "Margen Bruto", value: fmt(totalVal - totalBuy), cls: "gold" },
    { label: "Vencidos", value: expired.length, cls: "danger" },
    { label: "Sin Stock", value: noStock.length, cls: "danger" },
  ]
    .map(
      (s) => `
    <div class="stat-card ${s.cls}">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `,
    )
    .join("");

  const crit = [...expired, ...noStock, ...lowStock]
    .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
    .slice(0, 15);

  document.getElementById("critStockBody").innerHTML = crit
    .map((p) => {
      const st = getStatus(p);
      return `<tr>
      <td style="color:var(--text-primary);font-weight:600">${p.nombre}</td>
      <td>${p.categoria}</td>
      <td style="color:${p.stock === 0 ? "var(--danger)" : "var(--warning)"};font-weight:700">${p.stock}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td><button class="btn-icon edit" onclick="openEdit('${p.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button></td>
    </tr>`;
    })
    .join("");

  const catCounts = {};
  products.forEach(
    (p) => (catCounts[p.categoria] = (catCounts[p.categoria] || 0) + 1),
  );
  const catArr = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const maxCat = catArr[0]?.[1] || 1;
  const colors = [
    "#22c55e",
    "#3b82f6",
    "#c9a84c",
    "#e05252",
    "#d97706",
    "#a855f7",
    "#06b6d4",
    "#f43f5e",
  ];
  document.getElementById("catSummary").innerHTML = catArr
    .map(
      ([cat, cnt], i) => `
    <div class="cat-summary-item">
      <span class="cat-name">${cat}</span>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${((cnt / maxCat) * 100).toFixed(1)}%;background:${colors[i % colors.length]}"></div>
      </div>
      <span class="cat-count">${cnt}</span>
    </div>
  `,
    )
    .join("");
}

/* ============= PRODUCTOS MGMT ============= */
function renderProductosMgmt() {
  const tbody = document.getElementById("prodMgmtBody");
  tbody.innerHTML = State.products
    .map((p) => {
      const st = getStatus(p);
      return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:20px">${p.emoji}</div>
        <div>
          <div style="font-weight:600;color:var(--text-primary)">${p.nombre}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.codigo}</div>
        </div>
      </div></td>
      <td>${p.categoria}</td><td>${p.marca}</td>
      <td style="color:${p.stock === 0 ? "var(--danger)" : p.stock <= 5 ? "var(--warning)" : "inherit"};font-weight:600">${p.stock}</td>
      <td style="font-weight:600;color:var(--text-primary)">${fmt(p.precioVenta)}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td style="color:${isExpired(p.fechaVence) ? "var(--danger)" : "inherit"}">${p.fechaVence || "—"}</td>
      <td><div class="action-btns">
        <button class="btn-icon view" onclick="openDetail('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="btn-icon edit" onclick="openEdit('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-icon del" onclick="confirmDelete('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div></td>
    </tr>`;
    })
    .join("");
}

/* ============= REPORTES ============= */
function renderReportes() {
  const products = State.products;
  const expired = products.filter((p) => isExpired(p.fechaVence));
  const noStock = products.filter((p) => p.stock === 0);
  const totalVal = products.reduce((a, p) => a + p.precioVenta * p.stock, 0);
  const totalBuy = products.reduce((a, p) => a + p.precioCompra * p.stock, 0);

  document.getElementById("reportStats").innerHTML = [
    { label: "Total Productos", value: products.length, cls: "accent" },
    { label: "Valor Inventario", value: fmt(totalVal), cls: "success" },
    { label: "Margen Bruto", value: fmt(totalVal - totalBuy), cls: "gold" },
    { label: "Vencidos", value: expired.length, cls: "danger" },
  ]
    .map(
      (s) => `
    <div class="stat-card ${s.cls}">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `,
    )
    .join("");

  const catValues = {};
  products.forEach(
    (p) =>
      (catValues[p.categoria] =
        (catValues[p.categoria] || 0) + p.precioVenta * p.stock),
  );
  const catArr = Object.entries(catValues).sort((a, b) => b[1] - a[1]);
  const maxV = catArr[0]?.[1] || 1;
  document.getElementById("reportBarChart").innerHTML = catArr
    .map(
      ([c, v]) => `
    <div class="bar-row">
      <span class="bar-label">${c}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${((v / maxV) * 100).toFixed(1)}%"></div></div>
      <span class="bar-val">${fmt(v)}</span>
    </div>
  `,
    )
    .join("");

  const statGroups = [
    {
      label: "Activos",
      count: products.filter((p) => getStatus(p).cls === "success").length,
      color: "#22c55e",
    },
    { label: "Vencidos", count: expired.length, color: "#e05252" },
    { label: "Sin stock", count: noStock.length, color: "#7a2e2e" },
    {
      label: "Oferta",
      count: products.filter((p) => p.descuento > 0).length,
      color: "#c9a84c",
    },
  ].filter((g) => g.count > 0);
  renderDonut("reportDonut", "reportDonutLegend", statGroups, products.length);
}

/* ============= CONFIGURACIÓN ============= */
function renderConfiguracion() {
  renderConfigList("configCategories", "categorias");
  renderConfigList("configBrands", "marcas");
  renderConfigList("configProviders", "proveedores");
  renderConfigList("configOrigins", "origenes");
}

function renderConfigList(containerId, key) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = State.options[key]
    .map(
      (item) => `
    <div class="config-item">
      <span>${item}</span>
      <button class="config-item-del" onclick="deleteOption('${key}','${item}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `,
    )
    .join("");
}

function deleteOption(key, value) {
  State.options[key] = State.options[key].filter((v) => v !== value);
  renderConfiguracion();
  toast(`"${value}" eliminado`, "warning");
}

/* ============= DETALLE — CON AUDIT LOG ============= */
function buildAuditHTML(auditLog, filter) {
  const log =
    filter === "all"
      ? [...auditLog].reverse()
      : [...auditLog].reverse().filter((e) => e.type === filter);

  if (!log.length) {
    return `<div class="audit-empty">No hay eventos de este tipo registrados.</div>`;
  }

  return log
    .map((entry) => {
      const hasDiffs = entry.diffs && entry.diffs.length > 0;
      const diffsHTML = hasDiffs
        ? `<div class="audit-diff">
          ${entry.diffs
            .map(
              (d) => `
            <div class="audit-diff-row">
              <span class="audit-diff-field">${d.field}</span>
              <span class="audit-diff-from">${d.from || "—"}</span>
              <span class="audit-diff-arrow">→</span>
              <span class="audit-diff-to">${d.to || "—"}</span>
            </div>`,
            )
            .join("")}
         </div>`
        : "";

      const imageHTML = entry.imageSnap
        ? `<div class="audit-image-preview">
          <img src="${entry.imageSnap}" alt="imagen" onerror="this.style.display='none'">
         </div>`
        : "";

      return `
    <div class="audit-entry">
      <div class="audit-icon-wrap">
        <div class="audit-icon type-${entry.type}">${AUDIT_ICONS[entry.type] || "ℹ️"}</div>
      </div>
      <div class="audit-card">
        <div class="audit-card-head">
          <span class="audit-action-label">${entry.label}</span>
          <span class="audit-timestamp">${entry.timestamp}</span>
        </div>
        ${entry.detail ? `<div class="audit-detail">${entry.detail}</div>` : ""}
        ${diffsHTML}
        ${imageHTML}
        <div class="audit-user-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${entry.user}
        </div>
      </div>
    </div>`;
    })
    .join("");
}

function setAuditFilter(type, btn) {
  State.activeAuditFilter = type;
  document
    .querySelectorAll(".audit-tab")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const p = State.products.find((x) => x.id === State.viewingId);
  if (!p) return;
  const timeline = document.getElementById("auditTimeline");
  if (timeline) timeline.innerHTML = buildAuditHTML(p.auditLog, type);
}

function openDetail(id) {
  const p = State.products.find((x) => x.id === id);
  if (!p) return;
  State.viewingId = id;
  State.activeAuditFilter = "all";

  const st = getStatus(p);
  const finalPrice =
    p.descuento > 0
      ? (p.precioVenta * (1 - p.descuento / 100)).toFixed(2)
      : p.precioVenta;

  const totalChanges = p.auditLog.length;
  const codeChanges = p.auditLog.filter(
    (e) => e.type === AUDIT_TYPES.CODE_CHANGE,
  ).length;

  document.getElementById("detailBody").innerHTML = `
    <div class="detail-grid">
      <div class="detail-img">
        ${
          p.imageUrl
            ? `<img src="${p.imageUrl}" alt="${p.nombre}" onerror="this.style.display='none'">`
            : `<span style="font-size:72px">${p.emoji}</span>`
        }
      </div>
      <div class="detail-fields">
        <div class="detail-field" style="grid-column:1/-1">
          <div class="detail-field-label">Nombre</div>
          <div class="detail-field-value" style="font-size:18px;font-family:Syne,sans-serif">${p.nombre}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Código vigente</div>
          <div class="detail-field-value">
            <span class="code-current-pill">${p.codigo}</span>
            ${codeChanges > 0 ? `<span style="font-size:11px;color:var(--accent-gold);margin-left:6px">${codeChanges} cambio${codeChanges > 1 ? "s" : ""}</span>` : ""}
          </div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Estado</div>
          <div class="detail-field-value"><span class="badge ${st.cls}">${st.label}</span></div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Categoría</div>
          <div class="detail-field-value">${p.categoria}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Subcategoría</div>
          <div class="detail-field-value">${p.subcategoria || "—"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Marca</div>
          <div class="detail-field-value">${p.marca || "—"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Color / Tamaño</div>
          <div class="detail-field-value">${p.color || "—"} / ${p.tamano || "—"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Precio de Venta</div>
          <div class="detail-field-value" style="color:var(--success);font-weight:700">${fmt(finalPrice)}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Precio de Compra</div>
          <div class="detail-field-value">${fmt(p.precioCompra)}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Descuento</div>
          <div class="detail-field-value">${p.descuento > 0 ? `<span class="badge gold">-${p.descuento}%</span>` : "—"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Stock</div>
          <div class="detail-field-value" style="color:${p.stock === 0 ? "var(--danger)" : p.stock <= 5 ? "var(--warning)" : "inherit"};font-weight:700">${p.stock} ${p.unidad}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Proveedor</div>
          <div class="detail-field-value">${p.proveedor || "—"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Origen</div>
          <div class="detail-field-value">${p.origen || "—"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Fecha de Compra</div>
          <div class="detail-field-value">${p.fechaCompra || "—"}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">Fecha de Vencimiento</div>
          <div class="detail-field-value" style="color:${isExpired(p.fechaVence) ? "var(--danger)" : "inherit"}">${p.fechaVence || "—"}</div>
        </div>
        ${
          p.info
            ? `
        <div class="detail-field" style="grid-column:1/-1">
          <div class="detail-field-label">Información</div>
          <div class="detail-field-value">${p.info}</div>
        </div>`
            : ""
        }
      </div>
    </div>

    <!-- ═══ HISTORIAL DE AUDITORÍA ═══ -->
    <div class="audit-section">
      <div class="audit-section-header">
        <div class="audit-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Historial de cambios
          <span class="audit-count-badge">${totalChanges} evento${totalChanges !== 1 ? "s" : ""}</span>
        </div>
        <div class="audit-filter-tabs">
          <button class="audit-tab active" onclick="setAuditFilter('all',this)">Todos</button>
          <button class="audit-tab" onclick="setAuditFilter('create',this)">Creación</button>
          <button class="audit-tab" onclick="setAuditFilter('code',this)">Códigos</button>
          <button class="audit-tab" onclick="setAuditFilter('edit',this)">Datos</button>
          <button class="audit-tab" onclick="setAuditFilter('image',this)">Imagen</button>
          <button class="audit-tab" onclick="setAuditFilter('price',this)">Precios</button>
          <button class="audit-tab" onclick="setAuditFilter('stock',this)">Stock</button>
        </div>
      </div>
      <div class="audit-timeline" id="auditTimeline">
        ${buildAuditHTML(p.auditLog, "all")}
      </div>
    </div>
  `;

  document.getElementById("detailEditBtn").onclick = () => {
    document.getElementById("detailModal").classList.remove("open");
    openEdit(id);
  };
  document.getElementById("detailClose2").onclick = () => {
    document.getElementById("detailModal").classList.remove("open");
  };

  document.getElementById("detailModal").classList.add("open");
}

/* ============= MODAL PRODUCTO ============= */
function openModal(id = null) {
  State.editingId = id;
  const modal = document.getElementById("productModal");
  document.getElementById("modalTitle").textContent = id
    ? "Editar Producto"
    : "Nuevo Producto";

  populateFormSelects();

  // Resetear UI de cambio de código
  document.getElementById("codeChangeNotice").classList.remove("show");
  document.getElementById("codeReasonGroup").classList.remove("show");
  document.getElementById("fCodigoMotivo").value = "";
  document.getElementById("fCodigo").dataset.originalCode = "";

  if (id) {
    const p = State.products.find((x) => x.id === id);
    if (p) {
      fillForm(p);
      // Guardar código original para detectar cambios
      document.getElementById("fCodigo").dataset.originalCode = p.codigo;
    }
  } else {
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = "";
    document.getElementById("imagePreview").style.display = "none";
    document.getElementById("imagePlaceholder").style.display = "flex";
  }

  modal.classList.add("open");
}

function fillForm(p) {
  document.getElementById("productId").value = p.id;
  document.getElementById("fNombre").value = p.nombre;
  document.getElementById("fCodigo").value = p.codigo;
  document.getElementById("fCategoria").value = p.categoria;
  document.getElementById("fSubcategoria").value = p.subcategoria;
  document.getElementById("fMarca").value = p.marca;
  document.getElementById("fTamano").value = p.tamano;
  document.getElementById("fUnidad").value = p.unidad;
  document.getElementById("fColor").value = p.color;
  document.getElementById("fInfo").value = p.info;
  document.getElementById("fCantidadCompra").value = p.cantidadCompra;
  document.getElementById("fStock").value = p.stock;
  document.getElementById("fPrecioVenta").value = p.precioVenta;
  document.getElementById("fPrecioCompra").value = p.precioCompra;
  document.getElementById("fDescuento").value = p.descuento;
  document.getElementById("fFechaCompra").value = p.fechaCompra;
  document.getElementById("fFechaVence").value = p.fechaVence;
  document.getElementById("fProveedor").value = p.proveedor;
  document.getElementById("fOrigen").value = p.origen;
  document.getElementById("imageUrl").value = p.imageUrl || "";

  if (p.imageUrl) {
    document.getElementById("imagePreview").src = p.imageUrl;
    document.getElementById("imagePreview").style.display = "block";
    document.getElementById("imagePlaceholder").style.display = "none";
  } else {
    document.getElementById("imagePreview").style.display = "none";
    document.getElementById("imagePlaceholder").style.display = "flex";
  }
}

/* Detecta cambio de código en tiempo real */
function onCodigoInput() {
  const input = document.getElementById("fCodigo");
  const originalCode = input.dataset.originalCode || "";
  const newCode = input.value.trim();
  const changed = originalCode && newCode && newCode !== originalCode;

  document
    .getElementById("codeChangeNotice")
    .classList.toggle("show", !!changed);
  document
    .getElementById("codeReasonGroup")
    .classList.toggle("show", !!changed);
}

function populateFormSelects() {
  const maps = [
    { id: "fCategoria", key: "categorias" },
    { id: "fSubcategoria", key: "subcategorias" },
    { id: "fMarca", key: "marcas" },
    { id: "fTamano", key: "tamanos" },
    { id: "fUnidad", key: "unidades" },
    { id: "fColor", key: "colores" },
    { id: "fProveedor", key: "proveedores" },
    { id: "fOrigen", key: "origenes" },
  ];
  maps.forEach((m) => {
    const el = document.getElementById(m.id);
    if (!el) return;
    const curr = el.value;
    el.innerHTML =
      `<option value="">Seleccionar…</option>` +
      State.options[m.key]
        .map(
          (o) =>
            `<option value="${o}" ${o === curr ? "selected" : ""}>${o}</option>`,
        )
        .join("");
  });
}

function closeModal() {
  document.getElementById("productModal").classList.remove("open");
  State.editingId = null;
}

function openEdit(id) {
  const product = State.products.find((p) => p.id === id);
  if (!product) {
    toast("No se encontró el producto para editar", "danger");
    return;
  }
  openModal(id);
}

async function saveProduct() {
  const nombre = document.getElementById("fNombre").value.trim();
  const codigoNuevo = document.getElementById("fCodigo").value.trim();
  const cat = document.getElementById("fCategoria").value;
  const precio = parseFloat(document.getElementById("fPrecioVenta").value);
  const compra = parseFloat(document.getElementById("fPrecioCompra").value);
  const stock = parseInt(document.getElementById("fStock").value);

  if (!nombre || !cat || isNaN(precio) || isNaN(compra) || isNaN(stock)) {
    toast("Completa los campos requeridos (*)", "warning");
    return;
  }

  const codigoOriginal =
    document.getElementById("fCodigo").dataset.originalCode || "";
  const codeChanged =
    !!State.editingId && codigoNuevo && codigoNuevo !== codigoOriginal && !!codigoOriginal;
  const codeMotivo = document.getElementById("fCodigoMotivo").value.trim();

  if (codeChanged && !codeMotivo) {
    toast("Ingresa el motivo del cambio de código", "warning");
    document.getElementById("fCodigoMotivo").focus();
    return;
  }

  const data = {
    nombre,
    codigo: codigoNuevo || undefined,
    categoria: document.getElementById("fCategoria").value,
    subcategoria: document.getElementById("fSubcategoria").value,
    marca: document.getElementById("fMarca").value,
    tamano: document.getElementById("fTamano").value,
    unidad: document.getElementById("fUnidad").value,
    color: document.getElementById("fColor").value,
    info: document.getElementById("fInfo").value,
    cantidadCompra: parseInt(document.getElementById("fCantidadCompra").value) || 0,
    stock,
    precioVenta: precio,
    precioCompra: compra,
    descuento: parseInt(document.getElementById("fDescuento").value) || 0,
    fechaCompra: document.getElementById("fFechaCompra").value,
    fechaVence: document.getElementById("fFechaVence").value,
    proveedor: document.getElementById("fProveedor").value,
    origen: document.getElementById("fOrigen").value,
    imageUrl: document.getElementById("imageUrl").value.trim(),
    codigoMotivo: codeMotivo || undefined,
  };

  // Deshabilitar botón mientras guarda
  const saveBtn = document.getElementById("modalSave");
  saveBtn.disabled = true;

  try {
    if (State.editingId) {
      await API.products.update(State.editingId, data);
      toast(`Producto "${nombre}" actualizado`, "success");
      if (codeChanged) toast(`Código: ${codigoOriginal} → ${codigoNuevo}`, "info");
    } else {
      const created = await API.products.create(data);
      toast(`Producto "${nombre}" agregado (${created.codigo})`, "success");
    }

    closeModal();
    // Recargar lista completa desde API
    await loadFromAPI();
    refreshAfterProductChange();
  } catch (err) {
    toast(err.message || "Error al guardar producto", "danger");
  } finally {
    saveBtn.disabled = false;
  }
}

/* ============= DELETE ============= */
function confirmDelete(id) {
  State.deletingId = id;
  const p = State.products.find((x) => x.id === id);
  if (p) document.getElementById("deleteProductName").textContent = p.nombre;
  document.getElementById("deleteModal").classList.add("open");
}

async function doDelete() {
  if (!State.deletingId) return;
  const id = State.deletingId;
  State.deletingId = null;
  document.getElementById("deleteModal").classList.remove("open");
  try {
    await API.products.remove(id);
    State.products = State.products.filter((p) => p.id !== id);
    refreshAfterProductChange();
    toast("Producto eliminado", "danger");
  } catch (err) {
    toast(err.message || "Error al eliminar producto", "danger");
  }
}

/* ============= ADD OPTION MODAL ============= */
const OPTION_LABELS = {
  categoria: {
    title: "Nueva Categoría",
    key: "categorias",
    label: "Nombre de categoría",
  },
  subcategoria: {
    title: "Nueva Subcategoría",
    key: "subcategorias",
    label: "Nombre de subcategoría",
  },
  marca: { title: "Nueva Marca", key: "marcas", label: "Nombre de marca" },
  tamano: { title: "Nuevo Tamaño", key: "tamanos", label: "Tamaño" },
  unidad: { title: "Nueva Unidad", key: "unidades", label: "Unidad de medida" },
  color: { title: "Nuevo Color", key: "colores", label: "Nombre del color" },
  proveedor: {
    title: "Nuevo Proveedor",
    key: "proveedores",
    label: "Nombre del proveedor",
  },
  origen: {
    title: "Nuevo Origen",
    key: "origenes",
    label: "País / Región de origen",
  },
};

function openAddOption(type) {
  State.addingOptionType = type;
  const cfg = OPTION_LABELS[type];
  document.getElementById("addOptionTitle").textContent = cfg.title;
  document.getElementById("addOptionLabel").textContent = cfg.label;
  document.getElementById("addOptionInput").value = "";
  document.getElementById("addOptionModal").classList.add("open");
}

async function confirmAddOption() {
  const val = document.getElementById("addOptionInput").value.trim();
  if (!val) {
    toast("Escribe un nombre válido", "warning");
    return;
  }
  const type = State.addingOptionType;
  const cfg = OPTION_LABELS[type];
  if (State.options[cfg.key].includes(val)) {
    toast("Ya existe esta opción", "warning");
    return;
  }

  try {
    await API.catalogs.add(cfg.key, val);
    State.options[cfg.key].push(val);
    document.getElementById("addOptionModal").classList.remove("open");
    populateFormSelects();
    const selectMap = {
      categoria: "fCategoria",
      subcategoria: "fSubcategoria",
      marca: "fMarca",
      tamano: "fTamano",
      unidad: "fUnidad",
      color: "fColor",
      proveedor: "fProveedor",
      origen: "fOrigen",
    };
    const sel = document.getElementById(selectMap[type]);
    if (sel) sel.value = val;
    toast(`"${val}" agregado exitosamente`, "success");
  } catch (err) {
    toast(err.message || "Error al agregar opción", "danger");
  }
}

/* ============= EXPORT ============= */
function exportToCSV(data, filename) {
  const headers = [
    "Código",
    "Nombre",
    "Categoría",
    "Subcategoría",
    "Marca",
    "Stock",
    "P.Venta",
    "P.Compra",
    "Descuento",
    "Proveedor",
    "Origen",
    "F.Vencimiento",
    "Estado",
  ];
  const rows = data.map((p) => [
    p.codigo,
    p.nombre,
    p.categoria,
    p.subcategoria,
    p.marca,
    p.stock,
    p.precioVenta,
    p.precioCompra,
    p.descuento + "%",
    p.proveedor,
    p.origen,
    p.fechaVence || "",
    getStatus(p).label,
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(csv, filename + ".csv", "text/csv");
  toast("Exportado a CSV exitosamente", "success");
}

function exportToPDFTable(data, title) {
  const rows = data
    .map((p) => {
      const st = getStatus(p);
      return `<tr><td>${p.codigo}</td><td>${p.nombre}</td><td>${p.categoria}</td><td>${p.marca}</td>
      <td>${p.stock}</td><td>S/ ${p.precioVenta.toFixed(2)}</td>
      <td>${p.descuento > 0 ? p.descuento + "%" : "—"}</td><td>${p.fechaVence || "—"}</td><td>${st.label}</td></tr>`;
    })
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:sans-serif;font-size:11px;color:#222}h1{font-size:16px;margin-bottom:4px}
    p{color:#666;margin-bottom:12px;font-size:11px}table{width:100%;border-collapse:collapse}
    th{background:#111;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:5px 8px;border-bottom:1px solid #eee}tr:nth-child(even)td{background:#f9f9f9}</style>
  </head><body>
    <h1>A&M — ${title}</h1>
    <p>Generado: ${new Date().toLocaleString("es-PE")} · Total: ${data.length} productos</p>
    <table><thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Marca</th>
    <th>Stock</th><th>P.Venta</th><th>Desc.</th><th>Vence</th><th>Estado</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
  toast("Abriendo vista de impresión/PDF…", "info");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============= ICON HELPERS ============= */
function statIconBox() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`;
}
function statIconWarn() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}
function statIconX() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
}
function statIconDollar() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`;
}
function statIconTag() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
}

/* ============= GLOBAL SEARCH ============= */
function handleGlobalSearch(val) {
  if (!val.trim()) return;
  navigate("catalogo");
  setTimeout(() => {
    document.getElementById("filterName").value = val;
    applyFilters();
  }, 50);
}

/* ============= INIT ============= */
async function init() {
  if (!API.requireAuth()) return;

  // Mostrar loading
  document.getElementById("statsGrid").innerHTML =
    '<div style="color:var(--text-muted);padding:20px">Cargando...</div>';

  await loadFromAPI();
  State.filtered = [...State.products];

  // Navigation
  document.querySelectorAll(".nav-item").forEach((nav) => {
    nav.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(nav.dataset.section);
    });
  });

  // Sidebar toggle mobile
  document.getElementById("sidebarToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Add product buttons
  ["btnAddProduct", "btnAddProduct2", "btnAddProduct3"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => openModal());
  });

  // Modal events
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalCancel").addEventListener("click", closeModal);
  document.getElementById("modalSave").addEventListener("click", saveProduct);
  document.getElementById("productForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveProduct();
  });

  document
    .getElementById("detailClose")
    .addEventListener("click", () =>
      document.getElementById("detailModal").classList.remove("open"),
    );

  document
    .getElementById("deleteClose")
    .addEventListener("click", () =>
      document.getElementById("deleteModal").classList.remove("open"),
    );
  document
    .getElementById("deleteCancelBtn")
    .addEventListener("click", () =>
      document.getElementById("deleteModal").classList.remove("open"),
    );
  document
    .getElementById("deleteConfirmBtn")
    .addEventListener("click", doDelete);

  document
    .getElementById("addOptionClose")
    .addEventListener("click", () =>
      document.getElementById("addOptionModal").classList.remove("open"),
    );
  document
    .getElementById("addOptionCancel")
    .addEventListener("click", () =>
      document.getElementById("addOptionModal").classList.remove("open"),
    );
  document
    .getElementById("addOptionConfirm")
    .addEventListener("click", confirmAddOption);
  document.getElementById("addOptionInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmAddOption();
  });

  // Plus buttons in form
  document.querySelectorAll(".btn-plus").forEach((btn) => {
    btn.addEventListener("click", () => openAddOption(btn.dataset.modal));
  });

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });

  // ─── CLOUDINARY CONFIG ───────────────────────────────────────
  const CLOUDINARY_CLOUD = "dokafzzic";
  const CLOUDINARY_PRESET = "am_productos"; // ← lo creas en el Paso 2

  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    formData.append("folder", "am_exportaciones/productos");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: formData },
    );
    if (!res.ok) throw new Error("Error al subir imagen a Cloudinary");
    const data = await res.json();
    return data.secure_url; // URL pública HTTPS
  }

  // Image upload
  document
    .getElementById("imageUploadArea")
    .addEventListener("click", () =>
      document.getElementById("imageFile").click(),
    );

  document.getElementById("imageFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview inmediato con base64 mientras sube
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById("imagePreview").src = ev.target.result;
      document.getElementById("imagePreview").style.display = "block";
      document.getElementById("imagePlaceholder").style.display = "none";
      document.getElementById("imageUrl").value = "⏳ Subiendo...";
      document.getElementById("imageUrl").disabled = true;
    };
    reader.readAsDataURL(file);

    try {
      const cloudUrl = await uploadToCloudinary(file);
      document.getElementById("imageUrl").value = cloudUrl;
      document.getElementById("imageUrl").disabled = false;
      document.getElementById("imagePreview").src = cloudUrl;
      showToast("✅ Imagen subida a Cloudinary");
    } catch (err) {
      document.getElementById("imageUrl").value = "";
      document.getElementById("imageUrl").disabled = false;
      document.getElementById("imagePreview").style.display = "none";
      document.getElementById("imagePlaceholder").style.display = "flex";
      showToast("❌ Error al subir imagen: " + err.message);
    }
  });

  document.getElementById("imageUrl").addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url) {
      document.getElementById("imagePreview").src = url;
      document.getElementById("imagePreview").style.display = "block";
      document.getElementById("imagePlaceholder").style.display = "none";
    } else {
      document.getElementById("imagePreview").style.display = "none";
      document.getElementById("imagePlaceholder").style.display = "flex";
    }
  });

  // View toggle
  ["viewGrid", "viewList", "viewTable"].forEach((id) => {
    document.getElementById(id).addEventListener("click", () => {
      const view = id.replace("view", "").toLowerCase();
      State.currentView = view;
      document
        .querySelectorAll(".view-btn")
        .forEach((b) => b.classList.remove("active"));
      document.getElementById(id).classList.add("active");
      document.getElementById("productGrid").style.display =
        view === "grid" ? "grid" : "none";
      document.getElementById("productList").style.display =
        view === "list" ? "flex" : "none";
      document.getElementById("productTable").style.display =
        view === "table" ? "block" : "none";
      renderCurrentView();
    });
  });

  // Filters
  ["filterName", "filterCode", "filterPriceMin", "filterPriceMax"].forEach(
    (id) => {
      document.getElementById(id)?.addEventListener("input", applyFilters);
    },
  );
  [
    "filterCategory",
    "filterSubcategory",
    "filterBrand",
    "filterProveedor",
    "filterOrigen",
    "filterSort",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", applyFilters);
  });
  ["filterExpired", "filterNoStock", "filterDiscount"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", applyFilters);
  });

  document.getElementById("btnClearFilters").addEventListener("click", () => {
    document.getElementById("filterName").value = "";
    document.getElementById("filterCode").value = "";
    document.getElementById("filterCategory").value = "";
    document.getElementById("filterSubcategory").value = "";
    document.getElementById("filterBrand").value = "";
    document.getElementById("filterProveedor").value = "";
    document.getElementById("filterOrigen").value = "";
    document.getElementById("filterPriceMin").value = "";
    document.getElementById("filterPriceMax").value = "";
    document.getElementById("filterExpired").checked = false;
    document.getElementById("filterNoStock").checked = false;
    document.getElementById("filterDiscount").checked = false;
    document.getElementById("filterSort").value = "";
    applyFilters();
  });

  // Export buttons
  document
    .getElementById("btnExportExcel")
    .addEventListener("click", () =>
      exportToCSV(State.filtered, "A&M-catalogo"),
    );
  document
    .getElementById("btnExportPDF")
    .addEventListener("click", () =>
      exportToPDFTable(State.filtered, "Catálogo de Productos"),
    );
  document
    .getElementById("btnReportExcel")
    ?.addEventListener("click", () =>
      exportToCSV(State.products, "A&M-reporte-completo"),
    );
  document
    .getElementById("btnReportPDF")
    ?.addEventListener("click", () =>
      exportToPDFTable(State.products, "Reporte de Inventario"),
    );

  // Global search
  document.getElementById("globalSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGlobalSearch(e.target.value);
  });

  // Config section
  const configActions = [
    {
      btn: "btnAddCategory",
      input: "newCategoryInput",
      key: "categorias",
      label: "Categoría",
    },
    {
      btn: "btnAddBrand",
      input: "newBrandInput",
      key: "marcas",
      label: "Marca",
    },
    {
      btn: "btnAddProvider",
      input: "newProviderInput",
      key: "proveedores",
      label: "Proveedor",
    },
    {
      btn: "btnAddOrigin",
      input: "newOriginInput",
      key: "origenes",
      label: "Origen",
    },
  ];

  configActions.forEach(({ btn, input, key, label }) => {
    const addFn = () => {
      const el = document.getElementById(input);
      const val = el.value.trim();
      if (!val) return;
      if (!State.options[key].includes(val)) {
        State.options[key].push(val);
        renderConfiguracion();
        toast(`${label} "${val}" agregado`, "success");
      }
      el.value = "";
    };
    document.getElementById(btn)?.addEventListener("click", addFn);
    document.getElementById(input)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addFn();
    });
  });

  // ESC closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal-overlay.open")
        .forEach((m) => m.classList.remove("open"));
    }
  });

  // Initial render
  navigate("dashboard");
}

document.addEventListener("DOMContentLoaded", init);
