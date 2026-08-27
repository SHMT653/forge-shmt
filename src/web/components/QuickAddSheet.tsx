'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Utensils, Droplets, Footprints, Moon, Scale, Dumbbell, Search, Sparkles,
  Plus, Check, X, Star, ScanBarcode, Camera, Upload, Flashlight, FlashlightOff,
} from 'lucide-react';
import { Sheet } from './Sheet';
import { useFoodSearch } from '@/web/hooks/useFoodSearch';
import { scaleCandidate, type ScoredCandidate } from '@/domain/foodResolver';
import { slotForHour } from '@/domain/nutritionMath';
import { formatLiters, formatHours } from '@/domain/dayEvaluation';
import { barcodeLookupVariants, defaultPortionG, findProductByBarcode, normalizeBarcode, offPortion, type OffFood } from '@/data/foodSearch';
import type { MealEntry, MealEntryInput } from '@/data/nutrition';
import type { FoodItemInput } from '@/data/foodLibrary';
import type { FoodItem } from '@/domain/types';
import { parseDecimal, parseDecimalOr, parsePositive } from '@/domain/numbers';

type Mode = 'food' | 'water' | 'steps' | 'sleep' | 'weight' | 'training';

const WATER_STEPS = [250, 500, 750];
const SLEEP_OPTIONS = [7, 7.5, 8, 8.5, 9, 9.5, 10];
const FOOD_BARCODE_FORMATS = [
  'aztec',
  'codabar',
  'code_39',
  'code_93',
  'code_128',
  'data_matrix',
  'ean_8',
  'ean_13',
  'itf',
  'pdf417',
  'qr_code',
  'upc_a',
  'upc_e',
];

type NativeBarcodeResult = { rawValue?: string };
type NativeBarcodeDetectorSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap | Blob;
type NativeBarcodeDetector = { detect: (source: NativeBarcodeDetectorSource) => Promise<NativeBarcodeResult[]> };
type NativeBarcodeDetectorConstructor = {
  new(options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};
type ExtendedMediaTrackConstraintSet = MediaTrackConstraintSet & {
  focusMode?: 'continuous';
  exposureMode?: 'continuous';
  whiteBalanceMode?: 'continuous';
  torch?: boolean;
};
type ExtendedMediaTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
};
type CameraScannerHandle = {
  start: () => Promise<void>;
  stop: () => void;
};

const CAMERA_TUNING: ExtendedMediaTrackConstraintSet[] = [
  { focusMode: 'continuous' },
  { exposureMode: 'continuous' },
  { whiteBalanceMode: 'continuous' },
];

type ManualUnit = 'portion' | 'g' | 'ml' | 'piece' | 'glass' | 'can' | 'bottle' | 'pack';

const MANUAL_UNITS: { value: ManualUnit; label: string; plural: string; placeholder: string }[] = [
  { value: 'portion', label: 'Portion', plural: 'Portionen', placeholder: '1' },
  { value: 'g', label: 'g', plural: 'g', placeholder: '100' },
  { value: 'ml', label: 'ml', plural: 'ml', placeholder: '250' },
  { value: 'piece', label: 'Stück', plural: 'Stück', placeholder: '1' },
  { value: 'glass', label: 'Glas', plural: 'Gläser', placeholder: '1' },
  { value: 'can', label: 'Dose', plural: 'Dosen', placeholder: '1' },
  { value: 'bottle', label: 'Flasche', plural: 'Flaschen', placeholder: '1' },
  { value: 'pack', label: 'Packung', plural: 'Packungen', placeholder: '1' },
];

export type QuickAddHandlers = {
  onAddEntry: (entry: MealEntryInput) => Promise<void> | void;
  /** Saves a discovered product into the user's own library (§12/§35). */
  onSaveFood?: (input: FoodItemInput) => Promise<FoodItem | void> | FoodItem | void;
  onSetFavorite?: (foodId: string, favorite: boolean) => Promise<void> | void;
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
  currentWater,
  currentSteps,
  currentSleep,
  currentWeight,
  recentMeals = [],
  allFoods,
  handlers,
}: {
  onClose: () => void;
  favoriteFoods: readonly FoodItem[];
  recentMeals?: readonly MealEntry[];
  /** Full library for searching; the favourites above are only the chips. */
  allFoods?: readonly FoodItem[];
  currentWater: number;
  currentSteps: number;
  currentSleep: number;
  currentWeight: number | null;
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
          recentMeals={recentMeals}
          allFoods={allFoods ?? favoriteFoods}
          busy={busy}
          onAdd={(entry, keepOpen) => run(() => handlers.onAddEntry(entry), keepOpen)}
          {...(handlers.onSaveFood ? { onSaveFood: handlers.onSaveFood } : {})}
          {...(handlers.onSetFavorite ? { onSetFavorite: handlers.onSetFavorite } : {})}
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

function formatManualAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}

function manualUnitOption(unit: ManualUnit) {
  return MANUAL_UNITS.find((option) => option.value === unit) ?? MANUAL_UNITS[0]!;
}

