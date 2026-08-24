/**
 * Evaluating one day against the user's targets.
 *
 * Everything here is a pure function over data FORGE already holds. It
 * interprets the database; it never invents numbers, and it never states
 * anything it cannot point at a row for (§78).
 *
 * Tone rules, which the copy below follows deliberately:
 *  - a single bad day is never a verdict — the week is the unit that matters (§32)
 *  - eating less than planned is not a win (§16)
 *  - "over your range" is information, not an accusation (§6)
 */

import { evaluateGoal, evaluateRange, type ResolvedTargets, type Tone } from './goalPhase';
import { rateDay } from './dayRating';
import type { WeightSummary } from './weightTrend';
import type { DataQuality, Soreness } from './types';

export type DayContext = {
  today: string;
  /** Empty when the user has not configured a setup yet. */
  equipment?: readonly string[];
  trainingFocus?: readonly string[];
  /** Local hour 0–23, used to decide whether the day is still in progress. */
  hour: number;
  targets: ResolvedTargets;
  nutrition: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    quality: DataQuality;
    entryCount: number;
  };
  metrics: { steps: number; waterMl: number; sleepH: number };
  training: {
    trainedToday: boolean;
    hasActiveSession: boolean;
    lastWorkoutDate: string | null;
    lastWorkoutName: string | null;
    fullWorkoutsThisWeek: number;
    miniSessionsThisWeek: number;
    plannedDayName: string | null;
    weeklyTarget: number;
  };
  soreness: Soreness | null;
  weight: WeightSummary;
  /** Rolling 7-day averages, for putting today in context (§58/§59). */
  weekly: { avgKcal: number | null; avgProtein: number | null; avgSteps: number | null; daysWithData: number };
};

/** The day is "in progress" until late evening — before that, being under target is normal. */
export function isDayInProgress(hour: number): boolean {
  return hour < 21;
}

// ═══════════════════════════════════════════════════════════════════════════
// Day status — the six-dot traffic light (§8)
// ═══════════════════════════════════════════════════════════════════════════

export type StatusKey = 'calories' | 'protein' | 'steps' | 'water' | 'training' | 'sleep';

export type DayStatusItem = {
  key: StatusKey;
  label: string;
  tone: Tone;
  value: string;
  target: string;
  fraction: number;
};

export function buildDayStatus(ctx: DayContext): DayStatusItem[] {
  const inProgress = isDayInProgress(ctx.hour);
  const { targets } = ctx;

  const calories = evaluateRange(ctx.nutrition.kcal, targets.calories, { dayInProgress: inProgress });
  // Protein above the range is a good outcome, not an overshoot to warn about,
  // so anything at or beyond the minimum reads green.
  const proteinRaw = evaluateRange(ctx.nutrition.proteinG, targets.protein, { dayInProgress: inProgress });
  const protein =
    ctx.nutrition.proteinG >= targets.protein.min
      ? { ...proteinRaw, status: 'in' as const, tone: 'green' as const, deviation: 0 }
      : proteinRaw;
  const steps = evaluateGoal(ctx.metrics.steps, targets.steps, inProgress);
  const water = evaluateGoal(ctx.metrics.waterMl, targets.waterMl, inProgress);
  const sleep = evaluateGoal(ctx.metrics.sleepH, targets.sleepH, false);

  const trainedOrPlanned: Tone = ctx.training.trainedToday
    ? 'green'
    : ctx.training.hasActiveSession
      ? 'green'
      : inProgress
        ? 'neutral'
        : ctx.training.fullWorkoutsThisWeek >= ctx.training.weeklyTarget
          ? 'green'
          : 'neutral';

  return [
    {
      key: 'calories',
      label: 'Ernährung',
      tone: ctx.nutrition.entryCount === 0 ? 'neutral' : calories.tone,
      value: `${Math.round(ctx.nutrition.kcal).toLocaleString('de-DE')} kcal`,
      target: `${targets.calories.min.toLocaleString('de-DE')}–${targets.calories.max.toLocaleString('de-DE')}`,
      fraction: calories.fraction,
    },
    {
      key: 'protein',
      label: 'Protein',
      tone: ctx.nutrition.entryCount === 0 ? 'neutral' : protein.tone,
      value: `${Math.round(ctx.nutrition.proteinG)} g`,
      target: `${targets.protein.min}–${targets.protein.max} g`,
      fraction: protein.fraction,
    },
    {
      key: 'steps',
      label: 'Schritte',
      tone: steps.tone,
      value: Math.round(ctx.metrics.steps).toLocaleString('de-DE'),
      target: targets.steps.toLocaleString('de-DE'),
      fraction: steps.fraction,
    },
    {
      key: 'water',
      label: 'Wasser',
      tone: water.tone,
      value: formatLiters(ctx.metrics.waterMl),
      target: formatLiters(targets.waterMl),
      fraction: water.fraction,
    },
    {
      key: 'training',
      label: 'Training',
      tone: trainedOrPlanned,
      value: ctx.training.trainedToday ? 'Erledigt' : ctx.training.hasActiveSession ? 'Läuft' : 'Offen',
      target: `${ctx.training.fullWorkoutsThisWeek}/${ctx.training.weeklyTarget} diese Woche`,
      fraction: ctx.training.trainedToday ? 1 : 0,
    },
    {
      key: 'sleep',
      label: 'Schlaf',
      tone: ctx.metrics.sleepH > 0 ? sleep.tone : 'neutral',
      value: ctx.metrics.sleepH > 0 ? formatHours(ctx.metrics.sleepH) : '–',
      target: formatHours(ctx.targets.sleepH),
      fraction: sleep.fraction,
    },
  ];
}

