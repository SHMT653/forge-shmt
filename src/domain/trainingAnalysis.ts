/**
 * Training analysis.
 *
 * Turns the set history into the two questions a lifter actually has:
 * "bekommt jede Muskelgruppe genug?" and "was trainiere ich als Nächstes?".
 *
 * Volume is counted in hard sets per muscle per week, which is the unit the
 * training literature uses and the only one that survives comparing a
 * bodyweight session to a barbell one. A set counts fully for the muscles the
 * exercise names as primary and at a discount for the assisting ones —
 * counting a bench press as a full triceps set would badly overstate arm work.
 */

import { findExercise } from './exerciseDatabase';
import type { MuscleKey } from './exerciseDatabase';

export type MuscleRegion = 'push' | 'pull' | 'legs' | 'core';

/** Which region each muscle belongs to, for the balance check. */
const REGION_OF: Record<MuscleKey, MuscleRegion> = {
  chest: 'push', 'front-delt': 'push', 'side-delt': 'push', triceps: 'push',
  lats: 'pull', rhomboids: 'pull', traps: 'pull', 'rear-delt': 'pull', biceps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  abs: 'core', obliques: 'core', 'lower-back': 'core',
};

export const MUSCLE_LABEL: Record<MuscleKey, string> = {
  chest: 'Brust', 'front-delt': 'Schulter vorne', 'side-delt': 'Schulter seitlich', 'rear-delt': 'Schulter hinten',
  lats: 'Latissimus', rhomboids: 'obererRücken', traps: 'Trapez', 'lower-back': 'unterer Rücken',
  biceps: 'Bizeps', triceps: 'Trizeps', forearms: 'Unterarme',
  quads: 'Quadrizeps', hamstrings: 'Beinbizeps', glutes: 'Gesäß', calves: 'Waden',
  abs: 'Bauch', obliques: 'seitl. Bauch',
};

export const REGION_LABEL: Record<MuscleRegion, string> = {
  push: 'Drücken', pull: 'Ziehen', legs: 'Beine', core: 'Rumpf',
};

/**
 * Weekly hard-set ranges per muscle.
 *
 * Small muscles that also get hit indirectly need fewer direct sets, which is
 * why arms sit lower than chest or back.
 */
const WEEKLY_SETS: Partial<Record<MuscleKey, { min: number; optimal: number; max: number }>> = {
  chest: { min: 8, optimal: 14, max: 22 },
  lats: { min: 8, optimal: 14, max: 22 },
  rhomboids: { min: 6, optimal: 10, max: 18 },
  quads: { min: 8, optimal: 14, max: 20 },
  hamstrings: { min: 6, optimal: 10, max: 16 },
  glutes: { min: 6, optimal: 10, max: 16 },
  'side-delt': { min: 6, optimal: 12, max: 20 },
  'front-delt': { min: 4, optimal: 8, max: 16 },
  'rear-delt': { min: 4, optimal: 10, max: 18 },
  biceps: { min: 4, optimal: 10, max: 18 },
  triceps: { min: 4, optimal: 10, max: 18 },
  abs: { min: 4, optimal: 8, max: 16 },
  traps: { min: 3, optimal: 8, max: 14 },
  calves: { min: 4, optimal: 8, max: 16 },
};

const DEFAULT_RANGE = { min: 4, optimal: 8, max: 16 };

/** Assisting muscles get a fraction of a set, not a whole one. */
const SECONDARY_WEIGHT = 0.4;

export type SessionSummary = {
  date: string;
  exercises: { name: string; completedSets: number }[];
};

export type MuscleLoad = {
  muscle: MuscleKey;
  region: MuscleRegion;
  /** Weighted hard sets in the window. */
  sets: number;
  range: { min: number; optimal: number; max: number };
  /** Days since this muscle was last trained; null when never. */
  daysSince: number | null;
  status: 'untrained' | 'low' | 'good' | 'high';
};

/**
 * Weighted set volume per muscle over the given sessions.
 * `referenceDate` is the day "daysSince" counts back from.
 */
