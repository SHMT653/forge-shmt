'use client';

import { TONE_COLOR, type Tone } from '@/domain/goalPhase';

export type RingSpec = {
  key: string;
  label: string;
  /** 0–1 of the target. Values above 1 render as an overflow arc. */
  fraction: number;
  color: string;
  value: string;
  target: string;
  /** Over the range in a way that matters — draws the excess in red. */
  over?: boolean;
};

const SIZE = 190;
const STROKE = 13;
const GAP = 5;

/**
 * Three concentric rings for the day's headline metrics.
 *
 * A ring reads faster than a bar because the eye judges "nearly closed" without
 * reading a number, and three of them fit where three bars would need three
 * rows. Each metric keeps its own colour so a glance identifies which one is
 * short — the day score in the middle is the summary, the rings are the detail.
 *
 * Over-target is drawn as a separate red arc rather than by recolouring the
 * whole ring, so "2.400 of 2.100" still shows the 2.100 that were on plan.
 */
export function DayRings({
  rings,
  score,
  scoreTone,
}: {
  rings: readonly RingSpec[];
  /** 0–10, or null when the day holds nothing yet. */
  score: number | null;
  scoreTone: Tone;
}) {
  const center = SIZE / 2;

  return (
    <div style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Tagesübersicht">
          {rings.map((ring, index) => {
            const radius = (SIZE - STROKE) / 2 - index * (STROKE + GAP);
            const circumference = 2 * Math.PI * radius;
            const filled = Math.min(1, Math.max(0, ring.fraction));
            const overflow = Math.min(1, Math.max(0, ring.fraction - 1));

            return (
              <g key={ring.key} transform={`rotate(-90 ${center} ${center})`}>
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth={STROKE}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - filled)}
                  style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
                />
                {ring.over && overflow > 0 && (
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="var(--danger)"
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - overflow)}
                    style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeContent: 'center',
            justifyItems: 'center',
            gap: 1,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: 34,
              fontWeight: 900,
              lineHeight: 1,
              color: score === null ? 'var(--subtle)' : TONE_COLOR[scoreTone],
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {score === null ? '–' : score.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 700 }}>
            {score === null ? 'noch nichts' : 'Tagesscore'}
          </span>
        </div>
      </div>

      {/* The numbers behind the arcs — a ring alone cannot be read exactly. */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rings.length}, minmax(0, 1fr))`, gap: 8, width: '100%' }}>
        {rings.map((ring) => (
          <div key={ring.key} style={{ textAlign: 'center', minWidth: 0 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 999,
                background: ring.color,
                marginBottom: 4,
              }}
              aria-hidden
            />
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 850,
                color: 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ring.value}
            </p>
            <p className="muted-sm" style={{ fontSize: 10 }}>{ring.label}</p>
            <p className="muted-sm" style={{ fontSize: 10, color: 'var(--subtle)' }}>{ring.target}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
