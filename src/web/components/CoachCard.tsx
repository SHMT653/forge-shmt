'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { TONE_COLOR } from '@/domain/goalPhase';
import type { CoachInsight } from '@/domain/coach';

/** The coach's headline read on the day — one paragraph, from real numbers. */
export function CoachCard({ text, onOpenCoach }: { text: string; onOpenCoach?: () => void }) {
  return (
    <div className="coach-card">
      <span className="coach-avatar" aria-hidden>
        <Sparkles size={17} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="coach-label">Coach</p>
        <p className="coach-text">{text}</p>
        {onOpenCoach && (
          <button
            type="button"
            className="button ghost compact"
            style={{ marginTop: 8, padding: 0, minHeight: 0, color: 'var(--violet)' }}
            onClick={onOpenCoach}
          >
            Nachfragen →
          </button>
        )}
      </div>
    </div>
  );
}

/** The supporting detail list under the headline. */
export function InsightList({ insights, limit = 4 }: { insights: readonly CoachInsight[]; limit?: number }) {
  const shown = insights.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div>
      {shown.map((insight) => (
        <div key={insight.id} className="insight-row">
          <span
            className="status-dot"
            style={{ background: TONE_COLOR[insight.tone], marginTop: 6 }}
            aria-hidden
          />
          <p className="insight-text">{insight.text}</p>
          {insight.href && insight.actionLabel && (
            <Link href={insight.href} className="card-link" style={{ paddingTop: 1 }}>
              {insight.actionLabel}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
