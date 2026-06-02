/* ═══════════════════════════════════════════════════════
   A&M IMPORTACIONES — LIBRO CONTABLE DIGITAL
   libro.js — v3.0 con integración multi-módulo
   ─ Lee ventas de AM_VENTAS_V1 (venta.html)
   ─ Lee productos de am_inventory_products_v2 (registro.js)
   ─ CxC y CxP editables
   ─ Modales flotantes en todos los módulos
   ─ Historial de auditoría completo
═══════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════
   1. CLAVES LOCALSTORAGE COMPARTIDAS
════════════════════════════════════════════════════════ */
const LS_LIBRO    = 'AM_LIBRO_CONTABLE_V2';
const LS_VENTAS   = 'AM_VENTAS_V1';           // escrita por venta.html
const LS_ALMACEN  = 'am_inventory_products_v2'; // escrita por registro.js

/* ════════════════════════════════════════════════════════
   2. PLAN CONTABLE GENERAL EMPRESARIAL
════════════════════════════════════════════════════════ */
const PLAN_CONTABLE = [
  { codigo:'10',    nombre:'Efectivo y equivalentes de efectivo' },
  { codigo:'1011',  nombre:'Caja' },
  { codigo:'1012',  nombre:'Fondo fijo' },
  { codigo:'1041',  nombre:'Cuentas corrientes en instituciones financieras' },
  { codigo:'1042',  nombre:'Cuentas de ahorro' },
  { codigo:'12',    nombre:'Cuentas por cobrar comerciales - Terceros' },
  { codigo:'1211',  nombre:'Facturas, boletas y otros comprobantes por cobrar' },
  { codigo:'14',    nombre:'Cuentas por cobrar al personal y accionistas' },
  { codigo:'16',    nombre:'Cuentas por cobrar diversas - Terceros' },
  { codigo:'20',    nombre:'Mercaderías' },
  { codigo:'2011',  nombre:'Mercaderías manufacturadas' },
  { codigo:'21',    nombre:'Productos terminados' },
  { codigo:'23',    nombre:'Materias primas' },
  { codigo:'25',    nombre:'Materiales auxiliares, suministros y repuestos' },
  { codigo:'33',    nombre:'Propiedad, planta y equipo' },
  { codigo:'3311',  nombre:'Terrenos' },
  { codigo:'3312',  nombre:'Edificaciones' },
  { codigo:'3361',  nombre:'Equipos de cómputo y periféricos' },
  { codigo:'3362',  nombre:'Maquinaria' },
  { codigo:'3363',  nombre:'Vehículos' },
  { codigo:'34',    nombre:'Intangibles' },
  { codigo:'37',    nombre:'Activo diferido' },
  { codigo:'40',    nombre:'Tributos, contraprestaciones y aportes por pagar' },
  { codigo:'4011',  nombre:'IGV - Impuesto general a las ventas' },
  { codigo:'4017',  nombre:'Impuesto a la renta' },
  { codigo:'4031',  nombre:'ESSALUD' },
  { codigo:'4032',  nombre:'ONP' },
  { codigo:'41',    nombre:'Remuneraciones y participaciones por pagar' },
  { codigo:'4111',  nombre:'Sueldos y salarios por pagar' },
  { codigo:'42',    nombre:'Cuentas por pagar comerciales - Terceros' },
  { codigo:'4211',  nombre:'Facturas, boletas y otros comprobantes por pagar' },
  { codigo:'45',    nombre:'Obligaciones financieras' },
  { codigo:'4511',  nombre:'Préstamos de instituciones financieras' },
  { codigo:'50',    nombre:'Capital' },
  { codigo:'5011',  nombre:'Capital social' },
  { codigo:'59',    nombre:'Resultados acumulados' },
  { codigo:'5911',  nombre:'Utilidades no distribuidas' },
  { codigo:'5912',  nombre:'Pérdidas acumuladas' },
  { codigo:'60',    nombre:'Compras' },
  { codigo:'6011',  nombre:'Mercaderías - Compras' },
  { codigo:'62',    nombre:'Gastos de personal, directores y gerentes' },
  { codigo:'6211',  nombre:'Sueldos y salarios' },
  { codigo:'63',    nombre:'Gastos de servicios prestados por terceros' },
  { codigo:'6311',  nombre:'Transporte, correos y gastos de viaje' },
  { codigo:'6321',  nombre:'Honorarios profesionales' },
  { codigo:'6331',  nombre:'Arrendamiento de inmuebles' },
  { codigo:'6341',  nombre:'Mantenimiento y reparaciones' },
  { codigo:'6361',  nombre:'Servicios básicos (luz, agua, internet)' },
  { codigo:'6371',  nombre:'Publicidad y marketing' },
  { codigo:'64',    nombre:'Gastos por tributos' },
  { codigo:'65',    nombre:'Otros gastos de gestión' },
  { codigo:'67',    nombre:'Gastos financieros' },
  { codigo:'6731',  nombre:'Intereses por préstamos' },
  { codigo:'70',    nombre:'Ventas' },
  { codigo:'7011',  nombre:'Mercaderías - Ventas' },
  { codigo:'7041',  nombre:'Servicios - Ventas' },
  { codigo:'75',    nombre:'Otros ingresos de gestión' },
  { codigo:'77',    nombre:'Ingresos financieros' },
  { codigo:'89',    nombre:'Resultado del ejercicio' },
  { codigo:'94',    nombre:'Gastos administrativos' },
  { codigo:'95',    nombre:'Gastos de ventas' },
  { codigo:'96',    nombre:'Gastos financieros (clase 9)' },
];

/* ════════════════════════════════════════════════════════
   3. BASE DE DATOS EN MEMORIA
════════════════════════════════════════════════════════ */
let BD = {
  asientos:    [],
  ventas:      [],   // sincronizadas con venta.html via LS_VENTAS
  compras:     [],
  gastos:      [],
  inversiones: [],   // sincronizadas con registro.js via LS_ALMACEN
  cxcExtra:    [],   // CxC manuales editables desde libro.html
  cxpExtra:    [],   // CxP manuales editables desde libro.html
  config: {
    empresa:       'A&M Importaciones S.A.C.',
    ruc:           '20123456789',
    direccion:     'Av. Industrial 234, Lima, Perú',
    periodo:       new Date().getFullYear().toString(),
    ejercicio:     `Enero – Diciembre ${new Date().getFullYear()}`,
    folioInicial:  '0001',
    contador:      'CPC Juan Torres Medina',
    colegiatura:   'CPC-54321',
    representante: 'María López García',
    moneda:        'PEN',
    simbolo:       'S/',
    fechaInicio:   `${new Date().getFullYear()}-01-01`,
    fechaCierre:   `${new Date().getFullYear()}-12-31`,
    usuario:       'Administrador',
  },
  bitacora: [],
};

/* Control global */
let idEditando  = null;
let fnConfirmar = null;
const graficos  = {};
let _auditFiltroActual = {};

/* ════════════════════════════════════════════════════════
   4. UTILIDADES
════════════════════════════════════════════════════════ */
const generarId  = () => `am${Date.now()}${Math.random().toString(36).slice(2,6)}`;
const hoy        = () => new Date().toISOString().split('T')[0];
const anioActual = () => new Date().getFullYear();
const mesActual  = () => new Date().getMonth() + 1;
const getMes     = (iso) => iso ? parseInt(iso.split('-')[1]) : 0;
const getAnio    = (iso) => iso ? parseInt(iso.split('-')[0]) : 0;
const getSemana  = (iso) => {
  if (!iso) return 0;
  const d = new Date(iso + 'T12:00:00');
  const inicio = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - inicio) / 86400000 + inicio.getDay() + 1) / 7);
};
const getTrimestre = (iso) => iso ? Math.ceil(getMes(iso) / 3) : 0;
const nombreMes    = (m) => ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m] || '';
const nombreMesFull= (m) => ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m] || '';

const dinero = (n) => {
  const num = parseFloat(n) || 0;
  const sim = BD.config.simbolo || 'S/';
  return `${sim} ${num.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
};
const pct          = (n) => `${(parseFloat(n)||0).toFixed(1)}%`;
const fechaCorta   = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});
};
const siguienteCorrelativo = () => String(BD.asientos.length + 1).padStart(6,'0');
const leerCampo    = (id) => document.getElementById(id)?.value?.trim() || '';
const leerNumero   = (id) => parseFloat(document.getElementById(id)?.value) || 0;

/* ════════════════════════════════════════════════════════
   5. AUDITORÍA — Sistema completo con IP, usuario, fecha/hora
════════════════════════════════════════════════════════ */
const AUDIT = {
  CREAR:    'crear',    EDITAR:   'editar',   ELIMINAR: 'eliminar',
  EMITIR:   'emitir',  PAGO:     'pago',     ESTADO:   'estado',
  ACCESO:   'acceso',  AJUSTE:   'ajuste',   ANULAR:   'anular',
  IMPORTAR: 'importar',EXPORTAR: 'exportar', LOGIN:    'login',
  ICONS: {
    crear:'✨',   editar:'✏️',    eliminar:'🗑️', emitir:'📄',
    pago:'💳',   estado:'🔄',   acceso:'👁️',   ajuste:'⚙️',
    anular:'🚫', importar:'📥', exportar:'📤', login:'🔐',
  },
  LABELS: {
    crear:    'Registro creado',      editar:    'Campos modificados',
    eliminar: 'Registro eliminado',   emitir:    'Comprobante emitido',
    pago:     'Pago registrado',      estado:    'Estado cambiado',
    acceso:   'Consultado',           ajuste:    'Ajuste realizado',
    anular:   'Registro anulado',     importar:  'Datos importados',
    exportar: 'Datos exportados',     login:     'Sesión iniciada',
  },
};

/* IP del cliente — se obtiene una sola vez al cargar */
let _clienteIP = 'Obteniendo...';
let _clienteDispositivo = '';

(async function detectarIP() {
  try {
    // Intentar con api pública
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    _clienteIP = j.ip || 'No disponible';
  } catch {
    try {
      // Fallback
      const r2 = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const j2 = await r2.json();
      _clienteIP = j2.ip || 'Local/Privada';
    } catch {
      _clienteIP = 'Local/Red privada';
    }
  }
  // Datos del dispositivo
  const ua = navigator.userAgent;
  const plat = navigator.platform || '';
  let so = 'Desconocido';
  if (/Windows/.test(ua))      so = 'Windows';
  else if (/Mac/.test(ua))     so = 'macOS';
  else if (/Linux/.test(ua))   so = 'Linux';
  else if (/Android/.test(ua)) so = 'Android';
  else if (/iOS|iPhone|iPad/.test(ua)) so = 'iOS';
  let nav = 'Desconocido';
  if (/Chrome/.test(ua) && !/Edge/.test(ua)) nav = 'Chrome';
  else if (/Firefox/.test(ua))  nav = 'Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) nav = 'Safari';
  else if (/Edge/.test(ua))     nav = 'Edge';
  _clienteDispositivo = `${so} · ${nav}`;
})();

/* Zona horaria del cliente */
const _zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';

/* Timestamp completo con zona horaria */
const nowStr = () => new Date().toLocaleString('es-PE', {
  year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', second:'2-digit',
  timeZone: _zonaHoraria,
});

/* ID de sesión única por pestaña */
const _sesionId = 'SES-' + Math.random().toString(36).slice(2,8).toUpperCase();

function crearEntradaAudit(tipo, label, detalle='', diffs=[]) {
  return {
    id:          generarId(),
    tipo,
    label:       label || AUDIT.LABELS[tipo] || tipo,
    detalle,
    diffs,
    timestamp:   nowStr(),
    fechaISO:    new Date().toISOString(),
    usuario:     BD.config.usuario || 'Administrador',
    ip:          _clienteIP,
    dispositivo: _clienteDispositivo,
    sesion:      _sesionId,
  };
}

function calcDiffsAudit(before, after, campos) {
  const diffs = [];
  for (const [key, label] of Object.entries(campos)) {
    const norm = (v) => {
      const n = parseFloat(v);
      if (!isNaN(n) && String(v).trim() !== '') return n.toFixed(2);
      return String(v ?? '').trim();
    };
    const a = norm(before[key]);
    const b = norm(after[key]);
    if (a !== b) diffs.push({ campo: label, antes: a || '—', despues: b || '—' });
  }
  return diffs;
}

/* ── Render del timeline de auditoría ── */
function renderAuditTimeline(auditLog, filtro='all') {
  const log = filtro === 'all'
    ? [...(auditLog||[])].reverse()
    : [...(auditLog||[])].reverse().filter(e => e.tipo === filtro);
  if (!log.length) {
    return `<div class="audit-empty-msg">
      <i class="fa fa-inbox" style="font-size:24px;margin-bottom:6px;display:block;opacity:.3"></i>
      No hay eventos de este tipo.
    </div>`;
  }

  return `<div class="audit-tl">` + log.map((e, idx) => {
    const diffsHTML = e.diffs && e.diffs.length
      ? `<div class="audit-diffs">
          <div class="audit-diffs-titulo"><i class="fa fa-arrows-left-right"></i> ${e.diffs.length} campo(s) modificado(s)</div>
          ${e.diffs.map(d => `
            <div class="audit-diff-row">
              <span class="audit-diff-campo"><i class="fa fa-tag"></i> ${d.campo}</span>
              <span class="audit-diff-antes">${d.antes||'—'}</span>
              <i class="fa fa-arrow-right audit-diff-arrow"></i>
              <span class="audit-diff-despues">${d.despues||'—'}</span>
            </div>`).join('')}
         </div>` : '';

    const tc = (e.tipo || 'editar').replace('_','-');
    const esReciente = idx === 0;

    // Calcular tiempo relativo
    let tiempoRelativo = '';
    if (e.fechaISO) {
      const diff = Date.now() - new Date(e.fechaISO).getTime();
      const min = Math.floor(diff/60000);
      const hrs = Math.floor(diff/3600000);
      const dias = Math.floor(diff/86400000);
      if (min < 1)       tiempoRelativo = 'Ahora mismo';
      else if (min < 60) tiempoRelativo = `Hace ${min} min`;
      else if (hrs < 24) tiempoRelativo = `Hace ${hrs}h`;
      else               tiempoRelativo = `Hace ${dias} día${dias!==1?'s':''}`;
    }

    return `<div class="audit-entry${esReciente?' audit-entry-reciente':''}">
      <div class="audit-icon-col">
        <div class="audit-bubble type-${tc}" title="${AUDIT.LABELS[e.tipo]||e.tipo}">
          ${AUDIT.ICONS[e.tipo]||'📋'}
        </div>
      </div>
      <div class="audit-card">
        <div class="audit-card-top">
          <div class="audit-card-left">
            <span class="audit-card-label">
              ${AUDIT.ICONS[e.tipo]||'📋'} ${e.label}
            </span>
            ${esReciente ? '<span class="audit-reciente-badge">Último</span>' : ''}
          </div>
          <div class="audit-card-meta">
            ${tiempoRelativo ? `<span class="audit-tiempo-relativo">${tiempoRelativo}</span>` : ''}
          </div>
        </div>

        <!-- Bloque de datos: quién, qué, cuándo, dónde -->
        <div class="audit-info-grid">
          <div class="audit-info-item">
            <span class="audit-info-icon">👤</span>
            <div>
              <div class="audit-info-label">Usuario</div>
              <div class="audit-info-valor">${e.usuario || 'Administrador'}</div>
            </div>
          </div>
          <div class="audit-info-item">
            <span class="audit-info-icon">📅</span>
            <div>
              <div class="audit-info-label">Fecha y hora</div>
              <div class="audit-info-valor audit-info-mono">${e.timestamp || '—'}</div>
            </div>
          </div>
          <div class="audit-info-item">
            <span class="audit-info-icon">🌐</span>
            <div>
              <div class="audit-info-label">Dirección IP</div>
              <div class="audit-info-valor audit-info-mono">${e.ip || 'No registrada'}</div>
            </div>
          </div>
          <div class="audit-info-item">
            <span class="audit-info-icon">💻</span>
            <div>
              <div class="audit-info-label">Dispositivo</div>
              <div class="audit-info-valor">${e.dispositivo || 'No registrado'}</div>
            </div>
          </div>
          ${e.sesion ? `<div class="audit-info-item">
            <span class="audit-info-icon">🔑</span>
            <div>
              <div class="audit-info-label">Sesión</div>
              <div class="audit-info-valor audit-info-mono" style="font-size:10px">${e.sesion}</div>
            </div>
          </div>` : ''}
        </div>

        ${e.detalle ? `<div class="audit-card-detalle"><i class="fa fa-circle-info"></i> ${e.detalle}</div>` : ''}
        ${diffsHTML}
      </div>
    </div>`;
  }).join('') + `</div>`;
}

function renderAuditSection(auditLog, filtroActivo, tabClickFn, containerId) {
  const total = (auditLog||[]).length;
  const tipos = [...new Set((auditLog||[]).map(e=>e.tipo))];
  const conteos = {};
  (auditLog||[]).forEach(e=>{ conteos[e.tipo] = (conteos[e.tipo]||0)+1; });

  const tabs = [
    {tipo:'all',   label:'Todos',    count: total},
    {tipo:'crear', label:'Creación', count: conteos['crear']||0},
    {tipo:'editar',label:'Edición',  count: conteos['editar']||0},
    {tipo:'pago',  label:'Pagos',    count: conteos['pago']||0},
    {tipo:'estado',label:'Estado',   count: conteos['estado']||0},
    {tipo:'anular',label:'Anulados', count: conteos['anular']||0},
    {tipo:'eliminar',label:'Eliminados',count:conteos['eliminar']||0},
  ].filter(t => t.tipo==='all' || tipos.includes(t.tipo));

  // Último evento
  const ultimo = [...(auditLog||[])].reverse()[0];

  return `<div class="audit-section">
    <div class="audit-section-head">
      <div class="audit-section-title">
        <i class="fa fa-shield-halved" style="color:var(--dorado)"></i>
        Trazabilidad de cambios
        <span class="audit-count-badge">${total} evento${total!==1?'s':''}</span>
      </div>
      ${ultimo ? `<div class="audit-ultimo-resumen">
        Última acción: <strong>${ultimo.usuario}</strong>
        el <strong>${ultimo.timestamp}</strong>
        desde <code>${ultimo.ip||'—'}</code>
      </div>` : ''}
    </div>
    <div class="audit-tabs">
      ${tabs.map(t=>`
        <button class="audit-tab${filtroActivo===t.tipo?' active':''}"
          onclick="${tabClickFn}('${t.tipo}','${containerId}',this)">
          ${t.label}
          ${t.count>0?`<span class="audit-tab-count">${t.count}</span>`:''}
        </button>`).join('')}
    </div>
    <div class="audit-timeline-wrap" id="${containerId}">
      ${renderAuditTimeline(auditLog, filtroActivo)}
    </div>
  </div>`;
}

function cambiarFiltroAudit(tipo, containerId, btn) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  document.querySelectorAll(`#${containerId}`).forEach(()=>{});
  const tabs = btn.closest('.audit-tabs');
  if (tabs) tabs.querySelectorAll('.audit-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _auditFiltroActual[containerId] = tipo;
  // Re-render con el log guardado en el elemento padre
  const auditLog = _auditLogsActuales[containerId];
  if (auditLog) wrap.innerHTML = renderAuditTimeline(auditLog, tipo);
}
const _auditLogsActuales = {};

/* ════════════════════════════════════════════════════════
   6. LOCALSTORAGE — GUARDAR / CARGAR
════════════════════════════════════════════════════════ */
function guardarEnStorage() {
  try { localStorage.setItem(LS_LIBRO, JSON.stringify(BD)); } catch(e) { console.warn('Error guardando'); }
}

function cargarDesdeStorage() {
  try {
    const raw = localStorage.getItem(LS_LIBRO);
    if (raw) {
      const parsed = JSON.parse(raw);
      BD = { ...BD, ...parsed };
    }
  } catch(e) { console.warn('Error cargando localStorage'); }
}

/* Lee ventas sincronizadas desde venta.html */
function sincronizarVentasExternas() {
  try {
    const raw = localStorage.getItem(LS_VENTAS);
    if (!raw) return;
    const ventasExt = JSON.parse(raw);
    if (!Array.isArray(ventasExt)) return;

    // Integrar ventas externas: no duplicar por id
    const idsActuales = new Set(BD.ventas.filter(v=>v._fuente==='venta').map(v=>v.id));
    let nuevas = 0;
    ventasExt.forEach(comp => {
      if (idsActuales.has(comp.id)) return;
      // Convertir estructura de comprobante de venta.html → estructura de libro.js
      const totalComp = comp.totales?.totalFinal || 0;
      const igvComp   = comp.totales?.igv || 0;
      const subComp   = comp.totales?.subtotalSIGV || 0;
      BD.ventas.unshift({
        id:          comp.id,
        _fuente:     'venta',
        fecha:       comp.fecha ? comp.fecha.split(',')[0].split('/').reverse().join('-') : hoy(),
        fechaOriginal: comp.fecha,
        cliente:     comp.cliente?.nombre || '—',
        ruc:         comp.cliente?.numDoc || '—',
        tipoDoc:     comp.cliente?.tipoDoc || '—',
        tipoComp:    'Comprobante',
        serie:       '',
        numero:      comp.numero || '',
        producto:    comp.items?.map(i=>i.nombre).join(', ') || '—',
        cantidad:    comp.items?.reduce((s,i)=>s+(i.cantidad||0),0) || 0,
        precioUnit:  0,
        subtotal:    subComp,
        igv:         igvComp,
        total:       totalComp,
        medioPago:   comp.pagos?.map(p=>p.nombre).join(', ') || '—',
        estadoPago:  'cobrado',
        cuenta:      '7011',
        auditLog:    [crearEntradaAudit(AUDIT.CREAR,'Venta importada desde módulo de ventas',`Comprobante: ${comp.numero}`)],
        createdAt:   comp.fecha || new Date().toISOString(),
      });
      nuevas++;
    });
    if (nuevas > 0) {
      guardarEnStorage();
      console.log(`[libro.js] ${nuevas} venta(s) sincronizadas desde venta.html`);
    }
  } catch(e) { console.warn('Error sincronizando ventas:', e); }
}

/* Lee productos desde registro.js → los convierte en inversiones */
function sincronizarProductosAlmacen() {
  try {
    const raw = localStorage.getItem(LS_ALMACEN);
    if (!raw) return;
    const productos = JSON.parse(raw);
    if (!Array.isArray(productos)) return;

    // Generar inversiones a partir de productos de almacén
    const invAlmacen = productos.map(p => ({
      id:          'alm_' + p.id,
      _fuente:     'almacen',
      fecha:       p.fechaCompra || p.createdAt?.split('T')[0] || hoy(),
      tipo:        p.categoria || 'Mercadería',
      nombre:      p.nombre || '—',
      codigo:      p.codigo || '—',
      monto:       (p.precioCompra || 0) * (p.cantidadCompra || p.stock || 1),
      precioCompra: p.precioCompra || 0,
      precioVenta:  p.precioVenta || 0,
      stock:        p.stock || 0,
      cantidadCompra: p.cantidadCompra || 0,
      fuente:       p.proveedor || 'Almacén',
      retornoEsp:   (p.precioVenta || 0) * (p.stock || 0),
      retornoReal:  0,
      plazo:        'Según rotación',
      estado:       p.stock > 0 ? 'activa' : 'sin stock',
      obs:          p.info || '',
      createdAt:    p.createdAt || new Date().toISOString(),
    }));

    // Reemplazar inversiones de almacén
    BD.inversiones = [
      ...BD.inversiones.filter(i => i._fuente !== 'almacen'),
      ...invAlmacen,
    ];
    guardarEnStorage();
    console.log(`[libro.js] ${invAlmacen.length} producto(s) de almacén sincronizados como inversiones`);
  } catch(e) { console.warn('Error sincronizando almacén:', e); }
}

/* Sincronización periódica cada 60 segundos */
setInterval(() => {
  sincronizarVentasExternas();
  sincronizarProductosAlmacen();
}, 60000);

setInterval(guardarEnStorage, 30000);

/* ════════════════════════════════════════════════════════
   7. DATOS DE PRUEBA
════════════════════════════════════════════════════════ */
function cargarDatosPrueba() {
  const a = anioActual();
  const clientes = [
    {nombre:'Comercial Lima S.A.',          ruc:'20305678901'},
    {nombre:'Distribuidora Norte E.I.R.L.', ruc:'20412345678'},
    {nombre:'Supermercados Central S.A.C.', ruc:'20198765432'},
    {nombre:'Importaciones del Sur S.A.',   ruc:'20567891234'},
    {nombre:'Tiendas Express S.R.L.',       ruc:'20345678912'},
  ];
  const proveedores = [
    {nombre:'Importadora Pacífico S.A.C.',    ruc:'20611234567'},
    {nombre:'Distribuidora Global E.I.R.L.',  ruc:'20723456789'},
    {nombre:'Logística Andina S.A.',           ruc:'20834567890'},
    {nombre:'Suministros Industriales S.R.L.',ruc:'20945678901'},
  ];
  const catGastos = ['Planilla','Alquiler','Servicios','Marketing','Transporte','Administrativo','Mantenimiento'];

  // VENTAS (3/mes)
  for (let mes = 1; mes <= 12; mes++) {
    for (let i = 0; i < 3; i++) {
      const cli   = clientes[Math.floor(Math.random()*clientes.length)];
      const cant  = Math.floor(Math.random()*10)+1;
      const precio= Math.round((Math.random()*800+200)*100)/100;
      const sub   = Math.round(cant*precio*100)/100;
      const igv   = Math.round(sub*0.18*100)/100;
      const dia   = String(Math.floor(Math.random()*25)+1).padStart(2,'0');
      BD.ventas.push({
        id: generarId(), _fuente: 'libro',
        fecha: `${a}-${String(mes).padStart(2,'0')}-${dia}`,
        cliente: cli.nombre, ruc: cli.ruc, tipoDoc: 'RUC',
        tipoComp:'Factura', serie:'F001',
        numero: String(BD.ventas.length+1).padStart(5,'0'),
        producto: 'Importación mercadería '+nombreMes(mes),
        cantidad: cant, precioUnit: precio,
        subtotal: sub, igv, total: Math.round((sub+igv)*100)/100,
        medioPago: ['Transferencia','Efectivo','Banco','Yape'][Math.floor(Math.random()*4)],
        estadoPago: Math.random()>0.25?'cobrado':'pendiente',
        cuenta: '7011',
        auditLog: [crearEntradaAudit(AUDIT.CREAR,'Venta registrada',`Cliente: ${cli.nombre}`)],
        createdAt: new Date().toISOString(),
      });
    }
  }

  // COMPRAS (2/mes)
  for (let mes = 1; mes <= 12; mes++) {
    for (let i = 0; i < 2; i++) {
      const prov  = proveedores[Math.floor(Math.random()*proveedores.length)];
      const sub   = Math.round((Math.random()*5000+1000)*100)/100;
      const igv   = Math.round(sub*0.18*100)/100;
      const dia   = String(Math.floor(Math.random()*25)+1).padStart(2,'0');
      BD.compras.push({
        id: generarId(),
        fecha: `${a}-${String(mes).padStart(2,'0')}-${dia}`,
        proveedor: prov.nombre, ruc: prov.ruc,
        tipoComp:'Factura', serie:'F001',
        numero: String(BD.compras.length+1).padStart(5,'0'),
        categoria: ['Mercadería','Suministros','Equipos'][Math.floor(Math.random()*3)],
        descripcion: 'Compra de mercadería '+nombreMes(mes),
        subtotal: sub, igv, total: Math.round((sub+igv)*100)/100,
        medioPago: ['Transferencia','Banco'][Math.floor(Math.random()*2)],
        estadoPago: Math.random()>0.2?'pagado':'pendiente',
        cuenta: '6011',
        auditLog: [crearEntradaAudit(AUDIT.CREAR,'Compra registrada',`Proveedor: ${prov.nombre}`)],
        createdAt: new Date().toISOString(),
      });
    }
  }

  // GASTOS (4/mes)
  for (let mes = 1; mes <= 12; mes++) {
    for (let i = 0; i < 4; i++) {
      const cat   = catGastos[Math.floor(Math.random()*catGastos.length)];
      const sub   = Math.round((Math.random()*2000+200)*100)/100;
      const igv   = Math.random()>0.3 ? Math.round(sub*0.18*100)/100 : 0;
      const dia   = String(Math.floor(Math.random()*25)+1).padStart(2,'0');
      BD.gastos.push({
        id: generarId(),
        fecha: `${a}-${String(mes).padStart(2,'0')}-${dia}`,
        categoria: cat, descripcion: cat+' '+nombreMes(mes),
        proveedor: proveedores[Math.floor(Math.random()*proveedores.length)].nombre,
        tipoComp: ['Factura','Boleta','Recibo'][Math.floor(Math.random()*3)],
        serie:'B001', numero: String(BD.gastos.length+1).padStart(5,'0'),
        subtotal: sub, igv, total: Math.round((sub+igv)*100)/100,
        medioPago: ['Efectivo','Transferencia','Banco'][Math.floor(Math.random()*3)],
        estadoPago: Math.random()>0.15?'pagado':'pendiente',
        cuenta:'94', centro:['Administración','Ventas','Logística'][Math.floor(Math.random()*3)],
        auditLog: [crearEntradaAudit(AUDIT.CREAR,'Gasto registrado',`Categoría: ${cat}`)],
        createdAt: new Date().toISOString(),
      });
    }
  }

  // INVERSIONES propias del libro (4)
  const tiposInv = ['Maquinaria','Tecnología','Vehículo','Infraestructura'];
  for (let i = 0; i < 4; i++) {
    const monto  = Math.round((Math.random()*40000+10000)*100)/100;
    const retEsp = Math.round(monto*(Math.random()*0.25+0.08)*100)/100;
    BD.inversiones.push({
      id: generarId(), _fuente: 'libro',
      fecha: `${a}-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-01`,
      tipo: tiposInv[i], nombre: tiposInv[i]+' #'+(i+1),
      monto, fuente: ['Capital propio','Préstamo BCP','Préstamo BBVA'][Math.floor(Math.random()*3)],
      retornoEsp: retEsp, retornoReal: i<2 ? Math.round(retEsp*0.9*100)/100 : 0,
      plazo: Math.floor(Math.random()*24+6)+' meses',
      estado: i===1?'cerrada':'activa', obs: '',
      auditLog: [crearEntradaAudit(AUDIT.CREAR,'Inversión registrada',`Tipo: ${tiposInv[i]}`)],
      createdAt: new Date().toISOString(),
    });
  }

  // ASIENTOS (5 tipos/mes)
  const tiposAs = [
    {tipo:'venta',  cuenta:'7011',glosa:'Venta mercadería importada',    haber:true},
    {tipo:'ingreso',cuenta:'1041',glosa:'Depósito en cuenta corriente',  haber:true},
    {tipo:'compra', cuenta:'6011',glosa:'Compra mercadería proveedores', haber:false},
    {tipo:'gasto',  cuenta:'94',  glosa:'Gastos administrativos del mes',haber:false},
    {tipo:'egreso', cuenta:'42',  glosa:'Pago a proveedores',            haber:false},
  ];
  for (let mes = 1; mes <= 12; mes++) {
    tiposAs.forEach(ta => {
      const monto = Math.round((Math.random()*5000+500)*100)/100;
      const dia   = String(Math.floor(Math.random()*25)+1).padStart(2,'0');
      const cta   = PLAN_CONTABLE.find(c=>c.codigo===ta.cuenta);
      BD.asientos.push({
        id: generarId(),
        correlativo: String(BD.asientos.length+1).padStart(6,'0'),
        fecha: `${a}-${String(mes).padStart(2,'0')}-${dia}`,
        tipo: ta.tipo, estado: 'registrado',
        glosa: ta.glosa+' '+nombreMes(mes),
        codCuenta: ta.cuenta, denomCuenta: cta?cta.nombre:'',
        debe: ta.haber?0:monto, haber: ta.haber?monto:0, monto,
        moneda:'PEN', tipoDoc:'Factura', serie:'F001',
        numero: String(BD.asientos.length+1).padStart(5,'0'),
        medioPago: ['Efectivo','Transferencia','Banco'][Math.floor(Math.random()*3)],
        rucDni: '20'+String(Math.random()).slice(2,13),
        nombreCP: 'Empresa Prueba '+(BD.asientos.length+1)+' S.A.C.',
        centro: 'Administración',
        categoria: ta.tipo.charAt(0).toUpperCase()+ta.tipo.slice(1),
        obs:'', usuario: BD.config.usuario,
        auditLog: [crearEntradaAudit(AUDIT.CREAR,'Asiento registrado')],
        createdAt: new Date().toISOString(),
      });
    });
  }

  // CxC extra ejemplo
  BD.cxcExtra = [{
    id: generarId(), tipo:'manual',
    fecha: hoy(), cliente:'Cliente Ejemplo S.A.',
    ruc:'20111222333', concepto:'Factura pendiente de cobro',
    tipoComp:'Factura', numero:'F001-00001',
    total:5000, cobrado:0, saldo:5000,
    vencimiento: `${anioActual()}-${String(mesActual()+1).padStart(2,'0')}-15`,
    estadoPago:'pendiente',
    auditLog:[crearEntradaAudit(AUDIT.CREAR,'CxC registrada manualmente')],
    createdAt: new Date().toISOString(),
  }];

  // CxP extra ejemplo
  BD.cxpExtra = [{
    id: generarId(), tipo:'manual',
    fecha: hoy(), proveedor:'Proveedor Ejemplo E.I.R.L.',
    ruc:'20444555666', concepto:'Factura pendiente de pago',
    tipoComp:'Factura', numero:'F001-00100',
    total:3500, pagado:0, saldo:3500,
    vencimiento: `${anioActual()}-${String(mesActual()+1).padStart(2,'0')}-20`,
    estadoPago:'pendiente',
    auditLog:[crearEntradaAudit(AUDIT.CREAR,'CxP registrada manualmente')],
    createdAt: new Date().toISOString(),
  }];

  guardarEnStorage();
}

/* ════════════════════════════════════════════════════════
   8. INICIALIZACIÓN
════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  cargarDesdeStorage();
  sincronizarVentasExternas();
  sincronizarProductosAlmacen();
  if (!BD.ventas.length && !BD.asientos.length) cargarDatosPrueba();
  actualizarFechaTopbar();
  setInterval(actualizarFechaTopbar, 60000);
  actualizarInfoEmpresa();
  llenarSelectoresAnio();
  renderDashboard();
  renderExportaciones();
  renderConfigForm();
  // Cerrar modales con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-bg.abierto').forEach(m=>m.classList.remove('abierto'));
  });
  // Cerrar modales al hacer click en el fondo
  document.querySelectorAll('.modal-bg').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('abierto'); });
  });
});

function actualizarFechaTopbar() {
  const el = document.getElementById('fechaTopbar');
  if (el) el.textContent = new Date().toLocaleDateString('es-PE',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
}

function actualizarInfoEmpresa() {
  const sub = document.getElementById('subEmpresa');
  if (sub) sub.textContent = `${BD.config.empresa} — RUC: ${BD.config.ruc} — ${BD.config.ejercicio}`;
  const av  = document.getElementById('avatarSidebar');
  if (av)  av.textContent = (BD.config.usuario||'AD').substring(0,2).toUpperCase();
  const nom = document.getElementById('usuarioNombre');
  if (nom) nom.textContent = BD.config.usuario||'Administrador';
  const rol = document.getElementById('usuarioRol');
  if (rol) rol.textContent = BD.config.contador||'Contador Principal';
}

function llenarSelectoresAnio() {
  const a = anioActual();
  ['selectorAnioGrafico','compAnio'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    for (let y = a; y >= a-3; y--) el.innerHTML += `<option value="${y}" ${y===a?'selected':''}>${y}</option>`;
  });
  const cm = document.getElementById('compMes');
  if (cm) cm.value = mesActual();
}

/* ════════════════════════════════════════════════════════
   9. NAVEGACIÓN
════════════════════════════════════════════════════════ */
const TITULOS = {
  dashboard:'Dashboard General', libroDiario:'Libro Diario',
  libroMayor:'Libro Mayor', balances:'Inventarios y Balances',
  ventas:'Registro de Ventas', compras:'Registro de Compras',
  gastos:'Registro de Gastos', inversiones:'Registro de Inversiones',
  caja:'Caja y Bancos', cxc:'Cuentas por Cobrar', cxp:'Cuentas por Pagar',
  reportes:'Reportes Financieros', comparaciones:'Comparaciones por Período',
  exportaciones:'Exportaciones', config:'Configuración de Empresa',
};

function mostrarSeccion(id, btn) {
  // Sincronizar antes de navegar
  sincronizarVentasExternas();
  sincronizarProductosAlmacen();

  document.querySelectorAll('.seccion').forEach(s=>s.classList.remove('activo'));
  const sec = document.getElementById('s-'+id);
  if (sec) sec.classList.add('activo');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('activo'));
  if (btn) btn.classList.add('activo');
  else {
    const b = document.querySelector(`.nav-item[data-seccion="${id}"]`);
    if (b) b.classList.add('activo');
  }
  const tEl = document.getElementById('topbarTitulo');
  if (tEl) tEl.textContent = TITULOS[id]||id;

  switch(id) {
    case 'dashboard':     renderDashboard();          break;
    case 'libroDiario':   renderLibroDiario();        break;
    case 'libroMayor':    renderLibroMayor();         break;
    case 'balances':      calcularBalances();         break;
    case 'ventas':        renderSeccionVentas();      break;
    case 'compras':       renderSeccionCompras();     break;
    case 'gastos':        renderSeccionGastos();      break;
    case 'inversiones':   renderSeccionInversiones(); break;
    case 'caja':          renderCaja();               break;
    case 'cxc':           renderCxc();                break;
    case 'cxp':           renderCxp();                break;
    case 'reportes':      renderReportes();           break;
    case 'comparaciones': renderComparaciones();      break;
  }
  if (window.innerWidth <= 900) document.getElementById('sidebar')?.classList.remove('abierto');
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const main = document.querySelector('.contenido-principal');
  if (window.innerWidth <= 900) sb?.classList.toggle('abierto');
  else { sb?.classList.toggle('colapsado'); main?.classList.toggle('expandido'); }
}

