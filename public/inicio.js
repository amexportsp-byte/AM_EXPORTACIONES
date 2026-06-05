// ================================================
// A&M IMPORTACIONES - script.js
// Sin chatbot · WhatsApp Checkout · Color #E89E48
// ================================================

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== PRODUCTOS (cargados desde la DB) =====
let products = [];

// Mapeo categoría → clave interna + ícono emoji
const CAT_MAP = {
  limpieza:     { cat: 'limpieza',     icon: '🧹' },
  herramientas: { cat: 'herramientas', icon: '🔧' },
  iluminacion:  { cat: 'iluminacion',  icon: '💡' },
  iluminación:  { cat: 'iluminacion',  icon: '💡' },
  ferreteria:   { cat: 'ferreteria',   icon: '🚪' },
  ferretería:   { cat: 'ferreteria',   icon: '🚪' },
  construccion: { cat: 'construccion', icon: '🧱' },
  construcción: { cat: 'construccion', icon: '🧱' },
  tecnologia:   { cat: 'tecnologia',   icon: '💻' },
  tecnología:   { cat: 'tecnologia',   icon: '💻' },
  electrohogar: { cat: 'electrohogar', icon: '🏠' },
  jardineria:   { cat: 'jardineria',   icon: '🌿' },
  jardinería:   { cat: 'jardineria',   icon: '🌿' },
  pinturas:     { cat: 'pinturas',     icon: '🎨' },
  pintura:      { cat: 'pinturas',     icon: '🎨' },
  muebles:      { cat: 'muebles',      icon: '🛋️' },
  mueble:       { cat: 'muebles',      icon: '🛋️' },
  'baño':       { cat: 'bano',         icon: '🚿' },
  bano:         { cat: 'bano',         icon: '🚿' },
  cocina:       { cat: 'cocina',       icon: '🍳' },
  automotriz:   { cat: 'automotriz',   icon: '🚗' },
  mascotas:     { cat: 'mascotas',     icon: '🐾' },
  moda:         { cat: 'moda',         icon: '👗' },
  ropa:         { cat: 'moda',         icon: '👗' },
  calzado:      { cat: 'calzado',      icon: '👟' },
  accesorios:   { cat: 'accesorios',   icon: '💍' },
};

function mapDbProduct(p) {
  const key = (p.categoria || '').toLowerCase().trim();
  const catInfo = CAT_MAP[key] || { cat: 'otros', icon: '📦' };
  const price = parseFloat(p.precioVenta) || 0;
  const disc  = parseFloat(p.descuento)   || 0;
  const old   = disc > 0 ? Math.round(price / (1 - disc / 100) * 100) / 100 : price;
  return {
    id:          p.id,
    codigo:      p.codigo       || '',
    brand:       p.marca        || 'A&M',
    name:        p.nombre,
    price,
    old,
    disc,
    icon:        catInfo.icon,
    cat:         catInfo.cat,
    subcategoria: p.subcategoria || '',
    imageUrl:    p.imageUrl     || '',
    stock:       p.stock        || 0,
    info:        p.descripcion  || '',
    sold:        0,
  };
}

let _firstLoad = true;

async function loadProducts() {
  try {
    const res = await fetch('/api/products/public');
    if (!res.ok) throw new Error('Error ' + res.status);
    const data = await res.json();
    products = data.map(mapDbProduct);

    // Reconstruir menús y barra promo desde productos reales
    buildDynamicMegaData();
    renderMegaSidebar();
    renderQuickCats();
    renderPromoBar();

    // Primera carga: renderizar home Y restaurar la última ruta
    if (_firstLoad) {
      _firstLoad = false;
      renderFeatured();   // siempre poblar la home aunque luego se vaya al catálogo
      refreshAIRecs();
      restorePageState(); // puede cambiar a la página guardada
      return;
    }

    // Recargas por SSE: re-renderizar la sección activa
    if (currentPage === 'home' || currentPage === 'none') {
      renderFeatured();
      refreshAIRecs();
    } else if (currentPage === 'catalog') {
      let sorted = [...products];
      if (currentSort === 'low')  sorted.sort((a, b) => a.price - b.price);
      if (currentSort === 'high') sorted.sort((a, b) => b.price - a.price);
      if (currentSort === 'sold') sorted.sort((a, b) => (b.sold || 0) - (a.sold || 0));
      renderProducts(sorted);
    }
  } catch (e) {
    console.error('Error cargando productos:', e);
  }
}

// ===== WHATSAPP CONFIG =====
const WHATSAPP_NUMBER = "51928020850"; // Perú +51

// ===== DISPLAY INFO POR CATEGORÍA =====
const CAT_DISPLAY = {
  limpieza:     { label: 'Limpieza',      emoji: '🧹' },
  herramientas: { label: 'Herramientas',  emoji: '🔧' },
  iluminacion:  { label: 'Iluminación',   emoji: '💡' },
  ferreteria:   { label: 'Ferretería',    emoji: '🚪' },
  construccion: { label: 'Construcción',  emoji: '🧱' },
  tecnologia:   { label: 'Tecnología',    emoji: '💻' },
  electrohogar: { label: 'Electrohogar',  emoji: '🏠' },
  jardineria:   { label: 'Jardinería',    emoji: '🌿' },
  pinturas:     { label: 'Pinturas',      emoji: '🎨' },
  muebles:      { label: 'Muebles',       emoji: '🛋️' },
  bano:         { label: 'Baño',          emoji: '🚿' },
  cocina:       { label: 'Cocina',        emoji: '🍳' },
  automotriz:   { label: 'Automotriz',    emoji: '🚗' },
  mascotas:     { label: 'Mascotas',      emoji: '🐾' },
  moda:         { label: 'Moda',          emoji: '👗' },
  calzado:      { label: 'Calzado',       emoji: '👟' },
  accesorios:   { label: 'Accesorios',    emoji: '💍' },
  otros:        { label: 'Varios',        emoji: '📦' },
};

// ===== MEGA MENU DATA =====
const megaData = {
  limpieza:{icon:"🧹",title:"Limpieza",cols:[
    {title:"Productos",items:["Detergentes y jabones","Lavavajillas","Lejías","Desinfectantes","Limpiadores","Limpia vidrios"]},
    {title:"Útiles",items:["Baldes y bateas","Bolsas de basura","Escobas","Trapeadores","Paños multiusos"]}
  ]},
  tecnologia:{icon:"💻",title:"Tecnología",cols:[
    {title:"Computadoras",items:["Laptops","PCs escritorio","Tablets","Monitores"]},
    {title:"Teléfonos",items:["Smartphones","Auriculares","Cargadores","Accesorios"]}
  ]},
  electrohogar:{icon:"🏠",title:"Electrohogar",cols:[
    {title:"Frío",items:["Refrigeradoras","Congeladoras","Frigobar"]},
    {title:"Lavandería",items:["Lavadoras","Secadoras","Lavadora-secadora"]},
    {title:"Cocción",items:["Cocinas","Campanas","Hornos microondas"]}
  ]},
  herramientas:{icon:"🔧",title:"Herramientas",cols:[
    {title:"Eléctricas",items:["Taladros","Sierras","Lijadoras","Rotomartillos"]},
    {title:"Manuales",items:["Llaves","Destornilladores","Martillos","Alicates"]}
  ]},
  construccion:{icon:"🧱",title:"Construcción",cols:[
    {title:"Materiales",items:["Cemento","Arena","Ladrillo","Mallas","Varillas"]},
    {title:"Acabados",items:["Pisos cerámicos","Porcelanato","Mayólicas"]}
  ]},
  iluminacion:{icon:"💡",title:"Iluminación",cols:[
    {title:"Interior",items:["Focos LED","Tubos fluorescentes","Paneles LED"]},
    {title:"Exterior",items:["Reflectores","Focos de jardín","Faroles","Tiras LED"]}
  ]},
  ferreteria:{icon:"🚪",title:"Ferretería y Puertas",cols:[
    {title:"Puertas",items:["Puertas MDF","Puertas de madera","Puertas metálicas"]},
    {title:"Ferretería",items:["Cerraduras","Bisagras","Tornillos","Silicona"]}
  ]},
  jardineria:{icon:"🌿",title:"Jardinería",cols:[
    {title:"Plantas",items:["Plantas ornamentales","Plantas de interior","Semillas"]},
    {title:"Herramientas",items:["Mangueras","Aspersores","Palas","Tijeras de podar"]}
  ]},
  pinturas:{icon:"🎨",title:"Pinturas y acabados",cols:[
    {title:"Pinturas",items:["Pintura látex","Pintura esmalte","Barniz"]},
    {title:"Accesorios",items:["Rodillos","Brochas","Lijas","Masilla"]}
  ]},
  muebles:{icon:"🛋️",title:"Muebles",cols:[
    {title:"Sala",items:["Sofás","Sillas","Mesas de centro","Estantes"]},
    {title:"Dormitorio",items:["Camas","Colchones","Cómodas","Closets"]}
  ]},
  bano:{icon:"🚿",title:"Baño",cols:[
    {title:"Sanitarios",items:["Inodoros","Lavatorios","Duchas","Bañeras"]},
    {title:"Accesorios",items:["Grifería","Espejos","Toalleros"]}
  ]},
  cocina:{icon:"🍳",title:"Cocina",cols:[
    {title:"Electrodomésticos",items:["Licuadoras","Batidoras","Cafeteras"]},
    {title:"Vajilla",items:["Ollas","Sartenes","Cubiertos","Vasos"]}
  ]},
  automotriz:{icon:"🚗",title:"Automotriz",cols:[
    {title:"Mantenimiento",items:["Aceite de motor","Filtros","Bujías"]},
    {title:"Accesorios",items:["Perfumes","Fundas","Limpiadores"]}
  ]},
  mascotas:{icon:"🐾",title:"Mascotas",cols:[
    {title:"Perros",items:["Alimento perros","Juguetes","Correas","Camas"]},
    {title:"Gatos",items:["Alimento gatos","Areneros","Rascadores"]}
  ]}
};

// ===== PLANES - ACUMULATIVOS =====
const PLAN_BASICO = [
  {icon:"📱",name:"Aplicativo Web responsivo",desc:"Sitio web optimizado para todos los dispositivos con enfoque comercial"},
  {icon:"🎨",name:"Identidad digital de marca",desc:"Gestión visual y estratégica de la marca en entorno digital"},
  {icon:"📦",name:"Catálogo dinámico",desc:"Listado de productos/servicios con actualización en tiempo real"},
  {icon:"📝",name:"Formulario inteligente de contacto",desc:"Captura estructurada de leads con validación automática"},
  {icon:"🔐",name:"Autenticación de usuarios (Login)",desc:"Gestión de acceso seguro para clientes o administradores"},
  {icon:"📊",name:"Dashboard operativo básico",desc:"Visualización de métricas esenciales del negocio"},
  {icon:"✏️",name:"Gestión de contenido",desc:"Administración autónoma de contenido digital"},
  {icon:"📅",name:"Agendamiento digital",desc:"Base de reservas con disponibilidad configurable"},
  {icon:"🔔",name:"Sistema de notificaciones básicas",desc:"Alertas automatizadas por eventos simples"},
  {icon:"☁️",name:"Infraestructura cloud (Hosting)",desc:"Despliegue en servidores escalables en la nube"},
  {icon:"🗄️",name:"Base de datos estructurada",desc:"Almacenamiento seguro y organizado de información"},
  {icon:"📲",name:"Integración con redes sociales",desc:"Conexión con plataformas para difusión y tráfico"},
  {icon:"💬",name:"Chat interactivo básico",desc:"Comunicación directa con usuarios"},
  {icon:"📡",name:"Publicador de contenido dinámico",desc:"Actualización de información en tiempo real"},
  {icon:"📐",name:"Optimización responsive avanzada",desc:"Adaptación UI/UX multiplataforma"}
];

const PLAN_PRO_NEW = [
  {icon:"🛒",name:"E-commerce completo",desc:"Plataforma de ventas online con flujo completo"},
  {icon:"💳",name:"Pasarela de pagos multicanal",desc:"Integración con múltiples métodos de pago"},
  {icon:"🧾",name:"Facturación electrónica integrada",desc:"Generación automática de comprobantes legales"},
  {icon:"📉",name:"Gestión inteligente de inventario",desc:"Control en tiempo real con trazabilidad"},
  {icon:"⚡",name:"Sistema de alertas predictivas",desc:"Notificaciones anticipadas de eventos críticos"},
  {icon:"👥",name:"CRM de clientes",desc:"Base de datos avanzada de clientes con historial"},
  {icon:"📋",name:"Historial transaccional completo",desc:"Registro detallado de operaciones"},
  {icon:"🎯",name:"Segmentación avanzada de clientes",desc:"Clasificación por comportamiento y consumo"},
  {icon:"📲",name:"Notificaciones push inteligentes",desc:"Mensajes personalizados automatizados"},
  {icon:"📧",name:"Automatización de correos (Emailing)",desc:"Campañas automatizadas de comunicación"},
  {icon:"🏆",name:"Sistema de fidelización gamificado",desc:"Recompensas y puntos para retención"},
  {icon:"🏷️",name:"Motor de promociones dinámicas",desc:"Creación de descuentos automatizados"},
  {icon:"📈",name:"Dashboard analítico avanzado",desc:"Visualización profunda de KPIs"},
  {icon:"🌐",name:"Arquitectura multiusuario escalable",desc:"Gestión concurrente de usuarios"},
  {icon:"🔑",name:"Sistema de roles y permisos jerárquicos",desc:"Control granular de accesos"},
  {icon:"📊",name:"Generador de reportes automatizados",desc:"Informes en tiempo real exportables"},
  {icon:"🗺️",name:"Tracking logístico en tiempo real",desc:"Seguimiento de pedidos o servicios"},
  {icon:"📍",name:"Geolocalización inteligente",desc:"Identificación geográfica avanzada"},
  {icon:"📅",name:"Agenda automatizada inteligente",desc:"Optimización de citas y disponibilidad"},
  {icon:"💬",name:"Chat en vivo omnicanal",desc:"Comunicación integrada en múltiples canales"},
  {icon:"🔗",name:"Integración API empresarial",desc:"Conexión con sistemas externos"},
  {icon:"💾",name:"Sistema de backup inteligente",desc:"Copias automáticas seguras"},
  {icon:"🔄",name:"Gestión de datos masivos (ETL)",desc:"Importación/exportación estructurada"}
];

const PLAN_PREMIUM_NEW = [
  {icon:"🤖",name:"Motor de Inteligencia Artificial",desc:"Predicción, automatización y aprendizaje continuo"},
  {icon:"🎯",name:"Sistema de recomendaciones predictivas",desc:"Sugerencias personalizadas en tiempo real"},
  {icon:"🧠",name:"Análisis de comportamiento avanzado",desc:"Modelado de patrones de usuario"},
  {icon:"📈",name:"Predicción de ventas con IA",desc:"Estimación de ingresos futuros"},
  {icon:"⚙️",name:"Automatización total de procesos (RPA)",desc:"Ejecución autónoma de tareas repetitivas"},
  {icon:"🔄",name:"Workflows inteligentes configurables",desc:"Flujos automatizados adaptables"},
  {icon:"🤖",name:"Asistente virtual cognitivo",desc:"Chatbot con IA contextual"},
  {icon:"👤",name:"Reconocimiento facial biométrico",desc:"Identificación avanzada de usuarios"},
  {icon:"🎙️",name:"Interacción por voz (Voice AI)",desc:"Control mediante comandos de voz"},
  {icon:"✍️",name:"Firma digital biométrica avanzada",desc:"Validación legal con biometría"},
  {icon:"📡",name:"Integración IoT empresarial",desc:"Conexión con dispositivos físicos"},
  {icon:"🛰️",name:"Monitoreo en tiempo real 24/7",desc:"Seguimiento continuo del sistema"},
  {icon:"📊",name:"KPIs dinámicos personalizados",desc:"Métricas adaptadas al negocio"},
  {icon:"🗺️",name:"Heatmaps de comportamiento",desc:"Mapas de interacción del usuario"},
  {icon:"🔻",name:"Embudo de conversión automatizado",desc:"Optimización del proceso de venta"},
  {icon:"🎮",name:"Gamificación avanzada",desc:"Incentivos estratégicos"},
  {icon:"💰",name:"Sistema de suscripciones SaaS",desc:"Gestión de pagos recurrentes"},
  {icon:"🏟️",name:"Gestión inteligente de aforo",desc:"Control de capacidad en tiempo real"},
  {icon:"🚛",name:"Logística optimizada con IA",desc:"Rutas y entregas eficientes"},
  {icon:"🔀",name:"Asignación automática de recursos",desc:"Distribución inteligente"},
  {icon:"🛡️",name:"Seguridad cibernética avanzada",desc:"Protección de alto nivel"},
  {icon:"🔒",name:"Encriptación de datos end-to-end",desc:"Seguridad total de información"},
  {icon:"🔏",name:"Gestión avanzada de sesiones",desc:"Control total de accesos"},
  {icon:"📋",name:"Auditoría digital completa",desc:"Registro detallado del sistema"},
  {icon:"🪙",name:"Sistema de tokens de seguridad",desc:"Autenticación avanzada"},
  {icon:"📴",name:"Modo offline inteligente sincronizado",desc:"Operación sin conexión con sincronización"},
  {icon:"🥽",name:"Realidad aumentada aplicada",desc:"Visualización interactiva"},
  {icon:"🌐",name:"Realidad virtual empresarial",desc:"Simulación inmersiva"},
  {icon:"🌍",name:"Traducción automática en tiempo real",desc:"Soporte multilenguaje"},
  {icon:"✨",name:"Generación de contenido con IA",desc:"Automatización de marketing"}
];

