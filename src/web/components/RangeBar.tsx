'use client';

import { TONE_COLOR, type TargetRange, type Tone } from '@/domain/goalPhase';

/**
 * A progress bar for a target BAND rather than a single number (§6).
 * The band itself is drawn as a lighter zone, so "inside the range" is a place
 * you can see rather than a percentage you have to interpret.
 */
export function RangeBar({
  value,
  range,
  tone,
  max,
}: {
  value: number;
  range: TargetRange;
  tone: Tone;
  /** Scale end. Defaults to a bit past the top of the range. */
  max?: number;
}) {
  const scaleMax = Math.max(max ?? range.max * 1.25, value * 1.05, range.max * 1.05, 1);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / scaleMax) * 100))}%`;

  return (
    <div
      className="range-bar"
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(scaleMax)}
      aria-label={`${Math.round(value)} von ${range.min}–${range.max}`}
    >
      <div
        className="range-bar-band"
        style={{ left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})` }}
      />
      <div className="range-bar-fill" style={{ width: pct(value), background: TONE_COLOR[tone] }} />
      <div className="range-bar-marker" style={{ left: pct(range.min) }} />
      <div className="range-bar-marker" style={{ left: pct(range.max) }} />
    </div>
  );
}

/** Simple single-target bar, for steps / water / sleep. */
export function GoalBar({ value, goal, tone }: { value: number; goal: number; tone: Tone }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className="range-bar" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(goal)}>
      <div className="range-bar-fill" style={{ width: `${pct}%`, background: TONE_COLOR[tone] }} />
    </div>
  );
}
