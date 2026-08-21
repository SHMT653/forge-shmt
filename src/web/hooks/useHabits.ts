'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { ensureDefaultHabits, listHabitLogsForRange, setHabitLog } from '@/data/habits';
import { getNutritionLog } from '@/data/nutrition';
import { getUserGoals } from '@/data/profile';
import { errorMessage } from '@/domain/errors';
import { consecutiveDayStreak, recentHitRate } from '@/domain/streaks';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import type { Habit, HabitLog } from '@/domain/types';

const HISTORY_DAYS = 35;

export function useHabits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [nutritionProteinG, setNutritionProteinG] = useState(0);
  const [proteinGoal, setProteinGoal] = useState(150);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const today = todayKey();
      const since = dateKeyAddDays(today, -HISTORY_DAYS);
      const [habitList, logList, nutritionLog, goals] = await Promise.all([
        ensureDefaultHabits(user.id),
        listHabitLogsForRange(user.id, since),
        getNutritionLog(user.id, today),
        getUserGoals(user.id),
      ]);
      setHabits(habitList);
      setLogs(logList);
      setNutritionProteinG(nutritionLog.proteinG);
      setProteinGoal(goals.proteinGoal);
    } catch (err) {
      setError(errorMessage(err, 'Gewohnheiten konnten nicht geladen werden.'));
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

  /** Rolling 7-day hit rate — the gentler counterpart to the streak (§43). */
  const hitRateByHabit = useMemo(() => {
    const map = new Map<string, { hits: number; total: number }>();
    for (const habit of habits) {
      const dayKeys = [...(logsByHabit.get(habit.id)?.values() ?? [])].filter((l) => l.completed).map((l) => l.logDate);
      map.set(habit.id, recentHitRate(dayKeys));
    }
    return map;
  }, [habits, logsByHabit]);

  const setLog = useCallback(
    async (habit: Habit, logDate: string, value: number, completed: boolean) => {
      if (!user) return;

      // Optimistic update so the UI reacts instantly
      setLogs((prev) => {
        const exists = prev.some((l) => l.habitId === habit.id && l.logDate === logDate);
        if (exists) {
          return prev.map((l) =>
            l.habitId === habit.id && l.logDate === logDate ? { ...l, value, completed } : l,
          );
        }
        return [...prev, { habitId: habit.id, logDate, value, completed }];
      });

      await setHabitLog(user.id, habit.id, logDate, value, completed);
      void load(); // background sync (non-blocking)
    },
    [user, load],
  );

  return { habits, logsByHabit, streaksByHabit, hitRateByHabit, loading, error, setLog, nutritionProteinG, proteinGoal };
}
