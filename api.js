/* =============================================
   A&M — api.js
   Cliente HTTP compartido por todos los módulos
   ============================================= */

"use strict";

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
      localStorage.removeItem("am_token");
      localStorage.removeItem("am_worker");
      window.location.href = "login.html";
      throw new Error("Sesión expirada");
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  },

  get(endpoint) { return this.request("GET", endpoint); },
  post(endpoint, body) { return this.request("POST", endpoint, body); },
  put(endpoint, body) { return this.request("PUT", endpoint, body); },
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
  },

  workers: {
    list() { return API.get("/api/workers"); },
    get(id) { return API.get(`/api/workers/${id}`); },
    create(data) { return API.post("/api/workers", data); },
    update(id, data) { return API.put(`/api/workers/${id}`, data); },
    remove(id) { return API.delete(`/api/workers/${id}`); },
  },

  auth: {
    logout() { return API.post("/api/auth/logout"); },
  },

  sales: {
    list() { return API.get("/api/sales"); },
    create(data) { return API.post("/api/sales", data); },
  },

  clients: {
    list() { return API.get("/api/clients"); },
    create(data) { return API.post("/api/clients", data); },
  },

  paymentMethods: {
    list() { return API.get("/api/payment-methods"); },
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
    list() { return API.get("/api/sessions"); },
    revoke(id) { return API.post(`/api/sessions/${id}/revoke`); },
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
