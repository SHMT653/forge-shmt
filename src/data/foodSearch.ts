import type { Macros } from '@/domain/types';

/**
 * Text search against Open Food Facts.
 *
 * OFF is an open, crowdsourced database with a worldwide endpoint and localized
 * country/language endpoints. That makes it the right "unmengen an Essen"
 * source: free, no key, no per-request cost, and it already backs the barcode
 * scanner in this app. Exact barcode scans use both world + German endpoints;
 * text search stays German-first so the results still feel local.
 *
 * The trade-off is data quality. Anyone can contribute, so entries range from
 * complete and accurate to a name with no nutrition at all. Everything here is
 * therefore filtered hard and labelled `estimated` — never `verified` (§11).
 */

export type OffFood = {
  /** Barcode, used as the stable id and for de-duplication. */
  code: string;
  name: string;
  brand: string;
  /** Per 100 g / 100 ml. */
  per100: Macros;
  servingSizeG: number | null;
  imageUrl: string | null;
  /** How often the product was scanned — a decent proxy for "is this real". */
  popularity: number;
};

type OffSearchResponse = {
  products?: OffProduct[];
};

type OffProductResponse = {
  status?: number | string;
  product?: OffProduct;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  serving_size?: string;
  image_front_small_url?: string;
  unique_scans_n?: number;
  nutriments?: Record<string, number | string | undefined>;
};

const OFF_FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_size,image_front_small_url,unique_scans_n';
const SEARCH_TIMEOUT_MS = 7000;
const BARCODE_TIMEOUT_MS = 4000;

const FOOD_FACTS_ENDPOINTS = [
  { label: 'Open Food Facts World', baseUrl: 'https://world.openfoodfacts.org' },
  { label: 'Open Food Facts DE', baseUrl: 'https://de.openfoodfacts.org' },
] as const;

const SEARCH_ENDPOINTS = [
  FOOD_FACTS_ENDPOINTS[1],
  FOOD_FACTS_ENDPOINTS[0],
] as const;

// A session-scoped cache. Open Food Facts asks callers to be gentle, and the
// same query gets retyped constantly while the user edits the field.
const cache = new Map<string, OffFood[]>();
const MAX_CACHE = 60;

