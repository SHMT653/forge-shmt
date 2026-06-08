import { getSupabaseClient } from '@/services/supabase/client';
import type { NutritionLog } from '@/domain/types';

export async function getNutritionLog(userId: string, logDate: string): Promise<NutritionLog> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_logs')
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
    .from('nutrition_logs')
    .upsert({ user_id: userId, log_date: logDate, calories, protein_g: proteinG }, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}