function manualUnitAmountLabel(unit: ManualUnit, amount: number): string {
  if (unit === 'g' || unit === 'ml') return `${formatManualAmount(amount)} ${unit}`;
  const option = manualUnitOption(unit);
  return amount === 1 ? `1 ${option.label}` : `${formatManualAmount(amount)} ${option.plural}`;
}

function manualServing(unit: ManualUnit, amountInput: string): { label: string; grams: number | null } | null {
  const amount = parsePositive(amountInput);
  if (unit === 'g' || unit === 'ml') {
    if (amount === null) return null;
    return { label: manualUnitAmountLabel(unit, amount), grams: amount };
  }

  const count = amount ?? 1;
  return { label: manualUnitAmountLabel(unit, count), grams: null };
}

function roundMacro(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

function manualMacrosFromFields({
  kcalInput,
  proteinInput,
  carbsInput,
  fatInput,
}: {
  kcalInput: string;
  proteinInput: string;
  carbsInput: string;
  fatInput: string;
}): FoodItemInput['macros'] | null {
  const typedKcal = parseDecimal(kcalInput);
  const proteinG = roundMacro(parseDecimalOr(proteinInput, 0));
  const typedCarbs = parseDecimal(carbsInput);
  const typedFat = parseDecimal(fatInput);
  let carbsG = typedCarbs === null ? null : roundMacro(typedCarbs);
  let fatG = typedFat === null ? null : roundMacro(typedFat);
  let kcal = typedKcal === null ? 0 : Math.round(Math.max(0, typedKcal));

  if (typedKcal === null && (proteinG > 0 || (carbsG ?? 0) > 0 || (fatG ?? 0) > 0)) {
    kcal = Math.round(proteinG * 4 + (carbsG ?? 0) * 4 + (fatG ?? 0) * 9);
  }

  if (kcal <= 0 && proteinG <= 0 && (carbsG ?? 0) <= 0 && (fatG ?? 0) <= 0) {
    return null;
  }

  const remaining = Math.max(0, kcal - proteinG * 4 - (carbsG ?? 0) * 4 - (fatG ?? 0) * 9);
  if (carbsG === null && fatG === null) {
    carbsG = roundMacro((remaining * 0.62) / 4);
    fatG = roundMacro((remaining * 0.38) / 9);
  } else if (carbsG === null) {
    carbsG = roundMacro(remaining / 4);
  } else if (fatG === null) {
    fatG = roundMacro(remaining / 9);
  }

  return { kcal, proteinG, carbsG: carbsG ?? 0, fatG: fatG ?? 0 };
}

type PortionChoice = {
  factor: number;
  label?: string;
  servingLabel?: string;
  servingG?: number | null;
};

function foodInputFromCandidate(candidate: ScoredCandidate, favorite: boolean): FoodItemInput {
  return {
    name: candidate.name,
    brand: candidate.brand,
    servingLabel: candidate.portionLabel,
    servingG: candidate.portionG,
    macros: candidate.macros,
    dataQuality: candidate.dataQuality,
    barcode: candidate.barcode ?? null,
    favorite,
  };
}

function isFoodItemResult(value: FoodItem | void | undefined): value is FoodItem {
  return Boolean(value && typeof value === 'object' && 'id' in value);
}

function scaledServingG(candidate: ScoredCandidate, factor: number): number | null {
  return candidate.portionG ? roundMacro(candidate.portionG * factor) : null;
}

function customChoiceForCandidate(candidate: ScoredCandidate, unit: ManualUnit, amountInput: string): PortionChoice | null {
  const amount = parsePositive(amountInput);
  if (amount === null) return null;

  const amountLabel = manualUnitAmountLabel(unit, amount);
  if (unit === 'g' || unit === 'ml') {
    if (!candidate.portionG) return null;
    return {
      factor: amount / candidate.portionG,
      label: amountLabel,
      servingLabel: amountLabel,
      servingG: amount,
    };
  }

  const choice: PortionChoice = {
    factor: amount,
    servingLabel: amountLabel,
    servingG: unit === 'portion' ? scaledServingG(candidate, amount) : null,
  };
  if (!(unit === 'portion' && amount === 1)) choice.label = amountLabel;
  return choice;
}

// ── Food ────────────────────────────────────────────────────────────────────

function FoodPanel({
  favoriteFoods,
  recentMeals,
  allFoods,
  busy,
  onAdd,
  onSaveFood,
  onSetFavorite,
}: {
  favoriteFoods: readonly FoodItem[];
  recentMeals: readonly MealEntry[];
  allFoods: readonly FoodItem[];
  busy: boolean;
  onAdd: (entry: MealEntryInput, keepOpen?: boolean) => Promise<void> | void;
  onSaveFood?: (input: FoodItemInput) => Promise<FoodItem | void> | FoodItem | void;
  onSetFavorite?: (foodId: string, favorite: boolean) => Promise<void> | void;
}) {
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualBarcode, setManualBarcode] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState('1');
  const [manualUnit, setManualUnit] = useState<ManualUnit>('portion');
  const [manualFavorite, setManualFavorite] = useState(false);
  const [selected, setSelected] = useState<ScoredCandidate | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);

  const search = useFoodSearch({ foods: allFoods, recipes: [], recentMeals });
  const slot = slotForHour(new Date().getHours());
  const actionBusy = busy || localBusy;

  function addOwnFood(food: FoodItem) {
    void onAdd({
      name: food.name,
      macros: food.macros,
      dataQuality: food.dataQuality,
      foodItemId: food.id,
      source: 'favorite',
      slot,
    }, true);
  }

  async function saveFoodFromSheet(input: FoodItemInput): Promise<FoodItem | undefined> {
    if (!onSaveFood) return undefined;
    try {
      const saved = await onSaveFood(input);
      return isFoodItemResult(saved) ? saved : undefined;
    } catch {
      return undefined;
    }
  }

  /** Logs a search hit, and quietly files a discovered product for next time. */
  async function addCandidate(candidate: ScoredCandidate, choice: PortionChoice) {
    if (actionBusy) return;
    setLocalBusy(true);

    try {
      const factor = choice.factor;
      const macros = scaleCandidate(candidate, factor);
      const displayLabel = choice.label ?? (factor === 1 ? '' : formatFactor(factor, candidate));
      const saved = candidate.source === 'off'
        ? await saveFoodFromSheet(foodInputFromCandidate(candidate, false))
        : undefined;
      const foodItemId = candidate.libraryKind === 'food' && candidate.libraryId
        ? candidate.libraryId
        : saved?.id;

      await onAdd({
        name: displayLabel ? `${displayLabel} ${candidate.name}` : candidate.name,
        macros,
        dataQuality: candidate.dataQuality,
        servings: factor,
        servingLabel: choice.servingLabel ?? (displayLabel || candidate.portionLabel),
        servingG: choice.servingG ?? scaledServingG(candidate, factor),
        source: candidate.matchedByBarcode
          ? 'barcode'
          : candidate.source === 'library'
            ? 'favorite'
            : 'search',
        ...(foodItemId ? { foodItemId } : {}),
        ...(candidate.libraryKind === 'recipe' && candidate.libraryId ? { recipeId: candidate.libraryId } : {}),
        slot,
      }, true);
      setSelected(null);
      search.reset();
    } finally {
      setLocalBusy(false);
    }
  }

  async function toggleFood(food: FoodItem) {
    if (!onSetFavorite || favoriteBusyId) return;
    setFavoriteBusyId(food.id);
    try {
      await onSetFavorite(food.id, !food.favorite);
    } finally {
      setFavoriteBusyId(null);
    }
  }

  async function toggleCandidateFavorite(candidate: ScoredCandidate) {
    if (favoriteBusyId) return;
    const libraryFood = candidate.libraryKind === 'food' && candidate.libraryId
      ? allFoods.find((food) => food.id === candidate.libraryId)
      : null;

    setFavoriteBusyId(candidate.id);
    try {
      if (libraryFood && onSetFavorite) {
        await onSetFavorite(libraryFood.id, !libraryFood.favorite);
        return;
      }
      if (candidate.libraryKind !== 'recipe' && onSaveFood) {
        await onSaveFood(foodInputFromCandidate(candidate, true));
      }
    } finally {
      setFavoriteBusyId(null);
    }
  }

  async function submitManual() {
    if (actionBusy) return;
    const macros = manualMacrosFromFields({
      kcalInput: manualKcal,
      proteinInput: manualProtein,
      carbsInput: manualCarbs,
      fatInput: manualFat,
    });
    if (!macros) return;
    const serving = manualServing(manualUnit, manualAmount);
    if (!serving) return;
    setLocalBusy(true);
    try {
      const name = manualName.trim() || `${macros.kcal} kcal`;
      const shouldRememberFood = Boolean(manualName.trim() && (manualFavorite || manualBarcode));
      const savedFood = shouldRememberFood
        ? await saveFoodFromSheet({
            name,
            brand: manualBrand.trim(),
            servingLabel: serving.label,
            servingG: serving.grams,
            macros,
            dataQuality: 'verified',
            barcode: manualBarcode,
            favorite: manualFavorite,
          })
        : undefined;
      const displayName = serving.label === '1 Portion' ? name : `${serving.label} ${name}`;

      await onAdd({
        name: displayName,
        macros,
        dataQuality: 'verified',
        servings: 1,
        servingLabel: serving.label,
        servingG: serving.grams,
        source: savedFood ? 'favorite' : 'manual',
        ...(savedFood ? { foodItemId: savedFood.id } : {}),
        slot,
      });

      setManualKcal('');
      setManualProtein('');
      setManualCarbs('');
      setManualFat('');
      setManualName('');
      setManualBrand('');
      setManualBarcode(null);
      setManualAmount(manualUnitOption(manualUnit).placeholder);
    } finally {
      setLocalBusy(false);
    }
  }

  const manualUnitDetails = manualUnitOption(manualUnit);
  const manualMissingAmount = (manualUnit === 'g' || manualUnit === 'ml') && parsePositive(manualAmount) === null;
  const manualMacros = manualMacrosFromFields({
    kcalInput: manualKcal,
    proteinInput: manualProtein,
    carbsInput: manualCarbs,
    fatInput: manualFat,
  });

  function candidateFavorite(candidate: ScoredCandidate): boolean {
    if (candidate.libraryKind !== 'food' || !candidate.libraryId) return false;
    return allFoods.find((food) => food.id === candidate.libraryId)?.favorite ?? false;
  }

  function canFavoriteCandidate(candidate: ScoredCandidate): boolean {
    if (candidate.libraryKind === 'recipe') return false;
    if (candidate.libraryKind === 'food') return Boolean(onSetFavorite);
    return Boolean(onSaveFood);
  }

  return (
    <div className="stack-sm">
      <BarcodePanel
        allFoods={allFoods}
        busy={actionBusy}
        scanPaused={selected !== null}
        onFound={(candidate) => {
          search.reset();
          setManualBarcode(null);
          setSelected(candidate);
        }}
        onUnknown={(code) => {
          setManualBarcode(code);
          setSelected(null);
        }}
      />

      {/* Favourites — one tap (§37) */}
      {favoriteFoods.length > 0 && !search.query && (
        <div className="stack-sm">
          <div className="row-between">
            <p className="section-label">Favoriten</p>
            <span className="muted-sm">Plus loggt sofort</span>
          </div>
          <div className="stack-sm">
            {favoriteFoods.slice(0, 8).map((food) => (
              <SavedFoodRow
                key={food.id}
                food={food}
                busy={actionBusy}
                favoriteBusy={favoriteBusyId === food.id}
                onAdd={() => addOwnFood(food)}
                {...(onSetFavorite ? { onToggleFavorite: () => void toggleFood(food) } : {})}
              />
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
          key={selected.id}
          candidate={selected}
          busy={actionBusy}
          onPick={(choice) => void addCandidate(selected, choice)}
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
                  favorite={candidateFavorite(candidate)}
                  favoritable={canFavoriteCandidate(candidate)}
                  favoriteBusy={favoriteBusyId === candidate.id}
                  onClick={() => setSelected(candidate)}
                  onQuickAdd={() => void addCandidate(candidate, { factor: 1 })}
                  onToggleFavorite={() => void toggleCandidateFavorite(candidate)}
                  disabled={actionBusy}
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
      <div className="panel soft" style={{ padding: 12 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div>
            <p className="h3" style={{ fontSize: 14 }}>Eigenes Lebensmittel</p>
            <p className="muted-sm">Werte pro gewählte Menge</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={manualFavorite ? 'Nicht als Favorit speichern' : 'Als Favorit speichern'}
            aria-pressed={manualFavorite}
            onClick={() => setManualFavorite((value) => !value)}
            style={manualFavorite ? { color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, transparent)' } : undefined}
          >
            <Star size={15} fill={manualFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="stack-sm">
          <input
            className="input"
            placeholder="Name"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            aria-label="Bezeichnung"
          />
          {manualBarcode && (
            <p className="muted-sm">Barcode {manualBarcode} wird mit diesem Lebensmittel verknüpft.</p>
          )}
          <input
            className="input"
            placeholder="Marke optional"
            value={manualBrand}
            onChange={(e) => setManualBrand(e.target.value)}
            aria-label="Marke"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              className="input"
              inputMode="decimal"
              placeholder={`Menge (${manualUnitDetails.placeholder})`}
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              aria-label="Menge"
            />
            <select
              className="select"
              value={manualUnit}
              onChange={(e) => {
                const next = e.target.value as ManualUnit;
                setManualUnit(next);
                setManualAmount(manualUnitOption(next).placeholder);
              }}
              aria-label="Einheit"
            >
              {MANUAL_UNITS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="input compact" inputMode="numeric" placeholder="kcal" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} aria-label="Kalorien" />
            <input className="input compact" inputMode="decimal" placeholder="Protein g" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} aria-label="Protein" />
            <input className="input compact" inputMode="decimal" placeholder="KH g" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} aria-label="Kohlenhydrate" />
            <input className="input compact" inputMode="decimal" placeholder="Fett g" value={manualFat} onChange={(e) => setManualFat(e.target.value)} aria-label="Fett" />
          </div>
          <button type="button" className="button block" disabled={actionBusy || !manualMacros || manualMissingAmount} onClick={() => void submitManual()}>
            <Check size={16} /> {manualFavorite ? 'Favorit hinzufügen' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function candidateFromFood(food: FoodItem, barcode: string): ScoredCandidate {
  return {
    id: `scan-lib-${food.id}`,
    source: 'library',
    name: food.name,
    brand: food.brand,
    macros: food.macros,
    portionLabel: food.servingLabel,
    portionG: food.servingG,
    dataQuality: food.dataQuality,
    libraryId: food.id,
    libraryKind: 'food',
    barcode,
    matchedByBarcode: true,
    score: 120,
  };
}

function candidateFromOff(product: OffFood): ScoredCandidate {
  const grams = defaultPortionG(product);
  return {
    id: `scan-off-${product.code}`,
    source: 'off',
    name: product.name,
    brand: product.brand,
    macros: offPortion(product, grams),
    portionLabel: product.servingSizeG ? `${grams} g (Portion)` : '100 g',
    portionG: grams,
    dataQuality: 'estimated',
    imageUrl: product.imageUrl,
    popularity: product.popularity,
    barcode: product.code,
    matchedByBarcode: true,
    score: 118,
  };
}

function BarcodePanel({
  allFoods,
  busy,
  scanPaused,
  onFound,
  onUnknown,
}: {
  allFoods: readonly FoodItem[];
  busy: boolean;
  scanPaused: boolean;
  onFound: (candidate: ScoredCandidate) => void;
  onUnknown: (barcode: string) => void;
}) {
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<CameraScannerHandle>(null);

  const lookup = useCallback(
    async (raw: string) => {
      const code = normalizeBarcode(raw);
      if (!code) {
        setStatus('Barcode nicht erkannt.');
        return;
      }

      setBarcode(code);
      setLookingUp(true);
      setStatus('Produkt wird gesucht …');
      try {
        const scannedVariants = barcodeLookupVariants(code);
        const local = allFoods.find((food) => {
          const foodVariants = barcodeLookupVariants(food.barcode ?? '');
          return foodVariants.some((variant) => scannedVariants.includes(variant));
        });
        if (local) {
          onFound(candidateFromFood(local, code));
          setStatus(`${local.name} gefunden.`);
          return;
        }

        const product = await findProductByBarcode(code);
        if (product) {
          onFound(candidateFromOff(product));
          setStatus(`${product.name} gefunden.`);
          return;
        }

        onUnknown(code);
        setStatus('Kein Produkt gefunden. Wenn du es unten anlegst, kennt FORGE den Barcode danach.');
      } finally {
        setLookingUp(false);
      }
    },
    [allFoods, onFound, onUnknown],
  );

  const handleDetected = useCallback(
    (raw: string) => {
      setCameraOpen(false);
      void lookup(raw);
    },
    [lookup],
  );

  async function handleImageScan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (!file) return;

    setLookingUp(true);
    setStatus('Barcode-Bild wird gelesen …');
    try {
      const raw = await decodeBarcodeFromImageFile(file);
      if (!raw) {
        setStatus('Kein Barcode im Bild erkannt.');
        return;
      }
      await lookup(raw);
    } finally {
      setLookingUp(false);
    }
  }

  async function handleScannerButton() {
    if (cameraOpen) {
      scannerRef.current?.stop();
      setCameraOpen(false);
      return;
    }

    setStatus(null);
    setCameraOpen(true);
  }

  return (
    <div className="panel soft" style={{ padding: 12 }}>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <ScanBarcode size={16} color="var(--violet)" />
          <p className="h3" style={{ fontSize: 14 }}>Produkt scannen</p>
        </div>
        <button
          type="button"
          className="button secondary compact"
          disabled={busy || lookingUp || scanPaused}
          onClick={() => void handleScannerButton()}
        >
          <Camera size={15} /> {cameraOpen ? 'Ausblenden' : 'Scannen'}
        </button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageScan}
        style={{ display: 'none' }}
      />

      <form
        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(barcode);
        }}
      >
        <input
          className="input compact"
          inputMode="numeric"
          placeholder="Barcode"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          aria-label="Barcode"
        />
        <button type="submit" className="button compact" disabled={busy || lookingUp || !barcode.trim()}>
          {lookingUp ? '…' : <Check size={15} />}
        </button>
      </form>

      <button
        type="button"
        className="button ghost compact"
        style={{ marginTop: 8, padding: 0 }}
        disabled={busy || lookingUp}
        onClick={() => imageInputRef.current?.click()}
      >
        <Upload size={14} /> Barcode-Foto lesen
      </button>

      {status && <p className="muted-sm" style={{ marginTop: 8 }}>{status}</p>}

      <CameraScanner
        ref={scannerRef}
        visible={cameraOpen}
        onDetected={handleDetected}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}

async function decodeBarcodeFromImageFile(file: File): Promise<string | null> {
  const nativeDetector = await createNativeBarcodeDetector();
  if (nativeDetector) {
    try {
      const source = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : file;
      try {
        const raw = firstFoodBarcode(await nativeDetector.detect(source));
        if (raw) return raw;
      } finally {
        if ('close' in source) source.close();
      }
    } catch {
      // The ZXing fallback below supports browsers without native image scans.
    }
  }

  const reader = await createZxingReader();
  const url = URL.createObjectURL(file);
  try {
    const result = await reader.decodeFromImageUrl(url);
    return result.getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function nativeBarcodeDetectorConstructor(): NativeBarcodeDetectorConstructor | null {
  if (typeof window === 'undefined') return null;
  const maybeWindow = window as Window & { BarcodeDetector?: NativeBarcodeDetectorConstructor };
  return maybeWindow.BarcodeDetector ?? null;
}

async function createNativeBarcodeDetector(): Promise<NativeBarcodeDetector | null> {
  const BarcodeDetector = nativeBarcodeDetectorConstructor();
  if (!BarcodeDetector) return null;

  try {
    const supported = await BarcodeDetector.getSupportedFormats?.();
    const formats = supported
      ? FOOD_BARCODE_FORMATS.filter((format) => supported.includes(format))
      : FOOD_BARCODE_FORMATS;
    if (formats.length === 0) return null;
    return new BarcodeDetector({ formats });
  } catch {
    return null;
  }
}

async function createZxingReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.AZTEC,
    BarcodeFormat.CODABAR,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODE_128,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.ITF,
    BarcodeFormat.PDF_417,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 70,
    delayBetweenScanSuccess: 180,
    tryPlayVideoTimeout: 3000,
  });
}

function firstFoodBarcode(results: NativeBarcodeResult[]): string | null {
  for (const result of results) {
    const raw = result.rawValue?.trim();
    if (raw && normalizeBarcode(raw)) return raw;
  }
  return results[0]?.rawValue?.trim() || null;
}

function mediaStreamFromVideo(video: HTMLVideoElement | null): MediaStream | null {
  return video?.srcObject instanceof MediaStream ? video.srcObject : null;
}

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

async function attachCameraStream(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream;
  await new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }
    const timeout = window.setTimeout(resolve, 1000);
    video.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      resolve();
    };
  });
  await video.play().catch(() => undefined);
}

async function prepareCameraStream(stream: MediaStream): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  await track.applyConstraints({ advanced: CAMERA_TUNING } as MediaTrackConstraints).catch(() => undefined);
  const capabilities = track.getCapabilities?.() as ExtendedMediaTrackCapabilities | undefined;
  return Boolean(capabilities?.torch);
}

