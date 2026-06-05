/* =============================================
   A&M — api.js
   Cliente HTTP compartido por todos los módulos
   ============================================= */

"use strict";

// Rastrea la última interacción real del usuario en esta pestaña
let _lastInteraction = Date.now();
["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(evt =>
  window.addEventListener(evt, () => { _lastInteraction = Date.now(); }, { passive: true })
);

const API = {
  getToken() {
    return localStorage.getItem("am_token");
  },

  getWorker() {
    try {
      return JSON.parse(localStorage.getItem("am_worker") || "null");
    } catch {
      return null;
    }
  },

  // Página de inicio según rol (única fuente de verdad para redirects post-login).
  // Los marcados con TBD serán asignados cuando se defina su módulo.
  ROLE_HOME: {
    admin:        "control.html",
    supervisor:   "trabajadores.html",   // TBD — pendiente de asignar
    vendedor:     "venta.html",
    cajero:       "venta.html",          // TBD — pendiente de asignar
    almacen:      "registro.html",
    contabilidad: "libro.html",
    soporte:      "control.html",        // TBD — pendiente de asignar
  },

  getHomePage() {
    const worker = this.getWorker();
    if (!worker) return "login.html";
    return this.ROLE_HOME[worker.role] || "control.html";
  },

  // Redirige al login si no hay token o expiró
  requireAuth() {
    if (!this.getToken()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  },

  async request(method, endpoint, body = null) {
    const token = this.getToken();
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
    };
    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(endpoint, opts);

    if (res.status === 401) {
      // Difundir logout a todas las pestañas y redirigir
      if (typeof window.AM_logoutAndRedirect === "function") {
        window.AM_logoutAndRedirect("session_expired");
      } else {
        localStorage.removeItem("am_token");
        localStorage.removeItem("am_worker");
        window.location.replace("login.html");
      }
      throw new Error("Sesión expirada");
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  },

  get(endpoint) { return this.request("GET", endpoint); },
  post(endpoint, body) { return this.request("POST", endpoint, body); },
  put(endpoint, body) { return this.request("PUT", endpoint, body); },
  patch(endpoint, body) { return this.request("PATCH", endpoint, body); },
  delete(endpoint) { return this.request("DELETE", endpoint); },

  /* ── Atajos por módulo ── */
  products: {
    list() { return API.get("/api/products"); },
    create(data) { return API.post("/api/products", data); },
    update(id, data) { return API.put(`/api/products/${id}`, data); },
    remove(id) { return API.delete(`/api/products/${id}`); },
  },

  catalogs: {
    list() { return API.get("/api/catalogs"); },
    add(type, name, extra) { return API.post(`/api/catalogs/${type}`, { name, ...extra }); },
    toggleVisibility(id, visible) { return API.patch(`/api/catalogs/categorias/${id}/visibility`, { visible }); },
  },

  workers: {
    list() { return API.get("/api/workers"); },
    get(id) { return API.get(`/api/workers/${id}`); },
    create(data) { return API.post("/api/workers", data); },
    update(id, data) { return API.put(`/api/workers/${id}`, data); },
    remove(id) { return API.delete(`/api/workers/${id}`); },
    getAudit(id) { return API.get(`/api/workers/${id}/audit`); },
    auditAll()   { return API.get("/api/workers/audit-all"); },
    addAudit(id, action, description, diffs) {
      return API.post(`/api/workers/${id}/audit`, { action, description, diffs });
    },
  },

  auth: {
    async logout() {
      try { await API.post("/api/auth/logout"); } catch {}
      // Difundir cierre de sesión a TODAS las pestañas abiertas
      if (typeof window.AM_logoutAndRedirect === "function") {
        window.AM_logoutAndRedirect("logout");
      } else {
        try {
          const bc = new BroadcastChannel("am_auth_channel");
          bc.postMessage({ type: "AM_LOGOUT", reason: "logout" });
          bc.close();
        } catch {}
        localStorage.removeItem("am_token");
        localStorage.removeItem("am_worker");
        window.location.replace("login.html");
      }
    },
  },

  sales: {
    list() { return API.get("/api/sales"); },
    get(id) { return API.get(`/api/sales/${id}`); },
    create(data) { return API.post("/api/sales", data); },
    update(id, data) { return API.put(`/api/sales/${id}`, data); },
    addAudit(id, data) { return API.post(`/api/sales/${id}/audit`, data); },
  },

  complaints: {
    list() { return API.get("/api/complaints"); },
    create(data) { return API.post("/api/complaints", data); },
    update(id, data) { return API.put(`/api/complaints/${id}`, data); },
    remove(id) { return API.delete(`/api/complaints/${id}`); },
    getAudit(id) { return API.get(`/api/complaints/${id}/audit`); },
  },

  clients: {
    list() { return API.get("/api/clients"); },
    create(data) { return API.post("/api/clients", data); },
    update(id, data) { return API.put(`/api/clients/${id}`, data); },
    remove(id) { return API.delete(`/api/clients/${id}`); },
    getAudit(id) { return API.get(`/api/clients/${id}/audit`); },
  },

  paymentMethods: {
    list() { return API.get("/api/payment-methods"); },
  },

  accounting: {
    // Plan contable
    plan() { return API.get("/api/accounting/plan"); },

    // Asientos (journal_entries)
    entries()             { return API.get("/api/accounting/entries"); },
    createEntry(data)     { return API.post("/api/accounting/entries", data); },
    updateEntry(id, data) { return API.put(`/api/accounting/entries/${id}`, data); },
    deleteEntry(id)       { return API.delete(`/api/accounting/entries/${id}`); },

    // Ventas del libro
    libroVentas()              { return API.get("/api/accounting/libro-ventas"); },
    ventasFromSales()          { return API.get("/api/accounting/ventas-from-sales"); },
    createVenta(data)          { return API.post("/api/accounting/libro-ventas", data); },
    updateVenta(id, data)      { return API.put(`/api/accounting/libro-ventas/${id}`, data); },
    deleteVenta(id)            { return API.delete(`/api/accounting/libro-ventas/${id}`); },

    // Compras del libro
    libroCompras()             { return API.get("/api/accounting/libro-compras"); },
    createCompra(data)         { return API.post("/api/accounting/libro-compras", data); },
    updateCompra(id, data)     { return API.put(`/api/accounting/libro-compras/${id}`, data); },
    deleteCompra(id)           { return API.delete(`/api/accounting/libro-compras/${id}`); },

    // Gastos del libro
    libroGastos()              { return API.get("/api/accounting/libro-gastos"); },
    createGasto(data)          { return API.post("/api/accounting/libro-gastos", data); },
    updateGasto(id, data)      { return API.put(`/api/accounting/libro-gastos/${id}`, data); },
    deleteGasto(id)            { return API.delete(`/api/accounting/libro-gastos/${id}`); },

    // Inversiones del libro
    libroInversiones()         { return API.get("/api/accounting/libro-inversiones"); },
    createInversion(data)      { return API.post("/api/accounting/libro-inversiones", data); },
    updateInversion(id, data)  { return API.put(`/api/accounting/libro-inversiones/${id}`, data); },
    deleteInversion(id)        { return API.delete(`/api/accounting/libro-inversiones/${id}`); },

    // CxC
    libroCxc()                 { return API.get("/api/accounting/libro-cxc"); },
    createCxc(data)            { return API.post("/api/accounting/libro-cxc", data); },
    updateCxc(id, data)        { return API.put(`/api/accounting/libro-cxc/${id}`, data); },
    deleteCxc(id)              { return API.delete(`/api/accounting/libro-cxc/${id}`); },

    // CxP
    libroCxp()                 { return API.get("/api/accounting/libro-cxp"); },
    createCxp(data)            { return API.post("/api/accounting/libro-cxp", data); },
    updateCxp(id, data)        { return API.put(`/api/accounting/libro-cxp/${id}`, data); },
    deleteCxp(id)              { return API.delete(`/api/accounting/libro-cxp/${id}`); },
  },

  exchange: {
    rates() { return API.get("/api/exchange-rates"); },
    currencies() { return API.get("/api/currencies"); },
    save(data) { return API.post("/api/exchange-rates", data); },
  },

  attendance: {
    list(params = {}) {
      const q = new URLSearchParams(params).toString();
      return API.get(`/api/attendance${q ? "?" + q : ""}`);
    },
    checkin(worker_id, method) { return API.post("/api/attendance/checkin", { worker_id, method }); },
    checkout(worker_id, method) { return API.post("/api/attendance/checkout", { worker_id, method }); },
    accessLog() { return API.get("/api/attendance/access-log"); },
  },

  sessions: {
    list()                    { return API.get("/api/sessions"); },
    revoke(id)                { return API.post(`/api/sessions/${id}/revoke`); },
    workerDetail(workerId)    { return API.get(`/api/sessions/worker/${workerId}`); },
    closePage(worker_id, tab_id) {
      return API.post("/api/sessions/admin-close-page", { worker_id, tab_id });
    },
    heartbeat(url, title, tab, last_interaction) {
      return API.post("/api/sessions/heartbeat",
        { page_url: url, page_title: title, tab_id: tab, last_interaction });
    },
  },

  /* Inicia el heartbeat periódico.
     - tab_id: UUID único por PESTAÑA (sessionStorage, no se comparte entre tabs).
     - Se llama al cargar y luego cada 30 s.
     - Envía heartbeat inmediato cuando el usuario vuelve a estar activo tras inactividad.
     - Al cerrar la pestaña, sendBeacon avisa al servidor de inmediato. */
  startHeartbeat(page_url, page_title) {
    if (!this.getToken()) return;
    if (!sessionStorage.getItem("am_tab_id")) {
      sessionStorage.setItem("am_tab_id",
        "tab-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36));
    }
    const tab_id = sessionStorage.getItem("am_tab_id");

    // Verificar permisos antes de iniciar (no bloquea el hilo, es async)
    this.requirePageAccess(page_url);

    // _serverIsIdle: true = el servidor no tiene registro de actividad reciente
    // Se actualiza con cada beat enviado
    let _serverIsIdle = true;
    let _debounce = null;

    const beat = () => {
      const idleSecs = (Date.now() - _lastInteraction) / 1000;
      const lastInter = idleSecs < 300 ? new Date(_lastInteraction).toISOString() : null;
      _serverIsIdle = idleSecs >= 60;
      this.sessions.heartbeat(page_url, page_title, tab_id, lastInter)
        .then(res => {
          if (res && res.force_close) {
            // El admin cerró este módulo — limpiar tab_id y redirigir
            sessionStorage.removeItem("am_tab_id");
            document.body.innerHTML = `
              <div style="display:flex;align-items:center;justify-content:center;
                          min-height:100vh;background:#fee2e2;font-family:sans-serif;text-align:center;padding:24px">
                <div>
                  <div style="font-size:52px">🔒</div>
                  <h2 style="color:#b91c1c;margin:16px 0 8px;font-size:20px">Módulo cerrado por el administrador</h2>
                  <p style="color:#991b1b;margin-bottom:4px">Tu acceso a este módulo fue cerrado remotamente.</p>
                  <p style="color:#6b7280;font-size:13px">Redirigiendo a tu panel principal...</p>
                </div>
              </div>`;
            setTimeout(() => { window.top.location.href = API.getHomePage(); }, 2500);
          }
        })
        .catch(() => {});
    };

    beat();
    setInterval(beat, 30000);

    // Heartbeat inmediato (0.8 s debounce) cuando el usuario interactúa
    // y el servidor aún cree que está inactivo
    ["mousemove", "keydown", "click", "scroll"].forEach(evt =>
      window.addEventListener(evt, () => {
        if (_serverIsIdle) {
          clearTimeout(_debounce);
          _debounce = setTimeout(() => {
            _serverIsIdle = false;
            beat();
          }, 800);
        }
      }, { passive: true })
    );

    // Aviso inmediato al cerrar la pestaña (sendBeacon funciona durante pagehide)
    window.addEventListener("pagehide", () => {
      const token = this.getToken();
      if (!token || !tab_id) return;
      const blob = new Blob(
        [JSON.stringify({ tab_id, token })],
        { type: "application/json" }
      );
      navigator.sendBeacon("/api/sessions/page-close", blob);
    });
  },

  permissions: {
    list()                        { return API.get("/api/permissions"); },
    myAccess(page)                { return API.get(`/api/permissions/my-access?page=${encodeURIComponent(page)}`); },
    set(worker_id, page_url, allowed) { return API.put("/api/permissions", { worker_id, page_url, allowed }); },
    bulk(worker_id, permissions)  { return API.put("/api/permissions/bulk", { worker_id, permissions }); },
  },

  // Verifica acceso del usuario actual a una página.
  // Pone un overlay INMEDIATO (síncrono) para que nunca se vea el contenido
  // antes de verificar. El overlay se retira si hay acceso, o se convierte en
  // pantalla de denegación si no lo hay. Admins siempre pasan sin overlay.
  async requirePageAccess(page_url) {
    const worker = this.getWorker();
    if (!worker || worker.role === "admin") return;

    // Overlay síncrono — cubre el contenido ANTES de cualquier render
    const guard = document.createElement("div");
    guard.style.cssText = [
      "position:fixed","inset:0","z-index:999999",
      "background:#f8fafc","display:flex",
      "align-items:center","justify-content:center",
      "font-family:'Outfit',system-ui,sans-serif"
    ].join(";");
    guard.innerHTML = `
      <div style="text-align:center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
             stroke="#94a3b8" stroke-width="2"
             style="animation:spin 1s linear infinite;display:block;margin:0 auto 12px">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                   M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <p style="color:#94a3b8;font-size:13px;margin:0">Verificando acceso...</p>
      </div>`;
    // Insertar antes de que el DOM esté listo si es posible
    (document.body || document.documentElement).appendChild(guard);

    try {
      const result = await this.permissions.myAccess(page_url);
      if (!result.allowed) {
        // Transformar el overlay en pantalla de denegación
        guard.style.background = "#fef2f2";
        guard.innerHTML = `
          <div style="text-align:center;padding:32px;max-width:380px">
            <div style="font-size:56px">🚫</div>
            <h2 style="color:#b91c1c;margin:18px 0 10px;font-size:22px;font-weight:700">
              Acceso denegado
            </h2>
            <p style="color:#991b1b;margin-bottom:8px;font-size:15px">
              No tienes permiso para acceder a este módulo.
            </p>
            <p style="color:#6b7280;font-size:13px">
              Contacta al administrador para solicitar acceso.
            </p>
            <p style="color:#9ca3af;font-size:12px;margin-top:18px">
              Redirigiendo al panel principal...
            </p>
          </div>`;
        setTimeout(() => { window.top.location.href = API.getHomePage(); }, 3000);
      } else {
        guard.remove(); // Acceso concedido — quitar el overlay y mostrar la página
      }
    } catch (e) {
      guard.remove(); // Error de red → fail-open (no bloquear por problemas de conexión)
    }
  },

  /* ── Clientes (portal web inicio.html) ── */
  customers: {
    getToken()  { return localStorage.getItem("am_customer_token"); },
    getUser()   { try { return JSON.parse(localStorage.getItem("am_customer_user") || "null"); } catch { return null; } },
    setSession(token, user) {
      localStorage.setItem("am_customer_token", token);
      localStorage.setItem("am_customer_user",  JSON.stringify(user));
    },
    clearSession() {
      localStorage.removeItem("am_customer_token");
      localStorage.removeItem("am_customer_user");
    },
    isLogged() { return !!this.getToken(); },

    async request(method, endpoint, body = null) {
      const token = this.getToken();
      const opts  = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
      };
      if (body) opts.body = JSON.stringify(body);
      const res  = await fetch(endpoint, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    },

    login(doc_type, doc_number) {
      return this.request("POST", "/api/customers/login", { doc_type, doc_number });
    },
    register(data) {
      return this.request("POST", "/api/customers/register", data);
    },
    me()             { return this.request("GET", "/api/customers/me"); },
    updateProfile(d) { return this.request("PUT", "/api/customers/me", d); },
    orders()         { return this.request("GET", "/api/customers/orders"); },
    deliveryOrders() { return this.request("GET", "/api/delivery-orders/customer/my-orders"); },
    confirmDelivery(id) { return this.request("PUT", `/api/delivery-orders/${id}/confirm`, {}); },
    cancelDelivery(id, reason) { return this.request("PUT", `/api/delivery-orders/${id}/cancel`, { reason }); },
  },

  /* ── Admin: gestión de clientes ── */
  adminCustomers: {
    list()           { return API.get("/api/admin/customers"); },
    get(id)          { return API.get(`/api/admin/customers/${id}`); },
    update(id, data) { return API.put(`/api/admin/customers/${id}`, data); },
    orders(id)       { return API.get(`/api/admin/customers/${id}/orders`); },
    purchases(id)    { return API.get(`/api/admin/customers/${id}/purchases`); },
    remove(id)       { return API.delete(`/api/admin/customers/${id}`); },
  },

  accounting: {
    entries() { return API.get("/api/accounting/entries"); },
    plan() { return API.get("/api/accounting/plan"); },
    createEntry(data) { return API.post("/api/accounting/entries", data); },
    purchases() { return API.get("/api/purchases"); },
    expenses() { return API.get("/api/expenses"); },
  },

  dashboard: {
    stats() { return API.get("/api/dashboard/stats"); },
  },
};
