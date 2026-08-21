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

export const GOALS_DEFAULTS: UserGoals = {
  calorieGoal: 2200,
  proteinGoal: 150,
  weightGoal: null,
  currentWeight: null,
  heightCm: null,
  birthYear: null,
  gender: 'other',
  activityLevel: 'moderate',
  goalType: 'maintain',
  programId: null,
  fastingProtocol: null,
  fastingStartHour: null,
  phaseType: null,
  phaseStartDate: null,
  phaseEndDate: null,
  caloriesMin: null,
  caloriesMax: null,
  proteinMin: null,
  proteinMax: null,
  stepsGoal: null,
  waterGoalMl: null,
  sleepGoalH: null,
  weighInWeekday: 0,
  photoIntervalDays: 14,
  fastingEnabled: false,
  aiCoachEnabled: true,
  aiParsingEnabled: true,
  units: 'metric',
};

const GOALS_COLUMNS =
  'calorie_goal, protein_goal, weight_goal, current_weight, height_cm, birth_year, gender, ' +
  'activity_level, goal_type, program_id, fasting_protocol, fasting_start_hour, ' +
  'phase_type, phase_start_date, phase_end_date, calories_min, calories_max, protein_min, protein_max, ' +
  'steps_goal, water_goal_ml, sleep_goal_h, weigh_in_weekday, photo_interval_days, ' +
  'fasting_enabled, ai_coach_enabled, ai_parsing_enabled, units';

/** Postgres `numeric` arrives as a string; `integer` as a number. Normalise both. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getUserGoals(userId: string): Promise<UserGoals> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_user_goals')
    .select(GOALS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle<Record<string, unknown>>();

  if (error) throw error;
  if (!data) return GOALS_DEFAULTS;
  return {
    calorieGoal: num(data.calorie_goal) ?? GOALS_DEFAULTS.calorieGoal,
    proteinGoal: num(data.protein_goal) ?? GOALS_DEFAULTS.proteinGoal,
    weightGoal: num(data.weight_goal),
    currentWeight: num(data.current_weight),
    heightCm: num(data.height_cm),
    birthYear: num(data.birth_year),
    gender: (data.gender ?? 'other') as Gender,
    activityLevel: (data.activity_level ?? 'moderate') as ActivityLevel,
    goalType: (data.goal_type ?? 'maintain') as GoalType,
    programId: (data.program_id ?? null) as UserGoals['programId'],
    fastingProtocol: (data.fasting_protocol ?? null) as UserGoals['fastingProtocol'],
    fastingStartHour: num(data.fasting_start_hour),
    phaseType: (data.phase_type ?? null) as UserGoals['phaseType'],
    phaseStartDate: (data.phase_start_date ?? null) as string | null,
    phaseEndDate: (data.phase_end_date ?? null) as string | null,
    caloriesMin: num(data.calories_min),
    caloriesMax: num(data.calories_max),
    proteinMin: num(data.protein_min),
    proteinMax: num(data.protein_max),
    stepsGoal: num(data.steps_goal),
    waterGoalMl: num(data.water_goal_ml),
    sleepGoalH: num(data.sleep_goal_h),
    weighInWeekday: num(data.weigh_in_weekday) ?? GOALS_DEFAULTS.weighInWeekday,
    photoIntervalDays: num(data.photo_interval_days) ?? GOALS_DEFAULTS.photoIntervalDays,
    fastingEnabled: (data.fasting_enabled as boolean | null) ?? false,
    aiCoachEnabled: (data.ai_coach_enabled as boolean | null) ?? true,
    aiParsingEnabled: (data.ai_parsing_enabled as boolean | null) ?? true,
    units: (data.units === 'imperial' ? 'imperial' : 'metric'),
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
      program_id: goals.programId,
      fasting_protocol: goals.fastingProtocol,
      fasting_start_hour: goals.fastingStartHour,
      phase_type: goals.phaseType,
      phase_start_date: goals.phaseStartDate,
      phase_end_date: goals.phaseEndDate,
      calories_min: goals.caloriesMin,
      calories_max: goals.caloriesMax,
      protein_min: goals.proteinMin,
      protein_max: goals.proteinMax,
      steps_goal: goals.stepsGoal,
      water_goal_ml: goals.waterGoalMl,
      sleep_goal_h: goals.sleepGoalH,
      weigh_in_weekday: goals.weighInWeekday,
      photo_interval_days: goals.photoIntervalDays,
      fasting_enabled: goals.fastingEnabled,
      ai_coach_enabled: goals.aiCoachEnabled,
      ai_parsing_enabled: goals.aiParsingEnabled,
      units: goals.units,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
