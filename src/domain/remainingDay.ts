/**
 * "Wie komme ich durch den Rest des Tages?"
 *
 * The coach headline says what is missing in words. This turns the same
 * numbers into something you can act on: which of the user's own foods still
 * fit the remaining budget, ranked by how much of the protein gap they close.
 *
 * Only the user's own library is used. Suggesting a food they have never
 * eaten would be a guess about their taste and their kitchen — the point is
 * "you already have this and it fits", not a meal plan.
 */

import type { Macros } from './types';
import type { ResolvedTargets } from './goalPhase';

export type RemainingBudget = {
  /** Headroom to the top of the calorie range. Negative when already over. */
  kcalToMax: number;
  /** How much more is needed to reach the bottom of the range. */
  kcalToMin: number;
  proteinToMin: number;
  stepsLeft: number;
  waterLeftMl: number;
  state: 'empty' | 'on_track' | 'protein_gap' | 'tight' | 'over' | 'complete';
};

export function remainingBudget(
  consumed: Macros,
  metrics: { steps: number; waterMl: number },
  targets: ResolvedTargets,
  entryCount: number,
): RemainingBudget {
  const kcalToMax = Math.round(targets.calories.max - consumed.kcal);
  const kcalToMin = Math.round(targets.calories.min - consumed.kcal);
  const proteinToMin = Math.max(0, Math.round(targets.protein.min - consumed.proteinG));

  const state: RemainingBudget['state'] =
    entryCount === 0 ? 'empty'
    : kcalToMax < 0 ? 'over'
    : proteinToMin > 20 && kcalToMax < proteinToMin * 6 ? 'tight'
    : proteinToMin > 10 ? 'protein_gap'
    : kcalToMin > 200 ? 'on_track'
    : 'complete';

  return {
    kcalToMax,
    kcalToMin,
    proteinToMin,
    stepsLeft: Math.max(0, Math.round(targets.steps - metrics.steps)),
    waterLeftMl: Math.max(0, Math.round(targets.waterMl - metrics.waterMl)),
    state,
  };
}

export type FitCandidate = {
  id: string;
  name: string;
  macros: Macros;
  /** 'food' | 'recipe' — the caller needs it to build the entry. */
  kind: 'food' | 'recipe';
};

/**
 * Grams of protein per kcal below which an item is not worth suggesting while
 * protein is short. Skyr sits around 0.15, a protein drink around 0.26,
 * crisps around 0.01.
 */
const MIN_PROTEIN_DENSITY = 0.05;

export type Fit = FitCandidate & {
  /** How much of the remaining protein gap this closes, 0–1. */
  proteinCoverage: number;
  /** Share of the remaining calorie headroom it uses, 0–1. */
  kcalShare: number;
};

/**
 * Picks items that still fit today.
 *
 * Ranked by protein per calorie, because that is what is usually scarce late
 * in a day: the headroom is in calories, and the gap is in protein.
 */
export function suggestFits(
  candidates: readonly FitCandidate[],
  budget: RemainingBudget,
  limit = 3,
): Fit[] {
  if (budget.kcalToMax <= 40) return [];

  const fits: Fit[] = [];
  const closingProteinGap = budget.proteinToMin > 10;

  for (const candidate of candidates) {
    const { kcal, proteinG } = candidate.macros;
    if (kcal <= 0 || kcal > budget.kcalToMax) continue;

    // While protein is the open item, something that fits the calories but
    // barely moves the protein needle works against what the card just said.
    // It fits, but suggesting it would be unhelpful.
    if (closingProteinGap && proteinG / kcal < MIN_PROTEIN_DENSITY) continue;

    fits.push({
      ...candidate,
      proteinCoverage: budget.proteinToMin > 0 ? Math.min(1, proteinG / budget.proteinToMin) : 0,
      kcalShare: budget.kcalToMax > 0 ? kcal / budget.kcalToMax : 1,
    });
  }

  // With a protein gap, density decides. Without one, prefer the items that
  // simply fit comfortably rather than filling the whole remaining budget.
  fits.sort((a, b) => {
    if (budget.proteinToMin > 10) {
      const densityA = a.macros.proteinG / Math.max(1, a.macros.kcal);
      const densityB = b.macros.proteinG / Math.max(1, b.macros.kcal);
      if (densityB !== densityA) return densityB - densityA;
    }
    return a.kcalShare - b.kcalShare;
  });

  return fits.slice(0, limit);
}

/** One short, concrete sentence for the card header. */
export function describeRemaining(budget: RemainingBudget, targets: ResolvedTargets): string {
  switch (budget.state) {
    case 'empty':
      return 'Noch nichts eingetragen — trag deine erste Mahlzeit ein.';
    case 'over':
      return `${Math.abs(budget.kcalToMax).toLocaleString('de-DE')} kcal über dem Bereich. Der Wochenschnitt entscheidet.`;
    case 'tight':
      return `Noch ${budget.proteinToMin} g Protein bei ${budget.kcalToMax.toLocaleString('de-DE')} kcal Spielraum — es wird knapp, nimm etwas Mageres.`;
    case 'protein_gap':
      return `Noch ${budget.proteinToMin} g Protein und ${budget.kcalToMax.toLocaleString('de-DE')} kcal Spielraum.`;
    case 'on_track':
      return `Protein sitzt. Noch ${budget.kcalToMin.toLocaleString('de-DE')} kcal bis zum Zielbereich (${targets.calories.min.toLocaleString('de-DE')}).`;
    case 'complete':
      return 'Ernährung ist für heute durch.';
  }
}
