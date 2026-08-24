import { getSupabaseClient } from '@/services/supabase/client';
import { snapshotExercise, type ExerciseSnapshot, type LastPerformance } from '@/domain/progression';
import { isSessionStillRunning } from '@/domain/dates';
import type { PlanDay, SessionExercise, SetEntry, WorkoutKind, WorkoutSession } from '@/domain/types';

const SESSION_COLUMNS = 'id, plan_id, plan_name, day_name, started_at, completed_at, duration_seconds, kind';
const SET_COLUMNS = 'id, session_exercise_id, set_index, reps, weight_kg, duration_seconds, resistance, completed';

type SessionRow = {
  id: string;
  plan_id: string | null;
  plan_name: string;
  day_name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  kind: string | null;
};

type SessionExerciseRow = {
  id: string;
  session_id: string;
  exercise_name: string;
  target_sets: number;
  target_reps: string;
  order_index: number;
};

type SetRow = {
  id: string;
  session_exercise_id: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  resistance: string | null;
  completed: boolean;
};

function toKind(value: string | null | undefined): WorkoutKind {
  return value === 'mini' ? 'mini' : 'full';
}

function assembleSession(session: SessionRow, exercises: SessionExerciseRow[], sets: SetRow[]): WorkoutSession {
  const setsByExercise = new Map<string, SetEntry[]>();
  for (const row of sets) {
    const list = setsByExercise.get(row.session_exercise_id) ?? [];
    list.push({
      id: row.id,
      setIndex: row.set_index,
      reps: row.reps,
      weightKg: row.weight_kg !== null ? Number(row.weight_kg) : null,
      durationSeconds: row.duration_seconds,
      resistance: row.resistance,
      completed: row.completed,
    });
    setsByExercise.set(row.session_exercise_id, list);
  }

  return {
    id: session.id,
    planId: session.plan_id,
    planName: session.plan_name,
    dayName: session.day_name,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    durationSeconds: session.duration_seconds,
    kind: toKind(session.kind),
    exercises: exercises
      .filter((e) => e.session_id === session.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((e) => ({
        id: e.id,
        exerciseName: e.exercise_name,
        targetSets: e.target_sets,
        targetReps: e.target_reps,
        orderIndex: e.order_index,
        sets: (setsByExercise.get(e.id) ?? []).sort((a, b) => a.setIndex - b.setIndex),
      })),
  };
}

async function fetchSessionDetail(sessionId: string): Promise<WorkoutSession | null> {
  const supabase = getSupabaseClient();

  const { data: session, error: sessionError } = await supabase
    .from('forge_workout_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return null;

  const { data: exercises, error: exercisesError } = await supabase
    .from('forge_session_exercises')
    .select('id, session_id, exercise_name, target_sets, target_reps, order_index')
    .eq('session_id', sessionId);
  if (exercisesError) throw exercisesError;

  const exerciseIds = (exercises ?? []).map((e) => e.id);
  let sets: SetRow[] = [];
  if (exerciseIds.length > 0) {
    const { data, error } = await supabase
      .from('forge_session_sets')
      .select(SET_COLUMNS)
      .in('session_exercise_id', exerciseIds);
    if (error) throw error;
    sets = data ?? [];
  }

  return assembleSession(session, exercises ?? [], sets);
}

export { fetchSessionDetail as getSession };

/** Starts a new session by cloning the chosen plan day's exercises with empty sets. */
export async function startWorkoutSession(
  userId: string,
  planId: string,
  planName: string,
  day: PlanDay,
): Promise<string> {
  const supabase = getSupabaseClient();

  const { data: session, error: sessionError } = await supabase
    .from('forge_workout_sessions')
    .insert({ user_id: userId, plan_id: planId, plan_day_id: day.id, plan_name: planName, day_name: day.name })
    .select('id')
    .single();
  if (sessionError) throw sessionError;

  const sortedExercises = [...day.exercises].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sortedExercises.length === 0) return session.id;

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('forge_session_exercises')
    .insert(
      sortedExercises.map((ex, index) => ({
        session_id: session.id,
        exercise_name: ex.name,
        target_sets: ex.targetSets,
        target_reps: ex.targetReps,
        order_index: index,
      })),
    )
    .select('id, target_sets');
  if (exerciseError) throw exerciseError;

  const setRows = (exerciseRows ?? []).flatMap((row) =>
    Array.from({ length: row.target_sets }, (_, i) => ({
      session_exercise_id: row.id,
      set_index: i,
      reps: null,
      weight_kg: null,
      duration_seconds: null,
      resistance: null,
      completed: false,
    })),
  );
  if (setRows.length > 0) {
    const { error } = await supabase.from('forge_session_sets').insert(setRows);
    if (error) throw error;
  }

  return session.id;
}

/**
 * The session the user is in the middle of, if any.
 *
 * Bounded by time: an unfinished row used to count as active forever, so a
 * single abandoned workout left "läuft" and a "Weiter" button on the dashboard
 * permanently. Older unfinished sessions stay in the database — they are simply
 * not treated as running (§ dates.isSessionStillRunning).
 */
export async function getActiveSession(userId: string): Promise<WorkoutSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_workout_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!isSessionStillRunning(data.started_at as string)) return null;
  return fetchSessionDetail(data.id);
}

