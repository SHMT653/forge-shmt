'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Flag, Flame, Info, Timer, Trophy, X, Dumbbell, Zap, Activity, PersonStanding } from 'lucide-react';
import { useActiveWorkout } from '@/web/hooks/useActiveWorkout';
import { useAuth } from '@/web/hooks/useAuth';
import { addCardioLog } from '@/data/cardio';
import { findExercise } from '@/domain/exerciseDatabase';
import { calcKcalBurned } from '@/domain/cardioActivities';
import { getUserGoals } from '@/data/profile';
import { todayKey } from '@/domain/dates';
import { ExerciseInfoModal } from '@/web/components/ExerciseInfoModal';
import { metricForSets, planSession, type LastPerformance, type MetricKind, type SetTarget } from '@/domain/progression';
import { listExerciseSnapshots } from '@/data/workouts';
import { RestTimer } from '@/web/components/RestTimer';
import { HoldTimer } from '@/web/components/HoldTimer';
import type { SetUpdate } from '@/data/workouts';
import type { SetEntry } from '@/domain/types';

/** True when this set beats the last session on whichever metric the exercise uses. */
function isPersonalRecord(patch: SetUpdate, previous: LastPerformance | undefined): boolean {
  if (!previous) return false;
  if (patch.weightKg != null && previous.weightKg != null) return patch.weightKg > previous.weightKg;
  if (patch.durationSeconds != null && previous.durationSeconds != null) return patch.durationSeconds > previous.durationSeconds;
  if (patch.reps != null && previous.weightKg == null) return patch.reps > previous.reps;
  return false;
}

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
  metric,
  target,
  onSave,
  onStartHold,
}: {
  set: SetEntry;
  index: number;
  suggestion: LastPerformance | undefined;
  metric: MetricKind;
  /** What to aim for on this set today (§ progressive overload). */
  target: SetTarget | undefined;
  onSave: (patch: SetUpdate) => void;
  /** Opens the stopwatch for this set — only used by holds. */
  onStartHold?: (index: number) => void;
}) {
  const [reps, setReps] = useState(set.reps !== null ? String(set.reps) : '');
  const [weight, setWeight] = useState(set.weightKg !== null ? String(set.weightKg) : '');
  const [seconds, setSeconds] = useState(set.durationSeconds !== null ? String(set.durationSeconds) : '');

  const isHold = metric === 'duration';

  function buildPatch(completed: boolean): SetUpdate {
    const patch: SetUpdate = { completed };
    if (isHold) {
      patch.durationSeconds = seconds.trim() ? Number(seconds) : null;
    } else {
      patch.reps = reps.trim() ? Number(reps) : null;
      // Only touch weight when the user actually typed one, so a bodyweight
      // exercise never writes a stray 0 kg into its history.
      if (weight.trim() || set.weightKg !== null) patch.weightKg = weight.trim() ? Number(weight) : null;
    }
    return patch;
  }

  const done = set.completed;

  return (
    <div className="set-row">
      <span className={`set-row-label${done ? ' done' : ''}`}>{index + 1}</span>

      {isHold ? (
        <input
          className="input compact"
          inputMode="numeric"
          placeholder={target ? `${target.value} s` : suggestion?.durationSeconds ? `${suggestion.durationSeconds} s` : 'Sek.'}
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          onBlur={() => onSave(buildPatch(done))}
          aria-label={`Satz ${index + 1} Sekunden`}
        />
      ) : (
        <input
          className="input compact"
          inputMode="numeric"
          placeholder={target ? String(target.value) : suggestion?.reps ? `${suggestion.reps}` : 'Wdh.'}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={() => onSave(buildPatch(done))}
          aria-label={`Satz ${index + 1} Wiederholungen`}
        />
      )}

      {isHold ? (
        <button
          type="button"
          className="button secondary compact"
          onClick={() => onStartHold?.(index)}
          style={{ minHeight: 40 }}
        >
          <Timer size={14} /> Stoppuhr
        </button>
      ) : (
        <input
          className="input compact"
          inputMode="decimal"
          placeholder={target?.weightKg ? `${target.weightKg} kg` : suggestion?.weightKg ? `${suggestion.weightKg} kg` : 'kg / optional'}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => onSave(buildPatch(done))}
          aria-label={`Satz ${index + 1} Gewicht`}
        />
      )}

      <button
        type="button"
        className={`button compact${done ? '' : ' secondary'}`}
        onClick={() => onSave(buildPatch(!done))}
        aria-label={done ? 'Satz als offen markieren' : 'Satz abschließen'}
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
  const { session, loading, error, lastPerformance, saveSet, addSet, finish, abandon } = useActiveWorkout(sessionId);
  const { user } = useAuth();
  const router = useRouter();
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [infoExercise, setInfoExercise] = useState<string | null>(null);
  const [prExercise, setPrExercise] = useState<string | null>(null);
  const prTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (prTimer.current) clearTimeout(prTimer.current); }, []);

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
  // Infer from previous sessions first — an empty new set carries no signal.
  const setMetric: MetricKind = suggestion?.metric ?? metricForSets(exercise.sets);

  // Today's concrete targets, derived from the last session for this exercise.
  const [plan, setPlan] = useState<ReturnType<typeof planSession> | null>(null);
  const [restOpen, setRestOpen] = useState(false);
  const [holdingSet, setHoldingSet] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;
    void listExerciseSnapshots(user.id, exercise.exerciseName)
      .then((history) => {
        if (!active) return;
        const previous = history[history.length - 1] ?? null;
        setPlan(planSession(previous, exercise.targetSets, exercise.targetReps, setMetric));
      })
      .catch(() => { if (active) setPlan(null); });
    return () => { active = false; };
  }, [user, exercise.exerciseName, exercise.targetSets, exercise.targetReps, setMetric]);
  const isCardio = findExercise(exercise.exerciseName)?.type === 'cardio';

  async function handleFinish() {
    setFinishing(true);
    try {
      await finish();
      router.push(`/?done=1&exercises=${session?.exercises.length ?? 0}`);
    } finally {
      setFinishing(false);
    }
  }

  function triggerPR(exerciseName: string) {
    setPrExercise(exerciseName);
    if (prTimer.current) clearTimeout(prTimer.current);
    prTimer.current = setTimeout(() => setPrExercise(null), 4000);
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
            <h1 className="h1" style={{ fontSize: 26, margin: 0, flex: 1 }}>{exercise.exerciseName}</h1>
            <button
              type="button"
              onClick={() => setInfoExercise(exercise.exerciseName)}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--subtle)', flexShrink: 0, touchAction: 'manipulation' }}
              aria-label="Übungsinfos"
            >
              <Info size={16} />
            </button>
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

      {!isCardio && plan && (
        <div className="coach-card" style={{ marginBottom: 12 }}>
          <span className="coach-avatar" aria-hidden><Zap size={16} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="coach-label">Ziel heute</p>
            <p className="coach-text">{plan.summary}</p>
          </div>
        </div>
      )}

      {!isCardio && holdingSet !== null && (
        <div className="panel soft" style={{ padding: 12, marginBottom: 12 }}>
          <p className="section-label" style={{ marginBottom: 8 }}>Satz {holdingSet + 1} halten</p>
          <HoldTimer
            targetSeconds={plan?.targets[holdingSet]?.value ?? null}
            onFinish={(recorded) => {
              const set = exercise.sets[holdingSet];
              if (set) void saveSet(set.id, { durationSeconds: recorded, completed: true });
              setHoldingSet(null);
              setRestOpen(true);
            }}
          />
        </div>
      )}

      {!isCardio && restOpen && (
        <div style={{ marginBottom: 12 }}>
          <RestTimer onClose={() => setRestOpen(false)} />
        </div>
      )}

      {!isCardio && !plan && suggestion && (
        <div className="panel soft">
          <p className="copy" style={{ margin: 0 }}>
            Letztes Training:{' '}
            {suggestion.metric === 'weight' && suggestion.weightKg !== null ? (
              <><strong>{suggestion.weightKg} kg</strong> × {suggestion.reps} Wdh.</>
            ) : suggestion.metric === 'duration' && suggestion.durationSeconds !== null ? (
              <><strong>{suggestion.durationSeconds} s</strong> längster Halt</>
            ) : (
              <><strong>{suggestion.totalReps} Wdh.</strong> gesamt · bester Satz {suggestion.reps}</>
            )}
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
                metric={setMetric}
                target={plan?.targets[index]}
                onStartHold={(i) => setHoldingSet(i)}
                onSave={(patch) => {
                  // Finishing a set is the moment the rest starts.
                  if (patch.completed && !set.completed) setRestOpen(true);
                  if (patch.completed && isPersonalRecord(patch, suggestion)) {
                    triggerPR(exercise.exerciseName);
                  }
                  void saveSet(set.id, patch);
                }}
              />
            ))}
          </div>

          <button
            type="button"
            className="button ghost compact"
            style={{ marginTop: 10, width: '100%' }}
            onClick={() => void addSet(exercise.id)}
          >
            + Satz hinzufügen
          </button>
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

      {infoExercise && (
        <ExerciseInfoModal name={infoExercise} onClose={() => setInfoExercise(null)} />
      )}

      {/* PR Toast */}
      {prExercise && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #7b5cf0, #c9a227)',
            borderRadius: 20, padding: '12px 24px', zIndex: 999,
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          <Trophy size={20} color="#fff" />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>Neuer Rekord! 🏆</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{prExercise}</p>
          </div>
        </div>
      )}
    </>
  );
}
