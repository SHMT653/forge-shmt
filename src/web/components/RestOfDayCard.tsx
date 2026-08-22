'use client';

import { Sparkles, Footprints, Droplets, Plus } from 'lucide-react';
import { describeRemaining, remainingBudget, suggestFits, type FitCandidate } from '@/domain/remainingDay';
import { formatLiters } from '@/domain/coach';
import { TONE_COLOR } from '@/domain/goalPhase';
import type { ResolvedTargets } from '@/domain/goalPhase';
import type { Macros } from '@/domain/types';
import type { MealEntryInput } from '@/data/nutrition';

/**
 * The "what do I still have to do today" card.
 *
 * Deliberately the most concrete thing on the screen: not a percentage, but
 * named foods from the user's own library that fit what is left, each one tap
 * away from being logged.
 */
export function RestOfDayCard({
  consumed,
  metrics,
  targets,
  entryCount,
  candidates,
  headline,
  onAdd,
  onAddWater,
  onOpenCoach,
}: {
  consumed: Macros;
  metrics: { steps: number; waterMl: number };
  targets: ResolvedTargets;
  entryCount: number;
  candidates: readonly FitCandidate[];
  /** The coach's read on the day — merged in rather than shown as its own card. */
  headline: string;
  onAdd: (entry: MealEntryInput) => void;
  onAddWater: (ml: number) => void;
  onOpenCoach?: () => void;
}) {
  const budget = remainingBudget(consumed, metrics, targets, entryCount);
  const fits = suggestFits(candidates, budget);

  const tone =
    budget.state === 'over' ? 'yellow'
    : budget.state === 'complete' ? 'green'
    : budget.state === 'empty' ? 'neutral'
    : 'green';

  return (
    <section className="coach-card" style={{ display: 'block' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="coach-avatar" aria-hidden style={{ color: TONE_COLOR[tone] }}>
          <Sparkles size={17} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="coach-label">Coach</p>
          <p className="coach-text">{headline}</p>
          <p className="coach-text" style={{ marginTop: 6, color: 'var(--muted)' }}>
            {describeRemaining(budget, targets)}
          </p>
          {onOpenCoach && (
            <button
              type="button"
              className="button ghost compact"
              style={{ marginTop: 6, padding: 0, minHeight: 0, color: 'var(--violet)' }}
              onClick={onOpenCoach}
            >
              Nachfragen →
            </button>
          )}
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