export type SetUpdate = {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  resistance?: string | null;
  completed?: boolean;
};

/**
 * Patches a single set. Only the fields present in `patch` are written, so a
 * bodyweight exercise never overwrites a weight and a plank never clobbers reps.
 */
export async function updateSet(setId: string, patch: SetUpdate): Promise<void> {
  const supabase = getSupabaseClient();
  const row: Record<string, unknown> = {};
  if ('reps' in patch) row.reps = patch.reps;
  if ('weightKg' in patch) row.weight_kg = patch.weightKg;
  if ('durationSeconds' in patch) row.duration_seconds = patch.durationSeconds;
  if ('resistance' in patch) row.resistance = patch.resistance;
  if ('completed' in patch) row.completed = patch.completed;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('forge_session_sets').update(row).eq('id', setId);
  if (error) throw error;
}

/** Adds one extra set to an exercise — for when you have more in the tank than planned. */
export async function addSetToExercise(sessionExerciseId: string, setIndex: number): Promise<SetEntry> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_session_sets')
    .insert({ session_exercise_id: sessionExerciseId, set_index: setIndex, completed: false })
    .select(SET_COLUMNS)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    setIndex: data.set_index,
    reps: data.reps,
    weightKg: data.weight_kg !== null ? Number(data.weight_kg) : null,
    durationSeconds: data.duration_seconds,
    resistance: data.resistance,
    completed: data.completed,
  };
}

/**
 * Starts a short ad-hoc session (§19). It counts as activity and its sets feed
 * progression, but `kind: 'mini'` keeps it out of the "full workouts" count.
 */
export async function startMiniSession(
  userId: string,
  name: string,
  exercises: { name: string; sets: number; targetReps: string }[],
): Promise<string> {
  const supabase = getSupabaseClient();

  const { data: session, error: sessionError } = await supabase
    .from('forge_workout_sessions')
    .insert({ user_id: userId, plan_name: 'Mini Session', day_name: name, kind: 'mini' })
    .select('id')
    .single();
  if (sessionError) throw sessionError;
  if (exercises.length === 0) return session.id;

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('forge_session_exercises')
    .insert(
      exercises.map((ex, index) => ({
        session_id: session.id,
        exercise_name: ex.name,
        target_sets: ex.sets,
        target_reps: ex.targetReps,
        order_index: index,
      })),
    )
    .select('id, target_sets');
  if (exerciseError) throw exerciseError;

  const setRows = (exerciseRows ?? []).flatMap((row) =>
    Array.from({ length: row.target_sets }, (_, i) => ({
      session_exercise_id: row.id,
      set_index: i,
      completed: false,
    })),
  );
  if (setRows.length > 0) {
    const { error } = await supabase.from('forge_session_sets').insert(setRows);
    if (error) throw error;
  }

  return session.id;
}

/**
 * Records a workout that already happened.
 *
 * Written straight to completed rather than started-then-finished, because the
 * session it describes is over. `started_at` and `completed_at` both land on
 * the given day at 18:00 local — the calendar and the weekly count read the
 * date, and a plausible time keeps the day's timeline in order.
 *
 * When a plan day is given, its exercises and sets are created too, so the
 * session can be opened afterwards and filled in properly rather than being a
 * bare tick in the calendar.
 */
