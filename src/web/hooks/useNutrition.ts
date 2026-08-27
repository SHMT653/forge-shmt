'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import {
  addMealEntry,
  deleteMealEntry,
  listMealEntries,
  listNutritionLogs,
  listRecentUniqueMeals,
  syncNutritionTotals,
  updateMealEntry,
  type MealEntry,
  type MealEntryInput,
} from '@/data/nutrition';
import {
  createFoodItem,
  createRecipe,
  deleteRecipe,
  listFoodItems,
  listRecipes,
  markFoodUsed,
  markRecipeUsed,
  rememberFoodFromEntry,
  toggleFoodFavorite,
  updateFoodItem,
  updateRecipe,
  type FoodItemInput,
  type RecipeInput,
} from '@/data/foodLibrary';
import { ensureDefaultHabits, listHabitLogsForRange } from '@/data/habits';
import { GOALS_DEFAULTS, getUserGoals } from '@/data/profile';
import { setDayMetric, pickMetricHabits } from '@/data/dailyMetrics';
import { errorMessage } from '@/domain/errors';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import { resolveTargets, type ResolvedTargets } from '@/domain/goalPhase';
import { combineQuality, macrosForServings, slotForHour, sumMacros } from '@/domain/nutritionMath';
import type { DataQuality, FoodItem, Habit, Macros, Recipe, UserGoals } from '@/domain/types';
import { fluidFromEntry } from '@/domain/fluids';
import { foodKey } from '@/domain/foodMemory';

export type NutritionState = {
  meals: MealEntry[];
  recentMeals: MealEntry[];
  foods: FoodItem[];
  recipes: Recipe[];
  totals: Macros;
  quality: DataQuality;
  goals: UserGoals;
  targets: ResolvedTargets;
  water: { habit: Habit | null; todayMl: number; goalMl: number };
  /** Last 7 days of daily totals, for the weekly average (§58). */
  weekly: { avgKcal: number | null; avgProtein: number | null; days: number };
  loading: boolean;
  error: string | null;
};

