'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from './Sheet';
import { parsePositive } from '@/domain/numbers';
import { scaleMacros } from '@/domain/nutritionMath';
import { formatServings } from '@/domain/mealStacks';
import type { Macros } from '@/domain/types';

/** Die Mengen, die man mit einem Tipp trifft. */
const QUICK_SERVINGS = [0.5, 1, 1.5, 2, 3];

/**
 * „Wie viel davon?"
 *
 * Das Plus am Favoriten trägt sofort eine Portion ein — das ist der häufige
 * Fall und soll ein Tipp bleiben. Wer stattdessen auf den Namen tippt, landet
 * hier und sagt, wie viel es wirklich war. Eine Menge zu wählen trägt sie
 * direkt ein; ein zweiter Bestätigungstipp wäre nur Weg.
 */
export function ServingChoice({
  macros,
  servingLabel,
  busy = false,
  onPick,
}: {
  macros: Macros;
  servingLabel?: string | null | undefined;
  busy?: boolean | undefined;
  onPick: (servings: number) => void;
}) {
  const [custom, setCustom] = useState('');
  const customServings = parsePositive(custom);
  const customMacros = customServings === null ? null : scaleMacros(macros, customServings);

  return (
    <div className="stack-sm">
      <p className="muted-sm">
        1 {servingLabel || 'Portion'} = {Math.round(macros.kcal)} kcal · {Math.round(macros.proteinG)} g Protein
      </p>

      <div className="chip-row">
        {QUICK_SERVINGS.map((servings) => (
          <button
            key={servings}
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => onPick(servings)}
          >
            {formatServings(servings)}×
            <span className="chip-meta">{Math.round(scaleMacros(macros, servings).kcal)} kcal</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Eigene Menge</label>
          <input
            className="input compact"
            inputMode="decimal"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="z. B. 2,5"
            aria-label="Eigene Menge"
          />
        </div>
        <button
          type="button"
          className="button compact"
          disabled={busy || customServings === null}
          onClick={() => customServings !== null && onPick(customServings)}
        >
          <Check size={15} /> Eintragen
        </button>
      </div>

      {customServings !== null && customMacros && (
        <p className="muted-sm">
          {formatServings(customServings)}× ergibt {Math.round(customMacros.kcal)} kcal ·{' '}
          {Math.round(customMacros.proteinG)} g Protein
        </p>
      )}
    </div>
  );
}

/** Dieselbe Auswahl als Bottom-Sheet, für die Favoriten auf der Ernährungsseite. */
export function ServingPickerSheet({
  name,
  macros,
  servingLabel,
  busy = false,
  onClose,
  onPick,
}: {
  name: string;
  macros: Macros;
  servingLabel?: string | null | undefined;
  busy?: boolean | undefined;
  onClose: () => void;
  onPick: (servings: number) => void;
}) {
  return (
    <Sheet title={`Wie viel ${name}?`} onClose={onClose}>
      <ServingChoice
        macros={macros}
        servingLabel={servingLabel}
        busy={busy}
        onPick={(servings) => {
          onPick(servings);
          onClose();
        }}
      />
    </Sheet>
  );
}
