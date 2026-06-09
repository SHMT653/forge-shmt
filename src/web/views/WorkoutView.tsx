'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Flag, X } from 'lucide-react';
import { useActiveWorkout } from '@/web/hooks/useActiveWorkout';
import type { SetEntry } from '@/domain/types';

function SetRow({
  set,
  index,
  suggestion,
  onSave,
}: {
  set: SetEntry;
  index: number;
  suggestion: { reps: number; weightKg: number } | undefined;
  onSave: (reps: number | null, weightKg: number | null, completed: boolean) => void;
}) {
  const [reps, setReps] = useState(set.reps !== null ? String(set.reps) : '');
  const [weight, setWeight] = useState(set.weightKg !== null ? String(set.weightKg) : '');

  function commit(completed: boolean) {
    const repsValue = reps.trim() ? Number(reps) : null;
    const weightValue = weight.trim() ? Number(weight) : null;
    onSave(repsValue, weightValue, completed);
  }

  return (
    <div className="set-row">
      <span className="set-row-label">{index + 1}</span>
      <input
        className="input compact"
        inputMode="decimal"
        placeholder={suggestion ? `${suggestion.reps}` : 'Wdh.'}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={() => commit(set.completed)}
      />
      <input
        className="input compact"
        inputMode="decimal"
        placeholder={suggestion ? `${suggestion.weightKg} kg` : 'kg'}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => commit(set.completed)}
      />
      <button
        type="button"
        className={`button compact${set.completed ? '' : ' secondary'}`}
        onClick={() => commit(!set.completed)}
        aria-label={set.completed ? 'Satz als offen markieren' : 'Satz abschließen'}
      >
        <Check size={16} />
      </button>
    </div>
  );
}

export function WorkoutView({ sessionId }: { sessionId: string }) {
  const { session, loading, error, lastPerformance, saveSet, finish, abandon } = useActiveWorkout(sessionId);
  const router = useRouter();
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  if (loading) return <p className="copy">Training wird geladen …</p>;
  if (error) return <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>;

  if (!session) {
    return (
      <div className="empty-state">
        <p className="copy">Dieses Training wurde nicht gefunden.</p>
        <button type="button" className="button secondary compact" onClick={() => router.push('/')}>Zur Übersicht</button>
      </div>
    );
  }

  if (session.completedAt) {
    return (
      <div className="empty-state">
        <Flag size={28} />
        <p className="h2">Training abgeschlossen</p>
        <p className="copy">{session.dayName} · {session.planName}</p>
        <button type="button" className="button compact" onClick={() => router.push('/')}>Zur Übersicht</button>
      </div>
    );
  }

  const exercise = session.exercises[exerciseIndex];
  if (!exercise) {
    return (
      <div className="empty-state">
        <p className="copy">Dieses Training enthält keine Übungen.</p>
      </div>
    );
  }

  const isLast = exerciseIndex === session.exercises.length - 1;
  const suggestion = lastPerformance.get(exercise.exerciseName);

  async function handleFinish() {
    setFinishing(true);
    try {
      await finish();
      router.push('/');
    } finally {
      setFinishing(false);
    }
  }

  async function handleAbandon() {
    await abandon();
    router.push('/');
  }

  return (
    <>
      <div className="section-head">
        <div>
          <p className="eyebrow">{session.dayName} · {session.planName}</p>
          <h1 className="h1" style={{ fontSize: 26 }}>{exercise.exerciseName}</h1>
          <p className="copy">
            Übung {exerciseIndex + 1} von {session.exercises.length} · Ziel: {exercise.targetSets} × {exercise.targetReps}
          </p>
        </div>
        {confirmAbandon ? (
          <div className="button-row">
            <span className="copy" style={{ margin: 0, fontSize: 13 }}>Wirklich abbrechen?</span>
            <button type="button" className="button danger compact" onClick={handleAbandon}>Ja, abbrechen</button>
            <button type="button" className="button secondary compact" onClick={() => setConfirmAbandon(false)}>Weiter</button>
          </div>
        ) : (
          <button type="button" className="button ghost compact" onClick={() => setConfirmAbandon(true)}><X size={16} /> Abbrechen</button>
        )}
      </div>

      {suggestion && (
        <div className="panel soft">
          <p className="copy" style={{ margin: 0 }}>
            Letztes Training: <strong>{suggestion.weightKg} kg</strong> × {suggestion.reps} Wdh.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="list">
          {exercise.sets.map((set, index) => (
            <SetRow
              key={set.id}
              set={set}
              index={index}
              suggestion={suggestion}
              onSave={(reps, weightKg, completed) => void saveSet(set.id, reps, weightKg, completed)}
            />
          ))}
        </div>
      </div>

      <div className="hero-actions">
        <button type="button" className="button secondary" disabled={exerciseIndex === 0} onClick={() => setExerciseIndex((i) => i - 1)}>
          <ChevronLeft size={16} /> Vorherige Übung
        </button>
        {isLast ? (
          <button type="button" className="button" disabled={finishing} onClick={handleFinish}>
            <Flag size={16} /> {finishing ? 'Wird gespeichert …' : 'Training beenden'}
          </button>
        ) : (
          <button type="button" className="button" onClick={() => setExerciseIndex((i) => i + 1)}>
            Nächste Übung <ChevronRight size={16} />
          </button>
        )}
      </div>
    </>
  );
}
