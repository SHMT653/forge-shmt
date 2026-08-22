'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getSupabaseClient } from '@/services/supabase/client';
import { getCheckin } from '@/data/checkins';
import { errorMessage } from '@/domain/errors';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import {
  analyseMuscleLoad, regionBalance, suggestNextFocus, trainingInsights,
  type MuscleLoad, type RegionBalance, type SessionSummary, type TrainingInsight,
} from '@/domain/trainingAnalysis';
import type { MuscleRegion } from '@/domain/trainingAnalysis';

export type TrainingAnalysis = {
  loads: MuscleLoad[];
  balance: RegionBalance[];
  insights: TrainingInsight[];
  nextFocus: { region: MuscleRegion; reason: string } | null;
  sessionCount: number;
  windowDays: number;
};

/**
 * Volume analysis over a rolling window.
 *
 * Loads set counts per exercise in three queries rather than pulling every
 * individual set row — the analysis only needs "how many completed sets of
 * what", not the reps inside them.
 */
export function useTrainingAnalysis(windowDays = 14) {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<TrainingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = getSupabaseClient();
      const today = todayKey();
      const from = dateKeyAddDays(today, -(windowDays - 1));

      const { data: sessions, error: sessionError } = await supabase
        .from('forge_workout_sessions')
        .select('id, completed_at')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .gte('completed_at', `${from}T00:00:00`)
        .order('completed_at', { ascending: false });
      if (sessionError) throw sessionError;

      if (!sessions?.length) {
        setAnalysis({ loads: [], balance: regionBalance([]), insights: trainingInsights([], regionBalance([]), 0), nextFocus: null, sessionCount: 0, windowDays });
        return;
      }

      const sessionIds = sessions.map((s) => s.id);

      const { data: exercises, error: exerciseError } = await supabase
        .from('forge_session_exercises')
        .select('id, session_id, exercise_name')
        .in('session_id', sessionIds);
      if (exerciseError) throw exerciseError;

      const { data: sets, error: setError } = await supabase
        .from('forge_session_sets')
        .select('session_exercise_id')
        .in('session_exercise_id', (exercises ?? []).map((e) => e.id))
        .eq('completed', true);
      if (setError) throw setError;

      const setCount = new Map<string, number>();
      for (const row of sets ?? []) {
        setCount.set(row.session_exercise_id, (setCount.get(row.session_exercise_id) ?? 0) + 1);
      }

      const bySession = new Map<string, SessionSummary>();
      for (const session of sessions) {
        bySession.set(session.id, { date: (session.completed_at as string).slice(0, 10), exercises: [] });
      }
      for (const exercise of exercises ?? []) {
        const summary = bySession.get(exercise.session_id);
        if (!summary) continue;
        summary.exercises.push({
          name: exercise.exercise_name,
          completedSets: setCount.get(exercise.id) ?? 0,
        });
      }

      const summaries = [...bySession.values()];
      const loads = analyseMuscleLoad(summaries, today);
      const balance = regionBalance(loads);
      const checkin = await getCheckin(user.id, today);

      setAnalysis({
        loads,
        balance,
        insights: trainingInsights(loads, balance, summaries.length),
        nextFocus: suggestNextFocus(loads, checkin?.soreness ?? null),
        sessionCount: summaries.length,
        windowDays,
      });
    } catch (err) {
      setError(errorMessage(err, 'Trainingsanalyse konnte nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  return { analysis, loading, error, reload: load };
}