const PLANS = {
  basico: { modules: PLAN_BASICO, color:'#27ae60', label:'BÁSICO', icon:'📱', count: PLAN_BASICO.length },
  pro: { modules: [...PLAN_BASICO,...PLAN_PRO_NEW], newModules: PLAN_PRO_NEW, color:'#E89E48', label:'PRO', icon:'⚡', count: PLAN_BASICO.length + PLAN_PRO_NEW.length },
  premium: { modules: [...PLAN_BASICO,...PLAN_PRO_NEW,...PLAN_PREMIUM_NEW], newModules: PLAN_PREMIUM_NEW, color:'#7b2ff7', label:'PREMIUM', icon:'👑', count: PLAN_BASICO.length + PLAN_PRO_NEW.length + PLAN_PREMIUM_NEW.length }
};

// ===== ESTADO =====
let cart = [];
let currentBanner = 0;
const totalBanners = 3;
let currentDetailQty = 1;
let currentDetailProduct = null;
let currentDashboardPlan = 'basico';
let currentPlanTab = 'basico';
let currentPage = 'none';
let currentSort = 'recommended';

// ===== WHATSAPP CHECKOUT =====
function goToWhatsAppCheckout() {
  if (!cart.length) {
    showToast('⚠️ Tu carrito está vacío');
    return;
  }

  // Obtener categoría y subcategoría del producto (basado en cat)
  const catMap = {
    limpieza: { cat: 'Limpieza', subcat: 'Productos de limpieza' },
    ferreteria: { cat: 'Ferretería', subcat: 'Materiales y accesorios' },
    herramientas: { cat: 'Herramientas', subcat: 'Herramientas profesionales' },
    iluminacion: { cat: 'Iluminación', subcat: 'Focos y luminarias' },
    construccion: { cat: 'Construcción', subcat: 'Materiales de construcción' },
    electrohogar: { cat: 'Electrohogar', subcat: 'Electrodomésticos' },
    tecnologia: { cat: 'Tecnología', subcat: 'Equipos tecnológicos' },
    jardineria: { cat: 'Jardinería', subcat: 'Herramientas y plantas' },
    pinturas: { cat: 'Pinturas', subcat: 'Pinturas y acabados' },
    muebles: { cat: 'Muebles', subcat: 'Mobiliario y decoración' },
    bano: { cat: 'Baño', subcat: 'Sanitarios y accesorios' },
    cocina: { cat: 'Cocina', subcat: 'Electrodomésticos y vajilla' },
    automotriz: { cat: 'Automotriz', subcat: 'Accesorios y mantenimiento' },
    mascotas: { cat: 'Mascotas', subcat: 'Alimento y accesorios' }
  };

  let totalFinal = 0;
  let totalAhorro = 0;

  let msg = `🛍️ *PEDIDO - A&M IMPORTACIONES*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  cart.forEach((it, idx) => {
    const disc = it.old > it.price ? Math.round(((it.old - it.price) / it.old) * 100) : 0;
    const subtotal = it.price * it.qty;
    const ahorro = (it.old - it.price) * it.qty;
    const sku = it.codigo || `PRO-${String(it.id).slice(0, 8).toUpperCase()}`;
    const catInfo = catMap[it.cat] || { cat: 'General', subcat: 'Varios' };

    totalFinal += subtotal;
    totalAhorro += ahorro;

    msg += `📦 *Producto ${idx + 1}*\n`;
    msg += `• Nombre: ${it.name}\n`;
    msg += `• Código (SKU): ${sku}\n`;
    msg += `• Marca: ${it.brand}\n`;
    msg += `• Categoría: ${catInfo.cat}\n`;
    msg += `• Subcategoría: ${catInfo.subcat}\n`;
    msg += `• Cantidad: ${it.qty} unidad(es)\n`;
    msg += `• Descuento: ${disc}% OFF\n`;
    msg += `• Precio unitario: S/ ${it.price.toFixed(2)}\n`;
    msg += `• Subtotal: S/ ${subtotal.toFixed(2)}\n`;
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *Ahorro total: S/ ${totalAhorro.toFixed(2)}*\n`;
  msg += `✅ *TOTAL A PAGAR: S/ ${totalFinal.toFixed(2)}*\n\n`;
  msg += `Por favor, confirmar disponibilidad y método de pago. ¡Gracias! 🙏`;

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMsg}`;
  window.open(waUrl, '_blank');
}

// ===== MEGA MENÚ DINÁMICO =====
let dynamicMegaData = {};

function buildDynamicMegaData() {
  dynamicMegaData = {};
  products.forEach(p => {
    if (!dynamicMegaData[p.cat]) {
      const info = CAT_DISPLAY[p.cat] || { label: p.cat || 'Otros', emoji: '📦' };
      dynamicMegaData[p.cat] = { icon: info.emoji, title: info.label, cols: {} };
    }
    const sub = p.subcategoria || 'Productos';
    if (!dynamicMegaData[p.cat].cols[sub]) dynamicMegaData[p.cat].cols[sub] = [];
    dynamicMegaData[p.cat].cols[sub].push(p);
  });
}

function renderMegaSidebar() {
  const sidebar = document.getElementById('megaSidebar');
  if (!sidebar) return;
  const cats = Object.keys(dynamicMegaData);
  if (!cats.length) return;

  sidebar.innerHTML = `
    <div class="mega-sidebar-header">
      📂 Categorías
      <button onclick="closeMegaMenu()" style="float:right;background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:18px;line-height:1;margin-top:-2px">×</button>
    </div>
    ${cats.map((cat, i) => {
      const d = dynamicMegaData[cat];
      const count = Object.values(d.cols).reduce((s, a) => s + a.length, 0);
      return `<div class="mega-cat${i === 0 ? ' active' : ''}" data-cat="${cat}"
        onmouseenter="megaShowSubs('${cat}', this)"
        onclick="closeMegaMenu();filterCatalogByCat('${cat}')">
        <span>${d.icon} ${d.title}</span>
        <span class="mega-cat-count">${count}</span>
      </div>`;
    }).join('')}`;

  // Las columnas 2 y 3 quedan vacías hasta que el usuario haga hover
}

// Muestra subcategorías al pasar por una categoría
function megaShowSubs(cat, triggerEl) {
  document.querySelectorAll('.mega-cat').forEach(el => el.classList.remove('active'));
  if (triggerEl) triggerEl.classList.add('active');

  const d = dynamicMegaData[cat];
  const subsEl = document.getElementById('megaSubs');
  const contentEl = document.getElementById('megaContent');
  if (!subsEl || !d) return;

  const subs = Object.keys(d.cols);
  if (!subs.length) {
    subsEl.innerHTML = '<div class="mega-subs-hint">Sin subcategorías</div>';
    contentEl.innerHTML = '<div class="mega-content-hint">Sin productos</div>';
    return;
  }

  subsEl.innerHTML = `
    <div style="padding:10px 16px 6px;font-size:10px;font-weight:800;text-transform:uppercase;color:#aaa;letter-spacing:.6px">${d.icon} ${d.title}</div>
    ${subs.map(sub => `
      <div class="mega-sub-item" data-cat="${cat}" data-sub="${sub}"
           onmouseenter="megaShowProds('${cat}','${sub}',this)"
           onclick="closeMegaMenu();filterCatalogBySubCat('${cat}','${sub}');event.stopPropagation()">
        ${sub}
        <span class="mega-sub-count">${d.cols[sub].length}</span>
      </div>`).join('')}`;

  // Col 3 vacía hasta que el usuario haga hover en una subcategoría
  document.getElementById('megaContent').innerHTML =
    '<div class="mega-content-hint">← Pasa el cursor sobre una subcategoría</div>';
}

// Muestra nombres de productos de una subcategoría en la columna 3
function megaShowProds(cat, sub, triggerEl) {
  document.querySelectorAll('.mega-sub-item').forEach(el => el.classList.remove('active'));
  if (triggerEl) triggerEl.classList.add('active');

  const d = dynamicMegaData[cat];
  const contentEl = document.getElementById('megaContent');
  if (!contentEl || !d || !d.cols[sub]) return;

  const prods = d.cols[sub];

  const names = prods.map(p => `
    <div class="mega-prod-name-row" onclick="closeMegaMenu();showDetail('${p.id}')">
      <div class="mega-prod-name-thumb">
        ${p.imageUrl
          ? `<img src="${p.imageUrl}" alt="" onerror="this.style.display='none'">`
          : `<span style="font-size:18px">${p.icon||'📦'}</span>`}
      </div>
      <span class="mega-prod-name-text">${p.name}</span>
      <span class="mega-prod-name-price">S/ ${p.price.toFixed(2)}</span>
    </div>`).join('');

  contentEl.innerHTML = `
    <div class="mega-prods-header">
      <span class="mega-prods-title">${sub}</span>
      <span style="font-size:11px;color:#aaa">${prods.length} producto${prods.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="mega-prod-names-list">${names}</div>
    <div class="mega-cat-footer" onclick="closeMegaMenu();filterCatalogBySubCat('${cat}','${sub}')">
      Ver todos en <strong>${sub}</strong> →
    </div>`;
}

// ===== CATEGORÍAS DINÁMICAS =====
// ===== SISTEMA DE FILTROS DEL CATÁLOGO =====
let filterState = { cat: null, sub: null, brands: [], maxPrice: null };

function getFilteredProducts() {
  let r = [...products];
  if (filterState.cat)            r = r.filter(p => p.cat === filterState.cat);
  if (filterState.sub)            r = r.filter(p => p.subcategoria === filterState.sub);
  if (filterState.brands.length)  r = r.filter(p => filterState.brands.includes(p.brand));
  if (filterState.maxPrice !== null) r = r.filter(p => p.price <= filterState.maxPrice);
  return r;
}

function applySort(list) {
  const s = [...list];
  if (currentSort === 'low')  s.sort((a, b) => a.price - b.price);
  if (currentSort === 'high') s.sort((a, b) => b.price - a.price);
  if (currentSort === 'sold') s.sort((a, b) => (b.sold || 0) - (a.sold || 0));
  return s;
}

function applyFilters() {
  const filtered = applySort(getFilteredProducts());
  renderProducts(filtered);
  renderFilterPanel();
  updateCatalogBreadcrumb();
  savePageState();
}

function renderFilterPanel() {
  const panel = document.getElementById('filtersPanel');
  if (!panel) return;

  // Categorías con stock (de todos los productos)
  const availCats = [...new Set(products.map(p => p.cat).filter(Boolean))];

  // Subcategorías de la categoría seleccionada
  const subcats = filterState.cat
    ? [...new Set(products.filter(p => p.cat === filterState.cat).map(p => p.subcategoria).filter(Boolean))]
    : [];

  // Base para calcular marcas (cat + sub, sin filtro de marca para evitar bucle)
  let brandBase = [...products];
  if (filterState.cat) brandBase = brandBase.filter(p => p.cat === filterState.cat);
  if (filterState.sub) brandBase = brandBase.filter(p => p.subcategoria === filterState.sub);
  const availBrands = [...new Set(brandBase.map(p => p.brand).filter(Boolean))];

  // Rango de precio
  const priceBase = brandBase.length ? brandBase : products;
  const maxP = Math.ceil(Math.max(...priceBase.map(p => p.price), 10));
  const curMax = filterState.maxPrice !== null ? Math.min(filterState.maxPrice, maxP) : maxP;

  let html = `
    <div class="filters-header">
      <h2>Filtrar</h2>
      <button class="clear-filters" onclick="clearAllFilters()">Limpiar</button>
    </div>`;

  // ── Categorías (subcategorías inline justo debajo de la seleccionada) ──
  html += `<details open class="filter-group"><summary>Categorías</summary><div class="filter-cats-list">`;
  availCats.forEach(cat => {
    const info   = CAT_DISPLAY[cat] || { label: cat, emoji: '📦' };
    const count  = products.filter(p => p.cat === cat).length;
    const active = filterState.cat === cat;
    html += `<div class="filter-cat-row${active ? ' active' : ''}" onclick="selectFilterCat('${cat}')">
      <span>${info.emoji} ${info.label}</span>
      <span class="filter-count">${count}</span>
    </div>`;

    // Subcategorías inline: solo aparecen debajo de SU categoría cuando está activa
    if (active && subcats.length) {
      html += `<div class="filter-subcats-list">`;
      subcats.forEach(sub => {
        const subCount  = products.filter(p => p.cat === cat && p.subcategoria === sub).length;
        const subActive = filterState.sub === sub;
        html += `<div class="filter-sub-row${subActive ? ' active' : ''}" onclick="selectFilterSub('${sub}')">
          <span>↳ ${sub}</span>
          <span class="filter-count">${subCount}</span>
        </div>`;
      });
      html += '</div>';
    }
  });
  html += '</div></details>';

  // ── Precio ──
  html += `
    <details class="filter-group"${filterState.maxPrice !== null ? ' open' : ''}>
      <summary>Precio</summary>
      <div class="range-slider">
        <input type="range" id="priceRange" min="0" max="${maxP}" value="${curMax}"
          oninput="document.getElementById('priceVal').textContent='S/ '+Number(this.value).toFixed(0);filterState.maxPrice=parseFloat(this.value);applyFilters()">
        <span id="priceVal">S/ ${curMax}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-top:4px">
        <span>S/ 0</span><span>S/ ${maxP}</span>
      </div>
    </details>`;

  // ── Marca ──
  if (availBrands.length) {
    html += `<details class="filter-group"${filterState.brands.length ? ' open' : ''}>
      <summary>Marca</summary>
      <div class="filter-brands-list">`;
    availBrands.forEach(brand => {
      const count   = brandBase.filter(p => p.brand === brand).length;
      const checked = filterState.brands.includes(brand);
      html += `<label class="filter-brand-row">
        <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleBrand('${brand.replace(/'/g,"\\'")}',this.checked)">
        <span class="filter-brand-name">${brand}</span>
        <span class="filter-count">${count}</span>
      </label>`;
    });
    html += `</div></details>`;
  }

  panel.innerHTML = html;
}

function selectFilterCat(cat) {
  filterState.cat    = filterState.cat === cat ? null : cat;
  filterState.sub    = null;
  filterState.brands = [];
  filterState.maxPrice = null;
  applyFilters();
}

function selectFilterSub(sub) {
  filterState.sub    = filterState.sub === sub ? null : sub;
  filterState.brands = [];
  applyFilters();
}

function toggleBrand(brand, checked) {
  if (checked) { if (!filterState.brands.includes(brand)) filterState.brands.push(brand); }
  else          { filterState.brands = filterState.brands.filter(b => b !== brand); }
  applyFilters();
}

function clearAllFilters() {
  filterState = { cat: null, sub: null, brands: [], maxPrice: null };
  applyFilters();
}

// ── Persistencia de estado entre recargas de página ──
function savePageState() {
  try {
    sessionStorage.setItem('am_state', JSON.stringify({
      page:        currentPage,
      sort:        currentSort,
      filterState: { ...filterState, brands: [...filterState.brands] },
    }));
  } catch {}
}

function restorePageState() {
  try {
    const raw = sessionStorage.getItem('am_state');
    if (!raw) return;
    const s = JSON.parse(raw);

    if (s.sort) {
      currentSort = s.sort;
      const sortEl = document.getElementById('sortProducts');
      if (sortEl) sortEl.value = currentSort;
    }

    if (s.page === 'catalog') {
      filterState = {
        cat:      s.filterState?.cat      || null,
        sub:      s.filterState?.sub      || null,
        brands:   s.filterState?.brands   || [],
        maxPrice: s.filterState?.maxPrice ?? null,
      };
      showPage('catalog', false);
    } else if (s.page === 'home') {
      showPage('home', false);
    }
    // detail y cart vuelven a home (no se puede restaurar sin los datos previos)
  } catch {}
}

function updateCatalogBreadcrumb() {
  const bc = document.getElementById('catalogBreadcrumb');
  if (!bc) return;
  let html = `<span onclick="clearAllFilters();showPage('catalog')" style="cursor:pointer">A&M Importaciones</span> › `;
  if (!filterState.cat) {
    html += `<span>Catálogo</span>`;
  } else {
    html += `<span onclick="selectFilterCat(null);clearAllFilters()" style="cursor:pointer">Catálogo</span> › `;
    const info = CAT_DISPLAY[filterState.cat] || { label: filterState.cat };
    html += `<span class="bc-active" onclick="selectFilterSub(null)" style="cursor:pointer">${info.label}</span>`;
    if (filterState.sub) {
      html += ` › <span class="bc-active">${filterState.sub}</span>`;
    }
  }
  bc.innerHTML = html;
}

// ===== PROMO BAR DINÁMICA =====
function renderPromoBar() {
  const bar = document.getElementById('promoBar');
  if (!bar || !products.length) return;

  // Definición de cada chip: ícono, texto, filtro y validación de existencia
  const chips = [
    {
      icon: '💡', label: 'Iluminación',
      check: () => products.some(p => p.cat === 'iluminacion'),
      filter: () => { filterCatalogByCat('iluminacion'); }
    },
    {
      icon: '🔥', label: 'Desde S/ 1',
      check: () => products.some(p => p.price <= 1),
      filter: () => {
        const f = products.filter(p => p.price <= 1);
        showPage('catalog'); renderProducts(f);
      }
    },
    {
      icon: '💻', label: 'Tecnología',
      check: () => products.some(p => p.cat === 'tecnologia'),
      filter: () => { filterCatalogByCat('tecnologia'); }
    },
    {
      icon: '🧱', label: 'Construcción',
      check: () => products.some(p => p.cat === 'construccion'),
      filter: () => { filterCatalogByCat('construccion'); }
    },
    {
      icon: '🔧', label: 'Herramientas',
      check: () => products.some(p => p.cat === 'herramientas'),
      filter: () => { filterCatalogByCat('herramientas'); }
    },
    {
      icon: '🧹', label: 'Limpieza',
      check: () => products.some(p => p.cat === 'limpieza'),
      filter: () => { filterCatalogByCat('limpieza'); }
    },
    {
      icon: '🌿', label: 'Jardinería',
      check: () => products.some(p => p.cat === 'jardineria'),
      filter: () => { filterCatalogByCat('jardineria'); }
    },
    {
      icon: '👗', label: 'Moda',
      check: () => products.some(p => p.cat === 'moda'),
      filter: () => { filterCatalogByCat('moda'); }
    },
  ];

  // Solo mostrar chips con productos disponibles
  const visible = chips.filter(c => c.check());
  if (!visible.length) { bar.innerHTML = ''; return; }

  bar.innerHTML = visible.map((c, i) => `
    <span class="promo-chip" onclick="_promoFilter(${i})" data-chip="${i}">
      ${c.icon} ${c.label}
    </span>`).join('');

  // Guardar filtros para el onclick
  bar._chips = visible;
}

function _promoFilter(i) {
  const bar = document.getElementById('promoBar');
  if (bar && bar._chips && bar._chips[i]) {
    bar._chips[i].filter();
    // Resaltar el chip activo
    bar.querySelectorAll('.promo-chip').forEach((el, idx) => {
      el.classList.toggle('active', idx === i);
    });
  }
}

// ── Panel hover timeout ──
let _catNavTimer = null;

function renderQuickCats() {
  const bar = document.getElementById('quickCatsBar');
  const wrap = document.getElementById('quickCatsWrap');
  if (!bar) return;

  const available = [...new Set(products.map(p => p.cat).filter(Boolean))]
    .filter(cat => CAT_DISPLAY[cat]);

  if (!available.length) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = '';

  bar.innerHTML = available.map(cat => {
    const { label, emoji } = CAT_DISPLAY[cat];
    return `<div class="quick-cat" data-cat="${cat}"
      onmouseenter="openCatNav('${cat}', this)"
      onclick="filterCatalogByCat('${cat}')">${emoji}<span>${label}</span></div>`;
  }).join('');
}

// Abre el panel de navegación para una categoría
function openCatNav(cat, triggerEl) {
  clearTimeout(_catNavTimer);

  // Destacar el item activo
  document.querySelectorAll('.quick-cat').forEach(el => el.classList.remove('hovered'));
  if (triggerEl) triggerEl.classList.add('hovered');

  const panel = document.getElementById('catNavPanel');
  const subsEl = document.getElementById('catNavSubs');
  const prodsEl = document.getElementById('catNavProds');
  const footerEl = document.getElementById('catNavFooter');
  if (!panel) return;

  const d = dynamicMegaData[cat];
  if (!d) { panel.classList.remove('show'); return; }

  const subs = Object.keys(d.cols);

  // Subcategorías
  subsEl.innerHTML = subs.length
    ? subs.map(sub => `
        <div class="cat-nav-sub-item" data-cat="${cat}" data-sub="${sub}"
             onmouseenter="openSubNav('${cat}','${sub}',this)"
             onclick="filterCatalogBySubCat('${cat}','${sub}');event.stopPropagation()">
          ${sub}
          <span class="cat-nav-sub-count">${d.cols[sub].length}</span>
        </div>`).join('')
    : '<div style="padding:16px 18px;color:#aaa;font-size:13px">Sin subcategorías</div>';

  // Pie
  footerEl.innerHTML = `<span class="cat-nav-footer-link"
    onclick="filterCatalogByCat('${cat}')">
    Ver todos los productos de <strong>${d.title}</strong> →
  </span>`;

  panel.classList.add('show');

  // Mostrar primera subcategoría por defecto
  if (subs.length > 0) {
    const firstSub = subsEl.querySelector('.cat-nav-sub-item');
    if (firstSub) openSubNav(cat, subs[0], firstSub);
  } else {
    prodsEl.innerHTML = '<div class="cat-nav-prods-hint">Sin productos en subcategorías</div>';
  }
}

// Muestra productos de una subcategoría
function openSubNav(cat, sub, triggerEl) {
  clearTimeout(_catNavTimer);
  document.querySelectorAll('.cat-nav-sub-item').forEach(el => el.classList.remove('active'));
  if (triggerEl) triggerEl.classList.add('active');

  const d = dynamicMegaData[cat];
  if (!d || !d.cols[sub]) return;

  const prods = d.cols[sub];
  const prodsEl = document.getElementById('catNavProds');
  if (!prodsEl) return;

  const prodRows = prods.slice(0, 12).map(p => `
    <div class="cat-nav-prod-item" onclick="closeCatNav();showDetail('${p.id}')">
      <div class="cat-nav-prod-thumb">
        ${p.imageUrl
          ? `<img src="${p.imageUrl}" alt="" onerror="this.style.display='none'">`
          : `<span style="font-size:22px">${p.icon||'📦'}</span>`}
      </div>
      <div class="cat-nav-prod-info">
        <div class="cat-nav-prod-brand">${p.brand}</div>
        <div class="cat-nav-prod-name">${p.name}</div>
        <div class="cat-nav-prod-price">S/ ${p.price.toFixed(2)}</div>
      </div>
    </div>`).join('');

  prodsEl.innerHTML = `
    <div class="cat-nav-prods-title">${sub} <small style="font-size:11px;color:#aaa;font-weight:400">(${prods.length} productos)</small></div>
    <div class="cat-nav-prods-grid">${prodRows}</div>
    ${prods.length > 12 ? `<div class="cat-nav-more" onclick="filterCatalogBySubCat('${cat}','${sub}')">Ver todos (${prods.length}) →</div>` : ''}`;
}

function closeCatNav() {
  const panel = document.getElementById('catNavPanel');
  if (panel) panel.classList.remove('show');
  document.querySelectorAll('.quick-cat').forEach(el => el.classList.remove('hovered'));
}

function filterCatalogByCat(cat) {
  closeCatNav();
  filterState = { cat, sub: null, brands: [], maxPrice: null };
  showPage('catalog');
}

function filterCatalogBySubCat(cat, sub) {
  closeCatNav();
  filterState = { cat, sub, brands: [], maxPrice: null };
  showPage('catalog');
}

// ===== RENDER PRODUCTOS =====
function _prodImgHtml(p) {
  if (p.imageUrl) {
    return `<img src="${p.imageUrl}" alt="" class="prod-img-real" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="prod-img-icon" style="display:none;font-size:52px">${p.icon || '📦'}</span>`;
  }
  return `<span style="font-size:52px">${p.icon || '📦'}</span>`;
}

function renderProducts(list = products, containerId = 'productGrid') {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;color:#aaa;grid-column:1/-1"><div style="font-size:52px">📦</div><p style="margin-top:12px">No hay productos disponibles</p></div>';
    const el = document.getElementById('productCount');
    if (el) el.textContent = 0;
    return;
  }
  list.forEach(p => {
    const price = p.price || 0;
    const old   = p.old   || price;
    const disc  = old > price ? Math.round(((old - price) / old) * 100) : 0;
    const card  = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      ${disc > 0 ? `<div class="card-badge">-${disc}%</div>` : ''}
      ${Math.random() > 0.7 ? '<div class="ai-badge-card">🤖 IA Top</div>' : ''}
      <div class="product-img">${_prodImgHtml(p)}</div>
      <div class="product-card-body">
        <p class="prod-brand">${esc(p.brand || 'A&M')}</p>
        <h3>${esc(p.name)}</h3>
        <div class="price-divider"></div>
        <div class="price-row">
          <span class="price">S/ ${price.toFixed(2)}</span>
          ${disc > 0 ? `<span class="old-price">S/ ${old.toFixed(2)}</span><span class="discount-badge">-${disc}%</span>` : ''}
        </div>
        <div class="prod-tags">
          <span class="prod-tag green">✓ En stock</span>
          ${p.stock <= 5 ? `<span class="prod-tag" style="background:#fff3e0;color:#e65100">¡Últimas ${p.stock}!</span>` : '<span class="prod-tag">Retira hoy</span>'}
        </div>
        <button class="add-btn" onclick="addToCart('${p.id}');event.stopPropagation()">🛒 Agregar</button>
      </div>`;
    card.addEventListener('click', () => showDetail(p.id));
    grid.appendChild(card);
  });
  const el = document.getElementById('productCount');
  if (el) el.textContent = list.length;
}

