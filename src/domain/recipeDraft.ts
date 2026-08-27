import type { Macros } from './types';
import { EMPTY_MACROS, roundMacros, sumMacros } from './nutritionMath';
import { parseDecimal } from './numbers';

/**
 * recipeDraft.ts
 *
 * The arithmetic behind writing a recipe: what a changed amount does to the
 * macros, what one portion ends up being, and what is still missing before the
 * next step of the editor.
 *
 * Ingredients keep their macros *per unit* (one gram, one millilitre, one
 * portion) instead of for the amount as typed. Changing "180" to "220" then
 * stays a multiplication - no reverse-engineering of the previous amount.
 *
 * The scaling here is deliberately unrounded: `scaleMacros` rounds to one
 * decimal, which is right for a plate but wrong for a per-gram base - 1.65
 * kcal/g would become 1.7 and every amount would carry a 3 % error. Rounding
 * happens once, on the way to the screen.
 */

function scaleExact(macros: Macros, factor: number): Macros {
  return {
    kcal: macros.kcal * factor,
    proteinG: macros.proteinG * factor,
    carbsG: macros.carbsG * factor,
    fatG: macros.fatG * factor,
  };
}

export type IngredientUnit = 'g' | 'ml' | 'portion';

export type IngredientDraft = {
  /** Stable key for React lists; ingredients have no id before saving. */
  key: string;
  name: string;
  /** Amount exactly as typed, so a half-written "1," survives a re-render. */
  amount: string;
  unit: IngredientUnit;
  /** Macros of a single unit. */
  perUnit: Macros;
  foodItemId: string | null;
};

export type RecipeDraft = {
  name: string;
  /** Kept as text: an empty field must stay empty while typing. */
  servings: string;
  servingLabel: string;
  ingredients: IngredientDraft[];
};

export const RECIPE_STEPS = ['basics', 'ingredients', 'review'] as const;

export type RecipeStep = (typeof RECIPE_STEPS)[number];

export const RECIPE_STEP_LABEL: Record<RecipeStep, string> = {
  basics: 'Grunddaten',
  ingredients: 'Zutaten',
  review: 'Übersicht',
};

export const UNIT_LABEL: Record<IngredientUnit, string> = {
  g: 'g',
  ml: 'ml',
  portion: 'Portion',
};

export function emptyRecipeDraft(): RecipeDraft {
  return { name: '', servings: '4', servingLabel: 'Portion', ingredients: [] };
}

/** The amount as a number; anything unparsable counts as nothing. */
export function ingredientAmount(ingredient: IngredientDraft): number {
  const amount = parseDecimal(ingredient.amount);
  return amount !== null && amount > 0 ? amount : 0;
}

export function ingredientMacros(ingredient: IngredientDraft): Macros {
  return scaleExact(ingredient.perUnit, ingredientAmount(ingredient));
}

/** Ingredients that actually contribute: a name and an amount above zero. */
export function filledIngredients(draft: RecipeDraft): IngredientDraft[] {
  return draft.ingredients.filter((ingredient) => ingredient.name.trim() && ingredientAmount(ingredient) > 0);
}

/**
 * How many portions the recipe yields. Never zero - dividing the total by it
 * is the whole point, and a half-typed field must not blow up the preview.
 */
export function draftServings(draft: RecipeDraft): number {
  const servings = parseDecimal(draft.servings);
  return servings !== null && servings > 0 ? servings : 1;
}

export function draftTotals(draft: RecipeDraft): Macros {
  const filled = filledIngredients(draft);
  if (filled.length === 0) return EMPTY_MACROS;
  return sumMacros(filled.map(ingredientMacros));
}

export function draftPerServing(draft: RecipeDraft): Macros {
  return roundMacros(scaleExact(draftTotals(draft), 1 / draftServings(draft)));
}

/** What still blocks this step, in the words the editor shows. */
export function stepIssue(draft: RecipeDraft, step: RecipeStep): string | null {
  if (step === 'basics') {
    if (!draft.name.trim()) return 'Gib dem Rezept einen Namen.';
    const servings = parseDecimal(draft.servings);
    if (servings === null || servings <= 0) return 'Wie viele Portionen ergibt das Rezept?';
    return null;
  }

  if (step === 'ingredients') {
    if (draft.ingredients.length === 0) return 'Füge mindestens eine Zutat hinzu.';
    if (filledIngredients(draft).length === 0) return 'Trag bei den Zutaten noch eine Menge ein.';
    return null;
  }

  return null;
}

