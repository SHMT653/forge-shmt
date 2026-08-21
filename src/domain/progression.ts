/**
 * Progression maths for strength work.
 *
 * The original app measured progress by `max(weight_kg)` alone. For home
 * training that silently reports "no progress" forever: push-ups, planks and
 * band work carry no weight, so every set was filtered out before it could
 * count. This module scores a set by whatever it actually has — weight, reps,
 * or seconds held — so bodyweight progress shows up like any other.
 */

import type { SetEntry, SessionExercise } from './types';

/** What an exercise is measured in, inferred from the sets themselves. */
export type MetricKind = 'weight' | 'reps' | 'duration';

export type ExerciseSnapshot = {
  date: string;
  /** Sum of reps over completed sets — the headline number for bodyweight work. */
  totalReps: number;
  /** Highest single-set reps. */
  bestSetReps: number;
  /** Highest weight moved, when the exercise uses weight. */
  maxWeightKg: number | null;
  /** Total seconds held, for planks and similar. */
  totalSeconds: number;
  /** Longest single hold. */
  bestSetSeconds: number;
  completedSets: number;
  /** reps × weight summed — total work, when weight is involved. */
  volumeKg: number;
  metric: MetricKind;
  /** Per-set reps in order, e.g. [10, 9, 8] — rendered as "10 / 9 / 8". */
  repsPerSet: number[];
};

export type LastPerformance = {
  reps: number;
  weightKg: number | null;
  durationSeconds: number | null;
  totalReps: number;
  metric: MetricKind;
  date: string;
};

export function metricForSets(sets: readonly SetEntry[]): MetricKind {
  if (sets.some((s) => s.weightKg !== null && s.weightKg > 0)) return 'weight';
  if (sets.some((s) => s.durationSeconds !== null && s.durationSeconds > 0)) return 'duration';
  return 'reps';
}

/** Collapses one exercise inside one session into a single comparable snapshot. */
export function snapshotExercise(exercise: SessionExercise, date: string): ExerciseSnapshot {
  const done = exercise.sets.filter((s) => s.completed);
  const metric = metricForSets(done.length > 0 ? done : exercise.sets);

  let totalReps = 0;
  let bestSetReps = 0;
  let maxWeightKg: number | null = null;
  let totalSeconds = 0;
  let bestSetSeconds = 0;
  let volumeKg = 0;
  const repsPerSet: number[] = [];

  for (const set of done) {
    const reps = set.reps ?? 0;
    totalReps += reps;
    if (reps > bestSetReps) bestSetReps = reps;
    repsPerSet.push(reps);

    if (set.weightKg !== null) {
      maxWeightKg = maxWeightKg === null ? set.weightKg : Math.max(maxWeightKg, set.weightKg);
      volumeKg += reps * set.weightKg;
    }
    const seconds = set.durationSeconds ?? 0;
    totalSeconds += seconds;
    if (seconds > bestSetSeconds) bestSetSeconds = seconds;
  }

  return {
    date,
    totalReps,
    bestSetReps,
    maxWeightKg,
    totalSeconds,
    bestSetSeconds,
    completedSets: done.length,
    volumeKg,
    metric,
    repsPerSet,
  };
}

/** The number that represents an exercise's performance, given its metric. */
export function primaryScore(snapshot: ExerciseSnapshot): number {
  if (snapshot.metric === 'weight') return snapshot.volumeKg > 0 ? snapshot.volumeKg : (snapshot.maxWeightKg ?? 0);
  if (snapshot.metric === 'duration') return snapshot.totalSeconds;
  return snapshot.totalReps;
}

export type ProgressionTrend = {
  direction: 'up' | 'down' | 'flat' | 'new';
  /** Percent change from first to latest, rounded. Null when there is no baseline. */
  percent: number | null;
  from: ExerciseSnapshot;
  to: ExerciseSnapshot;
  /** Human-readable delta, e.g. "24 → 27 Wiederholungen". */
  summary: string;
};

export function formatScore(snapshot: ExerciseSnapshot): string {
  if (snapshot.metric === 'weight') {
    return snapshot.maxWeightKg !== null ? `${snapshot.maxWeightKg} kg` : `${snapshot.totalReps} Wdh.`;
  }
  if (snapshot.metric === 'duration') return `${snapshot.totalSeconds} s`;
  return `${snapshot.totalReps} Wdh.`;
}

/** Compares the oldest and newest snapshot of one exercise. */
export function computeTrend(history: readonly ExerciseSnapshot[]): ProgressionTrend | null {
  if (history.length === 0) return null;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;

  if (sorted.length === 1) {
    return { direction: 'new', percent: null, from: first, to: last, summary: formatScore(last) };
  }

  const before = primaryScore(first);
  const after = primaryScore(last);
  const percent = before > 0 ? Math.round(((after - before) / before) * 100) : null;
  const direction = after > before ? 'up' : after < before ? 'down' : 'flat';

  const unit = last.metric === 'weight' ? 'kg' : last.metric === 'duration' ? 's' : 'Wiederholungen';
  const summary =
    last.metric === 'weight'
      ? `${first.maxWeightKg ?? 0} → ${last.maxWeightKg ?? 0} ${unit}`
      : `${before} → ${after} ${unit}`;

  return { direction, percent, from: first, to: last, summary };
}

/**
 * Decides whether an exercise has earned a harder variation (§21).
 * The rule is deliberately conservative: the target must be cleared on every
 * set, in the two most recent sessions, before we suggest progressing.
 */
export type OverloadAdvice = {
  ready: boolean;
  message: string;
};

export function overloadAdvice(
  history: readonly ExerciseSnapshot[],
  targetSets: number,
  targetRepsTop: number,
): OverloadAdvice | null {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-2);
  if (recent.length < 2 || targetRepsTop <= 0) return null;

  const clears = recent.every(
    (s) => s.completedSets >= targetSets && s.repsPerSet.every((r) => r >= targetRepsTop),
  );
  if (clears) {
    return {
      ready: true,
      message: `Du schaffst stabil ${targetSets}×${targetRepsTop}. Zeit für eine schwerere Variante oder mehr Widerstand.`,
    };
  }

  const trend = computeTrend(sorted);
  if (trend && trend.direction === 'up') {
    return { ready: false, message: `Deine Leistung steigt: ${trend.summary}. Weiter so.` };
  }
  return null;
}

/** Parses "8-12" / "45-60" / "10" into its upper bound. */
export function targetRepsUpperBound(targetReps: string): number {
  const numbers = targetReps.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 0;
  const last = numbers[numbers.length - 1];
  return last ? Number(last) : 0;
}

/** Renders per-set reps as "10 / 9 / 8". */
export function formatRepsPerSet(repsPerSet: readonly number[]): string {
  return repsPerSet.filter((r) => r > 0).join(' / ');
}
