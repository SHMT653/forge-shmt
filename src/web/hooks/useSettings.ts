'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { ensureProfile, getUserGoals, saveUserGoals, updateDisplayName } from '@/data/profile';
import { getTotalTrainingSeconds, listCompletedSessionDates } from '@/data/workouts';
import { errorMessage } from '@/domain/errors';
import type { Profile, UserGoals } from '@/domain/types';

export function useSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [stats, setStats] = useState<{ totalSeconds: number; sessionCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const fallbackName = (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? '';
      const [p, g, totalSeconds, sessionDates] = await Promise.all([
        ensureProfile(user.id, fallbackName),
        getUserGoals(user.id),
        getTotalTrainingSeconds(user.id),
        listCompletedSessionDates(user.id),
      ]);
      setProfile(p);
      setGoals(g);
      setStats({ totalSeconds, sessionCount: sessionDates.length });
    } catch (err) {
      setError(errorMessage(err, 'Einstellungen konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveName = useCallback(
    async (displayName: string) => {
      if (!user) return;
      await updateDisplayName(user.id, displayName);
      await load();
    },
    [user, load],
  );

  const saveGoals = useCallback(
    async (next: UserGoals) => {
      if (!user) return;
      await saveUserGoals(user.id, next);
      await load();
    },
    [user, load],
  );

  return { profile, goals, stats, loading, error, saveName, saveGoals };
}
