'use client';

import { useMemo, useState } from 'react';
import {
  Utensils, Droplets, Plus, Star, Box, ChefHat, Pencil, Trash2,
} from 'lucide-react';
import { useNutrition } from '@/web/hooks/useNutrition';
import { RangeBar, GoalBar } from '@/web/components/RangeBar';
import { QuickTextInput } from '@/web/components/QuickTextInput';
import { QuickAddSheet } from '@/web/components/QuickAddSheet';
import { RecipeSheet } from '@/web/components/RecipeSheet';
import { DailyTimeline, mealToEvent, type TimelineEvent } from '@/web/components/DailyTimeline';
import { evaluateRange, evaluateGoal, TONE_COLOR } from '@/domain/goalPhase';
import { isDayInProgress, formatLiters } from '@/domain/dayEvaluation';
import {
  MEAL_SLOTS, MEAL_SLOT_LABEL, MEAL_SLOT_ICON, sumMacros,
} from '@/domain/nutritionMath';
import type { MealEntryInput } from '@/data/nutrition';
import type { MealSlot, Recipe } from '@/domain/types';

const WATER_STEPS = [250, 500, 750];

/** How much of a recipe gets logged with one tap. */
const RECIPE_PORTIONS = [
  { factor: 1, label: '1 Portion' },
  { factor: 0.5, label: '½' },
  { factor: 2, label: '2' },
];

