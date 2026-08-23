'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dumbbell, Plus, Trash2, X, ListTree, ListFilter } from 'lucide-react';
import { TrainingAnalysisCard } from '@/web/components/TrainingAnalysisCard';
import { ExercisePickerSheet } from '@/web/components/ExercisePickerSheet';
import { useAuth } from '@/web/hooks/useAuth';
import { getUserGoals } from '@/data/profile';
import { usePlans } from '@/web/hooks/usePlans';
import type { EquipmentId } from '@/domain/equipment';
import { CardHead } from '@/web/components/CardHead';
import { PLAN_TEMPLATES } from '@/domain/planTemplates';

type DraftExercise = { name: string; targetSets: string; targetReps: string };
type DraftDay = { name: string; exercises: DraftExercise[] };

function emptyDay(index: number): DraftDay {
  return { name: `Tag ${index + 1}`, exercises: [] };
}

type CleanDay = { name: string; exercises: { name: string; targetSets: number; targetReps: string }[] };

function PlanBuilder({ onCreate, onClose }: { onCreate: (name: string, focus: string, days: CleanDay[]) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [days, setDays] = useState<DraftDay[]>([emptyDay(0)]);
  const [saving, setSaving] = useState(false);
  // Which row is currently choosing from the exercise table.
  // `exercise: null` means "append" — the picker then stays open so a whole
  // day can be filled without reopening it per exercise.
  const [picking, setPicking] = useState<{ day: number; exercise: number | null } | null>(null);
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const { user: builderUser } = useAuth();

  useEffect(() => {
    if (!builderUser) return;
    let active = true;
    void getUserGoals(builderUser.id)
      .then((goals) => { if (active) setEquipment(goals.equipment); })
      .catch(() => { /* ranking is an enhancement */ });
    return () => { active = false; };
  }, [builderUser]);

  function updateDay(index: number, patch: Partial<DraftDay>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function updateExercise(dayIndex: number, exIndex: number, patch: Partial<DraftExercise>) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, exercises: d.exercises.map((ex, j) => (j === exIndex ? { ...ex, ...patch } : ex)) } : d,
      ),
    );
  }

  function appendExercise(dayIndex: number, ex: DraftExercise) {
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, exercises: [...d.exercises, ex] } : d)));
  }

  function removeExercise(dayIndex: number, exIndex: number) {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, exercises: d.exercises.filter((_, j) => j !== exIndex) } : d)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const cleanDays = days
        .map((d) => ({
          name: d.name.trim() || 'Trainingstag',
          exercises: d.exercises
            .filter((ex) => ex.name.trim())
            .map((ex) => ({
              name: ex.name.trim(),
              targetSets: Math.max(1, Number(ex.targetSets) || 3),
              targetReps: ex.targetReps.trim() || '8-12',
            })),
        }))
        .filter((d) => d.exercises.length > 0);

      await onCreate(name.trim(), focus.trim(), cleanDays);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel soft">
      <div className="section-head">
        <h2 className="h2">Eigenen Plan erstellen</h2>
        <button type="button" className="button ghost compact" onClick={onClose}><X size={16} /></button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <div className="split">
          <div className="field">
            <label className="field-label" htmlFor="plan-name">Name</label>
            <input id="plan-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mein Sommer-Split" required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="plan-focus">Fokus (optional)</label>
            <input id="plan-focus" className="input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="z. B. Kraft & Aufbau" />
          </div>
        </div>

        {days.map((day, dayIndex) => (
          <div key={dayIndex} className="exercise-card">
            <div className="button-row" style={{ justifyContent: 'space-between' }}>
              <input
                className="input compact"
                style={{ maxWidth: 220 }}
                value={day.name}
                onChange={(e) => updateDay(dayIndex, { name: e.target.value })}
                placeholder="Tagesname"
                aria-label={`Name für Trainingstag ${dayIndex + 1}`}
              />
              {days.length > 1 && (
                <button type="button" className="button ghost compact" onClick={() => setDays((prev) => prev.filter((_, i) => i !== dayIndex))}>
                  <Trash2 size={14} /> Tag entfernen
                </button>
              )}
            </div>

            <div className="list">
              {day.exercises.map((ex, exIndex) => (
                <div key={exIndex} className="plan-slot">
                  {/* The exercise IS the choice, so it gets the full-width
                      control. It used to be a free-text field with the
                      database hidden behind an unlabelled 16px icon, which
                      read as "type the name yourself or nothing". */}
                  <button
                    type="button"
                    className={`plan-pick${ex.name ? ' filled' : ''}`}
                    onClick={() => setPicking({ day: dayIndex, exercise: exIndex })}
                  >
                    <span>{ex.name || `${exIndex + 1}. Übung wählen …`}</span>
                    <ListFilter size={15} style={{ flexShrink: 0 }} />
                  </button>
                  <div className="plan-slot-meta">
                    <input
                      className="input compact"
                      placeholder="Sätze"
                      aria-label="Sätze"
                      inputMode="numeric"
                      value={ex.targetSets}
                      onChange={(e) => updateExercise(dayIndex, exIndex, { targetSets: e.target.value })}
                    />
                    <input
                      className="input compact"
                      placeholder="Wdh."
                      aria-label="Wiederholungen"
                      value={ex.targetReps}
                      onChange={(e) => updateExercise(dayIndex, exIndex, { targetReps: e.target.value })}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeExercise(dayIndex, exIndex)}
                      aria-label={`Übung ${exIndex + 1} entfernen`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="button secondary compact"
              onClick={() => setPicking({ day: dayIndex, exercise: null })}
            >
              <Plus size={14} /> Übungen hinzufügen
            </button>
          </div>
        ))}

        <div className="button-row">
          <button type="button" className="button ghost compact" onClick={() => setDays((prev) => [...prev, emptyDay(prev.length)])}>
            <Plus size={14} /> Trainingstag hinzufügen
          </button>
        </div>

        <div className="hero-actions">
          <button type="submit" className="button" disabled={saving}>{saving ? 'Wird gespeichert …' : 'Plan erstellen'}</button>
          <button type="button" className="button secondary" onClick={onClose}>Abbrechen</button>
        </div>
      </form>

      {picking && (
        <ExercisePickerSheet
          available={equipment}
          multiple={picking.exercise === null}
          chosen={(days[picking.day]?.exercises ?? []).map((ex) => ex.name).filter(Boolean)}
          onClose={() => setPicking(null)}
          onPick={(entry) => {
            const patch = {
              name: entry.name,
              targetSets: String(entry.defaultSets),
              targetReps: entry.defaultReps,
            };
            if (picking.exercise === null) appendExercise(picking.day, patch);
            else updateExercise(picking.day, picking.exercise, patch);
          }}
        />
      )}
    </div>
  );
}

export function PlansView() {
  const { plans, loading, error, useTemplate, createCustom, activate, remove } = usePlans();
  const [showBuilder, setShowBuilder] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleUseTemplate(templateId: string) {
    const template = PLAN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setBusyId(templateId);
    try {
      await useTemplate(template);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <TrainingAnalysisCard />

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Trainingspläne</p>
            <h1 className="h1" style={{ fontSize: 28 }}>Wähle deinen Weg.</h1>
          </div>
          {!showBuilder && (
            <button type="button" className="button secondary compact" onClick={() => setShowBuilder(true)}>
              <Plus size={16} /> Eigener Plan
            </button>
          )}
        </div>
        <p className="copy">Starte mit einer Vorlage oder stelle dir deinen eigenen Plan zusammen — beides lässt sich jederzeit anpassen.</p>
      </section>

      {showBuilder && <PlanBuilder onCreate={createCustom} onClose={() => setShowBuilder(false)} />}

      {error && <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>}

      <section>
        <div className="section-head">
          <CardHead icon={Dumbbell} tone="violet" title="Deine Pläne" />
        </div>
        {loading ? (
          <p className="copy">Lädt …</p>
        ) : plans.length === 0 ? (
          <div className="empty-state">
            <Dumbbell size={28} />
            <p className="copy">Noch kein Plan ausgewählt. Wähle unten eine Vorlage, um direkt loszulegen.</p>
          </div>
        ) : (
          <div className="plan-grid">
            {plans.map((plan) => (
              <div key={plan.id} className={`plan-card${plan.isActive ? ' active' : ''}`}>
                <div className="button-row" style={{ justifyContent: 'space-between' }}>
                  <h3 className="h3">{plan.name}</h3>
                  {plan.isActive && <span className="badge done">Aktiv</span>}
                </div>
                <p className="copy" style={{ marginTop: 0 }}>{plan.focus || `${plan.days.length} Trainingstage`}</p>
                <div className="pill-row">
                  {plan.days.map((day) => (
                    <span key={day.id} className="pill">{day.name}</span>
                  ))}
                </div>
                <div className="card-actions">
                  <Link href={`/plans/${plan.id}`} className="button secondary compact">Öffnen</Link>
                  {!plan.isActive && (
                    <button type="button" className="button ghost compact" disabled={busyId === plan.id} onClick={async () => { setBusyId(plan.id); try { await activate(plan.id); } finally { setBusyId(null); } }}>
                      Aktivieren
                    </button>
                  )}
                  <button
                    type="button"
                    className="button ghost compact"
                    disabled={busyId === plan.id}
                    onClick={async () => {
                      if (!window.confirm(`„${plan.name}" wirklich löschen?`)) return;
                      setBusyId(plan.id);
                      try { await remove(plan.id); } finally { setBusyId(null); }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <CardHead icon={ListTree} tone="teal" title="Vorgefertigte Pläne" />
        </div>
        <div className="plan-grid">
          {PLAN_TEMPLATES.map((template) => (
            <div key={template.id} className="plan-card">
              <h3 className="h3">{template.name}</h3>
              <p className="copy" style={{ marginTop: 0 }}>{template.description}</p>
              <div className="pill-row">
                <span className="pill">{template.focus}</span>
                <span className="pill">{template.days.length} Tage</span>
              </div>
              <div className="card-actions">
                <button type="button" className="button compact" disabled={busyId === template.id} onClick={() => handleUseTemplate(template.id)}>
                  {busyId === template.id ? 'Wird übernommen …' : 'Plan übernehmen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