export async function logPastWorkout(
  userId: string,
  date: string,
  input: {
    planName: string;
    dayName: string;
    kind: WorkoutKind;
    durationMinutes: number;
    planId?: string | null;
    day?: PlanDay | null;
  },
): Promise<string> {
  const supabase = getSupabaseClient();
  const at = `${date}T18:00:00`;

  const { data: session, error } = await supabase
    .from('forge_workout_sessions')
    .insert({
      user_id: userId,
      plan_id: input.planId ?? null,
      plan_day_id: input.day?.id ?? null,
      plan_name: input.planName,
      day_name: input.dayName,
      kind: input.kind,
      started_at: at,
      completed_at: at,
      duration_seconds: Math.max(60, Math.round(input.durationMinutes * 60)),
    })
    .select('id')
    .single();
  if (error) throw error;

  const exercises = input.day?.exercises ?? [];
  if (exercises.length === 0) return session.id;

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('forge_session_exercises')
    .insert(
      exercises.map((ex, index) => ({
        session_id: session.id,
        exercise_name: ex.name,
        target_sets: ex.targetSets,
        target_reps: ex.targetReps,
        order_index: index,
      })),
    )
    .select('id, target_sets');
  if (exerciseError) throw exerciseError;

  const setRows = (exerciseRows ?? []).flatMap((row) =>
    Array.from({ length: row.target_sets as number }, (_, i) => ({
      session_exercise_id: row.id,
      set_index: i,
      completed: false,
    })),
  );
  if (setRows.length > 0) {
    const { error: setError } = await supabase.from('forge_session_sets').insert(setRows);
    if (setError) throw setError;
  }

  return session.id;
}

export async function finishSession(sessionId: string, durationSeconds: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_workout_sessions')
    .update({ completed_at: new Date().toISOString(), duration_seconds: durationSeconds })
    .eq('id', sessionId);
  if (error) throw error;
}

/**
 * Abandoning is a real deletion, and it is verified.
 *
 * A delete that row-level security filters out returns success having removed
 * nothing, which looked identical to working — the session simply came back.
 * Asking for the deleted row back makes that case an error the UI can report
 * instead of silently leaving the workout in place.
 */
export async function abandonSession(userId: string, sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_workout_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Das Training konnte nicht abgebrochen werden. Versuch es noch einmal.');
  }
}

/**
 * Most recent completed performance per exercise name, from the last 20 finished
 * sessions.
 *
 * Note this deliberately does NOT filter on `weight_kg is not null`. The previous
 * version did, which meant push-ups, planks and band work — everything in a home
 * setup — returned nothing and the workout screen showed no reference at all.
 */
export async function getBestPerformances(
  userId: string,
  exerciseNames: string[],
): Promise<Map<string, LastPerformance>> {
  const result = new Map<string, LastPerformance>();
  if (exerciseNames.length === 0) return result;

  const supabase = getSupabaseClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from('forge_workout_sessions')
    .select('id, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20);
  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0) return result;

  const sessionIds = sessions.map((s) => s.id);

  const { data: exercises, error: exercisesError } = await supabase
    .from('forge_session_exercises')
    .select('id, session_id, exercise_name')
    .in('session_id', sessionIds)
    .in('exercise_name', exerciseNames);
  if (exercisesError) throw exercisesError;
  if (!exercises || exercises.length === 0) return result;

  const { data: sets, error: setsError } = await supabase
    .from('forge_session_sets')
    .select('session_exercise_id, reps, weight_kg, duration_seconds')
    .in('session_exercise_id', exercises.map((e) => e.id))
    .eq('completed', true);
  if (setsError) throw setsError;

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  // Index 0 = most recent session.
  const sessionRank = new Map(sessions.map((s, i) => [s.id, i]));
  const sessionDate = new Map(sessions.map((s) => [s.id, (s.completed_at as string).slice(0, 10)]));

  // Group completed sets by exercise name, keeping only the most recent session.
  type Bucket = { rank: number; date: string; sets: { reps: number | null; weightKg: number | null; seconds: number | null }[] };
  const buckets = new Map<string, Bucket>();

  for (const set of sets ?? []) {
    const exercise = exerciseById.get(set.session_exercise_id);
    if (!exercise) continue;
    const rank = sessionRank.get(exercise.session_id) ?? 999;
    const name = exercise.exercise_name;
    const existing = buckets.get(name);

    if (!existing || rank < existing.rank) {
      buckets.set(name, {
        rank,
        date: sessionDate.get(exercise.session_id) ?? '',
        sets: [{ reps: set.reps, weightKg: set.weight_kg !== null ? Number(set.weight_kg) : null, seconds: set.duration_seconds }],
      });
    } else if (rank === existing.rank) {
      existing.sets.push({ reps: set.reps, weightKg: set.weight_kg !== null ? Number(set.weight_kg) : null, seconds: set.duration_seconds });
    }
  }

  for (const [name, bucket] of buckets) {
    const metric: LastPerformance['metric'] = bucket.sets.some((s) => s.weightKg !== null && s.weightKg > 0)
      ? 'weight'
      : bucket.sets.some((s) => s.seconds !== null && s.seconds > 0)
        ? 'duration'
        : 'reps';

    result.set(name, {
      reps: bucket.sets.reduce((max, s) => Math.max(max, s.reps ?? 0), 0),
      weightKg: bucket.sets.reduce<number | null>((max, s) => (s.weightKg === null ? max : Math.max(max ?? 0, s.weightKg)), null),
      durationSeconds: bucket.sets.reduce<number | null>((max, s) => (s.seconds === null ? max : Math.max(max ?? 0, s.seconds)), null),
      totalReps: bucket.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
      metric,
      date: bucket.date,
    });
  }

  return result;
}

