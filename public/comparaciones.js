/* ============= COMPARACIONES DE PRECIOS =============
 * Izquierda: productos de A&M (BD) + catálogo de Joanis (API pública).
 * Derecha: búsqueda del mismo producto en otras tiendas (vía /api/compare).
 * "Pasar a catálogo": crea el producto en A&M como BORRADOR, con el precio de la
 * tienda como COSTO de compra; el precio de venta lo pone el trabajador.
 * Usa utilidades globales de registro.js: State, API, escHtml, safeImgUrl, fmt, toast,
 * normalizeImportItem, buildCategoryMap, findProductArray, classifyImport,
 * loadFromAPI, refreshAfterProductChange, openEdit.
 */
const Cmp = {
  stores: [],            // [{id,name,color}]
  selectedStores: null,  // Set de ids
  joanis: null,          // productos del catálogo Joanis normalizados (disponibles)
  ref: null,             // producto de referencia seleccionado
  result: null,          // respuesta de /api/compare/search
  loading: false,
};

const CMP_STORES_KEY = "am_cmp_stores_v1";

async function renderComparaciones() {
  if (!Cmp.stores.length) {
    try {
      Cmp.stores = await API.get("/api/compare/stores");
    } catch (e) {
      document.getElementById("cmpStatus").innerHTML =
        `<span style="color:var(--danger)">No se pudieron cargar las tiendas: ${escHtml(e.message)}</span>`;
    }
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(CMP_STORES_KEY) || "null"); } catch {}
    Cmp.selectedStores = new Set(Array.isArray(saved) && saved.length ? saved : Cmp.stores.map((s) => s.id));
    renderCmpStores();
  }
  renderCmpMine();
  renderCmpRef();
}

/* ── Tiendas (chips activables) ── */
function renderCmpStores() {
  const box = document.getElementById("cmpStores");
  if (!box) return;
  const all = Cmp.stores.length && Cmp.stores.every((s) => Cmp.selectedStores.has(s.id));
  // Tras una búsqueda, cada chip muestra cuántos resultados trajo esa tienda
  const res = new Map((Cmp.result?.tiendas || []).map((t) => [t.id, t]));
  box.innerHTML =
    `<button type="button" class="cmp-store-chip all ${all ? "on" : ""}" onclick="cmpToggleAllStores()">${all ? "✓ " : ""}Todas (${Cmp.selectedStores.size}/${Cmp.stores.length})</button>` +
    Cmp.stores.map((s) => {
      const on = Cmp.selectedStores.has(s.id);
      const t = res.get(s.id);
      const n = !t ? "" : t.ok ? `<b class="cmp-chip-n ${t.count ? "" : "zero"}">${t.count}</b>` : `<b class="cmp-chip-n err" title="${escHtml(t.error || "Sin respuesta")}">!</b>`;
      return `<button type="button" class="cmp-store-chip ${on ? "on" : ""}" style="--c:${escHtml(s.color)}"
        title="${on ? "Clic para no buscar en esta tienda" : "Clic para buscar también aquí"}"
        onclick="cmpToggleStore('${escHtml(s.id)}')"><span class="cmp-dot"></span>${escHtml(s.name)}${n}</button>`;
    }).join("");
}
function saveCmpStores() {
  try { localStorage.setItem(CMP_STORES_KEY, JSON.stringify([...Cmp.selectedStores])); } catch {}
}
function cmpToggleStore(id) {
  if (Cmp.selectedStores.has(id)) Cmp.selectedStores.delete(id);
  else Cmp.selectedStores.add(id);
  saveCmpStores();
  renderCmpStores();
}
function cmpToggleAllStores() {
  const all = Cmp.stores.every((s) => Cmp.selectedStores.has(s.id));
  Cmp.selectedStores = new Set(all ? [] : Cmp.stores.map((s) => s.id));
  saveCmpStores();
  renderCmpStores();
}

