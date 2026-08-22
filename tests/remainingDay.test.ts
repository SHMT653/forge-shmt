import { describe, expect, it } from 'vitest';
import { describeRemaining, remainingBudget, suggestFits, type FitCandidate } from '@/domain/remainingDay';
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
});

const metrics = { steps: 6420, waterMl: 1750 };

function macros(kcal: number, proteinG: number) {
  return { kcal, proteinG, carbsG: 0, fatG: 0 };
}

const library: FitCandidate[] = [
  { id: 'skyr', name: 'Skyr 450 g', macros: macros(290, 45), kind: 'food' },
  { id: 'iso', name: 'Isoclear', macros: macros(95, 25), kind: 'food' },
  { id: 'pasta', name: 'Chicken Pasta', macros: macros(610, 57), kind: 'recipe' },
  { id: 'chips', name: 'Chips', macros: macros(540, 6), kind: 'food' },
  { id: 'huge', name: 'Familienpizza', macros: macros(2400, 90), kind: 'food' },
];

describe('remainingBudget', () => {
  it('reports headroom to the top and the gap to the bottom of the range', () => {
    const budget = remainingBudget(macros(1540, 118), metrics, targets, 3);
    expect(budget.kcalToMax).toBe(560);
    expect(budget.kcalToMin).toBe(360);
    expect(budget.proteinToMin).toBe(12);
  });

  it('goes negative on calories once over the range', () => {
    expect(remainingBudget(macros(2400, 150), metrics, targets, 4).kcalToMax).toBe(-300);
  });

  it('never reports a negative protein gap', () => {
    expect(remainingBudget(macros(1800, 200), metrics, targets, 4).proteinToMin).toBe(0);
  });

  it('recognises an untouched day', () => {
    expect(remainingBudget(macros(0, 0), metrics, targets, 0).state).toBe('empty');
  });

  it('flags a tight day: big protein gap, little headroom', () => {
    // 60 g protein left but only 200 kcal to play with.
    expect(remainingBudget(macros(1900, 70), metrics, targets, 4).state).toBe('tight');
  });

  it('reports over rather than pretending there is room', () => {
    expect(remainingBudget(macros(2600, 150), metrics, targets, 5).state).toBe('over');
  });

  it('counts steps and water still open', () => {
    const budget = remainingBudget(macros(1540, 118), metrics, targets, 3);
    expect(budget.stepsLeft).toBe(1580);
    expect(budget.waterLeftMl).toBe(750);
  });

  it('clamps met targets to zero rather than going negative', () => {
    const budget = remainingBudget(macros(1540, 118), { steps: 12000, waterMl: 3000 }, targets, 3);
    expect(budget.stepsLeft).toBe(0);
    expect(budget.waterLeftMl).toBe(0);
  });
});

describe('suggestFits', () => {
  it('only offers what still fits in the remaining calories', () => {
    const budget = remainingBudget(macros(1540, 118), metrics, targets, 3);
    const fits = suggestFits(library, budget);
    expect(fits.map((f) => f.id)).not.toContain('huge');
    expect(fits.map((f) => f.id)).not.toContain('pasta');
  });

  it('leads with protein density when protein is short', () => {
    const budget = remainingBudget(macros(1500, 60), metrics, targets, 3);
    const fits = suggestFits(library, budget);
    // Isoclear carries the most protein per calorie.
    expect(fits[0]?.id).toBe('iso');
    expect(fits.map((f) => f.id)).not.toContain('chips');
  });

  it('suggests nothing once the day is effectively full', () => {
    const budget = remainingBudget(macros(2090, 150), metrics, targets, 5);
    expect(suggestFits(library, budget)).toEqual([]);
  });

  it('suggests nothing when already over', () => {
    const budget = remainingBudget(macros(2500, 150), metrics, targets, 5);
    expect(suggestFits(library, budget)).toEqual([]);
  });

  it('reports how much of the gap an item closes', () => {
    const budget = remainingBudget(macros(1500, 90), metrics, targets, 3);
    const skyr = suggestFits(library, budget, 5).find((f) => f.id === 'skyr');
    // 45 g against a 40 g gap covers all of it.
    expect(skyr?.proteinCoverage).toBe(1);
  });

  it('honours the limit', () => {
    const budget = remainingBudget(macros(1000, 40), metrics, targets, 2);
    expect(suggestFits(library, budget, 2)).toHaveLength(2);
  });

  it('copes with an empty library', () => {
    expect(suggestFits([], remainingBudget(macros(1000, 40), metrics, targets, 2))).toEqual([]);
  });
});

describe('describeRemaining', () => {
  it('names both numbers when protein is short', () => {
    const text = describeRemaining(remainingBudget(macros(1400, 80), metrics, targets, 3), targets);
    expect(text).toContain('Protein');
    expect(text).toContain('Spielraum');
  });

  it('stays non-judgemental when over the range', () => {
    const text = describeRemaining(remainingBudget(macros(2600, 150), metrics, targets, 5), targets);
    expect(text).toContain('Wochenschnitt');
    expect(text.toLowerCase()).not.toMatch(/versag|schlecht|zu viel gegessen/);
  });

  it('invites a first entry on an empty day', () => {
    expect(describeRemaining(remainingBudget(macros(0, 0), metrics, targets, 0), targets)).toContain('Noch nichts');
  });

  it('says plainly when the day is done', () => {
    expect(describeRemaining(remainingBudget(macros(2000, 150), metrics, targets, 5), targets)).toContain('durch');
  });
});