export function analyseMuscleLoad(sessions: readonly SessionSummary[], referenceDate: string): MuscleLoad[] {
  const sets = new Map<MuscleKey, number>();
  const lastTrained = new Map<MuscleKey, string>();

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.completedSets <= 0) continue;
      const entry = findExercise(exercise.name);
      if (!entry || entry.muscles.length === 0) continue;

      // The first listed muscle is the primary target; the rest assist.
      entry.muscles.forEach((muscle, index) => {
        const weight = index === 0 ? 1 : SECONDARY_WEIGHT;
        sets.set(muscle, (sets.get(muscle) ?? 0) + exercise.completedSets * weight);

        const previous = lastTrained.get(muscle);
        if (!previous || session.date > previous) lastTrained.set(muscle, session.date);
      });
    }
  }

  const muscles = new Set<MuscleKey>([...sets.keys(), ...lastTrained.keys()]);

  return [...muscles]
    .map<MuscleLoad>((muscle) => {
      const volume = Math.round((sets.get(muscle) ?? 0) * 10) / 10;
      const range = WEEKLY_SETS[muscle] ?? DEFAULT_RANGE;
      const last = lastTrained.get(muscle) ?? null;

      return {
        muscle,
        region: REGION_OF[muscle],
        sets: volume,
        range,
        daysSince: last ? daysBetween(last, referenceDate) : null,
        status:
          volume <= 0 ? 'untrained'
          : volume < range.min ? 'low'
          : volume > range.max ? 'high'
          : 'good',
      };
    })
    .sort((a, b) => b.sets - a.sets);
}

export type RegionBalance = {
  region: MuscleRegion;
  sets: number;
  share: number;
};

/** Share of total volume per region — the quick read on a lopsided plan. */
export function regionBalance(loads: readonly MuscleLoad[]): RegionBalance[] {
  const totals = new Map<MuscleRegion, number>();
  for (const load of loads) totals.set(load.region, (totals.get(load.region) ?? 0) + load.sets);

  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  return (['push', 'pull', 'legs', 'core'] as MuscleRegion[]).map((region) => ({
    region,
    sets: Math.round((totals.get(region) ?? 0) * 10) / 10,
    share: total > 0 ? Math.round(((totals.get(region) ?? 0) / total) * 100) : 0,
  }));
}

export type TrainingInsight = {
  id: string;
  severity: 'info' | 'suggest' | 'warn';
  text: string;
};

/**
 * Concrete observations about the training week.
 *
 * Only states what the data supports. With too few sessions it says so rather
 * than diagnosing a plan from two data points.
 */
