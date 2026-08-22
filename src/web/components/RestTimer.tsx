'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, X, Plus } from 'lucide-react';

const PRESETS = [45, 60, 90, 120, 180, 240];
const STORAGE_KEY = 'forge_rest_seconds';

/** The chosen rest length sticks, so it is set once rather than every set. */
function loadPreferred(fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) && stored >= 15 && stored <= 600 ? stored : fallback;
}

/**
 * Rest timer between sets.
 *
 * Counts against a wall-clock end time rather than decrementing a counter, so
 * it stays correct when the screen sleeps or the tab is backgrounded mid-set —
 * which is exactly when a phone gets put down during a rest.
 */
export function RestTimer({ defaultSeconds = 90, onClose }: { defaultSeconds?: number; onClose: () => void }) {
  const [preferred, setPreferred] = useState(() => loadPreferred(defaultSeconds));
  const [endsAt, setEndsAt] = useState(() => Date.now() + loadPreferred(defaultSeconds) * 1000);
  const [remaining, setRemaining] = useState(preferred);
  const [custom, setCustom] = useState('');
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
    setPreferred(seconds);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, String(seconds));
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
            className={`chip${preferred === preset ? ' active' : ''}`}
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

      <form
        style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          const seconds = Number(custom);
          if (Number.isFinite(seconds) && seconds >= 15 && seconds <= 600) {
            restart(seconds);
            setCustom('');
          }
        }}
      >
        <input
          className="input compact"
          inputMode="numeric"
          placeholder="eigene Sekunden"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Eigene Pausenlänge in Sekunden"
          style={{ maxWidth: 150, textAlign: 'left' }}
        />
        <button type="submit" className="button secondary compact" disabled={!custom.trim()}>
          Setzen
        </button>
      </form>
    </div>
  );
}
