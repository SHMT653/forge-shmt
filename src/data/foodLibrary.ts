import { getSupabaseClient } from '@/services/supabase/client';
import type { DataQuality, FoodItem, Macros, MealPrepBatch, Recipe, RecipeIngredient } from '@/domain/types';
import { sumMacros, scaleMacros, EMPTY_MACROS } from '@/domain/nutritionMath';
import { foodKey, perPortion, shouldRemember, type RememberCandidate } from '@/domain/foodMemory';

const FOOD_COLUMNS =
  'id, name, brand, serving_label, serving_g, kcal, protein_g, carbs_g, fat_g, ' +
  'data_quality, barcode, favorite, use_count, last_used_at';

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toQuality(value: unknown): DataQuality {
  return value === 'estimated' || value === 'unknown' ? value : 'verified';
}

function toFoodItem(row: Record<string, unknown>): FoodItem {
  return {
    id: row.id as string,
    name: row.name as string,
    brand: (row.brand as string) ?? '',
    servingLabel: (row.serving_label as string) ?? '1 Portion',
    servingG: row.serving_g === null || row.serving_g === undefined ? null : num(row.serving_g),
    macros: {
      kcal: num(row.kcal),
      proteinG: num(row.protein_g),
      carbsG: num(row.carbs_g),
      fatG: num(row.fat_g),
    },
    dataQuality: toQuality(row.data_quality),
    barcode: (row.barcode as string | null) ?? null,
    favorite: Boolean(row.favorite),
    useCount: num(row.use_count),
    lastUsedAt: (row.last_used_at as string | null) ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Food items — the user's own products
// ═══════════════════════════════════════════════════════════════════════════

export async function listFoodItems(userId: string): Promise<FoodItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_food_items')
    .select(FOOD_COLUMNS)
    .eq('user_id', userId)
    .order('favorite', { ascending: false })
    .order('use_count', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toFoodItem(r as unknown as Record<string, unknown>));
}

export type FoodItemInput = {
  name: string;
  brand?: string;
  servingLabel?: string;
  servingG?: number | null;
  macros: Macros;
  dataQuality?: DataQuality;
  barcode?: string | null;
  favorite?: boolean;
};

export async function createFoodItem(userId: string, input: FoodItemInput): Promise<FoodItem> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_food_items')
    .insert({
      user_id: userId,
      name: input.name,
      brand: input.brand ?? '',
      serving_label: input.servingLabel ?? '1 Portion',
      serving_g: input.servingG ?? null,
      kcal: input.macros.kcal,
      protein_g: input.macros.proteinG,
      carbs_g: input.macros.carbsG,
      fat_g: input.macros.fatG,
      data_quality: input.dataQuality ?? 'verified',
      barcode: input.barcode ?? null,
      favorite: input.favorite ?? false,
    })
    .select(FOOD_COLUMNS)
    .single();
  if (error) throw error;
  return toFoodItem(data as unknown as Record<string, unknown>);
}

