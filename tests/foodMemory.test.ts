import { describe, expect, it } from 'vitest';
import { foodKey, perPortion, shouldRemember } from '@/domain/foodMemory';

const macros = { kcal: 280, proteinG: 8, carbsG: 45, fatG: 6 };

describe('foodKey', () => {
  it('treats spelling variants of the same food as one entry', () => {
    expect(foodKey('Brötchen mit Marmelade')).toBe(foodKey('brötchen  mit marmelade'));
    expect(foodKey('BRÖTCHEN MIT MARMELADE')).toBe(foodKey('brötchen mit marmelade'));
  });

  it('ignores punctuation', () => {
    expect(foodKey('Skyr, 0,2 %')).toBe(foodKey('Skyr 0 2 %'));
  });

  it('keeps genuinely different foods apart', () => {
    expect(foodKey('Brötchen mit Marmelade')).not.toBe(foodKey('Brötchen mit Käse'));
  });
});

describe('shouldRemember', () => {
  it('files a hand-typed meal', () => {
    expect(shouldRemember({ name: 'Brötchen mit Marmelade', macros }, [])).toBe(true);
  });

  it('does not file the same food twice', () => {
    const existing = [foodKey('brötchen mit marmelade')];
    expect(shouldRemember({ name: 'Brötchen mit Marmelade', macros }, existing)).toBe(false);
  });

  it('skips entries that already come from the library, a recipe or a batch', () => {
    expect(shouldRemember({ name: 'Skyr', macros, foodItemId: 'f1' }, [])).toBe(false);
    expect(shouldRemember({ name: 'Chili', macros, recipeId: 'r1' }, [])).toBe(false);
    expect(shouldRemember({ name: 'Meal Prep', macros, batchId: 'b1' }, [])).toBe(false);
  });

  it('refuses a value FORGE could not establish', () => {
    // Storing a guess as a reusable product would launder it into a fact (§20).
    expect(shouldRemember({ name: 'Irgendwas vom Italiener', macros, dataQuality: 'unknown' }, [])).toBe(false);
  });

  it('refuses an entry without calories', () => {
    expect(shouldRemember({ name: 'Wasser', macros: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } }, [])).toBe(false);
  });

  it('refuses a name that describes an amount rather than a food', () => {
    expect(shouldRemember({ name: '500', macros }, [])).toBe(false);
    expect(shouldRemember({ name: '2x', macros }, [])).toBe(false);
    expect(shouldRemember({ name: 'Ei', macros }, [])).toBe(false);
  });

  it('keeps an estimate, but as an estimate', () => {
    expect(shouldRemember({ name: 'Döner mit allem', macros, dataQuality: 'estimated' }, [])).toBe(true);
  });
});

describe('perPortion', () => {
  it('stores one portion, not the whole plate', () => {
    // Logged "2 Brötchen" at 560 kcal — the library entry means one.
    expect(perPortion({ kcal: 560, proteinG: 16, carbsG: 90, fatG: 12 }, 2))
      .toEqual({ kcal: 280, proteinG: 8, carbsG: 45, fatG: 6 });
  });

  it('leaves a single serving untouched', () => {
    expect(perPortion(macros, 1)).toEqual(macros);
    expect(perPortion(macros, undefined)).toEqual(macros);
  });

  it('handles half portions', () => {
    expect(perPortion({ kcal: 140, proteinG: 4, carbsG: 22, fatG: 3 }, 0.5).kcal).toBe(280);
  });
});