function numberOr(value: unknown, fallback: number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseServingG(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*(g|ml)/i.exec(raw);
  if (!match?.[1]) return null;
  const value = parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value < 5000 ? value : null;
}

function toOffFood(product: OffProduct): OffFood | null {
  const nutriments = product.nutriments ?? {};
  const kcal = numberOr(nutriments['energy-kcal_100g'], null) ?? numberOr(nutriments['energy-kcal'], null);
  const name = (product.product_name_de || product.product_name || '').trim();

  // No name or no energy value means the entry cannot be logged honestly.
  if (!name || kcal === null || kcal <= 0 || kcal > 900) return null;

  return {
    code: product.code ?? name,
    name,
    brand: product.brands?.split(',')[0]?.trim() ?? '',
    per100: {
      kcal: Math.round(kcal),
      proteinG: Math.round((numberOr(nutriments.proteins_100g, 0) ?? 0) * 10) / 10,
      carbsG: Math.round((numberOr(nutriments.carbohydrates_100g, 0) ?? 0) * 10) / 10,
      fatG: Math.round((numberOr(nutriments.fat_100g, 0) ?? 0) * 10) / 10,
    },
    servingSizeG: parseServingG(product.serving_size),
    imageUrl: product.image_front_small_url ?? null,
    popularity: numberOr(product.unique_scans_n, 0) ?? 0,
  };
}

/** Normalises a UPC/EAN/GTIN scanned by camera or typed from the package. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/**
 * Searches Open Food Facts for products matching `query`.
 *
 * Uses the German subdomain first so German-market products rank first —
 * searching "Skyr" on the world endpoint returns mostly Icelandic and Danish
 * entries. If the German endpoint is empty, the world endpoint fills the gap.
 */
export async function searchOpenFoodFacts(query: string, limit = 12): Promise<OffFood[]> {
  const needle = query.trim();
  if (needle.length < 3) return [];

  const key = `${needle.toLowerCase()}:${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    search_terms: needle,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(Math.min(40, limit * 3)),
    fields: OFF_FIELDS,
  });

  try {
    // Observed in practice: the endpoint intermittently drops a request under
    // load. One retry turns a visibly empty result list into a hit.
    let json = await fetchSearchWithRetry(SEARCH_ENDPOINTS[0], params);
    if (!json || (json.products ?? []).length === 0) {
      json = await fetchSearchWithRetry(SEARCH_ENDPOINTS[1], params);
    }
    if (!json) return [];
    const results: OffFood[] = [];

    for (const product of json.products ?? []) {
      const mapped = toOffFood(product);
      if (!mapped) continue;
      results.push(mapped);

      if (results.length >= limit) break;
    }

    if (cache.size >= MAX_CACHE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, results);
    return results;
  } catch {
    // Offline or rate-limited: the other sources still answer.
    return [];
  }
}

/** Looks up exactly one product by UPC/EAN/GTIN barcode. */
export async function findOpenFoodFactsByBarcode(rawBarcode: string): Promise<OffFood | null> {
  const code = normalizeBarcode(rawBarcode);
  if (!code) return null;

  const params = new URLSearchParams({ fields: OFF_FIELDS });
  try {
    const products = await Promise.all(
      FOOD_FACTS_ENDPOINTS.map((endpoint) => fetchBarcodeProduct(endpoint, code, params)),
    );
    return products.find((product): product is OffFood => product !== null) ?? null;
  } catch {
    return null;
  }
}

/** Macros for a portion of an OFF product, which are always per 100 g. */
export function offPortion(food: OffFood, grams: number): Macros {
  const factor = grams / 100;
  return {
    kcal: Math.round(food.per100.kcal * factor),
    proteinG: Math.round(food.per100.proteinG * factor * 10) / 10,
    carbsG: Math.round(food.per100.carbsG * factor * 10) / 10,
    fatG: Math.round(food.per100.fatG * factor * 10) / 10,
  };
}

/** Default portion: the pack's own serving size, else 100 g. */
export function defaultPortionG(food: OffFood): number {
  return food.servingSizeG ?? 100;
}

async function fetchSearchWithRetry(
  endpoint: (typeof FOOD_FACTS_ENDPOINTS)[number],
  params: URLSearchParams,
  attempts = 2,
): Promise<OffSearchResponse | null> {
  return fetchJsonWithRetry<OffSearchResponse>(
    `${endpoint.baseUrl}/cgi/search.pl?${params}`,
    attempts,
    SEARCH_TIMEOUT_MS,
  );
}

async function fetchBarcodeProduct(
  endpoint: (typeof FOOD_FACTS_ENDPOINTS)[number],
  code: string,
  params: URLSearchParams,
): Promise<OffFood | null> {
  const json = await fetchJsonWithRetry<OffProductResponse>(
    `${endpoint.baseUrl}/api/v2/product/${encodeURIComponent(code)}.json?${params}`,
    1,
    BARCODE_TIMEOUT_MS,
  );
  if (!json || String(json.status ?? '0') !== '1' || !json.product) return null;
  const product = toOffFood({ ...json.product, code: json.product.code ?? code });
  return product ? { ...product, code } : null;
}

async function fetchJsonWithRetry<T>(url: string, attempts = 2, timeoutMs = SEARCH_TIMEOUT_MS): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'FORGE-SHMT-App/1.0 (personal fitness tracker)' },
      });
      if (response.ok) return (await response.json()) as T;
    } catch {
      // fall through to the retry
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}

export function __clearSearchCache(): void {
  cache.clear();
}
