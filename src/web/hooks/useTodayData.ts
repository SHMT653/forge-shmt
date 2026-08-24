'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { listPlans } from '@/data/plans';
import { getActiveSession, listCompletedSessionDates, listRecentSessions, startWorkoutSession } from '@/data/workouts';
import { ensureDefaultHabits, listHabitLogsForRange } from '@/data/habits';
import {
  addMealEntry,
  deleteMealEntry,
  listMealEntries,
  listNutritionLogs,
  listRecentUniqueMeals,
  syncNutritionTotals,
  type MealEntry,
  type MealEntryInput,
} from '@/data/nutrition';
import { createFoodItem, listFoodItems, markFoodUsed, rememberFoodFromEntry, type FoodItemInput } from '@/data/foodLibrary';
import { getCheckin, saveCheckin } from '@/data/checkins';
import { getTodayCardioKcal } from '@/data/cardio';
import { getUserGoals } from '@/data/profile';
import { listBodyMetrics, listProgressPhotos } from '@/data/progress';
import { buildDayMetrics, mergeHealth, metricsForDate, pickMetricHabits, setDayMetric, type DayMetrics } from '@/data/dailyMetrics';
import { listDailyHealth, setHealthMetric } from '@/data/dailyHealth';
import { getActivePhase } from '@/data/goalPhases';
import { errorMessage } from '@/domain/errors';
import { consecutiveDayStreak } from '@/domain/streaks';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import { resolveTargets, type ResolvedTargets } from '@/domain/goalPhase';
import { summarizeWeight, isPhotoDue, isWeighInDue, type WeightSummary } from '@/domain/weightTrend';
import { combineQuality, slotForHour } from '@/domain/nutritionMath';
import { weekBoundsFor } from '@/domain/weeklyReview';
import {
  buildDayStatus,
  scoreDay,
  type DayContext,
  type DayStatusItem,
  type DayScore,
} from '@/domain/dayEvaluation';
import type {
  GoalPhaseRecord,
  DailyCheckin,
  FoodItem,
  Habit,
  HabitLog,
  Macros,
  PlanDay,
  Soreness,
  TrainingPlan,
  UserGoals,
  WorkoutSession,
} from '@/domain/types';

const HISTORY_DAYS = 120;

/**
 * Overlays an active goal phase onto the profile.
 *
 * Phase values win where they are set; anything the phase leaves null falls
 * through to the profile, then to the derived defaults. No target is ever read
 * from a constant in a component (§51).
 */
function applyPhase(goals: UserGoals, phase: GoalPhaseRecord | null): UserGoals {
  if (!phase) return goals;
  return {
    ...goals,
    phaseType: phase.phaseType,
    caloriesMin: phase.caloriesMin ?? goals.caloriesMin,
    caloriesMax: phase.caloriesMax ?? goals.caloriesMax,
    proteinMin: phase.proteinMin ?? goals.proteinMin,
    proteinMax: phase.proteinMax ?? goals.proteinMax,
    stepsGoal: phase.stepsGoal ?? goals.stepsGoal,
    waterGoalMl: phase.waterGoalMl ?? goals.waterGoalMl,
    sleepGoalH: phase.sleepGoalH ?? goals.sleepGoalH,
    weeklyTrainingGoal: phase.weeklyTrainingGoal ?? goals.weeklyTrainingGoal,
    weightGoal: phase.weightGoal ?? goals.weightGoal,
  };
}