async function setStreamTorch(stream: MediaStream | null, enabled: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  const capabilities = track.getCapabilities?.() as ExtendedMediaTrackCapabilities | undefined;
  if (!capabilities?.torch) return false;
  await track.applyConstraints({ advanced: [{ torch: enabled }] as ExtendedMediaTrackConstraintSet[] } as MediaTrackConstraints);
  return true;
}

function barcodeCameraConstraints(tuned = true): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: tuned ? 1280 : 640 },
      height: { ideal: tuned ? 720 : 480 },
      ...(tuned ? { advanced: CAMERA_TUNING } : {}),
    } as MediaTrackConstraints,
  };
}

async function rearCameraDeviceId(): Promise<string | null> {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const videoDevices = devices.filter((device) => device.kind === 'videoinput');
  const rear = videoDevices.find((device) => {
    const label = device.label.toLowerCase();
    return (
      label.includes('back') ||
      label.includes('rear') ||
      label.includes('environment') ||
      label.includes('rück') ||
      label.includes('umgebung')
    );
  });
  return rear?.deviceId || null;
}

async function requestStreamWithDeviceId(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      advanced: CAMERA_TUNING,
    } as MediaTrackConstraints,
  });
}

async function requestBarcodeCameraStream(): Promise<MediaStream> {
  const rearDeviceId = await rearCameraDeviceId();
  if (rearDeviceId) {
    const exactRearStream = await requestStreamWithDeviceId(rearDeviceId).catch(() => null);
    if (exactRearStream) return exactRearStream;
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia(barcodeCameraConstraints());
  } catch {
    stream = await navigator.mediaDevices.getUserMedia(barcodeCameraConstraints(false));
  }

  const nextRearDeviceId = await rearCameraDeviceId();
  if (nextRearDeviceId) {
    const currentDeviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
    if (currentDeviceId !== nextRearDeviceId) {
      stopMediaStream(stream);
      const rearStream = await requestStreamWithDeviceId(nextRearDeviceId).catch(() => null);
      if (rearStream) return rearStream;
      stream = await navigator.mediaDevices.getUserMedia(barcodeCameraConstraints(false));
    }
  }

  return assertRearCamera(stream);
}

