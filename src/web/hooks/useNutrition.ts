'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  addMealEntry,
  deleteMealEntry,
  listMealEntries,
  listRecentUniqueMeals,
  syncNutritionTotals,
  type MealEntry,
} from '@/data/nutrition';
import { listHabits, listHabitLogsForRange, setHabitLog } from '@/data/habits';
import { getUserGoals } from '@/data/profile';
import { errorMessage } from '@/domain/errors';
import { todayKey } from '@/domain/dates';
import type { Habit, UserGoals } from '@/domain/types';

const GLASS_ML = 250;

export type NutritionState = {
  meals:        MealEntry[];
  recentMeals:  MealEntry[];
  totals:       { kcal: number; proteinG: number; carbsG: number; fatG: number };
  goals:        UserGoals;
  water:        { habit: Habit | null; todayMl: number };
  loading:      boolean;
  error:        string | null;
};

export function useNutrition() {
  const { user } = useAuth();
  const [state, setState] = useState<NutritionState>({
    meals:        [],
    recentMeals:  [],
    totals:       { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    goals:        { calorieGoal: 2000, proteinGoal: 150, weightGoal: null, currentWeight: null, heightCm: null, birthYear: null, gender: 'male' as const, activityLevel: 'moderate' as const, goalType: 'maintain' as const },
    water:        { habit: null, todayMl: 0 },
    loading:      true,
    error:        null,
  });

  const load = useCallback(async () => {
    if (!user) return;
    const today = todayKey();
    try {
      const [meals, habitList, logs, goals, recentMeals] = await Promise.all([
        listMealEntries(user.id, today),
        listHabits(user.id),
        listHabitLogsForRange(user.id, today),
        getUserGoals(user.id),
        listRecentUniqueMeals(user.id),
      ]);

      const totals = meals.reduce(
        (acc, m) => ({
          kcal:     acc.kcal     + m.kcal,
          proteinG: acc.proteinG + m.proteinG,
          carbsG:   acc.carbsG   + m.carbsG,
          fatG:     acc.fatG     + m.fatG,
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      );

      const waterHabit = habitList.find((h) => h.key === 'water') ?? null;
      const waterLog   = waterHabit ? logs.find((l) => l.habitId === waterHabit.id && l.logDate === today) : null;

      setState({
        meals,
        recentMeals,
        totals,
        goals: goals ?? { calorieGoal: 2000, proteinGoal: 150, weightGoal: null, currentWeight: null, heightCm: null, birthYear: null, gender: 'male', activityLevel: 'moderate', goalType: 'maintain' },
        water: { habit: waterHabit, todayMl: waterLog?.value ?? 0 },
        loading: false,
        error:   null,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: errorMessage(err, 'Ernährung konnte nicht geladen werden.') }));
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const addMeal = useCallback(async (entry: {
    name: string; kcal: number; proteinG: number; carbsG: number; fatG: number;
  }) => {
    if (!user) return;
    const today = todayKey();

    // Optimistic add
    const optimistic: MealEntry = { id: 'opt-' + Date.now(), logDate: today, loggedAt: new Date().toISOString(), ...entry };
    setState((prev) => {
      const meals  = [...prev.meals, optimistic];
      const totals = computeTotals(meals);
      return { ...prev, meals, totals };
    });

    await addMealEntry(user.id, today, entry);
    await syncNutritionTotals(user.id, today);
    void load();
  }, [user, load]);

  const removeMeal = useCallback(async (entryId: string) => {
    if (!user) return;
    const today = todayKey();

    // Optimistic remove
    setState((prev) => {
      const meals  = prev.meals.filter((m) => m.id !== entryId);
      const totals = computeTotals(meals);
      return { ...prev, meals, totals };
    });

    await deleteMealEntry(user.id, entryId);
    await syncNutritionTotals(user.id, today);
    void load();
  }, [user, load]);

  const addWater = useCallback(async (glasses: number) => {
    if (!user || !state.water.habit) return;
    const today   = todayKey();
    const habit   = state.water.habit;
    const nextMl  = state.water.todayMl + glasses * GLASS_ML;
    const completed = nextMl >= habit.target;

    // Optimistic
    setState((prev) => ({ ...prev, water: { ...prev.water, todayMl: nextMl } }));

    await setHabitLog(user.id, habit.id, today, nextMl, completed);
    void load();
  }, [user, state.water, load]);

  return { state, addMeal, removeMeal, addWater, reload: load };
}

function computeTotals(meals: MealEntry[]) {
  return meals.reduce(
    (acc, m) => ({
      kcal:     acc.kcal     + m.kcal,
      proteinG: acc.proteinG + m.proteinG,
      carbsG:   acc.carbsG   + m.carbsG,
      fatG:     acc.fatG     + m.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