/* ── Catálogo de Joanis (una consulta al pulsar el botón) ── */
async function cmpLoadJoanis() {
  const btn = document.getElementById("cmpLoadJoanis");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Consultando a Joanis…";
  try {
    const data = await API.products.fetchJoanis();
    const catMap = buildCategoryMap(data);
    const all = findProductArray(data).map((r) => normalizeImportItem(r, { catMap })).filter(Boolean);
    // Clasifica contra lo que ya hay en A&M (nuevo / ya importado / propio…)
    Cmp.joanis = classifyImport(all.filter((p) => !p._skip));
    document.getElementById("cmpMineOrigin").value = "joanis_nuevo";
    toast(`Catálogo Joanis cargado: ${Cmp.joanis.length} disponibles · ${Cmp.joanis.filter((p) => p._estado === "nuevo").length} aún no importados`, "success");
    renderCmpMine();
  } catch (e) {
    toast("No se pudo consultar Joanis: " + escHtml(e.message), "warning");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

/* ── Lista de "Tus productos" ── */
function cmpNorm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function cmpMineItems() {
  const origin = document.getElementById("cmpMineOrigin")?.value || "todos";
  const q = cmpNorm(document.getElementById("cmpMineSearch")?.value || "").trim();
  let items = [];
  if (origin !== "joanis_nuevo") {
    items = State.products
      .filter((p) => origin === "todos" || (origin === "mios" ? !p.importSource : !!p.importSource))
      .map((p) => ({
        kind: "am",
        key: "am:" + p.id,
        id: p.id,
        nombre: p.nombre,
        imagen: p.imageUrl,
        origen: p.importSource ? `⬇ ${p.importSource}` : "Mío",
        costo: p.importSource && p.sourcePrice != null ? p.sourcePrice : (p.precioCompra || null),
        venta: p.precioVenta > 0 ? p.precioVenta * (1 - (p.descuento || 0) / 100) : null,
        borrador: p.published === false,
      }));
  }
  if (Cmp.joanis && (origin === "todos" || origin === "joanis_nuevo")) {
    items = items.concat(
      Cmp.joanis.filter((p) => p._estado === "nuevo").map((p) => ({
        kind: "joanis",
        key: "jo:" + p.externalId,
        raw: p,
        nombre: p.nombre,
        imagen: p.imageUrl,
        origen: "Joanis (no importado)",
        costo: p.precioFuente != null ? p.precioFuente : p.precioVenta,
        venta: null,
      })),
    );
  }
  if (q) {
    const words = q.split(/\s+/);
    items = items.filter((it) => { const n = cmpNorm(it.nombre); return words.every((w) => n.includes(w)); });
  }
  return items;
}

function renderCmpMine() {
  const list = document.getElementById("cmpMineList");
  if (!list) return;
  const items = cmpMineItems();
  const origin = document.getElementById("cmpMineOrigin")?.value;
  const count = document.getElementById("cmpMineCount");
  if (count) {
    count.textContent = `${items.length} producto(s)` +
      (Cmp.joanis ? "" : " · pulsa «Cargar catálogo Joanis» para ver también los de Joanis que aún no tienes");
  }
  if (origin === "joanis_nuevo" && !Cmp.joanis) {
    list.innerHTML = `<div class="cmp-empty">Pulsa <b>⟳ Cargar catálogo Joanis</b> para ver sus productos que aún no importaste.</div>`;
    return;
  }
  if (!items.length) {
    list.innerHTML = `<div class="cmp-empty">Sin productos en este filtro.</div>`;
    return;
  }
  const MAX = 200;
  list.innerHTML = items.slice(0, MAX).map((it) => {
    const img = safeImgUrl(it.imagen);
    const sel = Cmp.ref && Cmp.ref.key === it.key;
    return `
    <div class="cmp-mine-row ${sel ? "selected" : ""}">
      <div class="cmp-thumb">${img ? `<img src="${img}" alt="" loading="lazy" onerror="this.remove()">` : "📦"}</div>
      <div class="cmp-mine-info">
        <div class="cmp-mine-name">${escHtml(it.nombre)}</div>
        <div class="cmp-mine-meta">
          <span class="cmp-tag ${it.kind === "joanis" ? "jo" : it.origen === "Mío" ? "mine" : "imp"}">${escHtml(it.origen)}</span>
          ${it.borrador ? `<span class="cmp-tag draft">Borrador</span>` : ""}
          ${it.costo != null ? `Costo: <b>${fmt(it.costo)}</b>` : ""}
          ${it.venta != null ? ` · Venta: <b>${fmt(it.venta)}</b>` : ""}
        </div>
      </div>
      <div class="cmp-mine-actions">
        <button type="button" class="btn-secondary btn-sm" onclick="cmpPick('${escHtml(it.key)}')">⚖ Comparar</button>
        ${it.kind === "joanis" ? `<button type="button" class="btn-primary btn-sm" onclick="cmpPassJoanis('${escHtml(it.raw.externalId)}')">+ Pasar a catálogo</button>` : ""}
      </div>
    </div>`;
  }).join("") +
  (items.length > MAX ? `<div class="cmp-empty">… y ${items.length - MAX} más. Usa el buscador para encontrar el producto.</div>` : "");
}

// Elige un producto como referencia y lo busca en las tiendas
function cmpPick(key) {
  const it = cmpMineItems().find((x) => x.key === key) ||
    (Cmp.joanis || []).map((p) => ({ kind: "joanis", key: "jo:" + p.externalId, nombre: p.nombre, imagen: p.imageUrl, origen: "Joanis (no importado)", costo: p.precioFuente, raw: p })).find((x) => x.key === key);
  if (!it) return;
  Cmp.ref = it;
  document.getElementById("cmpQuery").value = cmpQueryFromName(it.nombre);
  renderCmpRef();
  renderCmpMine();
  cmpSearch();
}

// Nombre del producto → búsqueda útil (sin códigos internos ni símbolos)
function cmpQueryFromName(name) {
  return String(name || "")
    .replace(/\/\s*[A-Z]{2,}[-\s]?\d+\S*/g, " ")  // "/YRH-243"
    .replace(/[|/\\()[\]{}"“”'´`*_#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    // Sin palabras de relleno ni códigos internos; las 3 primeras palabras clave
    // (las tiendas exigen que aparezcan todas: más palabras = menos resultados).
    .filter((w) => w && !/^(de|del|la|el|los|las|con|para|y|x|en|por)$/i.test(w) && !/^[A-Z]{2,}-?\d+$/.test(w))
    .slice(0, 3).join(" ");
}

function renderCmpRef() {
  const box = document.getElementById("cmpRef");
  if (!box) return;
  const r = Cmp.ref;
  if (!r) {
    box.innerHTML = `<div class="cmp-hint">Elige un producto de la izquierda con <b>⚖ Comparar</b>, o escribe lo que quieras buscar.</div>`;
    return;
  }
  const img = safeImgUrl(r.imagen);
  box.innerHTML = `
    <div class="cmp-ref">
      <div class="cmp-thumb big">${img ? `<img src="${img}" alt="" onerror="this.remove()">` : "📦"}</div>
      <div style="flex:1;min-width:0">
        <div class="cmp-ref-label">Comparando con</div>
        <div class="cmp-mine-name">${escHtml(r.nombre)}</div>
        <div class="cmp-mine-meta">
          <span class="cmp-tag ${r.kind === "joanis" ? "jo" : r.origen === "Mío" ? "mine" : "imp"}">${escHtml(r.origen)}</span>
          ${r.costo != null ? `Tu costo: <b>${fmt(r.costo)}</b>` : "Sin costo registrado"}
          ${r.venta != null ? ` · Tu venta: <b>${fmt(r.venta)}</b>` : ""}
        </div>
      </div>
      <button type="button" class="btn-ghost btn-sm" onclick="Cmp.ref=null;renderCmpRef();renderCmpMine();renderCmpResults()">✕</button>
    </div>`;
}

/* ── Búsqueda en tiendas ── */
async function cmpSearch() {
  const q = document.getElementById("cmpQuery").value.trim();
  const status = document.getElementById("cmpStatus");
  if (q.length < 2) { status.innerHTML = `<span style="color:var(--warning)">Escribe al menos 2 letras.</span>`; return; }
  if (!Cmp.selectedStores.size) { status.innerHTML = `<span style="color:var(--warning)">Elige al menos una tienda.</span>`; return; }
  if (Cmp.loading) return;
  Cmp.loading = true;
  const btn = document.getElementById("cmpSearchBtn");
  btn.disabled = true;
  btn.textContent = "Comparando…";
  status.innerHTML = `<span class="cmp-spinner"></span> Consultando ${Cmp.selectedStores.size} tienda(s)…`;
  document.getElementById("cmpResults").innerHTML = "";
  try {
    const params = new URLSearchParams({ q, stores: [...Cmp.selectedStores].join(",") });
    Cmp.result = await API.get(`/api/compare/search?${params}`);
    // Opciones del filtro de tiendas
    const sf = document.getElementById("cmpStoreFilter");
    sf.innerHTML = `<option value="">Todas las tiendas</option>` +
      Cmp.result.tiendas.filter((t) => t.ok && t.count).map((t) => `<option value="${escHtml(t.id)}">${escHtml(t.name)} (${t.count})</option>`).join("");
    document.getElementById("cmpResultTools").style.display = Cmp.result.offers.length ? "flex" : "none";
    renderCmpResults();
  } catch (e) {
    status.innerHTML = `<span style="color:var(--danger)">${escHtml(e.message)}</span>`;
  } finally {
    Cmp.loading = false;
    btn.disabled = false;
    btn.textContent = "⚖ Comparar";
  }
}

function cmpStoreInfo(id) {
  return Cmp.stores.find((s) => s.id === id) || { id, name: id, color: "#888" };
}

// ¿Ya se pasó esta oferta al catálogo?
function cmpInCatalog(offer) {
  const st = cmpStoreInfo(offer.store);
  return State.products.find((p) => p.importSource === st.name && p.externalId === offer.key);
}

/* ── Coincidencia: qué tanto se parece una oferta a tu producto ──
 * Evita comparar "Candado" con "Agenda ... con Candado": la palabra principal
 * debe ser el producto (al inicio), no un accesorio ("con …", "para …"). */
const CMP_STOP = new Set(["de", "del", "la", "el", "los", "las", "con", "para", "y", "x", "en", "por", "un", "una", "a", "al", "sin", "tipo", "modelo"]);
const CMP_LINK = new Set(["con", "para", "sin", "y", "incluye", "incl", "de"]);
function cmpWords(s) {
  return cmpNorm(s).replace(/[^a-z0-9.,"\s-]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}
const cmpSing = (w) => (w.length > 3 && w.endsWith("s") && !/\d/.test(w) ? w.slice(0, -1) : w);
function cmpSig(words) {
  return words.filter((w) => !CMP_STOP.has(w) && !/^[-.,"]+$/.test(w)).map(cmpSing);
}
function cmpMatchScore(offerName, refName) {
  const refSig = cmpSig(cmpWords(refName));
  if (!refSig.length) return 1;
  const ow = cmpWords(offerName);
  const owSing = ow.map(cmpSing);
  const offSig = cmpSig(ow);
  const offSet = new Set(offSig);
  const refSet = new Set(refSig);
  const present = [...refSet].filter((w) => offSet.has(w)).length;
  let score = present / refSet.size;

  // Palabra principal (la primera de tu producto): ¿es de lo que trata la oferta?
  const head = refSig[0];
  const pos = owSing.indexOf(head);
  if (pos === -1) score -= 0.3;
  else {
    if (pos <= 1) score += 0.35;
    else if (pos > 3) score -= 0.2;
    if (pos > 0 && CMP_LINK.has(ow[pos - 1])) score -= 0.5;   // "agenda CON candado"
  }
  // Muchas palabras ajenas = otro producto
  const extra = offSig.filter((w) => !refSet.has(w)).length / Math.max(offSig.length, 1);
  score -= 0.3 * extra;
  // Medidas / números: si ambos los tienen, deben coincidir
  const nums = (arr) => arr.filter((w) => /\d/.test(w));
  const rn = nums(refSig), on = nums(offSig);
  if (rn.length && on.length) score += rn.some((n) => on.includes(n)) ? 0.2 : -0.2;
  return Math.round(score * 100) / 100;
}
function cmpLevel(score) {
  return score >= 1 ? "alta" : score >= 0.6 ? "media" : "baja";
}
const CMP_LEVEL = {
  alta:  { label: "Coincide", cls: "m-alta", rank: 3 },
  media: { label: "Parecido", cls: "m-media", rank: 2 },
  baja:  { label: "Poco parecido", cls: "m-baja", rank: 1 },
};

// Ofertas con su coincidencia calculada contra tu producto (o lo buscado)
function cmpScoredOffers() {
  const R = Cmp.result;
  if (!R) return [];
  const refName = Cmp.ref ? Cmp.ref.nombre : R.query;
  return R.offers.map((o) => {
    const score = cmpMatchScore(o.name, refName);
    return { ...o, score, level: cmpLevel(score) };
  });
}

function cmpVsCost(price, ref) {
  if (!ref) return "";
  const d = price - ref;
  const pct = Math.round((Math.abs(d) / ref) * 100);
  if (Math.abs(d) < 0.005) return `<span class="cmp-diff">= igual a tu costo</span>`;
  return d < 0
    ? `<span class="cmp-diff cheaper" title="La tienda lo vende más barato que lo que te cuesta a ti">▼ ${fmt(-d)} <small>(−${pct}%)</small></span>`
    : `<span class="cmp-diff pricier" title="La tienda lo vende más caro que tu costo: buen margen para ti">▲ ${fmt(d)} <small>(+${pct}%)</small></span>`;
}

function cmpActions(o) {
  const url = /^https?:\/\//i.test(o.url || "") ? o.url : null;
  const ya = cmpInCatalog(o);
  return `<div class="cmp-offer-actions">
    ${url ? `<a class="btn-ghost btn-sm" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" title="Abrir en la tienda">Ver ↗</a>` : ""}
    ${ya
      ? `<button type="button" class="btn-secondary btn-sm" onclick="openEdit('${escHtml(ya.id)}')" title="Ya está en tu catálogo">✓ En catálogo</button>`
      : `<button type="button" class="btn-primary btn-sm" onclick="cmpPassOffer('${escHtml(o.key)}')">+ Pasar a catálogo</button>`}
  </div>`;
}

function cmpRow(o, ref, opts = {}) {
  const st = cmpStoreInfo(o.store);
  const img = safeImgUrl(o.image);
  const lv = CMP_LEVEL[o.level];
  return `
  <div class="cmp-row ${opts.best ? "best" : ""}">
    <div class="cmp-row-store"><span class="cmp-dot" style="--c:${escHtml(st.color)}"></span>${escHtml(st.name)}</div>
    <div class="cmp-row-prod">
      <div class="cmp-thumb">${img ? `<img src="${img}" alt="" loading="lazy" onerror="this.remove()">` : "🛒"}</div>
      <div style="min-width:0">
        <div class="cmp-row-name" title="${escHtml(o.name)}">${escHtml(o.name)}</div>
        <div class="cmp-row-sub">
          <span class="cmp-match ${lv.cls}" title="Parecido con tu producto: ${o.score}">${lv.label}</span>
          ${opts.best ? `<span class="cmp-tag best">★ Más barato</span>` : ""}
          ${o.brand ? `<span>${escHtml(o.brand)}</span>` : ""}
          ${o.seller ? `<span>· Vende: ${escHtml(o.seller)}</span>` : ""}
          ${o.unitPrice ? `<span>· ${fmt(o.unitPrice.value)}/${escHtml(o.unitPrice.label)}</span>` : ""}
          ${opts.more ? `<span class="cmp-more">+${opts.more} opción(es) más</span>` : ""}
        </div>
      </div>
    </div>
    <div class="cmp-row-price">
      <div class="cmp-price">${fmt(o.price)}</div>
      ${o.listPrice ? `<div class="cmp-list">${fmt(o.listPrice)}</div>` : ""}
      ${o.cardPrice ? `<div class="cmp-card">Tarjeta ${fmt(o.cardPrice)}</div>` : ""}
    </div>
    <div class="cmp-row-vs">${cmpVsCost(o.price, ref)}</div>
    <div class="cmp-row-act">${cmpActions(o)}</div>
  </div>`;
}

// Barra de precios: dónde queda tu costo frente a las tiendas
function cmpPriceBar(list, ref) {
  if (!list.length) return "";
  const prices = list.map((o) => o.price);
  let lo = Math.min(...prices, ref || Infinity);
  let hi = Math.max(...prices, ref || 0);
  if (hi - lo < 0.01) { lo = lo * 0.9; hi = hi * 1.1 || 1; }
  const pos = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(1);
  const dots = list.map((o) => {
    const st = cmpStoreInfo(o.store);
    return `<span class="cmp-bar-dot" style="left:${pos(o.price)}%;--c:${escHtml(st.color)}" title="${escHtml(st.name)}: ${fmt(o.price)}"></span>`;
  }).join("");
  const refMark = ref ? `<span class="cmp-bar-ref" style="left:${pos(ref)}%"><span>Tu costo ${fmt(ref)}</span></span>` : "";
  return `<div class="cmp-bar">
    <div class="cmp-bar-track">${dots}${refMark}</div>
    <div class="cmp-bar-scale"><span>${fmt(lo)}</span><span>${fmt(hi)}</span></div>
  </div>`;
}

function renderCmpResults() {
  const box = document.getElementById("cmpResults");
  const status = document.getElementById("cmpStatus");
  const R = Cmp.result;
  if (!box) return;
  renderCmpStores();
  if (!R) { box.innerHTML = ""; if (status) status.innerHTML = ""; return; }

  const fallidas = R.tiendas.filter((t) => !t.ok);
  status.innerHTML =
    `«${escHtml(R.query)}» · ${R.offers.length} resultado(s) en ${R.tiendas.filter((t) => t.ok && t.count).length} tienda(s)` +
    (R.cached ? " · reciente (10 min)" : "") +
    (fallidas.length ? ` · <span style="color:#ef4444" title="${escHtml(fallidas.map((t) => t.name + ": " + (t.error || "")).join(" | "))}">${fallidas.length} sin respuesta</span>` : "");

  if (!R.offers.length) {
    box.innerHTML = `<div class="cmp-empty">Ninguna tienda tiene un producto con esas palabras. Prueba con menos palabras o más generales.</div>`;
    return;
  }

  const view = document.querySelector("#cmpView .on")?.dataset.v || "tiendas";
  const minLevel = document.getElementById("cmpMatch").value;            // alta | media | todas
  const sort = document.getElementById("cmpSort").value;
  const storeF = document.getElementById("cmpStoreFilter").value;
  const okLevel = (l) => minLevel === "todas" || (minLevel === "media" ? l !== "baja" : l === "alta");

  const scored = cmpScoredOffers();
  let list = scored.filter((o) => okLevel(o.level) && (!storeF || o.store === storeF));
  const ocultas = scored.filter((o) => !okLevel(o.level)).length;
  const ref = Cmp.ref && Cmp.ref.costo != null ? Number(Cmp.ref.costo) : null;

  // Vista "Mejor de cada tienda": la oferta más barata (entre las que coinciden) por tienda
  let rows = list;
  const extraPorTienda = {};
  if (view === "tiendas") {
    const best = new Map();
    for (const o of list) {
      const cur = best.get(o.store);
      if (!cur || CMP_LEVEL[o.level].rank > CMP_LEVEL[cur.level].rank ||
          (o.level === cur.level && o.price < cur.price)) best.set(o.store, o);
      extraPorTienda[o.store] = (extraPorTienda[o.store] || 0) + 1;
    }
    rows = [...best.values()];
  }
  if (sort === "price-desc") rows.sort((a, b) => b.price - a.price);
  else if (sort === "match") rows.sort((a, b) => b.score - a.score || a.price - b.price);
  else rows.sort((a, b) => a.price - b.price);

  // Resumen (solo con ofertas que sí coinciden)
  const base = view === "tiendas" ? rows : list;
  let resumen = "";
  if (base.length) {
    const ps = base.map((o) => o.price).sort((a, b) => a - b);
    const min = ps[0], max = ps[ps.length - 1], med = ps[Math.floor(ps.length / 2)];
    const cheapest = base.reduce((a, b) => (b.price < a.price ? b : a));
    const stC = cmpStoreInfo(cheapest.store);
    let verdict = "";
    if (ref) {
      const d = min - ref;
      const pct = Math.round((Math.abs(d) / ref) * 100);
      verdict = d < -0.005
        ? `<div class="cmp-verdict cheaper">💡 <b>${escHtml(stC.name)}</b> lo vende a <b>${fmt(min)}</b>: ${fmt(-d)} menos que tu costo (−${pct}%). Revisa si te conviene comprarlo ahí.</div>`
        : `<div class="cmp-verdict better">✅ Tu costo (${fmt(ref)}) es menor que el precio más bajo de las tiendas (${fmt(min)}). Tienes margen: las tiendas lo venden hasta <b>${fmt(max)}</b>.</div>`;
    }
    resumen = `
    <div class="cmp-summary">
      <div class="cmp-kpis">
        ${ref ? `<div class="cmp-kpi ref"><span>Tu costo</span><b>${fmt(ref)}</b></div>` : ""}
        <div class="cmp-kpi"><span>Más barato</span><b>${fmt(min)}</b><small>${escHtml(stC.name)}</small></div>
        <div class="cmp-kpi"><span>Precio típico</span><b>${fmt(med)}</b><small>mediana</small></div>
        <div class="cmp-kpi"><span>Más caro</span><b>${fmt(max)}</b></div>
        <div class="cmp-kpi"><span>Tiendas</span><b>${new Set(base.map((o) => o.store)).size}</b><small>${base.length} oferta(s)</small></div>
      </div>
      ${cmpPriceBar(base, ref)}
    </div>
    ${verdict}`;
  }

  const head = `<div class="cmp-row cmp-row-head">
    <div class="cmp-row-store">Tienda</div><div class="cmp-row-prod">Producto</div>
    <div class="cmp-row-price">Precio</div><div class="cmp-row-vs">${ref ? "vs tu costo" : ""}</div><div class="cmp-row-act"></div></div>`;
  const minPrice = rows.length ? Math.min(...rows.map((o) => o.price)) : null;
  const MAX = 120;
  box.innerHTML = resumen +
    (rows.length
      ? `<div class="cmp-table">${head}${rows.slice(0, MAX).map((o) =>
          cmpRow(o, ref, { best: o.price === minPrice, more: view === "tiendas" ? (extraPorTienda[o.store] || 1) - 1 : 0 })).join("")}</div>`
      : `<div class="cmp-empty">Ninguna oferta coincide bien con tu producto. Cambia «Coincidencia» a <b>todas</b> o ajusta la búsqueda.</div>`) +
    (rows.length > MAX ? `<div class="cmp-empty">Mostrando ${MAX} de ${rows.length}. Filtra por tienda para ver más.</div>` : "") +
    (ocultas ? `<div class="cmp-empty" style="font-size:11.5px">${ocultas} oferta(s) poco parecida(s) ocultas · <a href="#" onclick="document.getElementById('cmpMatch').value='todas';renderCmpResults();return false">ver todas</a></div>` : "") +
    (view === "tiendas" ? `<div class="cmp-empty" style="font-size:11.5px">Se muestra la opción más barata de cada tienda. Usa <b>☰ Todas las ofertas</b> para ver el resto.</div>` : "");
}

/* ── Pasar a catálogo (borrador, costo = precio de la tienda, venta = la pone el trabajador) ── */
async function cmpImportOne(item, fuente) {
  const r = await API.products.import([item], fuente);
  await loadFromAPI();
  refreshAfterProductChange();
  const nuevo = State.products.find((p) => p.importSource === fuente && p.externalId === item.externalId);
  if (r.insertados && nuevo) {
    saveLastImportNew([...(State.lastImportNew?.ids || []), nuevo.id]);
    toast(`«${escHtml(item.nombre)}» agregado como BORRADOR. Pon ahora su precio de venta.`, "success");
    openEdit(nuevo.id);   // el trabajador pone el precio de venta
  } else if (nuevo) {
    toast("Ese producto ya estaba en tu catálogo.", "info");
    openEdit(nuevo.id);
  } else {
    const det = (r.detalles || [])[0];
    toast(det ? escHtml(`No se agregó: ${det.estado}${det.msg ? " (" + det.msg + ")" : ""}`) : "No se pudo agregar el producto", "warning");
  }
  renderCmpMine();
  renderCmpResults();
}

async function cmpPassOffer(key) {
  const o = Cmp.result && Cmp.result.offers.find((x) => x.key === key);
  if (!o) return;
  const st = cmpStoreInfo(o.store);
  if (!confirm(`Pasar a tu catálogo:\n\n${o.name}\n${st.name} — ${fmt(o.price)}\n\n• Entra como BORRADOR (no se ve en la tienda).\n• Costo de compra: ${fmt(o.price)}.\n• Luego pones tú el precio de venta y lo publicas.`)) return;
  try {
    await cmpImportOne({
      externalId: o.key,
      codigo: o.sku || o.id,
      nombre: o.name,
      marca: o.brand || null,
      imageUrl: o.image || "",
      images: o.image ? [o.image] : [],
      categoria: "Importados",
      precioFuente: o.price,
      precioVenta: o.listPrice || o.price,
      descuento: 0,
      stock: 0,
      permitirSinStock: true,
      descripcion: o.url ? `Referencia: ${st.name} — ${o.url}` : "",
    }, st.name);
  } catch (e) {
    toast("Error al pasar a catálogo: " + escHtml(e.message), "warning");
  }
}

async function cmpPassJoanis(externalId) {
  const p = (Cmp.joanis || []).find((x) => String(x.externalId) === String(externalId));
  if (!p) return;
  const costo = p.precioFuente != null ? p.precioFuente : p.precioVenta;
  if (!confirm(`Pasar a tu catálogo:\n\n${p.nombre}\nJoanis — costo ${fmt(costo)}\n\n• Entra como BORRADOR.\n• Luego pones tú el precio de venta y lo publicas.`)) return;
  try {
    const { _estado, _match, _skip, ...item } = p;
    await cmpImportOne(item, "Joanis");
    p._estado = "existe";
    renderCmpMine();
  } catch (e) {
    toast("Error al pasar a catálogo: " + escHtml(e.message), "warning");
  }
}

/* ── Eventos ── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("cmpLoadJoanis")?.addEventListener("click", cmpLoadJoanis);
  document.getElementById("cmpSearchBtn")?.addEventListener("click", cmpSearch);
  document.getElementById("cmpQuery")?.addEventListener("keydown", (e) => { if (e.key === "Enter") cmpSearch(); });
  let t;
  document.getElementById("cmpMineSearch")?.addEventListener("input", () => { clearTimeout(t); t = setTimeout(renderCmpMine, 150); });
  document.getElementById("cmpMineOrigin")?.addEventListener("change", renderCmpMine);
  document.querySelectorAll("#cmpView button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#cmpView button").forEach((x) => x.classList.toggle("on", x === b));
    renderCmpResults();
  }));
  ["cmpSort", "cmpStoreFilter", "cmpMatch"].forEach((id) =>
    document.getElementById(id)?.addEventListener("change", renderCmpResults));
});
