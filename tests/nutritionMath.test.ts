import { describe, expect, it } from 'vitest';
import {
  combineQuality, deriveRange, estimateCarbsFat, formatKcal, formatKcalRange,
  macrosForServings, roundMacros, scaleMacros, slotForHour, sumMacros,
} from '@/domain/nutritionMath';
import type { Recipe } from '@/domain/types';

// The Caesar wrap from the brief: one recipe, four wraps.
const wrapRecipe: Recipe = {
  id: 'r1',
  name: 'Caesar Chicken Wrap',
  totalServings: 4,
  servingLabel: 'Wrap',
  isMealPrep: false,
  favorite: true,
  notes: '',
  useCount: 0,
  ingredients: [],
  totalMacros: { kcal: 1520, proteinG: 152, carbsG: 140, fatG: 44 },
  perServing: { kcal: 380, proteinG: 38, carbsG: 35, fatG: 11 },
};

describe('recipe servings (§12)', () => {
  it('returns per-serving macros for one portion', () => {
    expect(macrosForServings(wrapRecipe, 1)).toEqual({ kcal: 380, proteinG: 38, carbsG: 35, fatG: 11 });
  });

  it('handles fractional portions', () => {
    expect(macrosForServings(wrapRecipe, 0.5).kcal).toBe(190);
    expect(macrosForServings(wrapRecipe, 0.75).kcal).toBe(285);
  });

  it('handles multiple portions', () => {
    expect(macrosForServings(wrapRecipe, 2).kcal).toBe(760);
    expect(macrosForServings(wrapRecipe, 2).proteinG).toBe(76);
  });

  it('keeps the whole recipe consistent with its parts', () => {
    const all = macrosForServings(wrapRecipe, wrapRecipe.totalServings);
    expect(all.kcal).toBe(wrapRecipe.totalMacros.kcal);
  });
});

describe('sumMacros', () => {
  it('adds a day of entries', () => {
    const total = sumMacros([
      { kcal: 340, proteinG: 46, carbsG: 30, fatG: 4 },
      { kcal: 95, proteinG: 25, carbsG: 1, fatG: 0 },
      { kcal: 380, proteinG: 38, carbsG: 35, fatG: 11 },
    ]);
    expect(total.kcal).toBe(815);
    expect(total.proteinG).toBe(109);
  });

  it('returns zeroes for an empty day', () => {
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('does not mutate a shared accumulator across calls', () => {
    sumMacros([{ kcal: 100, proteinG: 1, carbsG: 1, fatG: 1 }]);
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('scaleMacros / roundMacros', () => {
  it('scales without accumulating float noise', () => {
    expect(scaleMacros({ kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 }, 1 / 3).kcal).toBe(33.3);
  });

  it('rounds to whole numbers for storage', () => {
    expect(roundMacros({ kcal: 33.3, proteinG: 3.33, carbsG: 1.67, fatG: 0.67 })).toEqual({
      kcal: 33, proteinG: 3, carbsG: 2, fatG: 1,
    });
  });
});

describe('estimateCarbsFat', () => {
  it('splits the non-protein calories', () => {
    const { carbsG, fatG } = estimateCarbsFat(600, 40);
    // 600 - 160 = 440 kcal left to split
    expect(carbsG * 4 + fatG * 9).toBeGreaterThan(400);
    expect(carbsG * 4 + fatG * 9).toBeLessThan(480);
  });

  it('never returns negative macros when protein exceeds the calories', () => {
    const { carbsG, fatG } = estimateCarbsFat(100, 50);
    expect(carbsG).toBeGreaterThanOrEqual(0);
    expect(fatG).toBeGreaterThanOrEqual(0);
  });
});

describe('combineQuality (§11)', () => {
  it('is verified only when everything is', () => {
    expect(combineQuality(['verified', 'verified'])).toBe('verified');
    expect(combineQuality([])).toBe('verified');
  });

  it('degrades to the weakest link', () => {
    expect(combineQuality(['verified', 'estimated'])).toBe('estimated');
    expect(combineQuality(['verified', 'estimated', 'unknown'])).toBe('unknown');
  });
});

describe('honest number formatting (§56)', () => {
  it('marks estimates with a tilde', () => {
    expect(formatKcal(812, 'verified')).toBe('812 kcal');
    expect(formatKcal(812, 'estimated')).toBe('~812 kcal');
  });

  it('prefers a range over false precision', () => {
    expect(formatKcalRange(700, 900, 812)).toBe('ca. 700–900 kcal');
  });

  it('falls back to a single figure when no range exists', () => {
    expect(formatKcalRange(null, null, 812)).toBe('~812 kcal');
  });

  it('does not invent a range from an inverted pair', () => {
    expect(formatKcalRange(900, 700, 812)).toBe('~812 kcal');
  });

  it('derives a rounded band around an estimate', () => {
    const range = deriveRange(800);
    expect(range.min).toBeLessThan(800);
    expect(range.max).toBeGreaterThan(800);
    expect(range.min % 50).toBe(0);
  });
});

describe('slotForHour', () => {
  it('picks the meal slot from the clock', () => {
    expect(slotForHour(8)).toBe('breakfast');
    expect(slotForHour(13)).toBe('lunch');
    expect(slotForHour(19)).toBe('dinner');
    expect(slotForHour(23)).toBe('snack');
  });
});
