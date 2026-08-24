import { evaluateGoal, evaluateRange, type ResolvedTargets } from './goalPhase';
import type { DayAggregate } from './dayRating';

/**
 * Statistics over any span of days.
 *
 * This replaced a fixed weekly review that also wrote a paragraph about how the
 * week went. The paragraph is gone: the numbers say it, and a sentence telling
 * someone how their week was is the part nobody asked for. What is left is
 * counted, and the span is the user's choice — a week and a year are different
 * questions and both are worth asking.
 *
 * Averages are taken over days that hold data for that metric, never over the
 * whole span. Ten logged days out of thirty must not read as a third of the
 * usual intake (§43).
 */

export type RangeStats = {
  days: number;
  /** Days with anything at all recorded. */
  trackedDays: number;

  avgKcal: number | null;
  avgProtein: number | null;
  avgSteps: number | null;
  avgSleepH: number | null;
  avgWaterMl: number | null;

  /** Days with nutrition logged, and how many of those landed on target. */
  nutritionDays: number;
  daysInCalorieRange: number;
  daysProteinHit: number;
  daysStepGoalHit: number;

  fullWorkouts: number;
  miniSessions: number;
  trainingDays: number;
  /** Full sessions per seven days, so spans of different length compare. */
  workoutsPerWeek: number | null;

  /** Longest unbroken run of days with anything recorded. */
  longestStreak: number;
};

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(value: number | null, digits = 0): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function summarizeRange(days: readonly DayAggregate[], targets: ResolvedTargets): RangeStats {
  const kcal = days.map((d) => d.kcal).filter((v): v is number => v !== null && v > 0);
  const protein = days.map((d) => d.proteinG).filter((v): v is number => v !== null && v > 0);
  const steps = days.map((d) => d.steps).filter((v): v is number => v !== null && v > 0);
  const sleep = days.map((d) => d.sleepH).filter((v): v is number => v !== null && v > 0);
  const water = days.map((d) => d.waterMl).filter((v): v is number => v !== null && v > 0);

  const hasData = (d: DayAggregate) =>
    (d.kcal ?? 0) > 0 || (d.proteinG ?? 0) > 0 || (d.steps ?? 0) > 0 ||
    (d.sleepH ?? 0) > 0 || (d.waterMl ?? 0) > 0 || d.trained || d.miniSession;

  const tracked = days.filter(hasData);

  let longestStreak = 0;
  let current = 0;
  // Chronological order matters for a streak; the caller may hand any order.
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (hasData(day)) { current += 1; longestStreak = Math.max(longestStreak, current); }
    else current = 0;
  }

  const fullWorkouts = days.filter((d) => d.trained).length;
  const miniSessions = days.filter((d) => d.miniSession).length;

  return {
    days: days.length,
    trackedDays: tracked.length,

    avgKcal: round(mean(kcal)),
    avgProtein: round(mean(protein)),
    avgSteps: round(mean(steps)),
    avgSleepH: round(mean(sleep), 1),
    avgWaterMl: round(mean(water)),

    nutritionDays: kcal.length,
    daysInCalorieRange: kcal.filter(
      (value) => evaluateRange(value, targets.calories, { dayInProgress: false }).status === 'in',
    ).length,
    // Above the protein range is a good outcome, so the minimum is the test.
    daysProteinHit: protein.filter((value) => value >= targets.protein.min).length,
    daysStepGoalHit: steps.filter((value) => evaluateGoal(value, targets.steps, false).tone === 'green').length,

    fullWorkouts,
    miniSessions,
    trainingDays: days.filter((d) => d.trained || d.miniSession).length,
    workoutsPerWeek: days.length > 0 ? round((fullWorkouts / days.length) * 7, 1) : null,

    longestStreak,
  };
}
