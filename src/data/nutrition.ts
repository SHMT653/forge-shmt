import { getSupabaseClient } from '@/services/supabase/client';
import type { NutritionLog } from '@/domain/types';

export type MealEntry = {
  id:       string;
  logDate:  string;
  name:     string;
  kcal:     number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
  loggedAt: string;
};

function toMealEntry(row: {
  id: string; log_date: string; name: string;
  kcal: number; protein_g: number; carbs_g: number; fat_g: number; logged_at: string;
}): MealEntry {
  return {
    id:       row.id,
    logDate:  row.log_date,
    name:     row.name,
    kcal:     Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbsG:   Number(row.carbs_g),
    fatG:     Number(row.fat_g),
    loggedAt: row.logged_at,
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
  return { logDate: data.log_date, calories: data.calories, proteinG: data.protein_g };
}

export async function saveNutritionLog(userId: string, logDate: string, calories: number, proteinG: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_nutrition_logs')
    .upsert({ user_id: userId, log_date: logDate, calories, protein_g: proteinG }, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}

export async function listMealEntries(userId: string, logDate: string): Promise<MealEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_entries')
    .select('id, log_date, name, kcal, protein_g, carbs_g, fat_g, logged_at')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toMealEntry);
}

export async function addMealEntry(
  userId:  string,
  logDate: string,
  entry:   { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number },
): Promise<MealEntry> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_entries')
    .insert({
      user_id:   userId,
      log_date:  logDate,
      name:      entry.name,
      kcal:      entry.kcal,
      protein_g: entry.proteinG,
      carbs_g:   entry.carbsG,
      fat_g:     entry.fatG,
    })
    .select('id, log_date, name, kcal, protein_g, carbs_g, fat_g, logged_at')
    .single();
  if (error) throw error;
  return toMealEntry(data);
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
export async function listRecentUniqueMeals(userId: string, limit = 6): Promise<MealEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_meal_entries')
    .select('id, log_date, name, kcal, protein_g, carbs_g, fat_g, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(60); // fetch more, then dedupe client-side
  if (error) throw error;
  const seen = new Set<string>();
  const unique: MealEntry[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.name)) {
      seen.add(row.name);
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
