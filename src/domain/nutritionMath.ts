/**
 * Nutrition arithmetic.
 *
 * Everything aggregated — daily totals, weekly averages, per-serving values —
 * is DERIVED here from the underlying entries rather than persisted separately
 * (§51). The one exception is `forge_nutrition_logs`, which is kept in sync as
 * a cache so other screens can read a day's totals in a single row.
 */

import type { DataQuality, Macros, MealSlot, Recipe } from './types';

export const EMPTY_MACROS: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function sumMacros(list: readonly Macros[]): Macros {
  return list.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { ...EMPTY_MACROS },
  );
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    kcal: round1(macros.kcal * factor),
    proteinG: round1(macros.proteinG * factor),
    carbsG: round1(macros.carbsG * factor),
    fatG: round1(macros.fatG * factor),
  };
}

export function roundMacros(macros: Macros): Macros {
  return {
    kcal: Math.round(macros.kcal),
    proteinG: Math.round(macros.proteinG),
    carbsG: Math.round(macros.carbsG),
    fatG: Math.round(macros.fatG),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Macros for `servings` portions of a recipe — supports 0.5, 0.75, 2 … (§12). */
export function macrosForServings(recipe: Recipe, servings: number): Macros {
  return roundMacros(scaleMacros(recipe.perServing, servings));
}

/**
 * Splits kcal into carbs and fat when only kcal and protein are known.
 *
 * This is an ESTIMATE and callers must label it as such — it exists so a
 * quick "600 kcal, 40 g Protein" entry still contributes something sensible to
 * the macro breakdown, not so the app can pretend it knows the split.
 */
export function estimateCarbsFat(kcal: number, proteinG: number): { carbsG: number; fatG: number } {
  const remaining = Math.max(0, kcal - proteinG * 4);
  return {
    carbsG: Math.round((remaining * 0.62) / 4),
    fatG: Math.round((remaining * 0.38) / 9),
  };
}

/**
 * Combined quality of a set of entries: the weakest link wins. One estimated
 * item makes the day's total an estimate, and the UI shows a "~" accordingly.
 */
export function combineQuality(qualities: readonly DataQuality[]): DataQuality {
  if (qualities.some((q) => q === 'unknown')) return 'unknown';
  if (qualities.some((q) => q === 'estimated')) return 'estimated';
  return 'verified';
}

export const QUALITY_LABEL: Record<DataQuality, string> = {
  verified: 'Verifiziert',
  estimated: 'Geschätzt',
  unknown: 'Unbekannt',
};

/** Prefixes a value with "~" when it is not a verified number (§56). */
export function formatKcal(kcal: number, quality: DataQuality): string {
  const rounded = Math.round(kcal).toLocaleString('de-DE');
  return quality === 'verified' ? `${rounded} kcal` : `~${rounded} kcal`;
}

/**
 * Renders an uncertain value as a range instead of false precision (§11/§56).
 * "ca. 700–900 kcal" is honest; "812 kcal" from a photo guess is not.
 */
export function formatKcalRange(min: number | null, max: number | null, fallback: number): string {
  if (min !== null && max !== null && max > min) {
    return `ca. ${Math.round(min).toLocaleString('de-DE')}–${Math.round(max).toLocaleString('de-DE')} kcal`;
  }
  return `~${Math.round(fallback).toLocaleString('de-DE')} kcal`;
}

/** A ±15% band around an estimate, rounded to something a human would say. */
export function deriveRange(kcal: number, spreadPct = 0.15): { min: number; max: number } {
  const spread = kcal * spreadPct;
  return {
    min: Math.round((kcal - spread) / 50) * 50,
    max: Math.round((kcal + spread) / 50) * 50,
  };
}

// ── Meal slots ──────────────────────────────────────────────────────────────

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

export const MEAL_SLOT_ICON: Record<MealSlot, string> = {
  breakfast: '🥣',
  lunch: '🍽️',
  dinner: '🌙',
  snack: '🍎',
};

/** Guesses the slot from the clock, so logging never demands a category first. */
export function slotForHour(hour: number): MealSlot {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