export function nextStep(step: RecipeStep): RecipeStep {
  const index = RECIPE_STEPS.indexOf(step);
  return RECIPE_STEPS[Math.min(index + 1, RECIPE_STEPS.length - 1)] ?? 'review';
}

export function previousStep(step: RecipeStep): RecipeStep {
  const index = RECIPE_STEPS.indexOf(step);
  return RECIPE_STEPS[Math.max(index - 1, 0)] ?? 'basics';
}

/** The first step that is still incomplete - where the editor should open. */
export function firstOpenStep(draft: RecipeDraft): RecipeStep {
  return RECIPE_STEPS.find((step) => stepIssue(draft, step) !== null) ?? 'review';
}

/**
 * Unit and per-unit macros for something picked from the food search.
 * A product with a known gram weight is measured in grams, everything else in
 * portions - that is the only amount such an entry can be trusted for.
 */
export function ingredientFromPortion(input: {
  name: string;
  macros: Macros;
  portionG: number | null;
  portionLabel: string;
  foodItemId?: string | null;
  key: string;
}): IngredientDraft {
  const grams = input.portionG && input.portionG > 0 ? input.portionG : null;
  const liquid = /\bml\b/i.test(input.portionLabel);

  if (grams) {
    return {
      key: input.key,
      name: input.name,
      amount: String(Math.round(grams)),
      unit: liquid ? 'ml' : 'g',
      perUnit: scaleExact(input.macros, 1 / grams),
      foodItemId: input.foodItemId ?? null,
    };
  }

  return {
    key: input.key,
    name: input.name,
    amount: '1',
    unit: 'portion',
    perUnit: input.macros,
    foodItemId: input.foodItemId ?? null,
  };
}

/**
 * A hand-typed ingredient, for something no database knows.
 *
 * `reference` is the amount the typed macros belong to - "660 kcal" only means
 * something as "660 kcal per 400 g". Without it the values would be stuck to
 * whatever amount happened to be entered, and using 250 g of the same product
 * in the recipe would be guesswork.
 */
export function manualIngredient(
  key: string,
  name: string,
  macros: Macros,
  reference: { amount: number; unit: IngredientUnit } = { amount: 1, unit: 'portion' },
): IngredientDraft {
  const amount = reference.amount > 0 ? reference.amount : 1;
  return {
    key,
    name,
    amount: String(amount),
    unit: reference.unit,
    perUnit: scaleExact(macros, 1 / amount),
    foodItemId: null,
  };
}

/**
 * Reads a saved ingredient back into an editable draft.
 *
 * The database stores the macros for the amount that was used plus a label
 * like "180 g". Parsing that back means editing a recipe keeps working in
 * grams instead of silently collapsing every ingredient into "1 Portion".
 */
export function ingredientDraftFromSaved(saved: {
  id: string;
  name: string;
  amountLabel: string;
  macros: Macros;
  foodItemId: string | null;
}): IngredientDraft {
  const match = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*(g|ml|portionen?|stück|stueck)?\s*$/i.exec(saved.amountLabel ?? '');
  const amount = match ? (parseDecimal(match[1]) ?? 0) : 0;
  const rawUnit = match?.[2]?.toLowerCase() ?? '';
  const unit: IngredientUnit = rawUnit === 'g' ? 'g' : rawUnit === 'ml' ? 'ml' : 'portion';

  if (amount > 0) {
    return {
      key: saved.id,
      name: saved.name,
      amount: String(amount),
      unit,
      perUnit: scaleExact(saved.macros, 1 / amount),
      foodItemId: saved.foodItemId,
    };
  }

  // No usable label: treat what is stored as one portion.
  return {
    key: saved.id,
    name: saved.name,
    amount: '1',
    unit: 'portion',
    perUnit: saved.macros,
    foodItemId: saved.foodItemId,
  };
}

/** How an ingredient reads in the list, e.g. "180 g" or "1 Portion". */
export function describeIngredientAmount(ingredient: IngredientDraft): string {
  const amount = ingredientAmount(ingredient);
  const rounded = Math.round(amount * 100) / 100;
  if (ingredient.unit === 'portion') {
    return `${rounded} ${rounded === 1 ? 'Portion' : 'Portionen'}`;
  }
  return `${rounded} ${UNIT_LABEL[ingredient.unit]}`;
}