/**
 * Full per-session history for one exercise, as progression snapshots.
 * Works for every metric — reps, seconds and weight alike.
 */
export async function listExerciseSnapshots(userId: string, exerciseName: string): Promise<ExerciseSnapshot[]> {
  const supabase = getSupabaseClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from('forge_workout_sessions')
    .select('id, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })
    .limit(200);
  if (sessionsError) throw sessionsError;
  if (!sessions?.length) return [];

  const { data: exercises, error: exError } = await supabase
    .from('forge_session_exercises')
    .select('id, session_id, exercise_name, target_sets, target_reps, order_index')
    .in('session_id', sessions.map((s) => s.id))
    .eq('exercise_name', exerciseName);
  if (exError) throw exError;
  if (!exercises?.length) return [];

  const { data: sets, error: setsError } = await supabase
    .from('forge_session_sets')
    .select(SET_COLUMNS)
    .in('session_exercise_id', exercises.map((e) => e.id));
  if (setsError) throw setsError;

  const setsByExercise = new Map<string, SetEntry[]>();
  for (const row of sets ?? []) {
    const list = setsByExercise.get(row.session_exercise_id) ?? [];
    list.push({
      id: row.id,
      setIndex: row.set_index,
      reps: row.reps,
      weightKg: row.weight_kg !== null ? Number(row.weight_kg) : null,
      durationSeconds: row.duration_seconds,
      resistance: row.resistance,
      completed: row.completed,
    });
    setsByExercise.set(row.session_exercise_id, list);
  }

  const dateBySession = new Map(sessions.map((s) => [s.id, (s.completed_at as string).slice(0, 10)]));

  return exercises
    .map((e) => {
      const sessionExercise: SessionExercise = {
        id: e.id,
        exerciseName: e.exercise_name,
        targetSets: e.target_sets,
        targetReps: e.target_reps,
        orderIndex: e.order_index,
        sets: (setsByExercise.get(e.id) ?? []).sort((a, b) => a.setIndex - b.setIndex),
      };
      return snapshotExercise(sessionExercise, dateBySession.get(e.session_id) ?? '');
    })
    .filter((snap) => snap.date !== '' && snap.completedSets > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Every exercise name the user has ever completed at least one set of. */
export async function listTrainedExerciseNames(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data: sessions, error: sErr } = await supabase
    .from('forge_workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(200);
  if (sErr) throw sErr;
  if (!sessions?.length) return [];

  const { data, error } = await supabase
    .from('forge_session_exercises')
    .select('exercise_name')
    .in('session_id', sessions.map((s) => s.id));
  if (error) throw error;

  return [...new Set((data ?? []).map((r) => r.exercise_name as string))].sort((a, b) => a.localeCompare(b, 'de'));
}

export async function listCompletedSessionDates(userId: string, limit = 400): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_workout_sessions')
    .select('completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => (row.completed_at as string).slice(0, 10));
}

export async function listRecentSessions(userId: string, limit = 10): Promise<WorkoutSession[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_workout_sessions')
    .select(SESSION_COLUMNS)
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    planId: row.plan_id,
    planName: row.plan_name,
    dayName: row.day_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    kind: toKind(row.kind),
    exercises: [],
  }));
}

export async function getTotalTrainingSeconds(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_workout_sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .not('completed_at', 'is', null);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
}
