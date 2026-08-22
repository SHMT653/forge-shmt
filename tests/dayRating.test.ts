import { describe, expect, it } from 'vitest';
import { rateDay, summarizeRatings, type DayAggregate } from '@/domain/dayRating';
import { resolveTargets } from '@/domain/goalPhase';
import { monthGrid } from '@/web/hooks/useCalendar';
import { GOALS_DEFAULTS } from '@/data/profile';

const targets = resolveTargets({
  ...GOALS_DEFAULTS,
  caloriesMin: 1900,
  caloriesMax: 2100,
  proteinMin: 130,
  proteinMax: 160,
  stepsGoal: 8000,
  sleepGoalH: 8,
});

function day(patch: Partial<DayAggregate> = {}): DayAggregate {
  return {
    date: '2026-08-21',
    kcal: null,
    proteinG: null,
    steps: null,
    sleepH: null,
    trained: false,
    miniSession: false,
    ...patch,
  };
}

describe('rateDay', () => {
  it('is neutral and scoreless for a day with nothing recorded', () => {
    const rating = rateDay(day(), targets);
    expect(rating.tone).toBe('neutral');
    expect(rating.score).toBeNull();
    expect(rating.hasData).toBe(false);
  });

  it('is green for a day inside every target', () => {
    const rating = rateDay(day({ kcal: 2000, proteinG: 145, steps: 8500, sleepH: 8, trained: true }), targets);
    expect(rating.tone).toBe('green');
    expect(rating.score).toBeGreaterThanOrEqual(9);
  });

  it('is red when the day went clearly wrong', () => {
    const rating = rateDay(day({ kcal: 3400, proteinG: 40, steps: 800, sleepH: 4 }), targets);
    expect(rating.tone).toBe('red');
  });

  it('judges only what was tracked — untracked metrics cost nothing', () => {
    // Someone who only logs food should not go orange for never logging sleep.
    const onlyFood = rateDay(day({ kcal: 2000, proteinG: 145 }), targets);
    expect(onlyFood.tone).toBe('green');
  });

  it('does not penalise a rest day for having no training', () => {
    const rest = rateDay(day({ kcal: 2000, proteinG: 145, steps: 8200, sleepH: 8 }), targets);
    const trainedDay = rateDay(day({ kcal: 2000, proteinG: 145, steps: 8200, sleepH: 8, trained: true }), targets);
    expect(rest.tone).toBe('green');
    expect(trainedDay.score).toBeGreaterThanOrEqual(rest.score ?? 0);
  });

  it('counts a mini session, but below a full one', () => {
    const mini = rateDay(day({ kcal: 3000, miniSession: true }), targets);
    const full = rateDay(day({ kcal: 3000, trained: true }), targets);
    expect((full.score ?? 0)).toBeGreaterThan(mini.score ?? 0);
    expect(mini.notes).toContain('Mini-Session');
  });

  it('never treats extra protein as an overshoot', () => {
    const rating = rateDay(day({ proteinG: 220 }), targets);
    expect(rating.tone).toBe('green');
  });

  it('explains what was off', () => {
    const rating = rateDay(day({ kcal: 2900, proteinG: 60 }), targets);
    expect(rating.notes.join(' ')).toContain('über dem Kalorienbereich');
    expect(rating.notes.join(' ')).toContain('Protein');
  });

  it('flags under-eating as much as over-eating', () => {
    const rating = rateDay(day({ kcal: 900 }), targets);
    expect(rating.notes.join(' ')).toContain('unter dem Kalorienbereich');
  });
});

describe('summarizeRatings', () => {
  it('counts only days that hold data', () => {
    const ratings = [
      rateDay(day({ date: '2026-08-01', kcal: 2000, proteinG: 145 }), targets),
      rateDay(day({ date: '2026-08-02' }), targets),
      rateDay(day({ date: '2026-08-03', kcal: 3400, proteinG: 30 }), targets),
    ];
    const summary = summarizeRatings(ratings);
    expect(summary.tracked).toBe(2);
    expect(summary.green).toBe(1);
    expect(summary.red).toBe(1);
  });

  it('returns a null average when nothing was tracked', () => {
    expect(summarizeRatings([rateDay(day(), targets)]).averageScore).toBeNull();
  });

  it('counts training days', () => {
    const ratings = [
      rateDay(day({ date: '2026-08-01', kcal: 2000, trained: true }), targets),
      rateDay(day({ date: '2026-08-02', kcal: 2000, miniSession: true }), targets),
    ];
    expect(summarizeRatings(ratings).trainingDays).toBe(1);
  });
});

describe('monthGrid', () => {
  it('starts on a Monday and covers whole weeks', () => {
    const grid = monthGrid('2026-08-01');
    expect(grid.days.length % 7).toBe(0);
    const [y, m, d] = (grid.days[0] ?? '').split('-').map(Number);
    expect(new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getDay()).toBe(1);
  });

  it('contains every day of the month', () => {
    const grid = monthGrid('2026-08-01');
    expect(grid.days).toContain('2026-08-01');
    expect(grid.days).toContain('2026-08-31');
  });

  it('handles February in a leap year', () => {
    const grid = monthGrid('2028-02-01');
    expect(grid.days).toContain('2028-02-29');
    expect(grid.days.length % 7).toBe(0);
  });

  it('handles a month starting on a Sunday', () => {
    // 2026-11-01 is a Sunday — the grid must lead with the prior Monday.
    const grid = monthGrid('2026-11-01');
    expect(grid.days[0]).toBe('2026-10-26');
    expect(grid.days).toContain('2026-11-30');
  });
});
