import { describe, expect, it } from 'vitest';
import { evaluateGoal, evaluateRange, formatRange, resolveTargets, PHASES } from '@/domain/goalPhase';
import { GOALS_DEFAULTS } from '@/data/profile';
import type { UserGoals } from '@/domain/types';

function goals(patch: Partial<UserGoals> = {}): UserGoals {
  return { ...GOALS_DEFAULTS, ...patch };
}

describe('resolveTargets', () => {
  it('prefers explicitly stored ranges over anything derived', () => {
    const targets = resolveTargets(goals({ caloriesMin: 1900, caloriesMax: 2100, proteinMin: 130, proteinMax: 160 }));
    expect(targets.calories).toEqual({ min: 1900, max: 2100 });
    expect(targets.protein).toEqual({ min: 130, max: 160 });
    expect(targets.explicit).toBe(true);
  });

  it('derives a range from TDEE and phase when none is stored', () => {
    // 20yo male, 185 cm, 73 kg, moderately active — the profile in the brief.
    const targets = resolveTargets(
      goals({ currentWeight: 73, heightCm: 185, birthYear: 2006, gender: 'male', activityLevel: 'moderate', phaseType: 'cut' }),
    );
    expect(targets.calories.min).toBeLessThan(targets.calories.max);
    expect(targets.calories.max - targets.calories.min).toBeLessThanOrEqual(250);
    // A cut must land below maintenance.
    const maintain = resolveTargets(
      goals({ currentWeight: 73, heightCm: 185, birthYear: 2006, gender: 'male', activityLevel: 'moderate', phaseType: 'maintain' }),
    );
    expect(targets.calories.max).toBeLessThan(maintain.calories.max);
  });

  it('scales protein with bodyweight for the phase', () => {
    const targets = resolveTargets(goals({ currentWeight: 73, phaseType: 'cut' }));
    expect(targets.protein.min).toBeGreaterThanOrEqual(73 * PHASES.cut.proteinPerKg.min - 5);
    expect(targets.protein.max).toBeLessThanOrEqual(73 * PHASES.cut.proteinPerKg.max + 5);
  });

  it('widens a legacy single goal into a range when the profile is incomplete', () => {
    // This is the pre-migration user: no height, no age, one calorie number.
    const targets = resolveTargets(goals({ calorieGoal: 2200, proteinGoal: 150 }));
    expect(targets.calories.min).toBeLessThan(2200);
    expect(targets.calories.max).toBeGreaterThan(2200);
    expect(targets.protein.min).toBe(150);
  });

  it('maps the legacy goalType onto a phase', () => {
    expect(resolveTargets(goals({ goalType: 'fat_loss' })).phase.type).toBe('cut');
    expect(resolveTargets(goals({ goalType: 'muscle' })).phase.type).toBe('lean_bulk');
    expect(resolveTargets(goals({ goalType: 'maintain' })).phase.type).toBe('maintain');
  });

  it('never derives a starvation-level target', () => {
    const targets = resolveTargets(goals({ currentWeight: 45, heightCm: 150, birthYear: 2006, activityLevel: 'sedentary', phaseType: 'cut' }));
    expect(targets.calories.min).toBeGreaterThanOrEqual(1200);
  });
});

describe('evaluateRange', () => {
  const range = { min: 1900, max: 2100 };

  it('is green inside the range', () => {
    expect(evaluateRange(2000, range).tone).toBe('green');
    expect(evaluateRange(2000, range).status).toBe('in');
  });

  it('treats being under as fine while the day is still running', () => {
    const result = evaluateRange(1200, range, { dayInProgress: true });
    expect(result.status).toBe('under');
    expect(result.tone).toBe('green');
  });

  it('flags clear under-eating once the day is done (§16)', () => {
    const result = evaluateRange(1200, range, { dayInProgress: false });
    expect(result.status).toBe('far_under');
    expect(result.tone).toBe('yellow');
  });

  it('separates slightly over from clearly over (§6)', () => {
    expect(evaluateRange(2250, range).status).toBe('slightly_over');
    expect(evaluateRange(2250, range).tone).toBe('yellow');
    expect(evaluateRange(2800, range).status).toBe('over');
    expect(evaluateRange(2800, range).tone).toBe('red');
  });

  it('stays neutral when nothing has been logged', () => {
    expect(evaluateRange(0, range, { dayInProgress: true }).tone).toBe('neutral');
  });

  it('reports the deviation in the value unit', () => {
    expect(evaluateRange(2300, range).deviation).toBe(200);
    expect(evaluateRange(2000, range).deviation).toBe(0);
  });
});

describe('evaluateGoal', () => {
  it('is green once the goal is met', () => {
    expect(evaluateGoal(8000, 8000).tone).toBe('green');
    expect(evaluateGoal(9000, 8000).fraction).toBe(1);
  });

  it('is neutral at zero rather than red', () => {
    expect(evaluateGoal(0, 8000).tone).toBe('neutral');
  });

  it('is forgiving mid-day when most of the way there', () => {
    expect(evaluateGoal(6500, 8000, true).tone).toBe('green');
    expect(evaluateGoal(1000, 8000, true).tone).toBe('yellow');
  });
});

describe('formatRange', () => {
  it('formats with a German thousands separator', () => {
    expect(formatRange({ min: 1900, max: 2100 }, 'kcal')).toBe('1.900–2.100 kcal');
  });
});

describe('recentHitRate (§43)', () => {
  it('reports hits over the window instead of collapsing to zero', async () => {
    const { recentHitRate } = await import('@/domain/streaks');
    const { todayKey, dateKeyAddDays } = await import('@/domain/dates');
    const today = todayKey();
    // Missed yesterday, hit the other five of the last six days.
    const days = [0, 2, 3, 4, 5, 6].map((offset) => dateKeyAddDays(today, -offset));
    const rate = recentHitRate(days);
    expect(rate.hits).toBe(6);
    expect(rate.total).toBe(7);
  });

  it('is zero for an empty history without throwing', async () => {
    const { recentHitRate } = await import('@/domain/streaks');
    expect(recentHitRate([])).toEqual({ hits: 0, total: 7 });
  });
});
