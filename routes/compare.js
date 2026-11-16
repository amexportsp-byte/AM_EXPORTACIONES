"use strict";
/**
 * Comparaciones de precios: busca un producto en tiendas peruanas (APIs públicas
 * de sus catálogos) y agrupa el mismo producto entre tiendas.
 * Solo consulta cuando un trabajador pulsa "Comparar" (no hay bots ni tareas automáticas).
 */
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const auth = require("../middleware/auth");
const { STORES } = require("../services/comparador/stores");
const { normalize, compare, unitPrice } = require("../services/comparador/match");

// Solo productos que contienen todas las palabras buscadas (las tiendas rellenan con otros).
function relevant(products, query) {
  const sing = (w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
  const terms = normalize(query).split(" ").filter((w) => w.length > 1).map(sing);
  return products.filter((p) => {
    const text = normalize(`${p.name} ${p.brand}`);
    return terms.every((w) => text.includes(w));
  });
}

// Cada búsqueda consulta varias tiendas: límite por trabajador.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `w:${req.worker.id}`, // auth corre antes: siempre hay trabajador
  message: { error: "Demasiadas comparaciones seguidas. Espera un minuto." },
});

// Memoria de búsquedas recientes (10 min) para no repetir consultas a las tiendas.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();
function fromCache(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  cache.delete(key);
  return null;
}
function toCache(key, data) {
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), data });
}

// GET /api/compare/stores — tiendas disponibles
router.get("/stores", auth, (req, res) => {
  res.json(STORES.map(({ id, name, color }) => ({ id, name, color })));
});

// GET /api/compare/search?q=taladro bosch&stores=sodimac,promart
router.get("/search", auth, searchLimiter, async (req, res) => {
  const q = String(req.query.q || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return res.status(400).json({ error: "Escribe al menos 2 letras para buscar" });

  const wanted = String(req.query.stores || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const stores = wanted.length ? STORES.filter((s) => wanted.includes(s.id)) : STORES;
  if (!stores.length) return res.status(400).json({ error: "Elige al menos una tienda" });

  const key = `${q.toLowerCase()}|${stores.map((s) => s.id).sort().join(",")}`;
  const cached = fromCache(key);
  if (cached) return res.json({ ...cached, cached: true });

  const settled = await Promise.allSettled(stores.map((s) => s.search(q)));
  const tiendas = [];
  let offers = [];
  settled.forEach((r, i) => {
    const s = stores[i];
    if (r.status === "fulfilled") {
      const found = relevant(r.value, q);
      offers.push(...found);
      tiendas.push({ id: s.id, name: s.name, color: s.color, ok: true, count: found.length });
    } else {
      tiendas.push({ id: s.id, name: s.name, color: s.color, ok: false, error: String(r.reason?.message || r.reason).slice(0, 120) });
    }
  });

  // Agrupa el mismo producto entre tiendas (lógica de la app Comparador)
  let groups = [];
  try {
    groups = compare(offers).groups.map((g) => ({
      key: g.key,
      exact: g.exact,
      winner: g.winner,
      saving: g.saving,
      savingPct: g.savingPct,
      offers: g.offers.map((o) => `${o.store}:${o.id}`),
    }));
  } catch (e) {
    console.warn("compare groups:", e.message);
  }

  offers = offers
    .map((o) => {
      const up = unitPrice(o);
      return {
        key: `${o.store}:${o.id}`,
        store: o.store, id: o.id, sku: o.sku || null,
        name: o.name, brand: o.brand || "", seller: o.seller || "",
        price: o.price, listPrice: o.listPrice, cardPrice: o.cardPrice,
        image: o.image, url: o.url,
        unitPrice: up ? { value: Math.round(up.value * 100) / 100, label: up.label } : null,
      };
    })
    .sort((a, b) => a.price - b.price);

  const data = { query: q, tiendas, offers, groups, at: new Date().toISOString() };
  toCache(key, data);
  res.json(data);
});

module.exports = router;
