import { getSupabaseClient } from '@/services/supabase/client';
import type { ActivityLevel, Gender, GoalType, Profile, UserGoals } from '@/domain/types';

export async function ensureProfile(userId: string, displayName: string): Promise<Profile> {
  const supabase = getSupabaseClient();

  // Try to load existing profile first — avoids overwriting user's custom name
  const { data: existing } = await supabase
    .from('forge_profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return { id: existing.id, displayName: existing.display_name };

  // First-time: insert
  const { data, error } = await supabase
    .from('forge_profiles')
    .insert({ id: userId, display_name: displayName })
    .select('id, display_name')
    .single();

  if (error) throw error;
  return { id: data.id, displayName: data.display_name };
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_profiles').update({ display_name: displayName }).eq('id', userId);
  if (error) throw error;
}

const GOALS_DEFAULTS: UserGoals = {
  calorieGoal: 2200,
  proteinGoal: 150,
  weightGoal: null,
  currentWeight: null,
  heightCm: null,
  birthYear: null,
  gender: 'other',
  activityLevel: 'moderate',
  goalType: 'maintain',
};

export async function getUserGoals(userId: string): Promise<UserGoals> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_user_goals')
    .select('calorie_goal, protein_goal, weight_goal, current_weight, height_cm, birth_year, gender, activity_level, goal_type')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return GOALS_DEFAULTS;
  return {
    calorieGoal: data.calorie_goal,
    proteinGoal: data.protein_goal,
    weightGoal: data.weight_goal,
    currentWeight: data.current_weight,
    heightCm: data.height_cm,
    birthYear: data.birth_year,
    gender: (data.gender ?? 'other') as Gender,
    activityLevel: (data.activity_level ?? 'moderate') as ActivityLevel,
    goalType: (data.goal_type ?? 'maintain') as GoalType,
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
      current_weight: goals.currentWeight,
      height_cm: goals.heightCm,
      birth_year: goals.birthYear,
      gender: goals.gender,
      activity_level: goals.activityLevel,
      goal_type: goals.goalType,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