export type TodayData = {
  goals: UserGoals;
  targets: ResolvedTargets;
  /** The running goal phase, when the user has started one (§29/§38). */
  activePhase: GoalPhaseRecord | null;

  // training
  activePlan: TrainingPlan | null;
  suggestedDay: PlanDay | null;
  activeSession: WorkoutSession | null;
  recentTrainingDates: Set<string>;
  fullWorkoutsThisWeek: number;
  miniSessionsThisWeek: number;

  // day
  habits: Habit[];
  todayLogs: Map<string, HabitLog>;
  metrics: DayMetrics;
  checkin: DailyCheckin | null;
  entries: MealEntry[];
  totals: Macros;
  caloriesBurned: { steps: number; workout: number; cardio: number; total: number };

  // library — the favourites drive the one-tap chips, the full lists drive search
  favoriteFoods: FoodItem[];
  allFoods: FoodItem[];
  recentMeals: MealEntry[];

  // analysis
  weight: WeightSummary;
  weekly: { avgKcal: number | null; avgProtein: number | null; avgSteps: number | null; avgSleep: number | null; daysWithData: number };
  dailyStreak: number;
  trainingStreak: number;

  // coach
  coach: DayContext;
  dayStatus: DayStatusItem[];
  dayScore: DayScore;

  // reminders
  weighInDue: boolean;
  photoDue: boolean;
};

