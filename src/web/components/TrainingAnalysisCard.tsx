'use client';

import { Activity, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { useTrainingAnalysis } from '@/web/hooks/useTrainingAnalysis';
import { MUSCLE_LABEL, REGION_LABEL } from '@/domain/trainingAnalysis';

const SEVERITY_ICON = {
  info: Info,
  suggest: TrendingUp,
  warn: AlertTriangle,
} as const;

const SEVERITY_COLOR = {
  info: 'var(--subtle)',
  suggest: 'var(--teal)',
  warn: 'var(--gold)',
} as const;

/** Volume, balance and what to train next — the coaching layer for training. */
export function TrainingAnalysisCard() {
  const { analysis, loading, error } = useTrainingAnalysis();

  if (loading) {
    return <section className="panel"><p className="copy" style={{ margin: 0 }}>Trainingsanalyse wird geladen …</p></section>;
  }
  if (error || !analysis) {
    return null;
  }

  const tracked = analysis.loads.filter((load) => load.sets > 0).slice(0, 8);

  return (
    <section className="panel">
      <div className="section-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--violet)" />
          <p className="h3" style={{ fontSize: 15 }}>Trainingsanalyse</p>
        </div>
        <span className="muted-sm">{analysis.sessionCount} Einheiten · {analysis.windowDays} Tage</span>
      </div>

      {analysis.nextFocus && (
        <p className="muted-sm" style={{ marginBottom: 12 }}>
          <strong style={{ color: 'var(--text)' }}>Am wenigsten abgedeckt:</strong>{' '}
          {REGION_LABEL[analysis.nextFocus.region]} — {analysis.nextFocus.reason}
        </p>
      )}

      {/* Region split: the one-glance read on a lopsided plan */}
      {analysis.balance.some((b) => b.sets > 0) && (
        <div className="stack-sm" style={{ marginBottom: 14 }}>
          <p className="section-label">Verteilung</p>
          {analysis.balance.filter((b) => b.sets > 0).map((region) => (
            <div key={region.region}>
              <div className="row-between" style={{ marginBottom: 3 }}>
                <span className="muted-sm">{REGION_LABEL[region.region]}</span>
                <span className="muted-sm">{region.sets} Sätze · {region.share} %</span>
              </div>
              <div className="range-bar" style={{ height: 6 }}>
                <div className="range-bar-fill" style={{ width: `${region.share}%`, background: 'var(--violet)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-muscle volume against its weekly range */}
      {tracked.length > 0 && (
        <div className="stack-sm" style={{ marginBottom: 14 }}>
          <p className="section-label">Volumen pro Muskel</p>
          {tracked.map((load) => {
            const tone =
              load.status === 'good' ? 'var(--teal)'
              : load.status === 'high' ? 'var(--gold)'
              : 'var(--subtle)';
            const fill = Math.min(100, (load.sets / load.range.max) * 100);
            const optimalMark = Math.min(100, (load.range.optimal / load.range.max) * 100);

            return (
              <div key={load.muscle}>
                <div className="row-between" style={{ marginBottom: 3 }}>
                  <span className="muted-sm">{MUSCLE_LABEL[load.muscle]}</span>
                  <span className="muted-sm" style={{ color: tone }}>
                    {load.sets} / {load.range.optimal} Sätze
                    {load.daysSince !== null ? ` · vor ${load.daysSince} T.` : ''}
                  </span>
                </div>
                <div className="range-bar" style={{ height: 6 }}>
                  <div className="range-bar-fill" style={{ width: `${fill}%`, background: tone }} />
                  <div className="range-bar-marker" style={{ left: `${optimalMark}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        {analysis.insights.map((insight) => {
          const Icon = SEVERITY_ICON[insight.severity];
          return (
            <div key={insight.id} className="insight-row">
              <Icon size={14} color={SEVERITY_COLOR[insight.severity]} style={{ marginTop: 2, flexShrink: 0 }} />
              <p className="insight-text">{insight.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
