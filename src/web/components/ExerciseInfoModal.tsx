'use client';

import { X } from 'lucide-react';
import { findExercise } from '@/domain/exerciseDatabase';
import { MuscleMapSvg } from './MuscleMapSvg';

export function ExerciseInfoModal({ name, onClose }: { name: string; onClose: () => void }) {
  const entry = findExercise(name);
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      <div
        style={{ position: 'relative', background: 'var(--surface, #1a1a22)', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '85dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{name}</p>
            {entry && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--subtle)' }}>
                {entry.equipment} · {entry.muscle} · {entry.defaultSets}×{entry.defaultReps}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 4, flexShrink: 0 }}
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        {entry?.machineInfo && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(107,83,217,0.12)', borderRadius: 10, border: '1px solid rgba(107,83,217,0.2)' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Maschine / Equipment</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{entry.machineInfo}</p>
          </div>
        )}

        {entry && entry.muscles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Muskelgruppen</p>
            <MuscleMapSvg muscles={entry.muscles} />
          </div>
        )}

        {!entry && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--subtle)' }}>Keine weiteren Infos für diese Übung verfügbar.</p>
        )}
      </div>
    </div>
  );
}
