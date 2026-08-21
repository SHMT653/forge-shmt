'use client';

import { useMemo, useState } from 'react';
import { Utensils, Droplets, Footprints, Moon, Scale, Dumbbell, Search, Sparkles, Box, Plus, Check } from 'lucide-react';
import { Sheet } from './Sheet';
import { AiQuickInput } from './AiQuickInput';
import { searchFood, estimateMacros, type FoodItem as StaticFood } from '@/domain/foodDatabase';
import { macrosForServings, MEAL_SLOT_ICON, roundMacros, scaleMacros, slotForHour } from '@/domain/nutritionMath';
import { formatLiters, formatHours } from '@/domain/coach';
import type { MealEntryInput } from '@/data/nutrition';
import type { FoodItem, MealPrepBatch, Recipe } from '@/domain/types';

type Mode = 'food' | 'water' | 'steps' | 'sleep' | 'weight' | 'training';

const WATER_STEPS = [250, 500, 750];
const SLEEP_OPTIONS = [7, 7.5, 8, 8.5, 9, 9.5, 10];

export type QuickAddHandlers = {
  onAddEntry: (entry: MealEntryInput) => Promise<void> | void;
  onAddWater: (ml: number) => Promise<void> | void;
  onSetSteps: (steps: number) => Promise<void> | void;
  onSetSleep: (hours: number) => Promise<void> | void;
  onSaveWeight: (kg: number) => Promise<void> | void;
  onStartWorkout?: () => void;
  onStartMini?: () => void;
};