function cambiarTema() {
  const html = document.documentElement;
  html.setAttribute('data-theme', html.getAttribute('data-theme')==='dark'?'light':'dark');
}

/* ════════════════════════════════════════════════════════
   10. TOAST Y CONFIRM
════════════════════════════════════════════════════════ */
function toast(mensaje, tipo='') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const div = document.createElement('div');
  const cls = tipo==='exito'||tipo==='success'?'exito':tipo==='error'||tipo==='danger'?'error':tipo==='alerta'||tipo==='warn'?'alerta':'';
  const ico = cls==='exito'?'fa-check-circle':cls==='error'?'fa-circle-xmark':cls==='alerta'?'fa-triangle-exclamation':'fa-info-circle';
  div.className = `toast ${cls}`;
  div.innerHTML = `<i class="fa ${ico}"></i><span>${mensaje}</span>`;
  wrap.appendChild(div);
  setTimeout(()=>{ div.style.opacity='0'; setTimeout(()=>div.remove(),300); }, 3200);
}

function mostrarConfirm(titulo, mensaje, cb) {
  fnConfirmar = cb;
  document.getElementById('confirmTitulo').innerHTML = `<i class="fa fa-triangle-exclamation"></i> ${titulo}`;
  document.getElementById('confirmMensaje').textContent = mensaje;
  document.getElementById('btnConfirmAceptar').onclick = ()=>{ if(fnConfirmar)fnConfirmar(); cerrarConfirm(); };
  abrirModal('modalConfirm');
}
function cerrarConfirm() { cerrarModal('modalConfirm'); }
function abrirModal(id)  { document.getElementById(id)?.classList.add('abierto'); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('abierto'); }

/* ════════════════════════════════════════════════════════
   11. CÁLCULOS FINANCIEROS — FILTROS POR PERÍODO
════════════════════════════════════════════════════════ */

/* Filtros de período para ventas */
function ventasPorPeriodo(tipo='total', valor=null, anio=null) {
  const a = anio || anioActual();
  return BD.ventas.filter(v => {
    if (getAnio(v.fecha) !== a && tipo !== 'total') return false;
    if (tipo === 'dia')       return v.fecha === valor;
    if (tipo === 'semana')    return getSemana(v.fecha) === parseInt(valor);
    if (tipo === 'mes')       return getMes(v.fecha) === parseInt(valor);
    if (tipo === 'trimestre') return getTrimestre(v.fecha) === parseInt(valor);
    if (tipo === 'anio')      return getAnio(v.fecha) === a;
    return true; // total
  });
}

const totalVentas      = (v=BD.ventas)  => v.reduce((s,x)=>s+(x.total||0),0);
const totalCompras     = (c=BD.compras) => c.reduce((s,x)=>s+(x.total||0),0);
const totalGastos      = (g=BD.gastos)  => g.reduce((s,x)=>s+(x.total||0),0);
const totalInversiones = ()             => BD.inversiones.reduce((s,i)=>s+(i.monto||0),0);
const igvVentas        = (v=BD.ventas)  => v.reduce((s,x)=>s+(x.igv||0),0);
const igvCompras       = (c=BD.compras) => c.reduce((s,x)=>s+(x.igv||0),0);
const igvPagar         = ()             => Math.max(0, igvVentas()-igvCompras());
const utilidadBruta    = ()             => totalVentas()-totalCompras();
const utilidadNeta     = ()             => totalVentas()-totalCompras()-totalGastos();
const margenUtilidad   = ()             => { const v=totalVentas(); return v>0?(utilidadNeta()/v)*100:0; };
const calcIngresos     = ()             => BD.ventas.filter(v=>v.estadoPago==='cobrado').reduce((s,v)=>s+(v.total||0),0);
const calcEgresos      = ()             => totalCompras()+totalGastos();
const saldoCaja        = ()             => calcIngresos()-calcEgresos();
const roiInversiones   = ()             => {
  const inv=totalInversiones(); const ret=BD.inversiones.reduce((s,i)=>s+(i.retornoReal||0),0);
  return inv>0?(ret/inv)*100:0;
};
const capitalTrabajo   = ()             => (saldoCaja()+totalCxC()) - totalCxP();
const ratioLiquidez    = ()             => { const pc=totalCxP(); const ac=saldoCaja()+totalCxC(); return pc>0?ac/pc:(ac>0?99:0); };

const totalCxC = () => {
  const fromVentas  = BD.ventas.filter(v=>v.estadoPago!=='cobrado').reduce((s,v)=>s+(v.total||0),0);
  const fromExtra   = (BD.cxcExtra||[]).filter(c=>c.estadoPago!=='cobrado').reduce((s,c)=>s+(c.saldo||c.total||0),0);
  return fromVentas + fromExtra;
};
const totalCxP = () => {
  const fromCompras = BD.compras.filter(c=>c.estadoPago!=='pagado').reduce((s,c)=>s+(c.total||0),0);
  const fromGastos  = BD.gastos.filter(g=>g.estadoPago!=='pagado').reduce((s,g)=>s+(g.total||0),0);
  const fromExtra   = (BD.cxpExtra||[]).filter(c=>c.estadoPago!=='pagado').reduce((s,c)=>s+(c.saldo||c.total||0),0);
  return fromCompras + fromGastos + fromExtra;
};

/* ════════════════════════════════════════════════════════
   12. BADGES
════════════════════════════════════════════════════════ */
function badgeTipo(t) {
  const m={ingreso:'badge-verde',egreso:'badge-rojo',venta:'badge-azul',compra:'badge-ambar',gasto:'badge-rojo','inversión':'badge-morado',transferencia:'badge-gris',ajuste:'badge-gris'};
  return m[t]||'badge-gris';
}
function badgeEstado(e) {
  const m={registrado:'badge-verde',pendiente:'badge-ambar',anulado:'badge-rojo',revisado:'badge-azul'};
  return m[e]||'badge-gris';
}
function badgePago(e) {
  if (e==='cobrado'||e==='pagado') return 'badge-verde';
  if (e==='parcial') return 'badge-ambar';
  return 'badge-rojo';
}

/* ════════════════════════════════════════════════════════
   13. DASHBOARD
════════════════════════════════════════════════════════ */
function renderDashboard() {
  const anio = parseInt(document.getElementById('selectorAnioGrafico')?.value || anioActual());
  const venAnio = BD.ventas.filter(v=>getAnio(v.fecha)===anio);

  // KPI Cards
  const kpis = [
    {label:'Total Ventas',       valor:totalVentas(venAnio),  tipo:'kpi-dorado', icono:'fa-cart-plus'},
    {label:'Ingresos Cobrados',  valor:calcIngresos(),        tipo:'kpi-verde',  icono:'fa-arrow-trend-up'},
    {label:'Egresos',            valor:calcEgresos(),         tipo:'kpi-rojo',   icono:'fa-arrow-trend-down'},
    {label:'Utilidad Bruta',     valor:utilidadBruta(),       tipo:'kpi-azul',   icono:'fa-calculator'},
    {label:'Utilidad Neta',      valor:utilidadNeta(),        tipo:utilidadNeta()>=0?'kpi-verde':'kpi-rojo', icono:'fa-sack-dollar'},
    {label:'Saldo de Caja',      valor:saldoCaja(),           tipo:saldoCaja()>=0?'kpi-verde':'kpi-rojo',   icono:'fa-cash-register'},
    {label:'Cuentas por Cobrar', valor:totalCxC(),            tipo:'kpi-ambar',  icono:'fa-file-invoice-dollar'},
    {label:'Cuentas por Pagar',  valor:totalCxP(),            tipo:'kpi-rojo',   icono:'fa-hand-holding-dollar'},
    {label:'IGV por Pagar',      valor:igvPagar(),            tipo:'kpi-morado', icono:'fa-percent'},
    {label:'Total Inversiones',  valor:totalInversiones(),    tipo:'kpi-azul',   icono:'fa-chart-line'},
    {label:'Margen Utilidad',    valor:margenUtilidad(),      tipo:'kpi-verde',  icono:'fa-chart-pie', esPct:true},
    {label:'ROI Inversiones',    valor:roiInversiones(),      tipo:'kpi-morado', icono:'fa-trophy',    esPct:true},
  ];

  const kpiEl = document.getElementById('kpiDashboard');
  if (kpiEl) kpiEl.innerHTML = kpis.map(k=>`
    <div class="kpi-card ${k.tipo}">
      <span class="kpi-icono"><i class="fa ${k.icono}"></i></span>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-valor">${k.esPct?pct(k.valor):dinero(k.valor)}</div>
    </div>`).join('');

  // Salud financiera
  const saludEl = document.getElementById('saludFinanciera');
  if (saludEl) {
    const rl = Math.min(100,ratioLiquidez()*50);
    const mg = Math.max(0,Math.min(100,margenUtilidad()));
    const ri = Math.max(0,Math.min(100,roiInversiones()));
    const cc = totalVentas()>0?Math.min(100,(1-totalCxC()/totalVentas())*100):0;
    const items = [
      {label:'Liquidez',  valor:rl, color:rl>=50?'var(--verde)':'var(--ambar)', desc:`Ratio: ${ratioLiquidez().toFixed(2)}`},
      {label:'Margen',    valor:mg, color:mg>10?'var(--verde)':mg>0?'var(--ambar)':'var(--rojo)', desc:pct(margenUtilidad())},
      {label:'ROI',       valor:ri, color:ri>15?'var(--verde)':'var(--ambar)',  desc:pct(roiInversiones())},
      {label:'Cobranza',  valor:cc, color:'var(--azul)',                        desc:pct(cc)+' cobrado'},
    ];
    saludEl.innerHTML = `
      <div class="salud-titulo">
        <span><i class="fa fa-heart-pulse" style="color:var(--dorado)"></i>&nbsp;Salud Financiera</span>
        <span style="font-size:11px;color:var(--texto3)">${BD.config.empresa}</span>
      </div>
      <div class="salud-items">
        ${items.map(it=>`
          <div class="salud-item">
            <div class="salud-item-label"><span>${it.label}</span><span>${it.desc}</span></div>
            <div class="barra"><div class="barra-fill" style="width:${it.valor}%;background:${it.color}"></div></div>
          </div>`).join('')}
      </div>`;
  }

  // Alertas
  const alertasEl = document.getElementById('alertasTopbar');
  if (alertasEl) {
    alertasEl.innerHTML = '';
    if (utilidadNeta()<0)    alertasEl.innerHTML += `<span class="alerta-pill alerta-peligro"><i class="fa fa-triangle-exclamation"></i> Pérdida neta</span>`;
    if (saldoCaja()<0)       alertasEl.innerHTML += `<span class="alerta-pill alerta-aviso"><i class="fa fa-cash-register"></i> Caja negativa</span>`;
    if (totalCxC()>0)        alertasEl.innerHTML += `<span class="alerta-pill alerta-aviso"><i class="fa fa-file-invoice-dollar"></i> CxC: ${dinero(totalCxC())}</span>`;
    // Badge ventas de venta.html
    try {
      const vExt = JSON.parse(localStorage.getItem(LS_VENTAS)||'[]');
      if (vExt.length) alertasEl.innerHTML += `<span class="alerta-pill alerta-ok"><i class="fa fa-link"></i> ${vExt.length} venta(s) de módulo ventas</span>`;
    } catch(e){}
  }

  // Rankings
  renderRankings();

  // Últimos movimientos
  const ultEl = document.getElementById('ultimosMovimientos');
  if (ultEl) {
    const rec = [...BD.asientos].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,8);
    if (!rec.length) {
      ultEl.innerHTML = `<div class="tabla-vacia"><i class="fa fa-inbox"></i><p>Sin movimientos</p></div>`;
    } else {
      ultEl.innerHTML = `<table>
        <thead><tr><th>N°</th><th>Fecha</th><th>Cuenta</th><th>Glosa</th><th>Tipo</th><th>Debe</th><th>Haber</th><th>Estado</th><th></th></tr></thead>
        <tbody>${rec.map(a=>`<tr>
          <td class="mono">${a.correlativo}</td>
          <td>${fechaCorta(a.fecha)}</td>
          <td><span class="badge badge-navy">${a.codCuenta||'—'}</span></td>
          <td style="max-width:180px;font-size:12px">${a.glosa||'—'}</td>
          <td><span class="badge ${badgeTipo(a.tipo)}">${a.tipo||'—'}</span></td>
          <td style="color:var(--verde)">${a.debe>0?dinero(a.debe):'—'}</td>
          <td style="color:var(--rojo)">${a.haber>0?dinero(a.haber):'—'}</td>
          <td><span class="badge ${badgeEstado(a.estado)}">${a.estado||'—'}</span></td>
          <td><button class="btn-icono" onclick="verDetalleAsiento('${a.id}')" title="Ver detalle"><i class="fa fa-eye"></i></button></td>
        </tr>`).join('')}</tbody>
      </table>`;
    }
  }

  renderGraficosDashboard(anio);
}

