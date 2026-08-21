'use client';

import { TONE_COLOR } from '@/domain/goalPhase';
import type { DayStatusItem } from '@/domain/coach';

/**
 * The two-second answer to "how is my day going?" (§8).
 * Six cells, one traffic light each — no reading required.
 */
export function StatusStrip({ items }: { items: readonly DayStatusItem[] }) {
  return (
    <div className="status-strip">
      {items.map((item) => (
        <div key={item.key} className="status-cell" title={`${item.label}: ${item.value} von ${item.target}`}>
          <span className="status-dot" style={{ background: TONE_COLOR[item.tone] }} aria-hidden />
          <span className="status-cell-value">{item.value}</span>
          <span className="status-cell-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
