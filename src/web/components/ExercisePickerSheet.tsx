'use client';

import { useMemo, useState } from 'react';
import { Search, Plus, Check, Info } from 'lucide-react';
import { Sheet } from './Sheet';
import {
  EQUIPMENT_LABELS, MUSCLE_GROUPS, canPerformExercise, filterExercises, type ExerciseEntry,
} from '@/domain/exerciseDatabase';
import { MUSCLE_LABEL } from '@/domain/trainingAnalysis';
import { MuscleMapSvg } from './MuscleMapSvg';
import type { EquipmentId } from '@/domain/equipment';

/**
 * Browse-and-pick for building a plan.
 *
 * The old flow was a search box: fine when you already know the exercise name,
 * useless when you want to see what is available for a muscle group. With 176
 * entries that is the common case, so this leads with filters and shows what
 * each exercise actually trains before you commit to it.
 */
export function ExercisePickerSheet({
  available,
  onPick,
  onClose,
}: {
  available: readonly EquipmentId[];
  onPick: (entry: ExerciseEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(available.length > 0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const results = useMemo(
    () =>
      filterExercises({
        ...(query ? { query } : {}),
        ...(muscle ? { muscle } : {}),
        ...(equipment ? { equipment } : {}),
        onlyAvailable: onlyMine,
        available,
        limit: 120,
      }),
    [query, muscle, equipment, onlyMine, available],
  );

  return (
    <Sheet title="Übung auswählen" onClose={onClose}>
      <div className="search-field" style={{ width: '100%' }}>
        <Search size={15} />
        <input
          type="text"
          placeholder="Übung suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Übung suchen"
          autoComplete="off"
        />
      </div>

      {available.length > 0 && (
        <button
          type="button"
          className={`chip${onlyMine ? ' active' : ''}`}
          onClick={() => setOnlyMine((value) => !value)}
          style={{ alignSelf: 'flex-start' }}
        >
          {onlyMine && <Check size={13} />} Nur mein Equipment
        </button>
      )}

      <div className="stack-sm">
        <p className="section-label">Muskelgruppe</p>
        <div className="chip-row">
          <FilterChip label="Alle" active={muscle === null} onClick={() => setMuscle(null)} />
          {MUSCLE_GROUPS.map((group) => (
            <FilterChip key={group} label={group} active={muscle === group} onClick={() => setMuscle(group)} />
          ))}
        </div>
      </div>

      <div className="stack-sm">
        <p className="section-label">Equipment</p>
        <div className="chip-row">
          <FilterChip label="Alle" active={equipment === null} onClick={() => setEquipment(null)} />
          {EQUIPMENT_LABELS.map((label) => (
            <FilterChip key={label} label={label} active={equipment === label} onClick={() => setEquipment(label)} />
          ))}
        </div>
      </div>

      <div className="row-between">
        <p className="section-label">{results.length} Übungen</p>
        {(muscle || equipment || query) && (
          <button
            type="button"
            className="button ghost compact"
            style={{ padding: 0, minHeight: 0 }}
            onClick={() => { setMuscle(null); setEquipment(null); setQuery(''); }}
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="muted-sm">
          Keine Übung passt zu diesen Filtern.
          {onlyMine ? ' Schalte „Nur mein Equipment“ aus, um alle zu sehen.' : ''}
        </p>
      ) : (
        <div className="stack-sm">
          {results.map((entry) => {
            const doable = available.length === 0 || canPerformExercise(entry, available);
            const isOpen = expanded === entry.name;

            return (
              <div key={entry.name} className="habit-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <p className="h3" style={{ fontSize: 14 }}>
                      {entry.name}
                      {!doable && (
                        <span className="quality-badge estimated" style={{ marginLeft: 6 }}>
                          braucht {entry.equipment}
                        </span>
                      )}
                    </p>
                    <p className="muted-sm">
                      {entry.muscle} · {entry.equipment} · {entry.defaultSets}×{entry.defaultReps}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setExpanded(isOpen ? null : entry.name)}
                      aria-label="Details"
                      aria-expanded={isOpen}
                    >
                      <Info size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onPick(entry)}
                      aria-label={`${entry.name} hinzufügen`}
                      style={{ color: 'var(--violet)' }}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {/* Showing WHERE it works beats a list of muscle names —
                        and the anatomical map covers every exercise for free,
                        which 176 hand-drawn illustrations never would. */}
                    {entry.muscles.length > 0 && (
                      <div style={{ maxWidth: 210, margin: '0 auto 8px' }}>
                        <MuscleMapSvg muscles={entry.muscles} />
                      </div>
                    )}
                    <p className="muted-sm" style={{ marginBottom: 4 }}>
                      <strong style={{ color: 'var(--text)' }}>Trainiert:</strong>{' '}
                      {entry.muscles.map((key) => MUSCLE_LABEL[key]).join(', ') || '—'}
                    </p>
                    {entry.machineInfo && (
                      <p className="muted-sm">
                        <strong style={{ color: 'var(--text)' }}>Ausführung:</strong> {entry.machineInfo}
                      </p>
                    )}
                    <p className="muted-sm">
                      Vorschlag: {entry.defaultSets} Sätze à {entry.defaultReps} Wiederholungen.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`chip${active ? ' active' : ''}`}
      style={{ minHeight: 32, fontSize: 12 }}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