function renderFeatured() { renderProducts(products.slice(0, 8), 'featuredGrid'); }

function renderRelated(currentProd) {
  const related = products.filter(p => p.id !== currentProd.id && p.cat === currentProd.cat);
  const grid = document.getElementById('relatedGrid');
  const section = document.getElementById('relatedSection');
  const title = document.getElementById('relatedTitle');

  if (!related.length || !grid) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = '';
  if (title) title.innerHTML = '⭐ Productos recomendados';

  // Fila horizontal de tarjetas compactas
  grid.className = 'related-row';
  grid.innerHTML = related.slice(0, 8).map(p => {
    const disc = p.old > p.price ? Math.round(((p.old - p.price) / p.old) * 100) : 0;
    const imgHtml = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="" onerror="this.style.display='none'">`
      : `<span style="font-size:32px">${p.icon||'📦'}</span>`;
    return `
      <div class="related-card" onclick="showDetail('${p.id}')">
        ${disc > 0 ? `<div class="related-card-disc">-${disc}%</div>` : ''}
        <div class="related-card-img">${imgHtml}</div>
        <div class="related-card-body">
          <div class="related-card-brand">${esc(p.brand)}</div>
          <div class="related-card-name">${esc(p.name)}</div>
          <div class="related-card-price">S/ ${p.price.toFixed(2)}</div>
          <button class="related-card-btn" onclick="addToCart('${p.id}');event.stopPropagation()">🛒 Agregar</button>
        </div>
      </div>`;
  }).join('');
}

// ===== CARRITO =====
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const ex = cart.find(x => x.id === id);
  if (ex) ex.qty++; else cart.push({...p, qty:1});
  renderCart(); renderCartPage(); updateCartCount();
  showToast(`🛒 ${p.name.slice(0,30)}... añadido`);
  openCartDrawer();
}
function changeQty(id, d) {
  const it = cart.find(p => p.id === id);
  if (!it) return;
  it.qty += d;
  if (it.qty <= 0) cart = cart.filter(p => p.id !== id);
  renderCart(); renderCartPage(); updateCartCount();
}
function removeItem(id) {
  cart = cart.filter(p => p.id !== id);
  renderCart(); renderCartPage(); updateCartCount();
}
function updateCartCount() {
  const t = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = t;
  document.getElementById('cartDrawerCount').textContent = `(${t} items)`;
}
function renderCart() {
  const c = document.getElementById('cartItems');
  if (!c) return;
  c.innerHTML = '';
  if (!cart.length) {
    c.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa"><div style="font-size:52px">🛒</div><p style="margin-top:12px">Tu carrito está vacío</p></div>';
    document.getElementById('cartTotal').textContent = 'S/ 0.00';
    return;
  }
  let total = 0;
  cart.forEach(it => {
    total += it.price * it.qty;
    const imgContent = it.imageUrl
      ? `<img src="${it.imageUrl}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:6px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none;font-size:28px">${it.icon||'📦'}</span>`
      : `<span style="font-size:28px">${it.icon||'📦'}</span>`;
    const d = document.createElement('div');
    d.className = 'drawer-item';
    d.innerHTML = `
      <div class="drawer-item-icon">${imgContent}</div>
      <div class="drawer-item-info">
        <div class="drawer-item-name">${esc(it.name.slice(0,38))}${it.name.length>38?'...':''}</div>
        <div class="drawer-item-brand">${esc(it.brand)}</div>
        <div class="drawer-item-price">S/ ${(it.price*it.qty).toFixed(2)}</div>
        <div class="drawer-item-controls">
          <button class="dqb" onclick="changeQty('${it.id}',-1)">-</button>
          <span style="font-weight:700;font-size:13px">${it.qty}</span>
          <button class="dqb" onclick="changeQty('${it.id}',1)">+</button>
          <button class="drm" onclick="removeItem('${it.id}')">🗑️</button>
        </div>
      </div>`;
    c.appendChild(d);
  });
  document.getElementById('cartTotal').textContent = `S/ ${total.toFixed(2)}`;
}
function renderCartPage() {
  const c = document.getElementById('cartPageItems');
  if (!c) return;
  c.innerHTML = '';
  if (!cart.length) {
    c.innerHTML = '<div style="text-align:center;padding:60px;color:#aaa"><div style="font-size:72px">🛒</div><p style="margin-top:16px;font-size:18px">Tu carrito está vacío</p><button class="btn-primary" style="margin-top:18px" onclick="showPage(\'catalog\')">Ver productos</button></div>';
    ['summarySubtotal','summaryDiscount','summaryTotal'].forEach(id => { const e = document.getElementById(id); if(e) e.textContent = id==='summaryDiscount'?'-S/ 0.00':'S/ 0.00'; });
    renderAIUpsell();
    return;
  }
  let sub = 0, orig = 0;
  cart.forEach(it => {
    sub += it.price * it.qty; orig += it.old * it.qty;
    const imgContent = it.imageUrl
      ? `<img src="${it.imageUrl}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none;font-size:36px">${it.icon||'📦'}</span>`
      : `<span style="font-size:36px">${it.icon||'📦'}</span>`;
    const d = document.createElement('div');
    d.className = 'cart-page-item';
    d.innerHTML = `
      <div class="item-icon">${imgContent}</div>
      <div class="item-info">
        <div class="item-brand">${esc(it.brand)}</div>
        <div class="item-name">${esc(it.name)}</div>
        <div style="color:#aaa;font-size:12px">S/ ${it.price.toFixed(2)} c/u</div>
      </div>
      <div class="item-actions">
        <button class="item-qty-btn" onclick="changeQty('${it.id}',-1)">-</button>
        <span class="item-qty">${it.qty}</span>
        <button class="item-qty-btn" onclick="changeQty('${it.id}',1)">+</button>
        <button class="item-remove" onclick="removeItem('${it.id}')">🗑️</button>
        <span class="item-subtotal">S/ ${(it.price*it.qty).toFixed(2)}</span>
      </div>`;
    c.appendChild(d);
  });
  const sav = orig - sub;
  document.getElementById('summarySubtotal').textContent = `S/ ${orig.toFixed(2)}`;
  document.getElementById('summaryDiscount').textContent = `-S/ ${sav.toFixed(2)}`;
  document.getElementById('summaryTotal').textContent = `S/ ${sub.toFixed(2)}`;
  renderAIUpsell();
}
function renderAIUpsell() {
  const c = document.getElementById('aiUpsellItems');
  if (!c) return;
  const notInCart = products.filter(p => !cart.find(i => i.id === p.id)).slice(0, 3);
  c.innerHTML = notInCart.map(p => `
    <div class="upsell-item" onclick="addToCart('${p.id}')">
      <div class="upsell-item-icon">${p.imageUrl ? `<img src="${p.imageUrl}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:4px">` : (p.icon||'📦')}</div>
      <div class="upsell-item-info">
        <div class="upsell-item-name">${p.name.slice(0,30)}${p.name.length>30?'...':''}</div>
        <div class="upsell-item-price">S/ ${p.price.toFixed(2)}</div>
      </div>
      <button class="upsell-add" onclick="addToCart('${p.id}');event.stopPropagation()">+ Agregar</button>
    </div>`).join('');
}

// ===== NAVEGACIÓN CON HISTORIAL =====
function showPage(id, pushState = true) {
  currentPage = id;
  savePageState();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${id}`);
  if (page) page.classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'catalog') applyFilters();
  if (id === 'cart') renderCartPage();
  // Cerrar drawer y overlay si están abiertos
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('show');
  if (pushState) {
    history.pushState({ page: id, productId: null }, '', `#${id}`);
  }
}

