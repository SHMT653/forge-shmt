import { describe, expect, it } from 'vitest';
import { buildDayStatus, buildHeadline, buildInsights, isDayInProgress, scoreDay, type DayContext } from '@/domain/dayEvaluation';
import { resolveTargets } from '@/domain/goalPhase';
import { summarizeWeight } from '@/domain/weightTrend';
import { GOALS_DEFAULTS } from '@/data/profile';

const targets = resolveTargets({
  ...GOALS_DEFAULTS,
  caloriesMin: 1900,
  caloriesMax: 2100,
  proteinMin: 130,
  proteinMax: 160,
  stepsGoal: 8000,
  waterGoalMl: 2500,
  sleepGoalH: 8,
  phaseType: 'cut',
});

function context(patch: Partial<DayContext> = {}): DayContext {
  return {
    today: '2026-08-21',
    hour: 15,
    targets,
    nutrition: { kcal: 1540, proteinG: 118, carbsG: 140, fatG: 45, quality: 'verified', entryCount: 3 },
    metrics: { steps: 6420, waterMl: 1750, sleepH: 8.3 },
    training: {
      trainedToday: false,
      hasActiveSession: false,
      lastWorkoutDate: '2026-08-20',
      lastWorkoutName: 'Push',
      fullWorkoutsThisWeek: 1,
      miniSessionsThisWeek: 0,
      plannedDayName: 'Push',
      weeklyTarget: 3,
    },
    soreness: null,
    weight: summarizeWeight([]),
    weekly: { avgKcal: 2060, avgProtein: 142, avgSteps: 7420, daysWithData: 5 },
    ...patch,
  };
}

describe('isDayInProgress', () => {
  it('treats the evening as the point where the day is judged', () => {
    expect(isDayInProgress(15)).toBe(true);
    expect(isDayInProgress(22)).toBe(false);
  });
});

describe('buildDayStatus (§8)', () => {
  it('returns exactly the six tracked dimensions', () => {
    const items = buildDayStatus(context());
    expect(items.map((i) => i.key)).toEqual(['calories', 'protein', 'steps', 'water', 'training', 'sleep']);
  });

  it('stays neutral on nutrition when nothing was logged', () => {
    const items = buildDayStatus(context({ nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, quality: 'verified', entryCount: 0 } }));
    expect(items.find((i) => i.key === 'calories')?.tone).toBe('neutral');
  });

  it('goes red only when clearly over the range', () => {
    const over = buildDayStatus(context({ nutrition: { ...context().nutrition, kcal: 2800 } }));
    expect(over.find((i) => i.key === 'calories')?.tone).toBe('red');
    const slightly = buildDayStatus(context({ nutrition: { ...context().nutrition, kcal: 2200 } }));
    expect(slightly.find((i) => i.key === 'calories')?.tone).toBe('yellow');
  });

  it('never marks high protein as a problem', () => {
    const items = buildDayStatus(context({ nutrition: { ...context().nutrition, proteinG: 200 } }));
    expect(items.find((i) => i.key === 'protein')?.tone).toBe('green');
  });
});

describe('scoreDay (§31)', () => {
  it('scores a strong day highly', () => {
    const result = scoreDay(
      context({
        hour: 22,
        nutrition: { kcal: 1980, proteinG: 148, carbsG: 180, fatG: 60, quality: 'verified', entryCount: 4 },
        metrics: { steps: 8240, waterMl: 2400, sleepH: 8.2 },
        training: { ...context().training, trainedToday: true },
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('never shames a weak day', () => {
    const result = scoreDay(
      context({
        hour: 22,
        nutrition: { kcal: 3200, proteinG: 40, carbsG: 300, fatG: 140, quality: 'verified', entryCount: 2 },
        metrics: { steps: 900, waterMl: 200, sleepH: 5 },
      }),
    );
    expect(result.score).toBeLessThan(6);
    // The message must stay factual — no blame, and always the weekly frame.
    expect(result.summary).toContain('Woche');
    expect(result.summary.toLowerCase()).not.toMatch(/versag|schlecht|diszipl/);
  });

  it('keeps the score inside 0–10', () => {
    const result = scoreDay(context());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });
});