export function useTodayData() {
  const { user } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const today = todayKey();
      const since = dateKeyAddDays(today, -HISTORY_DAYS);
      const week = weekBoundsFor(today);

      const [
        plans, activeSession, habits, habitLogs, entries, goals, metrics, completedDates,
        recentSessions, cardioKcal, foods, checkin, photos, weekLogs,
        healthDays, activePhase, recentMeals,
      ] = await Promise.all([
        listPlans(user.id),
        getActiveSession(user.id),
        ensureDefaultHabits(user.id),
        listHabitLogsForRange(user.id, since),
        listMealEntries(user.id, today),
        getUserGoals(user.id),
        listBodyMetrics(user.id, 180),
        listCompletedSessionDates(user.id),
        listRecentSessions(user.id, 120),
        getTodayCardioKcal(user.id, today),
        listFoodItems(user.id),
        getCheckin(user.id, today),
        listProgressPhotos(user.id),
        listNutritionLogs(user.id, dateKeyAddDays(today, -6), today),
        listDailyHealth(user.id, since, today),
        getActivePhase(user.id),
        listRecentUniqueMeals(user.id, 12),
      ]);

      // The active phase, when there is one, overrides the profile defaults —
      // that is what makes switching from cut to bulk a data change (§29).
      const targets = resolveTargets(applyPhase(goals, activePhase));

      // ── Training ────────────────────────────────────────────────────
      const activePlan = plans.find((p) => p.isActive) ?? plans[0] ?? null;
      let suggestedDay: PlanDay | null = null;
      if (activePlan && activePlan.days.length > 0) {
        const completedForPlan = recentSessions.filter((s) => s.planId === activePlan.id).length;
        suggestedDay = activePlan.days[completedForPlan % activePlan.days.length] ?? activePlan.days[0] ?? null;
      }

      const inThisWeek = (iso: string | null) => {
        if (!iso) return false;
        const key = iso.slice(0, 10);
        return key >= week.start && key <= week.end;
      };
      const fullWorkoutsThisWeek = recentSessions.filter((s) => s.kind === 'full' && inThisWeek(s.completedAt)).length;
      const miniSessionsThisWeek = recentSessions.filter((s) => s.kind === 'mini' && inThisWeek(s.completedAt)).length;

      // ── Habit-backed metrics ────────────────────────────────────────
      const todayLogs = new Map<string, HabitLog>();
      for (const log of habitLogs) if (log.logDate === today) todayLogs.set(log.habitId, log);

      const metricsByDate = mergeHealth(buildDayMetrics(habits, habitLogs), healthDays);
      const dayMetrics = metricsForDate(metricsByDate, today);

      // ── Nutrition ───────────────────────────────────────────────────
      const totals = entries.reduce<Macros>(
        (acc, e) => ({
          kcal: acc.kcal + e.kcal,
          proteinG: acc.proteinG + e.proteinG,
          carbsG: acc.carbsG + e.carbsG,
          fatG: acc.fatG + e.fatG,
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      );
      const quality = combineQuality(entries.map((e) => e.dataQuality));

      // ── Burn estimate ───────────────────────────────────────────────
      const weightKg = goals.currentWeight ?? 75;
      const burnedSteps = Math.round(dayMetrics.steps * 0.04 * (weightKg / 80));
      const workoutSeconds = recentSessions
        .filter((s) => s.completedAt?.slice(0, 10) === today)
        .reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
      const burnedWorkout = Math.round(5.5 * weightKg * (workoutSeconds / 3600));

      // ── Rolling 7-day averages ──────────────────────────────────────
      const loggedDays = weekLogs.filter((l) => l.calories > 0);
      const avg = (values: number[]) =>
        values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
      const lastSevenDays = Array.from({ length: 7 }, (_, i) => dateKeyAddDays(today, -i));
      const stepValues = lastSevenDays
        .map((d) => metricsForDate(metricsByDate, d).steps)
        .filter((v) => v > 0);
      const sleepValues = lastSevenDays
        .map((d) => metricsForDate(metricsByDate, d).sleepH)
        .filter((v) => v > 0);

      const weekly = {
        avgKcal: avg(loggedDays.map((l) => l.calories)),
        avgProtein: avg(loggedDays.map((l) => l.proteinG)),
        avgSteps: avg(stepValues),
        // Rounded to a tenth — an average sleep of "8" hides a real difference.
        avgSleep: sleepValues.length > 0
          ? Math.round((sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) * 10) / 10
          : null,
        daysWithData: loggedDays.length,
      };

      // ── Weight ──────────────────────────────────────────────────────
      const weight = summarizeWeight(metrics);

      // ── Streaks ─────────────────────────────────────────────────────
      const habitDayKeys = new Set<string>();
      for (const log of habitLogs) if (log.completed) habitDayKeys.add(log.logDate);
      for (const date of completedDates) habitDayKeys.add(date);

      // ── Coach context ───────────────────────────────────────────────
      const lastCompleted = recentSessions.find((s) => s.completedAt);
      const coach: DayContext = {
        today,
        hour: new Date().getHours(),
        targets,
        nutrition: { ...totals, quality, entryCount: entries.length },
        metrics: { steps: dayMetrics.steps, waterMl: dayMetrics.waterMl, sleepH: dayMetrics.sleepH },
        training: {
          trainedToday: completedDates.includes(today),
          hasActiveSession: activeSession !== null,
          lastWorkoutDate: lastCompleted?.completedAt?.slice(0, 10) ?? null,
          lastWorkoutName: lastCompleted?.dayName ?? null,
          fullWorkoutsThisWeek,
          miniSessionsThisWeek,
          plannedDayName: suggestedDay?.name ?? null,
          weeklyTarget: targets.weeklyTrainingGoal,
        },
        soreness: checkin?.soreness ?? null,
        weight,
        weekly,
      };

      const lastPhoto = photos[0]?.takenAt ?? null;

      setData({
        goals,
        targets,
        activePhase,
        activePlan,
        suggestedDay,
        activeSession,
        recentTrainingDates: new Set(completedDates),
        fullWorkoutsThisWeek,
        miniSessionsThisWeek,
        habits,
        todayLogs,
        metrics: dayMetrics,
        checkin,
        entries,
        totals,
        caloriesBurned: {
          steps: burnedSteps,
          workout: burnedWorkout,
          cardio: cardioKcal,
          total: burnedSteps + burnedWorkout + cardioKcal,
        },
        favoriteFoods: foods.filter((f) => f.favorite || f.useCount > 0).slice(0, 12),
        allFoods: foods,
        recentMeals,
        weight,
        weekly,
        dailyStreak: consecutiveDayStreak(habitDayKeys),
        trainingStreak: consecutiveDayStreak(completedDates),
        coach,
        dayStatus: buildDayStatus(coach),
        dayScore: scoreDay(coach),
        weighInDue: isWeighInDue(weight.latestDate, today, goals.weighInWeekday),
        photoDue: isPhotoDue(lastPhoto, today, goals.photoIntervalDays),
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

  const metricHabits = useMemo(() => pickMetricHabits(data?.habits ?? []), [data?.habits]);

  /**
   * Writes a day metric.
   *
   * Steps and sleep go to the health store so their source is recorded and a
   * later sync knows not to overwrite this value; water stays a habit.
   */
  const setMetric = useCallback(
    async (key: 'steps' | 'water' | 'sleep', value: number) => {
      if (!user) return;

      // Optimistic — these are tapped repeatedly and must feel instant.
      setData((prev) =>
        prev
          ? {
              ...prev,
              metrics: {
                ...prev.metrics,
                ...(key === 'water' ? { waterMl: value } : key === 'steps' ? { steps: value } : { sleepH: value }),
                ...(key !== 'water'
                  ? { sources: { ...prev.metrics.sources, [key]: 'manual' as const } }
                  : {}),
              },
            }
          : prev,
      );

      const today = todayKey();
      if (key === 'water') {
        const habit = metricHabits.water;
        if (habit) await setDayMetric(user.id, habit, today, value);
      } else if (key === 'steps') {
        await setHealthMetric(user.id, today, 'steps', Math.round(value), 'manual');
      } else {
        await setHealthMetric(user.id, today, 'sleepMinutes', Math.round(value * 60), 'manual');
      }
      void load();
    },
    [user, metricHabits, load],
  );

  const addWater = useCallback(
    async (ml: number) => {
      const current = data?.metrics.waterMl ?? 0;
      await setMetric('water', current + ml);
    },
    [data?.metrics.waterMl, setMetric],
  );

  const toggleHabit = useCallback(
    async (habit: Habit, value: number, completed: boolean) => {
      if (!user) return;
      await setDayMetric(user.id, habit, todayKey(), completed ? Math.max(value, habit.target) : value);
      void load();
    },
    [user, load],
  );

  /** Adds a meal entry and re-syncs the cached daily total. */
  const addEntry = useCallback(
    async (entry: MealEntryInput) => {
      if (!user) return;
      const today = todayKey();
      const withSlot: MealEntryInput = { slot: slotForHour(new Date().getHours()), ...entry };

      await addMealEntry(user.id, today, withSlot);

      // Anything typed by hand is worth remembering: the next time the user
      // eats it, it is one tap instead of four numbers (§12).
      await rememberFoodFromEntry(user.id, entry);

      if (entry.foodItemId) {
        const food = data?.allFoods.find((f) => f.id === entry.foodItemId);
        await markFoodUsed(user.id, entry.foodItemId, food?.useCount ?? 0);
      }
      await syncNutritionTotals(user.id, today);
      await load();
    },
    [user, data?.allFoods, load],
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      if (!user) return;
      const today = todayKey();
      setData((prev) => (prev ? { ...prev, entries: prev.entries.filter((e) => e.id !== entryId) } : prev));
      await deleteMealEntry(user.id, entryId);
      await syncNutritionTotals(user.id, today);
      await load();
    },
    [user, load],
  );

  const setSoreness = useCallback(
    async (soreness: Soreness | null) => {
      if (!user) return;
      await saveCheckin(user.id, todayKey(), { soreness });
      await load();
    },
    [user, load],
  );

  /** Files a product discovered through search into the user's own library. */
  const saveFood = useCallback(
    async (input: FoodItemInput) => {
      if (!user) return;
      // Never store the same product twice under the same name.
      const exists = data?.allFoods.some((f) => f.name.toLowerCase() === input.name.toLowerCase());
      if (exists) return;
      await createFoodItem(user.id, input);
      void load();
    },
    [user, data?.allFoods, load],
  );

  const startSuggestedWorkout = useCallback(async (): Promise<string | null> => {
    if (!user || !data?.activePlan || !data.suggestedDay) return null;
    return startWorkoutSession(user.id, data.activePlan.id, data.activePlan.name, data.suggestedDay);
  }, [user, data]);

  return {
    data,
    loading,
    error,
    reload: load,
    addEntry,
    removeEntry,
    addWater,
    setMetric,
    setSoreness,
    toggleHabit,
    saveFood,
    startSuggestedWorkout,
  };
}