// Escuchar el botón atrás/adelante del navegador
window.addEventListener('popstate', (e) => {
  if (e.state) {
    if (e.state.page === 'detail' && e.state.productId) {
      showDetailInternal(e.state.productId);
    } else {
      showPage(e.state.page, false);
    }
  } else {
    showPage('home', false);
  }
});

// ===== DETALLE =====
function showDetail(id) {
  history.pushState({ page: 'detail', productId: id }, '', `#detail-${id}`);
  showDetailInternal(id);
}

function showDetailInternal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  currentDetailProduct = p;
  currentDetailQty = 1;
  currentPage = 'detail';
  const disc = p.old > p.price ? Math.round(((p.old - p.price) / p.old) * 100) : 0;
  document.getElementById('detailBrand').textContent = p.brand;
  document.getElementById('detailName').textContent = p.name;
  document.getElementById('detailSku').textContent = p.codigo || String(p.id).slice(0, 8).toUpperCase();
  document.getElementById('detailPrice').textContent = `S/ ${p.price.toFixed(2)}`;
  document.getElementById('detailOld').textContent = disc > 0 ? `S/ ${p.old.toFixed(2)}` : '';
  document.getElementById('detailDisc').textContent = disc > 0 ? `-${disc}%` : '';
  document.getElementById('detailQty').textContent = 1;

  // Badge de categoría
  const catInfo = CAT_DISPLAY[p.cat] || { label: p.cat, emoji: '📦' };
  const catBadge = document.getElementById('detailCatBadge');
  if (catBadge) catBadge.textContent = `${catInfo.emoji} ${catInfo.label}`;

  // Stock indicator
  const stockEl = document.getElementById('detailStockRow');
  if (stockEl) {
    if (p.stock > 5) {
      stockEl.innerHTML = `<span class="detail-stock-ok">✓ En stock</span><span style="color:#aaa;font-size:12px">(${p.stock} disponibles)</span>`;
    } else if (p.stock > 0) {
      stockEl.innerHTML = `<span class="detail-stock-low">⚠️ ¡Últimas ${p.stock} unidades!</span>`;
    } else {
      stockEl.innerHTML = `<span class="detail-stock-out">✗ Sin stock</span>`;
    }
  }

  // Imagen principal
  const mainImgEl = document.getElementById('detailMainImg');
  if (p.imageUrl) {
    mainImgEl.innerHTML = `<img src="${p.imageUrl}" alt="${p.name}" onerror="this.outerHTML='<span style=font-size:110px>${p.icon||'📦'}</span>'">`;
  } else {
    mainImgEl.innerHTML = `<span style="font-size:110px">${p.icon || '📦'}</span>`;
  }

  document.getElementById('detailDesc').textContent = p.info || `${p.name} — producto de alta calidad de la marca ${p.brand}.`;
  document.getElementById('btnAddDetail').onclick = () => addToCart(p.id);
  generateAIReview(p);

  // Miniaturas
  const thumbs = document.getElementById('detailThumbs');
  thumbs.innerHTML = '';
  const thumbContent = p.imageUrl
    ? `<img src="${p.imageUrl}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:6px">`
    : p.icon || '📦';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = `thumb-img ${i === 0 ? 'active' : ''}`;
    d.innerHTML = thumbContent;
    d.onclick = () => { thumbs.querySelectorAll('.thumb-img').forEach(x => x.classList.remove('active')); d.classList.add('active'); };
    thumbs.appendChild(d);
  }

  renderRelated(p);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-detail').classList.add('active');
  window.scrollTo(0, 0);
}
function changeDetailQty(d) {
  currentDetailQty = Math.max(1, currentDetailQty + d);
  document.getElementById('detailQty').textContent = currentDetailQty;
}

// ===== DASHBOARD =====
function openDashboard() {
  document.getElementById('dashboardModal').classList.add('show');
  renderDashboard(currentDashboardPlan);
}

function switchDashboardPlan(plan) {
  currentDashboardPlan = plan;
  ['basico','pro','premium'].forEach(p => {
    const btn = document.getElementById(`planBtn${p.charAt(0).toUpperCase()+p.slice(1)}`);
    if (btn) btn.classList.toggle('active', p === plan);
  });
  renderDashboard(plan);
}

function renderDashboard(plan) {
  const planData = PLANS[plan];
  const body = document.getElementById('dashboardBody');
  const infoBar = document.getElementById('planInfoBar');

  infoBar.innerHTML = `
    <span class="plan-info-badge ${plan}">${planData.label}</span>
    <span class="plan-info-text">Este plan incluye</span>
    <span class="plan-info-modules">${planData.count} módulos activos</span>
    ${plan==='pro'?`<span class="plan-info-text">· +${PLAN_PRO_NEW.length} módulos Pro sobre el Básico</span>`:''}
    ${plan==='premium'?`<span class="plan-info-text">· +${PLAN_PREMIUM_NEW.length} módulos Premium sobre Pro</span>`:''}
  `;

  const kpis = [
    {icon:'💰',label:'Ventas del día',value:'S/ 4,580',trend:'+12%',type:'up',bar:72},
    {icon:'📦',label:'Pedidos pendientes',value:'24',trend:'Revisar',type:'warn',bar:45},
    {icon:'🗄️',label:'Productos en stock',value:'1,240',trend:'Activos',type:'up',bar:88},
    {icon:'👥',label:'Clientes registrados',value:'320',trend:'+8 hoy',type:'up',bar:60},
  ];
  const proKpis = [
    {icon:'📈',label:'Conversión',value:'4.8%',trend:'+0.3%',type:'up',bar:48},
    {icon:'🏆',label:'Ticket promedio',value:'S/ 89',trend:'+S/5',type:'up',bar:65},
  ];
  const premiumKpis = [
    {icon:'🤖',label:'IA Predicción',value:'92%',trend:'Óptimo',type:'up',bar:92},
    {icon:'🛡️',label:'Seguridad',value:'AAA',trend:'Seguro',type:'up',bar:100},
  ];

  let allKpis = [...kpis];
  let cols = 4;
  if (plan === 'pro' || plan === 'premium') { allKpis = [...kpis,...proKpis]; cols = 6; }
  if (plan === 'premium') { allKpis = [...allKpis,...premiumKpis]; cols = 8; }

  const kpiCols = Math.min(cols, allKpis.length);
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul'];
  const valores = [3200,4100,3800,5200,4580,6100,5800];

  let html = `
    <div class="db-kpis" style="grid-template-columns:repeat(${kpiCols},1fr)">
      ${allKpis.map(k => `
        <div class="db-kpi-card">
          <div class="db-kpi-header">
            <span class="db-kpi-icon">${k.icon}</span>
            <span class="db-kpi-trend ${k.type}">${k.trend}</span>
          </div>
          <div class="db-kpi-value">${k.value}</div>
          <div class="db-kpi-label">${k.label}</div>
          <div class="db-kpi-bar"><div class="db-kpi-bar-fill" style="width:${k.bar}%"></div></div>
        </div>`).join('')}
    </div>
    <div class="db-two-col">
      <div class="db-card">
        <div class="db-section-title">📊 Ventas por mes <span class="db-badge">BÁSICO</span></div>
        <div class="db-chart-bars">
          ${meses.map((m,i)=>`
            <div class="db-bar-group">
              <div class="db-bar-val">S/${Math.round(valores[i]/100)}00</div>
              <div class="db-bar" style="height:${Math.round((valores[i]/6100)*100)}%"></div>
              <div class="db-bar-label">${m}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="db-card">
        <div class="db-section-title">📦 Pedidos recientes <span class="db-badge">BÁSICO</span></div>
        <table class="db-table">
          <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>
            <tr><td>#2341</td><td>María R.</td><td>S/ 89.90</td><td><span class="db-status active">Entregado</span></td></tr>
            <tr><td>#2340</td><td>Carlos M.</td><td>S/ 249.00</td><td><span class="db-status process">En camino</span></td></tr>
            <tr><td>#2339</td><td>Ana G.</td><td>S/ 45.50</td><td><span class="db-status pending">Pendiente</span></td></tr>
            <tr><td>#2338</td><td>Luis T.</td><td>S/ 169.00</td><td><span class="db-status active">Entregado</span></td></tr>
            <tr><td>#2337</td><td>Rosa P.</td><td>S/ 320.00</td><td><span class="db-status process">En camino</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  if (plan === 'pro' || plan === 'premium') {
    html += `
      <div class="db-two-col">
        <div class="db-card">
          <div class="db-section-title">👥 CRM - Mejores clientes <span class="db-badge" style="background:rgba(232,158,72,.2);color:#E89E48">PRO</span></div>
          <table class="db-table">
            <thead><tr><th>Cliente</th><th>Compras</th><th>Total</th><th>Segmento</th></tr></thead>
            <tbody>
              <tr><td>María R.</td><td>12</td><td>S/ 1,890</td><td><span class="db-status active">VIP</span></td></tr>
              <tr><td>Carlos M.</td><td>8</td><td>S/ 1,240</td><td><span class="db-status active">Gold</span></td></tr>
              <tr><td>Ana García</td><td>5</td><td>S/ 780</td><td><span class="db-status process">Silver</span></td></tr>
              <tr><td>Luis T.</td><td>3</td><td>S/ 420</td><td><span class="db-status pending">Regular</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="db-card">
          <div class="db-section-title">📉 Inventario crítico <span class="db-badge" style="background:rgba(232,158,72,.2);color:#E89E48">PRO</span></div>
          <table class="db-table">
            <thead><tr><th>Producto</th><th>Stock</th><th>Estado</th></tr></thead>
            <tbody>
              <tr><td>Lejía Sapolio 4.8kg</td><td>12 uds</td><td><span class="db-status pending">⚠️ Bajo</span></td></tr>
              <tr><td>Foco LED Philips x4</td><td>3 uds</td><td><span class="db-status" style="background:rgba(204,0,0,.2);color:#cc0000">🔴 Crítico</span></td></tr>
              <tr><td>Taladro Stanley</td><td>28 uds</td><td><span class="db-status active">✅ OK</span></td></tr>
              <tr><td>Cinta 3M 48mm</td><td>56 uds</td><td><span class="db-status active">✅ OK</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="db-card">
        <div class="db-section-title">🗺️ Tracking logístico en tiempo real <span class="db-badge" style="background:rgba(232,158,72,.2);color:#E89E48">PRO</span></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:10px">
          ${['Lima Centro','Miraflores','San Isidro','Surco'].map((z,i)=>`
            <div style="background:#21262d;border-radius:10px;padding:14px;text-align:center;border:1px solid #30363d">
              <div style="font-size:24px">📍</div>
              <div style="color:white;font-size:12px;font-weight:700;margin:6px 0">${z}</div>
              <div style="color:#E89E48;font-size:18px;font-family:var(--font-head);font-weight:800">${[8,14,6,11][i]} pedidos</div>
              <div style="color:#8b949e;font-size:10px">en ruta</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  if (plan === 'premium') {
    html += `
      <div class="db-ai-section">
        <div class="db-ai-title">🤖 Motor de Inteligencia Artificial <span>PREMIUM</span></div>
        <div class="db-ai-grid">
          <div class="db-ai-card">
            <div class="db-ai-card-icon">🧠</div>
            <div class="db-ai-card-title">Predicción de ventas</div>
            <div class="db-ai-card-val">S/ 6,240</div>
            <div style="color:#8b949e;font-size:10px;margin-top:4px">Próximos 7 días (92% confianza)</div>
          </div>
          <div class="db-ai-card">
            <div class="db-ai-card-icon">🎯</div>
            <div class="db-ai-card-title">Tasa de conversión IA</div>
            <div class="db-ai-card-val">6.8%</div>
            <div style="color:#8b949e;font-size:10px;margin-top:4px">+2% sobre promedio</div>
          </div>
          <div class="db-ai-card">
            <div class="db-ai-card-icon">👤</div>
            <div class="db-ai-card-title">Clientes en riesgo</div>
            <div class="db-ai-card-val">7</div>
            <div style="color:#8b949e;font-size:10px;margin-top:4px">IA identificó posible churn</div>
          </div>
        </div>
      </div>
      <div class="db-two-col">
        <div class="db-card">
          <div class="db-section-title">🗺️ Heatmap de actividad <span class="db-badge" style="background:rgba(123,47,247,.2);color:#7b2ff7">PREMIUM</span></div>
          <div style="color:#8b949e;font-size:11px;margin-bottom:10px">Actividad por hora del día (últimos 7 días)</div>
          <div class="db-heatmap">
            ${['L','M','M','J','V','S','D'].map(d=>`<div style="color:#8b949e;font-size:9px;text-align:center">${d}</div>`).join('')}
            ${Array.from({length:49},(_,i)=>{
              const v=Math.random();const alpha=(0.1+v*0.9).toFixed(2);
              return `<div class="hm-cell" style="background:rgba(123,47,247,${alpha})">${v>0.8?'🔥':''}</div>`;
            }).join('')}
          </div>
        </div>
        <div class="db-card">
          <div class="db-section-title">⚙️ Automatización RPA <span class="db-badge" style="background:rgba(123,47,247,.2);color:#7b2ff7">PREMIUM</span></div>
          ${[
            {name:'Actualización de precios',runs:'1,240 veces',status:'active'},
            {name:'Notificaciones de stock',runs:'340 veces',status:'active'},
            {name:'Reportes automáticos',runs:'28 veces',status:'active'},
            {name:'Sincronización API',runs:'8,900 veces',status:'process'},
          ].map(r=>`
            <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #21262d">
              <span style="font-size:18px">🤖</span>
              <div style="flex:1">
                <div style="color:#e6edf3;font-size:12px;font-weight:600">${r.name}</div>
                <div style="color:#8b949e;font-size:10px">${r.runs} ejecutado</div>
              </div>
              <span class="db-status ${r.status}">Activo</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  html += `
    <div class="db-card">
      <div class="db-section-title">🔧 Módulos activos en este plan (${planData.count}) <span class="db-badge">${planData.label}</span></div>
      <div class="db-modules-grid" style="grid-template-columns:repeat(${plan==='basico'?2:3},1fr)">
        ${planData.modules.map(m => {
          const isNew = plan==='pro' && PLAN_PRO_NEW.includes(m);
          const isPremNew = plan==='premium' && PLAN_PREMIUM_NEW.includes(m);
          const badgeTier = isPremNew ? 'premium' : (isNew ? 'pro' : 'basic');
          const badgeLabel = isPremNew ? 'PREMIUM' : (isNew ? 'PRO' : 'BÁSICO');
          return `
            <div class="db-module-item">
              <div class="db-module-icon">${m.icon}</div>
              <div class="db-module-info">
                <div class="db-module-name">${m.name}</div>
                <div class="db-module-desc">${m.desc.slice(0,50)}${m.desc.length>50?'...':''}</div>
              </div>
              <span class="db-module-badge ${badgeTier}">${badgeLabel}</span>
              <div class="db-module-status"></div>
            </div>`; }).join('')}
      </div>
    </div>`;

  body.innerHTML = html;
}

// ===== MODAL PLANES =====
function openPlansModal(tab = 'basico') {
  document.getElementById('plansModal').classList.add('show');
  switchPlanTab(tab);
}
function switchPlanTab(tab) {
  currentPlanTab = tab;
  ['basico','pro','premium'].forEach(p => {
    document.getElementById(`ptab-${p}`)?.classList.toggle('active', p === tab);
  });
  renderPlanDetail(tab);
}
function renderPlanDetail(plan) {
  const data = PLANS[plan];
  const c = document.getElementById('planDetailContent');
  const colors = {basico:'#27ae60',pro:'#E89E48',premium:'#7b2ff7'};
  let html = `
    <div class="plan-detail-header">
      <span class="plan-detail-icon">${data.icon}</span>
      <div>
        <div class="plan-detail-title" style="color:${colors[plan]}">${data.label}</div>
        <div class="plan-detail-desc">${data.count} módulos activos · ${plan==='basico'?'Ideal para iniciar':''}${plan==='pro'?'Incluye todo el plan Básico + módulos avanzados':''}${plan==='premium'?'Todo lo anterior + tecnología de IA y seguridad avanzada':''}</div>
      </div>
    </div>`;
  if (plan === 'pro') {
    html += `<div class="plan-includes-label">✅ Incluye todo el plan BÁSICO (${PLAN_BASICO.length} módulos)</div><div class="plan-modules-grid">`;
    PLAN_BASICO.forEach(m => { html += `<div class="plan-module-item"><div class="plan-module-icon">${m.icon}</div><div class="plan-module-text"><h4>${m.name}</h4><p>${m.desc}</p></div></div>`; });
    html += `</div><div class="plan-includes-label">⚡ Nuevos en plan PRO (${PLAN_PRO_NEW.length} módulos)</div><div class="plan-modules-grid">`;
    PLAN_PRO_NEW.forEach(m => { html += `<div class="plan-module-item is-new"><div class="plan-module-icon">${m.icon}</div><div class="plan-module-text"><h4>${m.name} <span class="plan-new-tag">NUEVO</span></h4><p>${m.desc}</p></div></div>`; });
    html += `</div>`;
  } else if (plan === 'premium') {
    html += `<div class="plan-includes-label">✅ Incluye todo BÁSICO + PRO (${PLAN_BASICO.length + PLAN_PRO_NEW.length} módulos)</div><div class="plan-modules-grid">`;
    [...PLAN_BASICO,...PLAN_PRO_NEW].forEach(m => { html += `<div class="plan-module-item"><div class="plan-module-icon">${m.icon}</div><div class="plan-module-text"><h4>${m.name}</h4><p>${m.desc}</p></div></div>`; });
    html += `</div><div class="plan-includes-label">👑 Nuevos en plan PREMIUM (${PLAN_PREMIUM_NEW.length} módulos)</div><div class="plan-modules-grid">`;
    PLAN_PREMIUM_NEW.forEach(m => { html += `<div class="plan-module-item is-premium-new"><div class="plan-module-icon">${m.icon}</div><div class="plan-module-text"><h4>${m.name} <span class="plan-new-tag prem">PREMIUM</span></h4><p>${m.desc}</p></div></div>`; });
    html += `</div>`;
  } else {
    html += `<div class="plan-modules-grid">`;
    PLAN_BASICO.forEach(m => { html += `<div class="plan-module-item"><div class="plan-module-icon">${m.icon}</div><div class="plan-module-text"><h4>${m.name}</h4><p>${m.desc}</p></div></div>`; });
    html += `</div>`;
  }
  c.innerHTML = html;
}

function renderPlanPreviews() {
  const previews = {
    basicPreview: PLAN_BASICO.slice(0,5),
    proPreview: PLAN_PRO_NEW.slice(0,5),
    premiumPreview: PLAN_PREMIUM_NEW.slice(0,5)
  };
  Object.entries(previews).forEach(([id, list]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = list.map(m => `<li>${m.icon} ${m.name}</li>`).join('');
  });
}

// ===== AI FEATURES =====
const aiReviews = [
  "⭐ Excelente calidad-precio. La IA detectó alta satisfacción en clientes similares a tu perfil.",
  "🔥 Producto trending. 87% de compradores lo recomiendan según análisis de reseñas.",
  "💡 Ideal para tu historial de compras. Complementa perfectamente productos que ya tienes.",
  "🏆 Mejor vendido de su categoría. IA predice stock limitado, te sugerimos comprar pronto.",
  "✅ Precio óptimo detectado. La IA monitorea precios en tiempo real: este es el mejor momento para comprar."
];
function generateAIReview(product) {
  const el = document.getElementById('aiReviewText');
  if (!el) return;
  el.textContent = 'Analizando producto...';
  setTimeout(() => { el.textContent = aiReviews[Math.floor(Math.random() * aiReviews.length)]; }, 800);
}
function refreshAIRecs() {
  const container = document.getElementById('aiRecsHome');
  if (!container) return;
  if (!products.length) { container.innerHTML = '<div style="color:#aaa;font-size:13px;padding:12px">Cargando productos...</div>'; return; }
  const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, 5);
  container.innerHTML = shuffled.map(p => `
    <div class="ai-rec-card" onclick="showDetail('${p.id}')">
      <div class="ai-rec-img">
        ${p.imageUrl
          ? `<img src="${p.imageUrl}" alt="${p.name.replace(/"/g,'')}" onerror="this.parentNode.innerHTML='<span style=font-size:36px>${p.icon||'📦'}</span>'">`
          : `<span style="font-size:36px">${p.icon||'📦'}</span>`}
      </div>
      <div class="ai-rec-info">
        <div class="ai-rec-name">${esc(p.name)}</div>
        <div class="ai-rec-price">S/ ${p.price.toFixed(2)}</div>
      </div>
    </div>`).join('');
}
function applyAIFilter() {
  const query = document.getElementById('aiFilterInput').value.toLowerCase();
  if (!query.trim()) return;
  const keywords = {limpieza:['limpiar','lejía','detergente','desinfectar','lavar'],herramientas:['taladro','tornillo','llave','martillo','construir'],iluminacion:['luz','foco','led','iluminar','lámpara'],ferreteria:['puerta','cerradura','silicona']};
  let filtered = [...products];
  for(const [cat, words] of Object.entries(keywords)){
    if(words.some(w => query.includes(w))) { filtered = products.filter(p => p.cat === cat); break; }
  }
  if (!filtered.length) filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query));
  if (!filtered.length) filtered = products.slice(0,4);
  renderProducts(filtered);
  showToast(`🤖 IA encontró ${filtered.length} productos para "${query.slice(0,20)}"`);
}
function getAIRecommendations() {
  const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, 6);
  renderProducts(shuffled);
  showToast('🤖 IA actualizó recomendaciones para ti');
}
function triggerAISearch() {
  const val = document.getElementById('searchInput').value;
  if (!val.trim()) { openAIAssistant(); return; }
  handleSearch(val);
}
function openAIAssistant() {
  document.getElementById('aiAssistantModal').classList.add('show');
  document.getElementById('aiResults').innerHTML = '';
}
function runAISearch() {
  const query = document.getElementById('aiSearchQuery').value;
  if (!query.trim()) return;
  const el = document.getElementById('aiResults');
  el.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px">🤖 Analizando tu consulta...</div>';
  setTimeout(() => {
    const filtered = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.brand.toLowerCase().includes(query.toLowerCase()));
    const results = filtered.length ? filtered : products.sort(() => Math.random() - 0.5).slice(0,3);
    el.innerHTML = results.slice(0,6).map(p => `
      <div class="product-card" onclick="document.getElementById('aiAssistantModal').classList.remove('show');showDetail('${p.id}')">
        <div class="product-img">${p.imageUrl ? `<img src="${p.imageUrl}" alt="" style="width:80%;height:80%;object-fit:contain;border-radius:8px">` : `<span style="font-size:52px">${p.icon||'📦'}</span>`}</div>
        <p class="prod-brand">${p.brand}</p>
        <h3>${p.name}</h3>
        <div class="price-row"><span class="price">S/ ${p.price.toFixed(2)}</span></div>
        <button class="add-btn" onclick="addToCart('${p.id}');event.stopPropagation()">+ Agregar</button>
      </div>`).join('');
    if (!results.length) el.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px">No encontré productos. Intenta con otras palabras.</div>';
  }, 1200);
}

// ===== BUSCADOR =====
function handleSearch(text) {
  const dd = document.getElementById('searchDropdown');
  if (!text.trim()) { dd.classList.remove('show'); return; }
  const filtered = products.filter(p => p.name.toLowerCase().includes(text.toLowerCase()) || p.brand.toLowerCase().includes(text.toLowerCase()));
  if (!filtered.length) { dd.classList.remove('show'); return; }
  dd.innerHTML = '';
  filtered.slice(0, 6).forEach(p => {
    const item = document.createElement('div');
    item.className = 'search-item';
    const thumbHtml = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="" class="search-item-img" onerror="this.outerHTML='<span style=font-size:20px>${p.icon||'📦'}</span>'">`
      : `<span style="font-size:20px">${p.icon||'📦'}</span>`;
    item.innerHTML = `
      <div class="search-item-thumb">${thumbHtml}</div>
      <div class="search-item-info">
        <div class="search-item-name">${p.name}</div>
        <div class="search-item-meta">${p.brand} · <span style="color:var(--orange);font-weight:700">S/ ${p.price.toFixed(2)}</span></div>
      </div>`;
    item.addEventListener('click', () => {
      showDetail(p.id);
      dd.classList.remove('show');
      document.getElementById('searchInput').value = '';
    });
    dd.appendChild(item);
  });
  const all = document.createElement('div');
  all.className = 'search-item search-item-all';
  all.innerHTML = `<span style="font-size:16px">🔍</span><span>Ver todos para <b>"${text}"</b> (${filtered.length})</span>`;
  all.addEventListener('click', () => { renderProducts(filtered); showPage('catalog'); dd.classList.remove('show'); document.getElementById('searchInput').value = ''; });
  dd.appendChild(all);
  dd.classList.add('show');
}

