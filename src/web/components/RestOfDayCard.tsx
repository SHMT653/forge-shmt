'use client';

import { Target, Footprints, Droplets, Plus } from 'lucide-react';
import { describeRemaining, remainingBudget, suggestFits, type FitCandidate } from '@/domain/remainingDay';
import { formatLiters } from '@/domain/dayEvaluation';
import { TONE_COLOR } from '@/domain/goalPhase';
import type { ResolvedTargets } from '@/domain/goalPhase';
import type { Macros } from '@/domain/types';
import type { MealEntryInput } from '@/data/nutrition';

/**
 * The "what do I still have to do today" card.
 *
 * Deliberately the most concrete thing on the screen: not a percentage, but
 * named foods from the user's own library that fit what is left, each one tap
 * away from being logged. Every number here is arithmetic on today's rows —
 * it was briefly dressed up as a persona speaking, which added a character to
 * a subtraction.
 */
export function RestOfDayCard({
  consumed,
  metrics,
  targets,
  entryCount,
  candidates,
  onAdd,
  onAddWater,
}: {
  consumed: Macros;
  metrics: { steps: number; waterMl: number };
  targets: ResolvedTargets;
  entryCount: number;
  candidates: readonly FitCandidate[];
  onAdd: (entry: MealEntryInput) => void;
  onAddWater: (ml: number) => void;
}) {
  const budget = remainingBudget(consumed, metrics, targets, entryCount);
  const fits = suggestFits(candidates, budget);

  const tone =
    budget.state === 'over' ? 'yellow'
    : budget.state === 'complete' ? 'green'
    : budget.state === 'empty' ? 'neutral'
    : 'green';

  return (
    <section className="panel soft" style={{ display: 'block' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="stat-icon" aria-hidden style={{ color: TONE_COLOR[tone] }}>
          <Target size={17} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="section-label">Rest des Tages</p>
          <p className="copy" style={{ margin: '2px 0 0' }}>{describeRemaining(budget, targets)}</p>
        </div>
      </div>

      {/* Open non-food targets, only when they are actually still open. */}
      {(budget.stepsLeft > 0 || budget.waterLeftMl > 0) && (
        <div className="chip-row" style={{ marginTop: 10 }}>
          {budget.stepsLeft > 0 && (
            <span className="chip" style={{ minHeight: 32, fontSize: 12 }}>
              <Footprints size={13} /> noch {budget.stepsLeft.toLocaleString('de-DE')} Schritte
            </span>
          )}
          {budget.waterLeftMl > 0 && (
            <button
              type="button"
              className="chip"
              style={{ minHeight: 32, fontSize: 12 }}
              onClick={() => onAddWater(500)}
            >
              <Droplets size={13} /> noch {formatLiters(budget.waterLeftMl)}
              <span className="chip-meta">+500 ml</span>
            </button>
          )}
        </div>
      )}

      {fits.length > 0 && (
        <div className="stack-sm" style={{ marginTop: 12 }}>
          <p className="section-label">Passt noch rein</p>
          {fits.map((fit) => (
            <button
              key={fit.id}
              type="button"
              className="habit-row"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              onClick={() =>
                onAdd({
                  name: fit.name,
                  macros: fit.macros,
                  dataQuality: 'verified',
                  source: 'favorite',
                  ...(fit.kind === 'food' ? { foodItemId: fit.id } : { recipeId: fit.id }),
                })
              }
            >
              <div className="habit-body">
                <p className="h3" style={{ fontSize: 14 }}>{fit.name}</p>
                <p className="muted-sm">
                  {Math.round(fit.macros.kcal)} kcal · {Math.round(fit.macros.proteinG)} g Protein
                  {budget.proteinToMin > 0 && fit.proteinCoverage >= 0.4
                    ? ` · deckt ${Math.round(fit.proteinCoverage * 100)} % der Lücke`
                    : ''}
                </p>
              </div>
              <span className="icon-button" aria-hidden><Plus size={16} /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
