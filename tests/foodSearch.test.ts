import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defaultPortionG, offPortion, searchOpenFoodFacts, __clearSearchCache, type OffFood } from '@/data/foodSearch';

function offResponse(products: unknown[]) {
  return { ok: true, json: async () => ({ products }) } as unknown as Response;
}

const skyr = {
  code: '4001724819394',
  product_name_de: 'Skyr Natur',
  brands: 'Arla',
  serving_size: '150 g',
  unique_scans_n: 1200,
  nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 },
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
