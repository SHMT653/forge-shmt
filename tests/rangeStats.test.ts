import { describe, expect, it } from 'vitest';
import { summarizeRange } from '@/domain/rangeStats';
import { resolveTargets } from '@/domain/goalPhase';
import type { DayAggregate } from '@/domain/dayRating';
import type { UserGoals } from '@/domain/types';

const targets = resolveTargets({
  calorieGoal: 2400, proteinGoal: 160, caloriesMin: 2200, caloriesMax: 2600,
  proteinMin: 150, proteinMax: 200, stepsGoal: 10000, waterGoalMl: 3000, sleepGoalH: 8,
  weeklyTrainingGoal: 3, phaseType: null, goalType: 'maintain',
} as unknown as UserGoals);

const day = (date: string, patch: Partial<DayAggregate> = {}): DayAggregate => ({
  date, kcal: null, proteinG: null, steps: null, sleepH: null, waterMl: null,
  trained: false, miniSession: false, ...patch,
});

describe('summarizeRange', () => {
  it('averages over the days that hold the metric, not the whole span', () => {
    // Ten logged days out of thirty must not read as a third of the intake.
    const days = [
      day('2026-08-01', { kcal: 2400 }),
      day('2026-08-02', { kcal: 2600 }),
      ...Array.from({ length: 8 }, (_, i) => day(`2026-08-${String(i + 3).padStart(2, '0')}`)),
    ];
    const stats = summarizeRange(days, targets);
    expect(stats.avgKcal).toBe(2500);
    expect(stats.days).toBe(10);
    expect(stats.nutritionDays).toBe(2);
  });

  it('counts days on target against the days that could have been', () => {
    const days = [
      day('2026-08-01', { kcal: 2400, proteinG: 170 }),
      day('2026-08-02', { kcal: 3200, proteinG: 90 }),
      day('2026-08-03', { kcal: 2300, proteinG: 155 }),
    ];
    const stats = summarizeRange(days, targets);
    expect(stats.daysInCalorieRange).toBe(2);
    expect(stats.daysProteinHit).toBe(2);
  });

  it('treats protein above the range as hit, never as overshoot', () => {
    const stats = summarizeRange([day('2026-08-01', { kcal: 2400, proteinG: 260 })], targets);
    expect(stats.daysProteinHit).toBe(1);
  });

  it('normalises training to sessions per week so spans compare', () => {
    const twoWeeks = Array.from({ length: 14 }, (_, i) =>
      day(`2026-08-${String(i + 1).padStart(2, '0')}`, { trained: i % 3 === 0 }),
    );
    const stats = summarizeRange(twoWeeks, targets);
    expect(stats.fullWorkouts).toBe(5);
    expect(stats.workoutsPerWeek).toBe(2.5);
  });

  it('counts the longest unbroken run of tracked days', () => {
    const days = [
      day('2026-08-01', { kcal: 2000 }),
      day('2026-08-02', { kcal: 2000 }),
      day('2026-08-03'),
      day('2026-08-04', { steps: 8000 }),
      day('2026-08-05', { trained: true }),
      day('2026-08-06', { kcal: 2000 }),
    ];
    expect(summarizeRange(days, targets).longestStreak).toBe(3);
  });

  it('finds the streak regardless of the order it is handed', () => {
    const days = [
      day('2026-08-03'),
      day('2026-08-02', { kcal: 2000 }),
      day('2026-08-01', { kcal: 2000 }),
    ];
    expect(summarizeRange(days, targets).longestStreak).toBe(2);
  });

  it('reports an empty span as empty rather than as zeroes', () => {
    const stats = summarizeRange([day('2026-08-01'), day('2026-08-02')], targets);
    expect(stats.trackedDays).toBe(0);
    expect(stats.avgKcal).toBeNull();
    expect(stats.avgProtein).toBeNull();
  });

  it('counts a training day whether it was full or mini', () => {
    const days = [
      day('2026-08-01', { trained: true }),
      day('2026-08-02', { miniSession: true }),
      day('2026-08-03'),
    ];
    const stats = summarizeRange(days, targets);
    expect(stats.trainingDays).toBe(2);
    expect(stats.fullWorkouts).toBe(1);
    expect(stats.miniSessions).toBe(1);
  });
});