export function trainingInsights(
  loads: readonly MuscleLoad[],
  balance: readonly RegionBalance[],
  sessionCount: number,
): TrainingInsight[] {
  const insights: TrainingInsight[] = [];

  if (sessionCount < 2) {
    insights.push({
      id: 'too-little-data',
      severity: 'info',
      text: 'Noch zu wenige Einheiten für eine Volumen-Auswertung. Ab etwa zwei Wochen Training wird das aussagekräftig.',
    });
    return insights;
  }

  // Undertrained muscles that are actually being trained at all — a muscle
  // the user never touches is a choice, not an oversight.
  const low = loads.filter((load) => load.status === 'low' && load.sets > 0);
  if (low.length > 0) {
    const names = low.slice(0, 3).map((load) => MUSCLE_LABEL[load.muscle]);
    insights.push({
      id: 'low-volume',
      severity: 'suggest',
      text: `Wenig Volumen bei ${names.join(', ')}. Ein bis zwei Sätze mehr pro Woche würden hier am meisten bringen.`,
    });
  }

  const high = loads.filter((load) => load.status === 'high');
  if (high.length > 0) {
    insights.push({
      id: 'high-volume',
      severity: 'warn',
      text: `${high.map((load) => MUSCLE_LABEL[load.muscle]).slice(0, 2).join(' und ')} bekommen sehr viel Volumen. Mehr ist ab hier nicht besser — Regeneration begrenzt den Fortschritt.`,
    });
  }

  // Push/pull imbalance is the classic one, and the one that causes trouble.
  const push = balance.find((b) => b.region === 'push')?.sets ?? 0;
  const pull = balance.find((b) => b.region === 'pull')?.sets ?? 0;

  // A week with no pulling at all is the most lopsided case there is — an
  // earlier version required pull > 0 to compare, so it said nothing exactly
  // when there was most to say.
  if (push >= 6 && pull === 0) {
    insights.push({
      id: 'push-heavy',
      severity: 'suggest',
      text: `${Math.round(push)} Sätze Drücken und kein einziger Satz Ziehen. Rudern oder Klimmzüge dazu — das hält die Schultern gesund und macht die Brust langfristig stärker.`,
    });
  } else if (pull >= 6 && push === 0) {
    insights.push({
      id: 'pull-heavy',
      severity: 'suggest',
      text: `${Math.round(pull)} Sätze Ziehen und kein Drücken. Eine Druckübung dazu gleicht das aus.`,
    });
  } else if (push > 0 && pull > 0) {
    const ratio = push / pull;
    if (ratio > 1.6) {
      insights.push({
        id: 'push-heavy',
        severity: 'suggest',
        text: `Deutlich mehr Drücken als Ziehen (${Math.round(push)} zu ${Math.round(pull)} Sätze). Mehr Rudern oder Klimmzüge gleichen das aus — auch für die Schulterhaltung.`,
      });
    } else if (ratio < 0.6) {
      insights.push({
        id: 'pull-heavy',
        severity: 'suggest',
        text: `Deutlich mehr Ziehen als Drücken (${Math.round(pull)} zu ${Math.round(push)} Sätze).`,
      });
    }
  }

  const legs = balance.find((b) => b.region === 'legs')?.sets ?? 0;
  const upper = push + pull;
  if (upper >= 8 && legs < upper * 0.25) {
    insights.push({
      id: 'legs-light',
      severity: 'suggest',
      text: 'Die Beine bekommen im Verhältnis wenig ab. Wenn das Absicht ist, passt es — sonst reichen schon zwei Sätze Kniebeugen pro Einheit.',
    });
  }

  // Stale muscles: trained before, but a while ago.
  const stale = loads
    .filter((load) => load.daysSince !== null && load.daysSince >= 8 && load.sets > 0)
    .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));
  if (stale[0]) {
    insights.push({
      id: 'stale',
      severity: 'info',
      text: `${MUSCLE_LABEL[stale[0].muscle]} zuletzt vor ${stale[0].daysSince} Tagen trainiert.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'balanced',
      severity: 'info',
      text: 'Volumen und Verteilung sehen ausgewogen aus. Weiter so.',
    });
  }

  return insights;
}

/**
 * What to train next.
 *
 * Ranks regions by how far below target they are and how long ago they were
 * last hit. Sore regions are pushed down — training into heavy soreness is
 * how people stall, not how they progress (§22).
 */
export function suggestNextFocus(
  loads: readonly MuscleLoad[],
  soreness: 'none' | 'light' | 'medium' | 'strong' | null,
): { region: MuscleRegion; reason: string } | null {
  if (loads.length === 0) return null;

  const byRegion = new Map<MuscleRegion, { deficit: number; daysSince: number }>();

  for (const load of loads) {
    const deficit = Math.max(0, load.range.optimal - load.sets);
    const days = load.daysSince ?? 14;
    const current = byRegion.get(load.region);
    byRegion.set(load.region, {
      deficit: (current?.deficit ?? 0) + deficit,
      daysSince: Math.max(current?.daysSince ?? 0, days),
    });
  }

  const ranked = [...byRegion.entries()]
    .map(([region, value]) => ({ region, score: value.deficit + value.daysSince * 1.5, ...value }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return null;

  if (soreness === 'strong') {
    return {
      region: best.region,
      reason: 'Bei starkem Muskelkater ist heute Bewegung sinnvoller als eine harte Einheit — danach steht das an.',
    };
  }

  return {
    region: best.region,
    reason:
      best.daysSince >= 5
        ? `Zuletzt vor ${Math.round(best.daysSince)} Tagen dran.`
        : `Hier fehlen noch rund ${Math.round(best.deficit)} Sätze zum Wochenziel.`,
  };
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy ?? 2026, (fm ?? 1) - 1, fd ?? 1);
  const end = Date.UTC(ty ?? 2026, (tm ?? 1) - 1, td ?? 1);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
