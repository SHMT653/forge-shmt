'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { findExercise, type ExerciseEntry } from '@/domain/exerciseDatabase';
import { guideFor } from '@/domain/exerciseGuide';
import { findCustomExerciseByName } from '@/data/exercises';
import { MuscleMapSvg } from './MuscleMapSvg';

/**
 * The exercise detail reachable mid-workout from the ⓘ button.
 *
 * Shows the same guidance as the picker in the plan builder — how to execute
 * it, what usually goes wrong, tempo and breathing — because the moment you
 * most need to be told to keep your elbows in is the set itself, not the
 * evening you wrote the plan.
 */
export function ExerciseInfoModal({ name, onClose }: { name: string; onClose: () => void }) {
  const local = findExercise(name);
  const [entry, setEntry] = useState<ExerciseEntry | null>(local ?? null);
  const [loading, setLoading] = useState(!local);

  useEffect(() => {
    if (local) { setEntry(local); setLoading(false); return; }
    let active = true;
    setLoading(true);
    void findCustomExerciseByName(name)
      .then((row) => {
        if (!active) return;
        setEntry(
          row
            ? {
                name: row.name,
                muscle: row.muscleGroup,
                equipment: row.equipment as ExerciseEntry['equipment'],
                defaultSets: row.defaultSets,
                defaultReps: row.defaultReps,
                muscles: row.muscles,
                ...(row.machineInfo ? { machineInfo: row.machineInfo } : {}),
              }
            : null,
        );
      })
      .catch(() => { if (active) setEntry(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [name, local]);

  const guide = entry ? guideFor(entry) : null;

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <div className="sheet-grip" aria-hidden />

        <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p className="h3" style={{ fontSize: 17 }}>{name}</p>
            {entry && (
              <p className="muted-sm">
                {entry.equipment} · {entry.muscle} · {entry.defaultSets}×{entry.defaultReps}
              </p>
            )}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        {loading && <p className="muted-sm">Lädt …</p>}
        {!loading && !guide && <p className="muted-sm">Keine weiteren Infos verfügbar.</p>}

        {guide && entry && (
          <div className="picker-detail" style={{ border: 'none', padding: 0 }}>
            {entry.muscles.length > 0 && (
              <div style={{ maxWidth: 230, margin: '0 auto 10px' }}>
                <MuscleMapSvg muscles={entry.muscles} />
              </div>
            )}

            <p className="picker-summary">{guide.summary}</p>

            <dl className="picker-facts">
              <dt>Muster</dt>
              <dd>{guide.patternLabel}</dd>
              <dt>Hauptsächlich</dt>
              <dd>{guide.primaryLabels.join(', ') || '—'}</dd>
              {guide.secondaryLabels.length > 0 && (
                <>
                  <dt>Mitbeansprucht</dt>
                  <dd>{guide.secondaryLabels.join(', ')}</dd>
                </>
              )}
              {entry.machineInfo && (
                <>
                  <dt>Gerät</dt>
                  <dd>{entry.machineInfo}</dd>
                </>
              )}
            </dl>

            <p className="section-label" style={{ marginTop: 12 }}>Ausführung</p>
            <ol className="picker-list">{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>

            <p className="section-label" style={{ marginTop: 12 }}>Häufige Fehler</p>
            <ul className="picker-list mistakes">{guide.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>

            <p className="picker-tempo"><strong>Tempo &amp; Atmung:</strong> {guide.tempo}</p>
          </div>
        )}
      </div>
    </div>
  );
}