function assertRearCamera(stream: MediaStream): MediaStream {
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings?.();
  const label = `${settings?.facingMode ?? ''} ${track?.label ?? ''}`.toLowerCase();
  if (settings?.facingMode === 'environment') return stream;
  if (label.includes('user') || label.includes('front') || label.includes('selfie') || label.includes('facetime')) {
    stopMediaStream(stream);
    throw new Error('Front camera is not allowed for barcode scanning.');
  }
  return stream;
}

const CameraScanner = forwardRef<CameraScannerHandle, {
  visible: boolean;
  onDetected: (raw: string) => void;
  onClose: () => void;
}>(function CameraScanner({
  visible,
  onDetected,
  onClose,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const nativeTimerRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const runningRef = useRef(false);
  const closedRef = useRef(false);
  const detectedRef = useRef(false);
  const startTokenRef = useRef(0);
  const nativeErrorCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const setScanRunning = useCallback((next: boolean) => {
    runningRef.current = next;
    setRunning(next);
  }, []);

  const clearNativeLoop = useCallback(() => {
    if (nativeTimerRef.current !== null) {
      window.clearTimeout(nativeTimerRef.current);
      nativeTimerRef.current = null;
    }
  }, []);

  const stopScan = useCallback(() => {
    startTokenRef.current += 1;
    startingRef.current = false;
    clearNativeLoop();
    controlsRef.current?.stop();
    controlsRef.current = null;
    stopMediaStream(mediaStreamFromVideo(videoRef.current));
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.srcObject = null;
    }
    setTorchAvailable(false);
    setTorchOn(false);
    setScanRunning(false);
  }, [clearNativeLoop, setScanRunning]);

  const completeScan = useCallback((raw: string) => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    stopScan();
    onDetected(raw);
  }, [onDetected, stopScan]);

  const startZxingOnStream = useCallback(async (stream: MediaStream, video: HTMLVideoElement) => {
    clearNativeLoop();
    const reader = await createZxingReader();
    const controls = await reader.decodeFromStream(stream, video, (result, _error, scanControls) => {
      const raw = result?.getText();
      if (!raw || detectedRef.current) return;
      scanControls.stop();
      completeScan(raw);
    });

    if (closedRef.current || detectedRef.current) {
      controls.stop();
      return;
    }

    controlsRef.current = controls;
    setScanRunning(true);
  }, [clearNativeLoop, completeScan, setScanRunning]);

  const scheduleNativeScan = useCallback((detector: NativeBarcodeDetector, stream: MediaStream, video: HTMLVideoElement) => {
    const scan = async () => {
      if (closedRef.current || detectedRef.current || !runningRef.current) return;

      try {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const raw = firstFoodBarcode(await detector.detect(video));
          nativeErrorCountRef.current = 0;
          if (raw) {
            completeScan(raw);
            return;
          }
        }
      } catch {
        nativeErrorCountRef.current += 1;
        if (nativeErrorCountRef.current >= 2 && !controlsRef.current && !closedRef.current) {
          void startZxingOnStream(stream, video).catch(() => {
            stopScan();
            setError('Scanner konnte nicht gestartet werden. Nutze Barcode-Foto oder gib die Nummer ein.');
          });
          return;
        }
      }

      nativeTimerRef.current = window.setTimeout(scan, 90);
    };

    nativeTimerRef.current = window.setTimeout(scan, 60);
  }, [completeScan, startZxingOnStream, stopScan]);

  const startScan = useCallback(async () => {
    if (startingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Kamera ist hier nicht verfügbar.');
      return;
    }

    if (runningRef.current) stopScan();

    const token = startTokenRef.current + 1;
    startTokenRef.current = token;
    setError(null);
    detectedRef.current = false;
    nativeErrorCountRef.current = 0;
    startingRef.current = true;
    setStarting(true);
    try {
      const video = videoRef.current;
      if (!video) return;

      const stream = await requestBarcodeCameraStream();
      if (closedRef.current || startTokenRef.current !== token) {
        stopMediaStream(stream);
        return;
      }

      await attachCameraStream(video, stream);
      if (closedRef.current || startTokenRef.current !== token) {
        stopScan();
        return;
      }
      setTorchAvailable(await prepareCameraStream(stream));

      const nativeDetector = await createNativeBarcodeDetector();
      if (closedRef.current || startTokenRef.current !== token) {
        stopScan();
        return;
      }
      if (nativeDetector) {
        setScanRunning(true);
        scheduleNativeScan(nativeDetector, stream, video);
      } else {
        await startZxingOnStream(stream, video);
      }
    } catch {
      stopScan();
      setError('Kamera konnte nicht gestartet werden. Nutze Barcode-Foto oder gib die Nummer ein.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [scheduleNativeScan, setScanRunning, startZxingOnStream, stopScan]);

  useImperativeHandle(ref, () => ({
    start: startScan,
    stop: stopScan,
  }), [startScan, stopScan]);

  useEffect(() => {
    if (visible) {
      void startScan();
    } else {
      stopScan();
    }
  }, [startScan, stopScan, visible]);

  const toggleTorch = useCallback(async () => {
    const next = !torchOn;
    try {
      const changed = await setStreamTorch(mediaStreamFromVideo(videoRef.current), next);
      if (changed) setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      setTorchOn(false);
    }
  }, [torchOn]);

  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
      stopScan();
    };
  }, [stopScan]);

  return (
    <div className="panel" style={{ display: visible ? 'block' : 'none', marginTop: 10, padding: 10 }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          aria-label="Barcode Kamera"
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            top: '42%',
            height: 2,
            background: 'rgba(255,255,255,0.82)',
            boxShadow: '0 0 16px rgba(170,77,255,0.75)',
          }}
        />
      </div>
      <div className="button-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="button ghost compact"
          disabled={starting}
          onClick={() => {
            if (running) {
              stopScan();
            } else {
              void startScan();
            }
          }}
        >
          {running ? 'Stoppen' : 'Neu starten'}
        </button>
        {torchAvailable && (
          <button type="button" className="button ghost compact" disabled={!running} onClick={() => void toggleTorch()}>
            {torchOn ? <FlashlightOff size={14} /> : <Flashlight size={14} />}
            Licht
          </button>
        )}
        <span className="muted-sm" style={{ flex: 1 }}>
          {starting ? 'Scanner startet …' : running ? 'Scanner läuft' : 'Scanner pausiert'}
        </span>
      </div>
      {error && <p className="muted-sm" style={{ marginTop: 8, color: 'var(--danger)' }}>{error}</p>}
      <button
        type="button"
        className="button ghost compact"
        style={{ marginTop: 8, padding: 0 }}
        onClick={() => {
          stopScan();
          onClose();
        }}
      >
        Scanner schließen
      </button>
    </div>
  );
});

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

