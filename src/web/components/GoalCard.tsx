'use client';

import Link from 'next/link';
import { Target, ArrowRight } from 'lucide-react';
import { formatRange, type ResolvedTargets } from '@/domain/goalPhase';
import { formatHours, formatLiters } from '@/domain/dayEvaluation';
import type { GoalPhaseRecord } from '@/domain/types';

/** The phase card from §38 — what am I working towards, and since when. */
export function GoalCard({ targets, phase }: { targets: ResolvedTargets; phase: GoalPhaseRecord | null }) {
  const title = phase?.label?.trim() || targets.phase.label;

  return (
    <section className="panel soft">
      <div className="section-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Target size={15} color="var(--violet)" />
          <p className="h3" style={{ fontSize: 15 }}>{title}</p>
        </div>
        <Link href="/settings" prefetch={false} className="card-link">Ziel bearbeiten <ArrowRight size={14} /></Link>
      </div>

      {phase && (
        <p className="muted-sm" style={{ marginBottom: 8 }}>
          Seit {formatDate(phase.startDate)}
          {phase.endDate ? ` bis ${formatDate(phase.endDate)}` : ''}
        </p>
      )}

      <div className="split-4">
        <GoalStat label="Kalorien" value={formatRange(targets.calories)} />
        <GoalStat label="Protein" value={`${targets.protein.min}–${targets.protein.max} g`} />
        <GoalStat label="Schritte" value={targets.steps.toLocaleString('de-DE')} />
        <GoalStat label="Training" value={`${targets.weeklyTrainingGoal}× / Woche`} />
      </div>

      <p className="muted-sm" style={{ marginTop: 10 }}>
        Wasser {formatLiters(targets.waterMl)} · Schlaf {formatHours(targets.sleepH)}
        {targets.weightGoal !== null ? ` · Zielgewicht ${targets.weightGoal} kg` : ''}
      </p>
    </section>
  );
}

function GoalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-value" style={{ fontSize: 14 }}>{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function formatDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
