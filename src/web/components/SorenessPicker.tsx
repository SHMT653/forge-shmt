'use client';

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
            onClick={() => onChange(value === option.value ? null : option.value)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
