const modules = {
  dashboard:   { title:'Dashboard General',         sub:'Administra todos tus módulos desde una sola pantalla amplia',              file:'' },
  trabajadores:{ title:'Trabajadores',              sub:'Gestión de trabajadores, sesiones, asistencia, KPIs y bitácora',           file:'trabajadores.html' },
  inicio:      { title:'Página Principal',          sub:'Vista pública de la tienda y catálogo',                                    file:'inicio.html' },
  inventario:  { title:'Inventario / Productos',    sub:'Registro, stock, edición y auditoría de productos',                       file:'registro.html' },
  ventas:      { title:'Ventas / Clientes',         sub:'Comprobantes, clientes, reclamos y operaciones comerciales',               file:'venta.html' },
  cambio:      { title:'Tipo de Cambio',            sub:'Control de monedas, bancos, historial y gráficos',                        file:'cambio.html' },
  libro:       { title:'Libro Contable Digital',    sub:'Asientos, balances, CxC, CxP, reportes financieros y auditoría',          file:'libro.html' },
  marcacion:   { title:'Marcación de Asistencia',   sub:'Ingreso y salida por credenciales, reconocimiento facial y huella digital', file:'marcacion.html' }
};

const STORAGE = {
  workers:'AM_CONTROL_WORKERS',
  attendance:'AM_CONTROL_ATTENDANCE',
  logs:'AM_CONTROL_LOGS',
  history:'AM_CONTROL_WORKER_HISTORY',
  theme:'AM_CONTROL_THEME'
};

let currentFile = '';
let activeWorkerTab = 'lista';
let workerFilters = { search:'', role:'', status:'', session:'', gender:'', docType:'', attendanceType:'', from:'', to:'', birthdayMonth:'', minAbsences:'', minLates:'' };

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const now = () => new Date().toLocaleString('es-PE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const todayISO = () => new Date().toISOString().split('T')[0];
const timeNow = () => new Date().toTimeString().slice(0,5);
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function load(key, fallback){
  try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}
}
function save(key, value){localStorage.setItem(key, JSON.stringify(value))}
function safeText(s,t){const e=$(s); if(e)e.textContent=t}
function safeClass(s,act,c){const e=$(s); if(!e)return; if(act==='add')e.classList.add(c); if(act==='remove')e.classList.remove(c)}

function seedData(){
  if(!localStorage.getItem(STORAGE.workers)){
    const workers = [
      {id:genId(), firstName:'Abraham', lastName:'Aranda Cerna', docType:'DNI', docNumber:'76427598', gender:'Masculino', email:'abrahamjheremycerna@gmail.com', phone:'928020850', role:'admin', password:'123456', schedule:'Lun-Vie 08:00 - 17:00', homeType:'Casa', address:'Lima, Perú', birthday:'2000-01-01', emergencyName:'Contacto familiar', emergencyPhone:'999999999', status:'activo', session:'online', lastAccess:now(), createdAt:now()},
      {id:genId(), firstName:'Melani', lastName:'Luyo Ramírez', docType:'DNI', docNumber:'00000000', gender:'Femenino', email:'melanieluyo4@gmail.com', phone:'900000000', role:'supervisor', password:'123456', schedule:'Lun-Sáb 09:00 - 18:00', homeType:'Departamento', address:'Lima, Perú', birthday:'2005-01-01', emergencyName:'Contacto emergencia', emergencyPhone:'988888888', status:'activo', session:'offline', lastAccess:'—', createdAt:now()}
    ];
    save(STORAGE.workers, workers);
  }
  if(!localStorage.getItem(STORAGE.attendance)) save(STORAGE.attendance, []);
  if(!localStorage.getItem(STORAGE.history)) save(STORAGE.history, []);
  if(!localStorage.getItem(STORAGE.logs)){
    save(STORAGE.logs, [{id:genId(), createdBy:'Administrador', worker:'Sistema', action:'Inicialización', motive:'Se creó la base local del control de trabajadores.', createdAt:now()}]);
  }
}

function workers(){return load(STORAGE.workers, [])}
function attendance(){return load(STORAGE.attendance, [])}
function logs(){return load(STORAGE.logs, [])}

function addLog(worker, action, motive){
  const data = logs();
  data.unshift({id:genId(), createdBy:'Administrador', worker, action, motive, createdAt:now()});
  save(STORAGE.logs, data);
  updateMetrics();
}