const EMPTY_TOTALS: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function useNutrition() {
  const { user } = useAuth();
  const [state, setState] = useState<NutritionState>({
    meals: [],
    recentMeals: [],
    foods: [],
    recipes: [],
    totals: EMPTY_TOTALS,
    quality: 'verified',
    goals: GOALS_DEFAULTS,
    targets: resolveTargets(GOALS_DEFAULTS),
    water: { habit: null, todayMl: 0, goalMl: 2500 },
    weekly: { avgKcal: null, avgProtein: null, days: 0 },
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!user) return;
    const today = todayKey();
    try {
      const [meals, habitList, logs, goals, recentMeals, foods, weekLogs, recipes] = await Promise.all([
        listMealEntries(user.id, today),
        ensureDefaultHabits(user.id),
        listHabitLogsForRange(user.id, today),
        getUserGoals(user.id),
        listRecentUniqueMeals(user.id),
        listFoodItems(user.id),
        listNutritionLogs(user.id, dateKeyAddDays(today, -6), today),
        listRecipes(user.id),
      ]);

      const targets = resolveTargets(goals);
      const waterHabit = pickMetricHabits(habitList).water;
      const waterLog = waterHabit ? logs.find((l) => l.habitId === waterHabit.id && l.logDate === today) : null;

      const logged = weekLogs.filter((l) => l.calories > 0);
      const avg = (values: number[]) =>
        values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

      setState({
        meals,
        recentMeals,
        foods,
        recipes,
        totals: sumMacros(meals.map((m) => ({ kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG }))),
        quality: combineQuality(meals.map((m) => m.dataQuality)),
        goals,
        targets,
        water: { habit: waterHabit, todayMl: waterLog?.value ?? 0, goalMl: targets.waterMl },
        weekly: {
          avgKcal: avg(logged.map((l) => l.calories)),
          avgProtein: avg(logged.map((l) => l.proteinG)),
          days: logged.length,
        },
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage(err, 'Ernährung konnte nicht geladen werden.'),
      }));
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const addMeal = useCallback(
    async (entry: MealEntryInput) => {
      if (!user) return;
      const today = todayKey();
      const withSlot: MealEntryInput = { slot: slotForHour(new Date().getHours()), ...entry };

      // Optimistic — logging a meal must feel instant.
      const optimistic: MealEntry = {
        id: `opt-${Date.now()}`,
        logDate: today,
        loggedAt: new Date().toISOString(),
        name: withSlot.name,
        kcal: withSlot.macros.kcal,
        proteinG: withSlot.macros.proteinG,
        carbsG: withSlot.macros.carbsG,
        fatG: withSlot.macros.fatG,
        dataQuality: withSlot.dataQuality ?? 'verified',
        kcalMin: withSlot.kcalMin ?? null,
        kcalMax: withSlot.kcalMax ?? null,
        servings: withSlot.servings ?? 1,
        slot: withSlot.slot ?? null,
        source: withSlot.source ?? 'manual',
        foodItemId: withSlot.foodItemId ?? null,
        recipeId: withSlot.recipeId ?? null,
        batchId: withSlot.batchId ?? null,
      };
      setState((prev) => {
        const meals = [...prev.meals, optimistic];
        return { ...prev, meals, totals: totalsOf(meals), quality: combineQuality(meals.map((m) => m.dataQuality)) };
      });

      await addMealEntry(user.id, today, withSlot);
      // Typed by hand once is enough; next time it is a tap (§12).
      await rememberFoodFromEntry(user.id, withSlot);

      const food = withSlot.foodItemId ? state.foods.find((f) => f.id === withSlot.foodItemId) : undefined;
      if (withSlot.foodItemId) {
        await markFoodUsed(user.id, withSlot.foodItemId, food?.useCount ?? 0);
      }

      // A drink counts toward the fluid target too, not only the calorie one.
      const fluid = fluidFromEntry({
        name: withSlot.name,
        servings: withSlot.servings ?? null,
        servingLabel: food?.servingLabel ?? withSlot.servingLabel ?? null,
        servingG: food?.servingG ?? withSlot.servingG ?? null,
      });
      if (fluid && state.water.habit) {
        await setDayMetric(user.id, state.water.habit, today, state.water.todayMl + fluid.ml);
      }
      await syncNutritionTotals(user.id, today);
      void load();
    },
    [user, state.foods, state.water.habit, state.water.todayMl, load],
  );

  const removeMeal = useCallback(
    async (entryId: string) => {
      if (!user) return;
      const today = todayKey();
      setState((prev) => {
        const meals = prev.meals.filter((m) => m.id !== entryId);
        return { ...prev, meals, totals: totalsOf(meals), quality: combineQuality(meals.map((m) => m.dataQuality)) };
      });
      await deleteMealEntry(user.id, entryId);
      await syncNutritionTotals(user.id, today);
      void load();
    },
    [user, load],
  );

  const editMeal = useCallback(
    async (entryId: string, patch: { name?: string; macros?: Macros; servings?: number }) => {
      if (!user) return;
      await updateMealEntry(user.id, entryId, patch);
      await syncNutritionTotals(user.id, todayKey());
      void load();
    },
    [user, load],
  );

  const addWater = useCallback(
    async (ml: number) => {
      if (!user || !state.water.habit) return;
      const next = state.water.todayMl + ml;
      setState((prev) => ({ ...prev, water: { ...prev.water, todayMl: next } }));
      await setDayMetric(user.id, state.water.habit, todayKey(), next);
      void load();
    },
    [user, state.water, load],
  );

  /** Promotes a logged meal into a reusable saved product (§12). */
  const saveAsFood = useCallback(
    async (input: FoodItemInput): Promise<FoodItem | undefined> => {
      if (!user) return undefined;

      const existing = state.foods.find((food) => foodKey(food.name) === foodKey(input.name));
      if (existing) {
        const nextFavorite = input.favorite === true ? true : existing.favorite;
        const nextBarcode = existing.barcode || input.barcode || null;
        if (nextFavorite !== existing.favorite || nextBarcode !== existing.barcode) {
          await updateFoodItem(user.id, existing.id, {
            name: existing.name,
            brand: existing.brand,
            servingLabel: existing.servingLabel,
            servingG: existing.servingG,
            macros: existing.macros,
            dataQuality: existing.dataQuality,
            barcode: nextBarcode,
            favorite: nextFavorite,
          });
          void load();
          return { ...existing, favorite: nextFavorite, barcode: nextBarcode };
        }
        return existing;
      }

      const saved = await createFoodItem(user.id, { ...input, favorite: input.favorite ?? true });
      void load();
      return saved;
    },
    [user, state.foods, load],
  );

  const setFavorite = useCallback(
    async (foodId: string, favorite: boolean) => {
      if (!user) return;
      setState((prev) => ({
        ...prev,
        foods: prev.foods.map((f) => (f.id === foodId ? { ...f, favorite } : f)),
      }));
      await toggleFoodFavorite(user.id, foodId, favorite);
      void load();
    },
    [user, load],
  );

  const favorites = useMemo(
    () => state.foods.filter((f) => f.favorite).slice(0, 12),
    [state.foods],
  );

  const saveRecipe = useCallback(
    async (input: RecipeInput, recipeId?: string) => {
      if (!user) return;
      if (recipeId) await updateRecipe(user.id, recipeId, input);
      else await createRecipe(user.id, input);
      await load();
    },
    [user, load],
  );

  const removeRecipe = useCallback(
    async (recipeId: string) => {
      if (!user) return;
      setState((prev) => ({ ...prev, recipes: prev.recipes.filter((recipe) => recipe.id !== recipeId) }));
      await deleteRecipe(user.id, recipeId);
      await load();
    },
    [user, load],
  );

  /** Logs one or more portions of a recipe and counts the recipe as used. */
  const logRecipeServings = useCallback(
    async (recipe: Recipe, servings: number) => {
      if (!user) return;
      await addMeal({
        name: servings === 1 ? recipe.name : `${servings} ${recipe.servingLabel} ${recipe.name}`,
        macros: macrosForServings(recipe, servings),
        dataQuality: 'verified',
        servings,
        servingLabel: recipe.servingLabel,
        source: 'recipe',
        recipeId: recipe.id,
      });
      void markRecipeUsed(user.id, recipe.id, recipe.useCount).catch(() => undefined);
    },
    [user, addMeal],
  );

  return {
    state,
    favorites,
    addMeal,
    removeMeal,
    editMeal,
    addWater,
    saveAsFood,
    setFavorite,
    saveRecipe,
    removeRecipe,
    logRecipeServings,
    reload: load,
  };
}

function totalsOf(meals: readonly MealEntry[]): Macros {
  return sumMacros(meals.map((m) => ({ kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG })));
}
