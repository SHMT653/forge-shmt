'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Flag, Flame, Timer, X, Dumbbell, Zap, Activity, PersonStanding } from 'lucide-react';
import { useActiveWorkout } from '@/web/hooks/useActiveWorkout';
import { useAuth } from '@/web/hooks/useAuth';
import { addCardioLog } from '@/data/cardio';
import { findExercise } from '@/domain/exerciseDatabase';
import { calcKcalBurned } from '@/domain/cardioActivities';
import { getUserGoals } from '@/data/profile';
import { todayKey } from '@/domain/dates';
import type { SetEntry } from '@/domain/types';

type IconComponent = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;

const EXERCISE_ICON_MAP: Array<{ keywords: string[]; icon: IconComponent; color: string }> = [
  { keywords: ['bankdrücken', 'bench', 'dips', 'flieg', 'push-up', 'liegestütz', 'brust'], icon: Zap, color: 'var(--violet)' },
  { keywords: ['klimmzug', 'latzug', 'ruder', 'kreuzheben', 'deadlift', 'row', 'rücken', 'cable'], icon: Dumbbell, color: 'var(--teal)' },
  { keywords: ['schulter', 'overhead', 'press', 'seitheben', 'nacken'], icon: Zap, color: 'var(--gold)' },
  { keywords: ['bizep', 'curl', 'hammer', 'trizep', 'skull'], icon: Dumbbell, color: 'var(--violet)' },
  { keywords: ['kniebeuge', 'squat', 'beinpresse', 'leg', 'ausfallschritt', 'lunge', 'bein', 'waden'], icon: PersonStanding, color: 'var(--teal)' },
  { keywords: ['crunch', 'plank', 'planke', 'sit-up', 'bauch', 'core', 'abs'], icon: Activity, color: 'var(--gold)' },
  { keywords: ['lauf', 'sprint', 'cardio', 'fahrrad', 'bike', 'rowing', 'ruder'], icon: Activity, color: 'var(--danger)' },
];

function getExerciseIcon(name: string): { icon: IconComponent; color: string } {
  const lower = name.toLowerCase();
  for (const entry of EXERCISE_ICON_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { icon: entry.icon, color: entry.color };
    }
  }
  return { icon: Dumbbell, color: 'var(--subtle)' };
}

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

// ── Cardio exercise UI ────────────────────────────────────────────────────────

function CardioExercisePanel({
  exerciseName,
  userId,
  onDone,
}: {
  exerciseName: string;
  userId: string;
  onDone: () => void;
}) {
  const entry = findExercise(exerciseName);
  const [duration, setDuration] = useState('30');
  const [distance, setDistance] = useState('');
  const [saving, setSaving] = useState(false);

  const met = entry?.met ?? 6.0;
  const [weightKg, setWeightKg] = useState(75);
  // Lazy-fetch weight once
  useState(() => {
    void getUserGoals(userId).then((g) => { if (g.currentWeight) setWeightKg(g.currentWeight); });
  });

  const mins = Math.max(1, Number(duration) || 0);
  const estimatedKcal = mins > 0 ? calcKcalBurned(met, weightKg, mins) : 0;

  async function handleSave() {
    if (!duration.trim() || mins <= 0) return;
    setSaving(true);
    try {
      await addCardioLog(userId, todayKey(), {
        activity: exerciseName,
        durationMinutes: mins,
        distanceKm: distance.trim() ? Number(distance.replace(',', '.')) : null,
        kcalBurned: estimatedKcal,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Activity size={20} color="#d96060" />
        <p className="h3" style={{ margin: 0, color: '#d96060' }}>Cardio-Einheit</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Dauer (Min)</label>
          <input
            className="input compact"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
          />
        </div>
        {entry?.hasDistance && (
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Distanz (km)</label>
            <input
              className="input compact"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0,0"
            />
          </div>
        )}
      </div>

      {estimatedKcal > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(217,96,96,0.08)', borderRadius: 10, border: '1px solid rgba(217,96,96,0.2)', marginBottom: 12 }}>
          <Flame size={16} color="#d96060" />
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#d96060' }}>{estimatedKcal} kcal</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>MET {met} · {weightKg} kg · {mins} Min</p>
          </div>
        </div>
      )}

      <button
        type="button"
        className="button"
        style={{ width: '100%' }}
        disabled={saving || mins <= 0}
        onClick={handleSave}
      >
        <Timer size={16} /> {saving ? 'Wird gespeichert …' : 'Einheit eintragen & weiter'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function WorkoutView({ sessionId }: { sessionId: string }) {
  const { session, loading, error, lastPerformance, saveSet, finish, abandon } = useActiveWorkout(sessionId);
  const { user } = useAuth();
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
  const isCardio = findExercise(exercise.exerciseName)?.type === 'cardio';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            {(() => { const { icon: Icon, color } = getExerciseIcon(exercise.exerciseName); return <Icon size={24} style={{ color }} />; })()}
            <h1 className="h1" style={{ fontSize: 26, margin: 0 }}>{exercise.exerciseName}</h1>
          </div>
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

      {!isCardio && suggestion && (
        <div className="panel soft">
          <p className="copy" style={{ margin: 0 }}>
            Letztes Training: <strong>{suggestion.weightKg} kg</strong> × {suggestion.reps} Wdh.
          </p>
        </div>
      )}

      {isCardio && user ? (
        <CardioExercisePanel
          exerciseName={exercise.exerciseName}
          userId={user.id}
          onDone={() => {
            if (isLast) { void handleFinish(); } else { setExerciseIndex((i) => i + 1); }
          }}
        />
      ) : (
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
      )}

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
