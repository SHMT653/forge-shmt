'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';

/**
 * Stopwatch for holds — planks, dead hangs, wall sits.
 *
 * Counting a plank by watching a clock is the one part of a session you cannot
 * do while doing the exercise. This runs against a wall-clock start rather
 * than incrementing a counter, so a sleeping screen mid-hold does not lose
 * time, and hands the elapsed seconds straight to the set when stopped.
 */
export function HoldTimer({
  targetSeconds,
  onFinish,
}: {
  /** What today's plan asks for; the timer counts up past it rather than stopping. */
  targetSeconds: number | null;
  onFinish: (seconds: number) => void;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const reachedTarget = useRef(false);

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      if (targetSeconds && seconds >= targetSeconds && !reachedTarget.current) {
        reachedTarget.current = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(200);
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startedAt, targetSeconds]);

  function start() {
    reachedTarget.current = false;
    setElapsed(0);
    setStartedAt(Date.now());
  }

  function stop() {
    setStartedAt(null);
    if (elapsed > 0) onFinish(elapsed);
  }

  const running = startedAt !== null;
  const hitTarget = targetSeconds !== null && elapsed >= targetSeconds;

  return (
    <div className="row-between" style={{ gap: 10 }}>
      <span
        style={{
          fontSize: 24,
          fontWeight: 900,
          fontVariantNumeric: 'tabular-nums',
          color: hitTarget ? 'var(--teal)' : running ? 'var(--text)' : 'var(--subtle)',
          minWidth: 62,
        }}
      >
        {formatSeconds(elapsed)}
      </span>

      {targetSeconds !== null && (
        <span className="muted-sm" style={{ flex: 1, minWidth: 0 }}>
          Ziel {formatSeconds(targetSeconds)}
        </span>
      )}

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!running ? (
          <button type="button" className="button compact" onClick={start}>
            <Play size={15} /> {elapsed > 0 ? 'Neu' : 'Start'}
          </button>
        ) : (
          <button type="button" className="button compact" onClick={stop}>
            <Square size={15} /> Stopp
          </button>
        )}
        {!running && elapsed > 0 && (
          <button type="button" className="icon-button" onClick={() => setElapsed(0)} aria-label="Zurücksetzen">
            <RotateCcw size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
}
