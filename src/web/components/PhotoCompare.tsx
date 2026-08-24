'use client';

import { useState } from 'react';
import type { ProgressPhoto } from '@/domain/types';

/**
 * Side-by-side progress photo comparison (§28).
 * A slider is nice, but two photos at the same size next to each other is what
 * actually shows a change — so that is the default.
 */
export function PhotoCompare({ photos }: { photos: readonly ProgressPhoto[] }) {
  const sorted = [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(Math.max(0, sorted.length - 1));

  if (sorted.length < 2) {
    return (
      <p className="muted-sm">
        Ab zwei Bildern derselben Pose kannst du hier direkt vergleichen.
      </p>
    );
  }

  const left = sorted[Math.min(leftIndex, sorted.length - 1)];
  const right = sorted[Math.min(rightIndex, sorted.length - 1)];

  return (
    <div className="stack-sm">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[left, right].map((photo, side) => (
          <div key={side}>
            <div
              style={{
                position: 'relative',
                aspectRatio: '3 / 4',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                background: 'var(--surface-2)',
              }}
            >
              {photo?.url && (
                <img
                  src={photo.url}
                  alt={`Fortschrittsbild ${photo.takenAt}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </div>
            <p className="muted-sm" style={{ marginTop: 4, textAlign: 'center' }}>
              {photo?.takenAt}
              {photo?.weightKg ? ` · ${photo.weightKg} kg` : ''}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="field">
          <span className="field-label">Vorher</span>
          <select
            className="select"
            value={leftIndex}
            onChange={(e) => setLeftIndex(Number(e.target.value))}
          >
            {sorted.map((photo, index) => (
              <option key={photo.id} value={index}>{photo.takenAt}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Nachher</span>
          <select
            className="select"
            value={rightIndex}
            onChange={(e) => setRightIndex(Number(e.target.value))}
          >
            {sorted.map((photo, index) => (
              <option key={photo.id} value={index}>{photo.takenAt}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
