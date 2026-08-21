/**
 * The coach layer.
 *
 * Everything here is a pure function over data FORGE already holds. The coach
 * interprets the database; it never invents numbers, and it never says anything
 * it cannot point at a row for (§78).
 *
 * Tone rules, which the copy below follows deliberately:
 *  - a single bad day is never a verdict — the week is the unit that matters (§32)
 *  - eating less than planned is not a win (§16)
 *  - "over your range" is information, not an accusation (§6)
 */

import { evaluateGoal, evaluateRange, type ResolvedTargets, type Tone } from './goalPhase';
import type { WeightSummary } from './weightTrend';
import type { DataQuality, Soreness } from './types';

export type CoachContext = {
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

export function buildDayStatus(ctx: CoachContext): DayStatusItem[] {
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

// ═══════════════════════════════════════════════════════════════════════════
// Insights
// ═══════════════════════════════════════════════════════════════════════════

export type InsightKind = 'nutrition' | 'protein' | 'training' | 'recovery' | 'weight' | 'activity' | 'routine';

export type CoachInsight = {
  id: string;
  kind: InsightKind;
  tone: Tone;
  /** Higher wins when space is tight. */
  priority: number;
  text: string;
  /** Optional in-app destination, e.g. '/nutrition'. */
  href?: string;
  actionLabel?: string;
};

/**
 * The headline sentence for the Heute screen — one paragraph, generated from
 * the day's real numbers.
 */
export function buildHeadline(ctx: CoachContext): string {
  const inProgress = isDayInProgress(ctx.hour);
  const { targets, nutrition } = ctx;

  if (nutrition.entryCount === 0 && ctx.metrics.steps === 0 && !ctx.training.trainedToday) {
    return 'Noch nichts eingetragen heute. Trag deine erste Mahlzeit ein, dann rechne ich dir den Rest des Tages aus.';
  }

  const proteinLeft = Math.max(0, targets.protein.min - nutrition.proteinG);
  const kcalLeft = targets.calories.max - nutrition.kcal;
  const kcalEval = evaluateRange(nutrition.kcal, targets.calories, { dayInProgress: inProgress });

  // Over the range — state it plainly, then widen to the week.
  if (kcalEval.status === 'over' || kcalEval.status === 'slightly_over') {
    const weekly = ctx.weekly.avgKcal;
    const weeklyPart =
      weekly !== null && ctx.weekly.daysWithData >= 3
        ? ` Dein Wochenschnitt liegt bei ${Math.round(weekly).toLocaleString('de-DE')} kcal — das ist die Zahl, die zählt.`
        : ' Entscheidend ist dein Wochendurchschnitt, nicht der einzelne Tag.';
    return `Heute liegst du über deinem Zielbereich.${weeklyPart}`;
  }

  // Day is done and clearly under — flag it, because under-eating is not a win.
  if (!inProgress && kcalEval.status === 'far_under') {
    return `Du liegst heute deutlich unter deinem Zielbereich (${Math.round(nutrition.kcal).toLocaleString('de-DE')} von ${targets.calories.min.toLocaleString('de-DE')}–${targets.calories.max.toLocaleString('de-DE')} kcal). Für Regeneration und Leistung wäre eine weitere ausgewogene Mahlzeit sinnvoll.`;
  }

  // In a surplus phase, calories still missing are the goal, not headroom —
  // the same 1.500 kcal means opposite things in a cut and a lean bulk (§36).
  const wantsSurplus = targets.phase.type === 'lean_bulk';
  if (wantsSurplus && nutrition.kcal < targets.calories.min) {
    const missing = targets.calories.min - nutrition.kcal;
    return `Für deinen Aufbau fehlen heute noch etwa ${Math.round(missing).toLocaleString('de-DE')} kcal${proteinLeft > 5 ? ` und ${Math.round(proteinLeft)} g Protein` : ''}. Ohne den Überschuss fehlt dem Muskelaufbau die Grundlage.`;
  }

  // The normal case: what is still missing today.
  if (proteinLeft > 5 && kcalLeft > 150) {
    return `Für heute fehlen dir noch etwa ${Math.round(proteinLeft)} g Protein. Kalorisch hast du dafür rund ${Math.round(kcalLeft).toLocaleString('de-DE')} kcal Spielraum — eine proteinreiche Mahlzeit passt problemlos.`;
  }
  if (proteinLeft > 5 && kcalLeft <= 150) {
    return `Dir fehlen noch ${Math.round(proteinLeft)} g Protein, der kalorische Spielraum ist aber fast aufgebraucht. Etwas Mageres wie Skyr, Hüttenkäse oder ein Proteinshake passt noch.`;
  }
  if (proteinLeft <= 5 && kcalLeft > 300) {
    return `Protein sitzt für heute. Du hast noch etwa ${Math.round(kcalLeft).toLocaleString('de-DE')} kcal Spielraum im Zielbereich.`;
  }
  return 'Ernährung läuft heute rund — Protein und Kalorien liegen beide im Rahmen.';
}

/**
 * The full insight list. Ordered by priority, so a caller can take the top N.
 */
export function buildInsights(ctx: CoachContext): CoachInsight[] {
  const insights: CoachInsight[] = [];
  const inProgress = isDayInProgress(ctx.hour);
  const { targets } = ctx;

  // ── Protein ─────────────────────────────────────────────────────────
  const proteinLeft = Math.max(0, targets.protein.min - ctx.nutrition.proteinG);
  if (ctx.nutrition.entryCount > 0) {
    if (proteinLeft > 25) {
      insights.push({
        id: 'protein-gap',
        kind: 'protein',
        tone: inProgress ? 'yellow' : 'yellow',
        priority: 80,
        text: `Noch ${Math.round(proteinLeft)} g Protein bis zum Zielbereich (${targets.protein.min}–${targets.protein.max} g).`,
        href: '/nutrition',
        actionLabel: 'Mahlzeit eintragen',
      });
    } else if (proteinLeft > 0) {
      insights.push({
        id: 'protein-close',
        kind: 'protein',
        tone: 'green',
        priority: 55,
        text: `Nur noch ${Math.round(proteinLeft)} g Protein — das schaffst du mit einer Kleinigkeit.`,
        href: '/nutrition',
      });
    } else {
      insights.push({
        id: 'protein-done',
        kind: 'protein',
        tone: 'green',
        priority: 30,
        text: `Proteinziel erreicht: ${Math.round(ctx.nutrition.proteinG)} g. Genau das schützt deine Muskulatur im Defizit.`,
      });
    }
  }

  // ── Training / recovery (§22) ───────────────────────────────────────
  insights.push(...trainingInsights(ctx));

  // ── Activity ────────────────────────────────────────────────────────
  const stepsLeft = targets.steps - ctx.metrics.steps;
  if (stepsLeft > 0 && ctx.metrics.steps > 0) {
    insights.push({
      id: 'steps-gap',
      kind: 'activity',
      tone: stepsLeft > targets.steps * 0.4 ? 'yellow' : 'green',
      priority: 45,
      text: `Noch ${Math.round(stepsLeft).toLocaleString('de-DE')} Schritte bis ${targets.steps.toLocaleString('de-DE')} — ein Spaziergang reicht.`,
    });
  }

  // ── Weight (§25/§45) ────────────────────────────────────────────────
  insights.push(...weightInsights(ctx));

  // ── Weekly context (§58) ────────────────────────────────────────────
  if (ctx.weekly.avgKcal !== null && ctx.weekly.daysWithData >= 4) {
    const weekEval = evaluateRange(ctx.weekly.avgKcal, targets.calories, { dayInProgress: false });
    const label = weekEval.status === 'in' ? 'im Zielbereich' : weekEval.status === 'over' || weekEval.status === 'slightly_over' ? 'über dem Zielbereich' : 'unter dem Zielbereich';
    insights.push({
      id: 'weekly-kcal',
      kind: 'nutrition',
      tone: weekEval.tone,
      priority: 40,
      text: `Wochenschnitt: ${Math.round(ctx.weekly.avgKcal).toLocaleString('de-DE')} kcal — ${label}.`,
      href: '/progress',
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

function trainingInsights(ctx: CoachContext): CoachInsight[] {
  const out: CoachInsight[] = [];
  const { training, soreness } = ctx;

  if (training.hasActiveSession) {
    out.push({
      id: 'session-running',
      kind: 'training',
      tone: 'green',
      priority: 100,
      text: 'Dein Training läuft noch — du kannst da weitermachen, wo du aufgehört hast.',
      href: '/',
      actionLabel: 'Fortsetzen',
    });
    return out;
  }

  if (training.trainedToday) {
    out.push({
      id: 'trained-today',
      kind: 'training',
      tone: 'green',
      priority: 70,
      text: 'Training heute erledigt. Achte jetzt vor allem auf Protein und Schlaf.',
    });
    return out;
  }

  // Strong soreness overrides the plan — recovery is the better call (§22).
  if (soreness === 'strong') {
    out.push({
      id: 'soreness-strong',
      kind: 'recovery',
      tone: 'yellow',
      priority: 95,
      text: 'Starker Muskelkater. Heute wäre ein Walking- oder Recovery-Tag sinnvoller als eine harte Einheit.',
    });
    return out;
  }

  if (soreness === 'medium') {
    out.push({
      id: 'soreness-medium',
      kind: 'recovery',
      tone: 'yellow',
      priority: 85,
      text: 'Mittlerer Muskelkater. Training ist möglich — nimm die betroffene Muskelgruppe heute aber raus oder mach eine Mini-Session.',
    });
    return out;
  }

  const weekGap = training.weeklyTarget - training.fullWorkoutsThisWeek;
  if (weekGap <= 0) {
    out.push({
      id: 'week-target-hit',
      kind: 'training',
      tone: 'green',
      priority: 50,
      text: `${training.fullWorkoutsThisWeek} von ${training.weeklyTarget} Einheiten diese Woche — Ziel erreicht. Alles Weitere ist Bonus.`,
    });
    return out;
  }

  const sorenessNote = soreness === 'light' ? 'Leichter Muskelkater ist kein Grund zu pausieren. ' : '';
  out.push({
    id: 'train-today',
    kind: 'training',
    tone: 'neutral',
    priority: 90,
    text: training.plannedDayName
      ? `${sorenessNote}Heute steht ${training.plannedDayName} an — noch ${weekGap} ${weekGap === 1 ? 'Einheit' : 'Einheiten'} bis zu deinem Wochenziel.`
      : `${sorenessNote}Noch ${weekGap} ${weekGap === 1 ? 'Einheit' : 'Einheiten'} bis zu deinem Wochenziel. Auch eine Mini-Session zählt.`,
    href: '/plans',
    actionLabel: 'Training starten',
  });
  return out;
}

function weightInsights(ctx: CoachContext): CoachInsight[] {
  const out: CoachInsight[] = [];
  const { weight, targets } = ctx;

  if (weight.trendNow === null) {
    out.push({
      id: 'weight-none',
      kind: 'weight',
      tone: 'neutral',
      priority: 35,
      text: 'Noch kein Gewichtstrend. Ab zwei Messungen kann ich dir zeigen, wohin es geht.',
      href: '/progress',
      actionLabel: 'Gewicht eintragen',
    });
    return out;
  }

  const rate = weight.weeklyRateKg;
  if (rate === null || !weight.change7d.reliable) return out;

  const expected = targets.phase.weeklyWeightChangeKg;
  const inBand = rate >= expected.min && rate <= expected.max;

  if (inBand) {
    out.push({
      id: 'weight-on-track',
      kind: 'weight',
      tone: 'green',
      priority: 48,
      text: `Gewichtstrend: ${formatSignedKg(rate)} pro Woche — genau im erwarteten Bereich für ${targets.phase.label}.`,
      href: '/progress',
    });
  } else if (rate < expected.min) {
    out.push({
      id: 'weight-fast',
      kind: 'weight',
      tone: 'yellow',
      priority: 52,
      text: `Dein Gewicht fällt mit ${formatSignedKg(rate)} pro Woche schneller als geplant. Etwas mehr zu essen schützt hier deine Muskulatur.`,
      href: '/progress',
    });
  } else {
    // Rising faster than the phase expects. In a recomp, strength gains can
    // justify this — so we describe rather than prescribe.
    out.push({
      id: 'weight-slow',
      kind: 'weight',
      tone: 'yellow',
      priority: 46,
      text: `Gewichtstrend: ${formatSignedKg(rate)} pro Woche. Wenn deine Trainingsleistung gleichzeitig steigt, ist das für ${targets.phase.label} in Ordnung — sonst lohnt ein Blick auf die Kalorien.`,
      href: '/progress',
    });
  }

  return out;
}

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
 * Scores a finished day. Weighted toward the things that actually drive the
 * user's goal — protein and training — rather than treating every box equally.
 */
export function scoreDay(ctx: CoachContext): DayScore {
  const items = buildDayStatus(ctx);
  const weights: Record<StatusKey, number> = {
    calories: 2.5,
    protein: 2.5,
    training: 2,
    steps: 1.5,
    sleep: 1,
    water: 0.5,
  };

  let earned = 0;
  let possible = 0;
  for (const item of items) {
    const weight = weights[item.key];
    possible += weight;
    const factor = item.tone === 'green' ? 1 : item.tone === 'yellow' ? 0.6 : item.tone === 'red' ? 0.25 : 0.4;
    earned += weight * factor;
  }

  const score = possible > 0 ? Math.round((earned / possible) * 100) / 10 : 0;

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
