import { getSupabaseClient } from '@/services/supabase/client';
import { emptyDailyHealth, type DailyHealth, type MetricSource } from '@/domain/health';
import type { Habit, HabitLog } from '@/domain/types';

/**
 * The single place that answers "how many steps today?".
 *
 * Steps and sleep can arrive from two places — Apple Health or the user's own
 * thumb — and water only ever from the user. Resolving them here means no
 * screen ever adds an automatic value to a manual one, which is precisely the
 * 7.350 + 5.000 = 12.350 failure the spec warns about (§43).
 */
export type DayMetrics = {
  date: string;
  steps: number;
  waterMl: number;
  sleepH: number;
  activeEnergyKcal: number;
  walkingDistanceM: number;
  sources: { steps: MetricSource; sleep: MetricSource };
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

function emptyMetrics(date: string): DayMetrics {
  return {
    date,
    steps: 0,
    waterMl: 0,
    sleepH: 0,
    activeEnergyKcal: 0,
    walkingDistanceM: 0,
    sources: { steps: 'manual', sleep: 'manual' },
  };
}

/**
 * Folds habit logs into one row per day. Water lives here permanently; steps
 * and sleep only as the fallback for days recorded before health sync existed.
 */
export function buildDayMetrics(habits: readonly Habit[], logs: readonly HabitLog[]): Map<string, DayMetrics> {
  const { steps, water, sleep } = pickMetricHabits(habits);
  const byDate = new Map<string, DayMetrics>();

  for (const log of logs) {
    const entry = byDate.get(log.logDate) ?? emptyMetrics(log.logDate);
    if (steps && log.habitId === steps.id) entry.steps = log.value;
    if (water && log.habitId === water.id) entry.waterMl = log.value;
    if (sleep && log.habitId === sleep.id) entry.sleepH = log.value;
    byDate.set(log.logDate, entry);
  }

  return byDate;
}

/**
 * Overlays health-sourced values on top of the habit-derived ones.
 *
 * `forge_daily_health` is authoritative wherever it has a value — including
 * when that value was typed in by hand, because a manual entry there is a
 * deliberate override of whatever the platform reported.
 */
export function mergeHealth(
  habitMetrics: Map<string, DayMetrics>,
  health: readonly DailyHealth[],
): Map<string, DayMetrics> {
  const merged = new Map(habitMetrics);

  for (const day of health) {
    const base = merged.get(day.date) ?? emptyMetrics(day.date);
    merged.set(day.date, {
      ...base,
      // Replace, never add.
      steps: day.steps ?? base.steps,
      sleepH: day.sleepMinutes !== null ? day.sleepMinutes / 60 : base.sleepH,
      activeEnergyKcal: day.activeEnergyKcal ?? base.activeEnergyKcal,
      walkingDistanceM: day.walkingDistanceM ?? base.walkingDistanceM,
      sources: {
        steps: day.steps !== null ? day.sources.steps : base.sources.steps,
        sleep: day.sleepMinutes !== null ? day.sources.sleep : base.sources.sleep,
      },
    });
  }

  return merged;
}

export function metricsForDate(map: Map<string, DayMetrics>, date: string): DayMetrics {
  return map.get(date) ?? emptyMetrics(date);
}

/**
 * Writes a habit-backed metric (water, and the boolean habits).
 * Steps and sleep go through `setHealthMetric` instead, so their source is
 * recorded.
 */
export async function setDayMetric(userId: string, habit: Habit, logDate: string, value: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_habit_logs').upsert(
    { user_id: userId, habit_id: habit.id, log_date: logDate, value, completed: value >= habit.target },
    { onConflict: 'habit_id,log_date' },
  );
  if (error) throw error;
}

export { emptyDailyHealth };
