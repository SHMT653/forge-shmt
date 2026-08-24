import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  barcodeLookupVariants,
  defaultPortionG,
  findOpenFoodFactsByBarcode,
  normalizeBarcode,
  offPortion,
  searchOpenFoodFacts,
  __clearSearchCache,
  type OffFood,
} from '@/data/foodSearch';

function offResponse(products: unknown[]) {
  return { ok: true, json: async () => ({ products }) } as unknown as Response;
}

function offProductResponse(product: unknown, status = 1) {
  return { ok: true, json: async () => ({ status, product }) } as unknown as Response;
}

function fdcResponse(foods: unknown[]) {
  return { ok: true, json: async () => ({ foods }) } as unknown as Response;
}

const skyr = {
  code: '4001724819394',
  product_name_de: 'Skyr Natur',
  brands: 'Arla',
  serving_size: '150 g',
  unique_scans_n: 1200,
  nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 },
};

const cheddar = {
  description: 'CHEDDAR CHEESE',
  brandName: 'GRAFTON VILLAGE',
  gtinUpc: '094395000172',
  servingSize: 28,
  servingSizeUnit: 'g',
  foodNutrients: [
    { nutrientId: 1008, nutrientNumber: '208', value: 393, unitName: 'KCAL' },
    { nutrientId: 1003, nutrientNumber: '203', value: 21.4, unitName: 'G' },
    { nutrientId: 1005, nutrientNumber: '205', value: 3.57, unitName: 'G' },
    { nutrientId: 1004, nutrientNumber: '204', value: 28.6, unitName: 'G' },
  ],
};

describe('searchOpenFoodFacts', () => {
  beforeEach(() => {
    __clearSearchCache();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a product to FORGE’s shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => offResponse([skyr])));
    const results = await searchOpenFoodFacts('skyr');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: 'Skyr Natur',
      brand: 'Arla',
      servingSizeG: 150,
      popularity: 1200,
    });
    expect(results[0]?.per100.kcal).toBe(63);
  });

  it('does not call the network for a query that is too short', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchOpenFoodFacts('sk')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops entries with no name or no energy value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => offResponse([
      { code: '1', product_name: '', nutriments: { 'energy-kcal_100g': 100 } },
      { code: '2', product_name: 'Ohne Nährwerte', nutriments: {} },
      { code: '3', product_name: 'Unmöglich', nutriments: { 'energy-kcal_100g': 5000 } },
      skyr,
    ])));
    const results = await searchOpenFoodFacts('test');
    expect(results.map((r) => r.name)).toEqual(['Skyr Natur']);
  });

  it('caches so retyping does not hammer the API', async () => {
    const fetchMock = vi.fn(async () => offResponse([skyr]));
    vi.stubGlobal('fetch', fetchMock);
    await searchOpenFoodFacts('skyr');
    await searchOpenFoodFacts('SKYR');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the world endpoint when German search is empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(offResponse([]))
      .mockResolvedValueOnce(offResponse([skyr]));
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchOpenFoodFacts('skyr');

    expect(results.map((result) => result.name)).toEqual(['Skyr Natur']);
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('de.openfoodfacts.org'), expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('world.openfoodfacts.org'), expect.anything());
  });

  it('returns an empty list when offline rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await searchOpenFoodFacts('skyr')).toEqual([]);
  });

  it('survives a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    expect(await searchOpenFoodFacts('skyr')).toEqual([]);
  });

  it('parses comma decimals in nutriment values', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => offResponse([
      { ...skyr, nutriments: { 'energy-kcal_100g': '63,5', proteins_100g: '11,2' } },
    ])));
    const results = await searchOpenFoodFacts('skyr');
    expect(results[0]?.per100.kcal).toBe(64);
    expect(results[0]?.per100.proteinG).toBe(11.2);
  });
});

