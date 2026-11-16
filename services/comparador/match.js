"use strict";
// Copiado de C:/PROYECTOS/MOVIL/COMPARACION/APP/src/lib/match.js (app Comparador). Mantener sincronizado.
// Agrupa el mismo producto entre tiendas. No hay un código común (Tottus y EFE
// no publican EAN), así que se compara por código de modelo o, si no hay,
// por marca + tamaño + palabras del nombre.

const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.,%+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const singular = (word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

const UNITS = {
  kg: ['g', 1000], kilo: ['g', 1000], kilos: ['g', 1000],
  g: ['g', 1], gr: ['g', 1], grs: ['g', 1], gramos: ['g', 1],
  l: ['ml', 1000], lt: ['ml', 1000], lts: ['ml', 1000], litro: ['ml', 1000], litros: ['ml', 1000],
  ml: ['ml', 1], cc: ['ml', 1],
};
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|gramos|grs?|g|litros?|lts?|ml|cc|l)\b/g;
const COUNT_RE = /\b(\d+)\s*(?:un|und|unds|unid|unids|unidad|unidades)\b/;

/** Devuelve { amount, unit, pack, total } con amount en g o ml. */
function parseSize(rawText) {
  const text = normalize(rawText);
  let amount = null;
  let unit = null;
  for (const m of text.matchAll(SIZE_RE)) {
    const [base, factor] = UNITS[m[2]];
    amount = parseFloat(m[1].replace(',', '.')) * factor;
    unit = base;
  }

  let pack = 1;
  const multi = text.match(/\b(\d+)\s*x\s*\d/);
  const packN = text.match(/\b(?:pack|paquete)\s*(?:x\s*)?(\d+)\b(?!\s*(?:kg|g|gr|ml|l|lt)\b)/);
  const count = text.match(COUNT_RE);
  if (/\bsix ?pack\b/.test(text)) pack = 6;
  else if (/\b(?:two|duo) ?pack\b/.test(text)) pack = 2;
  else if (multi) pack = parseInt(multi[1], 10);
  else if (packN) pack = parseInt(packN[1], 10);
  else if (count) pack = parseInt(count[1], 10);

  return { amount, unit, pack, total: amount ? amount * pack : null };
}

// Palabras que describen el envase y no el producto.
const FILLER = new Set([
  'bolsa', 'lata', 'caja', 'botella', 'pack', 'paquete', 'sixpack', 'six', 'twopack', 'doypack',
  'sachet', 'frasco', 'pote', 'tarro', 'de', 'del', 'con', 'la', 'el', 'en', 'y', 'x', 'un', 'und',
  'unid', 'unidad', 'para', 'tetra', 'tetrapak', 'pet', 'vidrio', 'esp',
]);

// Si una de estas palabras está solo en un producto, son productos distintos.
const VARIANTS = new Set([
  'anejo', 'superior', 'gourmet', 'integral', 'light', 'zero', 'descremada', 'descremado',
  'semidescremada', 'deslactosada', 'deslactosado', 'sin', 'lactosa', 'reconstituida', 'evaporada',
  'condensada', 'entera', 'chocolate', 'fresa', 'vainilla', 'quinua', 'nino', 'nina', 'bebe',
  'rubia', 'blanca', 'rubio', 'blanco', 'vegetal', 'oliva', 'soya', 'girasol', 'maiz', 'mezcla',
  'lactea',
]);

const isModel = (word) => word.length >= 6 && /[a-z]/.test(word) && /\d.*\d/.test(word);

// Modelos de herramientas escritos con espacio y guion: "GSB 18V-90", "GSR 120-LI".
const TOOL_MODEL_RE = /\b([a-z]{2,4})[ -]?(\d+[a-z]*-[a-z0-9]+)\b/g;
const toolModels = (name) =>
  [...String(name).toLowerCase().matchAll(TOOL_MODEL_RE)].map((m) => `${m[1]}${m[2].replace('-', '')}`);

function words(product) {
  return normalize(product.name)
    .replace(SIZE_RE, ' ')
    .replace(/\b\d+\s*x\b/g, ' ')
    .replace(new RegExp(COUNT_RE.source, 'g'), ' ')
    .replace(/[.,+]/g, ' ')
    .split(' ')
    .filter((w) => w && !/^\d+$/.test(w));
}

