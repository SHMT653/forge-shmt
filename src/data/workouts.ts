import { getSupabaseClient } from '@/services/supabase/client';
import type { PlanDay, SessionExercise, SetEntry, WorkoutSession } from '@/domain/types';

type SessionRow = {
  id: string;
  plan_id: string | null;
  plan_name: string;
  day_name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
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
  completed: boolean;
};

function assembleSession(session: SessionRow, exercises: SessionExerciseRow[], sets: SetRow[]): WorkoutSession {
  const setsByExercise = new Map<string, SetEntry[]>();
  for (const row of sets) {
    const list = setsByExercise.get(row.session_exercise_id) ?? [];
    list.push({
      id: row.id,
      setIndex: row.set_index,
      reps: row.reps,
      weightKg: row.weight_kg,
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
    .select('id, plan_id, plan_name, day_name, started_at, completed_at, duration_seconds')
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
      .select('id, session_exercise_id, set_index, reps, weight_kg, completed')
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
      completed: false,
    })),
  );
  if (setRows.length > 0) {
    const { error } = await supabase.from('forge_session_sets').insert(setRows);
    if (error) throw error;
  }

  return session.id;
}

export async function getActiveSession(userId: string): Promise<WorkoutSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fetchSessionDetail(data.id);
}

export async function updateSet(setId: string, reps: number | null, weightKg: number | null, completed: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_session_sets')
    .update({ reps, weight_kg: weightKg, completed })
    .eq('id', setId);
  if (error) throw error;
}

export async function finishSession(sessionId: string, durationSeconds: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_workout_sessions')
    .update({ completed_at: new Date().toISOString(), duration_seconds: durationSeconds })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function abandonSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_workout_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

/**
 * Best completed set (highest weight) per exercise name from the last 20 finished sessions.
 * Returns a map exerciseName → {reps, weightKg}. One batch of 3 queries instead of N+1.
 */
export async function getBestPerformances(
  userId: string,
  exerciseNames: string[],
): Promise<Map<string, { reps: number; weightKg: number }>> {
  const result = new Map<string, { reps: number; weightKg: number }>();
  if (exerciseNames.length === 0) return result;

  const supabase = getSupabaseClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from('forge_workout_sessions')
    .select('id')
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

  const exerciseIds = exercises.map((e) => e.id);

  const { data: sets, error: setsError } = await supabase
    .from('forge_session_sets')
    .select('session_exercise_id, reps, weight_kg')
    .in('session_exercise_id', exerciseIds)
    .eq('completed', true)
    .not('weight_kg', 'is', null);
  if (setsError) throw setsError;

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  // session order: earlier index = more recent
  const sessionOrder = new Map(sessions.map((s, i) => [s.id, i]));

  for (const set of sets ?? []) {
    const exercise = exerciseById.get(set.session_exercise_id);
    if (!exercise || set.weight_kg === null) continue;
    const name = exercise.exercise_name;
    const existing = result.get(name);
    const weight = Number(set.weight_kg);
    const sessionRank = sessionOrder.get(exercise.session_id) ?? 999;
    const existingRank = existing ? (sessionOrder.get(exerciseById.get(set.session_exercise_id)?.session_id ?? '') ?? 999) : 999;
    // prefer higher weight; on tie prefer more recent session
    if (!existing || weight > existing.weightKg || (weight === existing.weightKg && sessionRank < existingRank)) {
      result.set(name, { reps: set.reps ?? 0, weightKg: weight });
    }
  }

  return result;
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
    .select('id, plan_id, plan_name, day_name, started_at, completed_at, duration_seconds')
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
