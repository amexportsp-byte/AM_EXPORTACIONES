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

// Escapa texto para insertarlo de forma segura en HTML (evita XSS con datos externos).
function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// Solo permite URLs http/https/data-image como src de imagen; si no, devuelve "".
function safeImgUrl(u) {
  const s = String(u || "").trim();
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s.replace(/"/g, "%22");
  return "";
}

// Línea "Costo Joanis": costo de compra referencial (lo que cobra Joanis).
// No es el precio de venta: ese lo define A&M.
function costoJoanisLine(p) {
  if (!p.importSource) return "";
  const costo = p.sourcePrice != null ? p.sourcePrice : p.precioCompra;
  return `<div style="font-size:11px;color:var(--text-muted)" title="Costo de compra referencial (precio de Joanis). Tu precio de venta es el de arriba.">
    Costo Joanis: <strong style="color:var(--text-secondary)">${costo > 0 ? fmt(costo) : "—"}</strong></div>`;
}

// Etiqueta de origen: distingue los productos importados (ej. de Joanis) de los propios.
function sourceBadge(p) {
  if (!p.importSource) return "";
  return `<span class="badge" title="Producto importado (no es de tu stock propio)"
    style="background:rgba(217,119,6,.15);color:#d97706;border-color:#d97706;font-size:10px;margin-left:6px;vertical-align:middle">
    ⬇ ${escHtml(p.importSource)}</span>`;
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

/* ── AUDITORÍA PERSISTENTE (localStorage por producto) ── */
const AUDIT_KEY = "am_audit_v1";

function loadAuditLog(productId) {
  try {
    const all = JSON.parse(localStorage.getItem(AUDIT_KEY) || "{}");
    return all[productId] || [];
  } catch { return []; }
}

function saveAuditLog(productId, entries) {
  try {
    const all = JSON.parse(localStorage.getItem(AUDIT_KEY) || "{}");
    all[productId] = entries;
    localStorage.setItem(AUDIT_KEY, JSON.stringify(all));
  } catch {}
}

function appendAuditLog(productId, newEntries) {
  if (!newEntries.length) return;
  const current = loadAuditLog(productId);
  saveAuditLog(productId, [...current, ...newEntries]);
}

async function loadFromAPI() {
  try {
    const [products, catalogs] = await Promise.all([
      API.products.list(),
      API.catalogs.list(),
    ]);

    // Agregar emoji y cargar historial desde localStorage
    products.forEach((p, i) => {
      if (!p.emoji) p.emoji = EMOJIS[i % EMOJIS.length];
      p.auditLog = loadAuditLog(p.id); // persiste entre recargas
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
  if (section === "visibilidad") renderVisibilidad();

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
  const inStock = document.getElementById("filterInStock")?.checked;
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
    if (inStock && p.stock <= 0) return false;
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
          ${p.importSource ? `<span class="badge" style="font-size:10px;background:rgba(217,119,6,.2);color:#d97706;border-color:#d97706">⬇ ${escHtml(p.importSource)}</span>` : ""}
          ${p.published === false ? `<span class="badge" style="font-size:10px;background:rgba(156,163,175,.2);color:#9ca3af;border-color:#9ca3af">Borrador</span>` : ""}
        </div>
      </div>
      <div class="product-card-body">
        <div class="product-card-name">${p.nombre}</div>
        <div class="product-card-meta">${p.categoria} · ${p.marca}</div>
        <div class="product-card-meta" style="font-size:11px;color:var(--text-muted)">${p.codigo}</div>
        ${p.importSource ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Precio de venta</div>` : ""}
        <div class="product-card-price">
          ${p.importSource && !(p.precioVenta > 0)
            ? `<span onclick="openEdit('${p.id}')" title="Definir tu precio de venta" style="cursor:pointer;font-size:13px;color:#d97706">✎ Pon tu precio</span>`
            : `${fmt(finalPrice)}${p.descuento > 0 ? ` <span class="original">${fmt(p.precioVenta)}</span>` : ""}`}
        </div>
        ${costoJoanisLine(p)}
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
        <div class="product-list-name">${p.nombre}${sourceBadge(p)}</div>
        <div class="product-list-meta">${p.codigo} · ${p.categoria} · ${p.marca} · Stock: ${p.stock}</div>
      </div>
      <div class="product-list-right">
        <span class="badge ${st.cls}">${st.label}</span>
        ${p.descuento > 0 ? `<span class="badge gold">-${p.descuento}%</span>` : ""}
        <div class="product-list-price" style="text-align:right">
          ${p.importSource && !(p.precioVenta > 0)
            ? `<span onclick="openEdit('${p.id}')" style="cursor:pointer;font-size:13px;color:#d97706">✎ Pon tu precio</span>`
            : fmt(finalPrice)}
          ${costoJoanisLine(p)}
        </div>
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
      <td style="color:var(--text-primary);font-weight:600;max-width:180px;white-space:normal">${p.nombre}${sourceBadge(p)}</td>
      <td>${p.categoria}</td><td>${p.marca}</td>
      <td style="color:${p.stock === 0 ? "var(--danger)" : p.stock <= 5 ? "var(--warning)" : "inherit"};font-weight:${p.stock <= 5 ? 600 : 400}">${p.stock}</td>
      <td style="color:var(--text-primary);font-weight:600">${p.importSource && !(p.precioVenta > 0)
        ? `<span onclick="openEdit('${p.id}')" style="cursor:pointer;font-size:12px;color:#d97706">✎ Pon tu precio</span>`
        : fmt(p.precioVenta)}</td>
      <td>${fmt(p.precioCompra)}${p.importSource ? `<div style="font-size:10px;color:var(--text-muted)">Costo Joanis</div>` : ""}</td>
      <td>${p.descuento > 0 ? `<span class="badge gold">-${p.descuento}%</span>` : "—"}</td>
      <td style="color:${isExpired(p.fechaVence) ? "var(--danger)" : "inherit"}">${p.fechaVence || "—"}</td>
      <td>${p.proveedor}</td>
      <td><span class="badge ${st.cls}">${st.label}</span>${p.published === false ? ` <span class="badge" style="background:rgba(156,163,175,.15);color:#9ca3af;border-color:#9ca3af">Borrador</span>` : ""}</td>
      <td><div class="action-btns">
        <button class="btn-icon" onclick="togglePublish('${p.id}', ${p.published === false ? "true" : "false"})" title="${p.published === false ? "Publicar en la tienda" : "Quitar de la tienda"}" style="color:${p.published === false ? "#9ca3af" : "#22c55e"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>${p.published === false ? '<line x1="2" y1="2" x2="22" y2="22"/>' : ""}</svg></button>
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
// Filtro por origen: 'todos' (juntos) | 'mios' (sin import_source) | 'joanis' (importados)
function setOriginFilter(origin) {
  State.originFilter = origin;
  document.querySelectorAll(".origin-filter .btn-chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.origin === origin);
  });
  renderProductosMgmt();
}

function renderProductosMgmt() {
  const tbody = document.getElementById("prodMgmtBody");
  if (!tbody) return;
  const origin = State.originFilter || "todos";
  let lista = State.products;
  if (origin === "mios")    lista = State.products.filter((p) => !p.importSource);
  if (origin === "joanis")  lista = State.products.filter((p) => !!p.importSource);
  if (origin === "cambios") lista = State.products.filter(porRevisar);

  const countEl = document.getElementById("prodMgmtCount");
  if (countEl) {
    const imp = State.products.filter((p) => !!p.importSource).length;
    const mine = State.products.length - imp;
    countEl.textContent = `${lista.length} mostrados · ${mine} míos · ${imp} de Joanis`;
  }
  const chipCambios = document.getElementById("chipCambiosCount");
  if (chipCambios) {
    const n = State.products.filter(porRevisar).length;
    chipCambios.textContent = n ? ` (${n})` : "";
  }

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">Sin productos en este filtro</td></tr>`;
    return;
  }
  tbody.innerHTML = lista
    .map((p) => {
      const st = getStatus(p);
      const pendiente = p.pendingChanges > 0;
      const bajo = bajoFuente(p);
      const sinPrecio = sinPrecioVenta(p);
      const rowStyle = pendiente
        ? "background:rgba(34,197,94,.10);box-shadow:inset 3px 0 0 #22c55e"
        : bajo ? "background:rgba(224,82,82,.08);box-shadow:inset 3px 0 0 #e05252"
        : sinPrecio ? "background:rgba(217,119,6,.07);box-shadow:inset 3px 0 0 #d97706" : "";
      const thumb = safeImgUrl(p.imageUrl);
      return `<tr style="${rowStyle}">
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;border-radius:6px;overflow:hidden;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
          ${thumb ? `<img src="${thumb}" style="width:34px;height:34px;object-fit:cover" onerror="this.style.display='none'">` : p.emoji}
        </div>
        <div>
          <div style="font-weight:600;color:var(--text-primary)">${p.nombre}${sourceBadge(p)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.codigo}${p.externalCode ? ` · Joanis: <strong>${escHtml(p.externalCode)}</strong>` : ""}${(p.images || []).length > 1 ? ` · 🖼 ${p.images.length}` : ""}</div>
        </div>
      </div></td>
      <td>${p.categoria}</td><td>${p.marca}</td>
      <td style="color:${p.stock === 0 ? "var(--danger)" : p.stock <= 5 ? "var(--warning)" : "inherit"};font-weight:600">${p.stock}</td>
      <td style="font-weight:600;color:var(--text-primary)">
        ${sinPrecio
          ? `<button type="button" onclick="openEdit('${p.id}')" title="Definir precio de venta"
               style="padding:2px 8px;border-radius:999px;cursor:pointer;font-size:11px;font-weight:700;border:1px solid #d97706;background:rgba(217,119,6,.15);color:#d97706">✎ Pon tu precio</button>`
          : fmt(p.precioVenta)}
        ${p.sourcePrice != null ? `<div style="font-size:11px;font-weight:400;color:var(--text-muted)">Costo Joanis: ${fmt(p.sourcePrice)}</div>` : ""}
        ${bajo ? `<div style="font-size:11px;color:#e05252;font-weight:600">⚠ Bajo el costo</div>` : ""}
        ${(p.importSource || p.totalChanges) ? `<button type="button" onclick="openSourceHistory('${p.id}')" title="Historial de cambios de Joanis"
            style="margin-top:4px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;cursor:pointer;font-size:11px;font-weight:600;
            border:1px solid ${pendiente ? "#22c55e" : "var(--border)"};background:${pendiente ? "rgba(34,197,94,.15)" : "transparent"};color:${pendiente ? "#22c55e" : "var(--text-muted)"}">
            🕘 ${pendiente ? `${p.pendingChanges} cambio${p.pendingChanges > 1 ? "s" : ""}` : "Historial"}</button>` : ""}
      </td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td>${publishToggle(p)}</td>
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

/* ============= PUBLICAR EN TIENDA ============= */
// Píldora-botón que muestra si el producto está publicado y permite cambiarlo.
function publishToggle(p) {
  const pub = p.published !== false;
  const color = pub ? "#22c55e" : "#9ca3af";
  const bg    = pub ? "rgba(34,197,94,.12)" : "rgba(156,163,175,.12)";
  const label = pub ? "Publicado" : "Borrador";
  const next  = pub ? "false" : "true";
  const title = pub ? "Quitar de la tienda (volver a borrador)" : "Publicar en la tienda";
  return `<button type="button" onclick="togglePublish('${p.id}', ${next})" title="${title}"
    style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;
    border:1px solid ${color};background:${bg};color:${color};font-size:12px;font-weight:600;cursor:pointer">
    <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>${label}</button>`;
}

async function togglePublish(id, published) {
  // published llega como string "true"/"false" desde el onclick
  const toPublish = published === true || published === "true";
  const prod = State.products.find((x) => x.id === id);
  if (toPublish && prod && !(prod.precioVenta > 0)) {
    toast("Primero pon tu precio de venta (el de Joanis es tu costo)", "warning");
    openEdit(id);
    return;
  }
  try {
    await API.products.publish(id, toPublish);
    const p = State.products.find((x) => x.id === id);
    if (p) p.published = toPublish;
    toast(toPublish ? "Producto publicado en la tienda" : "Producto quitado de la tienda", "success");
    renderCurrentView();
    renderProductosMgmt();
  } catch (err) {
    toast("No se pudo cambiar la publicación: " + err.message, "warning");
  }
}

/* ============= HISTORIAL DE CAMBIOS DE LA FUENTE (JOANIS) ============= */
// El precio de Joanis es el COSTO de compra de A&M; el precio de venta lo define A&M.
// ¿Producto importado que aún no tiene precio de venta?
function sinPrecioVenta(p) {
  return !!p.importSource && !(p.precioVenta > 0);
}
// ¿El precio de venta final de A&M quedó por debajo de su costo (precio Joanis)?
function bajoFuente(p) {
  if (!p.importSource || p.sourcePrice == null || !(p.precioVenta > 0)) return false;
  const finalAM = p.precioVenta * (1 - (p.descuento || 0) / 100);
  return finalAM + 0.001 < p.sourcePrice;
}
function porRevisar(p) {
  return p.pendingChanges > 0 || bajoFuente(p) || sinPrecioVenta(p);
}

function closeSourceHistory() {
  document.getElementById("sourceHistoryModal").classList.remove("open");
}

async function openSourceHistory(id) {
  const p = State.products.find((x) => x.id === id);
  if (!p) return;
  State.historyProductId = id;
  document.getElementById("sourceHistoryTitle").textContent = "Historial de cambios · " + p.nombre;
  const body = document.getElementById("sourceHistoryBody");
  body.innerHTML = `<p style="color:var(--text-muted)">Cargando historial…</p>`;
  document.getElementById("sourceHistoryModal").classList.add("open");
  try {
    const cambios = await API.products.sourceChanges(id);
    renderSourceHistory(p, cambios);
  } catch (err) {
    body.innerHTML = `<p style="color:var(--danger)">No se pudo cargar el historial: ${escHtml(err.message)}</p>`;
  }
}

function pct(from, to) {
  if (!(+from > 0)) return "";
  const v = ((to - from) / from) * 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function fechaCorta(d) {
  try { return new Date(d).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return d || ""; }
}

function renderSourceHistory(p, cambios) {
  const body = document.getElementById("sourceHistoryBody");
  const resumen = `
    <div class="config-card" style="margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
      <div><div style="font-size:11px;color:var(--text-muted)">Tu precio de venta</div><div style="font-weight:700;color:var(--text-primary)">${p.precioVenta > 0 ? fmt(p.precioVenta) : "Sin definir"}${p.descuento ? ` <span style="font-size:11px">(-${p.descuento}%)</span>` : ""}</div></div>
      <div><div style="font-size:11px;color:var(--text-muted)">Tu costo registrado</div><div style="font-weight:700;color:var(--text-primary)">${fmt(p.precioCompra)}</div></div>
      <div><div style="font-size:11px;color:var(--text-muted)">Costo actual en Joanis</div><div style="font-weight:700;color:var(--text-primary)">${p.sourcePrice != null ? fmt(p.sourcePrice) : "—"}</div></div>
      <div><div style="font-size:11px;color:var(--text-muted)">Código Joanis</div><div style="font-weight:700;color:var(--text-primary)">${escHtml(p.externalCode || "—")}</div></div>
    </div>
    ${bajoFuente(p) ? `<div style="margin-bottom:14px;padding:10px 12px;border-radius:8px;border:1px solid #e05252;background:rgba(224,82,82,.10);color:#e05252;font-size:13px;font-weight:600">
      ⚠ Tu precio de venta está por debajo de tu costo (lo que cobra Joanis).</div>` : ""}
    ${sinPrecioVenta(p) ? `<div style="margin-bottom:14px;padding:10px 12px;border-radius:8px;border:1px solid #d97706;background:rgba(217,119,6,.10);color:#d97706;font-size:13px;font-weight:600">
      ✎ Este producto aún no tiene tu precio de venta. Defínelo antes de publicarlo.</div>` : ""}`;

  if (!cambios.length) {
    body.innerHTML = resumen + `<p style="color:var(--text-muted)">Aún no hay cambios registrados para este producto. Se registrarán cuando una nueva consulta a Joanis detecte diferencias.</p>`;
    return;
  }

  const pendientes = cambios.filter((c) => c.status === "pendiente");
  const resto = cambios.filter((c) => c.status !== "pendiente");

  body.innerHTML = resumen +
    pendientes.map((c) => pendingCard(p, c)).join("") +
    (resto.length ? `<h4 style="margin:18px 0 8px;font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Historial</h4>` : "") +
    resto.map((c) => historyCard(c)).join("");

  pendientes.forEach((c) => updateChangeAlert(c.id));
}

function diffRows(d) {
  const rows = [];
  if (d.precio) {
    const sube = d.precio.to > d.precio.from;
    rows.push(`<div>Costo (precio Joanis): <s style="color:var(--text-muted)">${fmt(d.precio.from)}</s> →
      <strong style="color:${sube ? "#22c55e" : "#d97706"}">${fmt(d.precio.to)}</strong>
      <span style="font-size:12px;color:${sube ? "#22c55e" : "#d97706"}">(${pct(d.precio.from, d.precio.to)})</span></div>`);
  }
  if (d.nombre) rows.push(`<div>Nombre: <s style="color:var(--text-muted)">${escHtml(d.nombre.from)}</s> → <strong style="color:#22c55e">${escHtml(d.nombre.to)}</strong></div>`);
  if (d.categoria) rows.push(`<div>Categoría: <s style="color:var(--text-muted)">${escHtml(d.categoria.from)}</s> → <strong style="color:#22c55e">${escHtml(d.categoria.to)}</strong></div>`);
  if (d.motivo) rows.push(`<div>${escHtml(d.motivo)}</div>`);
  return rows.join("");
}

function pendingCard(p, c) {
  const d = c.diffs || {};
  const nuevo = c.new_source_price != null ? +c.new_source_price : null;
  const antes = c.old_source_price != null ? +c.old_source_price : null;
  let aviso = "";
  if (d.precio && nuevo > antes) aviso = `📈 Joanis subió el precio: <strong>tu costo sube a ${fmt(nuevo)}</strong>. Se recomienda actualizar tu precio de venta para no perder margen.`;
  if (d.precio && nuevo < antes) aviso = `📉 Joanis bajó el precio: <strong>tu costo baja a ${fmt(nuevo)}</strong>. Puedes mantener tu precio (ganas más margen) o bajarlo para ser más competitivo.`;
  return `
  <div style="margin-bottom:14px;padding:14px;border-radius:10px;border:1px solid #22c55e;background:rgba(34,197,94,.08)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <strong style="color:#22c55e">🕘 Cambio recomendado</strong>
      <span style="font-size:12px;color:var(--text-muted)">${fechaCorta(c.created_at)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-secondary)">${diffRows(d)}</div>
    ${aviso ? `<div style="margin-top:10px;font-size:13px;color:var(--text-secondary)">${aviso}</div>` : ""}
    <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end">
      ${d.precio ? `<div><div style="font-size:11px;color:var(--text-muted)">Costo nuevo (precio Joanis)</div><div style="font-weight:700;color:var(--text-primary)">${fmt(nuevo)}</div></div>` : ""}
      <div><div style="font-size:11px;color:var(--text-muted)">Tu precio de venta actual</div><div style="font-weight:700;color:var(--text-primary)">${fmt(c.sale_price_at != null ? c.sale_price_at : p.precioVenta)}</div></div>
      <div>
        <label style="font-size:11px;color:var(--text-muted)">Tu nuevo precio de venta ${c.suggested_price != null ? "(sugerido, mismo margen)" : ""}</label>
        <input type="number" step="0.01" min="0" class="form-input" id="chg-price-${c.id}"
          placeholder="Escribe tu precio"
          value="${c.suggested_price != null ? (+c.suggested_price).toFixed(2) : ""}"
          data-source="${nuevo != null ? nuevo : ""}" oninput="updateChangeAlert('${c.id}')" style="margin-top:4px">
      </div>
    </div>
    <div id="chg-alert-${c.id}" style="margin-top:8px;font-size:12px"></div>
    ${d.nombre || d.categoria ? `<div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--text-secondary)">
      ${d.nombre ? `<label><input type="checkbox" id="chg-name-${c.id}" checked> Aplicar nombre nuevo</label>` : ""}
      ${d.categoria ? `<label><input type="checkbox" id="chg-cat-${c.id}" checked> Aplicar categoría nueva</label>` : ""}
    </div>` : ""}
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn-ghost" type="button" onclick="decideSourceChange('${c.id}','rechazar')">Rechazar</button>
      <button class="btn-primary" type="button" onclick="decideSourceChange('${c.id}','aceptar')">Aceptar cambio</button>
    </div>
  </div>`;
}

function historyCard(c) {
  const d = c.diffs || {};
  const estados = {
    aceptado:  { t: "Aceptado",  col: "#22c55e" },
    rechazado: { t: "Rechazado", col: "#9ca3af" },
    info:      { t: c.tipo === "sin_stock" ? "Puesto sin stock" : c.tipo === "repuesto" ? "Repuesto (volvió a haber stock)" : "Info", col: c.tipo === "sin_stock" ? "#e05252" : "#3b82f6" },
  };
  const e = estados[c.status] || { t: c.status, col: "#9ca3af" };
  return `
  <div style="margin-bottom:8px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);font-size:13px;color:var(--text-secondary)">
    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
      <span style="font-weight:700;color:${e.col}">${e.t}</span>
      <span style="font-size:12px;color:var(--text-muted)">${fechaCorta(c.decided_at || c.created_at)}${c.decided_by_name ? " · " + escHtml(c.decided_by_name) : ""}</span>
    </div>
    ${diffRows(d)}
    ${c.applied_sale_price != null ? `<div>Precio de venta aplicado: <strong>${fmt(c.applied_sale_price)}</strong></div>` : ""}
  </div>`;
}

// Alerta en vivo: el precio que se escribe queda por debajo del precio de Joanis
function updateChangeAlert(changeId) {
  const inp = document.getElementById("chg-price-" + changeId);
  const box = document.getElementById("chg-alert-" + changeId);
  if (!inp || !box) return;
  const v = parseFloat(inp.value);
  const src = parseFloat(inp.dataset.source);
  if (!isFinite(v) || !isFinite(src)) { box.innerHTML = ""; return; }
  const margen = src > 0 ? ((v - src) / src) * 100 : 0;
  box.innerHTML = v < src
    ? `<span style="color:#e05252;font-weight:600">⚠ Venderías por debajo de tu costo (${fmt(src)}, precio Joanis). Margen: ${margen.toFixed(1)}%</span>`
    : `<span style="color:#22c55e">Margen sobre el costo: ${margen.toFixed(1)}%</span>`;
}

async function decideSourceChange(changeId, accion) {
  const body = { accion };
  if (accion === "aceptar") {
    const inp = document.getElementById("chg-price-" + changeId);
    const v = inp ? parseFloat(inp.value) : NaN;
    if (inp && inp.value !== "" && !(v > 0)) { toast("Ingresa un precio de venta válido", "warning"); return; }
    if (inp && v < parseFloat(inp.dataset.source) &&
        !confirm("Tu precio de venta queda por debajo de tu costo (precio Joanis). ¿Aceptar de todos modos?")) return;
    body.precioVenta = inp && inp.value !== "" ? v : null;
    const n = document.getElementById("chg-name-" + changeId);
    const c = document.getElementById("chg-cat-" + changeId);
    if (n) body.aplicarNombre = n.checked;
    if (c) body.aplicarCategoria = c.checked;
  }
  try {
    await API.products.decideChange(changeId, body);
    toast(accion === "aceptar" ? "Cambio aplicado (queda en el historial)" : "Cambio rechazado (queda en el historial)", "success");
    await loadFromAPI();
    refreshAfterProductChange();
    if (State.historyProductId) openSourceHistory(State.historyProductId);
  } catch (err) {
    toast("No se pudo guardar la decisión: " + err.message, "warning");
  }
}

/* ============= IMPORTAR PRODUCTOS (BORRADOR) ============= */
function openImportModal() {
  document.getElementById("importJson").value = "";
  const f = document.getElementById("importFile"); if (f) f.value = "";
  document.getElementById("importSummary").textContent = "";
  document.getElementById("importPreviewWrap").style.display = "none";
  document.getElementById("importPreviewBody").innerHTML = "";
  document.getElementById("importConfirmBtn").disabled = true;
  State.importParsed = [];
  document.getElementById("importModal").classList.add("open");
}
function closeImportModal() {
  document.getElementById("importModal").classList.remove("open");
}

// Consulta (una vez, al dar clic) el catálogo público de Joanis y lo deja listo para revisar.
async function fetchFromJoanis() {
  const btn = document.getElementById("btnFetchJoanis");
  const summary = document.getElementById("importSummary");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Consultando a Joanis…";
  summary.innerHTML = `<span style="color:var(--text-muted)">Trayendo catálogo…</span>`;
  try {
    // Pasa por el propio servidor (evita el bloqueo CORS del navegador)
    const data = await API.products.fetchJoanis();
    // Volcar el JSON al textarea y previsualizar con el mismo flujo
    document.getElementById("importJson").value = JSON.stringify(data);
    previewImport();
  } catch (err) {
    summary.innerHTML = `<span style="color:var(--warning)">No se pudo traer automáticamente (${err.message}).</span>
      <br><span style="font-size:12px;color:var(--text-muted)">Usa el método manual: abre el enlace del catálogo, guarda el .json y súbelo aquí.</span>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// Busca el primer arreglo de objetos dentro de un JSON arbitrario.
function findProductArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    // Claves comunes donde suele venir la lista
    const keys = ["productos", "products", "data", "items", "results", "rows", "lista", "content", "docs"];
    for (const k of keys) {
      if (Array.isArray(data[k])) return data[k];
    }
    // Si no, buscar cualquier propiedad que sea arreglo de objetos
    for (const k of Object.keys(data)) {
      if (Array.isArray(data[k]) && data[k].some((x) => x && typeof x === "object")) return data[k];
    }
  }
  return [];
}

// Toma el primer valor no vacío entre varias claves posibles (case-insensitive).
function pick(obj, keys) {
  for (const k of keys) {
    for (const realKey of Object.keys(obj)) {
      if (realKey.toLowerCase() === k.toLowerCase()) {
        const v = obj[realKey];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
  }
  return undefined;
}

// ── Soporte específico para el catálogo de Joanis (ERP grit) ──
const JOANIS_BASE = "https://apiv2.erp-grit-server-lnx.com";
const JOANIS_EMPRESA = "cf894123-13ae-4a14-9efe-c480622f841c";
const JOANIS_CATALOGO_URL = `${JOANIS_BASE}/api/tienda/${JOANIS_EMPRESA}/catalogo`;
// Joanis no expone stock exacto, solo un "nivel". Aproximación por nivel:
const STOCK_APROX = { DISPONIBLE: 10, QUEDA_POCO: 5, MUY_POCO: 3, ULTIMO: 1, AGOTADO: 0 };
// Orden de más disponible a menos (para elegir la mejor variante).
const NIVEL_ORDEN = ["DISPONIBLE", "QUEDA_POCO", "MUY_POCO", "ULTIMO", "AGOTADO"];

// Convierte el campo foto/fotos de Joanis en una URL de imagen completa.
function buildImageUrl(val) {
  if (Array.isArray(val)) val = val[0];
  if (val && typeof val === "object") val = val.url || val.src || val.uri || val.foto || "";
  const s = String(val || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;   // ya es URL
  if (s.startsWith("/")) return JOANIS_BASE + s;                        // ruta relativa
  // parece un id de medio → endpoint de imágenes de Joanis
  return `${JOANIS_BASE}/api/catalogo/medios/${encodeURIComponent(s)}?tam=detalle`;
}

// Construye un mapa { categoriaId: nombre } desde el arreglo categorias[] (Joanis).
function buildCategoryMap(data) {
  const map = {};
  const cats = data && (data.categorias || data.categories);
  if (Array.isArray(cats)) {
    cats.forEach((c) => {
      const id = c.id ?? c.categoriaId ?? c._id;
      const nom = c.nombre ?? c.name ?? c.titulo;
      if (id != null && nom) map[String(id)] = String(nom);
    });
  }
  return map;
}

// Normaliza un objeto de producto al formato que espera el backend.
// ctx.catMap resuelve categoriaId → nombre (Joanis).
function normalizeImportItem(raw, ctx = {}) {
  if (!raw || typeof raw !== "object") return null;

  const nombre = pick(raw, ["nombre", "name", "titulo", "title", "producto", "descripcion_corta", "descripcionCorta"]);
  if (!nombre) return null;

  // Imágenes: todas las de fotos[] (detalle); si no hay, la de foto
  let lista = pick(raw, ["fotos", "imagenes", "images"]);
  if (!Array.isArray(lista)) lista = lista ? [lista] : [];
  let images = lista.map(buildImageUrl).filter(Boolean);
  if (!images.length) {
    const unica = buildImageUrl(pick(raw, ["foto", "imageUrl", "image_url", "imagen", "image", "img", "picture", "thumbnail", "thumb", "url_imagen"]));
    if (unica) images = [unica];
  }
  images = [...new Set(images)];
  const imageUrl = images[0] || "";

  // Categoría: por nombre directo, o resolviendo categoriaId con el mapa
  let categoria = pick(raw, ["categoria", "category", "categoria_nombre", "categoryName", "rubro", "linea"]);
  if (!categoria) {
    const catId = pick(raw, ["categoriaId", "categoryId", "category_id", "idCategoria"]);
    if (catId != null && ctx.catMap) categoria = ctx.catMap[String(catId)];
  }

  // Precios: precioRegular = costo original (tachado); precio = final con descuento.
  let precioRegular = pick(raw, ["precioRegular", "precio_regular", "precioOriginal", "precio_original", "costo_original", "costoOriginal", "precioVenta", "precio_venta", "sale_price"]);
  let precioActual  = pick(raw, ["precio", "price", "pvp", "precio_final", "precioFinal", "costo_final", "costoFinal"]);
  const desc = pick(raw, ["descuento", "discount", "dcto", "off", "porcentaje_descuento"]);
  // Productos con tallas/colores: el precio viene en variantes[].precio
  if (precioRegular === undefined && precioActual === undefined && Array.isArray(raw.variantes)) {
    const v = raw.variantes.find((x) => x && x.precio != null && x.precio !== "");
    if (v) { precioActual = v.precio; if (v.precioRegular != null) precioRegular = v.precioRegular; }
  }
  // precio de venta = el regular (para mantener el tachado); si no hay, el actual
  const precioVenta = parseFloat(precioRegular) || parseFloat(precioActual) || 0;

  // Nivel efectivo: si hay variantes (tallas/colores), usar la MÁS disponible.
  let nivel = String(pick(raw, ["nivel", "estado", "disponibilidad"]) || "").toUpperCase();
  if (Array.isArray(raw.variantes) && raw.variantes.length) {
    const best = raw.variantes.reduce((acc, v) => {
      const vn = String(v && v.nivel || "").toUpperCase();
      if (!vn) return acc;
      if (acc === null || NIVEL_ORDEN.indexOf(vn) < NIVEL_ORDEN.indexOf(acc)) return vn;
      return acc;
    }, null);
    if (best) nivel = best;
  }

  // Stock: número explícito > aproximado por nivel > asumir disponible (sin info).
  const stockRaw = pick(raw, ["stock", "cantidad", "existencia", "existencias", "inventario", "qty", "quantity"]);
  let stock;
  if (stockRaw !== undefined)      stock = parseInt(stockRaw, 10) || 0;
  else if (nivel)                  stock = STOCK_APROX[nivel] ?? 0;
  else                             stock = 1; // sin dato de stock → disponible

  const marca = pick(raw, ["marca", "brand", "fabricante"]);
  const sku = pick(raw, ["sku", "codigo", "code", "barcode", "ean", "modelo"]);
  const descripcion = pick(raw, ["descripcion", "description", "detalle", "detail", "resumen"]);

  const externalId = pick(raw, ["id", "_id", "uuid", "productoId"]);
  const item = {
    externalId: externalId != null ? String(externalId) : "",
    codigo: sku ? String(sku).trim() : "",
    nombre: String(nombre).trim(),
    imageUrl,
    images,
    categoria: categoria ? String(categoria).trim() : "Importados",
    marca: marca ? String(marca).trim() : "",
    descripcion: descripcion ? String(descripcion) : "",
    precioVenta,                                              // precio regular de la fuente
    precioFuente: parseFloat(precioActual) || precioVenta,    // precio final que cobra la fuente
    descuento: parseFloat(desc) || 0,
    stock,
    agotado: stock <= 0,
  };
  // Los agotados no se agregan como nuevos (pero sí sirven para poner sin stock a los existentes).
  if (stock <= 0) item._skip = "agotado";
  return item;
}

function previewImport() {
  const txt = document.getElementById("importJson").value.trim();
  const summary = document.getElementById("importSummary");
  if (!txt) { summary.textContent = "Pega el JSON primero."; return; }
  let data;
  try {
    data = JSON.parse(txt);
  } catch (err) {
    summary.innerHTML = `<span style="color:var(--danger)">JSON inválido: ${err.message}</span>`;
    return;
  }
  const arr = findProductArray(data);
  const catMap = buildCategoryMap(data);
  const all = arr.map((r) => normalizeImportItem(r, { catMap })).filter(Boolean);
  const agotados = all.filter((p) => p._skip === "agotado").length;
  const normalized = all.filter((p) => !p._skip);  // los agotados no entran como nuevos
  State.importParsed = normalized;
  State.importAll = all;                            // se envían todos (para marcar sin stock)
  // Catálogo completo de Joanis (trae productos + categorías) → al final se marcan
  // sin stock los que ya no aparecen.
  State.importIsFull = !!(data && Array.isArray(data.productos) && Array.isArray(data.categorias));

  if (!normalized.length) {
    summary.innerHTML = `<span style="color:var(--warning)">No se detectaron productos disponibles en ese JSON${agotados ? ` (${agotados} estaban agotados y se omitieron)` : ""}.</span>`;
    document.getElementById("importPreviewWrap").style.display = "none";
    document.getElementById("importConfirmBtn").disabled = true;
    return;
  }
  summary.innerHTML = `<span style="color:#22c55e">${normalized.length} producto(s) disponible(s) detectado(s).</span>` +
    (agotados ? ` <span style="color:var(--text-muted)">${agotados} agotados omitidos.</span>` : "") +
    ` Entrarán como <strong>borrador</strong>.`;
  document.getElementById("importPreviewBody").innerHTML = normalized.slice(0, 50).map((p) => {
    const img = safeImgUrl(p.imageUrl);
    return `
    <tr>
      <td><div style="width:30px;height:30px;border-radius:5px;background:var(--bg-input);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:12px">
        ${img ? `<img src="${img}" style="width:30px;height:30px;object-fit:cover" onerror="this.style.display='none'">` : "📦"}</div></td>
      <td style="color:var(--text-primary);font-weight:600;max-width:200px;white-space:normal">${escHtml(p.nombre)}</td>
      <td>${escHtml(p.categoria)}</td>
      <td>${fmt(p.precioFuente != null ? p.precioFuente : p.precioVenta)}</td>
      <td>${p.descuento > 0 ? "-" + escHtml(p.descuento) + "%" : "—"}</td>
      <td>${escHtml(p.stock)}</td>
    </tr>`;
  }).join("");
  document.getElementById("importPreviewWrap").style.display = "block";
  document.getElementById("importConfirmBtn").disabled = false;
}

async function runImport() {
  // Se envían TODOS (también los agotados: sirven para poner sin stock a los que ya existen)
  const lista = State.importAll && State.importAll.length ? State.importAll : (State.importParsed || []);
  if (!lista.length) { toast("No hay productos para importar", "warning"); return; }
  const btn = document.getElementById("importConfirmBtn");
  btn.disabled = true;
  btn.textContent = "Sincronizando…";
  try {
    // Enviar por tandas (el servidor limita el tamaño de cada envío)
    const TANDA = 50;
    const r = { insertados: 0, cambios: 0, sinStock: 0, repuestos: 0, sinCambios: 0, omitidos: 0, errores: 0 };
    for (let i = 0; i < lista.length; i += TANDA) {
      btn.textContent = `Sincronizando ${Math.min(i + TANDA, lista.length)} de ${lista.length}…`;
      const parcial = await API.products.import(lista.slice(i, i + TANDA), "Joanis");
      Object.keys(r).forEach((k) => { r[k] += parcial[k] || 0; });
    }
    // Catálogo completo: los que ya no aparecen en Joanis → sin stock
    if (State.importIsFull) {
      const ids = lista.map((p) => p.externalId).filter(Boolean);
      if (ids.length) {
        const fin = await API.products.importFinalize(ids, "Joanis");
        r.sinStock += fin.retirados || 0;
      }
    }
    toast(
      `Nuevos: ${r.insertados} · Con cambios sugeridos: ${r.cambios} · Puestos sin stock: ${r.sinStock}` +
      (r.repuestos ? ` · Repuestos: ${r.repuestos}` : "") +
      ` · Sin cambios: ${r.sinCambios}` + (r.errores ? ` · Errores: ${r.errores}` : ""),
      r.errores ? "warning" : "success"
    );
    closeImportModal();
    await loadFromAPI();          // vuelve a traer los productos (incluye los importados)
    refreshAfterProductChange();  // re-dibuja todo sin recargar la página
    navigate("productos");
    // Mostrar primero lo que necesita revisión
    if (r.cambios > 0) setOriginFilter("cambios");
    else if (r.insertados > 0) setOriginFilter("joanis");
  } catch (err) {
    toast("Error al importar: " + err.message, "warning");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Importar como borrador`;
  }
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

/* ============= VISIBILIDAD DE CATEGORÍAS ============= */
function renderVisibilidad() {
  const el = document.getElementById("visibilityList");
  if (!el) return;
  const cats = State._catalogIds?.categorias || [];
  if (!cats.length) {
    el.innerHTML = '<div style="color:var(--text-muted);padding:20px">No hay categorías registradas.</div>';
    return;
  }
  el.innerHTML = cats.map(cat => {
    const isVisible = cat.visible !== false;
    const eyeOpen = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#22c55e" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const eyeClosed = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#e05252" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    return `
      <div class="config-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px">
        <div>
          <span style="font-size:14px;font-weight:500;color:var(--text-primary)">${cat.name}</span>
          <span style="font-size:11px;margin-left:8px;color:${isVisible ? '#22c55e' : '#e05252'}">${isVisible ? 'Visible' : 'Oculta'}</span>
        </div>
        <button
          class="vis-eye-btn"
          data-cat-id="${cat.id}"
          data-visible="${isVisible}"
          onclick="toggleCategoryVisibility(this)"
          title="${isVisible ? 'Categoría visible — clic para ocultar' : 'Categoría oculta — clic para mostrar'}"
          style="background:none;border:1px solid ${isVisible ? 'rgba(34,197,94,.3)' : 'rgba(224,82,82,.3)'};border-radius:8px;padding:6px 10px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;color:${isVisible ? '#22c55e' : '#e05252'};font-size:12px;font-weight:600"
        >
          ${isVisible ? eyeOpen : eyeClosed}
          ${isVisible ? 'Ocultar' : 'Activar'}
        </button>
      </div>`;
  }).join("");
}

async function toggleCategoryVisibility(btn) {
  const id = btn.dataset.catId;
  const currentlyVisible = btn.dataset.visible === "true";
  const newVisible = !currentlyVisible;
  btn.disabled = true;
  try {
    await API.catalogs.toggleVisibility(id, newVisible);
    const cat = State._catalogIds?.categorias?.find(c => String(c.id) === String(id));
    if (cat) cat.visible = newVisible;
    renderVisibilidad();
    toast(`Categoría ${newVisible ? "activada — ya visible en tienda" : "ocultada — ya no aparece en tienda ni en ventas"}`, newVisible ? "success" : "warning");
  } catch (err) {
    btn.disabled = false;
    toast("Error al actualizar visibilidad: " + err.message, "warning");
  }
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
      <div>
        <div class="detail-img">
          ${
            p.imageUrl
              ? `<img id="detailMainImg" src="${p.imageUrl}" alt="${p.nombre}" onerror="this.style.display='none'">`
              : `<span style="font-size:72px">${p.emoji}</span>`
          }
        </div>
        ${(p.images || []).length > 1 ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${p.images.map((u) => safeImgUrl(u)).filter(Boolean).map((u) => `
            <img src="${u}" onclick="document.getElementById('detailMainImg').src=this.src"
              style="width:48px;height:48px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border)"
              onerror="this.style.display='none'">`).join("")}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${p.images.length} imágenes · clic para ampliar</div>` : ""}
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

  const codigoGroup = document.getElementById("codigoGroup");
  const codigoInput = document.getElementById("fCodigo");

  if (id) {
    // EDITAR: mostrar código (solo lectura por defecto)
    codigoGroup.style.display = "";
    codigoInput.readOnly = true;
    codigoInput.style.opacity = "0.7";
    const p = State.products.find((x) => x.id === id);
    if (p) {
      fillForm(p);
      codigoInput.dataset.originalCode = p.codigo;
    }
  } else {
    // NUEVO: ocultar campo código (se genera automáticamente)
    codigoGroup.style.display = "none";
    codigoInput.value = "";
    codigoInput.readOnly = false;
    codigoInput.style.opacity = "1";
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = "";
    document.getElementById("imagePreview").style.display = "none";
    document.getElementById("imagePlaceholder").style.display = "flex";
  }

  modal.classList.add("open");
}

function habilitarEditCodigo() {
  const input = document.getElementById("fCodigo");
  input.readOnly = false;
  input.style.opacity = "1";
  input.focus();
  input.select();
  document.getElementById("codigoEditIcon").style.display = "none";
  toast("Puedes editar el código. Se pedirá el motivo al guardar.", "info");
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
  // Código solo aplica al editar (al crear lo genera el servidor)
  const codigoNuevo = State.editingId
    ? document.getElementById("fCodigo").value.trim()
    : null;
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
      // Construir entradas de auditoría ANTES de guardar
      const oldP = State.products.find((x) => x.id === State.editingId);
      const newAuditEntries = oldP
        ? buildAuditEntries(oldP, { ...oldP, ...data }, codeMotivo)
        : [];

      await API.products.update(State.editingId, data);

      // Persistir auditoría en localStorage
      appendAuditLog(State.editingId, newAuditEntries);

      toast(`Producto "${nombre}" actualizado`, "success");
      if (codeChanged) toast(`Código: ${codigoOriginal} → ${codigoNuevo}`, "info");
    } else {
      const created = await API.products.create(data);

      // Entrada inicial de creación
      const initEntry = createAuditEntry(
        AUDIT_TYPES.CREATE,
        "Producto creado",
        `Código asignado: ${created.codigo}`,
        [],
        data.imageUrl || null,
      );
      saveAuditLog(created.id, [initEntry]);

      toast(`Producto "${nombre}" agregado (${created.codigo})`, "success");
    }

    closeModal();
    await loadFromAPI();
    refreshAfterProductChange();
  } catch (err) {
    console.error("[saveProduct] ERROR:", err);
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
    // Limpiar auditoría del producto eliminado
    try {
      const all = JSON.parse(localStorage.getItem(AUDIT_KEY) || "{}");
      delete all[id];
      localStorage.setItem(AUDIT_KEY, JSON.stringify(all));
    } catch {}
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
  API.startHeartbeat("registro.html", "Registro de Productos");

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

  // Importar productos
  document.getElementById("btnImportProducts")?.addEventListener("click", openImportModal);
  document.getElementById("importClose")?.addEventListener("click", closeImportModal);
  document.getElementById("importCancelBtn")?.addEventListener("click", closeImportModal);
  document.getElementById("importPreviewBtn")?.addEventListener("click", previewImport);
  document.getElementById("importConfirmBtn")?.addEventListener("click", runImport);
  document.getElementById("btnFetchJoanis")?.addEventListener("click", fetchFromJoanis);
  document.getElementById("importFile")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById("importJson").value = reader.result;
      previewImport();
    };
    reader.readAsText(file);
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

  // ─── CLOUDINARY CONFIG (cargada desde el servidor) ──────────
  let _cloudinaryConfig = null;

  async function getCloudinaryConfig() {
    if (_cloudinaryConfig) return _cloudinaryConfig;
    try {
      const cfg = await API.get("/api/auth/config");
      _cloudinaryConfig = cfg.cloudinary;
    } catch {
      _cloudinaryConfig = { cloud_name: "dokafzzic", upload_preset: "am_productos" };
    }
    return _cloudinaryConfig;
  }

  async function uploadToCloudinary(file) {
    const cfg = await getCloudinaryConfig();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", cfg.upload_preset);
    formData.append("folder", "am_exportaciones/productos");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/image/upload`,
      { method: "POST", body: formData }
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data.secure_url;
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
      toast("Imagen subida correctamente", "success");
    } catch (err) {
      console.error("Error Cloudinary:", err);
      document.getElementById("imageUrl").value = "";
      document.getElementById("imageUrl").disabled = false;
      // Mantener la preview en base64 para que el usuario la vea
      toast("Error al subir a Cloudinary: " + err.message, "danger");
      toast("Puedes pegar la URL de la imagen manualmente", "info");
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
  ["filterExpired", "filterNoStock", "filterInStock", "filterDiscount"].forEach((id) => {
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
    document.getElementById("filterInStock").checked = false;
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
