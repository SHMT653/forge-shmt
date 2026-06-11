'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { findExercise } from '@/domain/exerciseDatabase';
import { findCustomExerciseByName, type DbExercise } from '@/data/exercises';
import { MuscleMapSvg } from './MuscleMapSvg';
import type { MuscleKey } from '@/domain/exerciseDatabase';

type ResolvedEntry = {
  equipment: string;
  muscle: string;
  defaultSets: number;
  defaultReps: string;
  muscles: MuscleKey[];
  machineInfo?: string | null;
};

export function ExerciseInfoModal({ name, onClose }: { name: string; onClose: () => void }) {
  const local = findExercise(name);
  const [dbEntry, setDbEntry] = useState<DbExercise | null>(null);
  const [loadingDb, setLoadingDb] = useState(!local);

  useEffect(() => {
    if (local) return;
    setLoadingDb(true);
    void findCustomExerciseByName(name)
      .then(setDbEntry)
      .finally(() => setLoadingDb(false));
  }, [name, local]);

  const entry: ResolvedEntry | null = local
    ? { ...local, muscle: local.muscle }
    : dbEntry
    ? { equipment: dbEntry.equipment, muscle: dbEntry.muscleGroup, defaultSets: dbEntry.defaultSets, defaultReps: dbEntry.defaultReps, muscles: dbEntry.muscles, machineInfo: dbEntry.machineInfo }
    : null;

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
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 4, flexShrink: 0 }} aria-label="Schließen">
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

        {loadingDb && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--subtle)' }}>Lädt …</p>
        )}

        {!loadingDb && !entry && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--subtle)' }}>Keine weiteren Infos verfügbar.</p>
        )}
      </div>
    </div>
  );
}