export function QuickAddSheet({
  onClose,
  favoriteFoods,
  favoriteRecipes,
  batches,
  currentWater,
  currentSteps,
  currentSleep,
  currentWeight,
  aiEnabled,
  handlers,
}: {
  onClose: () => void;
  favoriteFoods: readonly FoodItem[];
  favoriteRecipes: readonly Recipe[];
  batches: readonly MealPrepBatch[];
  currentWater: number;
  currentSteps: number;
  currentSleep: number;
  currentWeight: number | null;
  aiEnabled: boolean;
  handlers: QuickAddHandlers;
}) {
  const [mode, setMode] = useState<Mode>('food');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void> | void, keepOpen = false) {
    setBusy(true);
    try {
      await action();
      if (!keepOpen) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Eintragen" onClose={onClose}>
      {/* Mode switcher */}
      <div className="tile-grid">
        <ModeTile icon={<Utensils size={19} />} label="Essen" active={mode === 'food'} onClick={() => setMode('food')} />
        <ModeTile icon={<Droplets size={19} />} label="Wasser" active={mode === 'water'} onClick={() => setMode('water')} />
        <ModeTile icon={<Footprints size={19} />} label="Schritte" active={mode === 'steps'} onClick={() => setMode('steps')} />
        <ModeTile icon={<Moon size={19} />} label="Schlaf" active={mode === 'sleep'} onClick={() => setMode('sleep')} />
        <ModeTile icon={<Scale size={19} />} label="Gewicht" active={mode === 'weight'} onClick={() => setMode('weight')} />
        <ModeTile icon={<Dumbbell size={19} />} label="Training" active={mode === 'training'} onClick={() => setMode('training')} />
      </div>

      {mode === 'food' && (
        <FoodPanel
          favoriteFoods={favoriteFoods}
          favoriteRecipes={favoriteRecipes}
          batches={batches}
          aiEnabled={aiEnabled}
          busy={busy}
          onAdd={(entry, keepOpen) => run(() => handlers.onAddEntry(entry), keepOpen)}
        />
      )}

      {mode === 'water' && (
        <div className="stack">
          <div className="row-between">
            <span className="readout-value">{formatLiters(currentWater)}</span>
            <span className="readout-target">heute getrunken</span>
          </div>
          <div className="chip-row">
            {WATER_STEPS.map((ml) => (
              <button key={ml} type="button" className="chip" disabled={busy} onClick={() => run(() => handlers.onAddWater(ml), true)}>
                <Plus size={14} /> {ml} ml
              </button>
            ))}
          </div>
          <p className="muted-sm">Gläser sind unterschiedlich groß — deshalb Milliliter statt „1 Glas“.</p>
        </div>
      )}

      {mode === 'steps' && (
        <NumberPanel
          label="Schritte heute"
          initial={currentSteps > 0 ? String(Math.round(currentSteps)) : ''}
          placeholder="7000"
          unit="Schritte"
          busy={busy}
          onSubmit={(value) => run(() => handlers.onSetSteps(value))}
        />
      )}

      {mode === 'sleep' && (
        <div className="stack">
          <p className="muted-sm">Letzte Nacht: {currentSleep > 0 ? formatHours(currentSleep) : 'noch nichts eingetragen'}</p>
          <div className="chip-row">
            {SLEEP_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                className={`chip${currentSleep === h ? ' active' : ''}`}
                disabled={busy}
                onClick={() => run(() => handlers.onSetSleep(h))}
              >
                {formatHours(h)}
              </button>
            ))}
          </div>
          <NumberPanel
            label="Anderer Wert"
            initial=""
            placeholder="8.25"
            unit="Stunden"
            decimal
            busy={busy}
            onSubmit={(value) => run(() => handlers.onSetSleep(value))}
          />
        </div>
      )}

      {mode === 'weight' && (
        <NumberPanel
          label="Gewicht"
          initial={currentWeight !== null ? String(currentWeight) : ''}
          placeholder="73.2"
          unit="kg"
          decimal
          busy={busy}
          onSubmit={(value) => run(() => handlers.onSaveWeight(value))}
          hint="Am aussagekräftigsten: morgens, nach der Toilette, vor dem Essen."
        />
      )}

      {mode === 'training' && (
        <div className="stack">
          <button type="button" className="button block" onClick={() => { onClose(); handlers.onStartWorkout?.(); }} disabled={!handlers.onStartWorkout}>
            <Dumbbell size={16} /> Geplantes Training starten
          </button>
          <button type="button" className="button secondary block" onClick={() => { onClose(); handlers.onStartMini?.(); }} disabled={!handlers.onStartMini}>
            <Sparkles size={16} /> Mini-Session (5–8 Min)
          </button>
          <p className="muted-sm">
            Eine Mini-Session zählt als Aktivität, nicht als volles Workout — aber sie zählt.
          </p>
        </div>
      )}
    </Sheet>
  );
}

