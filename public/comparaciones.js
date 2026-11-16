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
  box.innerHTML =
    `<button type="button" class="cmp-store-chip ${all ? "on" : ""}" onclick="cmpToggleAllStores()">Todas</button>` +
    Cmp.stores.map((s) => {
      const on = Cmp.selectedStores.has(s.id);
      return `<button type="button" class="cmp-store-chip ${on ? "on" : ""}" style="--c:${escHtml(s.color)}"
        onclick="cmpToggleStore('${escHtml(s.id)}')">${escHtml(s.name)}</button>`;
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
    .split(" ").slice(0, 6).join(" ");
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

function renderCmpResults() {
  const box = document.getElementById("cmpResults");
  const status = document.getElementById("cmpStatus");
  const R = Cmp.result;
  if (!box) return;
  if (!R) { box.innerHTML = ""; return; }

  status.innerHTML =
    `<div class="cmp-store-status">` +
    R.tiendas.map((t) => t.ok
      ? `<span class="cmp-st ${t.count ? "ok" : "zero"}" style="--c:${escHtml(t.color)}">${escHtml(t.name)}: ${t.count}</span>`
      : `<span class="cmp-st err" title="${escHtml(t.error || "")}">${escHtml(t.name)}: sin respuesta</span>`).join("") +
    `</div>` +
    `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">«${escHtml(R.query)}» · ${R.offers.length} oferta(s)${R.cached ? " · resultado reciente (10 min)" : ""}</div>`;

  if (!R.offers.length) {
    box.innerHTML = `<div class="cmp-empty">Ninguna tienda tiene un producto con esas palabras. Prueba con menos palabras o más generales.</div>`;
    return;
  }

  const sort = document.getElementById("cmpSort").value;
  const storeF = document.getElementById("cmpStoreFilter").value;
  const onlyGroups = document.getElementById("cmpOnlyGroups").checked;
  const groupOf = new Map();
  R.groups.forEach((g, i) => g.offers.forEach((k) => groupOf.set(k, i)));

  let offers = R.offers.filter((o) => (!storeF || o.store === storeF) && (!onlyGroups || groupOf.has(o.key)));
  if (sort === "price-desc") offers = [...offers].sort((a, b) => b.price - a.price);
  else if (sort === "store") offers = [...offers].sort((a, b) => a.store.localeCompare(b.store) || a.price - b.price);

  const ref = Cmp.ref && Cmp.ref.costo != null ? Number(Cmp.ref.costo) : null;
  const best = R.offers[0];

  // Resumen: mejor precio vs tu costo
  let resumen = "";
  if (best) {
    const st = cmpStoreInfo(best.store);
    let vs = "";
    if (ref) {
      const d = best.price - ref;
      const pct = Math.round((Math.abs(d) / ref) * 100);
      vs = d < 0
        ? `<div class="cmp-verdict cheaper">💡 ${escHtml(st.name)} lo tiene <b>${fmt(-d)} más barato</b> que tu costo (−${pct}%). Conviene revisarlo.</div>`
        : d > 0
          ? `<div class="cmp-verdict better">✅ Tu costo es <b>${fmt(d)} menor</b> que el mejor precio de las tiendas (${pct}% más barato).</div>`
          : `<div class="cmp-verdict">= Mismo precio que tu costo.</div>`;
    }
    resumen = `
      <div class="cmp-summary">
        <div><div class="cmp-ref-label">Mejor precio encontrado</div>
          <div style="font-size:20px;font-weight:800;color:var(--text-primary)">${fmt(best.price)}
            <span class="cmp-store-badge" style="--c:${escHtml(st.color)}">${escHtml(st.name)}</span></div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(best.name)}</div></div>
        ${ref ? `<div style="text-align:right"><div class="cmp-ref-label">Tu costo</div><div style="font-size:20px;font-weight:800">${fmt(ref)}</div></div>` : ""}
      </div>${vs}`;
  }

  box.innerHTML = resumen + `<div class="cmp-offers">` + offers.slice(0, 150).map((o) => {
    const st = cmpStoreInfo(o.store);
    const img = safeImgUrl(o.image);
    const url = /^https?:\/\//i.test(o.url || "") ? o.url : null;
    const ya = cmpInCatalog(o);
    let diff = "";
    if (ref) {
      const d = o.price - ref;
      const pct = Math.round((Math.abs(d) / ref) * 100);
      diff = d < 0
        ? `<span class="cmp-diff cheaper">▼ ${fmt(-d)} más barato que tu costo (−${pct}%)</span>`
        : d > 0 ? `<span class="cmp-diff pricier">▲ ${fmt(d)} más caro (+${pct}%)</span>` : `<span class="cmp-diff">= igual a tu costo</span>`;
    }
    const gi = groupOf.get(o.key);
    const grupo = gi != null ? R.groups[gi] : null;
    return `
    <div class="cmp-offer ${o === best ? "best" : ""}">
      <div class="cmp-thumb big">${img ? `<img src="${img}" alt="" loading="lazy" onerror="this.remove()">` : "🛒"}</div>
      <div class="cmp-offer-info">
        <div class="cmp-offer-top">
          <span class="cmp-store-badge" style="--c:${escHtml(st.color)}">${escHtml(st.name)}</span>
          ${o === best ? `<span class="cmp-tag best">★ Más barato</span>` : ""}
          ${grupo ? `<span class="cmp-tag grp" title="Mismo producto encontrado en ${grupo.offers.length} tiendas">≡ En ${grupo.offers.length} tiendas${grupo.winner === o.store ? " · gana" : ""}</span>` : ""}
          ${o.seller ? `<span class="cmp-tag">Vende: ${escHtml(o.seller)}</span>` : ""}
        </div>
        <div class="cmp-mine-name">${escHtml(o.name)}</div>
        <div class="cmp-mine-meta">${o.brand ? escHtml(o.brand) + " · " : ""}${o.unitPrice ? `${fmt(o.unitPrice.value)} / ${escHtml(o.unitPrice.label)}` : ""}</div>
        ${diff}
      </div>
      <div class="cmp-offer-price">
        <div class="cmp-price">${fmt(o.price)}</div>
        ${o.listPrice ? `<div class="cmp-list">${fmt(o.listPrice)}</div>` : ""}
        ${o.cardPrice ? `<div class="cmp-card">Con tarjeta: ${fmt(o.cardPrice)}</div>` : ""}
        <div class="cmp-offer-actions">
          ${url ? `<a class="btn-ghost btn-sm" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">Ver ↗</a>` : ""}
          ${ya
            ? `<button type="button" class="btn-secondary btn-sm" onclick="openEdit('${escHtml(ya.id)}')" title="Ya está en tu catálogo">✓ En catálogo</button>`
            : `<button type="button" class="btn-primary btn-sm" onclick="cmpPassOffer('${escHtml(o.key)}')">+ Pasar a catálogo</button>`}
        </div>
      </div>
    </div>`;
  }).join("") + `</div>` +
  (offers.length > 150 ? `<div class="cmp-empty">Mostrando 150 de ${offers.length}. Filtra por tienda para ver más.</div>` : "") +
  (!offers.length ? `<div class="cmp-empty">Nada con estos filtros.</div>` : "");
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
  ["cmpSort", "cmpStoreFilter", "cmpOnlyGroups"].forEach((id) =>
    document.getElementById(id)?.addEventListener("change", renderCmpResults));
});