export async function updateFoodItem(userId: string, id: string, input: FoodItemInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_food_items')
    .update({
      name: input.name,
      brand: input.brand ?? '',
      serving_label: input.servingLabel ?? '1 Portion',
      serving_g: input.servingG ?? null,
      kcal: input.macros.kcal,
      protein_g: input.macros.proteinG,
      carbs_g: input.macros.carbsG,
      fat_g: input.macros.fatG,
      data_quality: input.dataQuality ?? 'verified',
      barcode: input.barcode ?? null,
      favorite: input.favorite ?? false,
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteFoodItem(userId: string, id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_food_items').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function toggleFoodFavorite(userId: string, id: string, favorite: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_food_items').update({ favorite }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Bumps usage stats so favourites float to the top of quick-add over time. */
export async function markFoodUsed(userId: string, id: string, currentCount: number): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('forge_food_items')
    .update({ use_count: currentCount + 1, last_used_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
}

export async function findFoodByBarcode(userId: string, barcode: string): Promise<FoodItem | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_food_items')
    .select(FOOD_COLUMNS)
    .eq('user_id', userId)
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw error;
  return data ? toFoodItem(data as unknown as Record<string, unknown>) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Recipes
// ═══════════════════════════════════════════════════════════════════════════

type RecipeRow = {
  id: string;
  name: string;
  total_servings: number | string;
  serving_label: string;
  is_meal_prep: boolean;
  favorite: boolean;
  notes: string;
  use_count: number;
};

type IngredientRow = {
  id: string;
  recipe_id: string;
  food_item_id: string | null;
  name: string;
  amount_label: string;
  kcal: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  order_index: number;
};

function assembleRecipe(row: RecipeRow, ingredientRows: IngredientRow[]): Recipe {
  const ingredients: RecipeIngredient[] = ingredientRows
    .filter((i) => i.recipe_id === row.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => ({
      id: i.id,
      foodItemId: i.food_item_id,
      name: i.name,
      amountLabel: i.amount_label ?? '',
      macros: { kcal: num(i.kcal), proteinG: num(i.protein_g), carbsG: num(i.carbs_g), fatG: num(i.fat_g) },
      orderIndex: i.order_index,
    }));

  const totalMacros = sumMacros(ingredients.map((i) => i.macros));
  const totalServings = Math.max(0.01, num(row.total_servings, 1));

  return {
    id: row.id,
    name: row.name,
    totalServings,
    servingLabel: row.serving_label ?? 'Portion',
    isMealPrep: row.is_meal_prep,
    favorite: row.favorite,
    notes: row.notes ?? '',
    useCount: num(row.use_count),
    ingredients,
    totalMacros,
    perServing: scaleMacros(totalMacros, 1 / totalServings),
  };
}


export type RecipeInput = {
  name: string;
  totalServings: number;
  servingLabel?: string;
  isMealPrep?: boolean;
  favorite?: boolean;
  notes?: string;
  ingredients: { foodItemId?: string | null; name: string; amountLabel?: string; macros: Macros }[];
};



async function replaceIngredients(recipeId: string, ingredients: RecipeInput['ingredients']): Promise<void> {
  const supabase = getSupabaseClient();
  const { error: delError } = await supabase.from('forge_recipe_ingredients').delete().eq('recipe_id', recipeId);
  if (delError) throw delError;
  if (ingredients.length === 0) return;

  const { error } = await supabase.from('forge_recipe_ingredients').insert(
    ingredients.map((ing, index) => ({
      recipe_id: recipeId,
      food_item_id: ing.foodItemId ?? null,
      name: ing.name,
      amount_label: ing.amountLabel ?? '',
      kcal: ing.macros.kcal,
      protein_g: ing.macros.proteinG,
      carbs_g: ing.macros.carbsG,
      fat_g: ing.macros.fatG,
      order_index: index,
    })),
  );
  if (error) throw error;
}


// ═══════════════════════════════════════════════════════════════════════════
// Meal prep batches (§13)
// ═══════════════════════════════════════════════════════════════════════════



/**
 * Consumes portions from a batch. When the batch runs out it is deactivated
 * rather than deleted, so past meal entries keep pointing at something real.
 */

export async function closeBatch(userId: string, batchId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_meal_prep_batches')
    .update({ active: false })
    .eq('id', batchId)
    .eq('user_id', userId);
  if (error) throw error;
}

export { EMPTY_MACROS };

/**
 * Files a hand-typed meal into the user's own food library.
 *
 * Lives here rather than in a hook because a meal can be logged from two
 * places — today's screen and back-dating a past day in the calendar — and a
 * food the user typed in should be remembered either way. Doing it in one hook
 * meant the calendar quietly skipped it.
 *
 * Only the names are fetched for the duplicate check, so this costs one small
 * query and never blocks the log itself: any failure is swallowed, because
 * remembering the food is a convenience and losing the meal entry is not.
 */
export async function rememberFoodFromEntry(userId: string, entry: RememberCandidate): Promise<void> {
  try {
    // Cheap pre-check before touching the network at all.
    if (!shouldRemember(entry, [])) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('forge_food_items').select('name').eq('user_id', userId);
    if (error) return;

    const existing = (data ?? []).map((row) => foodKey((row as { name: string }).name));
    if (!shouldRemember(entry, existing)) return;

    await createFoodItem(userId, {
      name: entry.name.trim(),
      macros: perPortion(entry.macros, entry.servings),
      ...(entry.dataQuality ? { dataQuality: entry.dataQuality } : {}),
    });
  } catch {
    // Never let filing a food fail the meal that was actually logged.
  }
}