function ModeTile({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`tile${active ? ' active' : ''}`} onClick={onClick} style={active ? { borderColor: 'rgba(139,92,246,0.45)', background: 'var(--violet-soft)', color: 'var(--violet)' } : undefined}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Food ────────────────────────────────────────────────────────────────────

function FoodPanel({
  favoriteFoods,
  favoriteRecipes,
  batches,
  aiEnabled,
  busy,
  onAdd,
}: {
  favoriteFoods: readonly FoodItem[];
  favoriteRecipes: readonly Recipe[];
  batches: readonly MealPrepBatch[];
  aiEnabled: boolean;
  busy: boolean;
  onAdd: (entry: MealEntryInput, keepOpen?: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualName, setManualName] = useState('');

  const staticResults = useMemo(() => (query.trim().length >= 2 ? searchFood(query).slice(0, 8) : []), [query]);
  const ownResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return favoriteFoods.filter((f) => f.name.toLowerCase().includes(needle)).slice(0, 6);
  }, [query, favoriteFoods]);
  const recipeResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return favoriteRecipes.slice(0, 4);
    return favoriteRecipes.filter((r) => r.name.toLowerCase().includes(needle)).slice(0, 5);
  }, [query, favoriteRecipes]);

  const slot = slotForHour(new Date().getHours());

  function addOwnFood(food: FoodItem) {
    onAdd({
      name: food.name,
      macros: food.macros,
      dataQuality: food.dataQuality,
      foodItemId: food.id,
      source: 'favorite',
      slot,
    }, true);
  }

  function addStaticFood(food: StaticFood) {
    const { carbsG, fatG } = estimateMacros(food);
    onAdd({
      name: food.name,
      macros: { kcal: food.kcal, proteinG: food.proteinG, carbsG, fatG },
      // The built-in table is a reference average, not a measured value.
      dataQuality: 'estimated',
      source: 'search',
      slot,
    }, true);
  }

  function addRecipe(recipe: Recipe, servings: number) {
    onAdd({
      name: `${recipe.name}${servings !== 1 ? ` (${servings} ${recipe.servingLabel})` : ''}`,
      macros: macrosForServings(recipe, servings),
      dataQuality: 'verified',
      recipeId: recipe.id,
      servings,
      source: 'recipe',
      slot,
    }, true);
  }

  function addBatch(batch: MealPrepBatch, recipe: Recipe | undefined) {
    if (!recipe) return;
    onAdd({
      name: `${batch.recipeName} (Meal Prep)`,
      macros: macrosForServings(recipe, 1),
      dataQuality: 'verified',
      recipeId: recipe.id,
      batchId: batch.id,
      servings: 1,
      source: 'prep',
      slot,
    }, true);
  }

  function submitManual() {
    const kcal = Number(manualKcal) || 0;
    const proteinG = Number(manualProtein) || 0;
    if (!kcal && !proteinG) return;
    const remaining = Math.max(0, kcal - proteinG * 4);
    onAdd({
      name: manualName.trim() || `${kcal} kcal`,
      macros: {
        kcal,
        proteinG,
        carbsG: Math.round((remaining * 0.62) / 4),
        fatG: Math.round((remaining * 0.38) / 9),
      },
      // The user typed these numbers, so kcal/protein are trusted; the
      // carb/fat split is inferred, which the nutrition screen makes clear.
      dataQuality: 'verified',
      source: 'manual',
      slot,
    });
  }

  return (
    <div className="stack">
      {aiEnabled && <AiQuickInput onAdd={(entry) => onAdd(entry, true)} />}

      {/* Meal prep batches first — they are time-sensitive */}
      {batches.length > 0 && (
        <div className="stack-sm">
          <p className="section-label">Meal Prep</p>
          <div className="chip-row">
            {batches.map((batch) => {
              const recipe = favoriteRecipes.find((r) => r.id === batch.recipeId);
              return (
                <button
                  key={batch.id}
                  type="button"
                  className="chip"
                  disabled={busy || !recipe}
                  onClick={() => addBatch(batch, recipe)}
                  title={recipe ? undefined : 'Rezept nicht in den Favoriten geladen'}
                >
                  <Box size={14} />
                  {batch.recipeName}
                  <span className="chip-meta">{batch.portionsLeft} / {batch.totalPortions}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorites — one tap (§37) */}
      {favoriteFoods.length > 0 && (
        <div className="stack-sm">
          <p className="section-label">Favoriten</p>
          <div className="chip-row">
            {favoriteFoods.slice(0, 8).map((food) => (
              <button key={food.id} type="button" className="chip" disabled={busy} onClick={() => addOwnFood(food)}>
                {food.name}
                <span className="chip-meta">{Math.round(food.macros.kcal)} kcal · {Math.round(food.macros.proteinG)} P</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="field">
        <div className="search-field" style={{ width: '100%' }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Lebensmittel oder Rezept suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Lebensmittel suchen"
            autoComplete="off"
          />
        </div>
      </div>

      {(ownResults.length > 0 || recipeResults.length > 0 || staticResults.length > 0) && (
        <div className="stack-sm">
          {ownResults.map((food) => (
            <ResultRow
              key={food.id}
              title={food.name}
              meta={`${Math.round(food.macros.kcal)} kcal · ${Math.round(food.macros.proteinG)} g P · eigenes Produkt`}
              onClick={() => addOwnFood(food)}
              disabled={busy}
            />
          ))}
          {recipeResults.map((recipe) => (
            <RecipeRow key={recipe.id} recipe={recipe} disabled={busy} onAdd={(servings) => addRecipe(recipe, servings)} />
          ))}
          {staticResults.map((food) => (
            <ResultRow
              key={food.name}
              title={food.name}
              meta={`~${food.kcal} kcal · ${food.proteinG} g P · ${food.portionLabel}`}
              estimated
              onClick={() => addStaticFood(food)}
              disabled={busy}
            />
          ))}
        </div>
      )}

      {/* Manual */}
      <details>
        <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 13, fontWeight: 700, padding: '4px 0' }}>
          Manuell eintragen
        </summary>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          <input
            className="input"
            placeholder="Bezeichnung (optional)"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            aria-label="Bezeichnung"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="input" inputMode="numeric" placeholder="kcal" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} aria-label="Kalorien" />
            <input className="input" inputMode="numeric" placeholder="Protein g" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} aria-label="Protein" />
          </div>
          <button type="button" className="button block" disabled={busy || (!manualKcal && !manualProtein)} onClick={submitManual}>
            <Check size={16} /> Hinzufügen
          </button>
        </div>
      </details>
    </div>
  );
}

function ResultRow({
  title,
  meta,
  estimated,
  onClick,
  disabled,
}: {
  title: string;
  meta: string;
  estimated?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="habit-row"
      onClick={onClick}
      disabled={disabled}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
    >
      <div className="habit-body">
        <p className="h3" style={{ fontSize: 14 }}>
          {title}
          {estimated && <span className="quality-badge estimated" style={{ marginLeft: 6 }}>geschätzt</span>}
        </p>
        <p className="muted-sm">{meta}</p>
      </div>
      <span className="icon-button" aria-hidden><Plus size={16} /></span>
    </button>
  );
}

/** Recipes can be logged in fractional portions (§12). */
function RecipeRow({ recipe, onAdd, disabled }: { recipe: Recipe; onAdd: (servings: number) => void; disabled?: boolean }) {
  const per = recipe.perServing;
  return (
    <div className="habit-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div className="row-between">
        <div style={{ minWidth: 0 }}>
          <p className="h3" style={{ fontSize: 14 }}>{MEAL_SLOT_ICON.lunch} {recipe.name}</p>
          <p className="muted-sm">
            {Math.round(per.kcal)} kcal · {Math.round(per.proteinG)} g P pro {recipe.servingLabel}
          </p>
        </div>
      </div>
      <div className="chip-row">
        {[0.5, 1, 1.5, 2].map((servings) => (
          <button key={servings} type="button" className="chip" disabled={disabled} onClick={() => onAdd(servings)}>
            {servings.toLocaleString('de-DE')} {recipe.servingLabel}
            <span className="chip-meta">{Math.round(roundMacros(scaleMacros(per, servings)).kcal)} kcal</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Generic numeric entry ───────────────────────────────────────────────────

function NumberPanel({
  label,
  initial,
  placeholder,
  unit,
  decimal,
  busy,
  hint,
  onSubmit,
}: {
  label: string;
  initial: string;
  placeholder: string;
  unit: string;
  decimal?: boolean;
  busy: boolean;
  hint?: string;
  onSubmit: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  const parsed = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(parsed);
      }}
    >
      <div className="field">
        <label className="field-label">{label}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            inputMode={decimal ? 'decimal' : 'numeric'}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <span className="readout-unit" style={{ flex: '0 0 auto' }}>{unit}</span>
        </div>
      </div>
      {hint && <p className="muted-sm">{hint}</p>}
      <button type="submit" className="button block" disabled={busy || !valid}>
        <Check size={16} /> Speichern
      </button>
    </form>
  );
}
