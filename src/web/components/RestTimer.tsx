'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, X, Plus } from 'lucide-react';

const PRESETS = [60, 90, 120, 180];

/**
 * Rest timer between sets.
 *
 * Counts against a wall-clock end time rather than decrementing a counter, so
 * it stays correct when the screen sleeps or the tab is backgrounded mid-set —
 * which is exactly when a phone gets put down during a rest.
 */
export function RestTimer({ defaultSeconds = 90, onClose }: { defaultSeconds?: number; onClose: () => void }) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + defaultSeconds * 1000);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const notified = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !notified.current) {
        notified.current = true;
        // A short buzz is the only signal that works with the phone face-down.
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([120, 60, 120]);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  function restart(seconds: number) {
    notified.current = false;
    setEndsAt(Date.now() + seconds * 1000);
  }

  const done = remaining === 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="panel soft" style={{ padding: 12, borderColor: done ? 'rgba(95,214,196,0.4)' : undefined }}>
      <div className="row-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Timer size={16} color={done ? 'var(--teal)' : 'var(--violet)'} />
          <span
            style={{
              fontSize: 22,
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              color: done ? 'var(--teal)' : 'var(--text)',
            }}
          >
            {done ? 'Bereit' : `${minutes}:${String(seconds).padStart(2, '0')}`}
          </span>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Timer schließen">
          <X size={16} />
        </button>
      </div>

      <div className="chip-row" style={{ marginTop: 10 }}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="chip"
            style={{ minHeight: 30, fontSize: 12 }}
            onClick={() => restart(preset)}
          >
            {preset < 120 ? `${preset} s` : `${preset / 60} min`}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          style={{ minHeight: 30, fontSize: 12 }}
          onClick={() => setEndsAt((current) => current + 30_000)}
        >
          <Plus size={12} /> 30 s
        </button>
      </div>
    </div>
  );
}
