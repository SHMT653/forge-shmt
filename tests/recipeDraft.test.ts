import { describe, expect, it } from 'vitest';
import {
  describeIngredientAmount,
  draftPerServing,
  draftTotals,
  emptyRecipeDraft,
  firstOpenStep,
  ingredientDraftFromSaved,
  ingredientFromPortion,
  ingredientMacros,
  manualIngredient,
  stepIssue,
  type RecipeDraft,
} from '@/domain/recipeDraft';

/**
 * The point of a recipe is that "eine Portion" carries real numbers. That only
 * holds if changing an amount rescales the ingredient and the division by the
 * yield survives a half-typed field - an empty portions box must not turn the
 * preview into Infinity.
 */

const CHICKEN = ingredientFromPortion({
  key: 'a',
  name: 'Hähnchenbrust',
  macros: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  portionG: 100,
  portionLabel: '100 g',
});

const RICE = ingredientFromPortion({
  key: 'b',
  name: 'Reis',
  macros: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
  portionG: 100,
  portionLabel: '100 g',
});

function draftWith(ingredients: RecipeDraft['ingredients'], servings = '2'): RecipeDraft {
  return { ...emptyRecipeDraft(), name: 'Hähnchen mit Reis', servings, ingredients };
}

describe('ingredientFromPortion', () => {
  it('measures a product with a known weight in grams', () => {
    expect(CHICKEN.unit).toBe('g');
    expect(CHICKEN.amount).toBe('100');
    expect(CHICKEN.perUnit.kcal).toBeCloseTo(1.65);
  });

  it('falls back to portions when there is no weight', () => {
    const egg = ingredientFromPortion({
      key: 'c',
      name: 'Ei',
      macros: { kcal: 78, proteinG: 6, carbsG: 0.6, fatG: 5 },
      portionG: null,
      portionLabel: '1 Stück',
    });

    expect(egg.unit).toBe('portion');
    expect(egg.amount).toBe('1');
    expect(egg.perUnit.kcal).toBe(78);
  });

  it('keeps millilitres for a liquid', () => {
    const milk = ingredientFromPortion({
      key: 'd',
      name: 'Milch',
      macros: { kcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.5 },
      portionG: 100,
      portionLabel: '100 ml',
    });

    expect(milk.unit).toBe('ml');
    expect(describeIngredientAmount(milk)).toBe('100 ml');
  });
});

describe('draftTotals', () => {
  it('rescales an ingredient when the amount changes', () => {
    const single = draftTotals(draftWith([CHICKEN]));
    const doubled = draftTotals(draftWith([{ ...CHICKEN, amount: '200' }]));

    expect(single.kcal).toBeCloseTo(165);
    expect(doubled.kcal).toBeCloseTo(330);
    expect(doubled.proteinG).toBeCloseTo(62);
  });

  it('ignores ingredients without a usable amount', () => {
    const totals = draftTotals(draftWith([CHICKEN, { ...RICE, amount: '' }]));
    expect(totals.kcal).toBeCloseTo(165);
  });

  it('splits the total across the portions', () => {
    const perServing = draftPerServing(draftWith([CHICKEN, { ...RICE, amount: '150' }], '2'));

    // 165 + 195 kcal over two portions
    expect(perServing.kcal).toBe(180);
    expect(perServing.proteinG).toBe(18);
  });

  it('treats a half-typed yield as one portion instead of dividing by zero', () => {
    const perServing = draftPerServing(draftWith([CHICKEN], ''));
    expect(Number.isFinite(perServing.kcal)).toBe(true);
    expect(perServing.kcal).toBe(165);
  });

  it('takes hand-typed macros as they are', () => {
    const sauce = manualIngredient('e', 'Soße', { kcal: 90, proteinG: 1, carbsG: 6, fatG: 7 });
    expect(draftTotals(draftWith([sauce])).kcal).toBe(90);
  });
});

describe('ingredientDraftFromSaved', () => {
  it('reads a gram amount back instead of collapsing it to one portion', () => {
    const draft = ingredientDraftFromSaved({
      id: 'i1',
      name: 'Hähnchenbrust',
      amountLabel: '180 g',
      macros: { kcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.5 },
      foodItemId: null,
    });

    expect(draft.unit).toBe('g');
    expect(draft.amount).toBe('180');
    expect(draft.perUnit.kcal).toBeCloseTo(1.65);
    // Editing the amount now rescales as it did when the recipe was written.
    expect(ingredientMacros({ ...draft, amount: '90' }).kcal).toBeCloseTo(148.5);
  });

  it('survives a label it cannot parse', () => {
    const draft = ingredientDraftFromSaved({
      id: 'i2',
      name: 'Soße',
      amountLabel: 'nach Gefühl',
      macros: { kcal: 90, proteinG: 1, carbsG: 6, fatG: 7 },
      foodItemId: null,
    });

    expect(draft.unit).toBe('portion');
    expect(ingredientMacros(draft).kcal).toBe(90);
  });

  it('round-trips what the editor writes', () => {
    const saved = {
      id: 'i3',
      name: 'Reis',
      amountLabel: describeIngredientAmount({ ...RICE, amount: '150' }),
      macros: ingredientMacros({ ...RICE, amount: '150' }),
      foodItemId: null,
    };

    expect(ingredientMacros(ingredientDraftFromSaved(saved)).kcal).toBeCloseTo(195);
  });
});

describe('stepIssue', () => {
  it('asks for a name first', () => {
    expect(stepIssue(emptyRecipeDraft(), 'basics')).toContain('Namen');
  });

  it('asks for the yield when the field is empty', () => {
    const draft = { ...emptyRecipeDraft(), name: 'Chili', servings: '' };
    expect(stepIssue(draft, 'basics')).toContain('Portionen');
  });

  it('wants at least one ingredient with an amount', () => {
    const named = { ...emptyRecipeDraft(), name: 'Chili' };
    expect(stepIssue(named, 'ingredients')).toContain('Zutat');
    expect(stepIssue(draftWith([{ ...CHICKEN, amount: '0' }]), 'ingredients')).toContain('Menge');
    expect(stepIssue(draftWith([CHICKEN]), 'ingredients')).toBeNull();
  });

  it('never blocks the overview', () => {
    expect(stepIssue(emptyRecipeDraft(), 'review')).toBeNull();
  });

  it('opens an edited recipe on the overview', () => {
    expect(firstOpenStep(emptyRecipeDraft())).toBe('basics');
    expect(firstOpenStep(draftWith([CHICKEN]))).toBe('review');
  });
});
