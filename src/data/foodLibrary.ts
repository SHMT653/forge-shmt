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

export async function listRecipes(userId: string): Promise<Recipe[]> {
  const supabase = getSupabaseClient();
  const { data: recipes, error } = await supabase
    .from('forge_recipes')
    .select('id, name, total_servings, serving_label, is_meal_prep, favorite, notes, use_count')
    .eq('user_id', userId)
    .order('favorite', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  if (!recipes?.length) return [];

  const { data: ingredients, error: ingError } = await supabase
    .from('forge_recipe_ingredients')
    .select('id, recipe_id, food_item_id, name, amount_label, kcal, protein_g, carbs_g, fat_g, order_index')
    .in('recipe_id', recipes.map((r) => r.id));
  if (ingError) throw ingError;

  return recipes.map((r) => assembleRecipe(r as RecipeRow, (ingredients ?? []) as IngredientRow[]));
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

export async function createRecipe(userId: string, input: RecipeInput): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_recipes')
    .insert({
      user_id: userId,
      name: input.name,
      total_servings: input.totalServings,
      serving_label: input.servingLabel ?? 'Portion',
      is_meal_prep: input.isMealPrep ?? false,
      favorite: input.favorite ?? false,
      notes: input.notes ?? '',
    })
    .select('id')
    .single();
  if (error) throw error;

  await replaceIngredients(data.id, input.ingredients);
  return data.id;
}

export async function updateRecipe(userId: string, recipeId: string, input: RecipeInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_recipes')
    .update({
      name: input.name,
      total_servings: input.totalServings,
      serving_label: input.servingLabel ?? 'Portion',
      is_meal_prep: input.isMealPrep ?? false,
      favorite: input.favorite ?? false,
      notes: input.notes ?? '',
    })
    .eq('id', recipeId)
    .eq('user_id', userId);
  if (error) throw error;
  await replaceIngredients(recipeId, input.ingredients);
}

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

export async function deleteRecipe(userId: string, recipeId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_recipes').delete().eq('id', recipeId).eq('user_id', userId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════
// Meal prep batches (§13)
// ═══════════════════════════════════════════════════════════════════════════

export async function listActiveBatches(userId: string): Promise<MealPrepBatch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_prep_batches')
    .select('id, recipe_id, cooked_on, total_portions, portions_used, active, forge_recipes(name)')
    .eq('user_id', userId)
    .eq('active', true)
    .order('cooked_on', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const total = num(row.total_portions);
    const used = num(row.portions_used);
    const related = row.forge_recipes as unknown as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(related) ? (related[0]?.name ?? '') : (related?.name ?? '');
    return {
      id: row.id,
      recipeId: row.recipe_id,
      recipeName: name,
      cookedOn: row.cooked_on,
      totalPortions: total,
      portionsUsed: used,
      portionsLeft: Math.max(0, total - used),
      active: row.active,
    };
  });
}

export async function createBatch(
  userId: string,
  recipeId: string,
  totalPortions: number,
  cookedOn: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_meal_prep_batches').insert({
    user_id: userId,
    recipe_id: recipeId,
    total_portions: totalPortions,
    cooked_on: cookedOn,
  });
  if (error) throw error;
}

/**
 * Consumes portions from a batch. When the batch runs out it is deactivated
 * rather than deleted, so past meal entries keep pointing at something real.
 */
export async function consumeBatchPortions(userId: string, batchId: string, portions: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_prep_batches')
    .select('total_portions, portions_used')
    .eq('id', batchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;

  const total = num(data.total_portions);
  const nextUsed = Math.min(total, num(data.portions_used) + portions);
  const { error: updateError } = await supabase
    .from('forge_meal_prep_batches')
    .update({ portions_used: nextUsed, active: nextUsed < total })
    .eq('id', batchId)
    .eq('user_id', userId);
  if (updateError) throw updateError;
}

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
