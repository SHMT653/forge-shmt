import { getSupabaseClient } from '@/services/supabase/client';
import { getUserGoals } from '@/data/profile';
import { DEFAULT_HABITS } from '@/domain/defaultHabits';
import { computeHabitTargets } from '@/domain/habitTargets';
import type { Habit, HabitLog } from '@/domain/types';

function toHabit(row: { id: string; key: string; label: string; unit: string; target: number; order_index: number; active: boolean }): Habit {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    unit: row.unit,
    target: Number(row.target),
    orderIndex: row.order_index,
    active: row.active,
  };
}

export async function listHabits(userId: string): Promise<Habit[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_habits')
    .select('id, key, label, unit, target, order_index, active')
    .eq('user_id', userId)
    .eq('active', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toHabit);
}

/** Seeds the default habit set and syncs targets to the user's current profile. */
export async function ensureDefaultHabits(userId: string): Promise<Habit[]> {
  // Load profile and compute personalized targets in parallel with habit list
  const [existing, goals] = await Promise.all([listHabits(userId), getUserGoals(userId)]);
  const computed = computeHabitTargets(goals);

  // Map of habit key → desired target (personalized where applicable)
  const targetByKey: Record<string, number> = {
    water:    computed.water,
    steps:    computed.steps,
    sleep:    computed.sleep,
    kreatin:  1,
    protein:  1,
    training: 1,
  };

  const supabase = getSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  if (existing.length === 0) {
    // First-time user: seed all defaults with personalized targets
    const { data, error } = await supabase
      .from('forge_habits')
      .insert(
        DEFAULT_HABITS.map((habit, index) => ({
          user_id:     userId,
          key:         habit.key,
          label:       habit.label,
          unit:        habit.unit,
          target:      targetByKey[habit.key] ?? habit.target,
          order_index: index,
        })),
      )
      .select('id, key, label, unit, target, order_index, active');
    if (error) throw error;
    return (data ?? []).map(toHabit);
  }

  // Existing user: ensure pinned habits are present
  const existingKeys = new Set(existing.map((h) => h.key));
  const missing = DEFAULT_HABITS.filter((d) => d.pinned && !existingKeys.has(d.key));
  let updated = existing;

  if (missing.length > 0) {
    const maxOrder = Math.max(...existing.map((h) => h.orderIndex), existing.length - 1);
    const { data, error } = await supabase
      .from('forge_habits')
      .insert(
        missing.map((habit, i) => ({
          user_id:     userId,
          key:         habit.key,
          label:       habit.label,
          unit:        habit.unit,
          target:      targetByKey[habit.key] ?? habit.target,
          order_index: maxOrder + 1 + i,
        })),
      )
      .select('id, key, label, unit, target, order_index, active');
    if (error) throw error;
    updated = [...existing, ...(data ?? []).map(toHabit)];
  }

  // Sync targets: update any habit whose stored target differs from the computed value
  const syncPromises: Promise<unknown>[] = [];
  for (const habit of updated) {
    const desired = targetByKey[habit.key];
    if (desired !== undefined && habit.target !== desired) {
      const oldTarget = habit.target;
      syncPromises.push(
        Promise.resolve(supabase.from('forge_habits').update({ target: desired }).eq('id', habit.id)),
      );
      // Reset today's log only if it was set to the old (wrong) target by legacy binary toggle
      if (oldTarget > 0 && oldTarget < 250) {
        syncPromises.push(
          Promise.resolve(
            supabase
              .from('forge_habit_logs')
              .update({ value: 0, completed: false })
              .eq('habit_id', habit.id)
              .eq('log_date', today)
              .eq('value', oldTarget),
          ),
        );
      }
      habit.target = desired;
    }
  }
  await Promise.all(syncPromises);

  // Water-specific: reset today's log if value < 250 (legacy liter artifact)
  const waterHabit = updated.find((h) => h.key === 'water');
  if (waterHabit) {
    const { data: wlog } = await supabase
      .from('forge_habit_logs')
      .select('value')
      .eq('habit_id', waterHabit.id)
      .eq('user_id', userId)
      .eq('log_date', today)
      .maybeSingle();
    if (wlog && Number(wlog.value) > 0 && Number(wlog.value) < 250) {
      await supabase
        .from('forge_habit_logs')
        .update({ value: 0, completed: false })
        .eq('habit_id', waterHabit.id)
        .eq('log_date', today);
    }
  }

  return updated;
}

export async function listHabitLogsForRange(userId: string, fromDate: string): Promise<HabitLog[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_habit_logs')
    .select('habit_id, log_date, value, completed')
    .eq('user_id', userId)
    .gte('log_date', fromDate);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    habitId:  row.habit_id,
    logDate:  row.log_date,
    value:    Number(row.value),
    completed: row.completed,
  }));
}

export async function setHabitLog(
  userId: string,
  habitId: string,
  logDate: string,
  value: number,
  completed: boolean,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_habit_logs')
    .upsert(
      { user_id: userId, habit_id: habitId, log_date: logDate, value, completed },
      { onConflict: 'habit_id,log_date' },
    );
  if (error) throw error;
}
