/**
 * Day statistics with context.
 *
 * A bare "6.420 Schritte" says little. The same number is a good day for
 * someone averaging 5.000 and a slow one for someone averaging 9.000, so every
 * figure here carries its target and its comparison to the user's own recent
 * average.
 */

import { evaluateGoal, evaluateRange, type ResolvedTargets, type Tone } from './goalPhase';
import { formatHours, formatLiters } from './coach';
import { formatDistance } from './health';
import type { Macros } from './types';

export type StatKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'steps' | 'water' | 'sleep' | 'activeEnergy' | 'distance';

export type DayStat = {
  key: StatKey;
  label: string;
  /** Formatted for display, unit included. */
  value: string;
  /** Formatted target, or null where there is none. */
  target: string | null;
  tone: Tone;
  /** 0–1 progress against the target, clamped. Null when no target applies. */
  fraction: number | null;
  /**
   * Percent difference from the user's recent average. Null when there is not
   * enough history to compare against honestly.
   */
  vsAverage: number | null;
};

export type DayStatsInput = {
  totals: Macros;
  metrics: { steps: number; waterMl: number; sleepH: number; activeEnergyKcal: number; walkingDistanceM: number };
  targets: ResolvedTargets;
  weekly: { avgKcal: number | null; avgProtein: number | null; avgSteps: number | null; avgSleep: number | null; daysWithData: number };
  dayInProgress: boolean;
};

/** A comparison needs enough days behind it to mean anything. */
const MIN_DAYS_FOR_AVERAGE = 3;

function percentDelta(value: number, average: number | null, daysWithData: number): number | null {
  if (average === null || average <= 0 || daysWithData < MIN_DAYS_FOR_AVERAGE) return null;
  return Math.round(((value - average) / average) * 100);
}

export function buildDayStats(input: DayStatsInput): DayStat[] {
  const { totals, metrics, targets, weekly, dayInProgress } = input;
  const stats: DayStat[] = [];

  const calories = evaluateRange(totals.kcal, targets.calories, { dayInProgress });
  stats.push({
    key: 'calories',
    label: 'Kalorien',
    value: `${Math.round(totals.kcal).toLocaleString('de-DE')} kcal`,
    target: `${targets.calories.min.toLocaleString('de-DE')}–${targets.calories.max.toLocaleString('de-DE')}`,
    tone: totals.kcal <= 0 ? 'neutral' : calories.tone,
    fraction: calories.fraction,
    vsAverage: percentDelta(totals.kcal, weekly.avgKcal, weekly.daysWithData),
  });

  // Above the protein range is a good outcome, never an overshoot.
  const proteinHit = totals.proteinG >= targets.protein.min;
  stats.push({
    key: 'protein',
    label: 'Protein',
    value: `${Math.round(totals.proteinG)} g`,
    target: `${targets.protein.min}–${targets.protein.max} g`,
    tone: totals.proteinG <= 0 ? 'neutral' : proteinHit ? 'green' : dayInProgress ? 'green' : 'yellow',
    fraction: Math.min(1, totals.proteinG / Math.max(1, targets.protein.min)),
    vsAverage: percentDelta(totals.proteinG, weekly.avgProtein, weekly.daysWithData),
  });

  // Carbs and fat have no target of their own — protein and total calories are
  // what the phase is steered by (§15). They are shown for completeness.
  stats.push({
    key: 'carbs',
    label: 'Kohlenhydrate',
    value: `${Math.round(totals.carbsG)} g`,
    target: null,
    tone: 'neutral',
    fraction: null,
    vsAverage: null,
  });
  stats.push({
    key: 'fat',
    label: 'Fett',
    value: `${Math.round(totals.fatG)} g`,
    target: null,
    tone: 'neutral',
    fraction: null,
    vsAverage: null,
  });

  const steps = evaluateGoal(metrics.steps, targets.steps, dayInProgress);
  stats.push({
    key: 'steps',
    label: 'Schritte',
    value: Math.round(metrics.steps).toLocaleString('de-DE'),
    target: targets.steps.toLocaleString('de-DE'),
    tone: steps.tone,
    fraction: steps.fraction,
    vsAverage: percentDelta(metrics.steps, weekly.avgSteps, weekly.daysWithData),
  });

  const water = evaluateGoal(metrics.waterMl, targets.waterMl, dayInProgress);
  stats.push({
    key: 'water',
    label: 'Wasser',
    value: formatLiters(metrics.waterMl),
    target: formatLiters(targets.waterMl),
    tone: water.tone,
    fraction: water.fraction,
    vsAverage: null,
  });

  const sleep = evaluateGoal(metrics.sleepH, targets.sleepH, false);
  stats.push({
    key: 'sleep',
    label: 'Schlaf',
    value: metrics.sleepH > 0 ? formatHours(metrics.sleepH) : '–',
    target: formatHours(targets.sleepH),
    tone: metrics.sleepH > 0 ? sleep.tone : 'neutral',
    fraction: sleep.fraction,
    vsAverage: percentDelta(metrics.sleepH, weekly.avgSleep, weekly.daysWithData),
  });

  // Only present when a health platform actually supplied them.
  if (metrics.activeEnergyKcal > 0) {
    stats.push({
      key: 'activeEnergy',
      label: 'Aktive Energie',
      value: `${Math.round(metrics.activeEnergyKcal).toLocaleString('de-DE')} kcal`,
      target: null,
      tone: 'green',
      fraction: null,
      vsAverage: null,
    });
  }
  if (metrics.walkingDistanceM > 0) {
    stats.push({
      key: 'distance',
      label: 'Distanz',
      value: formatDistance(metrics.walkingDistanceM),
      target: null,
      tone: 'green',
      fraction: null,
      vsAverage: null,
    });
  }

  return stats;
}

/** Share of calories from each macro, for the split bar. */
export function macroSplit(totals: Macros): { protein: number; carbs: number; fat: number } | null {
  const kcalFromMacros = totals.proteinG * 4 + totals.carbsG * 4 + totals.fatG * 9;
  if (kcalFromMacros <= 0) return null;
  return {
    protein: Math.round(((totals.proteinG * 4) / kcalFromMacros) * 100),
    carbs: Math.round(((totals.carbsG * 4) / kcalFromMacros) * 100),
    fat: Math.round(((totals.fatG * 9) / kcalFromMacros) * 100),
  };
}

/** "+12 % über deinem Schnitt" / "wie sonst" — never a bare number. */
export function describeDelta(delta: number | null): string | null {
  if (delta === null) return null;
  if (Math.abs(delta) < 8) return 'wie sonst';
  return delta > 0 ? `+${delta} % über Schnitt` : `${delta} % unter Schnitt`;
}
