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

type FdcSearchResponse = {
  foods?: FdcProduct[];
};

type FdcProduct = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: FdcNutrient[];
};

type FdcNutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  unitName?: string;
  value?: number | string;
};

const OFF_FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_size,image_front_small_url,unique_scans_n';
const SEARCH_TIMEOUT_MS = 7000;
const BARCODE_TIMEOUT_MS = 4000;
const FDC_API_KEY =
  process.env.USDA_FDC_API_KEY ??
  process.env.FDC_API_KEY ??
  process.env.NEXT_PUBLIC_USDA_FDC_API_KEY ??
  process.env.NEXT_PUBLIC_FDC_API_KEY ??
  'DEMO_KEY';

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
  const direct = raw.replace(/\D/g, '');
  if (direct.length >= 8 && direct.length <= 14) return direct;

  const decoded = decodeLoose(raw);
  const digitalLink = /(?:^|\/)01\/(\d{8,14})(?=\/|[?#]|$)/.exec(decoded);
  if (digitalLink?.[1]) return digitalLink[1];

  const gs1Element = /(?:^|[\x1d(]|\]d2)01\)?(\d{14})/i.exec(decoded);
  if (gs1Element?.[1]) return gs1Element[1];

  const digits = raw.replace(/\D/g, '');
  const gs1Plain = digits.length > 14 && digits.startsWith('01') ? digits.slice(2, 16) : null;
  return gs1Plain && gs1Plain.length === 14 ? gs1Plain : null;
}

export function barcodeLookupVariants(raw: string): string[] {
  const code = normalizeBarcode(raw);
  if (!code) return [];

  const variants = [code];
  let stripped = code;
  while (stripped.length > 12 && stripped.startsWith('0')) {
    stripped = stripped.slice(1);
    variants.push(stripped);
  }
  return [...new Set(variants)];
}

function decodeLoose(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function sameBarcode(left: string, right: string): boolean {
  const leftVariants = barcodeLookupVariants(left);
  const rightVariants = barcodeLookupVariants(right);
  return leftVariants.some((variant) => rightVariants.includes(variant));
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
  const codes = barcodeLookupVariants(rawBarcode);
  if (codes.length === 0) return null;

  const params = new URLSearchParams({ fields: OFF_FIELDS });
  try {
    for (const code of codes) {
      const products = await Promise.all(
        FOOD_FACTS_ENDPOINTS.map((endpoint) => fetchBarcodeProduct(endpoint, code, params)),
      );
      const product = products.find((candidate): candidate is OffFood => candidate !== null);
      if (product) return product;
    }

    return await findFoodDataCentralByBarcode(codes);
  } catch {
    return null;
  }
}

type BarcodeApiResponse = { product?: OffFood | null };

/**
 * Browser-facing barcode lookup.
 *
 * Client code goes through Forge's API route first so CORS quirks and private
 * USDA keys stay server-side. The direct lookup remains as a fallback for local
 * tests, offline development and any deployment where the route is unavailable.
 */
export async function findProductByBarcode(rawBarcode: string): Promise<OffFood | null> {
  const code = normalizeBarcode(rawBarcode);
  if (!code) return null;

  if (typeof window !== 'undefined') {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), BARCODE_TIMEOUT_MS + 1500);
    try {
      const response = await fetch(`/api/food/barcode?code=${encodeURIComponent(code)}`, {
        signal: controller.signal,
      });
      if (response.ok) {
        const json = (await response.json()) as BarcodeApiResponse;
        return json.product ?? null;
      }
    } catch {
      // Fall back to the direct public endpoints below.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return findOpenFoodFactsByBarcode(code);
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

async function findFoodDataCentralByBarcode(codes: string[]): Promise<OffFood | null> {
  for (const code of codes) {
    const params = new URLSearchParams({
      api_key: FDC_API_KEY,
      query: code,
      dataType: 'Branded',
      pageSize: '5',
    });
    const json = await fetchJsonWithRetry<FdcSearchResponse>(
      `https://api.nal.usda.gov/fdc/v1/foods/search?${params}`,
      1,
      BARCODE_TIMEOUT_MS,
    );
    for (const food of json?.foods ?? []) {
      const mapped = toFoodDataCentralFood(food, code);
      if (mapped) return mapped;
    }
  }
  return null;
}

function toFoodDataCentralFood(food: FdcProduct, requestedCode: string): OffFood | null {
  const gtin = normalizeBarcode(food.gtinUpc ?? '');
  if (!gtin || !sameBarcode(gtin, requestedCode)) return null;

  const kcal = fdcNutrient(food, [1008], ['208']);
  const proteinG = fdcNutrient(food, [1003], ['203']);
  const fatG = fdcNutrient(food, [1004], ['204']);
  const carbsG = fdcNutrient(food, [1005], ['205']);
  const name = food.description?.trim();
  if (!name || kcal === null || kcal <= 0 || kcal > 900) return null;

  const servingSizeG = parseFdcServing(food);
  return {
    code: gtin,
    name,
    brand: (food.brandName || food.brandOwner || '').trim(),
    per100: {
      kcal: Math.round(kcal),
      proteinG: Math.round((proteinG ?? 0) * 10) / 10,
      carbsG: Math.round((carbsG ?? 0) * 10) / 10,
      fatG: Math.round((fatG ?? 0) * 10) / 10,
    },
    servingSizeG,
    imageUrl: null,
    popularity: 0,
  };
}

function fdcNutrient(food: FdcProduct, ids: number[], numbers: string[]): number | null {
  for (const nutrient of food.foodNutrients ?? []) {
    if (nutrient.nutrientId && ids.includes(nutrient.nutrientId)) return numberOr(nutrient.value, null);
    if (nutrient.nutrientNumber && numbers.includes(nutrient.nutrientNumber)) return numberOr(nutrient.value, null);
  }
  return null;
}

function parseFdcServing(food: FdcProduct): number | null {
  const unit = food.servingSizeUnit?.toLowerCase();
  if (unit !== 'g' && unit !== 'ml') return null;
  const size = food.servingSize;
  return typeof size === 'number' && Number.isFinite(size) && size > 0 && size < 5000 ? size : null;
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
