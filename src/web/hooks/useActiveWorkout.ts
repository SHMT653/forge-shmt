'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { abandonSession, finishSession, getLastPerformance, getSession, updateSet } from '@/data/workouts';
import { errorMessage } from '@/domain/errors';
import type { WorkoutSession } from '@/domain/types';

export function useActiveWorkout(sessionId: string) {
  const { user } = useAuth();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPerformance, setLastPerformance] = useState<Map<string, { reps: number; weightKg: number }>>(new Map());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSession(sessionId);
      setSession(data);

      if (data) {
        const entries = await Promise.all(
          data.exercises.map(async (exercise) => {
            const perf = await getLastPerformance(user.id, exercise.exerciseName);
            return [exercise.exerciseName, perf] as const;
          }),
        );
        const map = new Map<string, { reps: number; weightKg: number }>();
        for (const [name, perf] of entries) if (perf) map.set(name, perf);
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

  const saveSet = useCallback(
    async (setId: string, reps: number | null, weightKg: number | null, completed: boolean) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((s) => (s.id === setId ? { ...s, reps, weightKg, completed } : s)),
          })),
        };
      });
      await updateSet(setId, reps, weightKg, completed);
    },
    [],
  );

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

  return { session, loading, error, lastPerformance, saveSet, finish, abandon, reload: load };
}
