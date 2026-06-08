'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { ensureDefaultHabits, listHabitLogsForRange, setHabitLog } from '@/data/habits';
import { consecutiveDayStreak } from '@/domain/streaks';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import type { Habit, HabitLog } from '@/domain/types';

const HISTORY_DAYS = 35;

export function useHabits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const since = dateKeyAddDays(todayKey(), -HISTORY_DAYS);
      const [habitList, logList] = await Promise.all([ensureDefaultHabits(user.id), listHabitLogsForRange(user.id, since)]);
      setHabits(habitList);
      setLogs(logList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gewohnheiten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const logsByHabit = useMemo(() => {
    const map = new Map<string, Map<string, HabitLog>>();
    for (const log of logs) {
      const inner = map.get(log.habitId) ?? new Map<string, HabitLog>();
      inner.set(log.logDate, log);
      map.set(log.habitId, inner);
    }
    return map;
  }, [logs]);

  const streaksByHabit = useMemo(() => {
    const map = new Map<string, number>();
    for (const habit of habits) {
      const dayKeys = [...(logsByHabit.get(habit.id)?.values() ?? [])].filter((l) => l.completed).map((l) => l.logDate);
      map.set(habit.id, consecutiveDayStreak(dayKeys));
    }
    return map;
  }, [habits, logsByHabit]);

  const setLog = useCallback(
    async (habit: Habit, logDate: string, value: number, completed: boolean) => {
      if (!user) return;
      await setHabitLog(user.id, habit.id, logDate, value, completed);
      await load();
    },
    [user, load],
  );

  return { habits, logsByHabit, streaksByHabit, loading, error, setLog };
}
