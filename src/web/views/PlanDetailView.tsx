'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Info, Pencil, Play, Plus, Search, Star, Trash2, X, ListFilter } from 'lucide-react';
import Link from 'next/link';
import { usePlans } from '@/web/hooks/usePlans';
import { foldExerciseText, searchExercises } from '@/domain/exerciseDatabase';
import { listCustomExercises, type DbExercise } from '@/data/exercises';
import { ExerciseInfoModal } from '@/web/components/ExerciseInfoModal';
import { CreateExerciseModal } from '@/web/components/CreateExerciseModal';
import { useAuth } from '@/web/hooks/useAuth';
import { getUserGoals } from '@/data/profile';
import { ExercisePickerSheet } from '@/web/components/ExercisePickerSheet';
import type { EquipmentId } from '@/domain/equipment';
import type { Exercise, PlanDay, TrainingPlan } from '@/domain/types';

/* ── tiny inline sub-components ─────────────────────────── */

function InlineInput({
  value,
  onSave,
  onCancel,
  placeholder,
  style,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="button-row" style={{ gap: 6, ...style }}>
      <input
        className="input compact"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(draft.trim() || value);
          if (e.key === 'Escape') onCancel();
        }}
        style={{ flex: 1 }}
      />
      <button type="button" className="button compact" style={{ padding: '6px 10px' }} onClick={() => onSave(draft.trim() || value)}>
        <Check size={14} />
      </button>
      <button type="button" className="button ghost compact" style={{ padding: '6px 10px' }} onClick={onCancel}>
        <X size={14} />
      </button>
    </div>
  );
}