describe('findOpenFoodFactsByBarcode', () => {
  beforeEach(() => {
    __clearSearchCache();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalises package barcode text', () => {
    expect(normalizeBarcode('4 001724 819394')).toBe('4001724819394');
    expect(normalizeBarcode('https://id.gs1.org/01/04001724819394/10/ABC')).toBe('04001724819394');
    expect(normalizeBarcode('(01)04001724819394(17)260101')).toBe('04001724819394');
    expect(normalizeBarcode('abc')).toBeNull();
  });

  it('creates lookup variants for GTINs with a leading zero', () => {
    expect(barcodeLookupVariants('https://id.gs1.org/01/04001724819394')).toEqual([
      '04001724819394',
      '4001724819394',
    ]);
    expect(barcodeLookupVariants('094395000172')).toEqual(['094395000172']);
  });

  it('loads one product by barcode', async () => {
    const fetchMock = vi.fn(async () => offProductResponse(skyr));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findOpenFoodFactsByBarcode('4001724819394');

    expect(result).toMatchObject({
      code: '4001724819394',
      name: 'Skyr Natur',
      brand: 'Arla',
      servingSizeG: 150,
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v2/product/4001724819394.json'), expect.anything());
  });

  it('checks the second product endpoint when the first has no hit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(offProductResponse(null, 0))
      .mockResolvedValueOnce(offProductResponse(skyr));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findOpenFoodFactsByBarcode('4001724819394');

    expect(result?.name).toBe('Skyr Natur');
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('world.openfoodfacts.org'), expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('de.openfoodfacts.org'), expect.anything());
  });

  it('tries a stripped EAN variant when a GS1 GTIN-14 misses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(offProductResponse(null, 0))
      .mockResolvedValueOnce(offProductResponse(null, 0))
      .mockResolvedValueOnce(offProductResponse(skyr))
      .mockResolvedValueOnce(offProductResponse(null, 0));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findOpenFoodFactsByBarcode('https://id.gs1.org/01/04001724819394');

    expect(result?.name).toBe('Skyr Natur');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v2/product/04001724819394.json'), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v2/product/4001724819394.json'), expect.anything());
  });

  it('uses FoodData Central as a last barcode fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(offProductResponse(null, 0))
      .mockResolvedValueOnce(offProductResponse(null, 0))
      .mockResolvedValueOnce(fdcResponse([cheddar]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findOpenFoodFactsByBarcode('094395000172');

    expect(result).toMatchObject({
      code: '094395000172',
      name: 'CHEDDAR CHEESE',
      brand: 'GRAFTON VILLAGE',
      servingSizeG: 28,
    });
    expect(result?.per100).toEqual({ kcal: 393, proteinG: 21.4, carbsG: 3.6, fatG: 28.6 });
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('api.nal.usda.gov/fdc/v1/foods/search'), expect.anything());
  });

  it('does not call the network for an invalid barcode', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await findOpenFoodFactsByBarcode('12')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when the barcode is missing in Open Food Facts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => offProductResponse(null, 0)));
    expect(await findOpenFoodFactsByBarcode('4001724819394')).toBeNull();
  });
});

describe('portion maths', () => {
  const food: OffFood = {
    code: '1',
    name: 'Skyr',
    brand: 'Arla',
    per100: { kcal: 63, proteinG: 11, carbsG: 4, fatG: 0.2 },
    servingSizeG: 150,
    imageUrl: null,
    popularity: 10,
  };

  it('scales per-100 g values to a portion', () => {
    expect(offPortion(food, 150)).toEqual({ kcal: 95, proteinG: 16.5, carbsG: 6, fatG: 0.3 });
  });

  it('uses the pack serving size as the default portion', () => {
    expect(defaultPortionG(food)).toBe(150);
  });

  it('falls back to 100 g when the pack says nothing', () => {
    expect(defaultPortionG({ ...food, servingSizeG: null })).toBe(100);
  });

  it('handles a 450 g tub', () => {
    expect(offPortion(food, 450).kcal).toBe(284);
  });
});
