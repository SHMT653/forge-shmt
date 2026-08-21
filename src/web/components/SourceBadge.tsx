'use client';

import { Activity } from 'lucide-react';
import type { MetricSource } from '@/domain/health';

/**
 * A quiet marker that a number came from a platform rather than a thumb (§16).
 * Deliberately small — it is provenance, not a headline.
 */
export function SourceBadge({ source }: { source: MetricSource }) {
  if (source !== 'apple_health') return null;
  return (
    <span
      title="Automatisch aus Apple Health übernommen"
      aria-label="Quelle: Apple Health"
      style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--subtle)', marginLeft: 4 }}
    >
      <Activity size={11} />
    </span>
  );
}
