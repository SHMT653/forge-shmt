import { getSupabaseClient } from '@/services/supabase/client';
import { isPhaseType, type PhaseType } from '@/domain/goalPhase';
import type { GoalPhaseRecord } from '@/domain/types';

const COLUMNS =
  'id, phase_type, label, start_date, end_date, calories_min, calories_max, protein_min, protein_max, ' +
  'steps_goal, water_goal_ml, sleep_goal_h, weekly_training_goal, weight_goal, weekly_weight_change_kg';

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toRecord(row: Record<string, unknown>): GoalPhaseRecord {
  const type = row.phase_type;
  return {
    id: row.id as string,
    phaseType: (isPhaseType(type as string) ? type : 'maintain') as PhaseType,
    label: (row.label as string) ?? '',
    startDate: row.start_date as string,
    endDate: (row.end_date as string | null) ?? null,
    caloriesMin: num(row.calories_min),
    caloriesMax: num(row.calories_max),
    proteinMin: num(row.protein_min),
    proteinMax: num(row.protein_max),
    stepsGoal: num(row.steps_goal),
    waterGoalMl: num(row.water_goal_ml),
    sleepGoalH: num(row.sleep_goal_h),
    weeklyTrainingGoal: num(row.weekly_training_goal),
    weightGoal: num(row.weight_goal),
    weeklyWeightChangeKg: num(row.weekly_weight_change_kg),
  };
}

/** Newest first. The active phase, if any, is the one with `endDate === null`. */
export async function listGoalPhases(userId: string): Promise<GoalPhaseRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_goal_phases')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toRecord(row as unknown as Record<string, unknown>));
}

export async function getActivePhase(userId: string): Promise<GoalPhaseRecord | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_goal_phases')
    .select(COLUMNS)
    .eq('user_id', userId)
    .is('end_date', null)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data as unknown as Record<string, unknown>) : null;
}

export type GoalPhaseInput = Omit<GoalPhaseRecord, 'id' | 'endDate'>;

/**
 * Starts a new phase and closes the previous one the day before.
 *
 * Closing rather than overwriting is what makes the history answerable later:
 * "während deines Cuts hast du 2,3 kg verloren" needs a real date range (§29).
 */
export async function startPhase(userId: string, input: GoalPhaseInput): Promise<void> {
  const supabase = getSupabaseClient();
  const active = await getActivePhase(userId);

  if (active) {
    // End the day before the new one begins, so ranges never overlap.
    const previousEnd = endOfPreviousDay(input.startDate);
    const closeDate = previousEnd < active.startDate ? active.startDate : previousEnd;
    const { error: closeError } = await supabase
      .from('forge_goal_phases')
      .update({ end_date: closeDate })
      .eq('id', active.id)
      .eq('user_id', userId);
    if (closeError) throw closeError;
  }

  const { error } = await supabase.from('forge_goal_phases').insert({
    user_id: userId,
    phase_type: input.phaseType,
    label: input.label,
    start_date: input.startDate,
    calories_min: input.caloriesMin,
    calories_max: input.caloriesMax,
    protein_min: input.proteinMin,
    protein_max: input.proteinMax,
    steps_goal: input.stepsGoal,
    water_goal_ml: input.waterGoalMl,
    sleep_goal_h: input.sleepGoalH,
    weekly_training_goal: input.weeklyTrainingGoal,
    weight_goal: input.weightGoal,
    weekly_weight_change_kg: input.weeklyWeightChangeKg,
  });
  if (error) throw error;
}

/** Edits the currently running phase without creating a history entry. */
export async function updateActivePhase(userId: string, patch: Partial<GoalPhaseInput>): Promise<void> {
  const active = await getActivePhase(userId);
  if (!active) return;

  const supabase = getSupabaseClient();
  const row: Record<string, unknown> = {};
  if (patch.phaseType !== undefined) row.phase_type = patch.phaseType;
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.caloriesMin !== undefined) row.calories_min = patch.caloriesMin;
  if (patch.caloriesMax !== undefined) row.calories_max = patch.caloriesMax;
  if (patch.proteinMin !== undefined) row.protein_min = patch.proteinMin;
  if (patch.proteinMax !== undefined) row.protein_max = patch.proteinMax;
  if (patch.stepsGoal !== undefined) row.steps_goal = patch.stepsGoal;
  if (patch.waterGoalMl !== undefined) row.water_goal_ml = patch.waterGoalMl;
  if (patch.sleepGoalH !== undefined) row.sleep_goal_h = patch.sleepGoalH;
  if (patch.weeklyTrainingGoal !== undefined) row.weekly_training_goal = patch.weeklyTrainingGoal;
  if (patch.weightGoal !== undefined) row.weight_goal = patch.weightGoal;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('forge_goal_phases').update(row).eq('id', active.id).eq('user_id', userId);
  if (error) throw error;
}

function endOfPreviousDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() - 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
