'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePlans } from '@/web/hooks/usePlans';
import type { PlanDay, TrainingPlan } from '@/domain/types';

export function PlanDetailView({ planId }: { planId: string }) {
  const { plans, loading, activate, remove, startDay } = usePlans();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // day.id | 'activate' | 'delete'

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

  async function handleStart(plan: TrainingPlan, day: PlanDay) {
    setBusy(day.id);
    try {
      const sessionId = await startDay(plan, day);
      if (sessionId) router.push(`/workout/${sessionId}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div>
        <Link href="/plans" className="button ghost compact"><ArrowLeft size={16} /> Pläne</Link>
      </div>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">{plan.focus || 'Trainingsplan'}</p>
            <h1 className="h1" style={{ fontSize: 28 }}>{plan.name}</h1>
          </div>
          {plan.isActive && <span className="badge done">Aktiv</span>}
        </div>
        <div className="card-actions">
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
            className="button ghost compact"
            disabled={busy === 'delete'}
            onClick={async () => {
              if (!window.confirm(`„${plan.name}" wirklich löschen?`)) return;
              setBusy('delete');
              try { await remove(plan.id); router.push('/plans'); } finally { setBusy(null); }
            }}
          >
            <Trash2 size={14} /> Plan löschen
          </button>
        </div>
      </section>

      <section className="list">
        {plan.days.map((day) => (
          <div key={day.id} className="exercise-card">
            <div className="section-head" style={{ marginBottom: 4 }}>
              <h2 className="h2">{day.name}</h2>
              <button type="button" className="button compact" disabled={busy === day.id} onClick={() => handleStart(plan, day)}>
                <Play size={14} /> {busy === day.id ? 'Wird gestartet …' : 'Tag starten'}
              </button>
            </div>
            <div className="list">
              {day.exercises.map((exercise, index) => (
                <div key={exercise.id} className="set-row">
                  <span className="set-row-label">{index + 1}</span>
                  <span className="copy" style={{ margin: 0 }}>{exercise.name}</span>
                  <span className="copy" style={{ margin: 0, color: 'var(--subtle)' }}>{exercise.targetSets} × {exercise.targetReps}</span>
                  <span />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
