/**
 * FORGE's food recognition engine.
 *
 * This is what answers "was habe ich da gerade getippt?" without a language
 * model. It ranks candidates from four sources against one scoring function,
 * in descending order of how much the numbers can be trusted:
 *
 *   1. the user's own saved products and recipes  → verified
 *   2. meals they logged recently                 → verified
 *   3. the curated German dish table               → estimated
 *   4. Open Food Facts, ~3M crowdsourced products → estimated
 *
 * Trust is not the same as relevance, so both feed the score: a weak match in
 * the user's own library still loses to an exact match on a packaged product.
 */

import type { DataQuality, Macros } from './types';

export type CandidateSource = 'library' | 'recent' | 'static' | 'off';

export type FoodCandidate = {
  id: string;
  source: CandidateSource;
  name: string;
  brand: string;
  /** Macros for one `portionLabel`. */
  macros: Macros;
  portionLabel: string;
  /** Grams in that portion, when known — lets the UI offer 1.5× etc. */
  portionG: number | null;
  dataQuality: DataQuality;
  /** Filled for library hits so the entry can reference the stored row. */
  libraryId?: string;
  libraryKind?: 'food' | 'recipe';
  /** Product barcode when known, so scans and saved products share one path. */
  barcode?: string | null;
  /** True when this hit came from a barcode scan, not typed search. */
  matchedByBarcode?: boolean;
  imageUrl?: string | null;
  popularity?: number;
};

export type ScoredCandidate = FoodCandidate & { score: number };

/** Strips case, umlauts and punctuation so matching is about words, not typing. */
export function normalizeFood(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalizeFood(text).split(' ').filter((token) => token.length > 1);
}

/**
 * Edit distance with an early exit.
 *
 * Bounded because we only care whether two words are within a typo or two of
 * each other — "isoclar" vs "isoclear". Anything further apart is a different
 * word and the exact value does not matter.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    // Every cell in this row already exceeds the budget — no better result can follow.
    if (rowMin > max) return max + 1;
    previous = current;
  }

  return previous[b.length] ?? max + 1;
}

/** How well a candidate name answers the query. 0 = no relationship. */
export function relevance(query: string, name: string): number {
  const needle = normalizeFood(query);
  const target = normalizeFood(name);
  if (!needle || !target) return 0;

  if (target === needle) return 100;
  if (target.startsWith(needle)) return 88;
  if (target.includes(needle)) return 74;
  if (needle.includes(target) && target.length >= 4) return 68;

  const needleTokens = tokens(query);
  const targetTokens = tokens(name);
  if (needleTokens.length === 0 || targetTokens.length === 0) return 0;

  let matched = 0;
  let fuzzy = 0;

  for (const token of needleTokens) {
    if (targetTokens.some((other) => other === token || other.startsWith(token))) {
      matched += 1;
      continue;
    }
    // Allow one typo in short words, two in longer ones.
    const budget = token.length <= 5 ? 1 : 2;
    if (targetTokens.some((other) => editDistance(token, other, budget) <= budget)) {
      fuzzy += 1;
    }
  }

  if (matched === 0 && fuzzy === 0) return 0;

  const coverage = (matched + fuzzy * 0.65) / needleTokens.length;
  // Penalise candidates that carry a lot of unrelated words, so "Skyr" does
  // not rank a "Skyr Drink Vanille Multipack" above plain "Skyr".
  const noise = Math.max(0, targetTokens.length - needleTokens.length) * 2;

  return Math.max(0, Math.round(coverage * 62 - noise));
}

/**
 * Bonus for how much a source's numbers can be trusted.
 *
 * The user's own entries win ties because they were confirmed by hand; Open
 * Food Facts gets no bonus but earns a little back through scan popularity,
 * which is a decent signal that an entry is real and correctly filled in.
 */
function sourceBonus(candidate: FoodCandidate): number {
  switch (candidate.source) {
    case 'library': return 26;
    case 'recent': return 16;
    case 'static': return 6;
    case 'off': {
      const scans = candidate.popularity ?? 0;
      if (scans >= 500) return 8;
      if (scans >= 50) return 5;
      if (scans >= 5) return 2;
      return 0;
    }
  }
}

export type ResolveOptions = {
  /** Drop anything below this. Keeps unrelated products out of the list. */
  minScore?: number;
  limit?: number;
};

/**
 * Ranks candidates for a query and removes near-duplicates.
 *
 * Open Food Facts frequently holds the same product several times under
 * slightly different names, and a product the user already saved will also
 * come back from OFF — showing both is noise, so the higher-scoring one wins.
 */
export function resolveFood(
  query: string,
  candidates: readonly FoodCandidate[],
  options: ResolveOptions = {},
): ScoredCandidate[] {
  const minScore = options.minScore ?? 30;
  const limit = options.limit ?? 12;

  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    const base = relevance(query, candidate.name);
    if (base === 0) continue;
    scored.push({ ...candidate, score: base + sourceBonus(candidate) });
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const unique: ScoredCandidate[] = [];
  for (const candidate of scored) {
    if (candidate.score < minScore) continue;
    const key = `${normalizeFood(candidate.name)}|${normalizeFood(candidate.brand)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
    if (unique.length >= limit) break;
  }

  return unique;
}

/** Scales a candidate's portion macros by a factor. */
export function scaleCandidate(candidate: FoodCandidate, factor: number): Macros {
  return {
    kcal: Math.round(candidate.macros.kcal * factor),
    proteinG: Math.round(candidate.macros.proteinG * factor * 10) / 10,
    carbsG: Math.round(candidate.macros.carbsG * factor * 10) / 10,
    fatG: Math.round(candidate.macros.fatG * factor * 10) / 10,
  };
}
