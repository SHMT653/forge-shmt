import { describe, expect, it } from 'vitest';
import { FOOD_DATABASE, estimateMacros, searchFood } from '@/domain/foodDatabase';

/**
 * The curated table is hand-written and long. Nobody re-reads 800 rows, so
 * these checks stand in for that: a duplicate name shadows an entry in the
 * search, a missing portion weight makes the recipe editor fall back to
 * "1 Portion", and macros that do not add up quietly wreck every recipe the
 * entry lands in.
 */

function atwaterKcal(item: { proteinG: number; carbsG?: number; fatG?: number }): number {
  return item.proteinG * 4 + (item.carbsG ?? 0) * 4 + (item.fatG ?? 0) * 9;
}

describe('FOOD_DATABASE', () => {
  it('has no duplicate names', () => {
    const seen = new Map<string, number>();
    for (const item of FOOD_DATABASE) {
      const key = item.name.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    expect(duplicates).toEqual([]);
  });

  it('gives every entry a usable portion', () => {
    const broken = FOOD_DATABASE.filter((item) => !(item.portionG > 0) || !item.portionLabel.trim());
    expect(broken.map((item) => item.name)).toEqual([]);
  });

  it('never spends more calories on protein than the entry has', () => {
    const impossible = FOOD_DATABASE.filter((item) => item.proteinG * 4 > item.kcal * 1.15 + 5);
    expect(impossible.map((item) => item.name)).toEqual([]);
  });

  it('keeps stated macros within reach of the calories', () => {
    // Ethanol and acetic acid carry calories that protein, carbs and fat
    // cannot express, so those entries would always look wrong here.
    const notFromMacros = /bier|wein|sekt|prosecco|wodka|whisky|rum|gin|aperol|hugo|pils|likör|cocktail|schnaps|essig/i;

    const off = FOOD_DATABASE.filter((item) => {
      if (item.carbsG === undefined || item.fatG === undefined) return false;
      if (item.kcal < 20 || notFromMacros.test(item.name)) return false;

      const derived = atwaterKcal(item);
      // Too low means macros are missing or mistyped - that is the direction
      // worth failing on. Deriving high is normal: fibre counts as a carb but
      // yields about 2 kcal/g, which shows up in vegetables and dried herbs.
      return derived < item.kcal * 0.75 || derived > item.kcal * 1.7;
    });

    expect(off.map((item) => `${item.name}: ${item.kcal} kcal vs ${Math.round(atwaterKcal(item))}`)).toEqual([]);
  });

  it('estimates the split only where it is missing', () => {
    const complete = { name: 'x', kcal: 100, proteinG: 10, carbsG: 5, fatG: 4, portionG: 100, portionLabel: '100 g' };
    expect(estimateMacros(complete)).toEqual({ carbsG: 5, fatG: 4 });

    const partial = { name: 'y', kcal: 200, proteinG: 10, portionG: 100, portionLabel: '100 g' };
    const estimated = estimateMacros(partial);
    expect(estimated.carbsG).toBeGreaterThan(0);
    expect(estimated.fatG).toBeGreaterThan(0);
  });

  it('finds the raw ingredients a recipe is built from', () => {
    for (const needle of ['zwiebel', 'knoblauch', 'olivenöl', 'paprikapulver', 'hackfleisch', 'reis roh']) {
      expect(searchFood(needle).length, needle).toBeGreaterThan(0);
    }
  });

  it('measures raw ingredients per 100 g so recipes can scale them', () => {
    const chicken = FOOD_DATABASE.find((item) => item.name === 'Hähnchenbrustfilet roh');
    expect(chicken?.portionG).toBe(100);
    expect(chicken?.portionLabel).toBe('100 g');
  });
});