function ExerciseRow({
  exercise,
  index,
  editing,
  onEdit,
  onSave,
  onDelete,
  onInfo,
}: {
  exercise: Exercise;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onSave: (name: string, sets: number, reps: string) => void;
  onDelete: () => void;
  onInfo: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(String(exercise.targetSets));
  const [reps, setReps] = useState(exercise.targetReps);

  if (editing) {
    return (
      <div className="set-row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="set-row-label">{index + 1}</span>
        <input className="input compact" value={name} onChange={(e) => setName(e.target.value)} placeholder="Übungsname" style={{ flex: 2, minWidth: 120 }} />
        <input className="input compact" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="Sätze" inputMode="numeric" style={{ width: 64 }} />
        <input className="input compact" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Wdh." style={{ width: 80 }} />
        <button type="button" className="button compact" style={{ padding: '6px 10px' }}
          onClick={() => onSave(name.trim() || exercise.name, Math.max(1, Number(sets) || 3), reps.trim() || '8-12')}>
          <Check size={14} />
        </button>
        <button type="button" className="button ghost compact" style={{ padding: '6px 10px' }} onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="set-row">
      <span className="set-row-label">{index + 1}</span>
      <span className="copy" style={{ margin: 0, flex: 1 }}>{exercise.name}</span>
      <span className="copy" style={{ margin: 0, color: 'var(--subtle)' }}>{exercise.targetSets} × {exercise.targetReps}</span>
      <button type="button" className="button ghost compact" style={{ padding: '4px 8px' }} onClick={onInfo} aria-label="Übungsinfos">
        <Info size={12} />
      </button>
      <button type="button" className="button ghost compact" style={{ padding: '4px 8px' }} onClick={onEdit}>
        <Pencil size={12} />
      </button>
    </div>
  );
}

type SearchResult = { name: string; muscle: string; equipment: string; defaultSets: number; defaultReps: string; isCustom?: boolean };

function dbToResult(ex: DbExercise): SearchResult {
  return { name: ex.name, muscle: ex.muscleGroup, equipment: ex.equipment, defaultSets: ex.defaultSets, defaultReps: ex.defaultReps, isCustom: true };
}

function AddExerciseRow({ userId, onAdd }: { userId: string; onAdd: (name: string, sets: number, reps: string) => void }) {
  const [open, setOpen]             = useState(false);
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<SearchResult[]>([]);
  const [selected, setSelected]     = useState<SearchResult | null>(null);
  const [dbCache, setDbCache]       = useState<DbExercise[]>([]);
  const [name, setName]             = useState('');
  const [sets, setSets]             = useState('3');
  const [reps, setReps]             = useState('8-12');
  const [showDrop, setShowDrop]     = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [dropPos, setDropPos]       = useState({ top: 0, left: 0, width: 280 });
  const [equipment, setEquipment]   = useState<EquipmentId[]>([]);
  const wrapRef                     = useRef<HTMLDivElement>(null);
  const searchRef                   = useRef<HTMLInputElement>(null);
  const { user: searchUser }        = useAuth();

  // The user's equipment ranks doable exercises first — with 176 entries an
  // unranked list buries push-up variations under cable work.
  useEffect(() => {
    if (!searchUser) return;
    let active = true;
    void getUserGoals(searchUser.id)
      .then((goals) => { if (active) setEquipment(goals.equipment); })
      .catch(() => { /* ranking is an enhancement — search still works */ });
    return () => { active = false; };
  }, [searchUser]);

  // Fetch custom exercises once when row opens
  useEffect(() => {
    if (!open) return;
    void listCustomExercises().then(setDbCache);
  }, [open]);

  useEffect(() => {
    if (!showDrop) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showDrop]);

  function handleSearch(q: string) {
    setQuery(q);
    setSelected(null);
    if (!q.trim()) { setShowDrop(false); return; }
    const localHits: SearchResult[] = searchExercises(q, { available: equipment }).map((e) => ({ name: e.name, muscle: e.muscle, equipment: e.equipment, defaultSets: e.defaultSets, defaultReps: e.defaultReps }));
    // Custom exercises need the same umlaut tolerance as the built-in table.
    const qLow = foldExerciseText(q);
    const dbHits: SearchResult[] = dbCache
      .filter((e) => foldExerciseText(e.name).includes(qLow) || foldExerciseText(e.muscleGroup).includes(qLow))
      .map(dbToResult);
    const merged = [...localHits];
    for (const d of dbHits) {
      if (!merged.find((r) => r.name.toLowerCase() === d.name.toLowerCase())) merged.push(d);
    }
    setResults(merged.slice(0, 10));
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      setShowDrop(true);
    }
  }

  function pick(ex: SearchResult) {
    setSelected(ex);
    setName(ex.name);
    setSets(String(ex.defaultSets));
    setReps(ex.defaultReps);
    setQuery('');
    setResults([]);
    setShowDrop(false);
  }

  function submit() {
    const n = name.trim() || query.trim();
    if (!n) return;
    onAdd(n, Math.max(1, Number(sets) || 3), reps.trim() || '8-12');
    setName(''); setQuery(''); setSets('3'); setReps('8-12'); setSelected(null);
    setOpen(false);
  }

  function close() {
    setOpen(false); setName(''); setQuery(''); setSelected(null); setShowDrop(false);
  }

  if (!open) {
    return (
      <>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <button type="button" className="button secondary compact" onClick={() => setShowBrowser(true)}>
            <ListFilter size={14} /> Übungen durchsuchen
          </button>
          <button type="button" className="button ghost compact" onClick={() => { setOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}>
            <Plus size={14} /> Direkt eintragen
          </button>
        </div>

        {showBrowser && (
          <ExercisePickerSheet
            available={equipment}
            onClose={() => setShowBrowser(false)}
            onPick={(entry) => {
              onAdd(entry.name, entry.defaultSets, entry.defaultReps);
              setShowBrowser(false);
            }}
          />
        )}
      </>
    );
  }

  const muscleColors: Record<string, string> = {
    Brust: '#d96060', Rücken: 'var(--teal)', Schultern: '#c9a227',
    Beine: 'var(--violet)', Bizeps: 'var(--teal)', Trizeps: '#c9a227', Bauch: '#d96060', Cardio: '#d96060',
  };

  return (
    <>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Search field */}
        <div ref={wrapRef}>
          <div className="search-field">
            <Search size={14} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Übung suchen oder neu erstellen …"
              value={selected ? selected.name : query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setShowDrop(true); }}
              onKeyDown={(e) => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && !showDrop) submit(); }}
              autoComplete="off"
            />
            {(query || selected) && (
              <button type="button" onClick={() => { setQuery(''); setSelected(null); setResults([]); setShowDrop(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 2 }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown */}
        {showDrop && (
          <div style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 300,
            background: 'var(--panel, #16161b)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', maxHeight: 280, overflowY: 'auto',
          }}>
            {results.map((ex) => (
              <button key={ex.name} type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(ex); }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{ex.name}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {ex.isCustom && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(123,92,240,0.2)', color: '#a990ff' }}>Custom</span>}
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.07)', color: muscleColors[ex.muscle] ?? 'var(--subtle)', whiteSpace: 'nowrap' }}>
                      {ex.muscle}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{ex.equipment} · {ex.defaultSets}×{ex.defaultReps}</span>
              </button>
            ))}
            {/* Create new exercise option */}
            {query.length >= 2 && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setShowDrop(false); setShowCreate(true); }}
                style={{ width: '100%', textAlign: 'left', background: 'rgba(123,92,240,0.08)', border: 'none', padding: '10px 14px', cursor: 'pointer', borderTop: results.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={13} color="#a990ff" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#a990ff' }}>„{query}" als neue Übung erstellen</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--subtle)' }}>Muskeln auswählen & in Community speichern</span>
              </button>
            )}
          </div>
        )}

        {/* Sets / Reps + manual name fallback */}
        {(selected || query.length >= 2) && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {!selected && (
              <input className="input compact" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Übungsname" style={{ flex: 2, minWidth: 120 }} />
            )}
            <input className="input compact" value={sets} onChange={(e) => setSets(e.target.value)}
              placeholder="Sätze" inputMode="numeric" style={{ width: 64 }} />
            <input className="input compact" value={reps} onChange={(e) => setReps(e.target.value)}
              placeholder="Wdh." style={{ width: 80 }} />
            <button type="button" className="button compact" style={{ padding: '6px 10px' }} onClick={submit}><Check size={14} /></button>
            <button type="button" className="button ghost compact" style={{ padding: '6px 10px' }} onClick={close}><X size={14} /></button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateExerciseModal
          userId={userId}
          initialName={query}
          onCreated={(n, s, r) => { onAdd(n, s, r); close(); setShowCreate(false); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}

function DayCard({
  day,
  plan,
  editMode,
  busy,
  userId,
  onStart,
  onRenameDay,
  onDeleteDay,
  onSaveExercise,
  onDeleteExercise,
  onAddExercise,
  onShowInfo,
}: {
  day: PlanDay;
  plan: TrainingPlan;
  editMode: boolean;
  busy: string | null;
  userId: string;
  onStart: () => void;
  onRenameDay: (name: string) => void;
  onDeleteDay: () => void;
  onSaveExercise: (ex: Exercise, name: string, sets: number, reps: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onAddExercise: (name: string, sets: number, reps: string) => void;
  onShowInfo: (name: string) => void;
}) {
  const [editingDayName, setEditingDayName] = useState(false);
  const [editingExId, setEditingExId] = useState<string | null>(null);

  return (
    <div className="exercise-card">
      <div className="section-head" style={{ marginBottom: 4 }}>
        {editMode && editingDayName ? (
          <InlineInput
            value={day.name}
            onSave={(v) => { onRenameDay(v); setEditingDayName(false); }}
            onCancel={() => setEditingDayName(false)}
            style={{ flex: 1 }}
          />
        ) : (
          <div className="button-row" style={{ flex: 1, gap: 8 }}>
            <h2 className="h2">{day.name}</h2>
            {editMode && (
              <button type="button" className="button ghost compact" style={{ padding: '4px 8px' }} onClick={() => setEditingDayName(true)}>
                <Pencil size={12} />
              </button>
            )}
          </div>
        )}
        {!editMode && (
          <button type="button" className="button compact" disabled={busy === day.id} onClick={onStart}>
            <Play size={14} /> {busy === day.id ? 'Startet …' : 'Starten'}
          </button>
        )}
        {editMode && (
          <button type="button" className="button ghost compact" onClick={onDeleteDay} style={{ color: 'var(--danger)' }}>
            <Trash2 size={14} /> Tag
          </button>
        )}
      </div>

      <div className="list">
        {day.exercises.map((exercise, index) => (
          <ExerciseRow
            key={exercise.id}
            exercise={exercise}
            index={index}
            editing={editMode && editingExId === exercise.id}
            onEdit={() => setEditingExId(exercise.id)}
            onSave={(name, sets, reps) => { onSaveExercise(exercise, name, sets, reps); setEditingExId(null); }}
            onDelete={() => { onDeleteExercise(exercise.id); setEditingExId(null); }}
            onInfo={() => onShowInfo(exercise.name)}
          />
        ))}
      </div>

      <AddExerciseRow userId={userId} onAdd={onAddExercise} />
    </div>
  );
}

/* ── Main view ───────────────────────────────────────────── */

export function PlanDetailView({ planId }: { planId: string }) {
  const { plans, loading, activate, remove, startDay, editPlanName, addDay, renameDay, deleteDay, addExercise, editExercise, deleteExercise } = usePlans();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingPlanName, setEditingPlanName] = useState(false);
  const [nameField, setNameField] = useState('');
  const [focusField, setFocusField] = useState('');
  const [infoExercise, setInfoExercise] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId);

  if (loading) return <p className="copy">Lädt …</p>;

  if (!plan) {
    return (
      <div className="empty-state">
        <p className="copy">Dieser Plan existiert nicht (mehr).</p>
        <Link href="/plans" className="button secondary compact">Zurück zu den Plänen</Link>
      </div>
    );
  }

  async function handleStart(day: PlanDay) {
    setBusy(day.id);
    try {
      const sessionId = await startDay(plan as TrainingPlan, day);
      if (sessionId) router.push(`/workout/${sessionId}`);
    } finally {
      setBusy(null);
    }
  }

  function enterEditMode() {
    setNameField(plan!.name);
    setFocusField(plan!.focus);
    setEditMode(true);
  }

  async function savePlanName() {
    await editPlanName(plan!.id, nameField.trim() || plan!.name, focusField.trim());
    setEditingPlanName(false);
  }

  return (
    <>
      <div>
        <Link href="/plans" className="button ghost compact"><ArrowLeft size={16} /> Pläne</Link>
      </div>

      <section className="panel">
        <div className="section-head">
          <div style={{ flex: 1 }}>
            <p className="eyebrow">{plan.focus || 'Trainingsplan'}</p>
            {editMode && editingPlanName ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                <input className="input" value={nameField} onChange={(e) => setNameField(e.target.value)} placeholder="Planname" />
                <input className="input compact" value={focusField} onChange={(e) => setFocusField(e.target.value)} placeholder="Fokus (optional)" />
                <div className="button-row">
                  <button type="button" className="button compact" onClick={savePlanName}><Check size={14} /> Speichern</button>
                  <button type="button" className="button ghost compact" onClick={() => setEditingPlanName(false)}><X size={14} /> Abbrechen</button>
                </div>
              </div>
            ) : (
              <div className="button-row" style={{ gap: 10, alignItems: 'center' }}>
                <h1 className="h1" style={{ fontSize: 28, margin: 0 }}>{plan.name}</h1>
                {editMode && (
                  <button type="button" className="button ghost compact" style={{ padding: '4px 8px' }} onClick={() => setEditingPlanName(true)}>
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          {plan.isActive && <span className="badge done">Aktiv</span>}
        </div>

        <div className="card-actions" style={{ marginTop: 12 }}>
          {!plan.isActive && (
            <button
              type="button"
              className="button secondary compact"
              disabled={busy === 'activate'}
              onClick={async () => { setBusy('activate'); try { await activate(plan.id); } finally { setBusy(null); } }}
            >
              <Star size={14} /> {busy === 'activate' ? 'Wird gesetzt …' : 'Als aktiv setzen'}
            </button>
          )}
          <button
            type="button"
            className={`button ${editMode ? 'compact' : 'secondary compact'}`}
            onClick={() => { editMode ? setEditMode(false) : enterEditMode(); setEditingPlanName(false); }}
          >
            {editMode ? <><Check size={14} /> Fertig</> : <><Pencil size={14} /> Plan bearbeiten</>}
          </button>
          <button
            type="button"
            className="button ghost compact"
            disabled={busy === 'delete'}
            onClick={async () => {
              if (!window.confirm(`„${plan.name}" wirklich löschen?`)) return;
              setBusy('delete');
              try { await remove(plan.id); router.push('/plans'); } finally { setBusy(null); }
            }}
          >
            <Trash2 size={14} /> Löschen
          </button>
        </div>
      </section>

      <section className="list">
        {plan.days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            plan={plan}
            editMode={editMode}
            busy={busy}
            userId={user?.id ?? ''}
            onStart={() => handleStart(day)}
            onRenameDay={(name) => void renameDay(day.id, name)}
            onDeleteDay={async () => {
              if (!window.confirm(`Tag „${day.name}" wirklich löschen?`)) return;
              await deleteDay(day.id);
            }}
            onSaveExercise={(ex, name, sets, reps) => void editExercise(ex.id, name, sets, reps)}
            onDeleteExercise={(id) => void deleteExercise(id)}
            onAddExercise={(name, sets, reps) => void addExercise(day.id, name, sets, reps, day.exercises.length)}
            onShowInfo={(name) => setInfoExercise(name)}
          />
        ))}
      </section>

      {infoExercise && (
        <ExerciseInfoModal name={infoExercise} onClose={() => setInfoExercise(null)} />
      )}

      {editMode && (
        <div style={{ padding: '0 0 16px' }}>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => void addDay(plan.id, `Tag ${plan.days.length + 1}`, plan.days.length)}
          >
            <Plus size={14} /> Trainingstag hinzufügen
          </button>
        </div>
      )}
    </>
  );
}