// ===== BANNER =====
function changeBanner(dir) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.dot');
  slides[currentBanner].classList.remove('active');
  dots[currentBanner].classList.remove('active');
  currentBanner = (currentBanner + dir + totalBanners) % totalBanners;
  slides[currentBanner].classList.add('active');
  dots[currentBanner].classList.add('active');
}
setInterval(() => changeBanner(1), 5000);

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== SISTEMA DE USUARIOS (conectado a Neon DB) =====
function getCurrentUser() { return API.customers.getUser(); }

// ── Enmascarado de datos personales ──
function maskName(fullName) {
  if (!fullName) return '—';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  // Con 4+ palabras la segunda es segundo nombre → solo inicial
  if (parts.length >= 4) {
    const first    = parts[0];
    const second   = parts[1][0] + '.';
    const surnames = parts.slice(2).map(s => s.slice(0, 2) + '*****');
    return [first, second, ...surnames].join(' ');
  }
  // Con 2 o 3 palabras: primer nombre completo + apellidos enmascarados
  const first    = parts[0];
  const surnames = parts.slice(1).map(s => s.slice(0, 2) + '*****');
  return [first, ...surnames].join(' ');
}

function maskPhone(phone) {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 2) return phone;
  return '*'.repeat(digits.length - 2) + digits.slice(-2);
}

function updateHeaderUser() {
  const user = getCurrentUser();
  const loggedOut  = document.getElementById('menuLoggedOut');
  const loggedIn   = document.getElementById('menuLoggedIn');
  const headerName = document.getElementById('headerUserName');
  const menuName   = document.getElementById('menuUserName');
  if (user) {
    loggedOut.style.display = 'none';
    loggedIn.style.display  = 'block';
    headerName.textContent  = user.name.split(' ')[0]; // solo primer nombre en header
    menuName.textContent    = '👋 ' + maskName(user.name); // nombre enmascarado en menú
  } else {
    loggedOut.style.display = 'block';
    loggedIn.style.display  = 'none';
    headerName.textContent  = 'inicia sesión';
  }
}

function openAccountWhatsApp() {
  const num = window.WHATSAPP_NUMBER || '51999999999';
  window.open(`https://wa.me/${num}?text=Hola,%20tengo%20un%20problema%20con%20mi%20cuenta%20en%20A%26M%20Importaciones`, '_blank');
}

// ── Variables de estado del auth modal ──
let _authDocType = '';
let _authDocNum  = '';

function authGoStep1() {
  document.getElementById('authStep1').style.display = '';
  document.getElementById('authStep2').style.display = 'none';
  document.getElementById('authError1').style.display = 'none';
}

async function handleAuthCheck() {
  const docType = document.getElementById('authDocType').value;
  const docNum  = document.getElementById('authDocNum').value.trim();
  const errEl   = document.getElementById('authError1');
  errEl.style.display = 'none';
  if (!docType)  { errEl.textContent = '⚠️ Selecciona el tipo de documento'; errEl.style.display = 'block'; return; }
  if (!docNum)   { errEl.textContent = '⚠️ Ingresa tu número de documento';  errEl.style.display = 'block'; return; }

  try {
    const data = await API.customers.login(docType, docNum);
    // Documento encontrado → login directo
    API.customers.setSession(data.token, {
      name: data.name, email: data.email,
      phone: data.phone || '', address: data.address || '', district: data.district || '',
    });
    updateHeaderUser();
    closeModal('loginModal');
    showToast('✅ ¡Bienvenido de vuelta, ' + data.name.split(' ')[0] + '!');
  } catch (err) {
    if (err.message && err.message.includes('no registrado') || err.message.includes('404') || err.message.includes('notFound')) {
      // Documento no existe → mostrar paso 2 (registro)
      _authDocType = docType;
      _authDocNum  = docNum;
      const docLabel = { DNI: 'DNI', CE: 'Carnet de extranjería', Pasaporte: 'Pasaporte', RUC: 'RUC' };
      document.getElementById('authDocInfo').textContent =
        `📄 ${docLabel[docType] || docType}: ${docNum}`;
      document.getElementById('authStep1').style.display = 'none';
      document.getElementById('authStep2').style.display = '';
      document.getElementById('authError2').style.display = 'none';
      document.getElementById('regFirstName').value = '';
      document.getElementById('regLastName').value  = '';
      document.getElementById('regEmail').value     = '';
      document.getElementById('regPhone').value     = '';
    } else {
      errEl.textContent = '⚠️ ' + err.message;
      errEl.style.display = 'block';
    }
  }
}

async function handleRegister() {
  const firstName = document.getElementById('regFirstName').value.trim();
  const lastName  = document.getElementById('regLastName').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const phone     = document.getElementById('regPhone').value.trim();
  const errEl     = document.getElementById('authError2');
  errEl.style.display = 'none';
  if (!firstName) { errEl.textContent = '⚠️ El nombre es obligatorio';             errEl.style.display = 'block'; return; }
  if (!lastName)  { errEl.textContent = '⚠️ Los apellidos son obligatorios';        errEl.style.display = 'block'; return; }
  if (!email)     { errEl.textContent = '⚠️ El correo electrónico es obligatorio';  errEl.style.display = 'block'; return; }
  try {
    const data = await API.customers.register({
      doc_type: _authDocType, doc_number: _authDocNum,
      first_name: firstName, last_name: lastName, email, phone,
    });
    API.customers.setSession(data.token, {
      name: data.name, email: data.email, phone: phone || '', address: '', district: '',
    });
    updateHeaderUser();
    closeModal('loginModal');
    showToast('✅ ¡Cuenta creada! Bienvenido, ' + data.name.split(' ')[0] + '!');
  } catch (err) {
    errEl.textContent = '⚠️ ' + err.message;
    errEl.style.display = 'block';
  }
}

function handleLogout() {
  API.customers.clearSession();
  updateHeaderUser();
  document.getElementById('accountMenu').classList.remove('show');
  showToast('👋 Sesión cerrada correctamente');
}

function switchToLogin() {
  authGoStep1();
  document.getElementById('loginModal').classList.add('show');
}
function switchToRegister() {
  document.getElementById('loginModal').classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  if (id === 'loginModal') resetAuthModal();
}

