'use client';

import { useMemo } from 'react';
import type { WeightPoint } from '@/domain/weightTrend';

/**
 * Daily weight as a thin line, the 7-day trend as the bold one (§25).
 *
 * The visual hierarchy is the message: the jagged line is water and salt, the
 * smooth one is what is actually happening to your body.
 */
export function WeightTrendChart({
  points,
  height = 150,
  goalKg,
}: {
  points: readonly WeightPoint[];
  height?: number;
  goalKg?: number | null;
}) {
  const chart = useMemo(() => {
    const withTrend = points.filter((p) => p.trend !== null);
    if (withTrend.length < 2) return null;

    const values: number[] = [];
    for (const p of points) {
      if (p.raw !== null) values.push(p.raw);
      if (p.trend !== null) values.push(p.trend);
    }
    if (goalKg) values.push(goalKg);

    const min = Math.min(...values);
    const max = Math.max(...values);
    // A flat week should look flat, not like a mountain range.
    const pad = Math.max(0.6, (max - min) * 0.18);
    const lo = min - pad;
    const hi = max + pad;
    const span = hi - lo || 1;

    const width = 320;
    const x = (i: number) => (i / Math.max(1, points.length - 1)) * (width - 10) + 5;
    const y = (v: number) => height - 8 - ((v - lo) / span) * (height - 20);

    const rawPath: string[] = [];
    let penDown = false;
    points.forEach((p, i) => {
      if (p.raw === null) { penDown = false; return; }
      rawPath.push(`${penDown ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.raw).toFixed(1)}`);
      penDown = true;
    });

    const trendPath = points
      .map((p, i) => (p.trend === null ? null : `${i === 0 || points[i - 1]?.trend === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`))
      .filter((segment): segment is string => segment !== null)
      .join(' ');

    const last = withTrend[withTrend.length - 1];
    const lastIndex = points.findIndex((p) => p === last);

    return {
      width,
      rawPath: rawPath.join(' '),
      trendPath,
      lastX: x(lastIndex),
      lastY: last?.trend !== null && last?.trend !== undefined ? y(last.trend) : 0,
      goalY: goalKg ? y(goalKg) : null,
      lo,
      hi,
    };
  }, [points, height, goalKg]);

  if (!chart) {
    return (
      <div className="empty-state" style={{ padding: '24px 16px' }}>
        <p className="copy" style={{ margin: 0 }}>Noch kein Trend</p>
        <p className="muted-sm">Trage mindestens zwei Messungen ein, dann zeichne ich die Linie.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${chart.width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Gewichtsverlauf mit 7-Tage-Trend"
        preserveAspectRatio="none"
      >
        {chart.goalY !== null && (
          <line
            x1={0}
            x2={chart.width}
            y1={chart.goalY}
            y2={chart.goalY}
            stroke="var(--gold)"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.55}
          />
        )}
        <path d={chart.rawPath} fill="none" stroke="var(--subtle)" strokeWidth={1} opacity={0.65} />
        <path
          d={chart.trendPath}
          fill="none"
          stroke="var(--violet)"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={chart.lastX} cy={chart.lastY} r={4} fill="var(--violet)" />
      </svg>

      <div className="chip-row" style={{ marginTop: 6, gap: 12 }}>
        <span className="muted-sm"><span style={{ color: 'var(--subtle)' }}>──</span> Tageswert</span>
        <span className="muted-sm"><span style={{ color: 'var(--violet)' }}>━━</span> 7-Tage-Trend</span>
        {chart.goalY !== null && <span className="muted-sm"><span style={{ color: 'var(--gold)' }}>┄┄</span> Ziel</span>}
      </div>
    </div>
  );
}
