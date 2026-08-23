/**
 * Parsing numbers a person typed.
 *
 * On a German keyboard the decimal separator is a comma, so "72,5" is what
 * actually arrives from a weight field — and `Number("72,5")` is `NaN`. Where
 * that NaN met a `|| 0` it silently became zero, which is worse than an error:
 * a 24.5 g protein entry logged as 0 g looks like a perfectly normal meal.
 *
 * Six copies of `Number(value.replace(',', '.'))` had grown across the views,
 * and the places that had not grown one were exactly the places with the bug.
 * One helper instead.
 */

/** Returns null for anything that is not a finite number. */
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** For fields where an empty or unparseable value has a sensible default. */
export function parseDecimalOr(value: string | number | null | undefined, fallback: number): number {
  return parseDecimal(value) ?? fallback;
}

/** Positive numbers only — weights, portions, durations. */
export function parsePositive(value: string | number | null | undefined): number | null {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}