function resetAuthModal() {
  // Volver al paso 1
  const s1 = document.getElementById('authStep1');
  const s2 = document.getElementById('authStep2');
  if (s1) s1.style.display = '';
  if (s2) s2.style.display = 'none';
  // Limpiar campos del paso 1
  const docType = document.getElementById('authDocType');
  const docNum  = document.getElementById('authDocNum');
  const err1    = document.getElementById('authError1');
  if (docType) docType.value = '';
  if (docNum)  docNum.value  = '';
  if (err1)    err1.style.display = 'none';
  // Limpiar campos del paso 2 (registro)
  ['regFirstName','regLastName','regEmail','regPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const err2 = document.getElementById('authError2');
  if (err2) err2.style.display = 'none';
  // Limpiar estado interno
  _authDocType = '';
  _authDocNum  = '';
}

// ===== MODALES DE CUENTA =====
function requireLogin(callback) {
  if (!API.customers.isLogged()) {
    showToast('⚠️ Debes iniciar sesión primero');
    document.getElementById('loginModal').classList.add('show');
    return false;
  }
  callback();
  return true;
}

function showProfileModal() {
  requireLogin(async () => {
    let user = getCurrentUser();
    try { user = await API.customers.me(); API.customers.setSession(API.customers.getToken(), user); } catch {}
    // Nombre: enmascarado
    document.getElementById('profileNameDisplay').textContent  = maskName(user.name || '—');
    // Email: completo
    document.getElementById('profileEmailDisplay').textContent = user.email || '—';
    // Teléfono: solo últimos 2 dígitos
    document.getElementById('profilePhoneDisplay').textContent = user.phone ? maskPhone(user.phone) : '—';
    // Avatar: iniciales del primer nombre
    const initials = (user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('accountMenu').classList.remove('show');
    document.getElementById('profileModal').classList.add('show');
  });
}

// ===== MIS PEDIDOS - MODAL COMPLETO =====
const DEMO_ORDERS = [
  {
    id:'AM-2025-0041', date:'10 May 2025, 14:32', status:'envio',
    voucher:'VCH-E89E48-041', payMethod:'Yape', address:'Av. Arequipa 1234, Miraflores',
    items:[
      {icon:'🧴',name:'Lejía Sapolio Original 4.8 Kg',brand:'SAPOLIO',qty:3,price:10.9,old:16.9,sku:'FRR-00001'},
      {icon:'🧼',name:'Lejía Clorox Tradicional 2 Kg',brand:'CLOROX',qty:2,price:6.5,old:8.9,sku:'FRR-00003'},
    ],
    tracking:[
      {done:true,date:'10 May, 14:32'},{done:true,date:'10 May, 15:10'},
      {done:true,date:'10 May, 16:45'},{done:false,active:true,date:'En camino'},{done:false,date:''}
    ]
  },
  {
    id:'AM-2025-0038', date:'08 May 2025, 09:15', status:'entregado',
    voucher:'VCH-E89E48-038', payMethod:'Visa', address:'Jr. Huallaga 456, Lima Centro',
    items:[
      {icon:'🔧',name:'Taladro percutor eléctrico 750W',brand:'STANLEY',qty:1,price:249.0,old:320.0,sku:'FRR-00009'},
    ],
    tracking:[
      {done:true,date:'08 May, 09:15'},{done:true,date:'08 May, 10:00'},
      {done:true,date:'08 May, 11:20'},{done:true,date:'08 May, 13:00'},{done:true,date:'08 May, 17:30'}
    ]
  },
  {
    id:'AM-2025-0035', date:'05 May 2025, 11:00', status:'cancelado',
    alert:'cancelado', alertMsg:'Pedido cancelado por el cliente.',
    voucher:'VCH-E89E48-035', payMethod:'Mastercard', address:'Calle Las Flores 789, Surco',
    items:[
      {icon:'🚪',name:'Puerta Decor 40mm 65x207cm',brand:'DIMFER',qty:1,price:199.9,old:249.0,sku:'FRR-00006'},
    ],
    tracking:[
      {done:true,date:'05 May, 11:00'},{done:false,cancelled:true,date:'Cancelado'},
      {done:false,date:''},{done:false,date:''},{done:false,date:''}
    ]
  },
  {
    id:'AM-2025-0031', date:'01 May 2025, 16:20', status:'sinstock',
    alert:'sinstock', alertMsg:'Producto sin stock temporalmente. Nos contactaremos contigo pronto.',
    voucher:'VCH-E89E48-031', payMethod:'Plin', address:'Av. La Marina 567, San Miguel',
    items:[
      {icon:'💡',name:'Foco LED 9W luz cálida E27 pack x4',brand:'PHILIPS',qty:5,price:28.9,old:39.0,sku:'FRR-00011'},
    ],
    tracking:[
      {done:true,date:'01 May, 16:20'},{done:false,active:true,date:'Verificando stock'},
      {done:false,date:''},{done:false,date:''},{done:false,date:''}
    ]
  },
  {
    id:'AM-2025-0028', date:'28 Abr 2025, 10:05', status:'observado',
    alert:'observado', alertMsg:'Pedido observado: datos de dirección incompletos. Comunícate con nosotros.',
    voucher:'VCH-E89E48-028', payMethod:'Yape', address:'—',
    items:[
      {icon:'🔐',name:'Cerradura digital inteligente con huella',brand:'DIMFER',qty:1,price:169.0,old:220.0,sku:'FRR-00008'},
      {icon:'📦',name:'Cinta de embalaje transparente 48mm x50m',brand:'3M',qty:4,price:8.5,old:12.0,sku:'FRR-00012'},
    ],
    tracking:[
      {done:true,date:'28 Abr, 10:05'},{done:false,active:true,date:'En revisión'},
      {done:false,date:''},{done:false,date:''},{done:false,date:''}
    ]
  },
  {
    id:'AM-2025-0020', date:'20 Abr 2025, 09:00', status:'entregado',
    voucher:'VCH-E89E48-020', payMethod:'Visa', address:'Av. Benavides 890, Miraflores',
    items:[
      {icon:'🔩',name:'Juego de llaves mixtas 12 piezas',brand:'TRUPER',qty:2,price:89.0,old:120.0,sku:'FRR-00010'},
      {icon:'🧪',name:'Silicona para vidrios transparente 280ml',brand:'SIKA',qty:3,price:15.9,old:20.0,sku:'FRR-00005'},
    ],
    tracking:[
      {done:true,date:'20 Abr, 09:00'},{done:true,date:'20 Abr, 10:00'},
      {done:true,date:'20 Abr, 11:30'},{done:true,date:'20 Abr, 13:00'},{done:true,date:'20 Abr, 17:00'}
    ]
  }
];

const OM_STEPS = [
  {key:'agendado',    icon:'📅', label:'Agendado'},
  {key:'preparando',  icon:'🔧', label:'Preparando'},
  {key:'alistado',    icon:'📦', label:'Alistado'},
  {key:'en_curso',    icon:'🚚', label:'En camino'},
  {key:'entrega',     icon:'🏠', label:'Entregado'},
  {key:'conformidad', icon:'✅', label:'Confirmado'},
];

let omAllOrders = [...DEMO_ORDERS];
let omFiltered  = [...DEMO_ORDERS];

function omCalcTotal(items){ return items.reduce((s,i)=>s+i.price*i.qty,0); }
function omCalcOrig(items){ return items.reduce((s,i)=>s+i.old*i.qty,0); }

function omRenderStats(){
  const counts = {
    all:       omAllOrders.length,
    active:    omAllOrders.filter(o=>!['entregado','cancelado'].includes(o.status)).length,
    delivered: omAllOrders.filter(o=>['entregado'].includes(o.status)).length,
    cancelled: omAllOrders.filter(o=>o.status==='cancelado').length,
    alerted:   omAllOrders.filter(o=>o.alert==='observado').length,
  };
  document.getElementById('ordersStatsRow').innerHTML = `
    <div class="ostat s-all"><div class="ostat-icon">📋</div><div class="ostat-num">${counts.all}</div><div class="ostat-label">Total</div></div>
    <div class="ostat s-active"><div class="ostat-icon">🚚</div><div class="ostat-num">${counts.active}</div><div class="ostat-label">En curso</div></div>
    <div class="ostat s-delivered"><div class="ostat-icon">✅</div><div class="ostat-num">${counts.delivered}</div><div class="ostat-label">Entregados</div></div>
    <div class="ostat s-cancelled"><div class="ostat-icon">❌</div><div class="ostat-num">${counts.cancelled}</div><div class="ostat-label">Cancelados</div></div>
    <div class="ostat s-alerted"><div class="ostat-icon">⏰</div><div class="ostat-num">${counts.alerted}</div><div class="ostat-label">Alertas</div></div>`;
}

function filterOrdersModal(){
  const q  = document.getElementById('ordersSearchInput').value.toLowerCase();
  const st = document.getElementById('ordersFilterStatus').value;
  const so = document.getElementById('ordersFilterSort').value;
  omFiltered = omAllOrders.filter(o=>{
    const ms = st==='all'||o.status===st||o.alert===st;
    const mq = !q||o.id.toLowerCase().includes(q)||o.voucher.toLowerCase().includes(q)
               ||o.items.some(i=>i.name.toLowerCase().includes(q)||i.brand.toLowerCase().includes(q)||i.sku.toLowerCase().includes(q));
    return ms && mq;
  });
  if(so==='oldest') omFiltered = [...omFiltered].reverse();
  else if(so==='total-high') omFiltered = [...omFiltered].sort((a,b)=>omCalcTotal(b.items)-omCalcTotal(a.items));
  else if(so==='total-low')  omFiltered = [...omFiltered].sort((a,b)=>omCalcTotal(a.items)-omCalcTotal(b.items));
  omRenderList();
}

function omRenderTracking(order){
  return `
    <div class="oc-section-title">📡 Seguimiento
      <div class="oc-info-btn">ℹ
        <div class="oc-info-tooltip">
          <b>¿Qué significa cada etapa?</b><br>
          📅 <b>Agendado:</b> Tu pedido fue registrado y programado.<br>
          🔧 <b>Preparando:</b> Estamos preparando tu pedido.<br>
          📦 <b>Alistado:</b> Tu pedido está listo para ser enviado.<br>
          🚚 <b>En camino:</b> Tu pedido va en camino a tu dirección.<br>
          🏠 <b>Entregado:</b> El repartidor entregó el pedido.<br>
          ✅ <b>Confirmado:</b> Tú confirmaste la recepción.
        </div>
      </div>
    </div>
    <div class="oc-steps">
      ${(order.tracking||[]).map((t,i)=>{
        const s   = OM_STEPS[i] || {icon:'•', label:'—'};
        const cls = t?.cancelled?'cancelled':t?.done?'done':t?.active?'active':'';
        return `<div class="oc-step ${cls}">
          <div class="oc-step-circle">${t?.cancelled?'✕':t?.done?'✓':s.icon}</div>
          <div class="oc-step-label">${t?.label||s.label}</div>
          <div class="oc-step-date">${t?.date||''}</div>
        </div>`;
      }).join('')}
    </div>`;
}

function omRenderTable(order){
  return `
    <div class="oc-table-title">🛒 Detalle de productos</div>
    <table class="oc-table">
      <thead><tr><th></th><th>Producto</th><th>SKU</th><th>Cant.</th><th>P.Unit.</th><th>Dcto.</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${order.items.map(i=>{
          const d=Math.round((i.old-i.price)/i.old*100);
          return `<tr>
            <td class="oc-prod-icon">${i.icon}</td>
            <td><div class="oc-prod-name">${i.name}</div><div class="oc-prod-brand">${i.brand}</div></td>
            <td style="font-size:10px;color:var(--gray);font-family:monospace">${i.sku}</td>
            <td style="text-align:center;font-weight:700">${i.qty}</td>
            <td class="oc-prod-price">S/ ${i.price.toFixed(2)}</td>
            <td><span class="oc-disc-pill">-${d}%</span></td>
            <td class="oc-prod-price">S/ ${(i.price*i.qty).toFixed(2)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function omRenderVoucher(order){
  return `
    <div class="oc-voucher">
      <div class="oc-voucher-label">Comprobante de pago</div>
      <div class="oc-voucher-code" id="omvc-${order.id}">${order.voucher}</div>
      <button class="oc-voucher-copy" onclick="omCopyVoucher('${order.id}','${order.voucher}')">📋 Copiar</button>
      <div class="oc-voucher-sub">Método: ${order.payMethod}</div>
      <div class="oc-voucher-sub">📍 ${order.address}</div>
    </div>`;
}

function omRenderSummary(order){
  const total=omCalcTotal(order.items), orig=omCalcOrig(order.items), saved=orig-total;
  return `
    <div class="oc-summary">
      <div class="oc-sum-row"><span>Subtotal original</span><span>S/ ${orig.toFixed(2)}</span></div>
      <div class="oc-sum-row"><span>Descuento</span><span class="oc-sum-saved">-S/ ${saved.toFixed(2)}</span></div>
      <div class="oc-sum-row"><span>Envío</span><span style="color:var(--green)">Gratis ✓</span></div>
      <div class="oc-sum-row"><span>TOTAL PAGADO</span><span style="color:var(--orange)">S/ ${total.toFixed(2)}</span></div>
    </div>`;
}

function omRenderCard(order, idx){
  const total = omCalcTotal(order.items);
  const labelMap = {
    proceso:'📅 Agendado', almacen:'🔧 Preparando', empaquetado:'📦 Alistado',
    envio:'🚚 En camino', entregado:'🏠 Entregado', cancelado:'❌ Cancelado',
    sinstock:'⚠️ Sin stock', observado:'⏰ Pendiente confirmar',
  };
  const stripColor = {
    proceso:'#1d4ed8', almacen:'#f59e0b', empaquetado:'#7c3aed',
    envio:'#E89E48', entregado:'#16a34a', cancelado:'#dc2626',
    sinstock:'#f59e0b', observado:'#0369a1',
  };
  const alertHTML = order.alert ? `
    <div class="oc-alert ${order.alert}">
      <span>${order.alert==='cancelado'?'❌':order.alert==='sinstock'?'⚠️':'👁️'}</span>
      <span>${order.alertMsg}</span>
      <button class="oc-alert-wa" onclick="omContactWA('${order.id}')">💬 Contactar</button>
    </div>` : '';

  // Body simplificado: solo tracking + accesos rápidos
  const bodyHTML = `
    <div class="oc-panel-left">
      ${omRenderTracking(order)}
    </div>
    <div class="oc-panel-right" style="padding:10px 14px">
      <div class="oc-actions" style="flex-wrap:wrap;gap:8px">
        <button class="oc-act" style="background:#0b1c35;color:#e8c55a;flex:1;min-width:120px;padding:9px 12px;font-size:12px;font-weight:700"
          onclick="omOpenDetail('${order.id}')">👁 Ver detalle completo</button>
        <button class="oc-act wa" onclick="omContactWA('${order.id}')" style="flex:1;min-width:100px">💬 WhatsApp</button>
        ${order.rawStatus==='entrega'?`<button class="oc-act review" style="background:#16a34a;color:#fff;flex:2;min-width:160px;font-size:12px;font-weight:800" onclick="omConfirmDelivery('${order.id}')">✅ Confirmar recepción</button>`:''}
        ${['agendado','preparando'].includes(order.rawStatus)?`<button class="oc-act" style="background:#dc2626;color:#fff;flex:1;min-width:120px" onclick="omCancelOrder('${order.id}')">❌ Cancelar</button>`:''}
      </div>
    </div>`;

  return `
    <div class="oc-card" id="omcard-${order.id}" style="animation-delay:${idx*0.05}s">
      <div style="display:flex;gap:0;cursor:pointer;user-select:none;position:relative"
           onclick="omToggle('${order.id}')">
        <!-- Barra de color lateral -->
        <div style="width:4px;flex-shrink:0;border-radius:3px 0 0 3px;
                    background:${stripColor[order.status]||'#aaa'}"></div>
        <!-- Contenido principal -->
        <div style="flex:1;padding:9px 12px;min-width:0">
          <!-- Fila 1: número + acciones -->
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px">
            <div style="font-size:14px;font-weight:800;font-family:var(--font-head);
                        color:#0b1c35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                        cursor:pointer"
                 title="Toca para ver el seguimiento">
              ${order.id}
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0"
                 onclick="event.stopPropagation()">
              <button onclick="omOpenDetail('${order.id}')"
                style="background:#0b1c35;color:#e8c55a;border:none;border-radius:8px;
                       padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;
                       white-space:nowrap;line-height:1.5">
                👁 Ver
              </button>
              <button onclick="omToggle('${order.id}')"
                class="om-chevron-btn" id="omchev-${order.id}"
                style="width:26px;height:26px;border-radius:50%;background:#f0f0f0;
                       border:none;cursor:pointer;font-size:11px;color:#888;
                       display:flex;align-items:center;justify-content:center;
                       transition:background .2s,transform .3s;flex-shrink:0">
                ▼
              </button>
            </div>
          </div>
          <!-- Fila 2: fecha + badge + total -->
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
            <span style="font-size:10px;color:#888">📅 ${order.date} · ${order.items.length} prod.</span>
            <span class="oc-badge ocb-${order.status}" style="margin-left:auto">
              ${labelMap[order.status]||order.status}
            </span>
            <span style="font-size:15px;font-weight:800;color:var(--orange);white-space:nowrap;flex-shrink:0">
              S/ ${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      ${alertHTML}
      <div class="oc-body">${bodyHTML}</div>
    </div>`;
}

function omRenderList(){
  const w = document.getElementById('ordersListWrap');
  if(!omFiltered.length){
    const q = document.getElementById('ordersSearchInput').value;
    w.innerHTML = `<div class="oc-empty">
      <div class="oc-empty-icon">${q?'🔍':'📦'}</div>
      <div class="oc-empty-title">${q?'Sin resultados':'Sin pedidos aún'}</div>
      <p class="oc-empty-sub">${q?'Intenta con otro término':'Cuando realices una compra, verás aquí todos tus pedidos con seguimiento en tiempo real.'}</p>
      ${!q?`<button class="btn-primary" onclick="closeModal('ordersModal');showPage('catalog')">🛒 Ir a comprar</button>`:''}
    </div>`;
    return;
  }
  w.innerHTML = omFiltered.map((o,i)=>omRenderCard(o,i)).join('');
}

function omToggle(id){
  const card    = document.getElementById(`omcard-${id}`);
  const isOpen  = card.classList.contains('open');

  // Cerrar todos los demás (acordeón: solo uno abierto a la vez)
  document.querySelectorAll('.oc-card.open').forEach(c => {
    if (c.id !== `omcard-${id}`) {
      c.classList.remove('open');
      const otherId = c.id.replace('omcard-', '');
      const otherBtn = document.getElementById(`omchev-${otherId}`);
      if (otherBtn) {
        otherBtn.style.transform  = '';
        otherBtn.style.background = '#f0f0f0';
        otherBtn.style.color      = '#888';
      }
    }
  });

  // Toggle la tarjeta actual
  card.classList.toggle('open', !isOpen);
  const btn = document.getElementById(`omchev-${id}`);
  if (btn) {
    btn.style.transform  = !isOpen ? 'rotate(180deg)' : '';
    btn.style.background = !isOpen ? 'var(--orange)' : '#f0f0f0';
    btn.style.color      = !isOpen ? '#fff' : '#888';
  }

  // Si se abrió → scroll suave hacia la tarjeta dentro del list-wrap
  if (!isOpen) {
    setTimeout(() => {
      const wrap = document.querySelector('.orders-list-wrap');
      if (wrap && card) {
        const cardTop  = card.offsetTop - wrap.offsetTop;
        const padding  = 8;
        wrap.scrollTo({ top: cardTop - padding, behavior: 'smooth' });
      }
    }, 60);
  }
}

// ── MODAL DETALLE COMPLETO DEL PEDIDO (cliente) ───────────────────────────────
function omEnsureDetailStyles() {
  if (document.getElementById('omDetailStyles')) return;
  const s = document.createElement('style');
  s.id = 'omDetailStyles';
  s.textContent = `
    #omDetailOverlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;
      display:flex;align-items:center;justify-content:center;padding:12px;
      animation:omFI .18s ease}
    @keyframes omFI{from{opacity:0}to{opacity:1}}
    @keyframes omSU{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    #omDetailBox{background:#fff;border-radius:20px;width:100%;max-width:660px;
      max-height:88vh;display:flex;flex-direction:column;
      box-shadow:0 28px 70px rgba(0,0,0,.4);animation:omSU .22s ease;
      font-family:'Nunito',sans-serif;overflow:hidden}
    .omd-scroll{overflow-y:auto;flex:1}
    .omd-scroll::-webkit-scrollbar{width:4px}
    .omd-scroll::-webkit-scrollbar-thumb{background:#e0e3eb;border-radius:4px}
    .omd-sec{padding:14px 20px;border-bottom:1px solid #edf0f5}
    .omd-sec:last-child{border-bottom:none}
    .omd-sec-ttl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#a0aec0;margin-bottom:10px}
    /* Timeline horizontal */
    .omd-tl{display:flex;align-items:flex-start;gap:0;overflow-x:auto;padding-bottom:4px}
    .omd-tl::-webkit-scrollbar{height:3px}
    .omd-tl::-webkit-scrollbar-thumb{background:#e0e3eb;border-radius:3px}
    .omd-tl-item{display:flex;flex-direction:column;align-items:center;min-width:80px;flex:1;position:relative}
    .omd-tl-item:not(:last-child)::after{content:'';position:absolute;top:14px;left:calc(50% + 14px);
      right:calc(-50% + 14px);height:2px;background:#e0e3eb;z-index:0}
    .omd-tl-item.done-step::after{background:#4dab6a}
    .omd-tl-dot{width:28px;height:28px;border-radius:50%;border:2px solid #e0e3eb;
      background:#f5f6fa;display:flex;align-items:center;justify-content:center;
      font-size:12px;z-index:1;flex-shrink:0;margin-bottom:5px}
    .omd-tl-dot.done{background:#e8f5ee;border-color:#4dab6a}
    .omd-tl-dot.active{background:#E89E48;border-color:#c97d2a;color:#fff;
      box-shadow:0 0 0 3px rgba(232,158,72,.25)}
    .omd-tl-dot.xed{background:#fef2f2;border-color:#ef4444}
    .omd-tl-lbl{font-size:9px;font-weight:700;color:#4a5568;text-align:center;line-height:1.2}
    .omd-tl-lbl.a-lbl{color:#E89E48}
    .omd-tl-lbl.x-lbl{color:#ef4444}
    .omd-tl-date{font-size:8px;color:#a0aec0;text-align:center;margin-top:2px}
    /* Campos */
    .omd-fgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .omd-f{background:#f7f9fc;border-radius:8px;padding:8px 10px}
    .omd-f .fl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#a0aec0}
    .omd-f .fv{font-size:12px;font-weight:700;color:#0b1c35;margin-top:2px}
    /* Productos */
    .omd-prod{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #edf0f5}
    .omd-prod:last-child{border-bottom:none}
    .omd-pimg{width:44px;height:44px;object-fit:cover;border-radius:8px;border:1px solid #edf0f5;flex-shrink:0}
    .omd-pph{width:44px;height:44px;border-radius:8px;border:1px solid #edf0f5;background:#f5f6fa;
      display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  `;
  document.head.appendChild(s);
}

function omOpenDetail(id) {
  const order = omAllOrders.find(x => x.id === id);
  if (!order) return;
  omEnsureDetailStyles();

  let overlay = document.getElementById('omDetailOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'omDetailOverlay';
    overlay.addEventListener('click', e => { if(e.target===overlay) omCloseDetail(); });
    document.body.appendChild(overlay);
  }

  const raw       = order._raw || {};
  const items     = order.items || [];
  const tracking  = order.tracking || [];
  const rawStatus = order.rawStatus || 'agendado';
  const total     = omCalcTotal(items);
  const orig      = omCalcOrig(items);

  const statusLabel = { agendado:'📅 Agendado', preparando:'🔧 Preparando', alistado:'📦 Alistado',
    en_curso:'🚚 En camino', entrega:'🏠 Entregado', conformidad:'✅ Confirmado', cancelado:'❌ Cancelado' };
  const statusBg  = { agendado:'#eff6ff', preparando:'#fff7ed', alistado:'#f5f3ff', en_curso:'#fffbeb',
    entrega:'#eff6ff', conformidad:'#e8f5ee', cancelado:'#fef2f2' };
  const statusClr = { agendado:'#1d4ed8', preparando:'#c2410c', alistado:'#5b21b6', en_curso:'#92400e',
    entrega:'#0369a1', conformidad:'#157a3f', cancelado:'#b91c1c' };

  // ── Timeline horizontal ──
  const tlHTML = tracking.map((t,i) => {
    const dotCls = t.cancelled ? 'xed' : t.done ? 'done' : t.active ? 'active' : '';
    const lblCls = t.active ? 'a-lbl' : t.cancelled ? 'x-lbl' : '';
    const icon   = t.cancelled ? '✕' : t.done ? '✓' : t.icon;
    const nextDone = tracking[i+1]?.done || tracking[i+1]?.active;
    return `<div class="omd-tl-item ${(t.done&&nextDone)||t.active?'done-step':''}">
      <div class="omd-tl-dot ${dotCls}">${icon}</div>
      <div class="omd-tl-lbl ${lblCls}">${t.label.replace(/^.\s/,'')}</div>
      <div class="omd-tl-date">${t.date||''}</div>
    </div>`;
  }).join('');

  // ── Productos ──
  const prodsHTML = items.length ? items.map(i => {
    const disc = i.old > i.price ? Math.round((i.old-i.price)/i.old*100) : 0;
    const img = i.imageUrl
      ? `<img class="omd-pimg" src="${i.imageUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="omd-pph" style="display:none">📦</div>`
      : `<div class="omd-pph">📦</div>`;
    return `<div class="omd-prod">
      ${img}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#0b1c35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.name}</div>
        <div style="font-size:11px;color:#a0aec0">${i.brand||''}${disc?` · <span style="color:#E89E48">-${disc}%</span>`:''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;color:#a0aec0;text-decoration:line-through">${disc?`S/ ${i.old.toFixed(2)}`:''}</div>
        <div style="font-size:13px;font-weight:800;color:#0b1c35">S/ ${i.price.toFixed(2)} <span style="font-weight:400;color:#a0aec0">×${i.qty}</span></div>
        <div style="font-size:12px;font-weight:700;color:#E89E48">S/ ${(i.price*i.qty).toFixed(2)}</div>
      </div>
    </div>`;
  }).join('') : `<div style="font-size:12px;color:#a0aec0;padding:8px 0;text-align:center">Sin productos registrados</div>`;

  const cancelBanner = rawStatus === 'cancelado'
    ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:10px 20px;font-size:12px;color:#b91c1c">
        ❌ ${raw.cancel_reason || 'Pedido cancelado por el cliente.'}</div>` : '';

  const confirmBanner = rawStatus === 'entrega'
    ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 20px;font-size:12px;color:#92400e">
        ⏰ Tu pedido fue entregado. ¡Confirma la recepción para cerrar el pedido!</div>` : '';

  overlay.innerHTML = `
  <div id="omDetailBox">
    <!-- HEADER fijo -->
    <div style="background:#0b1c35;padding:16px 20px;border-radius:20px 20px 0 0;
         display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <div style="font-size:17px;font-weight:800;color:#e8c55a;letter-spacing:.3px">${order.id}</div>
        <div style="font-size:11px;color:#8fa0b8;margin-top:2px">📅 ${order.date}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;
          background:${statusBg[rawStatus]||'#f5f6fa'};color:${statusClr[rawStatus]||'#4a5568'}">
          ${statusLabel[rawStatus]||rawStatus}
        </span>
        <button onclick="omCloseDetail()"
          style="background:rgba(255,255,255,.1);border:none;color:#fff;width:30px;height:30px;
                 border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
      </div>
    </div>

    <!-- REF VENTA -->
    <div style="background:#f7f9fc;padding:8px 20px;border-bottom:1px solid #edf0f5;
         display:flex;align-items:center;gap:8px;flex-shrink:0">
      <span>🧾</span>
      <span style="font-size:12px;color:#4a5568">Comprobante:</span>
      <b style="font-size:12px;color:#0b1c35">${raw.sale_number||order.voucher||'—'}</b>
      ${raw.invoice_number?`<span style="font-size:11px;color:#a0aec0">· ${raw.invoice_number}</span>`:''}
      <span style="margin-left:auto;font-size:14px;font-weight:800;color:#E89E48">S/ ${total.toFixed(2)}</span>
    </div>

    ${cancelBanner}${confirmBanner}

    <!-- SCROLL -->
    <div class="omd-scroll">

      <!-- SEGUIMIENTO -->
      <div class="omd-sec">
        <div class="omd-sec-ttl">📡 Seguimiento del pedido</div>
        <div class="omd-tl">${tlHTML}</div>
      </div>

      <!-- ENTREGA -->
      <div class="omd-sec">
        <div class="omd-sec-ttl">📍 Datos de entrega</div>
        <div class="omd-fgrid">
          <div class="omd-f" style="grid-column:span 2">
            <div class="fl">Dirección</div>
            <div class="fv">${raw.delivery_address||order.address||'—'}</div>
          </div>
          ${raw.delivery_reference?`<div class="omd-f" style="grid-column:span 2">
            <div class="fl">Referencia</div><div class="fv">${raw.delivery_reference}</div></div>`:''}
        </div>
      </div>

      <!-- PRODUCTOS -->
      <div class="omd-sec">
        <div class="omd-sec-ttl">🛒 Productos (${items.length})</div>
        ${prodsHTML}
        <div style="display:flex;justify-content:space-between;padding:10px 0 0;border-top:1px solid #edf0f5;margin-top:4px">
          <span style="font-size:11px;color:#a0aec0">Subtotal original</span>
          <span style="font-size:11px;color:#a0aec0">S/ ${orig.toFixed(2)}</span>
        </div>
        ${orig>total?`<div style="display:flex;justify-content:space-between">
          <span style="font-size:11px;color:#16a34a">Ahorro</span>
          <span style="font-size:11px;font-weight:700;color:#16a34a">-S/ ${(orig-total).toFixed(2)}</span>
        </div>`:''}
        <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:2px solid #edf0f5;margin-top:4px">
          <span style="font-size:14px;font-weight:800;color:#0b1c35">TOTAL PAGADO</span>
          <span style="font-size:15px;font-weight:800;color:#E89E48">S/ ${total.toFixed(2)}</span>
        </div>
      </div>

    </div><!-- /scroll -->

    <!-- FOOTER ACCIONES fijo -->
    <div style="display:flex;gap:8px;padding:12px 20px;border-top:1px solid #edf0f5;
         background:#f7f9fc;border-radius:0 0 20px 20px;flex-shrink:0;flex-wrap:wrap">
      <button onclick="omContactWA('${order.id}')"
        style="flex:1;min-width:100px;padding:9px 8px;border-radius:10px;border:1px solid #e0e3eb;
               background:#fff;font-size:11px;font-weight:700;cursor:pointer;color:#0b1c35">💬 WhatsApp</button>
      <button onclick="omPrintOrder('${order.id}')"
        style="flex:1;min-width:100px;padding:9px 8px;border-radius:10px;border:1px solid #e0e3eb;
               background:#fff;font-size:11px;font-weight:700;cursor:pointer;color:#0b1c35">🖨️ Imprimir</button>
      ${rawStatus==='entrega'?`
      <button onclick="omConfirmDelivery('${order.id}');omCloseDetail()"
        style="flex:2;min-width:160px;padding:9px 8px;border-radius:10px;border:none;
               background:#16a34a;color:#fff;font-size:12px;font-weight:800;cursor:pointer">
        ✅ Confirmar recepción</button>`:''}
      ${['agendado','preparando'].includes(rawStatus)?`
      <button onclick="omCancelOrder('${order.id}');omCloseDetail()"
        style="flex:1;min-width:100px;padding:9px 8px;border-radius:10px;border:none;
               background:#dc2626;color:#fff;font-size:11px;font-weight:700;cursor:pointer">
        ❌ Cancelar</button>`:''}
    </div>
  </div>`;

  overlay.style.display = 'flex';
}

function omCloseDetail() {
  const overlay = document.getElementById('omDetailOverlay');
  if (overlay) overlay.style.display = 'none';
}

function omCopyVoucher(id, code){
  navigator.clipboard.writeText(code)
    .then(()=>showToast('✅ Código copiado: '+code))
    .catch(()=>showToast('📋 Código: '+code));
}

async function omCancelOrder(id){
  const o = omAllOrders.find(x=>x.id===id);
  if(!o) return;
  if(!['agendado','preparando'].includes(o.rawStatus)){
    showToast('❌ Solo puedes cancelar mientras el pedido está en preparación.');
    return;
  }
  if(!confirm(`¿Cancelar el pedido ${id}?\n\nSolo puedes cancelar si está en preparación. Una vez alistado, ya no es posible.`)) return;
  try {
    await API.customers.cancelDelivery(o.dbId, 'Cancelado por el cliente');
    showToast('❌ Pedido '+id+' cancelado');
    showOrdersModal();
  } catch(err) {
    showToast('❌ '+err.message);
  }
}

async function omConfirmDelivery(id){
  const o = omAllOrders.find(x=>x.id===id);
  if(!o) return;
  if(!confirm(`¿Confirmar la recepción del pedido ${id}?\n\nAl confirmar, das conformidad de que recibiste tu pedido correctamente.`)) return;
  try {
    await API.customers.confirmDelivery(o.dbId);
    showToast('✅ ¡Gracias! Recepción confirmada correctamente.');
    showOrdersModal();
  } catch(err) {
    showToast('❌ '+err.message);
  }
}

function omContactWA(id){
  const o = omAllOrders.find(x=>x.id===id);
  if(!o) return;
  const msg = `Hola A&M Importaciones 👋\n\nConsulta sobre mi pedido:\n📦 *${o.id}*\n📅 ${o.date}\n💰 Total: S/ ${omCalcTotal(o.items).toFixed(2)}\n\nProductos:\n${o.items.map(i=>`• ${i.name} x${i.qty}`).join('\n')}\n\n¿Pueden ayudarme? Gracias 🙏`;
  window.open(`https://wa.me/51928020850?text=${encodeURIComponent(msg)}`,'_blank');
}

function omPrintOrder(id){
  const o = omAllOrders.find(x=>x.id===id);
  if(!o) return;
  const total=omCalcTotal(o.items), orig=omCalcOrig(o.items);
  const w = window.open('','_blank');
  w.document.write(`<html><head><title>Pedido ${o.id}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:700px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#1a1a2e;color:white;padding:8px;font-size:12px}td{padding:9px 8px;border-bottom:1px solid #eee;font-size:12px}.voucher{background:#1a1a2e;color:white;padding:14px;border-radius:10px;margin:14px 0}.footer{margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:10px}</style>
  </head><body>
  <img src="https://raw.githubusercontent.com/amexportsp-byte/data_imagen/main/logo1.png" height="44" style="margin-bottom:10px"/>
  <h2 style="margin-bottom:2px">Pedido ${o.id}</h2>
  <p style="color:#888;font-size:12px;margin-bottom:12px">📅 ${o.date} · Estado: ${o.status.toUpperCase()}</p>
  <div class="voucher">
    <div style="font-size:10px;opacity:.6;margin-bottom:4px">COMPROBANTE DE PAGO</div>
    <div style="font-size:20px;font-weight:700;letter-spacing:2px;color:#f0b86a">${o.voucher}</div>
    <div style="font-size:11px;opacity:.6;margin-top:6px">Método: ${o.payMethod} · Dirección: ${o.address}</div>
  </div>
  <table><thead><tr><th>Producto</th><th>SKU</th><th>Cant.</th><th>P.Unit.</th><th>Dcto.</th><th>Subtotal</th></tr></thead>
  <tbody>${o.items.map(i=>{const d=Math.round((i.old-i.price)/i.old*100);return`<tr><td>${i.name}<br><span style="color:#E89E48;font-size:10px">${i.brand}</span></td><td style="font-size:10px">${i.sku}</td><td style="text-align:center">${i.qty}</td><td>S/ ${i.price.toFixed(2)}</td><td>-${d}%</td><td>S/ ${(i.price*i.qty).toFixed(2)}</td></tr>`;}).join('')}
  <tr style="font-weight:700"><td colspan="5" style="text-align:right">Descuento:</td><td style="color:#27ae60">-S/ ${(orig-total).toFixed(2)}</td></tr>
  <tr style="font-weight:700"><td colspan="5" style="text-align:right">TOTAL PAGADO:</td><td style="color:#E89E48">S/ ${total.toFixed(2)}</td></tr>
  </tbody></table>
  <div class="footer">A&M Importaciones · WhatsApp: +51 928 020 850 · ${new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'})}</div>
  </body></html>`);
  w.document.close(); setTimeout(()=>w.print(),400);
}

function ordersPrintAll(){
  if(!omFiltered.length){showToast('⚠️ No hay pedidos para imprimir');return;}
  const w = window.open('','_blank');
  let rows='';
  omFiltered.forEach(o=>{
    const total=omCalcTotal(o.items);
    rows+=`<tr style="background:#f5f5f5"><td colspan="6" style="padding:10px 8px;font-weight:700;font-size:12px;border-top:2px solid #ddd">
      Pedido ${o.id} · ${o.date} · ${o.status.toUpperCase()} · ${o.voucher}</td></tr>
      ${o.items.map(i=>{const d=Math.round((i.old-i.price)/i.old*100);return`<tr><td style="padding-left:16px">${i.name} <span style="color:#E89E48;font-size:10px">${i.brand}</span></td><td>${i.sku}</td><td style="text-align:center">${i.qty}</td><td>S/ ${i.price.toFixed(2)}</td><td>-${d}%</td><td>S/ ${(i.price*i.qty).toFixed(2)}</td></tr>`;}).join('')}
      <tr><td colspan="5" style="text-align:right;font-weight:700;padding:6px">TOTAL:</td><td style="font-weight:700;color:#E89E48">S/ ${total.toFixed(2)}</td></tr>`;
  });
  w.document.write(`<html><head><title>Mis Pedidos</title>
  <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#1a1a2e;color:white;padding:8px}td{padding:7px 8px;border-bottom:1px solid #eee}.footer{margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:10px}</style>
  </head><body>
  <img src="https://raw.githubusercontent.com/amexportsp-byte/data_imagen/main/logo1.png" height="40" style="margin-bottom:10px"/>
  <h2 style="margin-bottom:4px">Resumen de mis pedidos</h2>
  <p style="color:#888;font-size:12px;margin-bottom:14px">${omFiltered.length} pedido(s) · ${new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'})}</p>
  <table><thead><tr><th>Producto</th><th>SKU</th><th>Cant.</th><th>P.Unit.</th><th>Dcto.</th><th>Subtotal</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">A&M Importaciones · WhatsApp: +51 928 020 850</div>
  </body></html>`);
  w.document.close(); setTimeout(()=>w.print(),400);
}

function showOrdersModal() {
  requireLogin(async () => {
    document.getElementById('accountMenu').classList.remove('show');
    const user = getCurrentUser();
    document.getElementById('ordersUserName').textContent = '👤 ' + maskName(user?.name || '');
    document.getElementById('ordersModal').classList.add('show');

    const wrap = document.getElementById('ordersListWrap');
    wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa"><div style="font-size:36px">⏳</div><p style="margin-top:12px">Cargando tus pedidos...</p></div>';

    try {
      const apiOrders = await API.customers.deliveryOrders();
      omAllOrders = apiOrders.map(o => ({
        _raw:       o,
        id:         o.order_number || o.id,
        dbId:       o.id,
        date:       new Date(o.created_at || o.scheduled_at).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
        status:     mapDeliveryStatus(o.status),
        rawStatus:  o.status,
        voucher:    (o.invoice_number && o.invoice_number !== '') ? o.invoice_number : (o.sale_number || '—'),
        payMethod:  '—',
        address:    o.delivery_address || '—',
        items:      (o.items || []).filter(i => i.product_name).map(i => ({
          icon: '📦', name: i.product_name, brand: '—', qty: i.quantity,
          price: parseFloat(i.unit_price || 0), old: parseFloat(i.unit_price || 0), sku: '—'
        })),
        tracking: buildDeliveryTracking(o),
        alert:    omGetDeliveryAlert(o),
        alertMsg: omGetDeliveryAlertMsg(o),
      }));
    } catch {
      omAllOrders = [];
    }
    omFiltered = [...omAllOrders];
    omRenderStats();
    filterOrdersModal();
  });
}

function mapDeliveryStatus(s) {
  const map = {
    agendado:    'proceso',
    preparando:  'almacen',
    alistado:    'empaquetado',
    en_curso:    'envio',
    entrega:     'entregado',
    conformidad: 'entregado',
    cancelado:   'cancelado',
  };
  return map[s] || 'proceso';
}

function buildDeliveryTracking(o) {
  const steps = [
    { key: 'agendado',    label: '📅 Agendado',   ts: o.scheduled_at  },
    { key: 'preparando',  label: '🔧 Preparando', ts: o.preparing_at  },
    { key: 'alistado',    label: '📦 Alistado',   ts: o.ready_at      },
    { key: 'en_curso',    label: '🚚 En camino',  ts: o.in_transit_at },
    { key: 'entrega',     label: '🏠 Entregado',  ts: o.delivered_at  },
    { key: 'conformidad', label: '✅ Confirmado', ts: o.confirmed_at  },
  ];
  const order = steps.map(s => s.key);
  const curIdx = o.status === 'cancelado' ? -1 : order.indexOf(o.status);
  return steps.map((s, i) => {
    const date = s.ts ? new Date(s.ts).toLocaleDateString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    if (o.status === 'cancelado') {
      // Pasos con timestamp = se completaron antes de la cancelación → ✓
      // Pasos sin timestamp = no se alcanzaron → ✗
      return { label: s.label, icon: s.label.split(' ')[0], done: !!s.ts, active: false, cancelled: !s.ts, date };
    }
    return { label: s.label, icon: s.label.split(' ')[0], done: i < curIdx, active: i === curIdx, cancelled: false, date };
  });
}

function omGetDeliveryAlert(o) {
  if (o.status === 'cancelado')   return 'cancelado';
  if (o.status === 'entrega') {
    const hrs = (Date.now() - new Date(o.delivered_at)) / 3600000;
    if (hrs > 5) return 'observado';
  }
  return null;
}
function omGetDeliveryAlertMsg(o) {
  if (o.status === 'cancelado') return o.cancel_reason || 'Pedido cancelado.';
  if (o.status === 'entrega')   return '⏰ Tu pedido fue entregado. Por favor confirma la recepción.';
  return '';
}

function showAddressModal() {
  requireLogin(() => {
    const user = getCurrentUser();
    const addr = user.address || {};
    document.getElementById('addressMain').value = addr.main || '';
    document.getElementById('addressDistrict').value = addr.district || '';
    document.getElementById('addressRef').value = addr.ref || '';
    document.getElementById('accountMenu').classList.remove('show');
    document.getElementById('addressModal').classList.add('show');
  });
}

async function saveAddress() {
  const address  = document.getElementById('addressMain').value.trim();
  const district = document.getElementById('addressDistrict').value.trim();
  try {
    await API.customers.updateProfile({ address, district });
    const user = getCurrentUser();
    API.customers.setSession(API.customers.getToken(), { ...user, address, district });
    closeModal('addressModal');
    showToast('✅ Dirección guardada correctamente');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
}

function showPointsModal() {
  requireLogin(() => {
    const user = getCurrentUser() || {};
    document.getElementById('userPoints').textContent = user.points || 0;
    document.getElementById('userPointsValue').textContent = ((user.points || 0) / 20).toFixed(2);
    document.getElementById('accountMenu').classList.remove('show');
    document.getElementById('pointsModal').classList.add('show');
  });
}

function showContactModal() {
  document.getElementById('accountMenu').classList.remove('show');
  document.getElementById('contactModal').classList.add('show');
}

// ===== CART DRAWER =====
function openCartDrawer() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('show');
}

// ===== AI QUICK SEARCH =====
function quickAISearch(term) {
  document.getElementById('aiSearchQuery').value = term;
  runAISearch();
}

// ===== MEGA MENU =====
function renderMegaContent(cat) {
  // Ahora el mega menú es de 3 columnas: megaShowSubs maneja todo
  const sidebar = document.getElementById('megaSidebar');
  const trigger = sidebar?.querySelector(`[data-cat="${cat}"]`);
  megaShowSubs(cat, trigger);
}
function closeMegaMenu() {
  document.getElementById('megaMenu').classList.remove('show');
  document.getElementById('megaOverlay').classList.remove('show');
  // Resetear columnas al estado inicial
  document.querySelectorAll('.mega-cat').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mega-sub-item').forEach(el => el.classList.remove('active'));
  const subsEl = document.getElementById('megaSubs');
  const contentEl = document.getElementById('megaContent');
  if (subsEl) subsEl.innerHTML = '<div class="mega-subs-hint">← Selecciona una categoría</div>';
  if (contentEl) contentEl.innerHTML = '<div class="mega-content-hint">← Selecciona una subcategoría</div>';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  currentPage = 'home';
  renderCart();
  renderMegaContent('limpieza');
  renderPlanPreviews();
  updateHeaderUser(); // Restaurar sesión si existe

  // Carga inicial de productos
  loadProducts();

  // Actualizaciones en tiempo real via Server-Sent Events
  function setLiveStatus(connected) {
    const el = document.getElementById('liveIndicator');
    if (!el) return;
    el.classList.toggle('disconnected', !connected);
    el.querySelector('.live-label').textContent = connected ? 'En vivo' : 'Sin conexión';
    el.title = connected ? 'Recibe actualizaciones automáticas en tiempo real' : 'Sin conexión al servidor';
  }

  if (window.EventSource) {
    const es = new EventSource('/api/products/events');

    es.onopen  = () => setLiveStatus(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'products_updated') loadProducts();
      } catch {}
    };

    es.onerror = () => {
      setLiveStatus(false);
      // EventSource reconecta automáticamente; onopen actualizará el estado
    };
  } else {
    setLiveStatus(false);
  }

  history.replaceState({ page: 'home', productId: null }, '', '#home');

  // CATEGORÍAS
  document.getElementById('btnCategorias').addEventListener('click', () => {
    document.getElementById('megaMenu').classList.toggle('show');
    document.getElementById('megaOverlay').classList.toggle('show');
  });
  document.getElementById('megaOverlay').addEventListener('click', closeMegaMenu);
  // Mega menú lateral (botón CATEGORÍAS) — event delegation
  document.querySelector('.mega-sidebar').addEventListener('click', e => {
    const item = e.target.closest('.mega-cat');
    if (!item) return;
    document.querySelectorAll('.mega-cat').forEach(c => c.classList.remove('active'));
    item.classList.add('active');
    renderMegaContent(item.dataset.cat);
  });

  // Cerrar panel de navegación al salir del área quick-cats-wrap
  const qWrap = document.getElementById('quickCatsWrap');
  if (qWrap) {
    qWrap.addEventListener('mouseleave', () => {
      _catNavTimer = setTimeout(closeCatNav, 250);
    });
    qWrap.addEventListener('mouseenter', () => clearTimeout(_catNavTimer));
  }

  // Cerrar panel al hacer click fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('#quickCatsWrap')) closeCatNav();
  });

  // CUENTA
  document.getElementById('btnCuenta').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('accountMenu').classList.toggle('show');
  });
  document.addEventListener('click', () => document.getElementById('accountMenu').classList.remove('show'));
  document.getElementById('accountMenu').addEventListener('click', e => e.stopPropagation());

  // ABRIR LOGIN / REGISTRO desde menú
  document.getElementById('openLogin').addEventListener('click', () => {
    document.getElementById('loginModal').classList.add('show');
    document.getElementById('accountMenu').classList.remove('show');
  });
  document.getElementById('openRegister').addEventListener('click', () => {
    document.getElementById('registerModal').classList.add('show');
    document.getElementById('accountMenu').classList.remove('show');
  });

  // CARRITO
  document.getElementById('btnCarrito').addEventListener('click', openCartDrawer);
  document.getElementById('closeCart').addEventListener('click', () => {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('show');
  });
  document.getElementById('drawerOverlay').addEventListener('click', () => {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('show');
  });

  // CERRAR MODALES AL HACER CLICK FUERA
  ['loginModal','profileModal','ordersModal','addressModal','pointsModal','contactModal','aiAssistantModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
  });

  // BUSCADOR
  document.getElementById('searchInput').addEventListener('input', e => handleSearch(e.target.value));
  document.addEventListener('click', e => { if(!e.target.closest('.search-box')) document.getElementById('searchDropdown').classList.remove('show'); });

  // AI SEARCH - Enter key
  const aiInput = document.getElementById('aiSearchQuery');
  if (aiInput) aiInput.addEventListener('keypress', e => { if (e.key === 'Enter') runAISearch(); });

  // BANNERS
  document.getElementById('nextBanner').addEventListener('click', () => changeBanner(1));
  document.getElementById('prevBanner').addEventListener('click', () => changeBanner(-1));
  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.addEventListener('click', () => { const d = i - currentBanner; if(d!==0) changeBanner(d<0?-1:1); });
  });

  // SORT — ahora integrado con el sistema de filtros
  document.getElementById('sortProducts').addEventListener('change', e => {
    currentSort = e.target.value;
    applyFilters();
  });
});