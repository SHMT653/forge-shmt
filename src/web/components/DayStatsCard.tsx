'use client';

import { BarChart3 } from 'lucide-react';
import { buildDayStats, describeDelta, macroSplit, type DayStatsInput } from '@/domain/dayStats';
import { TONE_COLOR } from '@/domain/goalPhase';

/**
 * The day's numbers, each with its target and how it compares to the user's
 * own recent average. Replaces the bare readouts, which showed a value with
 * nothing to judge it against.
 */
export function DayStatsCard(props: DayStatsInput) {
  const stats = buildDayStats(props);
  const split = macroSplit(props.totals);

  return (
    <section className="panel">
      <div className="section-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={16} color="var(--violet)" />
          <p className="h3" style={{ fontSize: 15 }}>Tagesstatistik</p>
        </div>
        {props.weekly.daysWithData >= 3 && (
          <span className="muted-sm">Vergleich: {props.weekly.daysWithData} Tage</span>
        )}
      </div>

      <div className="stack-sm">
        {stats.map((stat) => {
          const delta = describeDelta(stat.vsAverage);
          return (
            <div key={stat.key}>
              <div className="row-between" style={{ marginBottom: 3 }}>
                <span className="day-stat-label" style={{ fontSize: 12 }}>
                  <span className="status-dot" style={{ background: TONE_COLOR[stat.tone] }} aria-hidden />
                  {stat.label}
                </span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  {delta && (
                    <span
                      className="muted-sm"
                      style={{
                        color:
                          stat.vsAverage !== null && Math.abs(stat.vsAverage) >= 8
                            ? 'var(--subtle)'
                            : 'var(--subtle)',
                      }}
                    >
                      {delta}
                    </span>
                  )}
                  <span className="day-stat-value">{stat.value}</span>
                </span>
              </div>

              {stat.fraction !== null && (
                <div className="range-bar" style={{ height: 5 }}>
                  <div
                    className="range-bar-fill"
                    style={{ width: `${Math.round(stat.fraction * 100)}%`, background: TONE_COLOR[stat.tone] }}
                  />
                </div>
              )}
              {stat.target && (
                <p className="muted-sm" style={{ marginTop: 2, fontSize: 11 }}>Ziel {stat.target}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Macro split — where today's calories actually came from */}
      {split && (
        <div style={{ marginTop: 14 }}>
          <p className="section-label">Verteilung der Kalorien</p>
          <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${split.protein}%`, background: 'var(--teal)' }} />
            <div style={{ width: `${split.carbs}%`, background: 'var(--violet)' }} />
            <div style={{ width: `${split.fat}%`, background: 'var(--gold)' }} />
          </div>
          <div className="chip-row" style={{ marginTop: 6, gap: 12 }}>
            <span className="cal-legend-item"><span className="cal-swatch" style={{ background: 'var(--teal)' }} /> Protein {split.protein} %</span>
            <span className="cal-legend-item"><span className="cal-swatch" style={{ background: 'var(--violet)' }} /> Kohlenhydrate {split.carbs} %</span>
            <span className="cal-legend-item"><span className="cal-swatch" style={{ background: 'var(--gold)' }} /> Fett {split.fat} %</span>
          </div>
        </div>
      )}
    </section>
  );
}