function renderRankings() {
  // Top Clientes
  const cli = {};
  BD.ventas.forEach(v=>{ cli[v.cliente]=(cli[v.cliente]||0)+(v.total||0); });
  const topCli = Object.entries(cli).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const rcEl = document.getElementById('rankingClientes');
  if (rcEl) rcEl.innerHTML = topCli.map(([n,v],i)=>`
    <div class="rank-item">
      <div class="rank-pos ${i===0?'oro':i===1?'plata':i===2?'bronce':''}">${i+1}</div>
      <div class="rank-nombre">${n}</div>
      <div class="rank-valor">${dinero(v)}</div>
    </div>`).join('') || '<p style="color:var(--texto3);font-size:12px">Sin datos</p>';

  // Top Proveedores
  const prov = {};
  BD.compras.forEach(c=>{ prov[c.proveedor]=(prov[c.proveedor]||0)+(c.total||0); });
  BD.gastos.forEach(g=>{ if(g.proveedor) prov[g.proveedor]=(prov[g.proveedor]||0)+(g.total||0); });
  const topProv = Object.entries(prov).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const rpEl = document.getElementById('rankingProveedores');
  if (rpEl) rpEl.innerHTML = topProv.map(([n,v],i)=>`
    <div class="rank-item">
      <div class="rank-pos ${i===0?'oro':i===1?'plata':i===2?'bronce':''}">${i+1}</div>
      <div class="rank-nombre">${n}</div>
      <div class="rank-valor">${dinero(v)}</div>
    </div>`).join('') || '<p style="color:var(--texto3);font-size:12px">Sin datos</p>';

  // Top Categorías gasto
  const cats = {};
  BD.gastos.forEach(g=>{ cats[g.categoria]=(cats[g.categoria]||0)+(g.total||0); });
  const topCats = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const rkEl = document.getElementById('rankingCategorias');
  if (rkEl) rkEl.innerHTML = topCats.map(([n,v],i)=>`
    <div class="rank-item">
      <div class="rank-pos ${i===0?'oro':i===1?'plata':i===2?'bronce':''}">${i+1}</div>
      <div class="rank-nombre">${n}</div>
      <div class="rank-valor">${dinero(v)}</div>
    </div>`).join('') || '<p style="color:var(--texto3);font-size:12px">Sin datos</p>';
}

/* ════════════════════════════════════════════════════════
   14. GRÁFICOS CHART.JS
════════════════════════════════════════════════════════ */
const COLORES = ['#C49A2A','#1D4ED8','#157a3f','#B91C1C','#6D28D9','#0F7490','#92400E','#0B1C35','#22c55e','#f59e0b','#3b82f6','#a855f7'];

function crearGrafico(canvasId, tipo, datos, opciones={}) {
  if (graficos[canvasId]) { try { graficos[canvasId].destroy(); } catch(e){} }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  graficos[canvasId] = new Chart(canvas.getContext('2d'),{
    type: tipo, data: datos,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      ...opciones
    }
  });
}

