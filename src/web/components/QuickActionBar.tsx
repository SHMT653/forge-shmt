'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { QuickAddSheet } from './QuickAddSheet';
import { useTodayContext } from '@/web/hooks/TodayDataProvider';
import { macrosForServings } from '@/domain/nutritionMath';
import { saveBodyMetric } from '@/data/progress';
import { startMiniSession } from '@/data/workouts';
import { suggestMiniSession } from '@/domain/miniSessions';
import { useAuth } from '@/web/hooks/useAuth';
import { todayKey } from '@/domain/dates';
import type { MealEntryInput } from '@/data/nutrition';

/**
 * The two things that must be reachable from every screen (§ "möglichst
 * schnell viel eintragen"): logging something, from anywhere in the app.
 *
 * Rendered by the app shell rather than by each view, so the position never
 * shifts and no screen has to remember to include it.
 */
export function QuickActionBar() {
  const { user } = useAuth();
  const { data, addEntry, addWater, setMetric, saveFood, startSuggestedWorkout, reload } = useTodayContext();
  const [addOpen, setAddOpen] = useState(false);

  // Until the day's data is loaded there is nothing to add against; the button
  // button still works, because its context is built server-side.
  const ready = data !== null && Boolean(data.goals.onboardedAt);

  function handleEntry(entry: MealEntryInput) {
    if (!data) return;
    if (entry.recipeId) {
      const recipe = data.allRecipes.find((r) => r.id === entry.recipeId);
      if (recipe) {
        void addEntry({ ...entry, macros: macrosForServings(recipe, entry.servings ?? 1), dataQuality: 'verified' });
        return;
      }
    }
    if (entry.foodItemId) {
      const food = data.allFoods.find((f) => f.id === entry.foodItemId);
      if (food) {
        const servings = entry.servings ?? 1;
        void addEntry({
          ...entry,
          macros: {
            kcal: Math.round(food.macros.kcal * servings),
            proteinG: Math.round(food.macros.proteinG * servings),
            carbsG: Math.round(food.macros.carbsG * servings),
            fatG: Math.round(food.macros.fatG * servings),
          },
          dataQuality: food.dataQuality,
        });
        return;
      }
    }
    void addEntry(entry);
  }

  async function handleWeight(kg: number) {
    if (!user) return;
    await saveBodyMetric(user.id, todayKey(), { weightKg: kg, waistCm: null, chestCm: null, armsCm: null });
    await reload();
  }

  async function handleMini() {
    if (!user || !data) return;
    const session = suggestMiniSession(data.goals.equipment);
    const id = await startMiniSession(user.id, session.name, session.exercises);
    window.location.href = `/workout/${id}`;
  }

  async function handleWorkout() {
    const id = await startSuggestedWorkout();
    if (id) window.location.href = `/workout/${id}`;
  }

  return (
    <>
      {/* One button now. It used to be a pair — quick-add beside a coach that
          needed an API key nobody had — so the useful half was the small one. */}
      {ready && (
        <button
          type="button"
          className="fab"
          onClick={() => setAddOpen(true)}
          aria-label="Schnell eintragen"
        >
          <Plus size={24} />
        </button>
      )}

      {addOpen && data && (
        <QuickAddSheet
          onClose={() => setAddOpen(false)}
          favoriteFoods={data.favoriteFoods}
          favoriteRecipes={data.favoriteRecipes}
          allFoods={data.allFoods}
          allRecipes={data.allRecipes}
          recentMeals={data.recentMeals}
          batches={data.batches}
          currentWater={data.metrics.waterMl}
          currentSteps={data.metrics.steps}
          currentSleep={data.metrics.sleepH}
          currentWeight={data.weight.latest}
          handlers={{
            onAddEntry: handleEntry,
            onSaveFood: saveFood,
            onAddWater: addWater,
            onSetSteps: (steps) => setMetric('steps', steps),
            onSetSleep: (hours) => setMetric('sleep', hours),
            onSaveWeight: handleWeight,
            onStartWorkout: handleWorkout,
            onStartMini: handleMini,
          }}
        />
      )}
    </>
  );
}
