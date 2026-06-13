export type ScannedProduct = {
  barcode: string;
  name: string;
  brand: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeG: number | null;
  imageUrl: string | null;
};

type OFFProduct = {
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  image_front_small_url?: string;
  serving_size?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy-kcal'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
};

function parseServingG(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*g/i.exec(raw);
  if (match?.[1]) return parseFloat(match[1].replace(',', '.'));
  return null;
}

export async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'FORGE-SHMT-App/1.0' },
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = (await res.json()) as { status: number; product?: OFFProduct };
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const n = p.nutriments ?? {};

    const kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? null;
    const protein = n.proteins_100g ?? null;
    const carbs = n.carbohydrates_100g ?? null;
    const fat = n.fat_100g ?? null;

    if (kcal === null) return null;

    const name = p.product_name_de ?? p.product_name ?? 'Unbekanntes Produkt';

    return {
      barcode,
      name: name.trim(),
      brand: p.brands?.split(',')[0]?.trim() ?? '',
      kcalPer100g: Math.round(kcal),
      proteinPer100g: Math.round((protein ?? 0) * 10) / 10,
      carbsPer100g: Math.round((carbs ?? 0) * 10) / 10,
      fatPer100g: Math.round((fat ?? 0) * 10) / 10,
      servingSizeG: parseServingG(p.serving_size),
      imageUrl: p.image_front_small_url ?? null,
    };
  } catch {
    return null;
  }
}
