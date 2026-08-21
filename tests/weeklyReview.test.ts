import { describe, expect, it } from 'vitest';
import { buildWeeklyReview, weekBoundsFor } from '@/domain/weeklyReview';
import { resolveTargets } from '@/domain/goalPhase';
import { summarizeWeight } from '@/domain/weightTrend';
import { snapshotExercise } from '@/domain/progression';
import { GOALS_DEFAULTS } from '@/data/profile';
import type { BodyMetric, SessionExercise, SetEntry } from '@/domain/types';

const targets = resolveTargets({
  ...GOALS_DEFAULTS,
  caloriesMin: 1900,
  caloriesMax: 2100,
  proteinMin: 130,
  proteinMax: 160,
  phaseType: 'cut',
});

const bounds = weekBoundsFor('2026-08-21');

function day(date: string, kcal: number, proteinG: number) {
  return { date, kcal, proteinG, steps: 7500, waterMl: 2400, sleepH: 8, hasNutrition: kcal > 0 };
}

function metric(logDate: string, weightKg: number): BodyMetric {
  return { id: logDate, logDate, weightKg, waistCm: null, chestCm: null, armsCm: null, bia: null, source: 'manual' };
}

function pushups(date: string, reps: number[]) {
  const sets: SetEntry[] = reps.map((r, i) => ({
    id: `${date}-${i}`, setIndex: i, reps: r, weightKg: null, durationSeconds: null, resistance: null, completed: true,
  }));
  const exercise: SessionExercise = { id: date, exerciseName: 'Liegestütze', targetSets: 3, targetReps: '8-12', orderIndex: 0, sets };
  return snapshotExercise(exercise, date);
}

function review(overrides: Partial<Parameters<typeof buildWeeklyReview>[0]> = {}) {
  return buildWeeklyReview({
    bounds,
    targets,
    days: [
      day('2026-08-17', 2000, 145),
      day('2026-08-18', 2050, 138),
      day('2026-08-19', 2800, 120),
      day('2026-08-20', 1950, 150),
      day('2026-08-21', 2010, 142),
      day('2026-08-22', 0, 0),
      day('2026-08-23', 0, 0),
    ],
    fullWorkouts: 2,
    miniSessions: 3,
    weight: summarizeWeight([]),
    exerciseHistories: [],
    ...overrides,
  });
}

describe('buildWeeklyReview (§30/§58)', () => {
  it('averages only the days that actually have data', () => {
    const result = review();
    expect(result.daysLogged).toBe(5);
    // (2000+2050+2800+1950+2010) / 5
    expect(result.avgKcal).toBe(2162);
  });

  it('counts days inside the calorie range', () => {
    // The 2.800 day is the only one outside.
    expect(review().daysInCalorieRange).toBe(4);
  });

  it('counts days the protein target was met', () => {
    expect(review().daysProteinHit).toBe(4);
  });

  it('keeps full and mini sessions separate (§19)', () => {
    const result = review();
    expect(result.fullWorkouts).toBe(2);
    expect(result.miniSessions).toBe(3);
  });

  it('refuses to draw conclusions from too little data', () => {
    const result = review({ days: [day('2026-08-17', 2000, 140), day('2026-08-18', 0, 0)] });
    expect(result.coachText).toContain('zu wenig Daten');
  });

  it('celebrates weight and strength moving together (§45)', () => {
    const result = review({
      weight: summarizeWeight([
        metric('2026-08-17', 73.6), metric('2026-08-18', 73.5), metric('2026-08-19', 73.4),
        metric('2026-08-20', 73.2), metric('2026-08-21', 73.1),
      ]),
      exerciseHistories: [{ name: 'Liegestütze', snapshots: [pushups('2026-08-17', [7, 10, 7]), pushups('2026-08-21', [10, 9, 8])] }],
    });
    expect(result.coachText).toContain('gleichzeitig positiv');
    expect(result.highlight?.name).toBe('Liegestütze');
    expect(result.highlight?.summary).toBe('24 → 27 Wiederholungen');
  });

  it('warns when weight is dropping faster than the phase expects', () => {
    const result = review({
      weight: summarizeWeight([
        metric('2026-08-17', 75.0), metric('2026-08-18', 74.6), metric('2026-08-19', 74.2),
        metric('2026-08-20', 73.8), metric('2026-08-21', 73.4),
      ]),
    });
    expect(result.coachText).toContain('schneller runter');
  });

  it('names protein as the lever when the average falls short', () => {
    const result = review({
      days: [
        day('2026-08-17', 2000, 90), day('2026-08-18', 2000, 85),
        day('2026-08-19', 2000, 95), day('2026-08-20', 2000, 88),
      ],
    });
    expect(result.coachText).toContain('Protein');
  });

  it('flags a week without any training', () => {
    const result = review({ fullWorkouts: 0, miniSessions: 0 });
    expect(result.coachText).toContain('kein Training');
  });

  it('does not tell the user to cut further when averages are on target', () => {
    const result = review({
      days: [
        day('2026-08-17', 2000, 145), day('2026-08-18', 1980, 140),
        day('2026-08-19', 2020, 148), day('2026-08-20', 1990, 142),
      ],
    });
    expect(result.coachText).toContain('nicht weiter anpassen');
  });
});
