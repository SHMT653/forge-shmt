'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { addCardioLog, deleteCardioLog, listCardioLogs, listRecentCardioLogs, type CardioLog } from '@/data/cardio';
import { getUserGoals } from '@/data/profile';
import { errorMessage } from '@/domain/errors';
import { todayKey } from '@/domain/dates';

export function useCardio() {
  const { user } = useAuth();
  const [todayLogs, setTodayLogs]   = useState<CardioLog[]>([]);
  const [recentLogs, setRecentLogs] = useState<CardioLog[]>([]);
  const [weightKg, setWeightKg]     = useState(75);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const today = todayKey();
      const [todayL, recentL, goals] = await Promise.all([
        listCardioLogs(user.id, today),
        listRecentCardioLogs(user.id, 30),
        getUserGoals(user.id),
      ]);
      setTodayLogs(todayL);
      setRecentLogs(recentL);
      setWeightKg(goals.currentWeight ?? 75);
    } catch (err) {
      setError(errorMessage(err, 'Cardio-Daten konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const addLog = useCallback(async (entry: {
    activity: string; durationMinutes: number; distanceKm: number | null; kcalBurned: number;
  }) => {
    if (!user) return;
    const today = todayKey();
    const optimistic: CardioLog = { id: 'opt-' + Date.now(), logDate: today, loggedAt: new Date().toISOString(), ...entry };
    setTodayLogs((prev) => [...prev, optimistic]);
    await addCardioLog(user.id, today, entry);
    void load();
  }, [user, load]);

  const removeLog = useCallback(async (logId: string) => {
    if (!user) return;
    setTodayLogs((prev) => prev.filter((l) => l.id !== logId));
    await deleteCardioLog(user.id, logId);
    void load();
  }, [user, load]);

  const todayKcal = todayLogs.reduce((s, l) => s + l.kcalBurned, 0);

  return { todayLogs, recentLogs, weightKg, todayKcal, loading, error, addLog, removeLog, reload: load };
}
