/**
 * Per-day traffic light for the calendar.
 *
 * Deliberately separate from `scoreDay` in coach.ts: that one needs a full
 * CoachContext to write a sentence about today, which is far too much to
 * assemble for thirty days at once. This works from the cached daily
 * aggregates — one row per day per table — so a whole month costs three
 * queries.
 *
 * The other difference is fairness. A day is judged only on what the user
 * actually tracks. Someone who never logs water must not see a month of
 * orange because of it (§43 — no punishment mechanics).
 */

import { evaluateRange, evaluateGoal, type ResolvedTargets, type Tone } from './goalPhase';

export type DayAggregate = {
  date: string;
  /** null = nothing recorded for that metric on that day. */
  kcal: number | null;
  proteinG: number | null;
  steps: number | null;
  sleepH: number | null;
  trained: boolean;
  miniSession: boolean;
};

export type DayRating = {
  date: string;
  tone: Tone;
  /** 0–10, or null when the day holds no data at all. */
  score: number | null;
  /** Short German phrases for the day detail, most important first. */
  notes: string[];
  hasData: boolean;
};

type Component = { weight: number; factor: number; note: string | null };

/**
 * Rates one day against the user's targets.
 *
 * A missing metric contributes nothing — neither credit nor penalty — so the
 * score always reflects the part of the day that was actually tracked.
 */
export function rateDay(day: DayAggregate, targets: ResolvedTargets): DayRating {
  const components: Component[] = [];

  if (day.kcal !== null && day.kcal > 0) {
    const result = evaluateRange(day.kcal, targets.calories, { dayInProgress: false });
    components.push({
      weight: 2.5,
      factor: toneFactor(result.tone),
      note:
        result.status === 'in' ? null
        : result.status === 'over' ? 'deutlich über dem Kalorienbereich'
        : result.status === 'slightly_over' ? 'leicht über dem Kalorienbereich'
        : result.status === 'far_under' ? 'deutlich unter dem Kalorienbereich'
        : null,
    });
  }

  if (day.proteinG !== null && day.proteinG > 0) {
    // Above the range is a good outcome, never an overshoot to flag.
    const hit = day.proteinG >= targets.protein.min;
    components.push({
      weight: 2.5,
      factor: hit ? 1 : day.proteinG >= targets.protein.min * 0.8 ? 0.6 : 0.3,
      note: hit ? null : `Protein ${Math.round(day.proteinG)} g von ${targets.protein.min} g`,
    });
  }

  if (day.steps !== null && day.steps > 0) {
    const result = evaluateGoal(day.steps, targets.steps, false);
    components.push({
      weight: 1.5,
      factor: toneFactor(result.tone),
      note: result.tone === 'green' ? null : `${Math.round(day.steps).toLocaleString('de-DE')} Schritte`,
    });
  }

  if (day.sleepH !== null && day.sleepH > 0) {
    const result = evaluateGoal(day.sleepH, targets.sleepH, false);
    components.push({
      weight: 1,
      factor: toneFactor(result.tone),
      note: result.tone === 'green' ? null : `${formatHoursShort(day.sleepH)} Schlaf`,
    });
  }

  // Training only counts on days it happened. Rest days are not failures —
  // the weekly target is what judges training frequency, not each square.
  if (day.trained || day.miniSession) {
    components.push({
      weight: 2,
      factor: day.trained ? 1 : 0.7,
      note: day.trained ? 'trainiert' : 'Mini-Session',
    });
  }

  if (components.length === 0) {
    return { date: day.date, tone: 'neutral', score: null, notes: [], hasData: false };
  }

  const possible = components.reduce((sum, c) => sum + c.weight, 0);
  const earned = components.reduce((sum, c) => sum + c.weight * c.factor, 0);
  const score = Math.round((earned / possible) * 100) / 10;

  return {
    date: day.date,
    tone: score >= 7.5 ? 'green' : score >= 5 ? 'yellow' : 'red',
    score,
    notes: components.map((c) => c.note).filter((note): note is string => note !== null),
    hasData: true,
  };
}

function toneFactor(tone: Tone): number {
  if (tone === 'green') return 1;
  if (tone === 'yellow') return 0.6;
  if (tone === 'red') return 0.25;
  return 0.5;
}

function formatHoursShort(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes === 0 ? `${whole} h` : `${whole}:${String(minutes).padStart(2, '0')} h`;
}

/** Rolling summary for the calendar header — the week is the unit (§32). */
export function summarizeRatings(ratings: readonly DayRating[]): {
  tracked: number;
  green: number;
  yellow: number;
  red: number;
  trainingDays: number;
  averageScore: number | null;
} {
  const tracked = ratings.filter((r) => r.hasData);
  const scores = tracked.map((r) => r.score).filter((s): s is number => s !== null);

  return {
    tracked: tracked.length,
    green: tracked.filter((r) => r.tone === 'green').length,
    yellow: tracked.filter((r) => r.tone === 'yellow').length,
    red: tracked.filter((r) => r.tone === 'red').length,
    trainingDays: ratings.filter((r) => r.notes.includes('trainiert')).length,
    averageScore: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
  };
}