export function formatLiters(ml: number): string {
  const l = ml / 1000;
  return `${l.toLocaleString('de-DE', { minimumFractionDigits: l % 1 === 0 ? 0 : 1, maximumFractionDigits: 2 })} L`;
}

export function formatHours(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes === 0 ? `${whole} h` : `${whole} h ${minutes} min`;
}

/** "+0,4 kg" / "−1,2 kg" — the sign carries the meaning, so it is explicit. */
export function formatSignedKg(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${Math.abs(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Day close (§31)
// ═══════════════════════════════════════════════════════════════════════════

export type DayScore = {
  /** 0–10, one decimal. */
  score: number;
  summary: string;
  items: DayStatusItem[];
};

/**
 * Scores the day and puts a sentence to it.
 *
 * The number itself comes from `rateDay`, the same function the calendar uses.
 * This used to carry its own weights and its own idea of what an untracked
 * metric is worth, so the same day scored 6.2 here and 7.4 in the calendar.
 * What stays here is the wording and the per-metric status list, which need a
 * full DayContext and are far too much to assemble for thirty days at once.
 */
export function scoreDay(ctx: DayContext): DayScore {
  const items = buildDayStatus(ctx);

  const rating = rateDay(
    {
      date: '',
      kcal: ctx.nutrition.entryCount > 0 ? ctx.nutrition.kcal : null,
      proteinG: ctx.nutrition.entryCount > 0 ? ctx.nutrition.proteinG : null,
      steps: ctx.metrics.steps > 0 ? ctx.metrics.steps : null,
      sleepH: ctx.metrics.sleepH > 0 ? ctx.metrics.sleepH : null,
      waterMl: ctx.metrics.waterMl > 0 ? ctx.metrics.waterMl : null,
      trained: ctx.training.trainedToday,
      miniSession: false,
    },
    ctx.targets,
    { dayInProgress: isDayInProgress(ctx.hour) },
  );

  const score = rating.score ?? 0;

  const strengths: string[] = [];
  const gaps: string[] = [];
  for (const item of items) {
    if (item.tone === 'green') strengths.push(item.label);
    else if (item.tone === 'yellow' || item.tone === 'red') gaps.push(item.label);
  }

  // Every band stays factual: a weak day is reported, never scolded (§32).
  let summary: string;
  if (score >= 8.5) summary = 'Starker Tag. Genau so sieht Konstanz aus.';
  else if (score >= 7) summary = strengths.length > 0 ? `Solide — ${strengths.slice(0, 2).join(' und ')} liefen gut.` : 'Solider Tag.';
  else if (score >= 5) summary = gaps.length > 0 ? `Durchwachsen — der größte Hebel für morgen ist ${gaps[0]}. Ein Tag entscheidet nichts, die Woche schon.` : 'Durchwachsener Tag. Ein Tag entscheidet nichts, die Woche schon.';
  else summary = 'Kein starker Tag — das ist völlig okay. Ein Tag entscheidet nichts, die Woche schon.';

  return { score, summary, items };
}
