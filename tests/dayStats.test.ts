import { describe, expect, it } from 'vitest';
import { buildDayStats, describeDelta, macroSplit, type DayStatsInput } from '@/domain/dayStats';
import { resolveTargets } from '@/domain/goalPhase';
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
});

function input(patch: Partial<DayStatsInput> = {}): DayStatsInput {
  return {
    totals: { kcal: 1540, proteinG: 118, carbsG: 150, fatG: 50 },
    metrics: { steps: 6420, waterMl: 1750, sleepH: 8.3, activeEnergyKcal: 0, walkingDistanceM: 0 },
    targets,
    weekly: { avgKcal: 2060, avgProtein: 142, avgSteps: 7420, avgSleep: 7.8, daysWithData: 5 },
    dayInProgress: true,
    ...patch,
  };
}

function stat(stats: ReturnType<typeof buildDayStats>, key: string) {
  return stats.find((s) => s.key === key);
}

describe('buildDayStats', () => {
  it('carries a target for every steerable metric', () => {
    const stats = buildDayStats(input());
    expect(stat(stats, 'calories')?.target).toBe('1.900–2.100');
    expect(stat(stats, 'protein')?.target).toBe('130–160 g');
    expect(stat(stats, 'steps')?.target).toBe('8.000');
  });

  it('leaves carbs and fat without a target — the phase does not steer them', () => {
    const stats = buildDayStats(input());
    expect(stat(stats, 'carbs')?.target).toBeNull();
    expect(stat(stats, 'fat')?.target).toBeNull();
  });

  it('compares against the user’s own recent average', () => {
    const stats = buildDayStats(input());
    // 6420 against an average of 7420 is about 13% below.
    expect(stat(stats, 'steps')?.vsAverage).toBe(-13);
  });

  it('withholds the comparison when there is too little history', () => {
    const stats = buildDayStats(input({ weekly: { avgKcal: 2000, avgProtein: 140, avgSteps: 7000, avgSleep: 8, daysWithData: 2 } }));
    expect(stat(stats, 'steps')?.vsAverage).toBeNull();
    expect(stat(stats, 'calories')?.vsAverage).toBeNull();
  });

  it('withholds the comparison when no average exists at all', () => {
    const stats = buildDayStats(input({ weekly: { avgKcal: null, avgProtein: null, avgSteps: null, avgSleep: null, daysWithData: 5 } }));
    expect(stat(stats, 'calories')?.vsAverage).toBeNull();
  });

  it('stays neutral on metrics with nothing logged', () => {
    const stats = buildDayStats(input({ totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } }));
    expect(stat(stats, 'calories')?.tone).toBe('neutral');
    expect(stat(stats, 'protein')?.tone).toBe('neutral');
  });

  it('never marks protein above the range as an overshoot', () => {
    const stats = buildDayStats(input({ totals: { kcal: 1900, proteinG: 220, carbsG: 100, fatG: 60 } }));
    expect(stat(stats, 'protein')?.tone).toBe('green');
  });

  it('only shows health metrics that were actually supplied', () => {
    const without = buildDayStats(input());
    expect(stat(without, 'activeEnergy')).toBeUndefined();
    expect(stat(without, 'distance')).toBeUndefined();

    const withHealth = buildDayStats(input({
      metrics: { steps: 6420, waterMl: 1750, sleepH: 8.3, activeEnergyKcal: 520, walkingDistanceM: 5300 },
    }));
    expect(stat(withHealth, 'activeEnergy')?.value).toBe('520 kcal');
    expect(stat(withHealth, 'distance')?.value).toBe('5,3 km');
  });

  it('shows a dash rather than zero for untracked sleep', () => {
    const stats = buildDayStats(input({ metrics: { steps: 0, waterMl: 0, sleepH: 0, activeEnergyKcal: 0, walkingDistanceM: 0 } }));
    expect(stat(stats, 'sleep')?.value).toBe('–');
    expect(stat(stats, 'sleep')?.tone).toBe('neutral');
  });
});

describe('macroSplit', () => {
  it('splits calories by macro and adds up to about 100', () => {
    const split = macroSplit({ kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 });
    expect(split).not.toBeNull();
    const total = (split?.protein ?? 0) + (split?.carbs ?? 0) + (split?.fat ?? 0);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });

  it('returns nothing for an empty day rather than dividing by zero', () => {
    expect(macroSplit({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })).toBeNull();
  });

  it('weights fat at nine calories per gram', () => {
    const split = macroSplit({ kcal: 0, proteinG: 25, carbsG: 25, fatG: 25 });
    expect((split?.fat ?? 0)).toBeGreaterThan(split?.protein ?? 0);
  });
});

describe('describeDelta', () => {
  it('calls a small difference what it is', () => {
    expect(describeDelta(3)).toBe('wie sonst');
    expect(describeDelta(-5)).toBe('wie sonst');
  });

  it('names a real difference in both directions', () => {
    expect(describeDelta(24)).toBe('+24 % über Schnitt');
    expect(describeDelta(-18)).toBe('-18 % unter Schnitt');
  });

  it('says nothing when there is nothing to compare', () => {
    expect(describeDelta(null)).toBeNull();
  });
});