export function NutritionView() {
  const {
    state, favorites, addMeal, removeMeal, addWater, saveAsFood, setFavorite,
    saveRecipe, removeRecipe, logRecipeServings,
  } = useNutrition();
  const [sheetOpen, setSheetOpen] = useState(false);
  /** null = closed, { recipe: null } = new, { recipe } = editing. */
  const [recipeSheet, setRecipeSheet] = useState<{ recipe: Recipe | null } | null>(null);

  const meals = state.meals;
  const bySlot = useMemo(() => {
    const map = new Map<MealSlot | 'other', typeof meals>();
    for (const meal of meals) {
      const key = meal.slot ?? 'other';
      map.set(key, [...(map.get(key) ?? []), meal]);
    }
    return map;
  }, [meals]);

  if (state.loading) {
    return <div className="panel"><p className="copy">Ernährung wird geladen …</p></div>;
  }
  if (state.error) {
    return <div className="panel"><p className="copy" style={{ color: 'var(--danger)' }}>{state.error}</p></div>;
  }

  const { targets, totals } = state;
  const inProgress = isDayInProgress(new Date().getHours());
  const kcalEval = evaluateRange(totals.kcal, targets.calories, { dayInProgress: inProgress });
  const proteinEval = evaluateRange(totals.proteinG, targets.protein, { dayInProgress: inProgress, overTolerance: 9999 });
  const waterEval = evaluateGoal(state.water.todayMl, state.water.goalMl, inProgress);


  /** Resolve library references to their stored macros before saving. */
  function handleEntry(entry: MealEntryInput) {
    if (entry.foodItemId) {
      const food = state.foods.find((f) => f.id === entry.foodItemId);
      if (food) {
        const servings = entry.servings ?? 1;
        void addMeal({
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
    void addMeal(entry);
  }

  return (
    <>
      {/* ── Today's totals — range first, single number never (§14) ──── */}
      <section className="panel">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div>
            <p className="section-label">Ernährung heute</p>
            <p className="h2" style={{ marginTop: 4, fontSize: 19 }}>
              {state.quality === 'verified' ? '' : '~'}
              {Math.round(totals.kcal).toLocaleString('de-DE')} kcal
            </p>
          </div>
          <span className="pill" style={{ flexShrink: 0, color: TONE_COLOR[kcalEval.tone] }}>
            {kcalEval.status === 'in' ? 'im Zielbereich'
              : kcalEval.status === 'over' ? 'deutlich darüber'
              : kcalEval.status === 'slightly_over' ? 'leicht darüber'
              : 'noch darunter'}
          </span>
        </div>

        <div className="stack">
          <div className="stack-sm">
            <div className="row-between">
              <span className="muted-sm">Kalorien</span>
              <span className="readout-target">
                Ziel {targets.calories.min.toLocaleString('de-DE')}–{targets.calories.max.toLocaleString('de-DE')}
              </span>
            </div>
            <RangeBar value={totals.kcal} range={targets.calories} tone={kcalEval.tone} />
          </div>

          {/* Protein gets top billing for this phase (§15) */}
          <div className="stack-sm">
            <div className="row-between">
              <span className="readout">
                <span className="readout-value" style={{ fontSize: 24, color: TONE_COLOR[proteinEval.tone] }}>
                  {Math.round(totals.proteinG)}
                </span>
                <span className="readout-unit">/ {targets.protein.min}–{targets.protein.max} g Protein</span>
              </span>
            </div>
            <RangeBar value={totals.proteinG} range={targets.protein} tone={proteinEval.tone} />
          </div>

          <div className="split-3">
            <MacroChip label="Kohlenhydrate" value={totals.carbsG} />
            <MacroChip label="Fett" value={totals.fatG} />
            <MacroChip label="Ø Woche" value={state.weekly.avgKcal ?? 0} unit="kcal" muted />
          </div>
        </div>

        {state.quality !== 'verified' && (
          <p className="muted-sm" style={{ marginTop: 12 }}>
            Enthält geschätzte Werte — die Tagessumme ist deshalb ein Richtwert.
          </p>
        )}
      </section>


      {/* ── Input ─────────────────────────────────────────────────────── */}
      <section className="stack-sm">
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="button" style={{ flex: 1 }} onClick={() => setSheetOpen(true)}>
            <Plus size={17} /> Mahlzeit eintragen
          </button>
        </div>
        <QuickTextInput
          onAdd={handleEntry}
          compact
          library={[
            ...state.foods.map((f) => ({ id: f.id, kind: 'food' as const, name: f.name })),
          ]}
        />
      </section>

      {/* ── Favourites (§37) ──────────────────────────────────────────── */}
      {favorites.length > 0 && (
        <section className="panel soft">
          <div className="section-head">
            <p className="h3" style={{ fontSize: 15 }}>Favoriten</p>
          </div>
          <div className="chip-row">
            {favorites.map((food) => (
              <button
                key={food.id}
                type="button"
                className="chip"
                onClick={() => handleEntry({
                  name: food.name,
                  macros: food.macros,
                  dataQuality: food.dataQuality,
                  foodItemId: food.id,
                  source: 'favorite',
                })}
              >
                {food.favorite && <Star size={12} color="var(--gold)" />}
                {food.name}
                <span className="chip-meta">{Math.round(food.macros.kcal)} kcal</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Recipes: one portion, real numbers ───────────────────────── */}
      <section className="panel soft">
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChefHat size={15} color="var(--violet)" />
            <p className="h3" style={{ fontSize: 15 }}>Rezepte</p>
          </div>
          <button type="button" className="button ghost compact" onClick={() => setRecipeSheet({ recipe: null })}>
            <Plus size={14} /> Neu
          </button>
        </div>

        {state.recipes.length === 0 ? (
          <div className="empty-state">
            <p className="copy" style={{ margin: 0 }}>Noch keine Rezepte.</p>
            <p className="muted-sm">
              Leg dein Standardgericht einmal an — danach reicht „1 Portion“ und die Werte stimmen.
            </p>
            <button
              type="button"
              className="button compact"
              style={{ marginTop: 8 }}
              onClick={() => setRecipeSheet({ recipe: null })}
            >
              <Plus size={15} /> Erstes Rezept anlegen
            </button>
          </div>
        ) : (
          <div className="stack-sm">
            {state.recipes.map((recipe) => (
              <div key={recipe.id} className="panel" style={{ padding: 10 }}>
                <div className="row-between" style={{ gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="h3" style={{ fontSize: 14 }}>{recipe.name}</p>
                    <p className="muted-sm">
                      {Math.round(recipe.perServing.kcal)} kcal · {Math.round(recipe.perServing.proteinG)} g Protein
                      {' '}pro {recipe.servingLabel}
                    </p>
                    <p className="muted-sm">
                      {recipe.ingredients.length} Zutaten · ergibt {recipe.totalServings} {recipe.servingLabel}
                      {recipe.totalServings === 1 ? '' : 'en'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setRecipeSheet({ recipe })}
                      aria-label={`${recipe.name} bearbeiten`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => {
                        if (confirm(`„${recipe.name}“ löschen?`)) void removeRecipe(recipe.id);
                      }}
                      aria-label={`${recipe.name} löschen`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="chip-row" style={{ marginTop: 8 }}>
                  {RECIPE_PORTIONS.map(({ factor, label }) => (
                    <button
                      key={factor}
                      type="button"
                      className="chip"
                      onClick={() => void logRecipeServings(recipe, factor)}
                    >
                      <Plus size={13} /> {label}
                      <span className="chip-meta">
                        {Math.round(recipe.perServing.kcal * factor)} kcal
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Meals by slot (§14) ───────────────────────────────────────── */}
      <section className="panel">
        <div className="section-head">
          <p className="h3" style={{ fontSize: 15 }}>Mahlzeiten</p>
          <span className="muted-sm">{state.meals.length} Einträge</span>
        </div>

        {state.meals.length === 0 ? (
          <div className="empty-state">
            <p className="copy" style={{ margin: 0 }}>Noch keine Mahlzeit heute.</p>
            <button type="button" className="button compact" style={{ marginTop: 8 }} onClick={() => setSheetOpen(true)}>
              <Plus size={15} /> Erste Mahlzeit eintragen
            </button>
          </div>
        ) : (
          <div className="stack">
            {MEAL_SLOTS.map((slot) => {
              const meals = bySlot.get(slot) ?? [];
              if (meals.length === 0) return null;
              const slotTotals = sumMacros(meals.map((m) => ({ kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG })));
              const events: TimelineEvent[] = meals.map((meal) =>
                mealToEvent(meal, {
                  onDelete: () => void removeMeal(meal.id),
                  // Already-saved products have nothing to promote.
                  ...(meal.foodItemId
                    ? {}
                    : {
                        onFavorite: () =>
                          void saveAsFood({
                            name: meal.name,
                            macros: { kcal: meal.kcal, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG },
                            dataQuality: meal.dataQuality,
                            favorite: true,
                          }),
                      }),
                }),
              );

              return (
                <div key={slot}>
                  <div className="row-between" style={{ marginBottom: 2 }}>
                    <p className="section-label">{MEAL_SLOT_ICON[slot]} {MEAL_SLOT_LABEL[slot]}</p>
                    <span className="muted-sm">
                      {Math.round(slotTotals.kcal)} kcal · {Math.round(slotTotals.proteinG)} g P
                    </span>
                  </div>
                  <DailyTimeline events={events} />
                </div>
              );
            })}

            {(bySlot.get('other') ?? []).length > 0 && (
              <div>
                <p className="section-label">Ohne Zuordnung</p>
                <DailyTimeline
                  events={(bySlot.get('other') ?? []).map((meal) =>
                    mealToEvent(meal, { onDelete: () => void removeMeal(meal.id) }),
                  )}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Water (§38) ───────────────────────────────────────────────── */}
      <section className="panel soft">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Droplets size={15} color="var(--teal)" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Wasser</span>
          </div>
          <span className="muted-sm">
            {formatLiters(state.water.todayMl)} / {formatLiters(state.water.goalMl)}
          </span>
        </div>
        <GoalBar value={state.water.todayMl} goal={state.water.goalMl} tone={waterEval.tone} />
        <div className="chip-row" style={{ marginTop: 10 }}>
          {WATER_STEPS.map((ml) => (
            <button key={ml} type="button" className="chip" onClick={() => void addWater(ml)}>
              <Plus size={13} /> {ml} ml
            </button>
          ))}
        </div>
      </section>

      {recipeSheet && (
        <RecipeSheet
          recipe={recipeSheet.recipe}
          allFoods={state.foods}
          onClose={() => setRecipeSheet(null)}
          onSave={saveRecipe}
        />
      )}

      {sheetOpen && (
        <QuickAddSheet
          onClose={() => setSheetOpen(false)}
          favoriteFoods={favorites}
          allFoods={state.foods}
          recipes={state.recipes}
          recentMeals={state.recentMeals}
          currentWater={state.water.todayMl}
          currentSteps={0}
          currentSleep={0}
          currentWeight={state.goals.currentWeight}
          handlers={{
            onAddEntry: handleEntry,
            onSaveFood: saveAsFood,
            onSetFavorite: setFavorite,
            onAddWater: addWater,
            onSetSteps: () => {},
            onSetSleep: () => {},
            onSaveWeight: () => {},
          }}
        />
      )}

    </>
  );
}

function MacroChip({ label, value, unit = 'g', muted }: { label: string; value: number; unit?: string; muted?: boolean }) {
  return (
    <div className="metric-card">
      <span className="metric-value" style={{ fontSize: 18, color: muted ? 'var(--muted)' : 'var(--text)' }}>
        {Math.round(value).toLocaleString('de-DE')}
        <span style={{ fontSize: 12, color: 'var(--subtle)' }}> {unit}</span>
      </span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
