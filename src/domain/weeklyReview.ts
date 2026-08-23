/**
 * Weekly review.
 *
 * The week — not the day — is the unit FORGE judges progress on (§32/§58).
 * A single 2.800-kcal Tuesday is noise; seven days of data is a signal.
 */

import { dateKeyAddDays } from './dates';
import { evaluateRange, type ResolvedTargets } from './goalPhase';
import type { ExerciseSnapshot } from './progression';
import { computeTrend } from './progression';
import type { WeightSummary } from './weightTrend';
import { formatSignedKg } from './dayEvaluation';

export type WeekBounds = { start: string; end: string; label: string };

/** Monday-based week containing `dateKey`. */
export function weekBoundsFor(dateKey: string): WeekBounds {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  const dow = date.getDay(); // 0 = Sunday
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const start = dateKeyAddDays(dateKey, offsetToMonday);
  const end = dateKeyAddDays(start, 6);
  return { start, end, label: formatWeekLabel(start, end) };
}

function formatWeekLabel(start: string, end: string): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function eachDayOfWeek(bounds: WeekBounds): string[] {
  return Array.from({ length: 7 }, (_, i) => dateKeyAddDays(bounds.start, i));
}

export type WeeklyInput = {
  bounds: WeekBounds;
  targets: ResolvedTargets;
  /** One entry per day that has nutrition data. */
  days: { date: string; kcal: number; proteinG: number; steps: number; waterMl: number; sleepH: number; hasNutrition: boolean }[];
  fullWorkouts: number;
  miniSessions: number;
  weight: WeightSummary;
  /** Exercise histories, for the progression highlight. */
  exerciseHistories: { name: string; snapshots: ExerciseSnapshot[] }[];
};

export type WeeklyReview = {
  bounds: WeekBounds;
  avgKcal: number | null;
  avgProtein: number | null;
  avgSteps: number | null;
  avgSleep: number | null;
  daysLogged: number;
  daysInCalorieRange: number;
  daysProteinHit: number;
  fullWorkouts: number;
  miniSessions: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightDelta: number | null;
  /** Best progression story of the week, if there is one. */
  highlight: { name: string; summary: string; percent: number | null } | null;
  summaryText: string;
};

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function buildWeeklyReview(input: WeeklyInput): WeeklyReview {
  const { bounds, targets, days } = input;
  const logged = days.filter((d) => d.hasNutrition);

  const avgKcal = average(logged.map((d) => d.kcal));
  const avgProtein = average(logged.map((d) => d.proteinG));
  const stepsDays = days.filter((d) => d.steps > 0);
  const avgSteps = average(stepsDays.map((d) => d.steps));
  const sleepDays = days.filter((d) => d.sleepH > 0);
  const avgSleep = average(sleepDays.map((d) => d.sleepH));

  const daysInCalorieRange = logged.filter(
    (d) => evaluateRange(d.kcal, targets.calories, { dayInProgress: false }).status === 'in',
  ).length;
  const daysProteinHit = logged.filter((d) => d.proteinG >= targets.protein.min).length;

  // Weight at each end of the week, taken from the trend line.
  const pointIn = (date: string) => input.weight.points.find((p) => p.date === date)?.trend ?? null;
  const weightStart = pointIn(bounds.start) ?? input.weight.points.find((p) => p.date >= bounds.start)?.trend ?? null;
  const weightEnd =
    pointIn(bounds.end) ?? [...input.weight.points].reverse().find((p) => p.date <= bounds.end)?.trend ?? null;
  const weightDelta =
    weightStart !== null && weightEnd !== null ? Math.round((weightEnd - weightStart) * 100) / 100 : null;

  // Best progression across all tracked exercises.
  let highlight: WeeklyReview['highlight'] = null;
  for (const { name, snapshots } of input.exerciseHistories) {
    const trend = computeTrend(snapshots);
    if (!trend || trend.direction !== 'up') continue;
    if (!highlight || (trend.percent ?? 0) > (highlight.percent ?? 0)) {
      highlight = { name, summary: trend.summary, percent: trend.percent };
    }
  }

  return {
    bounds,
    avgKcal,
    avgProtein,
    avgSteps,
    avgSleep,
    daysLogged: logged.length,
    daysInCalorieRange,
    daysProteinHit,
    fullWorkouts: input.fullWorkouts,
    miniSessions: input.miniSessions,
    weightStart,
    weightEnd,
    weightDelta,
    highlight,
    summaryText: buildWeeklyCoachText({
      targets,
      avgKcal,
      avgProtein,
      daysLogged: logged.length,
      fullWorkouts: input.fullWorkouts,
      miniSessions: input.miniSessions,
      weightDelta,
      highlight,
    }),
  };
}

