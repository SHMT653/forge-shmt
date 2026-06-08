import { getSupabaseClient } from '@/services/supabase/client';
import type { Habit, HabitLog } from '@/domain/types';
import { DEFAULT_HABITS } from '@/domain/defaultHabits';

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

/** Seeds the default habit set for a user the first time they open Habits. */
export async function ensureDefaultHabits(userId: string): Promise<Habit[]> {
  const existing = await listHabits(userId);
  if (existing.length > 0) return existing;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_habits')
    .insert(
      DEFAULT_HABITS.map((habit, index) => ({
        user_id: userId,
        key: habit.key,
        label: habit.label,
        unit: habit.unit,
        target: habit.target,
        order_index: index,
      })),
    )
    .select('id, key, label, unit, target, order_index, active');
  if (error) throw error;
  return (data ?? []).map(toHabit);
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
    habitId: row.habit_id,
    logDate: row.log_date,
    value: Number(row.value),
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
