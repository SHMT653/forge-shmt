import { getSupabaseClient } from '@/services/supabase/client';
import type { Habit, HabitLog } from '@/domain/types';

/**
 * Steps, water and sleep live in the habit tables — they already have per-day
 * logs, history and targets there. Rather than duplicating them into a second
 * table (§51), this module reads them back out under proper names so the rest
 * of the app never has to know they are "habits" underneath.
 */
export type DayMetrics = {
  date: string;
  steps: number;
  waterMl: number;
  sleepH: number;
};

export type MetricHabits = {
  steps: Habit | null;
  water: Habit | null;
  sleep: Habit | null;
};

export function pickMetricHabits(habits: readonly Habit[]): MetricHabits {
  return {
    steps: habits.find((h) => h.key === 'steps') ?? null,
    water: habits.find((h) => h.key === 'water') ?? null,
    sleep: habits.find((h) => h.key === 'sleep') ?? null,
  };
}

/** Folds raw habit logs into one row per day. */
export function buildDayMetrics(habits: readonly Habit[], logs: readonly HabitLog[]): Map<string, DayMetrics> {
  const { steps, water, sleep } = pickMetricHabits(habits);
  const byDate = new Map<string, DayMetrics>();

  for (const log of logs) {
    const entry = byDate.get(log.logDate) ?? { date: log.logDate, steps: 0, waterMl: 0, sleepH: 0 };
    if (steps && log.habitId === steps.id) entry.steps = log.value;
    if (water && log.habitId === water.id) entry.waterMl = log.value;
    if (sleep && log.habitId === sleep.id) entry.sleepH = log.value;
    byDate.set(log.logDate, entry);
  }

  return byDate;
}

export function metricsForDate(map: Map<string, DayMetrics>, date: string): DayMetrics {
  return map.get(date) ?? { date, steps: 0, waterMl: 0, sleepH: 0 };
}

/** Writes one metric for one day, keeping the habit's `completed` flag in step. */
export async function setDayMetric(
  userId: string,
  habit: Habit,
  logDate: string,
  value: number,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_habit_logs').upsert(
    { user_id: userId, habit_id: habit.id, log_date: logDate, value, completed: value >= habit.target },
    { onConflict: 'habit_id,log_date' },
  );
  if (error) throw error;
}
