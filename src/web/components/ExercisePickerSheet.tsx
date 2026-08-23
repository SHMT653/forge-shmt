'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Check, ChevronDown, Sparkles } from 'lucide-react';
import { Sheet } from './Sheet';
import {
  EQUIPMENT_LABELS, MUSCLE_GROUPS, canPerformExercise, filterExercises,
  foldExerciseText, type ExerciseEntry,
} from '@/domain/exerciseDatabase';
import { guideFor } from '@/domain/exerciseGuide';
import { listCustomExercises, type DbExercise } from '@/data/exercises';
import { MuscleMapSvg } from './MuscleMapSvg';
import { ExerciseFormSvg } from './ExerciseFormSvg';
import type { EquipmentId } from '@/domain/equipment';

/**
 * Browse-and-pick for building a plan.
 *
 * This replaced two separate flows: a filter sheet, and a search box that
 * rendered its own `position: fixed` dropdown whose coordinates were computed
 * by hand. That dropdown capped results at ten and mispositioned itself as soon
 * as anything scrolled, which is why the plan builder felt like it had no
 * exercise list at all. One surface now, and it always shows every match.
 */
export function ExercisePickerSheet({
  available,
  onPick,
  onClose,
  /** Names already in the day, so re-picking is visible instead of silent. */
  chosen = [],
  /** Stays open after a pick, for filling a whole training day in one go. */
  multiple = false,
  onCreateCustom,
}: {
  available: readonly EquipmentId[];
  onPick: (entry: ExerciseEntry) => void;
  onClose: () => void;
  chosen?: readonly string[];
  multiple?: boolean;
  onCreateCustom?: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(available.length > 0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [custom, setCustom] = useState<DbExercise[]>([]);

  // The user's own exercises belong in the same list as the built-in ones —
  // keeping them in a separate flow was why they were so hard to find.
  useEffect(() => {
    let active = true;
    void listCustomExercises()
      .then((rows) => { if (active) setCustom(rows); })
      .catch(() => { /* the built-in table is enough on its own */ });
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    const builtIn = filterExercises({
      ...(query ? { query } : {}),
      ...(muscle ? { muscle } : {}),
      ...(equipment ? { equipment } : {}),
      onlyAvailable: onlyMine,
      available,
      limit: 400,
    });

    const folded = foldExerciseText(query);
    const known = new Set(builtIn.map((e) => e.name.toLowerCase()));
    const mine: ExerciseEntry[] = custom
      .filter((e) => !known.has(e.name.toLowerCase()))
      .filter((e) => !muscle || e.muscleGroup === muscle)
      .filter((e) => !equipment || e.equipment === equipment)
      .filter((e) => !query || foldExerciseText(e.name).includes(folded) || foldExerciseText(e.muscleGroup).includes(folded))
      .map((e) => ({
        name: e.name,
        muscle: e.muscleGroup,
        equipment: e.equipment as ExerciseEntry['equipment'],
        defaultSets: e.defaultSets,
        defaultReps: e.defaultReps,
        muscles: e.muscles,
        ...(e.machineInfo ? { machineInfo: e.machineInfo } : {}),
      }));

    return [...mine, ...builtIn];
  }, [query, muscle, equipment, onlyMine, available, custom]);

  const exactHit = results.some((e) => e.name.toLowerCase() === query.trim().toLowerCase());

  function handlePick(entry: ExerciseEntry) {
    onPick(entry);
    if (multiple) {
      setAdded((prev) => (prev.includes(entry.name) ? prev : [...prev, entry.name]));
    } else {
      onClose();
    }
  }

  const alreadyIn = (name: string) => added.includes(name) || chosen.includes(name);

  return (
    <Sheet
      title="Übung auswählen"
      onClose={onClose}
      {...(multiple
        ? {
            footer: (
              <button type="button" className="button" style={{ width: '100%' }} onClick={onClose}>
                {added.length > 0 ? `${added.length} übernommen — fertig` : 'Fertig'}
              </button>
            ),
          }
        : {})}
    >
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

      {onCreateCustom && query.trim().length >= 2 && !exactHit && (
        <button
          type="button"
          className="button secondary"
          style={{ width: '100%' }}
          onClick={() => onCreateCustom(query.trim())}
        >
          <Sparkles size={15} /> „{query.trim()}" als eigene Übung anlegen
        </button>
      )}

      {results.length === 0 ? (
        <p className="muted-sm">
          Keine Übung passt zu diesen Filtern.
          {onlyMine ? ' Schalte „Nur mein Equipment“ aus, um alle zu sehen.' : ''}
        </p>
      ) : (
        <div className="stack-sm">
          {results.map((entry) => (
            <ExerciseRow
              key={entry.name}
              entry={entry}
              doable={available.length === 0 || canPerformExercise(entry, available)}
              open={expanded === entry.name}
              added={alreadyIn(entry.name)}
              onToggle={() => setExpanded(expanded === entry.name ? null : entry.name)}
              onPick={() => handlePick(entry)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function ExerciseRow({
  entry, doable, open, added, onToggle, onPick,
}: {
  entry: ExerciseEntry;
  doable: boolean;
  open: boolean;
  added: boolean;
  onToggle: () => void;
  onPick: () => void;
}) {
  const guide = useMemo(() => guideFor(entry), [entry]);

  return (
    <div className="picker-row">
      <div className="picker-row-head">
        {/* The whole title area opens the detail — a 15px info icon was not a
            reachable tap target on a phone. */}
        <button type="button" className="picker-row-title" onClick={onToggle} aria-expanded={open}>
          <span className="picker-row-name">
            {entry.name}
            {!doable && <span className="quality-badge estimated">braucht {entry.equipment}</span>}
          </span>
          <span className="muted-sm">
            {guide.primaryLabels[0] ?? entry.muscle} · {entry.equipment} · {entry.defaultSets}×{entry.defaultReps}
          </span>
        </button>
        <ChevronDown size={15} className={`picker-chevron${open ? ' open' : ''}`} aria-hidden />
        <button
          type="button"
          className={`picker-add${added ? ' added' : ''}`}
          onClick={onPick}
          aria-label={`${entry.name} hinzufügen`}
        >
          {added ? <Check size={17} /> : <Plus size={17} />}
        </button>
      </div>

      {open && (
        <div className="picker-detail">
          <ExerciseFormSvg pattern={guide.pattern} patternLabel={guide.patternLabel} />

          {entry.muscles.length > 0 && (
            <div style={{ maxWidth: 210, margin: '0 auto 10px' }}>
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
            <dt>Vorschlag</dt>
            <dd>{entry.defaultSets} Sätze à {entry.defaultReps} Wiederholungen</dd>
            {entry.machineInfo && (
              <>
                <dt>Gerät</dt>
                <dd>{entry.machineInfo}</dd>
              </>
            )}
          </dl>

          <p className="section-label" style={{ marginTop: 12 }}>Ausführung</p>
          <ol className="picker-list">
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>

          <p className="section-label" style={{ marginTop: 12 }}>Häufige Fehler</p>
          <ul className="picker-list mistakes">
            {guide.mistakes.map((m) => <li key={m}>{m}</li>)}
          </ul>

          <p className="picker-tempo"><strong>Tempo &amp; Atmung:</strong> {guide.tempo}</p>
        </div>
      )}
    </div>
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
