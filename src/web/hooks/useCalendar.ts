'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { loadDayAggregates, loadDayDetail, type DayDetail } from '@/data/overview';
import { getUserGoals } from '@/data/profile';
import { getActivePhase } from '@/data/goalPhases';
import { addMealEntry, deleteMealEntry, syncNutritionTotals, type MealEntryInput } from '@/data/nutrition';
import { rememberFoodFromEntry } from '@/data/foodLibrary';
import { setHealthMetric } from '@/data/dailyHealth';
import { saveBodyMetric } from '@/data/progress';
import { saveCheckin } from '@/data/checkins';
import { errorMessage } from '@/domain/errors';
import { dateKeyAddDays, toDateKey, todayKey } from '@/domain/dates';
import { resolveTargets, type ResolvedTargets } from '@/domain/goalPhase';
import { isDayInProgress } from '@/domain/dayEvaluation';
import { rateDay, summarizeRatings, type DayRating } from '@/domain/dayRating';
import type { Habit, Soreness, UserGoals } from '@/domain/types';
import { pickMetricHabits, setDayMetric } from '@/data/dailyMetrics';
import { listHabits } from '@/data/habits';
import { fluidFromEntry } from '@/domain/fluids';

/** Grid bounds for a month view: whole weeks, Monday first. */
export function monthGrid(anchor: string): { start: string; end: string; days: string[] } {
  const [y, m] = anchor.split('-').map(Number);
  const first = new Date(y ?? 2026, (m ?? 1) - 1, 1);
  const last = new Date(y ?? 2026, m ?? 1, 0);

  const leading = (first.getDay() + 6) % 7; // Monday = 0
  const trailing = 6 - ((last.getDay() + 6) % 7);

  const start = toDateKey(new Date(first.getFullYear(), first.getMonth(), 1 - leading));
  const total = leading + last.getDate() + trailing;
  const days = Array.from({ length: total }, (_, i) => dateKeyAddDays(start, i));

  return { start, end: days[days.length - 1] ?? start, days };
}

export function useCalendar() {
  const { user } = useAuth();
  const [anchor, setAnchor] = useState(() => todayKey().slice(0, 7));
  const [ratings, setRatings] = useState<Map<string, DayRating>>(new Map());
  const [targets, setTargets] = useState<ResolvedTargets | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  // Held so a drink back-filled onto a past day credits that day's fluid.
  const [waterHabit, setWaterHabit] = useState<Habit | null>(null);
  const [waterByDate, setWaterByDate] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const grid = useMemo(() => monthGrid(`${anchor}-01`), [anchor]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [userGoals, phase, aggregates, habitList] = await Promise.all([
        getUserGoals(user.id),
        getActivePhase(user.id),
        loadDayAggregates(user.id, grid.start, grid.end),
        listHabits(user.id),
      ]);
      // Needed so a drink back-filled onto a past day credits that day's fluid.
      setWaterHabit(pickMetricHabits(habitList).water);
      setWaterByDate(new Map([...aggregates].map(([date, day]) => [date, day.waterMl ?? 0])));

      const effective: UserGoals = phase
        ? {
            ...userGoals,
            phaseType: phase.phaseType,
            caloriesMin: phase.caloriesMin ?? userGoals.caloriesMin,
            caloriesMax: phase.caloriesMax ?? userGoals.caloriesMax,
            proteinMin: phase.proteinMin ?? userGoals.proteinMin,
            proteinMax: phase.proteinMax ?? userGoals.proteinMax,
            stepsGoal: phase.stepsGoal ?? userGoals.stepsGoal,
            sleepGoalH: phase.sleepGoalH ?? userGoals.sleepGoalH,
            weeklyTrainingGoal: phase.weeklyTrainingGoal ?? userGoals.weeklyTrainingGoal,
          }
        : userGoals;

      const resolved = resolveTargets(effective);
      const rated = new Map<string, DayRating>();
      const today = todayKey();

      for (const date of grid.days) {
        // Future days stay blank rather than showing as a failed day.
        if (date > today) continue;
        const aggregate = aggregates.get(date) ?? {
          date, kcal: null, proteinG: null, steps: null, sleepH: null, waterMl: null,
          trained: false, miniSession: false,
        };
        // Today is scored as a day still running; every past day is finished.
        rated.set(date, rateDay(aggregate, resolved, {
          dayInProgress: date === today && isDayInProgress(new Date().getHours()),
        }));
      }

      setGoals(userGoals);
      setTargets(resolved);
      setRatings(rated);
    } catch (err) {
      setError(errorMessage(err, 'Kalender konnte nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user, grid.start, grid.end, grid.days]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeRatings([...ratings.values()]), [ratings]);

  const openDay = useCallback(
    async (date: string): Promise<DayDetail | null> => {
      if (!user) return null;
      return loadDayDetail(user.id, date);
    },
    [user],
  );

  // ── Backdated writes (§ "wenn ich was vergessen hab") ───────────────
  // Every repository already takes an explicit date, so correcting a past day
  // uses exactly the same paths as logging today.

  const addMealOn = useCallback(
    async (date: string, entry: MealEntryInput) => {
      if (!user) return;
      await addMealEntry(user.id, date, entry);
      // A meal typed while back-filling last Tuesday is just as worth
      // remembering as one typed today.
      await rememberFoodFromEntry(user.id, entry);

      // And a drink back-filled onto that day counts toward its fluid target.
      const fluid = fluidFromEntry({ name: entry.name, servings: entry.servings ?? null });
      if (fluid && waterHabit) {
        await setDayMetric(user.id, waterHabit, date, (waterByDate.get(date) ?? 0) + fluid.ml);
      }

      await syncNutritionTotals(user.id, date);
      await load();
    },
    [user, load, waterHabit, waterByDate],
  );

  const removeMealOn = useCallback(
    async (date: string, entryId: string) => {
      if (!user) return;
      await deleteMealEntry(user.id, entryId);
      await syncNutritionTotals(user.id, date);
      await load();
    },
    [user, load],
  );

  const setStepsOn = useCallback(
    async (date: string, steps: number) => {
      if (!user) return;
      await setHealthMetric(user.id, date, 'steps', Math.round(steps), 'manual');
      await load();
    },
    [user, load],
  );

  const setSleepOn = useCallback(
    async (date: string, hours: number) => {
      if (!user) return;
      await setHealthMetric(user.id, date, 'sleepMinutes', Math.round(hours * 60), 'manual');
      await load();
    },
    [user, load],
  );

  const setWeightOn = useCallback(
    async (date: string, kg: number) => {
      if (!user) return;
      await saveBodyMetric(user.id, date, { weightKg: kg, waistCm: null, chestCm: null, armsCm: null });
      await load();
    },
    [user, load],
  );

  const setSorenessOn = useCallback(
    async (date: string, soreness: Soreness | null) => {
      if (!user) return;
      await saveCheckin(user.id, date, { soreness });
      await load();
    },
    [user, load],
  );

  return {
    anchor,
    setAnchor,
    grid,
    ratings,
    targets,
    goals,
    summary,
    loading,
    error,
    reload: load,
    openDay,
    addMealOn,
    removeMealOn,
    setStepsOn,
    setSleepOn,
    setWeightOn,
    setSorenessOn,
  };
}
