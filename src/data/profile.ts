import { getSupabaseClient } from '@/services/supabase/client';
import type { Profile, UserGoals } from '@/domain/types';

export async function ensureProfile(userId: string, displayName: string): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_profiles')
    .upsert({ id: userId, display_name: displayName }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id, display_name')
    .single();

  if (error) throw error;
  return { id: data.id, displayName: data.display_name };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { id: data.id, displayName: data.display_name };
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_profiles').update({ display_name: displayName }).eq('id', userId);
  if (error) throw error;
}

export async function getUserGoals(userId: string): Promise<UserGoals> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_user_goals')
    .select('calorie_goal, protein_goal, weight_goal')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { calorieGoal: 2200, proteinGoal: 150, weightGoal: null };
  return {
    calorieGoal: data.calorie_goal,
    proteinGoal: data.protein_goal,
    weightGoal: data.weight_goal,
  };
}

export async function saveUserGoals(userId: string, goals: UserGoals): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_user_goals').upsert(
    {
      user_id: userId,
      calorie_goal: goals.calorieGoal,
      protein_goal: goals.proteinGoal,
      weight_goal: goals.weightGoal,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
