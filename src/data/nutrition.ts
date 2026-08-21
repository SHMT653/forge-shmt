import { getSupabaseClient } from '@/services/supabase/client';
import { estimateCarbsFat } from '@/domain/nutritionMath';
import type { DataQuality, EntrySource, Macros, MealSlot, NutritionLog } from '@/domain/types';

export type MealEntry = {
  id:       string;
  logDate:  string;
  name:     string;
  kcal:     number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
  loggedAt: string;
  /** How much we trust these numbers (§11). */
  dataQuality: DataQuality;
  /** Range for estimated entries, so the UI can show "ca. 700–900" (§56). */
  kcalMin: number | null;
  kcalMax: number | null;
  servings: number;
  slot: MealSlot | null;
  source: EntrySource;
  foodItemId: string | null;
  recipeId: string | null;
  batchId: string | null;
};

const ENTRY_COLUMNS =
  'id, log_date, name, kcal, protein_g, carbs_g, fat_g, logged_at, data_quality, ' +
  'kcal_min, kcal_max, servings, meal_slot, source, food_item_id, recipe_id, batch_id';

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toMealEntry(row: Record<string, unknown>): MealEntry {
  const quality = row.data_quality;
  const slot = row.meal_slot;
  return {
    id:       row.id as string,
    logDate:  row.log_date as string,
    name:     (row.name as string) ?? '',
    kcal:     num(row.kcal),
    proteinG: num(row.protein_g),
    carbsG:   num(row.carbs_g),
    fatG:     num(row.fat_g),
    loggedAt: row.logged_at as string,
    dataQuality: quality === 'estimated' || quality === 'unknown' ? quality : 'verified',
    kcalMin: nullableNum(row.kcal_min),
    kcalMax: nullableNum(row.kcal_max),
    servings: num(row.servings, 1),
    slot: slot === 'breakfast' || slot === 'lunch' || slot === 'dinner' || slot === 'snack' ? slot : null,
    source: ((row.source as EntrySource | null) ?? 'manual'),
    foodItemId: (row.food_item_id as string | null) ?? null,
    recipeId: (row.recipe_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
  };
}

export async function getNutritionLog(userId: string, logDate: string): Promise<NutritionLog> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_nutrition_logs')
    .select('log_date, calories, protein_g')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { logDate, calories: 0, proteinG: 0 };
  return { logDate: data.log_date, calories: num(data.calories), proteinG: num(data.protein_g) };
}

/** Daily totals for a date range, straight from the cached per-day rows. */
export async function listNutritionLogs(userId: string, fromDate: string, toDate: string): Promise<NutritionLog[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_nutrition_logs')
    .select('log_date, calories, protein_g')
    .eq('user_id', userId)
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    logDate: row.log_date,
    calories: num(row.calories),
    proteinG: num(row.protein_g),
  }));
}

export async function saveNutritionLog(userId: string, logDate: string, calories: number, proteinG: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_nutrition_logs')
    .upsert(
      { user_id: userId, log_date: logDate, calories: Math.round(calories), protein_g: Math.round(proteinG) },
      { onConflict: 'user_id,log_date' },
    );
  if (error) throw error;
}

export async function listMealEntries(userId: string, logDate: string): Promise<MealEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toMealEntry(r as unknown as Record<string, unknown>));
}

export async function listMealEntriesForRange(userId: string, fromDate: string, toDate: string): Promise<MealEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('user_id', userId)
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toMealEntry(r as unknown as Record<string, unknown>));
}

export type MealEntryInput = {
  name: string;
  macros: Macros;
  dataQuality?: DataQuality;
  kcalMin?: number | null;
  kcalMax?: number | null;
  servings?: number;
  slot?: MealSlot | null;
  source?: EntrySource;
  foodItemId?: string | null;
  recipeId?: string | null;
  batchId?: string | null;
  /** Explicit timestamp, for back-dating an entry onto the timeline. */
  loggedAt?: string;
};

export async function addMealEntry(userId: string, logDate: string, entry: MealEntryInput): Promise<MealEntry> {
  const supabase = getSupabaseClient();
  const row: Record<string, unknown> = {
    user_id:   userId,
    log_date:  logDate,
    name:      entry.name,
    kcal:      entry.macros.kcal,
    protein_g: entry.macros.proteinG,
    carbs_g:   entry.macros.carbsG,
    fat_g:     entry.macros.fatG,
    data_quality: entry.dataQuality ?? 'verified',
    kcal_min:  entry.kcalMin ?? null,
    kcal_max:  entry.kcalMax ?? null,
    servings:  entry.servings ?? 1,
    meal_slot: entry.slot ?? null,
    source:    entry.source ?? 'manual',
    food_item_id: entry.foodItemId ?? null,
    recipe_id: entry.recipeId ?? null,
    batch_id:  entry.batchId ?? null,
  };
  if (entry.loggedAt) row.logged_at = entry.loggedAt;

  const { data, error } = await supabase.from('forge_meal_entries').insert(row).select(ENTRY_COLUMNS).single();
  if (error) throw error;
  return toMealEntry(data as unknown as Record<string, unknown>);
}

export async function updateMealEntry(
  userId: string,
  entryId: string,
  patch: { name?: string; macros?: Macros; servings?: number; slot?: MealSlot | null; dataQuality?: DataQuality },
): Promise<void> {
  const supabase = getSupabaseClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.macros) {
    row.kcal = patch.macros.kcal;
    row.protein_g = patch.macros.proteinG;
    row.carbs_g = patch.macros.carbsG;
    row.fat_g = patch.macros.fatG;
  }
  if (patch.servings !== undefined) row.servings = patch.servings;
  if (patch.slot !== undefined) row.meal_slot = patch.slot;
  if (patch.dataQuality !== undefined) row.data_quality = patch.dataQuality;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('forge_meal_entries').update(row).eq('id', entryId).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteMealEntry(userId: string, entryId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_meal_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Returns the most recent unique meals (by name) across all dates — for quick re-log chips */
export async function listRecentUniqueMeals(userId: string, limit = 8): Promise<MealEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(80); // fetch more, then dedupe client-side
  if (error) throw error;

  const seen = new Set<string>();
  const unique: MealEntry[] = [];
  for (const raw of data ?? []) {
    const row = raw as unknown as Record<string, unknown>;
    const name = row.name as string;
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(toMealEntry(row));
      if (unique.length >= limit) break;
    }
  }
  return unique;
}

/** Re-computes and syncs the daily nutrition_log total from all meal entries */
export async function syncNutritionTotals(userId: string, logDate: string): Promise<void> {
  const entries = await listMealEntries(userId, logDate);
  const totalKcal    = entries.reduce((s, e) => s + e.kcal,     0);
  const totalProtein = entries.reduce((s, e) => s + e.proteinG, 0);
  await saveNutritionLog(userId, logDate, totalKcal, totalProtein);
}

export { estimateCarbsFat };
