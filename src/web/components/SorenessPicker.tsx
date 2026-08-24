'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Soreness } from '@/domain/types';

const OPTIONS: { value: Soreness; label: string }[] = [
  { value: 'none', label: 'Keiner' },
  { value: 'light', label: 'Leicht' },
  { value: 'medium', label: 'Mittel' },
  { value: 'strong', label: 'Stark' },
];

/**
 * Muscle soreness (§22). This is what lets the coach say "heute lieber
 * Recovery" instead of pushing the plan regardless of how you actually feel.
 */
export function SorenessPicker({
  value,
  onChange,
}: {
  value: Soreness | null;
  onChange: (next: Soreness | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const answered = OPTIONS.find((option) => option.value === value);

  // Once the day is answered the question is finished business: it collapses to
  // the answer. Being asked the same thing every time the app opens is how a
  // useful check-in turns into noise.
  if (answered && !editing) {
    return (
      <button
        type="button"
        className="soreness-answer"
        onClick={() => setEditing(true)}
      >
        <span>Muskelkater heute: <strong>{answered.label}</strong></span>
        <Pencil size={13} aria-hidden />
        <span className="visually-hidden">ändern</span>
      </button>
    );
  }

  return (
    <div className="stack-sm">
      <p className="muted-sm">Muskelkater heute?</p>
      <div className="chip-row">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip${value === option.value ? ' active' : ''}`}
            style={{ minHeight: 34, fontSize: 12 }}
            onClick={() => {
              onChange(value === option.value ? null : option.value);
              setEditing(false);
            }}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
