import { describe, expect, it } from 'vitest';
import {
  computeTrend, formatRepsPerSet, metricForSets, overloadAdvice,
  primaryScore, snapshotExercise, targetRepsUpperBound,
} from '@/domain/progression';
import type { SessionExercise, SetEntry } from '@/domain/types';

function set(patch: Partial<SetEntry>): SetEntry {
  return {
    id: Math.random().toString(36),
    setIndex: 0,
    reps: null,
    weightKg: null,
    durationSeconds: null,
    resistance: null,
    completed: true,
    ...patch,
  };
}

function exercise(sets: SetEntry[], targetReps = '8-12'): SessionExercise {
  return { id: 'e1', exerciseName: 'Liegestütze', targetSets: 3, targetReps, orderIndex: 0, sets };
}

describe('metricForSets', () => {
  it('uses reps for bodyweight work', () => {
    expect(metricForSets([set({ reps: 10 })])).toBe('reps');
  });

  it('uses weight when any set carries one', () => {
    expect(metricForSets([set({ reps: 8, weightKg: 40 })])).toBe('weight');
  });

  it('uses duration for holds', () => {
    expect(metricForSets([set({ durationSeconds: 45 })])).toBe('duration');
  });

  it('does not treat a zero weight as a weighted exercise', () => {
    expect(metricForSets([set({ reps: 10, weightKg: 0 })])).toBe('reps');
  });
});

describe('snapshotExercise — bodyweight work must be measurable (§20)', () => {
  it('sums reps across completed sets', () => {
    const snap = snapshotExercise(exercise([set({ reps: 7 }), set({ reps: 10 }), set({ reps: 7 })]), '2026-01-01');
    expect(snap.totalReps).toBe(24);
    expect(snap.bestSetReps).toBe(10);
    expect(snap.completedSets).toBe(3);
    expect(snap.metric).toBe('reps');
  });

  it('ignores sets that were never completed', () => {
    const snap = snapshotExercise(
      exercise([set({ reps: 10 }), set({ reps: 99, completed: false })]),
      '2026-01-01',
    );
    expect(snap.totalReps).toBe(10);
  });

  it('records per-set reps in order for display', () => {
    const snap = snapshotExercise(exercise([set({ reps: 10 }), set({ reps: 9 }), set({ reps: 8 })]), '2026-01-01');
    expect(formatRepsPerSet(snap.repsPerSet)).toBe('10 / 9 / 8');
  });

  it('computes volume when weight is involved', () => {
    const snap = snapshotExercise(exercise([set({ reps: 10, weightKg: 20 }), set({ reps: 8, weightKg: 20 })]), '2026-01-01');
    expect(snap.volumeKg).toBe(360);
    expect(snap.maxWeightKg).toBe(20);
  });

  it('totals seconds for holds', () => {
    const snap = snapshotExercise(exercise([set({ durationSeconds: 45 }), set({ durationSeconds: 60 })]), '2026-01-01');
    expect(snap.totalSeconds).toBe(105);
    expect(snap.bestSetSeconds).toBe(60);
  });
});

describe('primaryScore', () => {
  it('scores rep work by total reps', () => {
    const snap = snapshotExercise(exercise([set({ reps: 10 }), set({ reps: 9 })]), '2026-01-01');
    expect(primaryScore(snap)).toBe(19);
  });

  it('scores holds by total seconds', () => {
    const snap = snapshotExercise(exercise([set({ durationSeconds: 45 })]), '2026-01-01');
    expect(primaryScore(snap)).toBe(45);
  });
});

describe('computeTrend (§21)', () => {
  const week1 = snapshotExercise(exercise([set({ reps: 7 }), set({ reps: 10 }), set({ reps: 7 })]), '2026-01-01');
  const week2 = snapshotExercise(exercise([set({ reps: 10 }), set({ reps: 9 }), set({ reps: 8 })]), '2026-01-08');

  it('reports the 24 → 27 improvement from the brief', () => {
    const trend = computeTrend([week1, week2]);
    expect(trend?.direction).toBe('up');
    expect(trend?.summary).toBe('24 → 27 Wiederholungen');
    expect(trend?.percent).toBe(13);
  });

  it('marks a first-ever session as new rather than flat', () => {
    expect(computeTrend([week1])?.direction).toBe('new');
  });

  it('returns null with no history at all', () => {
    expect(computeTrend([])).toBeNull();
  });

  it('detects a decline', () => {
    expect(computeTrend([week2, { ...week1, date: '2026-01-15' }])?.direction).toBe('down');
  });

  it('sorts by date rather than trusting array order', () => {
    const trend = computeTrend([week2, week1]);
    expect(trend?.summary).toBe('24 → 27 Wiederholungen');
  });
});

describe('overloadAdvice (§21)', () => {
  const clean = (date: string) => snapshotExercise(exercise([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 12 })]), date);

  it('suggests progressing only after the target is cleared twice', () => {
    const advice = overloadAdvice([clean('2026-01-01'), clean('2026-01-08')], 3, 12);
    expect(advice?.ready).toBe(true);
  });

  it('does not suggest progressing on a single good session', () => {
    expect(overloadAdvice([clean('2026-01-01')], 3, 12)).toBeNull();
  });

  it('encourages when improving but not yet at target', () => {
    const advice = overloadAdvice(
      [
        snapshotExercise(exercise([set({ reps: 7 }), set({ reps: 7 })]), '2026-01-01'),
        snapshotExercise(exercise([set({ reps: 9 }), set({ reps: 9 })]), '2026-01-08'),
      ],
      3,
      12,
    );
    expect(advice?.ready).toBe(false);
  });
});

describe('targetRepsUpperBound', () => {
  it('reads the top of a range', () => {
    expect(targetRepsUpperBound('8-12')).toBe(12);
    expect(targetRepsUpperBound('45-60')).toBe(60);
    expect(targetRepsUpperBound('10')).toBe(10);
    expect(targetRepsUpperBound('AMRAP')).toBe(0);
  });
});
