'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { listPlans } from '@/data/plans';
import {
  getActiveSession,
  listCompletedSessionDates,
  listRecentSessions,
  startWorkoutSession,
} from '@/data/workouts';
import { ensureDefaultHabits, listHabitLogsForRange, setHabitLog } from '@/data/habits';
import { addMealEntry, getNutritionLog, syncNutritionTotals } from '@/data/nutrition';
import { getUserGoals } from '@/data/profile';
import { listBodyMetrics } from '@/data/progress';
import { errorMessage } from '@/domain/errors';
import { consecutiveDayStreak, weeklyStreak } from '@/domain/streaks';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import type { BodyMetric, Habit, HabitLog, NutritionLog, PlanDay, TrainingPlan, UserGoals, WorkoutSession } from '@/domain/types';

export type TodayData = {
  activePlan: TrainingPlan | null;
  suggestedDay: PlanDay | null;
  activeSession: WorkoutSession | null;
  habits: Habit[];
  todayLogs: Map<string, HabitLog>;
  nutritionLog: NutritionLog;
  goals: UserGoals;
  latestMetric: BodyMetric | null;
  dailyStreak: number;
  trainingStreak: number;
  weeklyTrainingStreak: number;
};

export function useTodayData() {
  const { user } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const today = todayKey();
      const since = dateKeyAddDays(today, -120);

      const [plans, activeSession, habits, habitLogs, nutritionLog, goals, metrics, completedDates, recentSessions] =
        await Promise.all([
          listPlans(user.id),
          getActiveSession(user.id),
          ensureDefaultHabits(user.id),
          listHabitLogsForRange(user.id, since),
          getNutritionLog(user.id, today),
          getUserGoals(user.id),
          listBodyMetrics(user.id, 1),
          listCompletedSessionDates(user.id),
          listRecentSessions(user.id, 100),
        ]);

      const activePlan = plans.find((p) => p.isActive) ?? plans[0] ?? null;
      let suggestedDay: PlanDay | null = null;
      if (activePlan && activePlan.days.length > 0) {
        const completedForPlan = recentSessions.filter((s) => s.planId === activePlan.id).length;
        suggestedDay = activePlan.days[completedForPlan % activePlan.days.length] ?? activePlan.days[0]!;
      }

      const todayLogs = new Map<string, HabitLog>();
      for (const log of habitLogs) {
        if (log.logDate === today) todayLogs.set(log.habitId, log);
      }

      const habitDayKeys = new Set<string>();
      for (const log of habitLogs) {
        if (log.completed) habitDayKeys.add(log.logDate);
      }
      for (const date of completedDates) habitDayKeys.add(date);

      setData({
        activePlan,
        suggestedDay,
        activeSession,
        habits,
        todayLogs,
        nutritionLog,
        goals,
        latestMetric: metrics[metrics.length - 1] ?? null,
        dailyStreak: consecutiveDayStreak(habitDayKeys),
        trainingStreak: consecutiveDayStreak(completedDates),
        weeklyTrainingStreak: weeklyStreak(completedDates, 3),
      });
    } catch (err) {
      setError(errorMessage(err, 'Daten konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleHabit = useCallback(
    async (habit: Habit, value: number, completed: boolean) => {
      if (!user) return;
      await setHabitLog(user.id, habit.id, todayKey(), value, completed);
      await load();
    },
    [user, load],
  );

  const logNutrition = useCallback(
    async (
      kcal:     number,
      proteinG: number,
      name?:    string,
      carbsG?:  number,
      fatG?:    number,
    ) => {
      if (!user || (!kcal && !proteinG)) return;
      const today = todayKey();
      // Estimate carbs/fat from remaining kcal if not provided
      const remaining   = Math.max(0, kcal - proteinG * 4);
      const resolvedCarbs = carbsG  ?? Math.round((remaining * 0.62) / 4);
      const resolvedFat   = fatG    ?? Math.round((remaining * 0.38) / 9);
      await addMealEntry(user.id, today, {
        name:     name ?? (kcal ? `${kcal} kcal` : 'Eintrag'),
        kcal,
        proteinG,
        carbsG:   resolvedCarbs,
        fatG:     resolvedFat,
      });
      await syncNutritionTotals(user.id, today);
      await load();
    },
    [user, load],
  );

  const startSuggestedWorkout = useCallback(async (): Promise<string | null> => {
    if (!user || !data?.activePlan || !data.suggestedDay) return null;
    return startWorkoutSession(user.id, data.activePlan.id, data.activePlan.name, data.suggestedDay);
  }, [user, data]);

  return { data, loading, error, reload: load, toggleHabit, logNutrition, startSuggestedWorkout };
}
