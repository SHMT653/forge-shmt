'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { abandonSession, addSetToExercise, finishSession, getBestPerformances, getSession, updateSet, type SetUpdate } from '@/data/workouts';
import { errorMessage } from '@/domain/errors';
import type { LastPerformance } from '@/domain/progression';
import type { WorkoutSession } from '@/domain/types';

export function useActiveWorkout(sessionId: string) {
  const { user } = useAuth();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPerformance, setLastPerformance] = useState<Map<string, LastPerformance>>(new Map());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSession(sessionId);
      setSession(data);

      if (data) {
        const names = data.exercises.map((e) => e.exerciseName);
        const map = await getBestPerformances(user.id, names);
        setLastPerformance(map);
      }
    } catch (err) {
      setError(errorMessage(err, 'Training konnte nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Optimistic set patch — the UI must never wait on the network mid-set. */
  const saveSet = useCallback(async (setId: string, patch: SetUpdate) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((s) =>
            s.id === setId
              ? {
                  ...s,
                  ...('reps' in patch ? { reps: patch.reps ?? null } : {}),
                  ...('weightKg' in patch ? { weightKg: patch.weightKg ?? null } : {}),
                  ...('durationSeconds' in patch ? { durationSeconds: patch.durationSeconds ?? null } : {}),
                  ...('resistance' in patch ? { resistance: patch.resistance ?? null } : {}),
                  ...('completed' in patch ? { completed: patch.completed ?? false } : {}),
                }
              : s,
          ),
        })),
      };
    });
    await updateSet(setId, patch);
  }, []);

  /** Appends one more set to an exercise (§21 — you had more in the tank). */
  const addSet = useCallback(async (sessionExerciseId: string) => {
    const exercise = session?.exercises.find((e) => e.id === sessionExerciseId);
    const nextIndex = exercise ? exercise.sets.length : 0;
    const created = await addSetToExercise(sessionExerciseId, nextIndex);
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === sessionExerciseId ? { ...ex, sets: [...ex.sets, created] } : ex,
        ),
      };
    });
  }, [session]);

  const finish = useCallback(async () => {
    if (!session) return;
    const startedAt = new Date(session.startedAt).getTime();
    const durationSeconds = Math.max(60, Math.round((Date.now() - startedAt) / 1000));
    await finishSession(session.id, durationSeconds);
  }, [session]);

  const abandon = useCallback(async () => {
    if (!session) return;
    await abandonSession(session.id);
  }, [session]);

  return { session, loading, error, lastPerformance, saveSet, addSet, finish, abandon, reload: load };
}