// Pulgadas escritas a mano (65", 65'', 65 pulgadas) o dentro del modelo (UN65DU7000).
function screenInches(name) {
  const text = String(name).toLowerCase();
  const written = text.match(/\b(\d{2,3})\s*(?:"|''|”|″|pulg)/);
  const inModel = text.match(/\b(?:un|qn|oled)(\d{2,3})[a-z]/);
  return (written ?? inModel)?.[1] ?? null;
}

// Los celulares casi nunca traen código de modelo: se identifican por serie + almacenamiento.
const PHONE_RE = /\b(iphone \d+[a-z]?(?: pro max| pro| plus)?|galaxy [a-z]\d+[a-z]?(?: ultra| plus| fe)?|redmi note \d+[a-z]?(?: pro\+| pro)?|redmi \d+[a-z]?|poco [a-z]\d+[a-z]?(?: pro)?|moto [a-z]\d+[a-z]?|honor \d+[a-z]?|reno \d+[a-z]?(?: pro)?|xiaomi \d+[a-z]?(?: pro)?)/;

function phoneKey(product) {
  const text = normalize(`${product.brand} ${product.name}`);
  const series = text.match(PHONE_RE)?.[1];
  if (!series) return null;
  // El mayor valor es el almacenamiento; el otro suele ser la RAM.
  const storage = [...text.matchAll(/\b(\d{1,4})\s*(gb|tb)\b/g)].map((m) => Number(m[1]) * (m[2] === 'tb' ? 1024 : 1));
  return storage.length ? `${series} ${Math.max(...storage)}` : null;
}

const GENERIC_BRANDS = new Set(['generico', 'generica', 'sin marca', 'otros', 'otras marcas']);

function prepare(product) {
  const brandWords = new Set(normalize(product.brand).split(' '));
  const all = words(product);
  const tools = toolModels(product.name);
  const models = [...new Set([...all.filter(isModel), ...tools])];
  return {
    ...product,
    brandKey: GENERIC_BRANDS.has(normalize(product.brand)) ? '' : normalize(product.brand).replace(/[^a-z0-9]/g, ''),
    models,
    tools,
    inches: screenInches(product.name),
    phone: phoneKey(product),
    refurbished: /reacondicionad|refurbished|seminuevo|open box/.test(normalize(product.name)),
    tokens: new Set(
      all.filter((w) => !isModel(w) && !FILLER.has(w) && !brandWords.has(w)).map(singular),
    ),
    size: parseSize(`${product.name} ${product.format ?? ''}`),
    // "Promo TV + Control": mismo modelo, pero no es el mismo producto.
    bundle: /\+|\bpromo\b/.test(normalize(product.name)),
  };
}

/** EFE no publica marca: la toma del nombre usando las marcas vistas en las otras tiendas. */
function fillBrands(products) {
  const known = [...new Set(products.map((p) => normalize(p.brand)).filter((b) => b.length > 1))]
    .sort((a, b) => b.length - a.length);
  return products.map((p) => {
    if (p.brand) return p;
    const name = ` ${normalize(p.name)} `;
    return { ...p, brand: known.find((b) => name.includes(` ${b} `)) ?? '' };
  });
}

function modelScore(a, b) {
  // Dos combos pueden compartir el taladro y traer accesorios distintos.
  if (a.bundle) {
    const same = a.models.length === b.models.length && a.models.every((m) => b.models.includes(m));
    return same ? 0.7 : 0;
  }
  for (const x of a.models) {
    for (const y of b.models) {
      // En herramientas el mismo modelo se vende en kits distintos (con o sin batería).
      if (x === y) return a.tools.includes(x) || b.tools.includes(x) ? 0.7 : 1;
      // "50ut7300" y "50ut7300psa" son el mismo modelo con otro sufijo regional.
      if (x.length >= 7 && y.length >= 7 && (x.startsWith(y) || y.startsWith(x))) return 0.7;
    }
  }
  return 0;
}

/** 0 si no son el mismo producto; si lo son, similitud entre 0 y 1. */
function similarity(a, b) {
  if (!a.brandKey || a.brandKey !== b.brandKey || a.bundle !== b.bundle) return 0;
  // "DU7000" es una familia de TVs: el código se repite en 43" y en 65".
  if (a.inches && b.inches && a.inches !== b.inches) return 0;
  if (a.refurbished !== b.refurbished) return 0;
  // Mismo celular, pero puede variar el color o la versión de SIM: se marca como parecido.
  if (a.phone || b.phone) return a.phone === b.phone ? 0.7 : 0;
  if (a.models.length && b.models.length) return modelScore(a, b);

  const sameSize = a.size.total && a.size.total === b.size.total && a.size.unit === b.size.unit;
  if (!sameSize || a.size.pack !== b.size.pack) return 0;

  let common = 0;
  for (const w of a.tokens) {
    if (b.tokens.has(w)) common++;
    else if (VARIANTS.has(w)) return 0;
  }
  for (const w of b.tokens) if (!a.tokens.has(w) && VARIANTS.has(w)) return 0;
  const total = a.tokens.size + b.tokens.size;
  return total === 0 ? 1 : (2 * common) / total;
}

const MIN_SCORE = 0.5;
const EXACT_SCORE = 0.8;

/** Quita el relleno que mete la tienda: productos que no contienen lo buscado. */
function relevant(products, query) {
  const terms = normalize(query).split(' ').filter((w) => w.length > 1).map(singular);
  const hits = products.filter((p) => {
    const text = normalize(`${p.name} ${p.brand}`);
    return terms.every((w) => text.includes(w));
  });
  return hits.length ? hits : products;
}

function unitPrice(product) {
  const size = product.size ?? parseSize(`${product.name} ${product.format ?? ''}`);
  if (!size.total) return null;
  return { value: (product.price / size.total) * 1000, label: size.unit === 'g' ? 'kg' : 'L' };
}

/** Ordena las ofertas de un grupo y calcula el ahorro. */
function summarize(items, confident) {
  const offers = [...items].sort((x, y) => x.price - y.price);
  const low = offers[0].price;
  const high = offers[offers.length - 1].price;
  const saving = Math.round((high - low) * 100) / 100;
  return {
    key: offers.map((o) => `${o.store}${o.id}`).join('-'),
    offers,
    confident,
    // Una diferencia de más del doble puede ser real, pero conviene revisarla.
    exact: confident && high <= low * 2,
    winner: saving === 0 ? null : offers[0].store,
    saving,
    savingPct: Math.round((saving / high) * 100),
  };
}

/** En marketplace varios vendedores ofrecen el mismo modelo: deja el más barato de cada tienda. */
function cheapestPerModel(items) {
  const best = new Map();
  const rest = [];
  for (const item of items) {
    const model = item.phone ?? item.models.find((m) => !item.tools.includes(m));
    if (!model || item.bundle || item.refurbished) {
      rest.push(item);
      continue;
    }
    const key = `${item.store}:${item.brandKey}:${model}`;
    if (!best.has(key) || item.price < best.get(key).price) best.set(key, item);
  }
  return [...best.values(), ...rest];
}

/**
 * Recibe los productos de todas las tiendas y devuelve:
 *  groups: el mismo producto en 2 o más tiendas, con offers de menor a mayor precio.
 *  singles: productos que solo se encontraron en una tienda.
 */
function compare(products) {
  const items = cheapestPerModel(fillBrands(products).map(prepare));

  const candidates = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].store === items[j].store) continue;
      const score = similarity(items[i], items[j]);
      if (score >= MIN_SCORE) candidates.push({ i, j, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);

  // Une los mejores pares primero; un grupo no puede repetir tienda.
  const groupOf = items.map((item, index) => ({ members: [index], stores: new Set([item.store]), score: 1 }));
  for (const { i, j, score } of candidates) {
    const a = groupOf[i];
    const b = groupOf[j];
    if (a === b || [...a.stores].some((s) => b.stores.has(s))) continue;
    a.members.push(...b.members);
    b.stores.forEach((s) => a.stores.add(s));
    a.score = Math.min(a.score, b.score, score);
    b.members.forEach((m) => { groupOf[m] = a; });
  }

  const groups = [];
  const singles = [];
  for (const group of new Set(groupOf)) {
    if (group.members.length === 1) {
      singles.push(items[group.members[0]]);
      continue;
    }
    groups.push(summarize(group.members.map((m) => items[m]), group.score >= EXACT_SCORE));
  }
  groups.sort((x, y) => Number(y.exact) - Number(x.exact) || y.saving - x.saving);
  singles.sort((x, y) => x.price - y.price);
  return { groups, singles };
}

module.exports = { normalize, parseSize, similarity, relevant, unitPrice, summarize, compare };
