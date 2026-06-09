'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Pencil, Play, Plus, Star, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { usePlans } from '@/web/hooks/usePlans';
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
}: {
  exercise: Exercise;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onSave: (name: string, sets: number, reps: string) => void;
  onDelete: () => void;
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
      <button type="button" className="button ghost compact" style={{ padding: '4px 8px' }} onClick={onEdit}>
        <Pencil size={12} />
      </button>
    </div>
  );
}

function AddExerciseRow({ onAdd }: { onAdd: (name: string, sets: number, reps: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8-12');

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim(), Math.max(1, Number(sets) || 3), reps.trim() || '8-12');
    setName('');
    setSets('3');
    setReps('8-12');
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="button ghost compact" style={{ marginTop: 4 }} onClick={() => setOpen(true)}>
        <Plus size={14} /> Übung hinzufügen
      </button>
    );
  }

  return (
    <div className="set-row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      <input className="input compact" value={name} onChange={(e) => setName(e.target.value)} placeholder="Übungsname" autoFocus style={{ flex: 2, minWidth: 120 }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }} />
      <input className="input compact" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="Sätze" inputMode="numeric" style={{ width: 64 }} />
      <input className="input compact" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Wdh." style={{ width: 80 }} />
      <button type="button" className="button compact" style={{ padding: '6px 10px' }} onClick={submit}><Check size={14} /></button>
      <button type="button" className="button ghost compact" style={{ padding: '6px 10px' }} onClick={() => setOpen(false)}><X size={14} /></button>
    </div>
  );
}

function DayCard({
  day,
  plan,
  editMode,
  busy,
  onStart,
  onRenameDay,
  onDeleteDay,
  onSaveExercise,
  onDeleteExercise,
  onAddExercise,
}: {
  day: PlanDay;
  plan: TrainingPlan;
  editMode: boolean;
  busy: string | null;
  onStart: () => void;
  onRenameDay: (name: string) => void;
  onDeleteDay: () => void;
  onSaveExercise: (ex: Exercise, name: string, sets: number, reps: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onAddExercise: (name: string, sets: number, reps: string) => void;
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
          />
        ))}
      </div>

      {editMode && (
        <AddExerciseRow onAdd={onAddExercise} />
      )}
    </div>
  );
}

/* ── Main view ───────────────────────────────────────────── */

export function PlanDetailView({ planId }: { planId: string }) {
  const { plans, loading, activate, remove, startDay, editPlanName, addDay, renameDay, deleteDay, addExercise, editExercise, deleteExercise } = usePlans();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingPlanName, setEditingPlanName] = useState(false);
  const [nameField, setNameField] = useState('');
  const [focusField, setFocusField] = useState('');

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
            onStart={() => handleStart(day)}
            onRenameDay={(name) => void renameDay(day.id, name)}
            onDeleteDay={async () => {
              if (!window.confirm(`Tag „${day.name}" wirklich löschen?`)) return;
              await deleteDay(day.id);
            }}
            onSaveExercise={(ex, name, sets, reps) => void editExercise(ex.id, name, sets, reps)}
            onDeleteExercise={(id) => void deleteExercise(id)}
            onAddExercise={(name, sets, reps) => void addExercise(day.id, name, sets, reps, day.exercises.length)}
          />
        ))}
      </section>

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
