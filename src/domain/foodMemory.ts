import type { DataQuality, Macros } from './types';

/**
 * Deciding whether a logged meal is worth remembering as a reusable food.
 *
 * Typing "Brötchen mit Marmelade, 280 kcal, 8 g Eiweiß" is real work, and
 * doing it again next Sunday is work that should never have been repeated.
 * So every meal the user enters by hand is filed into their own food library
 * automatically — no "save this?" prompt, because a prompt is one more tap on
 * the exact flow that is supposed to be fast.
 *
 * Automatic filing only stays useful if the library does not fill with junk,
 * which is what the guards below are for. Pure logic, no IO, so the rules are
 * testable without a database.
 */

export type RememberCandidate = {
  name: string;
  macros: Macros;
  servings?: number | undefined;
  servingLabel?: string | undefined;
  servingG?: number | null | undefined;
  dataQuality?: DataQuality | undefined;
  /** Set when the entry already came from the library, a recipe or a batch. */
  foodItemId?: string | null | undefined;
  recipeId?: string | null | undefined;
  batchId?: string | null | undefined;
};

/** Case-, whitespace- and punctuation-insensitive key for de-duplication. */
export function foodKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A name that carries no meaning next week is not worth a library row. */
function isMeaningfulName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;
  // "500", "2x", "1 Portion" — describes an amount, not a food.
  if (!/[a-zA-ZäöüÄÖÜß]{3}/.test(trimmed)) return false;
  return true;
}

/**
 * The macros of a single portion, so a library entry means "one of these"
 * regardless of how many the user ate when they first typed it in.
 */
export function perPortion(macros: Macros, servings: number | undefined): Macros {
  const count = servings && servings > 0 ? servings : 1;
  if (count === 1) return macros;
  return {
    kcal: Math.round(macros.kcal / count),
    proteinG: Math.round((macros.proteinG / count) * 10) / 10,
    carbsG: Math.round((macros.carbsG / count) * 10) / 10,
    fatG: Math.round((macros.fatG / count) * 10) / 10,
  };
}

export function servingForRememberedFood(entry: RememberCandidate): { servingLabel: string; servingG: number | null } {
  const servingLabel = entry.servingLabel?.trim() || '1 Portion';
  const servingG = entry.servingG && Number.isFinite(entry.servingG) && entry.servingG > 0 ? entry.servingG : null;
  return { servingLabel, servingG };
}

/**
 * Whether this entry should be filed into the library.
 *
 * `existingKeys` are the `foodKey`s already stored, so re-logging a remembered
 * food does not create a second row — and does not quietly overwrite the
 * values the user already trusts.
 */
export function shouldRemember(entry: RememberCandidate, existingKeys: Iterable<string>): boolean {
  // Already backed by something in the database: nothing new to learn.
  if (entry.foodItemId || entry.recipeId || entry.batchId) return false;

  if (!isMeaningfulName(entry.name)) return false;

  // Without calories the entry cannot be reused as a food at all. An entry
  // flagged `unknown` is explicitly a value FORGE could not establish, and
  // storing a guess as a reusable product would launder it into a fact (§20).
  if (entry.dataQuality === 'unknown') return false;
  if (!(entry.macros.kcal > 0)) return false;

  const key = foodKey(entry.name);
  for (const existing of existingKeys) {
    if (existing === key) return false;
  }
  return true;
}