function buildWeeklyCoachText(input: {
  targets: ResolvedTargets;
  avgKcal: number | null;
  avgProtein: number | null;
  daysLogged: number;
  fullWorkouts: number;
  miniSessions: number;
  weightDelta: number | null;
  highlight: WeeklyReview['highlight'];
}): string {
  const { targets, avgKcal, avgProtein, daysLogged, fullWorkouts, weightDelta, highlight } = input;

  if (daysLogged < 3) {
    return 'Diese Woche gibt es zu wenig Daten für eine belastbare Auswertung. Trag an möglichst vielen Tagen wenigstens grob ein, was du isst — dann wird der Wochenbericht aussagekräftig.';
  }

  const parts: string[] = [];

  // Weight × strength — the recomp question (§45/§46).
  const strengthUp = highlight !== null;
  const expected = targets.phase.weeklyWeightChangeKg;
  const weightInBand = weightDelta !== null && weightDelta >= expected.min && weightDelta <= expected.max;

  if (weightDelta !== null && strengthUp && (weightInBand || weightDelta <= 0)) {
    parts.push('Gewicht und Trainingsleistung entwickeln sich gleichzeitig positiv — genau das ist das Ziel.');
  } else if (weightDelta !== null && weightInBand) {
    parts.push(`Der Gewichtstrend liegt mit ${formatSignedKg(weightDelta)} im erwarteten Bereich für ${targets.phase.label}.`);
  } else if (weightDelta !== null && weightDelta < expected.min) {
    parts.push(`Mit ${formatSignedKg(weightDelta)} ging es schneller runter als geplant. Etwas mehr Kalorien schützen hier die Muskulatur.`);
  } else if (strengthUp) {
    parts.push('Deine Trainingsleistung ist gestiegen — das ist der wichtigere Indikator, auch wenn das Gewicht steht.');
  }

  // Calories: only comment when the weekly average says something.
  if (avgKcal !== null) {
    const evalKcal = evaluateRange(avgKcal, targets.calories, { dayInProgress: false });
    if (evalKcal.status === 'in') {
      parts.push('Die Kalorien musst du aktuell nicht weiter anpassen.');
    } else if (evalKcal.status === 'over' || evalKcal.status === 'slightly_over') {
      parts.push(`Im Schnitt lagst du ${Math.round(evalKcal.deviation).toLocaleString('de-DE')} kcal über deinem Bereich — kleine Korrekturen reichen.`);
    } else if (evalKcal.status === 'far_under') {
      parts.push('Im Schnitt lagst du deutlich unter deinem Bereich. Das bremst Regeneration und Leistung mehr, als es beim Abnehmen hilft.');
    }
  }

  if (avgProtein !== null && avgProtein < targets.protein.min) {
    parts.push(`Protein ist der klarste Hebel: Ø ${Math.round(avgProtein)} g gegenüber ${targets.protein.min} g Ziel.`);
  }

  if (fullWorkouts === 0 && input.miniSessions === 0) {
    parts.push('Diese Woche kam kein Training zustande. Eine kurze Einheit ist deutlich besser als keine — plan sie fest ein.');
  }

  return parts.length > 0 ? parts.join(' ') : 'Solide Woche ohne Auffälligkeiten. Weiter so.';
}
