'use client';

import { useMemo, useState } from 'react';
import { Utensils, Droplets, Footprints, Moon, Scale, Dumbbell, Search, Sparkles, Box, Plus, Check, X, Star } from 'lucide-react';
import { Sheet } from './Sheet';
import { AiQuickInput } from './AiQuickInput';
import { useFoodSearch } from '@/web/hooks/useFoodSearch';
import { scaleCandidate, type ScoredCandidate } from '@/domain/foodResolver';
import { macrosForServings, MEAL_SLOT_ICON, roundMacros, scaleMacros, slotForHour } from '@/domain/nutritionMath';
import { formatLiters, formatHours } from '@/domain/coach';
import type { MealEntry, MealEntryInput } from '@/data/nutrition';
import type { FoodItemInput } from '@/data/foodLibrary';
import type { FoodItem, MealPrepBatch, Recipe } from '@/domain/types';
import { parseDecimalOr } from '@/domain/numbers';

type Mode = 'food' | 'water' | 'steps' | 'sleep' | 'weight' | 'training';

const WATER_STEPS = [250, 500, 750];
const SLEEP_OPTIONS = [7, 7.5, 8, 8.5, 9, 9.5, 10];

export type QuickAddHandlers = {
  onAddEntry: (entry: MealEntryInput) => Promise<void> | void;
  /** Saves a discovered product into the user's own library (§12/§35). */
  onSaveFood?: (input: FoodItemInput) => Promise<void> | void;
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
  recentMeals = [],
  allFoods,
  allRecipes,
  handlers,
}: {
  onClose: () => void;
  favoriteFoods: readonly FoodItem[];
  favoriteRecipes: readonly Recipe[];
  batches: readonly MealPrepBatch[];
  recentMeals?: readonly MealEntry[];
  /** Full library for searching; the favourites above are only the chips. */
  allFoods?: readonly FoodItem[];
  allRecipes?: readonly Recipe[];
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
          recentMeals={recentMeals}
          allFoods={allFoods ?? favoriteFoods}
          allRecipes={allRecipes ?? favoriteRecipes}
          aiEnabled={aiEnabled}
          busy={busy}
          onAdd={(entry, keepOpen) => run(() => handlers.onAddEntry(entry), keepOpen)}
          {...(handlers.onSaveFood ? { onSaveFood: handlers.onSaveFood } : {})}
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
  recentMeals,
  allFoods,
  allRecipes,
  aiEnabled,
  busy,
  onAdd,
  onSaveFood,
}: {
  favoriteFoods: readonly FoodItem[];
  favoriteRecipes: readonly Recipe[];
  batches: readonly MealPrepBatch[];
  recentMeals: readonly MealEntry[];
  allFoods: readonly FoodItem[];
  allRecipes: readonly Recipe[];
  aiEnabled: boolean;
  busy: boolean;
  onAdd: (entry: MealEntryInput, keepOpen?: boolean) => void;
  onSaveFood?: (input: FoodItemInput) => Promise<void> | void;
}) {
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualName, setManualName] = useState('');
  const [selected, setSelected] = useState<ScoredCandidate | null>(null);

  const search = useFoodSearch({ foods: allFoods, recipes: allRecipes, recentMeals });
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

  /** Logs a search hit, and quietly files a discovered product for next time. */
  function addCandidate(candidate: ScoredCandidate, factor: number) {
    const macros = scaleCandidate(candidate, factor);

    onAdd({
      name: factor === 1 ? candidate.name : `${formatFactor(factor, candidate)} ${candidate.name}`,
      macros,
      dataQuality: candidate.dataQuality,
      servings: factor,
      source: candidate.source === 'library' ? 'favorite' : candidate.source === 'off' ? 'search' : 'search',
      ...(candidate.libraryKind === 'food' && candidate.libraryId ? { foodItemId: candidate.libraryId } : {}),
      ...(candidate.libraryKind === 'recipe' && candidate.libraryId ? { recipeId: candidate.libraryId } : {}),
      slot,
    }, true);

    // Anything found externally becomes part of the user's own library, so the
    // second time it is instant, offline, and matchable by the text parser.
    if (candidate.source === 'off' && onSaveFood) {
      void onSaveFood({
        name: candidate.name,
        brand: candidate.brand,
        servingLabel: candidate.portionLabel,
        servingG: candidate.portionG,
        macros: candidate.macros,
        dataQuality: candidate.dataQuality,
        favorite: false,
      });
    }

    setSelected(null);
    search.reset();
  }

  function submitManual() {
    const kcal = parseDecimalOr(manualKcal, 0);
    const proteinG = parseDecimalOr(manualProtein, 0);
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
    <div className="stack-sm">
      {aiEnabled && <AiQuickInput onAdd={(entry) => onAdd(entry, true)} />}

      {/* Meal prep batches first — they are time-sensitive */}
      {batches.length > 0 && (
        <div className="stack-sm">
          <p className="section-label">Meal Prep</p>
          <div className="chip-row">
            {batches.map((batch) => {
              const recipe = allRecipes.find((r) => r.id === batch.recipeId);
              return (
                <button
                  key={batch.id}
                  type="button"
                  className="chip"
                  disabled={busy || !recipe}
                  onClick={() => addBatch(batch, recipe)}
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

      {/* Favourites — one tap (§37) */}
      {favoriteFoods.length > 0 && !search.query && (
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

      {/* Search across library, recents, the curated table and Open Food Facts */}
      <div className="field">
        <div className="search-field" style={{ width: '100%' }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Lebensmittel, Marke oder Rezept suchen …"
            value={search.query}
            onChange={(e) => { search.setQuery(e.target.value); setSelected(null); }}
            aria-label="Lebensmittel suchen"
            autoComplete="off"
          />
        </div>
      </div>

      {selected ? (
        <PortionPicker
          candidate={selected}
          busy={busy}
          onPick={(factor) => addCandidate(selected, factor)}
          onCancel={() => setSelected(null)}
        />
      ) : (
        <>
          {search.results.length > 0 && (
            <div className="stack-sm">
              {search.results.map((candidate) => (
                <ResultRow
                  key={candidate.id}
                  title={candidate.name}
                  meta={describeCandidate(candidate)}
                  estimated={candidate.dataQuality !== 'verified'}
                  own={candidate.source === 'library'}
                  onClick={() => {
                    // Recipes offer portions; everything else offers grams.
                    if (candidate.libraryKind === 'recipe') {
                      const recipe = allRecipes.find((r) => r.id === candidate.libraryId);
                      if (recipe) { setSelected(candidate); return; }
                    }
                    setSelected(candidate);
                  }}
                  disabled={busy}
                />
              ))}
            </div>
          )}

          {search.searchingOff && (
            <p className="muted-sm">Suche in der Produktdatenbank …</p>
          )}

          {search.query.trim().length >= 3 && search.results.length === 0 && !search.searchingOff && (
            <p className="muted-sm">
              Nichts gefunden. Trag es unten manuell ein — beim nächsten Mal kennt FORGE es.
            </p>
          )}
        </>
      )}

      {/* Recipes shown when the box is empty */}
      {!search.query && favoriteRecipes.length > 0 && (
        <div className="stack-sm">
          <p className="section-label">Rezepte</p>
          {favoriteRecipes.slice(0, 4).map((recipe) => (
            <RecipeRow key={recipe.id} recipe={recipe} disabled={busy} onAdd={(servings) => addRecipe(recipe, servings)} />
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
            <input className="input" inputMode="decimal" placeholder="Protein g" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} aria-label="Protein" />
          </div>
          <button type="button" className="button block" disabled={busy || (!manualKcal && !manualProtein)} onClick={submitManual}>
            <Check size={16} /> Hinzufügen
          </button>
        </div>
      </details>
    </div>
  );
}

const SOURCE_NOTE: Record<ScoredCandidate['source'], string> = {
  library: 'aus deiner Bibliothek',
  recent: 'zuletzt gegessen',
  static: 'Richtwert',
  off: 'Produktdatenbank',
};

function describeCandidate(candidate: ScoredCandidate): string {
  const kcal = Math.round(candidate.macros.kcal);
  const protein = Math.round(candidate.macros.proteinG);
  const brand = candidate.brand ? `${candidate.brand} · ` : '';
  return `${brand}${kcal} kcal · ${protein} g P · ${candidate.portionLabel} · ${SOURCE_NOTE[candidate.source]}`;
}

function formatFactor(factor: number, candidate: ScoredCandidate): string {
  if (candidate.portionG) return `${Math.round(candidate.portionG * factor)} g`;
  return `${factor.toLocaleString('de-DE')}×`;
}

/** Lets the user say how much of the found item they actually had. */
function PortionPicker({
  candidate,
  busy,
  onPick,
  onCancel,
}: {
  candidate: ScoredCandidate;
  busy: boolean;
  onPick: (factor: number) => void;
  onCancel: () => void;
}) {
  const [custom, setCustom] = useState('');
  const base = candidate.portionG;
  const factors = base ? [0.5, 1, 1.5, 2] : [0.5, 1, 1.5, 2];

  const customFactor = (() => {
    const value = parseDecimalOr(custom, Number.NaN);
    if (!Number.isFinite(value) || value <= 0) return null;
    return base ? value / base : value;
  })();

  return (
    <div className="panel soft" style={{ padding: 12 }}>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p className="h3" style={{ fontSize: 14 }}>{candidate.name}</p>
          <p className="muted-sm">{describeCandidate(candidate)}</p>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Zurück">
          <X size={16} />
        </button>
      </div>

      <div className="chip-row">
        {factors.map((factor) => {
          const macros = scaleCandidate(candidate, factor);
          return (
            <button key={factor} type="button" className="chip" disabled={busy} onClick={() => onPick(factor)}>
              {formatFactor(factor, candidate)}
              <span className="chip-meta">{macros.kcal} kcal</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">{base ? 'Eigene Menge (g)' : 'Portionen'}</label>
          <input
            className="input compact"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={base ? String(base) : '1'}
          />
        </div>
        <button
          type="button"
          className="button compact"
          disabled={busy || customFactor === null}
          onClick={() => customFactor !== null && onPick(customFactor)}
        >
          <Check size={15} /> Eintragen
        </button>
      </div>
    </div>
  );
}

function ResultRow({
  title,
  meta,
  estimated,
  own,
  onClick,
  disabled,
}: {
  title: string;
  meta: string;
  estimated?: boolean;
  /** A hit from the user's own library — their numbers, not a guess. */
  own?: boolean;
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
          {own && <Star size={11} color="var(--gold)" style={{ marginRight: 4 }} />}
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
  const parsed = parseDecimalOr(value, Number.NaN);
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