function setDate(){
  const el=$('#dateNow');
  if(el) el.textContent=new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

function setActive(page){
  $$('.nav-item').forEach(btn=>btn.classList.toggle('active', btn.dataset.page===page));
}

function showBackButton(show){
  const b=$('#btnBackDashboard');
  if(b)b.classList.toggle('hidden', !show);
}

function updateMetrics(){
  const w=workers(), a=attendance(), l=logs();
  safeText('#metricWorkers', w.length);
  safeText('#metricOnline', w.filter(x=>x.session==='online').length);
  safeText('#metricAttendance', a.length);
  safeText('#metricLogs', l.length);
}

function openModule(page){
  const data=modules[page];
  if(!data)return;
  document.body.classList.add('module-open');
  setActive(page);
  showBackButton(true);
  safeText('#pageTitle', data.title);
  safeText('#pageSub', data.sub);
  safeText('#workspaceTitle', data.title);
  safeText('#workspaceDesc', data.sub);
  safeClass('#dashboardView','add','hidden');
  safeClass('#internalPanel','add','hidden');
  const frame=$('#moduleFrame');
  if(frame){frame.classList.remove('hidden'); frame.src=data.file}
  currentFile=data.file;
  closeMobile();
}

function openDashboard(){
  document.body.classList.remove('module-open');
  setActive('dashboard');
  showBackButton(false);
  safeText('#pageTitle','Dashboard General');
  safeText('#pageSub','Administra todos tus módulos desde una sola pantalla amplia');
  safeText('#workspaceTitle','Vista rápida del sistema');
  safeText('#workspaceDesc','Selecciona un módulo para abrirlo en pantalla completa dentro del panel.');
  safeClass('#moduleFrame','add','hidden');
  safeClass('#internalPanel','add','hidden');
  safeClass('#dashboardView','remove','hidden');
  const frame=$('#moduleFrame'); if(frame)frame.src='';
  currentFile='';
  updateMetrics();
  closeMobile();
}

function openInternal(type){
  document.body.classList.remove('module-open');
  setActive(type);
  showBackButton(false);
  safeClass('#dashboardView','add','hidden');
  safeClass('#moduleFrame','add','hidden');
  const frame=$('#moduleFrame'); if(frame)frame.src='';
  const panel=$('#internalPanel'); if(!panel)return;
  panel.classList.remove('hidden');

  if(type==='trabajadores') renderWorkersPanel();
  if(type==='sesiones') renderSessionsPanel();
  if(type==='bitacora') renderLogsPanel();
  if(type==='reportes') renderReportsPanel();
  if(type==='configuracion') renderConfigPanel();

  currentFile='';
  closeMobile();
}


function workerHistory(){return load(STORAGE.history, [])}

function saveWorkerHistory(entry){
  const data = workerHistory();
  data.unshift({
    id: genId(),
    workerId: entry.workerId || '',
    workerName: entry.workerName || 'Sistema',
    action: entry.action || 'Registro',
    motive: entry.motive || 'Sin motivo registrado',
    createdBy: entry.createdBy || 'Administrador',
    createdAt: entry.createdAt || now(),
    diffs: entry.diffs || [],
    type: entry.type || 'info'
  });
  save(STORAGE.history, data);
}

function getWorkerNameById(id){
  const w = workers().find(x=>x.id===id);
  return w ? `${w.firstName} ${w.lastName}` : 'Trabajador eliminado';
}

function calcWorkerDiffs(before, after){
  if(!before) return [];
  const labels = {
    firstName:'Nombre', lastName:'Apellidos', docType:'Tipo Doc.', docNumber:'N° Documento',
    gender:'Género', email:'Correo', phone:'Celular', role:'Rol', schedule:'Horario',
    homeType:'Domicilio', address:'Dirección', birthday:'Cumpleaños',
    emergencyName:'Contacto emergencia', emergencyPhone:'Número emergencia', status:'Estatus'
  };
  return Object.keys(labels).filter(k => String(before[k] ?? '') !== String(after[k] ?? '')).map(k=>({
    field: labels[k],
    from: String(before[k] ?? '—'),
    to: String(after[k] ?? '—')
  }));
}

function getFilteredWorkers(){
  let data = workers();
  const f = workerFilters;
  data = data.filter(w=>{
    const full = `${w.firstName} ${w.lastName} ${w.email} ${w.docNumber} ${w.phone}`.toLowerCase();
    if(f.search && !full.includes(f.search.toLowerCase())) return false;
    if(f.role && w.role !== f.role) return false;
    if(f.status && w.status !== f.status) return false;
    if(f.session && w.session !== f.session) return false;
    if(f.gender && w.gender !== f.gender) return false;
    if(f.docType && w.docType !== f.docType) return false;
    if(f.birthdayMonth && (!w.birthday || String(new Date(w.birthday).getMonth()+1) !== String(Number(f.birthdayMonth)))) return false;
    const att = attendance().filter(a=>a.workerId===w.id);
    if(f.attendanceType && !att.some(a=>a.type===f.attendanceType)) return false;
    if(f.from && !att.some(a=>a.date >= f.from)) return false;
    if(f.to && !att.some(a=>a.date <= f.to)) return false;
    const abs = att.filter(a=>a.type==='falta').length;
    const late = att.filter(a=>a.type==='tardanza').length;
    if(f.minAbsences && abs < Number(f.minAbsences)) return false;
    if(f.minLates && late < Number(f.minLates)) return false;
    return true;
  });
  return data;
}

function getWorkerKpis(workerList = workers()){
  const ids = new Set(workerList.map(w=>w.id));
  const att = attendance().filter(a=>ids.has(a.workerId));
  const total = att.length;
  const asistencia = att.filter(a=>a.type==='asistencia').length;
  const tardanza = att.filter(a=>a.type==='tardanza').length;
  const falta = att.filter(a=>a.type==='falta').length;
  const permiso = att.filter(a=>a.type==='permiso').length;
  const salida = att.filter(a=>a.type==='salida_temprana').length;
  const horasDebe = att.reduce((s,a)=>s + Number(a.hoursDebt || 0), 0);
  const horasJust = att.reduce((s,a)=>s + Number(a.justifiedHours || 0), 0);
  const pctAsistencia = total ? Math.round((asistencia / total) * 100) : 0;
  return { total, asistencia, tardanza, falta, permiso, salida, horasDebe, horasJust, pctAsistencia };
}

function renderWorkerKpis(list){
  const k = getWorkerKpis(list);
  return `
    <div class="kpi-grid">
      <div class="kpi-card success"><small>% Asistencia</small><strong>${k.pctAsistencia}%</strong><p>Sobre registros filtrados</p><div class="progress-line"><span style="width:${k.pctAsistencia}%"></span></div></div>
      <div class="kpi-card success"><small>Asistencias</small><strong>${k.asistencia}</strong><p>Entradas correctas</p></div>
      <div class="kpi-card warning"><small>Tardanzas</small><strong>${k.tardanza}</strong><p>Llegadas fuera de horario</p></div>
      <div class="kpi-card danger"><small>Faltas</small><strong>${k.falta}</strong><p>Ausencias registradas</p></div>
      <div class="kpi-card info"><small>Horas por deber</small><strong>${k.horasDebe.toFixed(1)}</strong><p>Horas pendientes</p></div>
      <div class="kpi-card"><small>Horas justificadas</small><strong>${k.horasJust.toFixed(1)}</strong><p>Permisos sustentados</p></div>
    </div>`;
}

function renderAdvancedFilters(){
  return `
    <div class="advanced-filters">
      <div class="advanced-filters-head">
        <div>
          <h4>Filtros avanzados de trabajadores</h4>
          <p>Filtra por datos personales, rol, estado, sesión, asistencia y acumulados.</p>
        </div>
        <div class="toolbar-actions">
          <button class="btn-light" onclick="clearWorkerFilters()">Limpiar filtros</button>
          <button class="btn-primary" onclick="applyWorkerFilters()">Aplicar filtros</button>
        </div>
      </div>
      <div class="advanced-grid">
        <label>Buscar trabajador
          <input id="wfSearch" placeholder="Nombre, correo, DNI, celular..." value="${workerFilters.search}">
        </label>
        <label>Rol
          <select id="wfRole">
            <option value="">Todos</option>
            ${['admin','supervisor','vendedor','almacen','contabilidad'].map(x=>`<option value="${x}" ${workerFilters.role===x?'selected':''}>${x}</option>`).join('')}
          </select>
        </label>
        <label>Estatus
          <select id="wfStatus">
            <option value="">Todos</option>
            ${['activo','suspendido','desconectado','cesado'].map(x=>`<option value="${x}" ${workerFilters.status===x?'selected':''}>${x}</option>`).join('')}
          </select>
        </label>
        <label>Sesión
          <select id="wfSession">
            <option value="">Todas</option>
            <option value="online" ${workerFilters.session==='online'?'selected':''}>Activo</option>
            <option value="offline" ${workerFilters.session==='offline'?'selected':''}>Desconectado</option>
          </select>
        </label>
        <label>Género
          <select id="wfGender">
            <option value="">Todos</option>
            ${['Femenino','Masculino','Otro'].map(x=>`<option value="${x}" ${workerFilters.gender===x?'selected':''}>${x}</option>`).join('')}
          </select>
        </label>
        <label>Tipo documento
          <select id="wfDocType">
            <option value="">Todos</option>
            ${['DNI','CE','Pasaporte'].map(x=>`<option value="${x}" ${workerFilters.docType===x?'selected':''}>${x}</option>`).join('')}
          </select>
        </label>
        <label>Tipo asistencia
          <select id="wfAttendanceType">
            <option value="">Todos</option>
            ${['asistencia','tardanza','falta','salida_temprana','permiso'].map(x=>`<option value="${x}" ${workerFilters.attendanceType===x?'selected':''}>${x}</option>`).join('')}
          </select>
        </label>
        <label>Mes cumpleaños
          <select id="wfBirthdayMonth">
            <option value="">Todos</option>
            ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'].map((m,i)=>`<option value="${i+1}" ${Number(workerFilters.birthdayMonth)===i+1?'selected':''}>${m}</option>`).join('')}
          </select>
        </label>
        <label>Desde fecha
          <input id="wfFrom" type="date" value="${workerFilters.from}">
        </label>
        <label>Hasta fecha
          <input id="wfTo" type="date" value="${workerFilters.to}">
        </label>
        <label>Mínimo faltas
          <input id="wfMinAbsences" type="number" min="0" value="${workerFilters.minAbsences}">
        </label>
        <label>Mínimo tardanzas
          <input id="wfMinLates" type="number" min="0" value="${workerFilters.minLates}">
        </label>
      </div>
    </div>`;
}

function applyWorkerFilters(){
  workerFilters = {
    search: $('#wfSearch')?.value || '',
    role: $('#wfRole')?.value || '',
    status: $('#wfStatus')?.value || '',
    session: $('#wfSession')?.value || '',
    gender: $('#wfGender')?.value || '',
    docType: $('#wfDocType')?.value || '',
    attendanceType: $('#wfAttendanceType')?.value || '',
    from: $('#wfFrom')?.value || '',
    to: $('#wfTo')?.value || '',
    birthdayMonth: $('#wfBirthdayMonth')?.value || '',
    minAbsences: $('#wfMinAbsences')?.value || '',
    minLates: $('#wfMinLates')?.value || ''
  };
  renderWorkersPanel();
}

function clearWorkerFilters(){
  workerFilters = { search:'', role:'', status:'', session:'', gender:'', docType:'', attendanceType:'', from:'', to:'', birthdayMonth:'', minAbsences:'', minLates:'' };
  renderWorkersPanel();
}

function workerStats(workerId){
  const att = attendance().filter(a=>a.workerId===workerId);
  return {
    asistencias: att.filter(a=>a.type==='asistencia').length,
    tardanzas: att.filter(a=>a.type==='tardanza').length,
    faltas: att.filter(a=>a.type==='falta').length,
    permisos: att.filter(a=>a.type==='permiso').length,
    horasDebe: att.reduce((s,a)=>s+Number(a.hoursDebt||0),0),
    horasJust: att.reduce((s,a)=>s+Number(a.justifiedHours||0),0),
    total: att.length
  };
}

function renderWorkersPanel(){
  safeText('#pageTitle','Control de Trabajadores');
  safeText('#pageSub','Filtros avanzados, KPIs, asistencia, modificaciones y observaciones');
  safeText('#workspaceTitle','Gestión integral de trabajadores');
  safeText('#workspaceDesc','Control completo de trabajadores con indicadores, filtros avanzados e historial con ojito.');

  const list = getFilteredWorkers();

  $('#internalPanel').innerHTML = `
    <div class="panel-toolbar">
      <div><h3>Control de trabajadores</h3><p>Administración laboral, asistencia, observaciones y auditoría por trabajador.</p></div>
      <div class="toolbar-actions">
        <button class="btn-primary" onclick="openWorkerModal()">+ Crear trabajador</button>
        <button class="btn-light" onclick="exportWorkers()">Exportar JSON</button>
      </div>
    </div>

    ${renderWorkerKpis(list)}
    ${renderAdvancedFilters()}

    <div class="summary-grid">
      <div class="summary-card"><small>Trabajadores filtrados</small><strong>${list.length}</strong><p>De ${workers().length} registrados</p></div>
      <div class="summary-card"><small>Activos</small><strong>${list.filter(w=>w.status==='activo').length}</strong><p>Con estado activo</p></div>
      <div class="summary-card"><small>Sesiones activas</small><strong>${list.filter(w=>w.session==='online').length}</strong><p>Conectados ahora</p></div>
      <div class="summary-card"><small>Observaciones</small><strong>${workerHistory().filter(h=>list.some(w=>w.id===h.workerId)).length}</strong><p>Registros visibles con ojito</p></div>
    </div>

    <div class="worker-tabs">
      <button class="worker-tab ${activeWorkerTab==='lista'?'active':''}" onclick="setWorkerTab('lista')">Lista de trabajadores</button>
      <button class="worker-tab ${activeWorkerTab==='asistencia'?'active':''}" onclick="setWorkerTab('asistencia')">Asistencias / Tardanzas / Faltas</button>
      <button class="worker-tab ${activeWorkerTab==='kpi'?'active':''}" onclick="setWorkerTab('kpi')">KPI detallado</button>
    </div>

    <div id="workerTabContent"></div>`;
  renderWorkerTabContent();
}

function setWorkerTab(tab){
  activeWorkerTab=tab;
  renderWorkersPanel();
}

function renderWorkerTabContent(){
  const box=$('#workerTabContent');
  if(!box)return;
  const list = getFilteredWorkers();

  if(activeWorkerTab==='lista'){
    const rows = list.map(w=>{
      const st = workerStats(w.id);
      return `
      <tr>
        <td>
          <div class="worker-name-cell">
            <strong>${w.firstName} ${w.lastName}</strong>
            <small>${w.email}</small>
            <span class="audit-pill">📘 ${workerHistory().filter(h=>h.workerId===w.id).length} registros</span>
          </div>
        </td>
        <td>${w.docType}: ${w.docNumber}<br><small>${w.gender}</small></td>
        <td>${w.phone}<br><small>${w.address || 'Sin dirección'}</small></td>
        <td><span class="badge info">${w.role}</span></td>
        <td>${w.schedule}</td>
        <td>${statusBadge(w.status)}</td>
        <td>${sessionBadge(w.session)}</td>
        <td>
          <small>A:${st.asistencias} · T:${st.tardanzas} · F:${st.faltas}</small><br>
          <small>Debe: ${st.horasDebe.toFixed(1)}h · Just.: ${st.horasJust.toFixed(1)}h</small>
        </td>
        <td class="compact-actions">
          <div class="action-row">
            <button class="mini-btn eye-btn" onclick="viewWorkerHistory('${w.id}')">👁 Ver</button>
            <button class="mini-btn" onclick="editWorker('${w.id}')">Editar</button>
            <button class="mini-btn" onclick="openAttendanceModal('${w.id}')">Asistencia</button>
            <button class="mini-btn" onclick="toggleWorkerSession('${w.id}')">${w.session==='online'?'Desconectar':'Conectar'}</button>
          </div>
        </td>
      </tr>`}).join('');

    box.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Trabajador</th><th>Documento</th><th>Contacto</th><th>Rol</th><th>Horario</th><th>Estatus</th><th>Sesión</th><th>Indicadores</th><th>Acciones</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9">No hay trabajadores con esos filtros.</td></tr>'}</tbody>
    </table></div>`;
  }

  if(activeWorkerTab==='asistencia'){
    const ids = new Set(list.map(w=>w.id));
    let attData = attendance().filter(a=>ids.has(a.workerId));
    if(workerFilters.attendanceType) attData = attData.filter(a=>a.type===workerFilters.attendanceType);
    if(workerFilters.from) attData = attData.filter(a=>a.date>=workerFilters.from);
    if(workerFilters.to) attData = attData.filter(a=>a.date<=workerFilters.to);

    const rows = attData.map(a=>`
      <tr>
        <td><strong>${a.workerName}</strong></td>
        <td>${attendanceBadge(a.type)}</td>
        <td>${a.date}</td>
        <td>${a.time}</td>
        <td>${Number(a.hoursDebt||0).toFixed(1)} h</td>
        <td>${Number(a.justifiedHours||0).toFixed(1)} h</td>
        <td>${a.reason}</td>
        <td>${a.createdBy}</td>
        <td>${a.createdAt}</td>
      </tr>`).join('');

    box.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Trabajador</th><th>Tipo</th><th>Fecha</th><th>Hora</th><th>Horas por deber</th><th>Horas justificadas</th><th>Motivo</th><th>Registrado por</th><th>Creado</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9">No hay registros de asistencia con esos filtros.</td></tr>'}</tbody>
    </table></div>`;
  }

  if(activeWorkerTab==='kpi'){
    const rows = list.map(w=>{
      const s = workerStats(w.id);
      const pct = s.total ? Math.round((s.asistencias/s.total)*100) : 0;
      return `
        <tr>
          <td><strong>${w.firstName} ${w.lastName}</strong><br><small>${w.role}</small></td>
          <td>${pct}%<div class="progress-line"><span style="width:${pct}%"></span></div></td>
          <td>${s.asistencias}</td>
          <td>${s.tardanzas}</td>
          <td>${s.faltas}</td>
          <td>${s.permisos}</td>
          <td>${s.horasDebe.toFixed(1)} h</td>
          <td>${s.horasJust.toFixed(1)} h</td>
          <td><button class="mini-btn eye-btn" onclick="viewWorkerHistory('${w.id}')">👁 Historial</button></td>
        </tr>`;
    }).join('');

    box.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Trabajador</th><th>% Asistencia</th><th>Asistencias</th><th>Tardanzas</th><th>Faltas</th><th>Permisos</th><th>Horas por deber</th><th>Horas justificadas</th><th>Historial</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9">No hay KPI para mostrar.</td></tr>'}</tbody>
    </table></div>`;
  }
}

function renderSessionsPanel(){
  safeText('#pageTitle','Control de Sesiones');
  safeText('#pageSub','Trabajadores activos, desconectados y cierre de sesión remoto');
  safeText('#workspaceTitle','Sesiones de trabajadores');
  safeText('#workspaceDesc','Desde aquí puedes desconectar trabajadores activos cuando sea necesario.');

  const data=workers();
  const rows=data.map(w=>`
    <tr>
      <td><strong>${w.firstName} ${w.lastName}</strong><br><small>${w.email}</small></td>
      <td>${w.role}</td>
      <td>${sessionBadge(w.session)}</td>
      <td>${w.lastAccess || '—'}</td>
      <td>${w.status}</td>
      <td>
        <div class="action-row">
          ${w.session==='online'
            ? `<button class="mini-btn" onclick="disconnectWorker('${w.id}')">Desconectar</button>`
            : `<button class="mini-btn" onclick="connectWorker('${w.id}')">Marcar activo</button>`}
          <button class="mini-btn" onclick="openAttendanceModal('${w.id}')">Asistencia</button>
        </div>
      </td>
    </tr>`).join('');

  $('#internalPanel').innerHTML=`
    <div class="panel-toolbar">
      <div><h3>Control de sesiones</h3><p>Monitorea trabajadores conectados y desconectados.</p></div>
      <div class="toolbar-actions">
        <button class="btn-danger" onclick="disconnectAllWorkers()">Desconectar todos</button>
      </div>
    </div>
    <div class="summary-grid">
      <div class="summary-card"><small>Activos</small><strong>${data.filter(w=>w.session==='online').length}</strong><p>Con sesión abierta</p></div>
      <div class="summary-card"><small>Desconectados</small><strong>${data.filter(w=>w.session!=='online').length}</strong><p>Sin sesión activa</p></div>
      <div class="summary-card"><small>Suspendidos</small><strong>${data.filter(w=>w.status==='suspendido').length}</strong><p>Usuarios limitados</p></div>
      <div class="summary-card"><small>Total</small><strong>${data.length}</strong><p>Trabajadores</p></div>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Trabajador</th><th>Rol</th><th>Sesión</th><th>Último acceso</th><th>Estatus</th><th>Acción</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No hay trabajadores.</td></tr>'}</tbody>
    </table></div>`;
}

function renderLogsPanel(){
  safeText('#pageTitle','Bitácora');
  safeText('#pageSub','Historial de acciones sobre trabajadores y sesiones');
  safeText('#workspaceTitle','Bitácora de trabajadores');
  safeText('#workspaceDesc','Cada acción queda registrada con responsable, hora y motivo.');

  const items=logs().map(l=>`
    <div class="log-card">
      <div class="log-card-top">
        <strong>${l.action}</strong>
        <small>${l.createdAt}</small>
      </div>
      <p>${l.motive}</p>
      <div class="log-meta">
        <span>👤 Creado por: ${l.createdBy}</span>
        <span>👥 Trabajador: ${l.worker}</span>
      </div>
    </div>`).join('');

  $('#internalPanel').innerHTML=`
    <div class="panel-toolbar">
      <div><h3>Bitácora general</h3><p>Registro de cualquier evento relacionado con trabajadores.</p></div>
      <div class="toolbar-actions">
        <button class="btn-light" onclick="clearLogs()">Limpiar bitácora</button>
      </div>
    </div>
    ${items || '<div class="log-card"><p>No hay eventos registrados.</p></div>'}`;
}

function renderReportsPanel(){
  safeText('#pageTitle','Reportes');
  safeText('#pageSub','Resumen administrativo del negocio');
  safeText('#workspaceTitle','Reportes generales');
  safeText('#workspaceDesc','Indicadores visuales de cada área.');
  $('#internalPanel').innerHTML=`
    <div class="summary-grid">
      <div class="summary-card"><small>Trabajadores</small><strong>${workers().length}</strong><p>Registrados</p></div>
      <div class="summary-card"><small>Activos</small><strong>${workers().filter(w=>w.session==='online').length}</strong><p>Sesiones abiertas</p></div>
      <div class="summary-card"><small>Faltas</small><strong>${attendance().filter(a=>a.type==='falta').length}</strong><p>Registro acumulado</p></div>
      <div class="summary-card"><small>Bitácora</small><strong>${logs().length}</strong><p>Eventos guardados</p></div>
    </div>`;
}

function renderConfigPanel(){
  safeText('#pageTitle','Configuración');
  safeText('#pageSub','Ajustes principales del panel');
  safeText('#workspaceTitle','Configuración del sistema');
  safeText('#workspaceDesc','Opciones básicas para el panel administrativo.');
  $('#internalPanel').innerHTML=`
    <div class="panel-toolbar"><div><h3>Configuración</h3><p>Ajustes rápidos del panel.</p></div></div>
    <div class="summary-grid">
      <div class="summary-card"><small>Tema</small><strong>Claro / Oscuro</strong><p>Usa el botón superior derecho.</p></div>
      <div class="summary-card"><small>Sesiones</small><strong>Control</strong><p>Permite desconectar trabajadores.</p></div>
      <div class="summary-card"><small>Bitácora</small><strong>Activa</strong><p>Registra eventos laborales.</p></div>
      <div class="summary-card"><small>Login</small><strong>login.html</strong><p>Salida directa al login.</p></div>
    </div>`;
}

function statusBadge(s){
  const map={activo:'active', suspendido:'suspended', desconectado:'offline', cesado:'terminated'};
  return `<span class="badge ${map[s]||'offline'}">${s}</span>`;
}
function sessionBadge(s){
  return s==='online' ? `<span class="badge active">🟢 Activo</span>` : `<span class="badge offline">⚫ Desconectado</span>`;
}
function attendanceBadge(t){
  const label={asistencia:'Asistencia', tardanza:'Tardanza', falta:'Falta', salida_temprana:'Salida temprana', permiso:'Permiso'}[t]||t;
  const cls=t==='asistencia'?'active':t==='falta'?'terminated':t==='tardanza'?'suspended':'info';
  return `<span class="badge ${cls}">${label}</span>`;
}

function openWorkerModal(id=null){
  $('#workerForm').reset();
  $('#workerId').value='';
  safeText('#workerModalTitle', id?'Editar trabajador':'Crear trabajador');
  if(id){
    const w=workers().find(x=>x.id===id);
    if(w){
      $('#workerId').value=w.id; $('#firstName').value=w.firstName; $('#lastName').value=w.lastName; $('#docType').value=w.docType; $('#docNumber').value=w.docNumber;
      $('#gender').value=w.gender; $('#email').value=w.email; $('#phone').value=w.phone; $('#role').value=w.role; $('#password').value=w.password;
      $('#schedule').value=w.schedule; $('#homeType').value=w.homeType; $('#address').value=w.address; $('#birthday').value=w.birthday; $('#emergencyName').value=w.emergencyName; $('#emergencyPhone').value=w.emergencyPhone; $('#status').value=w.status;
      $('#workerReason').value='Actualización de datos del trabajador.';
    }
  }
  $('#workerModal').classList.remove('hidden');
}
function closeWorkerModal(){ $('#workerModal').classList.add('hidden') }
function editWorker(id){ openWorkerModal(id) }

function saveWorker(e){
  e.preventDefault();
  const data=workers();
  const id=$('#workerId').value || genId();
  const existing=data.find(w=>w.id===id);
  const worker={
    id,
    firstName:$('#firstName').value.trim(),
    lastName:$('#lastName').value.trim(),
    docType:$('#docType').value,
    docNumber:$('#docNumber').value.trim(),
    gender:$('#gender').value,
    email:$('#email').value.trim(),
    phone:$('#phone').value.trim(),
    role:$('#role').value,
    password:$('#password').value,
    schedule:$('#schedule').value.trim(),
    homeType:$('#homeType').value.trim(),
    address:$('#address').value.trim(),
    birthday:$('#birthday').value,
    emergencyName:$('#emergencyName').value.trim(),
    emergencyPhone:$('#emergencyPhone').value.trim(),
    status:$('#status').value,
    session: existing ? existing.session : 'offline',
    lastAccess: existing ? existing.lastAccess : '—',
    createdAt: existing ? existing.createdAt : now()
  };

  if(existing){
    const idx=data.findIndex(w=>w.id===id);
    const diffs = calcWorkerDiffs(existing, worker);
    data[idx]=worker;
    addLog(`${worker.firstName} ${worker.lastName}`, 'Edición de trabajador', $('#workerReason').value.trim());
    saveWorkerHistory({
      workerId: worker.id,
      workerName: `${worker.firstName} ${worker.lastName}`,
      action: 'Modificación de datos',
      motive: $('#workerReason').value.trim(),
      diffs,
      type: 'edit'
    });
  }else{
    data.unshift(worker);
    addLog(`${worker.firstName} ${worker.lastName}`, 'Creación de trabajador', $('#workerReason').value.trim());
    saveWorkerHistory({
      workerId: worker.id,
      workerName: `${worker.firstName} ${worker.lastName}`,
      action: 'Creación de trabajador',
      motive: $('#workerReason').value.trim(),
      diffs: [],
      type: 'create'
    });
  }
  save(STORAGE.workers, data);
  closeWorkerModal();
  updateMetrics();
  renderWorkersPanel();
}

function openAttendanceModal(id){
  const w=workers().find(x=>x.id===id); if(!w)return;
  $('#attendanceForm').reset();
  $('#attendanceWorkerId').value=id;
  $('#attendanceWorkerName').value=`${w.firstName} ${w.lastName}`;
  $('#attendanceDate').value=todayISO();
  $('#attendanceTime').value=timeNow();
  $('#attendanceModal').classList.remove('hidden');
}
function closeAttendanceModal(){ $('#attendanceModal').classList.add('hidden') }

function saveAttendance(e){
  e.preventDefault();
  const id=$('#attendanceWorkerId').value;
  const w=workers().find(x=>x.id===id); if(!w)return;
  const item={id:genId(), workerId:id, workerName:`${w.firstName} ${w.lastName}`, type:$('#attendanceType').value, date:$('#attendanceDate').value, time:$('#attendanceTime').value, hoursDebt:Number($('#hoursDebt')?.value||0), justifiedHours:Number($('#justifiedHours')?.value||0), reason:$('#attendanceReason').value.trim(), createdBy:'Administrador', createdAt:now()};
  const data=attendance(); data.unshift(item); save(STORAGE.attendance, data);
  addLog(item.workerName, `Registro de ${item.type}`, item.reason);
  saveWorkerHistory({workerId:id, workerName:item.workerName, action:`Registro de ${item.type}`, motive:item.reason, diffs:[{field:'Horas por deber', from:'—', to:String(item.hoursDebt)},{field:'Horas justificadas', from:'—', to:String(item.justifiedHours)}], type:'attendance'});
  closeAttendanceModal();
  updateMetrics();
  renderWorkersPanel();
}

function connectWorker(id){
  const data=workers(); const w=data.find(x=>x.id===id); if(!w)return;
  w.session='online'; w.lastAccess=now(); if(w.status==='desconectado')w.status='activo';
  save(STORAGE.workers, data);
  addLog(`${w.firstName} ${w.lastName}`, 'Sesión activada', 'Se marcó al trabajador como activo desde el dashboard.');
  saveWorkerHistory({workerId:id, workerName:`${w.firstName} ${w.lastName}`, action:'Sesión activada', motive:'Se marcó al trabajador como activo desde el dashboard.', type:'session'});
  updateMetrics(); renderSessionsPanel();
}
function disconnectWorker(id){
  const data=workers(); const w=data.find(x=>x.id===id); if(!w)return;
  w.session='offline';
  save(STORAGE.workers, data);
  addLog(`${w.firstName} ${w.lastName}`, 'Desconexión remota', 'El administrador desconectó la sesión del trabajador.');
  saveWorkerHistory({workerId:id, workerName:`${w.firstName} ${w.lastName}`, action:'Desconexión remota', motive:'El administrador desconectó la sesión del trabajador.', type:'session'});
  updateMetrics(); renderSessionsPanel();
}
function toggleWorkerSession(id){
  const w=workers().find(x=>x.id===id);
  if(!w)return;
  if(w.session==='online') disconnectWorkerFromWorkers(id); else connectWorkerFromWorkers(id);
}
function disconnectWorkerFromWorkers(id){
  const data=workers(); const w=data.find(x=>x.id===id); w.session='offline'; save(STORAGE.workers,data);
  addLog(`${w.firstName} ${w.lastName}`,'Desconexión remota','Se desconectó desde control de trabajadores.');
  saveWorkerHistory({workerId:id, workerName:`${w.firstName} ${w.lastName}`, action:'Desconexión remota', motive:'Se desconectó desde control de trabajadores.', type:'session'});
  updateMetrics(); renderWorkersPanel();
}
function connectWorkerFromWorkers(id){
  const data=workers(); const w=data.find(x=>x.id===id); w.session='online'; w.lastAccess=now(); save(STORAGE.workers,data);
  addLog(`${w.firstName} ${w.lastName}`,'Sesión activada','Se conectó manualmente desde control de trabajadores.');
  saveWorkerHistory({workerId:id, workerName:`${w.firstName} ${w.lastName}`, action:'Sesión activada', motive:'Se conectó manualmente desde control de trabajadores.', type:'session'});
  updateMetrics(); renderWorkersPanel();
}
function disconnectAllWorkers(){
  if(!confirm('¿Deseas desconectar a todos los trabajadores activos?'))return;
  const data=workers();
  data.forEach(w=>w.session='offline');
  save(STORAGE.workers,data);
  addLog('Todos los trabajadores','Desconexión masiva','El administrador desconectó todas las sesiones activas.');
  updateMetrics(); renderSessionsPanel();
}

function clearLogs(){
  if(!confirm('¿Deseas limpiar la bitácora?'))return;
  save(STORAGE.logs, []);
  addLog('Sistema','Limpieza de bitácora','El administrador limpió la bitácora y se registró este evento.');
  renderLogsPanel();
}

function exportWorkers(){
  const blob=new Blob([JSON.stringify({workers:workers(), attendance:attendance(), logs:logs(), history:workerHistory()}, null, 2)], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='trabajadores_am_export.json'; a.click(); URL.revokeObjectURL(a.href);
}


function viewWorkerHistory(id){
  const w = workers().find(x=>x.id===id);
  if(!w)return;
  const st = workerStats(id);
  const records = workerHistory().filter(h=>h.workerId===id);
  const att = attendance().filter(a=>a.workerId===id);

  safeText('#historyTitle', `Historial de ${w.firstName} ${w.lastName}`);

  const timeline = [
    ...records.map(r=>({...r, source:'history'})),
    ...att.map(a=>({
      id:a.id, workerId:a.workerId, workerName:a.workerName,
      action:`Asistencia: ${a.type}`,
      motive:a.reason,
      createdBy:a.createdBy,
      createdAt:a.createdAt,
      diffs:[
        {field:'Fecha', from:'—', to:a.date},
        {field:'Hora', from:'—', to:a.time},
        {field:'Horas por deber', from:'—', to:String(a.hoursDebt||0)},
        {field:'Horas justificadas', from:'—', to:String(a.justifiedHours||0)}
      ],
      type:'attendance',
      source:'attendance'
    }))
  ].sort((a,b)=> new Date(parseDate(b.createdAt)) - new Date(parseDate(a.createdAt)));

  $('#historyBody').innerHTML = `
    <div class="history-profile">
      <div class="profile-box"><small>Trabajador</small><strong>${w.firstName} ${w.lastName}</strong></div>
      <div class="profile-box"><small>Rol</small><strong>${w.role}</strong></div>
      <div class="profile-box"><small>Estatus</small><strong>${w.status}</strong></div>
      <div class="profile-box"><small>Sesión</small><strong>${w.session==='online'?'Activo':'Desconectado'}</strong></div>
      <div class="profile-box"><small>Asistencias</small><strong>${st.asistencias}</strong></div>
      <div class="profile-box"><small>Tardanzas</small><strong>${st.tardanzas}</strong></div>
      <div class="profile-box"><small>Faltas</small><strong>${st.faltas}</strong></div>
      <div class="profile-box"><small>Horas debe / justificadas</small><strong>${st.horasDebe.toFixed(1)}h / ${st.horasJust.toFixed(1)}h</strong></div>
    </div>

    <div class="timeline">
      ${timeline.length ? timeline.map(item=>`
        <div class="timeline-item">
          <div class="timeline-icon">${item.type==='edit'?'✏️':item.type==='create'?'✨':item.type==='session'?'🟢':'🧾'}</div>
          <div class="timeline-card">
            <div class="timeline-top">
              <strong>${item.action}</strong>
              <small>${item.createdAt}</small>
            </div>
            <p>${item.motive || 'Sin motivo registrado'}</p>
            <div class="log-meta">
              <span>👤 Creado por: ${item.createdBy || 'Administrador'}</span>
              <span>👥 Trabajador: ${item.workerName}</span>
            </div>
            ${item.diffs && item.diffs.length ? `
              <div class="diff-box">
                ${item.diffs.map(d=>`
                  <div class="diff-row">
                    <b>${d.field}</b>
                    <span>${d.from || '—'}</span>
                    <span>→</span>
                    <span>${d.to || '—'}</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>
        </div>`).join('') : '<div class="log-card"><p>No hay registros para este trabajador.</p></div>'}
    </div>`;

  $('#historyModal').classList.remove('hidden');
}

function parseDate(str){
  if(!str)return new Date(0);
  const parts = String(str).match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):?(\d{2})?/);
  if(parts){
    return `${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}:${parts[5]}:${parts[6]||'00'}`;
  }
  return str;
}

function closeHistoryModal(){
  $('#historyModal').classList.add('hidden');
}

function refreshFrame(){const f=$('#moduleFrame'); if(f&&currentFile)f.src=currentFile}
function openNewTab(){if(currentFile)window.open(currentFile,'_blank')}
function closeFrame(){openDashboard()}
function closeMobile(){safeClass('#sidebar','remove','open');safeClass('#overlay','remove','show')}

function toggleTheme(){
  document.body.classList.toggle('dark');
  const isDark=document.body.classList.contains('dark');
  const b=$('#themeBtn'); if(b)b.textContent=isDark?'☀️':'🌙';
  localStorage.setItem(STORAGE.theme,isDark?'dark':'light');
}
function loadTheme(){
  const saved=localStorage.getItem(STORAGE.theme);
  const b=$('#themeBtn');
  if(saved==='dark'){document.body.classList.add('dark'); if(b)b.textContent='☀️'}
}
function logout(){
  localStorage.removeItem('AM_CONTROL_SESSION');
  sessionStorage.clear();
  window.location.href='login.html';
}

document.addEventListener('DOMContentLoaded',()=>{
  seedData();
  setDate();
  loadTheme();
  updateMetrics();

  $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{
    const page=btn.dataset.page;
    if(page==='dashboard')openDashboard();
    else if(modules[page])openModule(page);
    else openInternal(page);
  }));

  $('#btnRefresh')?.addEventListener('click',refreshFrame);
  $('#btnNewTab')?.addEventListener('click',openNewTab);
  $('#btnCloseFrame')?.addEventListener('click',closeFrame);
  $('#btnBackDashboard')?.addEventListener('click',openDashboard);
  $('#themeBtn')?.addEventListener('click',toggleTheme);
  $('#logoutBtn')?.addEventListener('click',logout);
  $('#overlay')?.addEventListener('click',closeMobile);
  $('#btnMenu')?.addEventListener('click',()=>{safeClass('#sidebar','add','open'); safeClass('#overlay','add','show')});
  $('#workerForm')?.addEventListener('submit',saveWorker);
  $('#attendanceForm')?.addEventListener('submit',saveAttendance);
});