function renderGraficosDashboard(anio) {
  const venMes=Array(12).fill(0), comMes=Array(12).fill(0), gasMes=Array(12).fill(0);
  BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
  BD.compras.filter(c=>getAnio(c.fecha)===anio).forEach(c=>{comMes[getMes(c.fecha)-1]+=c.total||0;});
  BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{gasMes[getMes(g.fecha)-1]+=g.total||0;});
  const egrMes=comMes.map((c,i)=>c+gasMes[i]);
  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  crearGrafico('graficoIngEgr','line',{labels:MESES,datasets:[
    {label:'Ingresos',data:venMes,borderColor:'#157a3f',backgroundColor:'rgba(21,122,63,.08)',tension:.4,fill:true,borderWidth:2,pointRadius:3},
    {label:'Egresos', data:egrMes,borderColor:'#B91C1C',backgroundColor:'rgba(185,28,28,.08)',tension:.4,fill:true,borderWidth:2,pointRadius:3},
  ]},{plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'}}}});

  crearGrafico('graficoVentas','bar',{labels:MESES,datasets:[
    {label:'Ventas',data:venMes,backgroundColor:'#C49A2Abb',borderRadius:5}
  ]},{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'}}}});

  let acum=0;
  const flujo=venMes.map((v,i)=>{acum+=v-egrMes[i];return Math.round(acum*100)/100;});
  crearGrafico('graficoFlujo','line',{labels:MESES,datasets:[
    {label:'Flujo acum.',data:flujo,borderColor:'#C49A2A',backgroundColor:'rgba(196,154,42,.1)',tension:.4,fill:true,borderWidth:2}
  ]},{plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(0,0,0,.05)'}}}});

  const catsDash={};
  BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{catsDash[g.categoria]=(catsDash[g.categoria]||0)+(g.total||0);});
  const cLabels=Object.keys(catsDash), cValues=Object.values(catsDash);
  crearGrafico('graficoGastosPie','doughnut',{labels:cLabels,datasets:[
    {data:cValues,backgroundColor:COLORES.slice(0,cLabels.length),borderWidth:0}
  ]},{plugins:{legend:{position:'bottom',labels:{font:{size:11}}}},cutout:'60%'});
}

function renderGraficoDashboard() {
  const anio=parseInt(document.getElementById('selectorAnioGrafico')?.value||anioActual());
  renderGraficosDashboard(anio);
}

/* ════════════════════════════════════════════════════════
   15. AUTOCOMPLETE PLAN CONTABLE
════════════════════════════════════════════════════════ */
function buscarCuenta(input) {
  const val=input.value.toLowerCase();
  const dd=document.getElementById('dropdownCuenta');
  if(!dd)return;
  if(!val){dd.classList.remove('visible');return;}
  const res=PLAN_CONTABLE.filter(c=>c.codigo.startsWith(val)||c.nombre.toLowerCase().includes(val)).slice(0,10);
  if(!res.length){dd.classList.remove('visible');return;}
  dd.innerHTML=res.map(c=>`
    <div class="cuenta-opcion" onclick="seleccionarCuenta('${c.codigo}','${c.nombre.replace(/'/g,"\\'")}')">
      <span class="cuenta-codigo">${c.codigo}</span>
      <span class="cuenta-nombre">${c.nombre}</span>
    </div>`).join('');
  dd.classList.add('visible');
}

function seleccionarCuenta(codigo,nombre) {
  const inp=document.getElementById('fCodCuenta');
  const denom=document.getElementById('fDenomCuenta');
  const dd=document.getElementById('dropdownCuenta');
  if(inp)inp.value=codigo; if(denom)denom.value=nombre; if(dd)dd.classList.remove('visible');
}

document.addEventListener('click',(e)=>{
  const dd=document.getElementById('dropdownCuenta');
  const inp=document.getElementById('fCodCuenta');
  if(dd&&inp&&!dd.contains(e.target)&&!inp.contains(e.target))dd.classList.remove('visible');
});

/* ════════════════════════════════════════════════════════
   16. MODAL FLOTANTE — ASIENTOS CONTABLES
════════════════════════════════════════════════════════ */
function abrirNuevoAsiento(id=null) {
  idEditando = id;
  const a    = id ? BD.asientos.find(x=>x.id===id) : null;
  const corr = a ? a.correlativo : siguienteCorrelativo();
  const v    = (f,d='') => a?(a[f]??d):d;

  document.getElementById('modalAsientoTitulo').innerHTML=`<i class="fa fa-file-invoice"></i> ${id?'Editar':'Nuevo'} Asiento #${corr}`;
  document.getElementById('modalAsientoBody').innerHTML=`
  <div class="form-seccion-titulo"><i class="fa fa-hashtag"></i> Datos Generales</div>
  <div class="form-grid cols-4">
    <div class="form-group">
      <label class="form-label">N° Correlativo</label>
      <input type="text" id="fCorrelativo" value="${v('correlativo',corr)}" readonly style="background:var(--superficie2)"/>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha <span class="req">*</span></label>
      <input type="date" id="fFecha" value="${v('fecha',hoy())}"/>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de Movimiento <span class="req">*</span></label>
      <select id="fTipo">
        ${['ingreso','egreso','venta','compra','gasto','inversión','transferencia','ajuste','apertura','cierre']
          .map(t=>`<option value="${t}" ${v('tipo')===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Estado</label>
      <select id="fEstado">
        ${['registrado','pendiente','anulado','revisado']
          .map(t=>`<option value="${t}" ${v('estado','registrado')===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-grid cols-3">
    <div class="form-group" style="grid-column:span 2">
      <label class="form-label">Glosa / Descripción <span class="req">*</span></label>
      <input type="text" id="fGlosa" value="${v('glosa')}" placeholder="Descripción de la operación"/>
    </div>
    <div class="form-group">
      <label class="form-label">Usuario responsable</label>
      <input type="text" id="fUsuario" value="${v('usuario',BD.config.usuario)}"/>
    </div>
  </div>
  <div class="form-seccion-titulo"><i class="fa fa-book"></i> Cuenta Contable</div>
  <div class="form-grid cols-3">
    <div class="form-group">
      <label class="form-label">Código de Cuenta <span class="req">*</span></label>
      <div class="cuenta-wrap">
        <input type="text" id="fCodCuenta" value="${v('codCuenta')}" placeholder="Ej: 70, 60, 42..." oninput="buscarCuenta(this)"/>
        <div class="cuenta-dropdown" id="dropdownCuenta"></div>
      </div>
    </div>
    <div class="form-group" style="grid-column:span 2">
      <label class="form-label">Denominación de Cuenta</label>
      <input type="text" id="fDenomCuenta" value="${v('denomCuenta')}" placeholder="Se completa automáticamente"/>
    </div>
  </div>
  <div class="form-seccion-titulo"><i class="fa fa-calculator"></i> Importes</div>
  <div class="form-grid cols-4">
    <div class="form-group">
      <label class="form-label">Debe</label>
      <input type="number" id="fDebe" value="${v('debe',0)}" step="0.01" min="0" oninput="calcularMonto()"/>
    </div>
    <div class="form-group">
      <label class="form-label">Haber</label>
      <input type="number" id="fHaber" value="${v('haber',0)}" step="0.01" min="0" oninput="calcularMonto()"/>
    </div>
    <div class="form-group">
      <label class="form-label">Monto Total</label>
      <input type="number" id="fMonto" value="${v('monto',0)}" step="0.01" min="0"/>
    </div>
    <div class="form-group">
      <label class="form-label">Moneda</label>
      <select id="fMoneda">${['PEN','USD','EUR'].map(m=>`<option ${v('moneda','PEN')===m?'selected':''}>${m}</option>`).join('')}</select>
    </div>
  </div>
  <div class="form-seccion-titulo"><i class="fa fa-file-invoice"></i> Documento Sustentatorio</div>
  <div class="form-grid cols-4">
    <div class="form-group">
      <label class="form-label">Tipo Documento</label>
      <select id="fTipoDoc">
        ${['Factura','Boleta','Nota de crédito','Nota de débito','Guía','Recibo','Contrato','Otro']
          .map(t=>`<option ${v('tipoDoc')===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">Serie</label><input type="text" id="fSerie" value="${v('serie')}" placeholder="F001"/></div>
    <div class="form-group"><label class="form-label">N° Documento</label><input type="text" id="fNumero" value="${v('numero')}" placeholder="00001"/></div>
    <div class="form-group">
      <label class="form-label">Medio de Pago</label>
      <select id="fMedioPago">
        ${['Efectivo','Banco','Transferencia','Tarjeta','Yape','Plin','Cheque','Otro']
          .map(t=>`<option ${v('medioPago')===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-seccion-titulo"><i class="fa fa-user"></i> Cliente / Proveedor</div>
  <div class="form-grid cols-3">
    <div class="form-group"><label class="form-label">RUC / DNI</label><input type="text" id="fRucDni" value="${v('rucDni')}" placeholder="20xxxxxxxxx"/></div>
    <div class="form-group" style="grid-column:span 2"><label class="form-label">Nombre cliente / proveedor</label><input type="text" id="fNombreCP" value="${v('nombreCP')}" placeholder="Razón social o nombre"/></div>
  </div>
  <div class="form-seccion-titulo"><i class="fa fa-tags"></i> Clasificación</div>
  <div class="form-grid cols-3">
    <div class="form-group"><label class="form-label">Centro de Costo</label><input type="text" id="fCentro" value="${v('centro')}" placeholder="Administración, Ventas..."/></div>
    <div class="form-group"><label class="form-label">Categoría Financiera</label><input type="text" id="fCategoria" value="${v('categoria')}" placeholder="Operativo, Inversión..."/></div>
    <div class="form-group"><label class="form-label">Observaciones</label><input type="text" id="fObs" value="${v('obs')}" placeholder="Notas adicionales"/></div>
  </div>
  ${id ? renderAuditSection(a.auditLog||[],'all','cambiarFiltroAudit','auditAsientoModal') : ''}`;

  if (id && a) { _auditLogsActuales['auditAsientoModal'] = a.auditLog||[]; }
  abrirModal('modalAsiento');
}

function calcularMonto() {
  const d=parseFloat(document.getElementById('fDebe')?.value)||0;
  const h=parseFloat(document.getElementById('fHaber')?.value)||0;
  const el=document.getElementById('fMonto');
  if(el) el.value=Math.max(d,h).toFixed(2);
}

function limpiarFormAsiento() {
  document.querySelectorAll('#modalAsientoBody input:not([readonly]), #modalAsientoBody select').forEach(el=>{
    if(el.type==='date')el.value=hoy();
    else if(el.type==='number')el.value=0;
    else if(el.tagName==='SELECT')el.selectedIndex=0;
    else el.value='';
  });
  const c=document.getElementById('fCorrelativo'); if(c)c.value=siguienteCorrelativo();
}

function guardarAsiento() {
  const datos = {
    correlativo: leerCampo('fCorrelativo'), fecha:leerCampo('fFecha'), tipo:leerCampo('fTipo'),
    estado:leerCampo('fEstado'), glosa:leerCampo('fGlosa'), usuario:leerCampo('fUsuario'),
    codCuenta:leerCampo('fCodCuenta'), denomCuenta:leerCampo('fDenomCuenta'),
    debe:leerNumero('fDebe'), haber:leerNumero('fHaber'), monto:leerNumero('fMonto'),
    moneda:leerCampo('fMoneda'), tipoDoc:leerCampo('fTipoDoc'), serie:leerCampo('fSerie'),
    numero:leerCampo('fNumero'), medioPago:leerCampo('fMedioPago'),
    rucDni:leerCampo('fRucDni'), nombreCP:leerCampo('fNombreCP'),
    centro:leerCampo('fCentro'), categoria:leerCampo('fCategoria'), obs:leerCampo('fObs'),
  };
  if(!datos.fecha){toast('La fecha es obligatoria','error');return;}
  if(!datos.glosa){toast('La glosa es obligatoria','error');return;}
  if(!datos.codCuenta){toast('El código de cuenta es obligatorio','error');return;}
  if(datos.monto<=0&&datos.debe<=0&&datos.haber<=0){toast('El monto debe ser mayor a cero','error');return;}
  if(!datos.monto) datos.monto=Math.max(datos.debe,datos.haber);
  datos.updatedAt=new Date().toISOString();

  if(idEditando) {
    const idx=BD.asientos.findIndex(a=>a.id===idEditando);
    if(idx>=0){
      const antes={...BD.asientos[idx]};
      const diffs=calcDiffsAudit(antes,datos,{glosa:'Glosa',codCuenta:'Cuenta',debe:'Debe',haber:'Haber',monto:'Monto',estado:'Estado',tipo:'Tipo',medioPago:'Medio Pago',rucDni:'RUC/DNI',nombreCP:'Cliente/Proveedor',centro:'Centro Costo',obs:'Observaciones'});
      BD.asientos[idx]={...BD.asientos[idx],...datos};
      if(!BD.asientos[idx].auditLog) BD.asientos[idx].auditLog=[];
      if(diffs.length) {
        BD.asientos[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,`${diffs.length} campo(s) modificado(s)`,`Editado por ${datos.usuario||BD.config.usuario}`,diffs));
      } else {
        BD.asientos[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,'Revisado sin cambios',`Abierto y guardado por ${datos.usuario||BD.config.usuario}`));
      }
      toast('Asiento actualizado','exito');
    }
  } else {
    if(BD.asientos.find(a=>a.correlativo===datos.correlativo)) datos.correlativo=siguienteCorrelativo();
    datos.id=generarId(); datos.createdAt=new Date().toISOString();
    datos.auditLog=[crearEntradaAudit(AUDIT.CREAR,'Asiento registrado',`Cuenta: ${datos.codCuenta} — ${datos.glosa}`)];
    BD.asientos.unshift(datos);
    toast('Asiento registrado','exito');
  }
  guardarEnStorage(); cerrarModal('modalAsiento'); renderDashboard();
  // re-render si estamos en libro diario
  if(document.getElementById('s-libroDiario')?.classList.contains('activo')) renderLibroDiario();
}

function eliminarAsiento(id) {
  const a=BD.asientos.find(x=>x.id===id);
  mostrarConfirm('Eliminar Asiento',`¿Eliminar asiento #${a?.correlativo}?`,()=>{
    BD.asientos=BD.asientos.filter(x=>x.id!==id);
    guardarEnStorage(); renderLibroDiario(); renderDashboard(); toast('Asiento eliminado','alerta');
  });
}

function anularAsiento(id) {
  const a=BD.asientos.find(x=>x.id===id);
  mostrarConfirm('Anular Asiento',`¿Anular asiento #${a?.correlativo}?`,()=>{
    a.estado='anulado'; a.updatedAt=new Date().toISOString();
    if(!a.auditLog)a.auditLog=[];
    a.auditLog.push(crearEntradaAudit(AUDIT.ESTADO,'Asiento anulado'));
    guardarEnStorage(); renderLibroDiario(); toast('Asiento anulado','alerta');
  });
}

function duplicarAsiento(id) {
  const orig=BD.asientos.find(x=>x.id===id); if(!orig)return;
  BD.asientos.unshift({...orig,id:generarId(),correlativo:siguienteCorrelativo(),fecha:hoy(),estado:'registrado',auditLog:[crearEntradaAudit(AUDIT.CREAR,'Asiento duplicado desde #'+orig.correlativo)],createdAt:new Date().toISOString()});
  guardarEnStorage(); renderLibroDiario(); toast('Asiento duplicado','exito');
}

function verDetalleAsiento(id) {
  const a=BD.asientos.find(x=>x.id===id); if(!a)return;
  document.getElementById('modalDetalleTitulo').innerHTML=`<i class="fa fa-file-invoice"></i> Asiento #${a.correlativo}`;
  document.getElementById('modalDetalleBody').innerHTML=`
    <div class="detalle-grid">
      ${[['N° Correlativo',a.correlativo],['Fecha',fechaCorta(a.fecha)],['Tipo',a.tipo],['Estado',a.estado],
         ['Cuenta',`${a.codCuenta} — ${a.denomCuenta}`],['Glosa',a.glosa],
         ['Debe',dinero(a.debe)],['Haber',dinero(a.haber)],['Monto',dinero(a.monto)],['Moneda',a.moneda],
         ['Documento',`${a.tipoDoc||''} ${a.serie||''}-${a.numero||''}`],['Medio Pago',a.medioPago],
         ['RUC/DNI',a.rucDni],['Cliente/Proveedor',a.nombreCP],
         ['Centro Costo',a.centro],['Categoría',a.categoria],
         ['Usuario',a.usuario],['Observaciones',a.obs]].map(([k,v])=>`
        <div class="detalle-campo">
          <div class="detalle-campo-label">${k}</div>
          <div class="detalle-campo-valor">${v||'—'}</div>
        </div>`).join('')}
    </div>
    ${renderAuditSection(a.auditLog||[],'all','cambiarFiltroAudit','auditDetalleMod')}`;
  _auditLogsActuales['auditDetalleMod']=a.auditLog||[];
  abrirModal('modalDetalle');
}

/* ════════════════════════════════════════════════════════
   17. LIBRO DIARIO
════════════════════════════════════════════════════════ */
function renderLibroDiario() {
  let datos=[...BD.asientos];
  const buscar=document.getElementById('diarioBuscar')?.value?.toLowerCase()||'';
  const desde=document.getElementById('diarioDesde')?.value||'';
  const hasta=document.getElementById('diarioHasta')?.value||'';
  const tipo=document.getElementById('diarioTipo')?.value||'';
  const estado=document.getElementById('diarioEstado')?.value||'';

  if(buscar)datos=datos.filter(a=>(a.glosa||'').toLowerCase().includes(buscar)||(a.codCuenta||'').includes(buscar)||(a.nombreCP||'').toLowerCase().includes(buscar)||(a.correlativo||'').includes(buscar));
  if(desde)datos=datos.filter(a=>(a.fecha||'')>=desde);
  if(hasta)datos=datos.filter(a=>(a.fecha||'')<=hasta);
  if(tipo)datos=datos.filter(a=>a.tipo===tipo);
  if(estado)datos=datos.filter(a=>a.estado===estado);
  datos.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));

  const totDebe=datos.reduce((s,a)=>s+(a.debe||0),0);
  const totHaber=datos.reduce((s,a)=>s+(a.haber||0),0);
  const dif=Math.abs(totDebe-totHaber);
  const cuadrado=dif<0.01;

  const totEl=document.getElementById('diarioTotales');
  if(totEl)totEl.innerHTML=`
    <div class="dt-caja"><div class="dt-caja-label">Total Debe</div><div class="dt-caja-valor verde">${dinero(totDebe)}</div></div>
    <div class="dt-caja"><div class="dt-caja-label">Total Haber</div><div class="dt-caja-valor rojo">${dinero(totHaber)}</div></div>
    <div class="dt-caja">
      <div class="dt-caja-label">Diferencia</div>
      <div class="dt-caja-valor ${cuadrado?'verde':'ambar'}">${dinero(dif)}</div>
      <span class="dt-estado badge ${cuadrado?'badge-verde':'badge-ambar'}">${cuadrado?'✓ Cuadrado':'⚠ Descuadrado'}</span>
    </div>
    <div class="dt-caja"><div class="dt-caja-label">Registros</div><div class="dt-caja-valor">${datos.length}</div></div>`;

  const tbody=document.getElementById('cuerpoLibroDiario'); if(!tbody)return;
  if(!datos.length){tbody.innerHTML=`<tr><td colspan="10"><div class="tabla-vacia"><i class="fa fa-book-open"></i><p>Sin asientos</p></div></td></tr>`;return;}
  tbody.innerHTML=datos.map(a=>`<tr>
    <td class="mono">${a.correlativo}</td>
    <td>${fechaCorta(a.fecha)}</td>
    <td><span class="badge badge-navy">${a.codCuenta||'—'}</span></td>
    <td style="max-width:180px;font-size:12px">${a.glosa||'—'}</td>
    <td style="font-size:11px">${a.tipoDoc?`${a.tipoDoc} ${a.serie||''}-${a.numero||''}`:'—'}</td>
    <td style="color:var(--verde)">${a.debe>0?dinero(a.debe):'—'}</td>
    <td style="color:var(--rojo)">${a.haber>0?dinero(a.haber):'—'}</td>
    <td><span class="badge ${badgeTipo(a.tipo)}">${a.tipo||'—'}</span></td>
    <td><span class="badge ${badgeEstado(a.estado)}">${a.estado||'—'}</span></td>
    <td><div style="display:flex;gap:3px;flex-wrap:wrap">
      <button class="btn-icono" onclick="verDetalleAsiento('${a.id}')" title="Ver"><i class="fa fa-eye"></i></button>
      <button class="btn-icono" onclick="abrirNuevoAsiento('${a.id}')" title="Editar"><i class="fa fa-pen"></i></button>
      <button class="btn-icono" onclick="duplicarAsiento('${a.id}')" title="Duplicar"><i class="fa fa-copy"></i></button>
      <button class="btn-icono" onclick="anularAsiento('${a.id}')" title="Anular"><i class="fa fa-ban"></i></button>
      <button class="btn-icono" style="color:var(--rojo)" onclick="eliminarAsiento('${a.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

function limpiarFiltrosDiario() {
  ['diarioBuscar','diarioDesde','diarioHasta'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['diarioTipo','diarioEstado'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderLibroDiario();
}

/* ════════════════════════════════════════════════════════
   18. LIBRO MAYOR
════════════════════════════════════════════════════════ */
function renderLibroMayor() {
  let asientos=[...BD.asientos];
  const buscar=document.getElementById('mayorBuscar')?.value?.toLowerCase()||'';
  const desde=document.getElementById('mayorDesde')?.value||'';
  const hasta=document.getElementById('mayorHasta')?.value||'';
  if(desde)asientos=asientos.filter(a=>(a.fecha||'')>=desde);
  if(hasta)asientos=asientos.filter(a=>(a.fecha||'')<=hasta);

  const cuentas={};
  asientos.filter(a=>a.estado!=='anulado').forEach(a=>{
    if(!a.codCuenta)return;
    if(!cuentas[a.codCuenta])cuentas[a.codCuenta]={codigo:a.codCuenta,nombre:a.denomCuenta||'—',debe:0,haber:0,movs:[],ultimaFecha:''};
    cuentas[a.codCuenta].debe+=a.debe||0;
    cuentas[a.codCuenta].haber+=a.haber||0;
    cuentas[a.codCuenta].movs.push(a);
    if((a.fecha||'')>cuentas[a.codCuenta].ultimaFecha)cuentas[a.codCuenta].ultimaFecha=a.fecha;
  });

  let lista=Object.values(cuentas);
  if(buscar)lista=lista.filter(c=>c.codigo.includes(buscar)||c.nombre.toLowerCase().includes(buscar));
  lista.sort((a,b)=>a.codigo.localeCompare(b.codigo));

  const tbody=document.getElementById('cuerpoLibroMayor'); if(!tbody)return;
  if(!lista.length){tbody.innerHTML=`<tr><td colspan="10"><div class="tabla-vacia"><i class="fa fa-layer-group"></i><p>Sin datos</p></div></td></tr>`;return;}
  tbody.innerHTML=lista.map(c=>{
    const sD=c.debe>c.haber?c.debe-c.haber:0;
    const sA=c.haber>c.debe?c.haber-c.debe:0;
    const sF=c.debe-c.haber;
    return `<tr>
      <td><span class="badge badge-navy">${c.codigo}</span></td>
      <td>${c.nombre}</td>
      <td style="color:var(--verde)">${dinero(c.debe)}</td>
      <td style="color:var(--rojo)">${dinero(c.haber)}</td>
      <td>${sD>0?dinero(sD):'—'}</td>
      <td>${sA>0?dinero(sA):'—'}</td>
      <td style="color:${sF>=0?'var(--verde)':'var(--rojo)'};font-weight:700">${dinero(sF)}</td>
      <td style="text-align:center">${c.movs.length}</td>
      <td>${fechaCorta(c.ultimaFecha)}</td>
      <td><button class="btn-icono" onclick="verDetalleMayor('${c.codigo}')"><i class="fa fa-eye"></i></button></td>
    </tr>`;
  }).join('');
}

function verDetalleMayor(codigo) {
  const card=document.getElementById('mayorDetalleCard');
  const titulo=document.getElementById('mayorDetalleTitulo');
  const tbody=document.getElementById('cuerpoMayorDetalle');
  if(!card||!titulo||!tbody)return;
  const movs=BD.asientos.filter(a=>a.codCuenta===codigo&&a.estado!=='anulado').sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  const cta=PLAN_CONTABLE.find(c=>c.codigo===codigo);
  titulo.innerHTML=`<i class="fa fa-layer-group"></i> Cuenta ${codigo} — ${cta?.nombre||'—'}`;
  let saldo=0;
  tbody.innerHTML=movs.map(a=>{
    saldo+=(a.debe||0)-(a.haber||0);
    return `<tr>
      <td>${fechaCorta(a.fecha)}</td><td class="mono">${a.correlativo}</td>
      <td>${a.glosa||'—'}</td>
      <td style="color:var(--verde)">${a.debe>0?dinero(a.debe):'—'}</td>
      <td style="color:var(--rojo)">${a.haber>0?dinero(a.haber):'—'}</td>
      <td style="color:${saldo>=0?'var(--verde)':'var(--rojo)'}">${dinero(saldo)}</td>
    </tr>`;
  }).join('');
  card.style.display='block';
  card.scrollIntoView({behavior:'smooth',block:'start'});
}

function limpiarFiltrosMayor() {
  ['mayorBuscar','mayorDesde','mayorHasta'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderLibroMayor();
}

/* ════════════════════════════════════════════════════════
   19. BALANCES
════════════════════════════════════════════════════════ */
function calcularBalances() {
  const efectivo=Math.max(0,saldoCaja());
  const cxcT=totalCxC();
  const inventario=totalCompras()*0.15;
  const activoFijo=totalInversiones()*0.8;
  const activoCte=efectivo+cxcT+inventario;
  const totalActivo=activoCte+(activoFijo);
  const cxpT=totalCxP();
  const tributos=igvPagar();
  const pasivoCte=cxpT+tributos;
  const pasivoNoCte=totalInversiones()*0.2;
  const totalPasivo=pasivoCte+pasivoNoCte;
  const capital=totalActivo*0.4;
  const resultEjer=utilidadNeta();
  const totalPatrim=capital+resultEjer;
  const liq=cxpT>0?activoCte/cxpT:99;
  const endeu=totalActivo>0?(totalPasivo/totalActivo)*100:0;
  const rentab=totalActivo>0?(resultEjer/totalActivo)*100:0;

  const el=document.getElementById('contenidoBalances'); if(!el)return;
  el.innerHTML=`
    <div class="ecuacion-contable">
      <div class="ec-sub">Ecuación Contable Fundamental</div>
      <div class="ec-formula">ACTIVO = PASIVO + PATRIMONIO</div>
      <div style="font-size:12px;margin-top:.375rem;opacity:.8">
        ${dinero(totalActivo)} = ${dinero(totalPasivo)} + ${dinero(totalPatrim)}
        &nbsp;&nbsp;<strong style="color:${Math.abs(totalActivo-totalPasivo-totalPatrim)<1?'#4dab6a':'#f87171'}">
          ${Math.abs(totalActivo-totalPasivo-totalPatrim)<1?'✓ Cuadrado':'⚠ Descuadrado'}
        </strong>
      </div>
    </div>
    <div class="balance-grid">
      <div class="balance-bloque">
        <div class="balance-bloque-titulo">ACTIVOS <span>${dinero(totalActivo)}</span></div>
        <p style="font-size:10px;font-weight:700;color:var(--texto3);text-transform:uppercase;margin-bottom:.5rem">Activo Corriente</p>
        <div class="balance-fila"><span>Efectivo y equivalentes (10)</span><span>${dinero(efectivo)}</span></div>
        <div class="balance-fila"><span>Cuentas por cobrar (12)</span><span>${dinero(cxcT)}</span></div>
        <div class="balance-fila"><span>Inventarios (20)</span><span>${dinero(inventario)}</span></div>
        <div class="balance-fila subtotal"><span>Total Activo Corriente</span><span>${dinero(activoCte)}</span></div>
        <p style="font-size:10px;font-weight:700;color:var(--texto3);text-transform:uppercase;margin:.75rem 0 .5rem">Activo No Corriente</p>
        <div class="balance-fila"><span>Propiedad, planta y equipo (33)</span><span>${dinero(activoFijo)}</span></div>
        <div class="balance-fila subtotal"><span>Total Activo No Corriente</span><span>${dinero(activoFijo)}</span></div>
        <div class="balance-fila total-final"><span>TOTAL ACTIVO</span><span>${dinero(totalActivo)}</span></div>
      </div>
      <div>
        <div class="balance-bloque" style="margin-bottom:1.25rem">
          <div class="balance-bloque-titulo">PASIVOS <span>${dinero(totalPasivo)}</span></div>
          <p style="font-size:10px;font-weight:700;color:var(--texto3);text-transform:uppercase;margin-bottom:.5rem">Pasivo Corriente</p>
          <div class="balance-fila"><span>Cuentas por pagar (42)</span><span>${dinero(cxpT)}</span></div>
          <div class="balance-fila"><span>Tributos por pagar (40)</span><span>${dinero(tributos)}</span></div>
          <div class="balance-fila subtotal"><span>Total Pasivo Corriente</span><span>${dinero(pasivoCte)}</span></div>
          <p style="font-size:10px;font-weight:700;color:var(--texto3);text-transform:uppercase;margin:.75rem 0 .5rem">Pasivo No Corriente</p>
          <div class="balance-fila"><span>Obligaciones financieras (45)</span><span>${dinero(pasivoNoCte)}</span></div>
          <div class="balance-fila total-final"><span>TOTAL PASIVO</span><span>${dinero(totalPasivo)}</span></div>
        </div>
        <div class="balance-bloque">
          <div class="balance-bloque-titulo">PATRIMONIO <span>${dinero(totalPatrim)}</span></div>
          <div class="balance-fila"><span>Capital social (50)</span><span>${dinero(capital)}</span></div>
          <div class="balance-fila"><span>Resultado del ejercicio (89)</span><span style="color:${resultEjer>=0?'var(--verde)':'var(--rojo)'}">${dinero(resultEjer)}</span></div>
          <div class="balance-fila total-final"><span>TOTAL PATRIMONIO</span><span>${dinero(totalPatrim)}</span></div>
        </div>
      </div>
    </div>
    <div class="indicadores-grid">
      <div class="ind-card">
        <div class="ind-label">Liquidez Corriente</div>
        <div class="ind-valor" style="color:${liq>=1?'var(--verde)':'var(--rojo)'}">${liq>=99?'>99':liq.toFixed(2)}</div>
        <div class="ind-desc">${liq>=1?'✓ Liquidez aceptable':'⚠ Riesgo de liquidez'}</div>
      </div>
      <div class="ind-card">
        <div class="ind-label">Endeudamiento</div>
        <div class="ind-valor" style="color:${endeu<=50?'var(--verde)':endeu<=70?'var(--ambar)':'var(--rojo)'}">${pct(endeu)}</div>
        <div class="ind-desc">${endeu<=50?'✓ Bajo riesgo':endeu<=70?'Moderado':'⚠ Alto'}</div>
      </div>
      <div class="ind-card">
        <div class="ind-label">Rentabilidad (ROA)</div>
        <div class="ind-valor" style="color:${rentab>=0?'var(--verde)':'var(--rojo)'}">${pct(rentab)}</div>
        <div class="ind-desc">Rentabilidad sobre activos</div>
      </div>
      <div class="ind-card">
        <div class="ind-label">Capital de Trabajo</div>
        <div class="ind-valor" style="color:${capitalTrabajo()>=0?'var(--verde)':'var(--rojo)'}">${dinero(capitalTrabajo())}</div>
        <div class="ind-desc">Activo Cte. − Pasivo Cte.</div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════
   20. VENTAS — con filtros por período y modal flotante
════════════════════════════════════════════════════════ */
function renderSeccionVentas() {
  // Sincronizar antes de renderizar
  sincronizarVentasExternas();
  renderKpiVentas();
  renderTablaVentas();
}

function renderKpiVentas() {
  const total=totalVentas();
  const cobrado=BD.ventas.filter(v=>v.estadoPago==='cobrado').reduce((s,v)=>s+(v.total||0),0);
  const pend=BD.ventas.filter(v=>v.estadoPago!=='cobrado').reduce((s,v)=>s+(v.total||0),0);
  const igv=igvVentas();
  const externas=BD.ventas.filter(v=>v._fuente==='venta').length;
  const el=document.getElementById('kpiVentas'); if(!el)return;
  el.innerHTML=[
    {label:'Total Ventas',valor:total,tipo:'kpi-dorado',icono:'fa-cart-plus'},
    {label:'Cobrado',valor:cobrado,tipo:'kpi-verde',icono:'fa-circle-check'},
    {label:'Por Cobrar',valor:pend,tipo:'kpi-ambar',icono:'fa-clock'},
    {label:'IGV Generado',valor:igv,tipo:'kpi-azul',icono:'fa-percent'},
    {label:'De módulo ventas',valor:externas,tipo:'kpi-morado',icono:'fa-link',esNum:true},
    {label:'N° Total Ventas',valor:BD.ventas.length,tipo:'kpi-navy',icono:'fa-list',esNum:true},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${k.esNum?k.valor:dinero(k.valor)}</div></div>`).join('');
}

function renderTablaVentas() {
  let datos=[...BD.ventas];
  const buscar=document.getElementById('ventasBuscar')?.value?.toLowerCase()||'';
  const desde=document.getElementById('ventasDesde')?.value||'';
  const hasta=document.getElementById('ventasHasta')?.value||'';
  const estado=document.getElementById('ventasEstado')?.value||'';
  const periodo=document.getElementById('ventasPeriodo')?.value||'';
  const anio=parseInt(document.getElementById('ventasAnio')?.value||anioActual());
  const periodoVal=parseInt(document.getElementById('ventasPeriodoVal')?.value||0);

  if(buscar)datos=datos.filter(v=>(v.cliente||'').toLowerCase().includes(buscar)||(v.numero||'').includes(buscar)||(v.producto||'').toLowerCase().includes(buscar));
  if(desde)datos=datos.filter(v=>(v.fecha||'')>=desde);
  if(hasta)datos=datos.filter(v=>(v.fecha||'')<=hasta);
  if(estado)datos=datos.filter(v=>v.estadoPago===estado);

  // Filtro por período
  if(periodo&&periodoVal) {
    datos=datos.filter(v=>{
      if(getAnio(v.fecha)!==anio)return false;
      if(periodo==='dia')      return v.fecha===document.getElementById('ventasFechaDia')?.value;
      if(periodo==='semana')   return getSemana(v.fecha)===periodoVal;
      if(periodo==='mes')      return getMes(v.fecha)===periodoVal;
      if(periodo==='trimestre')return getTrimestre(v.fecha)===periodoVal;
      return true;
    });
  } else if(periodo==='anio') {
    datos=datos.filter(v=>getAnio(v.fecha)===anio);
  }

  datos.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));

  // Resumen del período
  const totalPeriodo=totalVentas(datos);
  const resEl=document.getElementById('ventasPeriodoResumen');
  if(resEl&&datos.length){
    resEl.innerHTML=`<div class="periodo-resumen">
      <span><i class="fa fa-filter"></i> ${datos.length} ventas filtradas</span>
      <span>Total: <strong>${dinero(totalPeriodo)}</strong></span>
      <span>IGV: <strong>${dinero(igvVentas(datos))}</strong></span>
    </div>`;
  } else if(resEl) { resEl.innerHTML=''; }

  const tbody=document.getElementById('cuerpoVentas'); if(!tbody)return;
  if(!datos.length){tbody.innerHTML=`<tr><td colspan="12"><div class="tabla-vacia"><i class="fa fa-cart-plus"></i><p>No hay ventas con esos filtros</p></div></td></tr>`;return;}
  tbody.innerHTML=datos.map(v=>`<tr>
    <td>${fechaCorta(v.fecha)}</td>
    <td>
      <div style="font-weight:600">${v.cliente||'—'}</div>
      ${v._fuente==='venta'?'<span class="badge badge-morado" style="font-size:9px">módulo ventas</span>':''}
    </td>
    <td style="font-size:11px;font-family:monospace">${v.ruc||'—'}</td>
    <td style="font-size:11px">${v.tipoComp||''} ${v.serie||''}-${v.numero||''}</td>
    <td style="font-size:12px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.producto||'—'}</td>
    <td>${dinero(v.subtotal)}</td>
    <td>${dinero(v.igv)}</td>
    <td style="font-weight:700">${dinero(v.total)}</td>
    <td style="font-size:11px">${v.medioPago||'—'}</td>
    <td><span class="badge ${badgePago(v.estadoPago)}">${v.estadoPago||'—'}</span></td>
    <td><span class="audit-mini-badge" onclick="verAuditVenta('${v.id}')">🕐 ${(v.auditLog||[]).length}</span></td>
    <td><div style="display:flex;gap:3px">
      <button class="btn-icono" onclick="abrirModalVenta('${v.id}')" title="Editar"><i class="fa fa-pen"></i></button>
      <button class="btn-icono" onclick="verAuditVenta('${v.id}')" title="Historial"><i class="fa fa-clock-rotate-left"></i></button>
      ${v._fuente!=='venta'?`<button class="btn-icono" style="color:var(--rojo)" onclick="eliminarVenta('${v.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>`:''}
    </div></td>
  </tr>`).join('');
}

function actualizarFiltrosPeriodoVentas() {
  const periodo=document.getElementById('ventasPeriodo')?.value||'';
  const wrapVal=document.getElementById('ventasPeriodoValWrap');
  const wrapDia=document.getElementById('ventasFechaDiaWrap');
  if(wrapVal)wrapVal.style.display=['semana','mes','trimestre'].includes(periodo)?'block':'none';
  if(wrapDia)wrapDia.style.display=periodo==='dia'?'block':'none';
  renderTablaVentas();
}

/* Modal flotante para ventas */
function abrirModalVenta(id=null) {
  const v=id?BD.ventas.find(x=>x.id===id):null;
  const val=(f,d='')=>v?(v[f]??d):d;
  document.getElementById('modalVentaTitulo').innerHTML=`<i class="fa fa-cart-plus"></i> ${id?'Editar':'Nueva'} Venta`;
  document.getElementById('modalVentaBody').innerHTML=`
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="vFecha" value="${val('fecha',hoy())}"/></div>
      <div class="form-group"><label class="form-label">Cliente *</label><input type="text" id="vCliente" value="${val('cliente')}" placeholder="Nombre o razón social"/></div>
      <div class="form-group"><label class="form-label">RUC / DNI</label><input type="text" id="vRuc" value="${val('ruc')}" placeholder="20xxxxxxxxx"/></div>
      <div class="form-group"><label class="form-label">Tipo Comprobante</label>
        <select id="vTipoComp">${['Factura','Boleta','Nota de crédito','Nota de débito'].map(t=>`<option ${val('tipoComp')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Serie</label><input type="text" id="vSerie" value="${val('serie','F001')}"/></div>
      <div class="form-group"><label class="form-label">N° Documento</label><input type="text" id="vNumero" value="${val('numero')}"/></div>
      <div class="form-group" style="grid-column:span 2"><label class="form-label">Producto / Servicio *</label><input type="text" id="vProducto" value="${val('producto')}" placeholder="Descripción"/></div>
      <div class="form-group"><label class="form-label">Cantidad</label><input type="number" id="vCantidad" value="${val('cantidad',1)}" min="1" oninput="calcTotalVenta()"/></div>
      <div class="form-group"><label class="form-label">Precio Unitario</label><input type="number" id="vPrecio" value="${val('precioUnit',0)}" min="0" step="0.01" oninput="calcTotalVenta()"/></div>
      <div class="form-group"><label class="form-label">Subtotal</label><input type="number" id="vSubtotal" value="${val('subtotal',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">IGV (18%)</label><input type="number" id="vIgv" value="${val('igv',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">Total</label><input type="number" id="vTotal" value="${val('total',0)}" readonly style="background:var(--superficie2);font-weight:700"/></div>
      <div class="form-group"><label class="form-label">Medio de Pago</label>
        <select id="vMedioPago">${['Efectivo','Transferencia','Banco','Tarjeta','Yape','Plin','Cheque'].map(t=>`<option ${val('medioPago')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Estado Pago</label>
        <select id="vEstadoPago">${['cobrado','pendiente','parcial'].map(t=>`<option ${val('estadoPago','cobrado')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    ${id?renderAuditSection(v.auditLog||[],'all','cambiarFiltroAudit','auditVentaModal'):''}`;

  if(id&&v){_auditLogsActuales['auditVentaModal']=v.auditLog||[];}
  document.getElementById('btnGuardarVenta').onclick=()=>guardarVenta(id||'');
  abrirModal('modalVenta');
}

function calcTotalVenta() {
  const cant=parseFloat(document.getElementById('vCantidad')?.value)||0;
  const precio=parseFloat(document.getElementById('vPrecio')?.value)||0;
  const sub=Math.round(cant*precio*100)/100;
  const igv=Math.round(sub*0.18*100)/100;
  const tot=Math.round((sub+igv)*100)/100;
  [['vSubtotal',sub],['vIgv',igv],['vTotal',tot]].forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val.toFixed(2);});
}

function guardarVenta(id='') {
  const datos={
    fecha:leerCampo('vFecha'),cliente:leerCampo('vCliente'),ruc:leerCampo('vRuc'),
    tipoComp:leerCampo('vTipoComp'),serie:leerCampo('vSerie'),numero:leerCampo('vNumero'),
    producto:leerCampo('vProducto'),cantidad:leerNumero('vCantidad'),precioUnit:leerNumero('vPrecio'),
    subtotal:leerNumero('vSubtotal'),igv:leerNumero('vIgv'),total:leerNumero('vTotal'),
    medioPago:leerCampo('vMedioPago'),estadoPago:leerCampo('vEstadoPago'),cuenta:'7011',
  };
  if(!datos.fecha||!datos.cliente||!datos.producto||datos.total<=0){toast('Completa los campos obligatorios','error');return;}
  if(id){
    const idx=BD.ventas.findIndex(v=>v.id===id);
    if(idx>=0){
      const antes={...BD.ventas[idx]};
      const diffs=calcDiffsAudit(antes,datos,{cliente:'Cliente',ruc:'RUC',producto:'Producto',cantidad:'Cantidad',precioUnit:'Precio Unit.',subtotal:'Subtotal',igv:'IGV',total:'Total',estadoPago:'Estado Pago',medioPago:'Medio Pago'});
      BD.ventas[idx]={...BD.ventas[idx],...datos};
      if(!BD.ventas[idx].auditLog) BD.ventas[idx].auditLog=[];
      if(diffs.length) {
        BD.ventas[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,`${diffs.length} campo(s) modificado(s)`,`Editado por ${BD.config.usuario}`,diffs));
      } else {
        BD.ventas[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,'Revisado sin cambios',`Abierto y guardado por ${BD.config.usuario}`));
      }
      toast('Venta actualizada','exito');
    }
  } else {
    const nueva={...datos,id:generarId(),_fuente:'libro',createdAt:new Date().toISOString(),
      auditLog:[crearEntradaAudit(AUDIT.CREAR,'Venta registrada',`Cliente: ${datos.cliente}`)]};
    BD.ventas.unshift(nueva);
    toast('Venta registrada','exito');
  }
  guardarEnStorage(); cerrarModal('modalVenta'); renderSeccionVentas();
}

function verAuditVenta(id) {
  const v=BD.ventas.find(x=>x.id===id); if(!v)return;
  document.getElementById('modalDetalleTitulo').innerHTML=`<i class="fa fa-cart-plus"></i> Historial Venta — ${v.cliente}`;
  document.getElementById('modalDetalleBody').innerHTML=`
    <div class="detalle-grid">
      ${[['Cliente',v.cliente],['RUC',v.ruc],['Comprobante',`${v.tipoComp||''} ${v.serie||''}-${v.numero||''}`],
         ['Producto',v.producto],['Subtotal',dinero(v.subtotal)],['IGV',dinero(v.igv)],['Total',dinero(v.total)],
         ['Pago',v.medioPago],['Estado',v.estadoPago],['Fuente',v._fuente==='venta'?'Módulo de Ventas':'Libro'],
         ['Fecha',fechaCorta(v.fecha)]].map(([k,val])=>`
        <div class="detalle-campo">
          <div class="detalle-campo-label">${k}</div>
          <div class="detalle-campo-valor">${val||'—'}</div>
        </div>`).join('')}
    </div>
    ${renderAuditSection(v.auditLog||[],'all','cambiarFiltroAudit','auditVentaDet')}`;
  _auditLogsActuales['auditVentaDet']=v.auditLog||[];
  abrirModal('modalDetalle');
}

function eliminarVenta(id) {
  const v=BD.ventas.find(x=>x.id===id);
  mostrarConfirm('Eliminar Venta',`¿Eliminar venta de "${v?.cliente}"?`,()=>{
    BD.ventas=BD.ventas.filter(v=>v.id!==id);
    guardarEnStorage(); renderSeccionVentas(); toast('Venta eliminada','alerta');
  });
}

function limpiarFiltros(modulo) {
  const prefijos={ventas:'ventas',compras:'compras',gastos:'gastos'};
  const pre=prefijos[modulo]||modulo;
  [`${pre}Buscar`,`${pre}Desde`,`${pre}Hasta`,`${pre}Categoria`].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  [`${pre}Estado`,`${pre}Periodo`].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  if(modulo==='ventas')renderTablaVentas();
  if(modulo==='compras')renderTablaCompras();
  if(modulo==='gastos')renderTablaGastos();
}

/* ════════════════════════════════════════════════════════
   21. COMPRAS — Modal flotante
════════════════════════════════════════════════════════ */
function renderSeccionCompras(){renderKpiCompras();renderTablaCompras();}

function renderKpiCompras(){
  const total=totalCompras();
  const pagado=BD.compras.filter(c=>c.estadoPago==='pagado').reduce((s,c)=>s+(c.total||0),0);
  const el=document.getElementById('kpiCompras'); if(!el)return;
  el.innerHTML=[
    {label:'Total Compras',valor:total,tipo:'kpi-dorado',icono:'fa-shopping-cart'},
    {label:'Pagado',valor:pagado,tipo:'kpi-verde',icono:'fa-circle-check'},
    {label:'Por Pagar',valor:total-pagado,tipo:'kpi-rojo',icono:'fa-clock'},
    {label:'IGV Compras',valor:igvCompras(),tipo:'kpi-azul',icono:'fa-percent'},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${dinero(k.valor)}</div></div>`).join('');
}

function renderTablaCompras(){
  let datos=[...BD.compras];
  const buscar=document.getElementById('comprasBuscar')?.value?.toLowerCase()||'';
  const desde=document.getElementById('comprasDesde')?.value||'';
  const hasta=document.getElementById('comprasHasta')?.value||'';
  const cat=document.getElementById('comprasCategoria')?.value?.toLowerCase()||'';
  if(buscar)datos=datos.filter(c=>(c.proveedor||'').toLowerCase().includes(buscar)||(c.descripcion||'').toLowerCase().includes(buscar));
  if(desde)datos=datos.filter(c=>(c.fecha||'')>=desde);
  if(hasta)datos=datos.filter(c=>(c.fecha||'')<=hasta);
  if(cat)datos=datos.filter(c=>(c.categoria||'').toLowerCase().includes(cat));
  datos.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const tbody=document.getElementById('cuerpoCompras'); if(!tbody)return;
  if(!datos.length){tbody.innerHTML=`<tr><td colspan="12"><div class="tabla-vacia"><i class="fa fa-shopping-cart"></i><p>Sin compras</p></div></td></tr>`;return;}
  tbody.innerHTML=datos.map(c=>`<tr>
    <td>${fechaCorta(c.fecha)}</td><td>${c.proveedor||'—'}</td>
    <td style="font-size:11px;font-family:monospace">${c.ruc||'—'}</td>
    <td style="font-size:11px">${c.tipoComp||''} ${c.serie||''}-${c.numero||''}</td>
    <td><span class="badge badge-gris">${c.categoria||'—'}</span></td>
    <td style="font-size:12px">${c.descripcion||'—'}</td>
    <td>${dinero(c.subtotal)}</td><td>${dinero(c.igv)}</td>
    <td style="font-weight:700">${dinero(c.total)}</td>
    <td><span class="badge ${badgePago(c.estadoPago)}">${c.estadoPago||'—'}</span></td>
    <td><span class="audit-mini-badge" onclick="verAuditCompra('${c.id}')">🕐 ${(c.auditLog||[]).length}</span></td>
    <td><div style="display:flex;gap:3px">
      <button class="btn-icono" onclick="abrirModalCompra('${c.id}')" title="Editar"><i class="fa fa-pen"></i></button>
      <button class="btn-icono" onclick="verAuditCompra('${c.id}')" title="Historial"><i class="fa fa-clock-rotate-left"></i></button>
      <button class="btn-icono" style="color:var(--rojo)" onclick="eliminarCompra('${c.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

function abrirModalCompra(id=null) {
  const c=id?BD.compras.find(x=>x.id===id):null;
  const val=(f,d='')=>c?(c[f]??d):d;
  document.getElementById('modalCompraTitulo').innerHTML=`<i class="fa fa-shopping-cart"></i> ${id?'Editar':'Nueva'} Compra`;
  document.getElementById('modalCompraBody').innerHTML=`
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="cFecha" value="${val('fecha',hoy())}"/></div>
      <div class="form-group"><label class="form-label">Proveedor *</label><input type="text" id="cProveedor" value="${val('proveedor')}" placeholder="Razón social"/></div>
      <div class="form-group"><label class="form-label">RUC</label><input type="text" id="cRuc" value="${val('ruc')}" placeholder="20xxxxxxxxx"/></div>
      <div class="form-group"><label class="form-label">Tipo Comprobante</label>
        <select id="cTipoComp">${['Factura','Boleta','Nota de crédito'].map(t=>`<option ${val('tipoComp')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Serie</label><input type="text" id="cSerie" value="${val('serie','F001')}"/></div>
      <div class="form-group"><label class="form-label">N° Documento</label><input type="text" id="cNumero" value="${val('numero')}"/></div>
      <div class="form-group"><label class="form-label">Categoría</label><input type="text" id="cCategoria" value="${val('categoria')}" placeholder="Mercadería, Servicios..."/></div>
      <div class="form-group" style="grid-column:span 2"><label class="form-label">Descripción *</label><input type="text" id="cDescripcion" value="${val('descripcion')}" placeholder="Descripción de la compra"/></div>
      <div class="form-group"><label class="form-label">Subtotal *</label><input type="number" id="cSubtotal" value="${val('subtotal',0)}" min="0" step="0.01" oninput="calcTotalCompra()"/></div>
      <div class="form-group"><label class="form-label">IGV (18%)</label><input type="number" id="cIgv" value="${val('igv',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">Total</label><input type="number" id="cTotal" value="${val('total',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">Medio Pago</label>
        <select id="cMedioPago">${['Transferencia','Efectivo','Banco','Cheque'].map(t=>`<option ${val('medioPago')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Estado Pago</label>
        <select id="cEstadoPago">${['pagado','pendiente'].map(t=>`<option ${val('estadoPago','pagado')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    ${id?renderAuditSection(c.auditLog||[],'all','cambiarFiltroAudit','auditCompraModal'):''}`;

  if(id&&c){_auditLogsActuales['auditCompraModal']=c.auditLog||[];}
  document.getElementById('btnGuardarCompra').onclick=()=>guardarCompra(id||'');
  abrirModal('modalCompra');
}

function calcTotalCompra(){
  const sub=parseFloat(document.getElementById('cSubtotal')?.value)||0;
  const igv=Math.round(sub*0.18*100)/100;
  const tot=Math.round((sub+igv)*100)/100;
  const iEl=document.getElementById('cIgv');const tEl=document.getElementById('cTotal');
  if(iEl)iEl.value=igv.toFixed(2); if(tEl)tEl.value=tot.toFixed(2);
}

function guardarCompra(id=''){
  const datos={fecha:leerCampo('cFecha'),proveedor:leerCampo('cProveedor'),ruc:leerCampo('cRuc'),
    tipoComp:leerCampo('cTipoComp'),serie:leerCampo('cSerie'),numero:leerCampo('cNumero'),
    categoria:leerCampo('cCategoria'),descripcion:leerCampo('cDescripcion'),
    subtotal:leerNumero('cSubtotal'),igv:leerNumero('cIgv'),total:leerNumero('cTotal'),
    medioPago:leerCampo('cMedioPago'),estadoPago:leerCampo('cEstadoPago'),cuenta:'6011'};
  if(!datos.fecha||!datos.proveedor||!datos.descripcion||datos.total<=0){toast('Completa los campos obligatorios','error');return;}
  if(id){
    const idx=BD.compras.findIndex(c=>c.id===id);
    if(idx>=0){
      const antes={...BD.compras[idx]};
      const diffs=calcDiffsAudit(antes,datos,{proveedor:'Proveedor',ruc:'RUC',categoria:'Categoría',descripcion:'Descripción',subtotal:'Subtotal',igv:'IGV',total:'Total',medioPago:'Medio Pago',estadoPago:'Estado Pago'});
      BD.compras[idx]={...BD.compras[idx],...datos};
      if(!BD.compras[idx].auditLog) BD.compras[idx].auditLog=[];
      if(diffs.length) {
        BD.compras[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,`${diffs.length} campo(s) modificado(s)`,`Editado por ${BD.config.usuario}`,diffs));
      } else {
        BD.compras[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,'Revisado sin cambios',`Abierto y guardado por ${BD.config.usuario}`));
      }
      toast('Compra actualizada','exito');
    }
  } else {
    BD.compras.unshift({...datos,id:generarId(),createdAt:new Date().toISOString(),
      auditLog:[crearEntradaAudit(AUDIT.CREAR,'Compra registrada',`Proveedor: ${datos.proveedor}`)]});
    toast('Compra registrada','exito');
  }
  guardarEnStorage(); cerrarModal('modalCompra'); renderSeccionCompras();
}

function verAuditCompra(id){
  const c=BD.compras.find(x=>x.id===id); if(!c)return;
  document.getElementById('modalDetalleTitulo').innerHTML=`<i class="fa fa-shopping-cart"></i> Historial Compra — ${c.proveedor}`;
  document.getElementById('modalDetalleBody').innerHTML=`
    <div class="detalle-grid">
      ${[['Proveedor',c.proveedor],['RUC',c.ruc],['Comprobante',`${c.tipoComp||''} ${c.serie||''}-${c.numero||''}`],
         ['Categoría',c.categoria],['Descripción',c.descripcion],['Subtotal',dinero(c.subtotal)],
         ['IGV',dinero(c.igv)],['Total',dinero(c.total)],['Pago',c.medioPago],
         ['Estado',c.estadoPago],['Fecha',fechaCorta(c.fecha)]].map(([k,val])=>`
        <div class="detalle-campo">
          <div class="detalle-campo-label">${k}</div>
          <div class="detalle-campo-valor">${val||'—'}</div>
        </div>`).join('')}
    </div>
    ${renderAuditSection(c.auditLog||[],'all','cambiarFiltroAudit','auditCompraDet')}`;
  _auditLogsActuales['auditCompraDet']=c.auditLog||[];
  abrirModal('modalDetalle');
}

function eliminarCompra(id){
  const c=BD.compras.find(x=>x.id===id);
  mostrarConfirm('Eliminar Compra',`¿Eliminar compra de "${c?.proveedor}"?`,()=>{
    BD.compras=BD.compras.filter(c=>c.id!==id);
    guardarEnStorage(); renderSeccionCompras(); toast('Compra eliminada','alerta');
  });
}

/* ════════════════════════════════════════════════════════
   22. GASTOS — Modal flotante
════════════════════════════════════════════════════════ */
function renderSeccionGastos(){renderKpiGastos();renderTablaGastos();}

function renderKpiGastos(){
  const total=totalGastos();
  const pagado=BD.gastos.filter(g=>g.estadoPago==='pagado').reduce((s,g)=>s+(g.total||0),0);
  const el=document.getElementById('kpiGastos'); if(!el)return;
  el.innerHTML=[
    {label:'Total Gastos',valor:total,tipo:'kpi-rojo',icono:'fa-receipt'},
    {label:'Pagado',valor:pagado,tipo:'kpi-verde',icono:'fa-circle-check'},
    {label:'Pendiente',valor:total-pagado,tipo:'kpi-ambar',icono:'fa-clock'},
    {label:'N° Gastos',valor:BD.gastos.length,tipo:'kpi-morado',icono:'fa-list',esNum:true},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${k.esNum?k.valor:dinero(k.valor)}</div></div>`).join('');
}

function renderTablaGastos(){
  let datos=[...BD.gastos];
  const buscar=document.getElementById('gastosBuscar')?.value?.toLowerCase()||'';
  const desde=document.getElementById('gastosDesde')?.value||'';
  const hasta=document.getElementById('gastosHasta')?.value||'';
  const cat=document.getElementById('gastosCategoria')?.value?.toLowerCase()||'';
  if(buscar)datos=datos.filter(g=>(g.descripcion||'').toLowerCase().includes(buscar)||(g.proveedor||'').toLowerCase().includes(buscar));
  if(desde)datos=datos.filter(g=>(g.fecha||'')>=desde);
  if(hasta)datos=datos.filter(g=>(g.fecha||'')<=hasta);
  if(cat)datos=datos.filter(g=>(g.categoria||'').toLowerCase().includes(cat));
  datos.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const tbody=document.getElementById('cuerpoGastos'); if(!tbody)return;
  if(!datos.length){tbody.innerHTML=`<tr><td colspan="12"><div class="tabla-vacia"><i class="fa fa-receipt"></i><p>Sin gastos</p></div></td></tr>`;return;}
  tbody.innerHTML=datos.map(g=>`<tr>
    <td>${fechaCorta(g.fecha)}</td>
    <td><span class="badge badge-gris">${g.categoria||'—'}</span></td>
    <td style="font-size:12px">${g.descripcion||'—'}</td>
    <td style="font-size:11px">${g.proveedor||'—'}</td>
    <td style="font-size:11px">${g.tipoComp||''} ${g.serie||''}-${g.numero||''}</td>
    <td>${dinero(g.subtotal)}</td><td>${dinero(g.igv)}</td>
    <td style="font-weight:700">${dinero(g.total)}</td>
    <td style="font-size:11px">${g.medioPago||'—'}</td>
    <td><span class="badge ${badgePago(g.estadoPago)}">${g.estadoPago||'—'}</span></td>
    <td><span class="audit-mini-badge" onclick="verAuditGasto('${g.id}')">🕐 ${(g.auditLog||[]).length}</span></td>
    <td><div style="display:flex;gap:3px">
      <button class="btn-icono" onclick="abrirModalGasto('${g.id}')" title="Editar"><i class="fa fa-pen"></i></button>
      <button class="btn-icono" onclick="verAuditGasto('${g.id}')" title="Historial"><i class="fa fa-clock-rotate-left"></i></button>
      <button class="btn-icono" style="color:var(--rojo)" onclick="eliminarGasto('${g.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

function abrirModalGasto(id=null) {
  const g=id?BD.gastos.find(x=>x.id===id):null;
  const val=(f,d='')=>g?(g[f]??d):d;
  const cats=['Planilla','Alquiler','Servicios','Marketing','Transporte','Administrativo','Mantenimiento','Legal','Otros'];
  document.getElementById('modalGastoTitulo').innerHTML=`<i class="fa fa-receipt"></i> ${id?'Editar':'Nuevo'} Gasto`;
  document.getElementById('modalGastoBody').innerHTML=`
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="gFecha" value="${val('fecha',hoy())}"/></div>
      <div class="form-group"><label class="form-label">Categoría *</label>
        <select id="gCategoria">${cats.map(t=>`<option ${val('categoria')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="grid-column:span 2"><label class="form-label">Descripción *</label><input type="text" id="gDescripcion" value="${val('descripcion')}" placeholder="Descripción del gasto"/></div>
      <div class="form-group"><label class="form-label">Proveedor</label><input type="text" id="gProveedor" value="${val('proveedor')}" placeholder="Nombre o razón social"/></div>
      <div class="form-group"><label class="form-label">Tipo Comprobante</label>
        <select id="gTipoComp">${['Factura','Boleta','Recibo','Otro'].map(t=>`<option ${val('tipoComp')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Serie</label><input type="text" id="gSerie" value="${val('serie','B001')}"/></div>
      <div class="form-group"><label class="form-label">N° Documento</label><input type="text" id="gNumero" value="${val('numero')}"/></div>
      <div class="form-group"><label class="form-label">Subtotal *</label><input type="number" id="gSubtotal" value="${val('subtotal',0)}" min="0" step="0.01" oninput="calcTotalGasto()"/></div>
      <div class="form-group"><label class="form-label">IGV</label><input type="number" id="gIgv" value="${val('igv',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">Total</label><input type="number" id="gTotal" value="${val('total',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">Medio Pago</label>
        <select id="gMedioPago">${['Efectivo','Transferencia','Banco','Tarjeta'].map(t=>`<option ${val('medioPago')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Estado Pago</label>
        <select id="gEstadoPago">${['pagado','pendiente'].map(t=>`<option ${val('estadoPago','pagado')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Centro de Costo</label><input type="text" id="gCentro" value="${val('centro')}" placeholder="Administración, Ventas..."/></div>
    </div>
    ${id?renderAuditSection(g.auditLog||[],'all','cambiarFiltroAudit','auditGastoModal'):''}`;

  if(id&&g){_auditLogsActuales['auditGastoModal']=g.auditLog||[];}
  document.getElementById('btnGuardarGasto').onclick=()=>guardarGasto(id||'');
  abrirModal('modalGasto');
}

function calcTotalGasto(){
  const sub=parseFloat(document.getElementById('gSubtotal')?.value)||0;
  const igv=Math.round(sub*0.18*100)/100;
  const tot=Math.round((sub+igv)*100)/100;
  const iEl=document.getElementById('gIgv');const tEl=document.getElementById('gTotal');
  if(iEl)iEl.value=igv.toFixed(2); if(tEl)tEl.value=tot.toFixed(2);
}

function guardarGasto(id=''){
  const datos={fecha:leerCampo('gFecha'),categoria:leerCampo('gCategoria'),descripcion:leerCampo('gDescripcion'),
    proveedor:leerCampo('gProveedor'),tipoComp:leerCampo('gTipoComp'),serie:leerCampo('gSerie'),
    numero:leerCampo('gNumero'),subtotal:leerNumero('gSubtotal'),igv:leerNumero('gIgv'),
    total:leerNumero('gTotal'),medioPago:leerCampo('gMedioPago'),estadoPago:leerCampo('gEstadoPago'),
    centro:leerCampo('gCentro'),cuenta:'94'};
  if(!datos.fecha||!datos.descripcion||datos.total<=0){toast('Completa los campos obligatorios','error');return;}
  if(id){
    const idx=BD.gastos.findIndex(g=>g.id===id);
    if(idx>=0){
      const antes={...BD.gastos[idx]};
      const diffs=calcDiffsAudit(antes,datos,{categoria:'Categoría',descripcion:'Descripción',proveedor:'Proveedor',subtotal:'Subtotal',igv:'IGV',total:'Total',medioPago:'Medio Pago',estadoPago:'Estado Pago',centro:'Centro Costo'});
      BD.gastos[idx]={...BD.gastos[idx],...datos};
      if(!BD.gastos[idx].auditLog) BD.gastos[idx].auditLog=[];
      if(diffs.length) {
        BD.gastos[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,`${diffs.length} campo(s) modificado(s)`,`Editado por ${BD.config.usuario}`,diffs));
      } else {
        BD.gastos[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,'Revisado sin cambios',`Abierto y guardado por ${BD.config.usuario}`));
      }
      toast('Gasto actualizado','exito');
    }
  } else {
    BD.gastos.unshift({...datos,id:generarId(),createdAt:new Date().toISOString(),
      auditLog:[crearEntradaAudit(AUDIT.CREAR,'Gasto registrado',`Categoría: ${datos.categoria}`)]});
    toast('Gasto registrado','exito');
  }
  guardarEnStorage(); cerrarModal('modalGasto'); renderSeccionGastos();
}

function verAuditGasto(id){
  const g=BD.gastos.find(x=>x.id===id); if(!g)return;
  document.getElementById('modalDetalleTitulo').innerHTML=`<i class="fa fa-receipt"></i> Historial Gasto — ${g.descripcion}`;
  document.getElementById('modalDetalleBody').innerHTML=`
    <div class="detalle-grid">
      ${[['Categoría',g.categoria],['Descripción',g.descripcion],['Proveedor',g.proveedor],
         ['Comprobante',`${g.tipoComp||''} ${g.serie||''}-${g.numero||''}`],['Subtotal',dinero(g.subtotal)],
         ['IGV',dinero(g.igv)],['Total',dinero(g.total)],['Pago',g.medioPago],
         ['Estado',g.estadoPago],['Centro',g.centro],['Fecha',fechaCorta(g.fecha)]].map(([k,val])=>`
        <div class="detalle-campo">
          <div class="detalle-campo-label">${k}</div>
          <div class="detalle-campo-valor">${val||'—'}</div>
        </div>`).join('')}
    </div>
    ${renderAuditSection(g.auditLog||[],'all','cambiarFiltroAudit','auditGastoDet')}`;
  _auditLogsActuales['auditGastoDet']=g.auditLog||[];
  abrirModal('modalDetalle');
}

function eliminarGasto(id){
  const g=BD.gastos.find(x=>x.id===id);
  mostrarConfirm('Eliminar Gasto',`¿Eliminar gasto "${g?.descripcion}"?`,()=>{
    BD.gastos=BD.gastos.filter(g=>g.id!==id);
    guardarEnStorage(); renderSeccionGastos(); toast('Gasto eliminado','alerta');
  });
}

/* ════════════════════════════════════════════════════════
   23. INVERSIONES — Modal flotante + Sincronización almacén
════════════════════════════════════════════════════════ */
function renderSeccionInversiones(){
  sincronizarProductosAlmacen();
  renderKpiInversiones();
  renderTablaInversiones();
}

function renderKpiInversiones(){
  const total=totalInversiones();
  const retReal=BD.inversiones.reduce((s,i)=>s+(i.retornoReal||0),0);
  const roi=total>0?(retReal/total)*100:0;
  const deAlmacen=BD.inversiones.filter(i=>i._fuente==='almacen').length;
  const el=document.getElementById('kpiInversiones'); if(!el)return;
  el.innerHTML=[
    {label:'Total Invertido',valor:total,tipo:'kpi-azul',icono:'fa-chart-line'},
    {label:'Retorno Real',valor:retReal,tipo:'kpi-verde',icono:'fa-sack-dollar'},
    {label:'ROI',valor:roi,tipo:'kpi-morado',icono:'fa-percent',esPct:true},
    {label:'Activas',valor:BD.inversiones.filter(i=>i.estado==='activa').length,tipo:'kpi-dorado',icono:'fa-circle-play',esNum:true},
    {label:'De almacén',valor:deAlmacen,tipo:'kpi-azul',icono:'fa-warehouse',esNum:true},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${k.esPct?pct(k.valor):k.esNum?k.valor:dinero(k.valor)}</div></div>`).join('');
}

function renderTablaInversiones(){
  const datos=[...BD.inversiones].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const tbody=document.getElementById('cuerpoInversiones'); if(!tbody)return;
  if(!datos.length){tbody.innerHTML=`<tr><td colspan="11"><div class="tabla-vacia"><i class="fa fa-chart-line"></i><p>Sin inversiones</p></div></td></tr>`;return;}
  tbody.innerHTML=datos.map(i=>{
    const roi=i.monto>0?((i.retornoReal||0)/i.monto)*100:0;
    return `<tr>
      <td>${fechaCorta(i.fecha)}</td>
      <td>
        <span class="badge badge-azul">${i.tipo||'—'}</span>
        ${i._fuente==='almacen'?'<span class="badge badge-verde" style="font-size:9px">almacén</span>':''}
      </td>
      <td>${i.nombre||'—'}</td>
      <td style="font-weight:700">${dinero(i.monto)}</td>
      <td>${dinero(i.retornoEsp||0)}</td>
      <td style="color:${(i.retornoReal||0)>0?'var(--verde)':'var(--texto3)'}">${(i.retornoReal||0)>0?dinero(i.retornoReal):'—'}</td>
      <td style="color:${roi>=0?'var(--verde)':'var(--rojo)'};font-weight:700">${pct(roi)}</td>
      <td style="font-size:12px">${i.plazo||'—'}</td>
      <td><span class="badge ${i.estado==='activa'?'badge-verde':i.estado==='sin stock'?'badge-rojo':'badge-gris'}">${i.estado||'—'}</span></td>
      <td><span class="audit-mini-badge" onclick="verAuditInversion('${i.id}')">🕐 ${(i.auditLog||[]).length}</span></td>
      <td><div style="display:flex;gap:3px">
        ${i._fuente!=='almacen'?`<button class="btn-icono" onclick="abrirModalInversion('${i.id}')" title="Editar"><i class="fa fa-pen"></i></button>`:''}
        <button class="btn-icono" onclick="verAuditInversion('${i.id}')" title="Historial"><i class="fa fa-clock-rotate-left"></i></button>
        ${i._fuente!=='almacen'?`<button class="btn-icono" style="color:var(--rojo)" onclick="eliminarInversion('${i.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>`:''}
        ${i._fuente==='almacen'?`<button class="btn-icono btn-sm" onclick="irAAlmacen()" title="Ver en almacén"><i class="fa fa-warehouse"></i></button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

function irAAlmacen() {
  toast('Abriendo módulo de almacén...','');
  setTimeout(()=>window.open('registro.html','_blank'),300);
}

function abrirModalInversion(id=null) {
  const inv=id?BD.inversiones.find(x=>x.id===id):null;
  const val=(f,d='')=>inv?(inv[f]??d):d;
  const tipos=['Maquinaria','Tecnología','Vehículo','Infraestructura','Capital de trabajo','Marketing','Capacitación','Inmueble','Financiero','Otro'];
  document.getElementById('modalInversionTitulo').innerHTML=`<i class="fa fa-chart-line"></i> ${id?'Editar':'Nueva'} Inversión`;
  document.getElementById('modalInversionBody').innerHTML=`
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="iFecha" value="${val('fecha',hoy())}"/></div>
      <div class="form-group"><label class="form-label">Tipo *</label>
        <select id="iTipo">${tipos.map(t=>`<option ${val('tipo')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="grid-column:span 2"><label class="form-label">Nombre de la inversión *</label><input type="text" id="iNombre" value="${val('nombre')}" placeholder="Nombre descriptivo"/></div>
      <div class="form-group"><label class="form-label">Monto Invertido *</label><input type="number" id="iMonto" value="${val('monto',0)}" min="0" step="0.01"/></div>
      <div class="form-group"><label class="form-label">Fuente Financiamiento</label><input type="text" id="iFuente" value="${val('fuente')}" placeholder="Capital propio, Préstamo..."/></div>
      <div class="form-group"><label class="form-label">Retorno Esperado</label><input type="number" id="iRetEsp" value="${val('retornoEsp',0)}" min="0" step="0.01"/></div>
      <div class="form-group"><label class="form-label">Retorno Real</label><input type="number" id="iRetReal" value="${val('retornoReal',0)}" min="0" step="0.01"/></div>
      <div class="form-group"><label class="form-label">Plazo</label><input type="text" id="iPlazo" value="${val('plazo')}" placeholder="Ej: 12 meses"/></div>
      <div class="form-group"><label class="form-label">Estado</label>
        <select id="iEstado">${['activa','cerrada','suspendida'].map(t=>`<option ${val('estado','activa')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="grid-column:span 2"><label class="form-label">Observaciones</label><input type="text" id="iObs" value="${val('obs')}" placeholder="Notas..."/></div>
    </div>
    ${id?renderAuditSection(inv.auditLog||[],'all','cambiarFiltroAudit','auditInversionModal'):''}`;

  if(id&&inv){_auditLogsActuales['auditInversionModal']=inv.auditLog||[];}
  document.getElementById('btnGuardarInversion').onclick=()=>guardarInversion(id||'');
  abrirModal('modalInversion');
}

function guardarInversion(id=''){
  const datos={fecha:leerCampo('iFecha'),tipo:leerCampo('iTipo'),nombre:leerCampo('iNombre'),
    monto:leerNumero('iMonto'),fuente:leerCampo('iFuente'),retornoEsp:leerNumero('iRetEsp'),
    retornoReal:leerNumero('iRetReal'),plazo:leerCampo('iPlazo'),estado:leerCampo('iEstado'),obs:leerCampo('iObs')};
  if(!datos.fecha||!datos.nombre||datos.monto<=0){toast('Completa los campos obligatorios','error');return;}
  if(id){
    const idx=BD.inversiones.findIndex(i=>i.id===id);
    if(idx>=0){
      const antes={...BD.inversiones[idx]};
      const diffs=calcDiffsAudit(antes,datos,{nombre:'Nombre',monto:'Monto',retornoReal:'Retorno Real',estado:'Estado'});
      BD.inversiones[idx]={...BD.inversiones[idx],...datos};
      if(!BD.inversiones[idx].auditLog)BD.inversiones[idx].auditLog=[];
      if(diffs.length)BD.inversiones[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,`${diffs.length} campo(s) modificado(s)`,'',diffs));
      toast('Inversión actualizada','exito');
    }
  } else {
    BD.inversiones.unshift({...datos,id:generarId(),_fuente:'libro',createdAt:new Date().toISOString(),
      auditLog:[crearEntradaAudit(AUDIT.CREAR,'Inversión registrada',`Tipo: ${datos.tipo}`)]});
    toast('Inversión registrada','exito');
  }
  guardarEnStorage(); cerrarModal('modalInversion'); renderSeccionInversiones();
}

function verAuditInversion(id){
  const inv=BD.inversiones.find(x=>x.id===id); if(!inv)return;
  document.getElementById('modalDetalleTitulo').innerHTML=`<i class="fa fa-chart-line"></i> Historial Inversión — ${inv.nombre}`;
  document.getElementById('modalDetalleBody').innerHTML=`
    <div class="detalle-grid">
      ${[['Tipo',inv.tipo],['Nombre',inv.nombre],['Monto',dinero(inv.monto)],['Fuente',inv.fuente],
         ['Retorno Esp.',dinero(inv.retornoEsp||0)],['Retorno Real',dinero(inv.retornoReal||0)],
         ['ROI',pct(inv.monto>0?((inv.retornoReal||0)/inv.monto)*100:0)],
         ['Plazo',inv.plazo],['Estado',inv.estado],['Origen',inv._fuente==='almacen'?'Módulo Almacén':'Libro'],
         ['Fecha',fechaCorta(inv.fecha)]].map(([k,val])=>`
        <div class="detalle-campo">
          <div class="detalle-campo-label">${k}</div>
          <div class="detalle-campo-valor">${val||'—'}</div>
        </div>`).join('')}
    </div>
    ${renderAuditSection(inv.auditLog||[],'all','cambiarFiltroAudit','auditInvDet')}`;
  _auditLogsActuales['auditInvDet']=inv.auditLog||[];
  abrirModal('modalDetalle');
}

function eliminarInversion(id){
  const inv=BD.inversiones.find(x=>x.id===id);
  mostrarConfirm('Eliminar Inversión',`¿Eliminar inversión "${inv?.nombre}"?`,()=>{
    BD.inversiones=BD.inversiones.filter(i=>i.id!==id);
    guardarEnStorage(); renderSeccionInversiones(); toast('Inversión eliminada','alerta');
  });
}

/* ════════════════════════════════════════════════════════
   24. CAJA Y BANCOS
════════════════════════════════════════════════════════ */
function renderCaja(){
  const efectivo=BD.ventas.filter(v=>v.medioPago==='Efectivo').reduce((s,v)=>s+(v.total||0),0)
    -BD.gastos.filter(g=>g.medioPago==='Efectivo').reduce((s,g)=>s+(g.total||0),0)
    -BD.compras.filter(c=>c.medioPago==='Efectivo').reduce((s,c)=>s+(c.total||0),0);
  const el=document.getElementById('kpiCaja');
  if(el)el.innerHTML=[
    {label:'Saldo Total',      valor:saldoCaja(),    tipo:saldoCaja()>=0?'kpi-verde':'kpi-rojo',  icono:'fa-cash-register'},
    {label:'Ingresos Totales', valor:calcIngresos(), tipo:'kpi-verde',  icono:'fa-arrow-trend-up'},
    {label:'Egresos Totales',  valor:calcEgresos(),  tipo:'kpi-rojo',   icono:'fa-arrow-trend-down'},
    {label:'Flujo Neto',       valor:saldoCaja(),    tipo:'kpi-azul',   icono:'fa-arrow-right-arrow-left'},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${dinero(k.valor)}</div></div>`).join('');

  const anio=anioActual();
  const venMes=Array(12).fill(0),egrMes=Array(12).fill(0);
  BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
  BD.compras.filter(c=>getAnio(c.fecha)===anio).forEach(c=>{egrMes[getMes(c.fecha)-1]+=c.total||0;});
  BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{egrMes[getMes(g.fecha)-1]+=g.total||0;});
  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  crearGrafico('graficoCaja','bar',{labels:MESES,datasets:[
    {label:'Ingresos',data:venMes,backgroundColor:'rgba(21,122,63,.7)',borderRadius:4},
    {label:'Egresos', data:egrMes,backgroundColor:'rgba(185,28,28,.7)',borderRadius:4},
  ]},{plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}});
  crearGrafico('graficoCajaPie','doughnut',{
    labels:['Efectivo','Bancos/Transferencias'],
    datasets:[{data:[Math.max(0,efectivo),Math.max(0,saldoCaja()-efectivo)],backgroundColor:['#C49A2A','#1D4ED8'],borderWidth:0}]
  },{plugins:{legend:{position:'bottom'}},cutout:'55%'});

  const movs=[...BD.asientos].filter(a=>a.estado!=='anulado').sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,40);
  let saldoAcum=0;
  const tbody=document.getElementById('cuerpoCaja'); if(!tbody)return;
  tbody.innerHTML=movs.map(a=>{
    const ing=a.haber||0,egr=a.debe||0; saldoAcum+=ing-egr;
    return `<tr>
      <td>${fechaCorta(a.fecha)}</td><td class="mono">${a.correlativo}</td>
      <td style="font-size:12px">${a.glosa||'—'}</td>
      <td style="font-size:11px">${a.medioPago||'—'}</td>
      <td style="color:var(--verde)">${ing>0?dinero(ing):'—'}</td>
      <td style="color:var(--rojo)">${egr>0?dinero(egr):'—'}</td>
      <td style="color:${saldoAcum>=0?'var(--verde)':'var(--rojo)'};font-weight:700">${dinero(saldoAcum)}</td>
    </tr>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════
   25. CxC — EDITABLE DESDE LIBRO.HTML
════════════════════════════════════════════════════════ */
function renderCxc() {
  // CxC de ventas no cobradas + CxC extras manuales
  const pendVentas = BD.ventas.filter(v=>v.estadoPago!=='cobrado');
  const totalPendV = pendVentas.reduce((s,v)=>s+(v.total||0),0);
  const totalExtra = (BD.cxcExtra||[]).reduce((s,c)=>s+(c.saldo||c.total||0),0);
  const totalPend  = totalPendV + totalExtra;
  const el=document.getElementById('kpiCxc');
  if(el)el.innerHTML=[
    {label:'Total por Cobrar',valor:totalPend,tipo:'kpi-ambar',icono:'fa-file-invoice-dollar'},
    {label:'De ventas',valor:totalPendV,tipo:'kpi-rojo',icono:'fa-cart-plus'},
    {label:'Facturas extras',valor:totalExtra,tipo:'kpi-morado',icono:'fa-file-circle-plus'},
    {label:'N° Pendientes',valor:pendVentas.length+(BD.cxcExtra||[]).filter(c=>c.estadoPago!=='cobrado').length,tipo:'kpi-rojo',icono:'fa-list',esNum:true},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${k.esNum?k.valor:dinero(k.valor)}</div></div>`).join('');

  const tbody=document.getElementById('cuerpoCxc'); if(!tbody)return;
  if(!pendVentas.length&&!(BD.cxcExtra||[]).length){
    tbody.innerHTML=`<tr><td colspan="9"><div class="tabla-vacia"><i class="fa fa-circle-check" style="color:var(--verde)"></i><p>Sin cuentas pendientes 🎉</p></div></td></tr>`;
    return;
  }

  const filasVentas = pendVentas.map(v=>`<tr>
    <td>${fechaCorta(v.fecha)}</td><td>${v.cliente||'—'}</td>
    <td style="font-size:11px">${v.tipoComp||''} ${v.serie||''}-${v.numero||''}</td>
    <td style="font-weight:700">${dinero(v.total)}</td>
    <td style="color:var(--verde)">—</td>
    <td style="color:var(--rojo);font-weight:700">${dinero(v.total)}</td>
    <td>—</td>
    <td><span class="badge badge-rojo">${v.estadoPago||'pendiente'}</span></td>
    <td><div style="display:flex;gap:3px">
      <button class="btn-icono" onclick="marcarVentaCobrada('${v.id}')" title="Marcar cobrado"><i class="fa fa-check"></i></button>
    </div></td>
  </tr>`);

  const filasExtra = (BD.cxcExtra||[]).filter(c=>c.estadoPago!=='cobrado').map(c=>`<tr>
    <td>${fechaCorta(c.fecha)}</td><td>${c.cliente||'—'}</td>
    <td style="font-size:11px">${c.tipoComp||''} ${c.numero||''}</td>
    <td style="font-weight:700">${dinero(c.total)}</td>
    <td style="color:var(--verde)">${dinero(c.cobrado||0)}</td>
    <td style="color:var(--rojo);font-weight:700">${dinero(c.saldo||c.total)}</td>
    <td style="font-size:11px;color:var(--rojo)">${fechaCorta(c.vencimiento)}</td>
    <td><span class="badge badge-ambar">${c.estadoPago||'pendiente'}</span></td>
    <td><div style="display:flex;gap:3px">
      <button class="btn-icono" onclick="abrirModalCxc('${c.id}')" title="Editar"><i class="fa fa-pen"></i></button>
      <button class="btn-icono" onclick="marcarCxcCobrada('${c.id}')" title="Cobrar"><i class="fa fa-check"></i></button>
      <button class="btn-icono" style="color:var(--rojo)" onclick="eliminarCxc('${c.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>
    </div></td>
  </tr>`);

  tbody.innerHTML=[...filasVentas,...filasExtra].join('');
}

function marcarVentaCobrada(id){
  const v=BD.ventas.find(x=>x.id===id); if(!v)return;
  v.estadoPago='cobrado';
  if(!v.auditLog)v.auditLog=[];
  v.auditLog.push(crearEntradaAudit(AUDIT.ESTADO,'Marcado como cobrado','Actualizado desde CxC',[{campo:'Estado',antes:'pendiente',despues:'cobrado'}]));
  guardarEnStorage(); renderCxc(); toast('Venta marcada como cobrada','exito');
}

function abrirModalCxc(id=null) {
  const c=id?BD.cxcExtra.find(x=>x.id===id):null;
  const val=(f,d='')=>c?(c[f]??d):d;
  document.getElementById('modalCxcTitulo').innerHTML=`<i class="fa fa-file-invoice-dollar"></i> ${id?'Editar':'Nueva'} Cuenta por Cobrar`;
  document.getElementById('modalCxcBody').innerHTML=`
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="cxcFecha" value="${val('fecha',hoy())}"/></div>
      <div class="form-group"><label class="form-label">Cliente *</label><input type="text" id="cxcCliente" value="${val('cliente')}" placeholder="Nombre o razón social"/></div>
      <div class="form-group"><label class="form-label">RUC / DNI</label><input type="text" id="cxcRuc" value="${val('ruc')}" placeholder="20xxxxxxxxx"/></div>
      <div class="form-group"><label class="form-label">Tipo Comprobante</label>
        <select id="cxcTipoComp">${['Factura','Boleta','Nota de crédito','Otro'].map(t=>`<option ${val('tipoComp')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">N° Documento</label><input type="text" id="cxcNumero" value="${val('numero')}" placeholder="F001-00001"/></div>
      <div class="form-group" style="grid-column:span 2"><label class="form-label">Concepto *</label><input type="text" id="cxcConcepto" value="${val('concepto')}" placeholder="Descripción del concepto"/></div>
      <div class="form-group"><label class="form-label">Total *</label><input type="number" id="cxcTotal" value="${val('total',0)}" min="0" step="0.01" oninput="calcSaldoCxc()"/></div>
      <div class="form-group"><label class="form-label">Cobrado</label><input type="number" id="cxcCobrado" value="${val('cobrado',0)}" min="0" step="0.01" oninput="calcSaldoCxc()"/></div>
      <div class="form-group"><label class="form-label">Saldo</label><input type="number" id="cxcSaldo" value="${val('saldo',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">Fecha Vencimiento</label><input type="date" id="cxcVencimiento" value="${val('vencimiento')}"/></div>
      <div class="form-group"><label class="form-label">Estado</label>
        <select id="cxcEstado">${['pendiente','parcial','cobrado'].map(t=>`<option ${val('estadoPago','pendiente')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    ${id&&c?renderAuditSection(c.auditLog||[],'all','cambiarFiltroAudit','auditCxcModal'):''}`;

  if(id&&c){_auditLogsActuales['auditCxcModal']=c.auditLog||[];}
  document.getElementById('btnGuardarCxc').onclick=()=>guardarCxc(id||'');
  abrirModal('modalCxc');
}

function calcSaldoCxc(){
  const total=parseFloat(document.getElementById('cxcTotal')?.value)||0;
  const cobrado=parseFloat(document.getElementById('cxcCobrado')?.value)||0;
  const saldoEl=document.getElementById('cxcSaldo');
  if(saldoEl)saldoEl.value=Math.max(0,total-cobrado).toFixed(2);
}

function guardarCxc(id=''){
  if(!BD.cxcExtra)BD.cxcExtra=[];
  const datos={
    fecha:leerCampo('cxcFecha'),cliente:leerCampo('cxcCliente'),ruc:leerCampo('cxcRuc'),
    tipoComp:leerCampo('cxcTipoComp'),numero:leerCampo('cxcNumero'),concepto:leerCampo('cxcConcepto'),
    total:leerNumero('cxcTotal'),cobrado:leerNumero('cxcCobrado'),saldo:leerNumero('cxcSaldo'),
    vencimiento:leerCampo('cxcVencimiento'),estadoPago:leerCampo('cxcEstado'),tipo:'manual',
  };
  if(!datos.fecha||!datos.cliente||datos.total<=0){toast('Completa los campos obligatorios','error');return;}
  if(id){
    const idx=BD.cxcExtra.findIndex(c=>c.id===id);
    if(idx>=0){
      const antes={...BD.cxcExtra[idx]};
      const diffs=calcDiffsAudit(antes,datos,{cliente:'Cliente',total:'Total',cobrado:'Cobrado',saldo:'Saldo',estadoPago:'Estado'});
      BD.cxcExtra[idx]={...BD.cxcExtra[idx],...datos};
      if(!BD.cxcExtra[idx].auditLog)BD.cxcExtra[idx].auditLog=[];
      if(diffs.length)BD.cxcExtra[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,`${diffs.length} campo(s) modificado(s)`,'',diffs));
      toast('CxC actualizada','exito');
    }
  } else {
    BD.cxcExtra.unshift({...datos,id:generarId(),createdAt:new Date().toISOString(),
      auditLog:[crearEntradaAudit(AUDIT.CREAR,'CxC registrada',`Cliente: ${datos.cliente}`)]});
    toast('CxC registrada','exito');
  }
  guardarEnStorage(); cerrarModal('modalCxc'); renderCxc();
}

function marcarCxcCobrada(id){
  const c=BD.cxcExtra.find(x=>x.id===id); if(!c)return;
  c.cobrado=c.total; c.saldo=0; c.estadoPago='cobrado';
  if(!c.auditLog)c.auditLog=[];
  c.auditLog.push(crearEntradaAudit(AUDIT.ESTADO,'Marcado como cobrado','',
    [{campo:'Estado',antes:c.estadoPago||'pendiente',despues:'cobrado'},{campo:'Cobrado',antes:'0',despues:String(c.total)}]));
  guardarEnStorage(); renderCxc(); toast('CxC marcada como cobrada','exito');
}

function eliminarCxc(id){
  mostrarConfirm('Eliminar CxC','¿Eliminar esta cuenta por cobrar?',()=>{
    BD.cxcExtra=BD.cxcExtra.filter(c=>c.id!==id);
    guardarEnStorage(); renderCxc(); toast('CxC eliminada','alerta');
  });
}

/* ════════════════════════════════════════════════════════
   26. CxP — EDITABLE DESDE LIBRO.HTML
════════════════════════════════════════════════════════ */
function renderCxp() {
  const compP=BD.compras.filter(c=>c.estadoPago!=='pagado');
  const gasP=BD.gastos.filter(g=>g.estadoPago!=='pagado');
  const totC=compP.reduce((s,c)=>s+(c.total||0),0);
  const totG=gasP.reduce((s,g)=>s+(g.total||0),0);
  const totExtra=(BD.cxpExtra||[]).filter(c=>c.estadoPago!=='pagado').reduce((s,c)=>s+(c.saldo||c.total||0),0);
  const el=document.getElementById('kpiCxp');
  if(el)el.innerHTML=[
    {label:'Total por Pagar',valor:totC+totG+totExtra,tipo:'kpi-rojo',icono:'fa-hand-holding-dollar'},
    {label:'Compras Pend.',valor:totC,tipo:'kpi-ambar',icono:'fa-shopping-cart'},
    {label:'Gastos Pend.',valor:totG,tipo:'kpi-ambar',icono:'fa-receipt'},
    {label:'Extras Pend.',valor:totExtra,tipo:'kpi-morado',icono:'fa-file-circle-plus'},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${dinero(k.valor)}</div></div>`).join('');

  const tbody=document.getElementById('cuerpoCxp'); if(!tbody)return;

  const filas=[
    ...compP.map(c=>({id:c.id,tipo:'compra',fecha:c.fecha,prov:c.proveedor,doc:`${c.tipoComp||''} ${c.serie||''}-${c.numero||''}`,total:c.total,pagado:0,saldo:c.total,vencimiento:'',estado:c.estadoPago})),
    ...gasP.map(g=>({id:g.id,tipo:'gasto',fecha:g.fecha,prov:g.proveedor,doc:`${g.tipoComp||''} ${g.serie||''}-${g.numero||''}`,total:g.total,pagado:0,saldo:g.total,vencimiento:'',estado:g.estadoPago})),
    ...(BD.cxpExtra||[]).filter(c=>c.estadoPago!=='pagado').map(c=>({id:c.id,tipo:'extra',fecha:c.fecha,prov:c.proveedor,doc:`${c.tipoComp||''} ${c.numero||''}`,total:c.total,pagado:c.pagado||0,saldo:c.saldo||c.total,vencimiento:c.vencimiento||'',estado:c.estadoPago})),
  ].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));

  if(!filas.length){tbody.innerHTML=`<tr><td colspan="9"><div class="tabla-vacia"><i class="fa fa-circle-check" style="color:var(--verde)"></i><p>Sin cuentas por pagar 🎉</p></div></td></tr>`;return;}
  tbody.innerHTML=filas.map(r=>`<tr>
    <td>${fechaCorta(r.fecha)}</td>
    <td>${r.prov||'—'}</td>
    <td style="font-size:11px">${r.doc}</td>
    <td style="font-weight:700">${dinero(r.total)}</td>
    <td style="color:var(--verde)">${dinero(r.pagado)}</td>
    <td style="color:var(--rojo);font-weight:700">${dinero(r.saldo)}</td>
    <td style="font-size:11px;color:var(--rojo)">${r.vencimiento?fechaCorta(r.vencimiento):'—'}</td>
    <td><span class="badge badge-rojo">${r.estado||'pendiente'}</span></td>
    <td><div style="display:flex;gap:3px">
      ${r.tipo==='compra'?`<button class="btn-icono" onclick="marcarCompraPagada('${r.id}')" title="Marcar pagado"><i class="fa fa-check"></i></button>`:''}
      ${r.tipo==='gasto'?`<button class="btn-icono" onclick="marcarGastoPagado('${r.id}')" title="Marcar pagado"><i class="fa fa-check"></i></button>`:''}
      ${r.tipo==='extra'?`<button class="btn-icono" onclick="abrirModalCxp('${r.id}')" title="Editar"><i class="fa fa-pen"></i></button>`:''}
      ${r.tipo==='extra'?`<button class="btn-icono" onclick="marcarCxpPagada('${r.id}')" title="Pagar"><i class="fa fa-check"></i></button>`:''}
      ${r.tipo==='extra'?`<button class="btn-icono" style="color:var(--rojo)" onclick="eliminarCxp('${r.id}')" title="Eliminar"><i class="fa fa-trash"></i></button>`:''}
    </div></td>
  </tr>`).join('');
}

function marcarCompraPagada(id){
  const c=BD.compras.find(x=>x.id===id); if(!c)return;
  c.estadoPago='pagado';
  if(!c.auditLog)c.auditLog=[];
  c.auditLog.push(crearEntradaAudit(AUDIT.ESTADO,'Marcado como pagado','Actualizado desde CxP'));
  guardarEnStorage(); renderCxp(); toast('Compra marcada como pagada','exito');
}

function marcarGastoPagado(id){
  const g=BD.gastos.find(x=>x.id===id); if(!g)return;
  g.estadoPago='pagado';
  if(!g.auditLog)g.auditLog=[];
  g.auditLog.push(crearEntradaAudit(AUDIT.ESTADO,'Marcado como pagado','Actualizado desde CxP'));
  guardarEnStorage(); renderCxp(); toast('Gasto marcado como pagado','exito');
}

function abrirModalCxp(id=null) {
  if(!BD.cxpExtra)BD.cxpExtra=[];
  const c=id?BD.cxpExtra.find(x=>x.id===id):null;
  const val=(f,d='')=>c?(c[f]??d):d;
  document.getElementById('modalCxpTitulo').innerHTML=`<i class="fa fa-hand-holding-dollar"></i> ${id?'Editar':'Nueva'} Cuenta por Pagar`;
  document.getElementById('modalCxpBody').innerHTML=`
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="cxpFecha" value="${val('fecha',hoy())}"/></div>
      <div class="form-group"><label class="form-label">Proveedor *</label><input type="text" id="cxpProveedor" value="${val('proveedor')}" placeholder="Nombre o razón social"/></div>
      <div class="form-group"><label class="form-label">RUC / DNI</label><input type="text" id="cxpRuc" value="${val('ruc')}" placeholder="20xxxxxxxxx"/></div>
      <div class="form-group"><label class="form-label">Tipo Comprobante</label>
        <select id="cxpTipoComp">${['Factura','Boleta','Recibo','Otro'].map(t=>`<option ${val('tipoComp')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">N° Documento</label><input type="text" id="cxpNumero" value="${val('numero')}" placeholder="F001-00001"/></div>
      <div class="form-group" style="grid-column:span 2"><label class="form-label">Concepto *</label><input type="text" id="cxpConcepto" value="${val('concepto')}" placeholder="Descripción del concepto"/></div>
      <div class="form-group"><label class="form-label">Total *</label><input type="number" id="cxpTotal" value="${val('total',0)}" min="0" step="0.01" oninput="calcSaldoCxp()"/></div>
      <div class="form-group"><label class="form-label">Pagado</label><input type="number" id="cxpPagado" value="${val('pagado',0)}" min="0" step="0.01" oninput="calcSaldoCxp()"/></div>
      <div class="form-group"><label class="form-label">Saldo</label><input type="number" id="cxpSaldo" value="${val('saldo',0)}" readonly style="background:var(--superficie2)"/></div>
      <div class="form-group"><label class="form-label">Fecha Vencimiento</label><input type="date" id="cxpVencimiento" value="${val('vencimiento')}"/></div>
      <div class="form-group"><label class="form-label">Estado</label>
        <select id="cxpEstado">${['pendiente','parcial','pagado'].map(t=>`<option ${val('estadoPago','pendiente')===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    ${id&&c?renderAuditSection(c.auditLog||[],'all','cambiarFiltroAudit','auditCxpModal'):''}`;

  if(id&&c){_auditLogsActuales['auditCxpModal']=c.auditLog||[];}
  document.getElementById('btnGuardarCxp').onclick=()=>guardarCxp(id||'');
  abrirModal('modalCxp');
}

function calcSaldoCxp(){
  const total=parseFloat(document.getElementById('cxpTotal')?.value)||0;
  const pagado=parseFloat(document.getElementById('cxpPagado')?.value)||0;
  const saldoEl=document.getElementById('cxpSaldo');
  if(saldoEl)saldoEl.value=Math.max(0,total-pagado).toFixed(2);
}

function guardarCxp(id=''){
  if(!BD.cxpExtra)BD.cxpExtra=[];
  const datos={
    fecha:leerCampo('cxpFecha'),proveedor:leerCampo('cxpProveedor'),ruc:leerCampo('cxpRuc'),
    tipoComp:leerCampo('cxpTipoComp'),numero:leerCampo('cxpNumero'),concepto:leerCampo('cxpConcepto'),
    total:leerNumero('cxpTotal'),pagado:leerNumero('cxpPagado'),saldo:leerNumero('cxpSaldo'),
    vencimiento:leerCampo('cxpVencimiento'),estadoPago:leerCampo('cxpEstado'),tipo:'manual',
  };
  if(!datos.fecha||!datos.proveedor||datos.total<=0){toast('Completa los campos obligatorios','error');return;}
  if(id){
    const idx=BD.cxpExtra.findIndex(c=>c.id===id);
    if(idx>=0){
      const antes={...BD.cxpExtra[idx]};
      const diffs=calcDiffsAudit(antes,datos,{proveedor:'Proveedor',total:'Total',pagado:'Pagado',saldo:'Saldo',estadoPago:'Estado'});
      BD.cxpExtra[idx]={...BD.cxpExtra[idx],...datos};
      if(!BD.cxpExtra[idx].auditLog)BD.cxpExtra[idx].auditLog=[];
      if(diffs.length)BD.cxpExtra[idx].auditLog.push(crearEntradaAudit(AUDIT.EDITAR,`${diffs.length} campo(s) modificado(s)`,'',diffs));
      toast('CxP actualizada','exito');
    }
  } else {
    BD.cxpExtra.unshift({...datos,id:generarId(),createdAt:new Date().toISOString(),
      auditLog:[crearEntradaAudit(AUDIT.CREAR,'CxP registrada',`Proveedor: ${datos.proveedor}`)]});
    toast('CxP registrada','exito');
  }
  guardarEnStorage(); cerrarModal('modalCxp'); renderCxp();
}

function marcarCxpPagada(id){
  if(!BD.cxpExtra)return;
  const c=BD.cxpExtra.find(x=>x.id===id); if(!c)return;
  c.pagado=c.total; c.saldo=0; c.estadoPago='pagado';
  if(!c.auditLog)c.auditLog=[];
  c.auditLog.push(crearEntradaAudit(AUDIT.ESTADO,'Marcado como pagado',''));
  guardarEnStorage(); renderCxp(); toast('CxP marcada como pagada','exito');
}

function eliminarCxp(id){
  mostrarConfirm('Eliminar CxP','¿Eliminar esta cuenta por pagar?',()=>{
    BD.cxpExtra=BD.cxpExtra.filter(c=>c.id!==id);
    guardarEnStorage(); renderCxp(); toast('CxP eliminada','alerta');
  });
}

/* ════════════════════════════════════════════════════════
   27. REPORTES
════════════════════════════════════════════════════════ */
function renderReportes(){
  const kpiEl=document.getElementById('kpiReportes');
  if(kpiEl)kpiEl.innerHTML=[
    {label:'Ventas Totales',valor:totalVentas(),tipo:'kpi-dorado',icono:'fa-cart-plus'},
    {label:'Compras Totales',valor:totalCompras(),tipo:'kpi-ambar',icono:'fa-shopping-cart'},
    {label:'Gastos Totales',valor:totalGastos(),tipo:'kpi-rojo',icono:'fa-receipt'},
    {label:'Utilidad Bruta',valor:utilidadBruta(),tipo:'kpi-azul',icono:'fa-calculator'},
    {label:'Utilidad Neta',valor:utilidadNeta(),tipo:utilidadNeta()>=0?'kpi-verde':'kpi-rojo',icono:'fa-sack-dollar'},
    {label:'Margen Utilidad',valor:margenUtilidad(),tipo:'kpi-verde',icono:'fa-chart-pie',esPct:true},
    {label:'ROI Inversiones',valor:roiInversiones(),tipo:'kpi-morado',icono:'fa-trophy',esPct:true},
    {label:'IGV por Pagar',valor:igvPagar(),tipo:'kpi-azul',icono:'fa-percent'},
    {label:'Capital de Trabajo',valor:capitalTrabajo(),tipo:capitalTrabajo()>=0?'kpi-verde':'kpi-rojo',icono:'fa-briefcase'},
    {label:'Cuentas x Cobrar',valor:totalCxC(),tipo:'kpi-ambar',icono:'fa-file-invoice-dollar'},
  ].map(k=>`<div class="kpi-card ${k.tipo}"><span class="kpi-icono"><i class="fa ${k.icono}"></i></span><div class="kpi-label">${k.label}</div><div class="kpi-valor">${k.esPct?pct(k.valor):dinero(k.valor)}</div></div>`).join('');

  // Estado de Resultados
  const erEl=document.getElementById('estadoResultados');
  if(erEl){
    const ub=utilidadBruta(),un=utilidadNeta(),mg=margenUtilidad();
    erEl.innerHTML=`
      <div class="card-header"><span class="card-titulo"><i class="fa fa-file-lines"></i> Estado de Resultados</span></div>
      <div class="er-fila"><span>Ventas netas</span><span class="er-positivo">${dinero(totalVentas())}</span></div>
      <div class="er-fila"><span>(-) Costo de ventas (compras)</span><span class="er-negativo">(${dinero(totalCompras())})</span></div>
      <div class="er-fila subtotal"><span>= Utilidad Bruta</span><span class="${ub>=0?'er-positivo':'er-negativo'}">${dinero(ub)}</span></div>
      <div class="er-fila"><span>(-) Gastos operativos</span><span class="er-negativo">(${dinero(totalGastos())})</span></div>
      <div class="er-fila total-er"><span>= UTILIDAD NETA</span><span class="${un>=0?'er-positivo':'er-negativo'}">${dinero(un)}</span></div>
      <div class="er-fila" style="margin-top:.75rem"><span>Margen de utilidad</span><span style="font-weight:600;color:${mg>=0?'var(--verde)':'var(--rojo)'}">${pct(mg)}</span></div>`;
  }

  // Gráfico utilidad por mes
  const anio=anioActual();
  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const venM=Array(12).fill(0),comM=Array(12).fill(0),gasM=Array(12).fill(0);
  BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venM[getMes(v.fecha)-1]+=v.total||0;});
  BD.compras.filter(c=>getAnio(c.fecha)===anio).forEach(c=>{comM[getMes(c.fecha)-1]+=c.total||0;});
  BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{gasM[getMes(g.fecha)-1]+=g.total||0;});
  const utilM=venM.map((v,i)=>Math.round((v-comM[i]-gasM[i])*100)/100);
  crearGrafico('graficoUtilidadMes','bar',{labels:MESES,datasets:[
    {label:'Utilidad Neta',data:utilM,backgroundColor:utilM.map(u=>u>=0?'rgba(21,122,63,.75)':'rgba(185,28,28,.75)'),borderRadius:5}
  ]},{plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(0,0,0,.05)'}}}});

  // Indicadores avanzados
  const indEl=document.getElementById('indicadoresAvanzados');
  if(indEl){
    const liq=ratioLiquidez();
    indEl.innerHTML=`
      <div class="card-header"><span class="card-titulo"><i class="fa fa-gauge-high"></i> Indicadores Avanzados</span></div>
      <div class="indicadores-grid">
        <div class="ind-card"><div class="ind-label">Liquidez Corriente</div><div class="ind-valor" style="color:${liq>=1?'var(--verde)':'var(--rojo)'}">${liq>=99?'>99':liq.toFixed(2)}</div><div class="ind-desc">${liq>=2?'Excelente':liq>=1?'Aceptable':'Riesgo'}</div></div>
        <div class="ind-card"><div class="ind-label">Margen Bruto</div><div class="ind-valor" style="color:${utilidadBruta()>=0?'var(--verde)':'var(--rojo)'}">${pct(totalVentas()>0?(utilidadBruta()/totalVentas())*100:0)}</div><div class="ind-desc">Ventas − Compras / Ventas</div></div>
        <div class="ind-card"><div class="ind-label">Margen Neto</div><div class="ind-valor" style="color:${margenUtilidad()>=0?'var(--verde)':'var(--rojo)'}">${pct(margenUtilidad())}</div><div class="ind-desc">Utilidad Neta / Ventas</div></div>
        <div class="ind-card"><div class="ind-label">ROI Inversiones</div><div class="ind-valor" style="color:${roiInversiones()>=0?'var(--verde)':'var(--rojo)'}">${pct(roiInversiones())}</div><div class="ind-desc">Retorno / Inversión</div></div>
        <div class="ind-card"><div class="ind-label">Capital de Trabajo</div><div class="ind-valor" style="color:${capitalTrabajo()>=0?'var(--verde)':'var(--rojo)'}">${dinero(capitalTrabajo())}</div><div class="ind-desc">Activo Cte − Pasivo Cte</div></div>
        <div class="ind-card"><div class="ind-label">IGV Neto por Pagar</div><div class="ind-valor" style="color:var(--ambar)">${dinero(igvPagar())}</div><div class="ind-desc">IGV ventas − IGV compras</div></div>
      </div>`;
  }
}

/* ════════════════════════════════════════════════════════
   28. COMPARACIONES
════════════════════════════════════════════════════════ */
function renderComparaciones(){
  const periodo=document.getElementById('compPeriodo')?.value||'mes';
  const anio=parseInt(document.getElementById('compAnio')?.value||anioActual());
  const mes=parseInt(document.getElementById('compMes')?.value||mesActual());

  const mesWrap=document.getElementById('compMesWrap');
  if(mesWrap)mesWrap.style.display=periodo==='anio'?'none':'block';

  let labActual,labAnterior,filtActual,filtAnterior;

  if(periodo==='mes'){
    const mesAnt=mes>1?mes-1:12, anioAnt=mes>1?anio:anio-1;
    labActual=`${nombreMesFull(mes)} ${anio}`; labAnterior=`${nombreMesFull(mesAnt)} ${anioAnt}`;
    filtActual =(d)=>getMes(d)===mes&&getAnio(d)===anio;
    filtAnterior=(d)=>getMes(d)===mesAnt&&getAnio(d)===anioAnt;
  } else if(periodo==='trim'){
    const trim=Math.ceil(mes/3), trimAnt=trim>1?trim-1:4, anioAnt=trim>1?anio:anio-1;
    const mesesT=(t)=>[(t-1)*3+1,(t-1)*3+2,(t-1)*3+3];
    labActual=`T${trim} ${anio}`; labAnterior=`T${trimAnt} ${anioAnt}`;
    filtActual =(d)=>mesesT(trim).includes(getMes(d))&&getAnio(d)===anio;
    filtAnterior=(d)=>mesesT(trimAnt).includes(getMes(d))&&getAnio(d)===anioAnt;
  } else {
    labActual=`${anio}`; labAnterior=`${anio-1}`;
    filtActual =(d)=>getAnio(d)===anio;
    filtAnterior=(d)=>getAnio(d)===anio-1;
  }

  const suma=(arr,filtro)=>arr.filter(x=>filtro(x.fecha||'')).reduce((s,x)=>s+(x.total||0),0);
  const data=[
    {label:'Ventas',      act:suma(BD.ventas,filtActual),    ant:suma(BD.ventas,filtAnterior)},
    {label:'Compras',     act:suma(BD.compras,filtActual),   ant:suma(BD.compras,filtAnterior)},
    {label:'Gastos',      act:suma(BD.gastos,filtActual),    ant:suma(BD.gastos,filtAnterior)},
    {label:'Inversiones', act:suma(BD.inversiones,filtActual),ant:suma(BD.inversiones,filtAnterior)},
    {label:'Utilidad Neta',act:suma(BD.ventas,filtActual)-suma(BD.compras,filtActual)-suma(BD.gastos,filtActual),
                           ant:suma(BD.ventas,filtAnterior)-suma(BD.compras,filtAnterior)-suma(BD.gastos,filtAnterior)},
  ];

  const el=document.getElementById('contenidoComparaciones');
  if(el){
    el.innerHTML=`<div class="card" style="padding:0;margin-bottom:1.25rem">
      <table class="comp-tabla">
        <thead><tr><th>Indicador</th><th>${labAnterior}</th><th>${labActual}</th><th>Variación Abs.</th><th>Variación %</th></tr></thead>
        <tbody>${data.map(d=>{
          const dif=d.act-d.ant, pctV=d.ant!==0?((dif/Math.abs(d.ant))*100):0, sube=dif>0;
          return `<tr>
            <td style="font-weight:600">${d.label}</td>
            <td>${dinero(d.ant)}</td>
            <td style="font-weight:700">${dinero(d.act)}</td>
            <td class="${sube?'comp-sube':'comp-baja'}">${sube?'▲':'▼'} ${dinero(Math.abs(dif))}</td>
            <td class="${sube?'comp-sube':'comp-baja'}">${sube?'+':''}${pct(pctV)}</td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>`;
  }

  crearGrafico('graficoCompVentas','bar',{
    labels:[labAnterior,labActual],
    datasets:[{data:[data[0].ant,data[0].act],backgroundColor:['rgba(11,28,53,.7)','#C49A2A'],borderRadius:6}]
  },{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}});

  crearGrafico('graficoCompGastos','bar',{
    labels:[labAnterior,labActual],
    datasets:[{data:[data[2].ant,data[2].act],backgroundColor:['rgba(11,28,53,.7)','#B91C1C'],borderRadius:6}]
  },{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}});
}

/* ════════════════════════════════════════════════════════
   29. BUSCADOR GLOBAL
════════════════════════════════════════════════════════ */
function busquedaGlobalFn(q) {
  if(!q||q.length<2)return;
  q=q.toLowerCase();
  const resultados=[
    ...BD.asientos.filter(a=>(a.glosa||'').toLowerCase().includes(q)||(a.nombreCP||'').toLowerCase().includes(q)).slice(0,3).map(a=>({tipo:'Asiento',accion:()=>{mostrarSeccion('libroDiario',null);setTimeout(()=>{const el=document.getElementById('diarioBuscar');if(el){el.value=q;renderLibroDiario();}},200);}})),
    ...BD.ventas.filter(v=>(v.cliente||'').toLowerCase().includes(q)).slice(0,3).map(v=>({tipo:'Venta',accion:()=>mostrarSeccion('ventas',null)})),
    ...BD.gastos.filter(g=>(g.descripcion||'').toLowerCase().includes(g)).slice(0,3).map(g=>({tipo:'Gasto',accion:()=>mostrarSeccion('gastos',null)})),
  ];
  if(!resultados.length){toast('Sin resultados para: '+q,'');return;}
  resultados[0].accion();
  toast(`${resultados.length} resultado(s) encontrado(s)`,'exito');
}

/* ════════════════════════════════════════════════════════
   30. EXPORTACIONES
════════════════════════════════════════════════════════ */
function renderExportaciones(){
  const el=document.getElementById('contenidoExportaciones'); if(!el)return;
  el.innerHTML=`
    <h3 style="font-family:var(--fuente-titulo);font-size:18px;color:var(--texto);margin-bottom:1rem">Exportar a Excel</h3>
    <div class="export-grid">
      ${[
        {titulo:'Libro Diario',       sub:'Todos los asientos contables',     icono:'📒', fn:'exportarDiarioExcel()'},
        {titulo:'Libro Mayor',        sub:'Resumen por cuenta contable',       icono:'📊', fn:'exportarMayorExcel()'},
        {titulo:'Registro de Ventas', sub:'Todas las ventas registradas',      icono:'🛒', fn:'exportarTablaExcel("ventas")'},
        {titulo:'Registro de Compras',sub:'Todas las compras registradas',     icono:'📦', fn:'exportarTablaExcel("compras")'},
        {titulo:'Registro de Gastos', sub:'Todos los gastos registrados',      icono:'🧾', fn:'exportarTablaExcel("gastos")'},
        {titulo:'Inversiones',        sub:'Registro de inversiones y ROI',     icono:'📈', fn:'exportarTablaExcel("inversiones")'},
        {titulo:'CxC Completo',       sub:'Todas las cuentas por cobrar',      icono:'💰', fn:'exportarTablaExcel("cxc")'},
        {titulo:'CxP Completo',       sub:'Todas las cuentas por pagar',       icono:'💳', fn:'exportarTablaExcel("cxp")'},
      ].map(c=>`<div class="export-card excel" onclick="${c.fn}"><span class="export-card-icono">${c.icono}</span><div class="export-card-titulo">${c.titulo}</div><div class="export-card-sub">${c.sub}</div></div>`).join('')}
    </div>
    <h3 style="font-family:var(--fuente-titulo);font-size:18px;color:var(--texto);margin:1.25rem 0 1rem">Exportar a PDF</h3>
    <div class="export-grid">
      ${[
        {titulo:'Reporte Completo',  sub:'Dashboard + KPIs en PDF',      icono:'📄', fn:'exportarReportePDF()'},
        {titulo:'Libro Diario',      sub:'Tabla de asientos en PDF',      icono:'📋', fn:'exportarDiarioPDF()'},
        {titulo:'Libro Mayor',       sub:'Resumen de cuentas en PDF',     icono:'🗂️', fn:'exportarMayorPDF()'},
      ].map(c=>`<div class="export-card pdf" onclick="${c.fn}"><span class="export-card-icono">${c.icono}</span><div class="export-card-titulo">${c.titulo}</div><div class="export-card-sub">${c.sub}</div></div>`).join('')}
    </div>
    <h3 style="font-family:var(--fuente-titulo);font-size:18px;color:var(--texto);margin:1.25rem 0 1rem">Respaldo del Sistema</h3>
    <div class="export-grid">
      <div class="export-card json" onclick="exportarRespaldoJSON()"><span class="export-card-icono">💾</span><div class="export-card-titulo">Exportar Respaldo JSON</div><div class="export-card-sub">Guarda todos los datos</div></div>
      <div class="export-card json" onclick="document.getElementById('inputImportarJSON').click()"><span class="export-card-icono">📂</span><div class="export-card-titulo">Importar Respaldo JSON</div><div class="export-card-sub">Restaura datos desde un respaldo</div></div>
      <div class="export-card" style="border-color:var(--rojo)" onclick="limpiarTodosDatos()"><span class="export-card-icono" style="color:var(--rojo)">🗑️</span><div class="export-card-titulo" style="color:var(--rojo)">Limpiar Todos los Datos</div><div class="export-card-sub">Elimina todos los registros</div></div>
    </div>
    <input type="file" id="inputImportarJSON" accept=".json" style="display:none" onchange="importarRespaldoJSON(this)"/>`;
}

function exportarDiarioExcel(){
  const ws_data=[['N°','Fecha','Cuenta','Denominación','Glosa','Tipo Doc','Debe','Haber','Tipo','Estado']];
  BD.asientos.forEach(a=>ws_data.push([a.correlativo,a.fecha,a.codCuenta,a.denomCuenta,a.glosa,`${a.tipoDoc||''} ${a.serie||''}-${a.numero||''}`,a.debe||0,a.haber||0,a.tipo,a.estado]));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ws_data),'Libro Diario');
  XLSX.writeFile(wb,`libro_diario_${hoy()}.xlsx`); toast('Libro Diario exportado','exito');
}

function exportarMayorExcel(){
  const cuentas={};
  BD.asientos.filter(a=>a.estado!=='anulado').forEach(a=>{
    if(!a.codCuenta)return;
    if(!cuentas[a.codCuenta])cuentas[a.codCuenta]={codigo:a.codCuenta,nombre:a.denomCuenta||'',debe:0,haber:0};
    cuentas[a.codCuenta].debe+=a.debe||0; cuentas[a.codCuenta].haber+=a.haber||0;
  });
  const ws_data=[['Código','Denominación','Total Debe','Total Haber','Saldo Deudor','Saldo Acreedor','Saldo Final']];
  Object.values(cuentas).forEach(c=>{
    const sD=c.debe>c.haber?c.debe-c.haber:0, sA=c.haber>c.debe?c.haber-c.debe:0;
    ws_data.push([c.codigo,c.nombre,c.debe,c.haber,sD,sA,c.debe-c.haber]);
  });
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ws_data),'Libro Mayor');
  XLSX.writeFile(wb,`libro_mayor_${hoy()}.xlsx`); toast('Libro Mayor exportado','exito');
}

function exportarTablaExcel(tipo){
  const configs={
    ventas:   {datos:BD.ventas,   headers:['Fecha','Cliente','RUC','Comprobante','Producto','Subtotal','IGV','Total','Pago','Estado','Fuente'],         fields:['fecha','cliente','ruc','tipoComp','producto','subtotal','igv','total','medioPago','estadoPago','_fuente']},
    compras:  {datos:BD.compras,  headers:['Fecha','Proveedor','RUC','Comprobante','Categoría','Descripción','Subtotal','IGV','Total','Estado'],         fields:['fecha','proveedor','ruc','tipoComp','categoria','descripcion','subtotal','igv','total','estadoPago']},
    gastos:   {datos:BD.gastos,   headers:['Fecha','Categoría','Descripción','Proveedor','Comprobante','Subtotal','IGV','Total','Pago','Estado'],        fields:['fecha','categoria','descripcion','proveedor','tipoComp','subtotal','igv','total','medioPago','estadoPago']},
    inversiones:{datos:BD.inversiones,headers:['Fecha','Tipo','Nombre','Monto','Ret.Esp','Ret.Real','Plazo','Estado','Fuente'],                          fields:['fecha','tipo','nombre','monto','retornoEsp','retornoReal','plazo','estado','_fuente']},
    cxc:      {datos:[...BD.ventas.filter(v=>v.estadoPago!=='cobrado'),...(BD.cxcExtra||[])],
                     headers:['Fecha','Cliente','Concepto','Total','Cobrado','Saldo','Estado'],
                     fields:['fecha','cliente','concepto','total','cobrado','saldo','estadoPago']},
    cxp:      {datos:[...BD.compras.filter(c=>c.estadoPago!=='pagado'),...BD.gastos.filter(g=>g.estadoPago!=='pagado'),...(BD.cxpExtra||[])],
                     headers:['Fecha','Proveedor','Concepto','Total','Pagado','Saldo','Estado'],
                     fields:['fecha','proveedor','concepto','total','pagado','saldo','estadoPago']},
  };
  const cfg=configs[tipo]; if(!cfg)return;
  const ws_data=[cfg.headers,...cfg.datos.map(d=>cfg.fields.map(f=>d[f]??''))];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ws_data),tipo);
  XLSX.writeFile(wb,`${tipo}_${hoy()}.xlsx`); toast(`${tipo} exportado a Excel`,'exito');
}

function exportarDiarioPDF(){
  const {jsPDF}=window.jspdf; const doc=new jsPDF(); const cfg=BD.config;
  let y=15;
  doc.setFontSize(16);doc.setTextColor(11,28,53);doc.text(cfg.empresa,14,y);y+=8;
  doc.setFontSize(10);doc.setTextColor(100);doc.text(`RUC: ${cfg.ruc} | ${cfg.ejercicio} | ${hoy()}`,14,y);y+=10;
  doc.setFontSize(13);doc.setTextColor(11,28,53);doc.text('LIBRO DIARIO',14,y);y+=8;
  const headers=['N°','Fecha','Cuenta','Glosa','Debe','Haber','Tipo','Estado'];
  const colW=[15,22,18,60,22,22,18,18];
  let x=14;
  doc.setFillColor(11,28,53);doc.rect(14,y-4,196,6,'F');doc.setTextColor(255);doc.setFontSize(8);
  headers.forEach((h,i)=>{doc.text(h,x,y);x+=colW[i];}); y+=4; doc.setTextColor(40);
  BD.asientos.slice(0,40).forEach(a=>{
    if(y>270){doc.addPage();y=15;}
    x=14;
    [a.correlativo,a.fecha,a.codCuenta||'',(a.glosa||'').slice(0,35),(a.debe||0).toFixed(2),(a.haber||0).toFixed(2),a.tipo||'',a.estado||'']
      .forEach((v,i)=>{doc.text(String(v),x,y);x+=colW[i];}); y+=5;
  });
  y+=8;doc.setFontSize(9);doc.setTextColor(100);
  doc.text(`Contador: ${cfg.contador} | N° Colegiatura: ${cfg.colegiatura}`,14,y);y+=5;
  doc.text(`Representante Legal: ${cfg.representante}`,14,y);
  doc.save(`libro_diario_${hoy()}.pdf`); toast('Libro Diario PDF exportado','exito');
}

function exportarMayorPDF(){
  const {jsPDF}=window.jspdf; const doc=new jsPDF(); const cfg=BD.config;
  let y=15;
  doc.setFontSize(16);doc.setTextColor(11,28,53);doc.text(cfg.empresa,14,y);y+=8;
  doc.setFontSize(10);doc.setTextColor(100);doc.text(`RUC: ${cfg.ruc} | ${hoy()}`,14,y);y+=10;
  doc.setFontSize(13);doc.setTextColor(11,28,53);doc.text('LIBRO MAYOR',14,y);y+=8;
  const cuentas={};
  BD.asientos.filter(a=>a.estado!=='anulado').forEach(a=>{
    if(!a.codCuenta)return;
    if(!cuentas[a.codCuenta])cuentas[a.codCuenta]={codigo:a.codCuenta,nombre:a.denomCuenta||'',debe:0,haber:0};
    cuentas[a.codCuenta].debe+=a.debe||0; cuentas[a.codCuenta].haber+=a.haber||0;
  });
  doc.setFillColor(11,28,53);doc.rect(14,y-4,196,6,'F');doc.setTextColor(255);doc.setFontSize(8);
  ['Código','Denominación','Debe','Haber','Saldo'].forEach((h,i)=>doc.text(h,14+[0,22,110,138,166][i],y));
  y+=4; doc.setTextColor(40);
  Object.values(cuentas).forEach(c=>{
    if(y>270){doc.addPage();y=15;}
    doc.text(c.codigo,14,y); doc.text(c.nombre.slice(0,40),36,y);
    doc.text(c.debe.toFixed(2),124,y,{align:'right'}); doc.text(c.haber.toFixed(2),152,y,{align:'right'});
    doc.text((c.debe-c.haber).toFixed(2),190,y,{align:'right'}); y+=5;
  });
  doc.save(`libro_mayor_${hoy()}.pdf`); toast('Libro Mayor PDF exportado','exito');
}

function exportarReportePDF(){
  const {jsPDF}=window.jspdf; const doc=new jsPDF(); const cfg=BD.config;
  let y=20;
  doc.setFillColor(11,28,53);doc.rect(0,0,210,30,'F');
  doc.setTextColor(255);doc.setFontSize(16);doc.text(cfg.empresa,14,14);
  doc.setFontSize(10);doc.text(`RUC: ${cfg.ruc} | ${cfg.ejercicio}`,14,22); y=42;
  doc.setTextColor(11,28,53);doc.setFontSize(14);doc.text('REPORTE FINANCIERO INTEGRAL',14,y);y+=10;
  doc.setFontSize(10);doc.setTextColor(80);
  [
    `Fecha de emisión: ${hoy()}`, `Período: ${cfg.periodo}`, ``,
    `RESUMEN EJECUTIVO:`,
    `Ventas totales: ${dinero(totalVentas())}`, `Compras totales: ${dinero(totalCompras())}`,
    `Gastos totales: ${dinero(totalGastos())}`, `Utilidad Bruta: ${dinero(utilidadBruta())}`,
    `Utilidad Neta: ${dinero(utilidadNeta())}`, `Margen de Utilidad: ${pct(margenUtilidad())}`,
    `Saldo de Caja: ${dinero(saldoCaja())}`, `Cuentas por Cobrar: ${dinero(totalCxC())}`,
    `Cuentas por Pagar: ${dinero(totalCxP())}`, `IGV por Pagar: ${dinero(igvPagar())}`,
    `Capital de Trabajo: ${dinero(capitalTrabajo())}`, `ROI Inversiones: ${pct(roiInversiones())}`,
    ``, `Contador: ${cfg.contador}`, `N° Colegiatura: ${cfg.colegiatura}`,
    `Representante Legal: ${cfg.representante}`,
  ].forEach(l=>{if(y>270){doc.addPage();y=15;}doc.text(l,14,y);y+=7;});
  doc.save(`reporte_financiero_${hoy()}.pdf`); toast('Reporte PDF exportado','exito');
}

function exportarRespaldoJSON(){
  const json=JSON.stringify(BD,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`respaldo_am_${hoy()}.json`;
  a.click(); URL.revokeObjectURL(url); toast('Respaldo exportado','exito');
}

/* Exportar Balances a Excel */
function exportarBalancesExcel(){
  const efectivo=Math.max(0,saldoCaja());
  const cxcT=totalCxC();
  const inventario=totalCompras()*0.15;
  const activoFijo=totalInversiones()*0.8;
  const activoCte=efectivo+cxcT+inventario;
  const totalActivo=activoCte+activoFijo;
  const cxpT=totalCxP();
  const tributos=igvPagar();
  const pasivoCte=cxpT+tributos;
  const pasivoNoCte=totalInversiones()*0.2;
  const totalPasivo=pasivoCte+pasivoNoCte;
  const capital=totalActivo*0.4;
  const resultEjer=utilidadNeta();
  const totalPatrim=capital+resultEjer;

  const ws_data=[
    [`${BD.config.empresa} — Balance General al ${hoy()}`],[],
    ['ACTIVOS'],
    ['Efectivo y equivalentes (10)', efectivo],
    ['Cuentas por cobrar (12)',      cxcT],
    ['Inventarios (20)',             inventario],
    ['Total Activo Corriente',       activoCte],
    ['Propiedad planta y equipo (33)',activoFijo],
    ['TOTAL ACTIVO',                 totalActivo],
    [],
    ['PASIVOS'],
    ['Cuentas por pagar (42)',       cxpT],
    ['Tributos por pagar (40)',      tributos],
    ['Total Pasivo Corriente',       pasivoCte],
    ['Obligaciones financieras (45)',pasivoNoCte],
    ['TOTAL PASIVO',                 totalPasivo],
    [],
    ['PATRIMONIO'],
    ['Capital social (50)',          capital],
    ['Resultado del ejercicio (89)', resultEjer],
    ['TOTAL PATRIMONIO',             totalPatrim],
    [],
    ['VERIFICACIÓN: Activo = Pasivo + Patrimonio'],
    ['Activo',totalActivo],['Pasivo + Patrimonio',totalPasivo+totalPatrim],
    ['Diferencia (debe ser 0)',Math.abs(totalActivo-(totalPasivo+totalPatrim))],
    [],
    ['INDICADORES'],
    ['Liquidez Corriente',   activoCte>0&&cxpT>0?(activoCte/cxpT).toFixed(2):'N/A'],
    ['Margen Utilidad %',    pct(margenUtilidad())],
    ['ROI Inversiones %',    pct(roiInversiones())],
    ['Capital de Trabajo',   capitalTrabajo()],
    ['IGV por Pagar',        igvPagar()],
  ];
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb,ws,'Balance General');
  XLSX.writeFile(wb,`balance_general_${hoy()}.xlsx`);
  toast('Balance General exportado a Excel','exito');
}

function importarRespaldoJSON(input){
  const file=input.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=(e)=>{
    try {
      const datos=JSON.parse(e.target.result);
      mostrarConfirm('Importar Respaldo','¿Reemplazar todos los datos actuales con el respaldo?',()=>{
        BD={...BD,...datos}; guardarEnStorage(); actualizarInfoEmpresa(); renderDashboard();
        toast('Respaldo importado correctamente','exito');
      });
    } catch{ toast('Error al leer el archivo JSON','error'); }
  };
  reader.readAsText(file); input.value='';
}

function limpiarTodosDatos(){
  mostrarConfirm('⚠ Limpiar Todos los Datos','¿Eliminar TODOS los asientos, ventas, compras, gastos e inversiones?',()=>{
    BD.asientos=[]; BD.ventas=[]; BD.compras=[]; BD.gastos=[]; BD.inversiones=[]; BD.bitacora=[]; BD.cxcExtra=[]; BD.cxpExtra=[];
    guardarEnStorage(); renderDashboard(); toast('Todos los datos eliminados','alerta');
  });
}

/* ════════════════════════════════════════════════════════
   31. CONFIGURACIÓN
════════════════════════════════════════════════════════ */
function renderConfigForm(){
  const el=document.getElementById('contenidoConfig'); if(!el)return;
  const c=BD.config;

  // Información de sincronización
  let ventasExternas=0, productosAlmacen=0;
  try { ventasExternas=JSON.parse(localStorage.getItem(LS_VENTAS)||'[]').length; } catch(e){}
  try { productosAlmacen=JSON.parse(localStorage.getItem(LS_ALMACEN)||'[]').length; } catch(e){}

  el.innerHTML=`
    <div class="config-bloque">
      <div class="config-bloque-titulo"><i class="fa fa-link"></i> Sincronización Multi-Módulo</div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Ventas en módulo venta.html</label><input type="text" value="${ventasExternas} comprobantes disponibles" readonly style="background:var(--superficie2)"/></div>
        <div class="form-group"><label class="form-label">Productos en registro.html</label><input type="text" value="${productosAlmacen} productos disponibles" readonly style="background:var(--superficie2)"/></div>
        <div class="form-group"><label class="form-label">Ventas sincronizadas en libro</label><input type="text" value="${BD.ventas.filter(v=>v._fuente==='venta').length} ventas de módulo ventas" readonly style="background:var(--superficie2)"/></div>
        <div class="form-group"><label class="form-label">Inversiones de almacén</label><input type="text" value="${BD.inversiones.filter(i=>i._fuente==='almacen').length} productos sincronizados" readonly style="background:var(--superficie2)"/></div>
      </div>
      <div style="display:flex;gap:.75rem;margin-top:.75rem">
        <button class="btn btn-outline btn-sm" onclick="sincronizarManual()"><i class="fa fa-rotate"></i> Sincronizar ahora</button>
        <small style="color:var(--texto3);align-self:center">Sincronización automática cada 60 segundos</small>
      </div>
    </div>
    <div class="config-bloque">
      <div class="config-bloque-titulo"><i class="fa fa-building"></i> Datos de la Empresa</div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Razón Social / Empresa *</label><input type="text" id="cfEmpresa" value="${c.empresa||''}"/></div>
        <div class="form-group"><label class="form-label">RUC *</label><input type="text" id="cfRuc" value="${c.ruc||''}"/></div>
        <div class="form-group" style="grid-column:span 2"><label class="form-label">Dirección</label><input type="text" id="cfDireccion" value="${c.direccion||''}"/></div>
        <div class="form-group"><label class="form-label">Período Tributario</label><input type="text" id="cfPeriodo" value="${c.periodo||''}"/></div>
        <div class="form-group"><label class="form-label">Ejercicio Contable</label><input type="text" id="cfEjercicio" value="${c.ejercicio||''}"/></div>
        <div class="form-group"><label class="form-label">Folio Inicial</label><input type="text" id="cfFolio" value="${c.folioInicial||''}"/></div>
        <div class="form-group"><label class="form-label">Moneda Principal</label>
          <select id="cfMoneda"><option value="PEN" ${c.moneda==='PEN'?'selected':''}>S/ Soles Peruanos</option><option value="USD" ${c.moneda==='USD'?'selected':''}>$ Dólares</option><option value="EUR" ${c.moneda==='EUR'?'selected':''}>€ Euros</option></select>
        </div>
        <div class="form-group"><label class="form-label">Fecha Inicio Período</label><input type="date" id="cfFechaInicio" value="${c.fechaInicio||''}"/></div>
        <div class="form-group"><label class="form-label">Fecha Cierre Período</label><input type="date" id="cfFechaCierre" value="${c.fechaCierre||''}"/></div>
      </div>
    </div>
    <div class="config-bloque">
      <div class="config-bloque-titulo"><i class="fa fa-user-tie"></i> Datos Profesionales</div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nombre del Contador CPC</label><input type="text" id="cfContador" value="${c.contador||''}"/></div>
        <div class="form-group"><label class="form-label">N° Colegiatura</label><input type="text" id="cfColegiatura" value="${c.colegiatura||''}"/></div>
        <div class="form-group"><label class="form-label">Representante Legal</label><input type="text" id="cfRepresentante" value="${c.representante||''}"/></div>
        <div class="form-group"><label class="form-label">Usuario del Sistema</label><input type="text" id="cfUsuario" value="${c.usuario||''}"/></div>
      </div>
    </div>
    <div class="config-bloque">
      <div class="config-bloque-titulo"><i class="fa fa-circle-info"></i> Estado del Sistema</div>
      <div class="form-grid">
        ${[
          ['N° Asientos',BD.asientos.length],['N° Ventas (total)',BD.ventas.length],
          ['N° Compras',BD.compras.length],['N° Gastos',BD.gastos.length],
          ['N° Inversiones',BD.inversiones.length],['N° CxC Extras',BD.cxcExtra?.length||0],
          ['N° CxP Extras',BD.cxpExtra?.length||0],['Última actualización',new Date().toLocaleString('es-PE')],
        ].map(([k,v])=>`<div class="form-group"><label class="form-label">${k}</label><input type="text" value="${v}" readonly style="background:var(--superficie2)"/></div>`).join('')}
      </div>
    </div>
    <div style="display:flex;gap:.75rem;flex-wrap:wrap">
      <button class="btn btn-primario" onclick="guardarConfig()"><i class="fa fa-save"></i> Guardar Configuración</button>
      <button class="btn btn-secondary" onclick="exportarRespaldoJSON()"><i class="fa fa-file-export"></i> Exportar Respaldo</button>
      <button class="btn btn-danger" onclick="limpiarTodosDatos()"><i class="fa fa-trash"></i> Limpiar Todos los Datos</button>
    </div>`;
}

function sincronizarManual(){
  sincronizarVentasExternas();
  sincronizarProductosAlmacen();
  renderConfigForm();
  toast('Sincronización completada','exito');
}

function guardarConfig(){
  const monedas={PEN:'S/',USD:'$',EUR:'€'};
  const moneda=leerCampo('cfMoneda')||'PEN';
  BD.config={
    empresa:leerCampo('cfEmpresa'), ruc:leerCampo('cfRuc'), direccion:leerCampo('cfDireccion'),
    periodo:leerCampo('cfPeriodo'), ejercicio:leerCampo('cfEjercicio'), folioInicial:leerCampo('cfFolio'),
    contador:leerCampo('cfContador'), colegiatura:leerCampo('cfColegiatura'),
    representante:leerCampo('cfRepresentante'), usuario:leerCampo('cfUsuario'),
    moneda, simbolo:monedas[moneda]||'S/',
    fechaInicio:leerCampo('cfFechaInicio'), fechaCierre:leerCampo('cfFechaCierre'),
  };
  guardarEnStorage(); actualizarInfoEmpresa(); toast('Configuración guardada correctamente','exito');
}

/* ════════════════════════════════════════════════════════
   FIN libro.js — A&M Importaciones v3.0
   Con integración: venta.html + registro.js
   CxC y CxP editables — Modales flotantes — Auditoría
════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   32. MODAL GRÁFICO AMPLIADO — VER DETALLE
════════════════════════════════════════════════════════ */

let _graficoModalActual = null; // id del gráfico activo en modal
let _graficoModalInstance = null; // instancia Chart del modal

const GRAFICOS_CONFIG = {
  ingegr: {
    titulo: 'Ingresos vs Egresos',
    icono: 'fa-chart-line',
    tipo: 'line',
    color1: '#157a3f', color2: '#B91C1C',
    kpiFn: (anio) => {
      const venMes = Array(12).fill(0), egrMes = Array(12).fill(0);
      BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
      BD.compras.filter(c=>getAnio(c.fecha)===anio).forEach(c=>{egrMes[getMes(c.fecha)-1]+=c.total||0;});
      BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{egrMes[getMes(g.fecha)-1]+=g.total||0;});
      const totIng = venMes.reduce((s,v)=>s+v,0);
      const totEgr = egrMes.reduce((s,v)=>s+v,0);
      return [
        {label:'Total Ingresos '+anio, valor:dinero(totIng), color:'var(--verde)'},
        {label:'Total Egresos '+anio,  valor:dinero(totEgr), color:'var(--rojo)'},
        {label:'Resultado Neto',       valor:dinero(totIng-totEgr), color:(totIng-totEgr)>=0?'var(--verde)':'var(--rojo)'},
        {label:'Mejor Mes',            valor:nombreMesFull(venMes.indexOf(Math.max(...venMes))+1), color:'var(--azul)'},
      ];
    },
    dataFn: (anio) => {
      const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const venMes=Array(12).fill(0), comMes=Array(12).fill(0), gasMes=Array(12).fill(0);
      BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
      BD.compras.filter(c=>getAnio(c.fecha)===anio).forEach(c=>{comMes[getMes(c.fecha)-1]+=c.total||0;});
      BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{gasMes[getMes(g.fecha)-1]+=g.total||0;});
      const egrMes=comMes.map((c,i)=>c+gasMes[i]);
      return {
        labels: MESES,
        datasets:[
          {label:'Ingresos',data:venMes,borderColor:'#157a3f',backgroundColor:'rgba(21,122,63,.12)',tension:.4,fill:true,borderWidth:2.5,pointRadius:5,pointHoverRadius:7},
          {label:'Egresos', data:egrMes,borderColor:'#B91C1C',backgroundColor:'rgba(185,28,28,.12)',tension:.4,fill:true,borderWidth:2.5,pointRadius:5,pointHoverRadius:7},
        ],
        tablaHeaders: ['Mes','Ingresos','Egresos','Diferencia'],
        tablaRows: MESES.map((m,i)=>[m, dinero(venMes[i]), dinero(egrMes[i]), `<span style="color:${venMes[i]-egrMes[i]>=0?'var(--verde)':'var(--rojo)'}">${dinero(venMes[i]-egrMes[i])}</span>`]),
      };
    },
    opciones: { plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.06)'}}} },
  },

  ventas: {
    titulo: 'Ventas por Mes',
    icono: 'fa-chart-bar',
    tipo: 'bar',
    kpiFn: (anio) => {
      const venMes=Array(12).fill(0);
      BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
      const max=Math.max(...venMes), min=Math.min(...venMes.filter(v=>v>0)||[0]);
      const prom=venMes.reduce((s,v)=>s+v,0)/12;
      return [
        {label:'Total Ventas '+anio, valor:dinero(venMes.reduce((s,v)=>s+v,0)), color:'var(--dorado)'},
        {label:'Mejor Mes',          valor:dinero(max), color:'var(--verde)'},
        {label:'Promedio Mensual',   valor:dinero(prom), color:'var(--azul)'},
        {label:'N° Ventas',          valor:BD.ventas.filter(v=>getAnio(v.fecha)===anio).length+' ventas', color:'var(--morado)'},
      ];
    },
    dataFn: (anio) => {
      const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const venMes=Array(12).fill(0);
      BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
      return {
        labels:MESES,
        datasets:[{label:'Ventas',data:venMes,backgroundColor:venMes.map((v,i)=>v===Math.max(...venMes)?'#C49A2A':'#C49A2A88'),borderRadius:6,borderSkipped:false}],
        tablaHeaders:['Mes','Ventas','% del Total'],
        tablaRows:MESES.map((m,i)=>{
          const tot=venMes.reduce((s,v)=>s+v,0);
          return [m,dinero(venMes[i]),pct(tot>0?(venMes[i]/tot)*100:0)];
        }),
      };
    },
    opciones:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.06)'}}} },
  },

  flujo: {
    titulo: 'Flujo de Caja Acumulado',
    icono: 'fa-chart-area',
    tipo: 'line',
    kpiFn: (anio) => {
      const venMes=Array(12).fill(0),egrMes=Array(12).fill(0);
      BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
      BD.compras.filter(c=>getAnio(c.fecha)===anio).forEach(c=>{egrMes[getMes(c.fecha)-1]+=c.total||0;});
      BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{egrMes[getMes(g.fecha)-1]+=g.total||0;});
      let acum=0; let mejorAcum=-Infinity; let peorAcum=Infinity;
      venMes.forEach((v,i)=>{ acum+=v-egrMes[i]; if(acum>mejorAcum)mejorAcum=acum; if(acum<peorAcum)peorAcum=acum; });
      return [
        {label:'Flujo Final '+anio, valor:dinero(acum), color:acum>=0?'var(--verde)':'var(--rojo)'},
        {label:'Pico Máximo',       valor:dinero(mejorAcum), color:'var(--verde)'},
        {label:'Pico Mínimo',       valor:dinero(peorAcum), color:peorAcum<0?'var(--rojo)':'var(--ambar)'},
        {label:'Saldo de Caja',     valor:dinero(saldoCaja()), color:'var(--azul)'},
      ];
    },
    dataFn: (anio) => {
      const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const venMes=Array(12).fill(0),egrMes=Array(12).fill(0);
      BD.ventas.filter(v=>getAnio(v.fecha)===anio).forEach(v=>{venMes[getMes(v.fecha)-1]+=v.total||0;});
      BD.compras.filter(c=>getAnio(c.fecha)===anio).forEach(c=>{egrMes[getMes(c.fecha)-1]+=c.total||0;});
      BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{egrMes[getMes(g.fecha)-1]+=g.total||0;});
      let acum=0; const flujo=venMes.map((v,i)=>{acum+=v-egrMes[i];return Math.round(acum*100)/100;});
      return {
        labels:MESES,
        datasets:[{label:'Flujo acum.',data:flujo,borderColor:'#C49A2A',backgroundColor:(ctx)=>{
          const g=ctx.chart.ctx.createLinearGradient(0,0,0,300);
          g.addColorStop(0,'rgba(196,154,42,.25)');g.addColorStop(1,'rgba(196,154,42,.02)');return g;
        },tension:.4,fill:true,borderWidth:2.5,pointRadius:5,pointHoverRadius:7,
          pointBackgroundColor:flujo.map(v=>v>=0?'#157a3f':'#B91C1C')}],
        tablaHeaders:['Mes','Ingreso','Egreso','Flujo Mes','Acumulado'],
        tablaRows:(()=>{let ac=0;return MESES.map((m,i)=>{ac+=venMes[i]-egrMes[i];return[m,dinero(venMes[i]),dinero(egrMes[i]),`<span style="color:${venMes[i]-egrMes[i]>=0?'var(--verde)':'var(--rojo)'}">${dinero(venMes[i]-egrMes[i])}</span>`,`<span style="color:${ac>=0?'var(--verde)':'var(--rojo)'};font-weight:700">${dinero(ac)}</span>`];})})(),
      };
    },
    opciones:{ plugins:{legend:{display:false}}, scales:{y:{grid:{color:'rgba(0,0,0,.06)'}}} },
  },

  gastosPie: {
    titulo: 'Distribución de Gastos por Categoría',
    icono: 'fa-chart-pie',
    tipo: 'doughnut',
    kpiFn: (anio) => {
      const cats={};
      BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{cats[g.categoria]=(cats[g.categoria]||0)+(g.total||0);});
      const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
      const total=sorted.reduce((s,[,v])=>s+v,0);
      return [
        {label:'Total Gastos '+anio,   valor:dinero(total), color:'var(--rojo)'},
        {label:'Mayor Categoría',      valor:sorted[0]?sorted[0][0]:'—', color:'var(--dorado)'},
        {label:'N° Categorías',        valor:(sorted.length)+' categorías', color:'var(--azul)'},
        {label:'Promedio/Categoría',   valor:sorted.length?dinero(total/sorted.length):'—', color:'var(--morado)'},
      ];
    },
    dataFn: (anio) => {
      const cats={};
      BD.gastos.filter(g=>getAnio(g.fecha)===anio).forEach(g=>{cats[g.categoria]=(cats[g.categoria]||0)+(g.total||0);});
      const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
      const total=sorted.reduce((s,[,v])=>s+v,0);
      return {
        labels:sorted.map(([k])=>k),
        datasets:[{data:sorted.map(([,v])=>v),backgroundColor:COLORES.slice(0,sorted.length),borderWidth:2,borderColor:'var(--superficie)',hoverBorderWidth:0}],
        tablaHeaders:['Categoría','Total','% del Total'],
        tablaRows:sorted.map(([k,v])=>[k,dinero(v),pct(total>0?(v/total)*100:0)]),
      };
    },
    opciones:{ plugins:{legend:{position:'right',labels:{font:{size:12},padding:16}}}, cutout:'50%' },
  },
};

function llenarSelectorAnioModal() {
  const el = document.getElementById('modalGraficoAnio');
  if (!el) return;
  const a = anioActual();
  el.innerHTML = '';
  for (let y = a; y >= a-3; y--) {
    el.innerHTML += `<option value="${y}" ${y===a?'selected':''}>${y}</option>`;
  }
}

function abrirGraficoModal(graficoId) {
  _graficoModalActual = graficoId;
  const cfg = GRAFICOS_CONFIG[graficoId];
  if (!cfg) return;

  llenarSelectorAnioModal();
  document.getElementById('modalGraficoTitulo').innerHTML = `<i class="fa ${cfg.icono}"></i> ${cfg.titulo}`;
  construirContenidoGraficoModal();
  abrirModal('modalGrafico');
}

function actualizarGraficoModal() {
  if (_graficoModalActual) construirContenidoGraficoModal();
}

function construirContenidoGraficoModal() {
  const graficoId = _graficoModalActual;
  const cfg = GRAFICOS_CONFIG[graficoId];
  const anio = parseInt(document.getElementById('modalGraficoAnio')?.value || anioActual());

  // KPIs
  const kpis = cfg.kpiFn(anio);
  const kpiEl = document.getElementById('modalGraficoKpis');
  if (kpiEl) {
    kpiEl.innerHTML = kpis.map(k=>`
      <div class="grafico-modal-kpi">
        <div class="grafico-modal-kpi-label">${k.label}</div>
        <div class="grafico-modal-kpi-valor" style="color:${k.color}">${k.valor}</div>
      </div>`).join('');
  }

  // Datos del gráfico
  const dataCfg = cfg.dataFn(anio);

  // Destruir instancia anterior
  if (_graficoModalInstance) { try { _graficoModalInstance.destroy(); } catch(e){} _graficoModalInstance = null; }

  const canvas = document.getElementById('canvasGraficoModal');
  if (canvas) {
    _graficoModalInstance = new Chart(canvas.getContext('2d'), {
      type: cfg.tipo,
      data: { labels: dataCfg.labels, datasets: dataCfg.datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                return ` ${ctx.dataset.label||ctx.label}: ${typeof val==='number'?dinero(val):val}`;
              }
            }
          },
          ...(cfg.opciones?.plugins || {}),
        },
        ...(cfg.opciones || {}),
      },
    });
  }

  // Tabla de datos
  const tablaEl = document.getElementById('modalGraficoTabla');
  if (tablaEl && dataCfg.tablaRows) {
    tablaEl.innerHTML = `
      <div class="grafico-modal-tabla-titulo">
        <i class="fa fa-table" style="color:var(--dorado)"></i>
        Datos del período ${anio}
      </div>
      <div class="tabla-wrap">
        <table>
          <thead><tr>${dataCfg.tablaHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${dataCfg.tablaRows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

function exportarGraficoModal() {
  const canvas = document.getElementById('canvasGraficoModal');
  if (!canvas) return;
  const cfg = GRAFICOS_CONFIG[_graficoModalActual];
  const nombre = (cfg?.titulo||'grafico').toLowerCase().replace(/\s+/g,'_');
  const link = document.createElement('a');
  link.download = `${nombre}_${hoy()}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
  toast('Gráfico exportado como PNG','exito');
}

/* ════════════════════════════════════════════════════════
   FIN libro.js — A&M Importaciones v3.0
   Con integración: venta.html + registro.js
   CxC y CxP editables — Modales flotantes — Auditoría
   Gráfico ampliado — Historial de cambios corregido
════════════════════════════════════════════════════════ */