function SavedFoodRow({
  food,
  busy,
  favoriteBusy,
  onAdd,
  onToggleFavorite,
}: {
  food: FoodItem;
  busy: boolean;
  favoriteBusy: boolean;
  onAdd: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <div className="habit-row" style={{ width: '100%', padding: '11px 12px', gap: 10 }}>
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          padding: 0,
          textAlign: 'left',
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        <div className="habit-body">
          <p className="h3" style={{ fontSize: 14 }}>
            <Star size={11} color="var(--gold)" fill="currentColor" style={{ marginRight: 4 }} />
            {food.name}
          </p>
          <p className="muted-sm">
            {Math.round(food.macros.kcal)} kcal · {Math.round(food.macros.proteinG)} g P · {food.servingLabel}
          </p>
        </div>
      </button>
      <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
        {onToggleFavorite && (
          <button
            type="button"
            className="icon-button"
            disabled={busy || favoriteBusy}
            aria-label="Favorit entfernen"
            aria-pressed
            onClick={onToggleFavorite}
            style={{ color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, transparent)' }}
          >
            <Star size={15} fill="currentColor" />
          </button>
        )}
        <button type="button" className="icon-button" disabled={busy} onClick={onAdd} aria-label="Direkt hinzufügen">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
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
  onPick: (choice: PortionChoice) => void;
  onCancel: () => void;
}) {
  const [custom, setCustom] = useState('');
  const [customUnit, setCustomUnit] = useState<ManualUnit>(candidate.portionG ? (candidate.portionLabel.toLowerCase().includes('ml') ? 'ml' : 'g') : 'portion');
  const base = candidate.portionG;
  const factors = base ? [0.5, 1, 1.5, 2] : [0.5, 1, 1.5, 2];
  const customUnits = MANUAL_UNITS.filter((option) =>
    base ? true : option.value !== 'g' && option.value !== 'ml',
  );
  const customChoice = customChoiceForCandidate(candidate, customUnit, custom);
  const customPlaceholder = base && (customUnit === 'g' || customUnit === 'ml')
    ? String(base)
    : manualUnitOption(customUnit).placeholder;

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
            <button key={factor} type="button" className="chip" disabled={busy} onClick={() => onPick({ factor })}>
              {formatFactor(factor, candidate)}
              <span className="chip-meta">{macros.kcal} kcal</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Spezielle Menge</label>
          <input
            className="input compact"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={customPlaceholder}
          />
        </div>
        <select
          className="select"
          value={customUnit}
          onChange={(e) => {
            const next = e.target.value as ManualUnit;
            setCustomUnit(next);
            setCustom(base && (next === 'g' || next === 'ml') ? String(base) : manualUnitOption(next).placeholder);
          }}
          aria-label="Mengeneinheit"
          style={{ flex: '0 0 96px', minHeight: 40, borderRadius: 'var(--radius-sm)' }}
        >
          {customUnits.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="button compact"
          disabled={busy || customChoice === null}
          onClick={() => customChoice !== null && onPick(customChoice)}
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
  favorite,
  favoritable,
  favoriteBusy,
  onClick,
  onQuickAdd,
  onToggleFavorite,
  disabled,
}: {
  title: string;
  meta: string;
  estimated?: boolean;
  favorite?: boolean;
  favoritable?: boolean;
  favoriteBusy?: boolean;
  onClick: () => void;
  onQuickAdd: () => void;
  onToggleFavorite: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="habit-row"
      style={{ width: '100%', padding: '11px 12px', gap: 10 }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          padding: 0,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div className="habit-body">
          <p className="h3" style={{ fontSize: 14 }}>
            {favorite && <Star size={11} color="var(--gold)" fill="currentColor" style={{ marginRight: 4 }} />}
            {title}
            {estimated && <span className="quality-badge estimated" style={{ marginLeft: 6 }}>geschätzt</span>}
          </p>
          <p className="muted-sm">{meta}</p>
        </div>
      </button>
      <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
        {favoritable && (
          <button
            type="button"
            className="icon-button"
            disabled={disabled || favoriteBusy}
            aria-label={favorite ? 'Favorit entfernen' : 'Als Favorit speichern'}
            aria-pressed={favorite}
            onClick={onToggleFavorite}
            style={favorite ? { color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, transparent)' } : undefined}
          >
            <Star size={15} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        )}
        <button type="button" className="icon-button" disabled={disabled} onClick={onQuickAdd} aria-label="Direkt hinzufügen">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/** Recipes can be logged in fractional portions (§12). */
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
