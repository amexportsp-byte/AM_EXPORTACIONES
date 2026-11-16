"use strict";
/**
 * Búsqueda de precios en tiendas peruanas (APIs públicas de sus catálogos web).
 * Adaptado de C:/PROYECTOS/MOVIL/COMPARACION/APP/src/lib/stores.js (app Comparador).
 * Solo búsqueda (sin verificar zona de entrega). Pocas páginas por búsqueda para
 * no saturar a las tiendas; se consulta solo cuando el usuario pulsa "Comparar".
 */

const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const TIMEOUT_MS = 15000;
const PAGES = 1;          // 1 página por tienda y búsqueda
const PAGE_SIZE = 40;

async function request(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept },
      signal: controller.signal,
    });
    // VTEX responde 206 cuando hay más páginas; res.ok lo acepta.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("La tienda tardó demasiado");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const getJson = async (url) => JSON.parse(await request(url, "application/json"));

const toNumber = (value) => {
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const cleanName = (name) => String(name ?? "").replace(/\s+/g, " ").trim();

// En estas tiendas el vendedor propio no lleva el nombre de la tienda.
const OWN_SELLERS = { metro: /cencosud|wongiononfood/i, makro: /^makro/i };

// Plaza Vea, Metro, Makro, Promart, Carsa, Coolbox y Claro usan VTEX.
function mapVtex(p, store) {
  const item = p.items?.[0];
  const seller = item?.sellers?.find((s) => s.commertialOffer?.AvailableQuantity > 0);
  const offer = seller?.commertialOffer;
  const price = toNumber(offer?.Price);
  if (!price) return null; // Sin stock: VTEX devuelve precio 0.
  const list = toNumber(offer.ListPrice);
  const sellerName = seller.sellerName ?? "";
  return {
    store,
    id: String(p.productId),
    sku: item.itemId,
    name: cleanName(p.productName),
    brand: p.brand ?? "",
    format: "",
    seller: OWN_SELLERS[store]?.test(sellerName) ? "" : sellerName,
    price,
    listPrice: list && list > price ? list : null,
    cardPrice: null,
    image: item.images?.[0]?.imageUrl ?? null,
    url: p.link,
  };
}

// Tottus y Sodimac usan la plataforma de Falabella.
function mapFalabella(p, store) {
  const prices = (p.prices ?? []).map((x) => ({ ...x, value: toNumber(x.price?.[0]) })).filter((x) => x.value);
  const current = prices.filter((x) => !x.crossed && x.type !== "cmrPrice").map((x) => x.value);
  if (!current.length) return null;
  const price = Math.min(...current);
  const crossed = prices.find((x) => x.crossed)?.value;
  const card = prices.find((x) => x.type === "cmrPrice")?.value;
  return {
    store,
    id: String(p.skuId ?? p.productId),
    name: cleanName(p.displayName),
    brand: p.brand ?? "",
    format: cleanName(p.measurements?.format),
    seller: p.sellerName ?? "",
    price,
    listPrice: crossed && crossed > price ? crossed : null,
    cardPrice: card && card < price ? card : null,
    image: p.mediaUrls?.[0] ?? null,
    url: p.url,
  };
}

function mapMagento(p, store) {
  if (String(p.is_salable) !== "1") return null;
  const price = toNumber(p.price_info?.final_price);
  if (!price) return null;
  const regular = toNumber(p.price_info?.regular_price);
  return {
    store,
    id: String(p.id),
    name: cleanName(p.name),
    brand: "", // Magento no publica la marca; match.js la deduce del nombre.
    format: "",
    seller: "",
    price,
    listPrice: regular && regular > price ? regular : null,
    cardPrice: null,
    image: p.images?.[0]?.url ?? null,
    url: p.url,
  };
}

async function searchVtex(host, store, query, channel) {
  const base = `https://${host}/api/catalog_system/pub/products/search`;
  const q = encodeURIComponent(query);
  const sc = channel ? `&sc=${channel}` : "";
  const out = [];
  for (let page = 0; page < PAGES; page++) {
    const from = page * PAGE_SIZE;
    const data = await getJson(`${base}?ft=${q}&_from=${from}&_to=${from + PAGE_SIZE - 1}${sc}`);
    out.push(...data.map((p) => mapVtex(p, store)).filter(Boolean));
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

async function searchTottus(query) {
  const base = "https://www.tottus.com.pe/s/browse/v1/search/pe";
  const q = encodeURIComponent(query);
  const out = [];
  for (let page = 1; page <= PAGES; page++) {
    const { data } = await getJson(`${base}?Ntt=${q}&page=${page}&store=to_com`);
    out.push(...(data?.results ?? []).map((p) => mapFalabella(p, "tottus")).filter(Boolean));
    const { count = 0, perPage = 48 } = data?.pagination ?? {};
    if (page * perPage >= count) break;
  }
  return out;
}

async function searchMagento(host, storeId, store, query) {
  const filter = "searchCriteria[filterGroups][0][filters][0]";
  const like = `%${query.trim().split(/\s+/).join("%")}%`;
  const out = new Map();
  for (let page = 1; page <= PAGES; page++) {
    const params = [
      `storeId=${storeId}`,
      "currencyCode=PEN",
      `searchCriteria[pageSize]=${PAGE_SIZE}`,
      `searchCriteria[currentPage]=${page}`,
      `${filter}[field]=name`,
      `${filter}[value]=${encodeURIComponent(like)}`,
      `${filter}[condition_type]=like`,
    ].join("&");
    const { items = [] } = await getJson(`https://${host}/rest/V1/products-render-info?${params}`);
    const before = out.size;
    for (const item of items) {
      const product = mapMagento(item, store);
      if (product) out.set(product.id, product);
    }
    if (items.length < PAGE_SIZE || out.size === before) break;
  }
  return [...out.values()];
}

// Claro: solo liberados y accesorios (el precio con plan no es comparable).
const CLARO_ALLOWED = /LIBERADOS|ACCESORIOS/i;
const PLAN_NAME = /postpago|prepago|portabilidad|renovaci[oó]n|l[ií]nea nueva/i;

function mapClaro(p) {
  if (!CLARO_ALLOWED.test((p.categories ?? []).join(" ")) || PLAN_NAME.test(p.productName ?? "")) return [];
  return (p.items ?? [])
    .map((item) => mapVtex({ ...p, productId: item.itemId, productName: item.nameComplete ?? p.productName, items: [item] }, "claro"))
    .filter(Boolean);
}

async function searchClaro(query) {
  const base = "https://tienda.claro.com.pe/api/catalog_system/pub/products/search";
  const data = await getJson(`${base}?ft=${encodeURIComponent(query)}&_from=0&_to=${PAGE_SIZE - 1}`);
  return data.flatMap(mapClaro);
}

const ENTEL = "https://miportal.entel.pe";

function mapEntel({ attributes: a }) {
  if (a.inventoryStatus?.[0] !== "IN_STOCK") return null;
  const prices = [a.listPrice?.[0], a.priceContadoLN?.[0], a.priceContadoRN?.[0]].map(toNumber).filter(Boolean);
  if (!prices.length) return null;
  const price = Math.max(...prices);
  const before = toNumber(a["sku.referencePrice"]?.[0]);
  return {
    store: "entel",
    id: String(a.sku?.[0] ?? a.productId?.[0]),
    name: cleanName(a.displayName?.[0]),
    brand: a.brand?.[0] ?? "",
    format: "",
    seller: "",
    price,
    listPrice: before && before > price ? before : null,
    cardPrice: null,
    image: a.productImage?.[0] ? ENTEL + a.productImage[0] : null,
    url: ENTEL + a.seoUrl?.[0],
  };
}

async function searchEntel(query) {
  const q = encodeURIComponent(query);
  const pages = await Promise.all(
    ["liberados", "accesorios"].map((section) =>
      getJson(`${ENTEL}/personas/catalogo/${section}?format=json&No=0&Nrpp=${PAGE_SIZE}&Ntt=${q}`),
    ),
  );
  return pages
    .flatMap((page) => page.main?.find((x) => x.records)?.records ?? [])
    .map(mapEntel)
    .filter(Boolean);
}

const SODIMAC = "https://www.sodimac.com.pe/s/browse/v1";
// pid = zona de Lima (sin él la API responde 404). store evita productos de Falabella.
const SODIMAC_LIMA = { pgid: 2, pid: "799c102f-9b4c-44be-a421-23e366a63b82" };

async function searchSodimac(query) {
  const { pgid, pid } = SODIMAC_LIMA;
  const zone = `pgid=${pgid}&pid=${pid}&store=so_com`;
  const q = encodeURIComponent(query);
  let path = `search/pe?Ntt=${q}`;
  const out = [];
  for (let page = 1; page <= PAGES; page++) {
    let { data } = await getJson(`${SODIMAC}/${path}&page=${page}&${zone}`);
    // Una palabra suelta no trae resultados, sino el enlace a su categoría.
    const category = data?.altUrl?.match(/\/lista\/([^/?]+)/)?.[1];
    if (category) {
      path = `listing/pe?categoryId=${category}&Ntt=${q}`;
      ({ data } = await getJson(`${SODIMAC}/${path}&page=${page}&${zone}`));
    }
    out.push(...(data?.results ?? []).map((p) => mapFalabella(p, "sodimac")).filter(Boolean));
    const { count = 0, perPage = 48 } = data?.pagination ?? {};
    if (page * perPage >= count) break;
  }
  return out;
}

const vtexStore = (id, name, color, host, channel) => ({
  id, name, color,
  search: (q) => searchVtex(host, id, q, channel),
});

const STORES = [
  vtexStore("plazavea", "Plaza Vea", "#D6001C", "www.plazavea.com.pe"),
  { id: "tottus", name: "Tottus", color: "#2E8B2E", search: searchTottus },
  vtexStore("metro", "Metro", "#E6A700", "www.metro.pe"),
  // Sin el canal 9 responde con los precios de Plaza Vea.
  vtexStore("makro", "Makro", "#C2185B", "www.makro.plazavea.com.pe", 9),
  { id: "efe", name: "Efe", color: "#6A3FB5", search: (q) => searchMagento("www.efe.com.pe", 1, "efe", q) },
  { id: "sodimac", name: "Sodimac", color: "#0057A8", search: searchSodimac },
  vtexStore("promart", "Promart", "#F07F13", "www.promart.pe"),
  vtexStore("carsa", "Carsa", "#00838F", "www.carsa.pe"),
  { id: "curacao", name: "La Curacao", color: "#B8860B", search: (q) => searchMagento("www.lacuracao.pe", 3, "curacao", q) },
  vtexStore("coolbox", "Coolbox", "#00A0DF", "www.coolbox.pe"),
  { id: "claro", name: "Claro", color: "#C8102E", search: searchClaro },
  { id: "entel", name: "Entel", color: "#FF6A13", search: searchEntel },
];

module.exports = { STORES, mapVtex, mapFalabella, mapMagento };
