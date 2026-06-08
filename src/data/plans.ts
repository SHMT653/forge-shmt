import { getSupabaseClient } from '@/services/supabase/client';
import type { Exercise, PlanDay, TrainingPlan } from '@/domain/types';
import type { PlanTemplate } from '@/domain/planTemplates';

type PlanRow = { id: string; name: string; focus: string; is_active: boolean; created_at: string };
type DayRow = { id: string; plan_id: string; name: string; order_index: number };
type ExerciseRow = {
  id: string;
  plan_day_id: string;
  name: string;
  target_sets: number;
  target_reps: string;
  order_index: number;
};

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    orderIndex: row.order_index,
  };
}

function assemblePlans(plans: PlanRow[], days: DayRow[], exercises: ExerciseRow[]): TrainingPlan[] {
  const exercisesByDay = new Map<string, Exercise[]>();
  for (const row of exercises) {
    const list = exercisesByDay.get(row.plan_day_id) ?? [];
    list.push(toExercise(row));
    exercisesByDay.set(row.plan_day_id, list);
  }

  const daysByPlan = new Map<string, PlanDay[]>();
  for (const row of days) {
    const list = daysByPlan.get(row.plan_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      orderIndex: row.order_index,
      exercises: (exercisesByDay.get(row.id) ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
    });
    daysByPlan.set(row.plan_id, list);
  }

  return plans.map((row) => ({
    id: row.id,
    name: row.name,
    focus: row.focus,
    isActive: row.is_active,
    createdAt: row.created_at,
    days: (daysByPlan.get(row.id) ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
  }));
}

export async function listPlans(userId: string): Promise<TrainingPlan[]> {
  const supabase = getSupabaseClient();

  const { data: plans, error: plansError } = await supabase
    .from('forge_training_plans')
    .select('id, name, focus, is_active, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (plansError) throw plansError;
  if (!plans || plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);

  const { data: days, error: daysError } = await supabase
    .from('forge_plan_days')
    .select('id, plan_id, name, order_index')
    .in('plan_id', planIds);
  if (daysError) throw daysError;

  const dayIds = (days ?? []).map((d) => d.id);
  let exercises: ExerciseRow[] = [];
  if (dayIds.length > 0) {
    const { data, error } = await supabase
      .from('forge_plan_exercises')
      .select('id, plan_day_id, name, target_sets, target_reps, order_index')
      .in('plan_day_id', dayIds);
    if (error) throw error;
    exercises = data ?? [];
  }

  return assemblePlans(plans, days ?? [], exercises);
}

export async function setActivePlan(userId: string, planId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error: clearError } = await supabase
    .from('forge_training_plans')
    .update({ is_active: false })
    .eq('user_id', userId);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from('forge_training_plans')
    .update({ is_active: true })
    .eq('id', planId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deletePlan(planId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_training_plans').delete().eq('id', planId);
  if (error) throw error;
}

async function insertDaysAndExercises(planId: string, days: { name: string; exercises: { name: string; targetSets: number; targetReps: string }[] }[]) {
  const supabase = getSupabaseClient();

  const { data: dayRows, error: dayError } = await supabase
    .from('forge_plan_days')
    .insert(days.map((day, index) => ({ plan_id: planId, name: day.name, order_index: index })))
    .select('id, name');
  if (dayError) throw dayError;

  const exerciseRows = (dayRows ?? []).flatMap((dayRow, dayIndex) =>
    days[dayIndex]!.exercises.map((exercise, exerciseIndex) => ({
      plan_day_id: dayRow.id,
      name: exercise.name,
      target_sets: exercise.targetSets,
      target_reps: exercise.targetReps,
      order_index: exerciseIndex,
    })),
  );

  if (exerciseRows.length > 0) {
    const { error } = await supabase.from('forge_plan_exercises').insert(exerciseRows);
    if (error) throw error;
  }
}

export async function createPlanFromTemplate(userId: string, template: PlanTemplate): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: plan, error } = await supabase
    .from('forge_training_plans')
    .insert({ user_id: userId, name: template.name, focus: template.focus })
    .select('id')
    .single();
  if (error) throw error;

  await insertDaysAndExercises(plan.id, template.days);
  return plan.id;
}

export async function createCustomPlan(
  userId: string,
  name: string,
  focus: string,
  days: { name: string; exercises: { name: string; targetSets: number; targetReps: string }[] }[],
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: plan, error } = await supabase
    .from('forge_training_plans')
    .insert({ user_id: userId, name, focus })
    .select('id')
    .single();
  if (error) throw error;

  if (days.length > 0) await insertDaysAndExercises(plan.id, days);
  return plan.id;
}
