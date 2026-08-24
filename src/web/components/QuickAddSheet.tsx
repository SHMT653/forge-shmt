'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Utensils, Droplets, Footprints, Moon, Scale, Dumbbell, Search, Sparkles,
  Plus, Check, X, Star, ScanBarcode, Camera, Upload, Flashlight, FlashlightOff, SwitchCamera,
} from 'lucide-react';
import { Sheet } from './Sheet';
import { useFoodSearch } from '@/web/hooks/useFoodSearch';
import { scaleCandidate, type ScoredCandidate } from '@/domain/foodResolver';
import { slotForHour } from '@/domain/nutritionMath';
import { formatLiters, formatHours } from '@/domain/dayEvaluation';
import { defaultPortionG, findOpenFoodFactsByBarcode, normalizeBarcode, offPortion, type OffFood } from '@/data/foodSearch';
import type { MealEntry, MealEntryInput } from '@/data/nutrition';
import type { FoodItemInput } from '@/data/foodLibrary';
import type { FoodItem } from '@/domain/types';
import { parseDecimalOr, parsePositive } from '@/domain/numbers';

type Mode = 'food' | 'water' | 'steps' | 'sleep' | 'weight' | 'training';

const WATER_STEPS = [250, 500, 750];
const SLEEP_OPTIONS = [7, 7.5, 8, 8.5, 9, 9.5, 10];
const BARCODE_CAMERA_READY_KEY = 'forge-barcode-camera-ready';
const FOOD_BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'codabar', 'itf'];

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
type CameraFacingMode = 'environment' | 'user';
type CameraScannerHandle = {
  start: (facingMode?: CameraFacingMode) => Promise<void>;
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

function manualServing(unit: ManualUnit, amountInput: string): { label: string; grams: number | null } | null {
  const amount = parsePositive(amountInput);
  if (unit === 'g' || unit === 'ml') {
    if (amount === null) return null;
    return { label: `${formatManualAmount(amount)} ${unit}`, grams: amount };
  }

  const option = manualUnitOption(unit);
  const count = amount ?? 1;
  const label = count === 1 ? `1 ${option.label}` : `${formatManualAmount(count)} ${option.plural}`;
  return { label, grams: null };
}

// ── Food ────────────────────────────────────────────────────────────────────

function FoodPanel({
  favoriteFoods,
  recentMeals,
  allFoods,
  busy,
  onAdd,
  onSaveFood,
}: {
  favoriteFoods: readonly FoodItem[];
  recentMeals: readonly MealEntry[];
  allFoods: readonly FoodItem[];
  busy: boolean;
  onAdd: (entry: MealEntryInput, keepOpen?: boolean) => void;
  onSaveFood?: (input: FoodItemInput) => Promise<void> | void;
}) {
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualUnit, setManualUnit] = useState<ManualUnit>('portion');
  const [selected, setSelected] = useState<ScoredCandidate | null>(null);

  const search = useFoodSearch({ foods: allFoods, recipes: [], recentMeals });
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

  /** Logs a search hit, and quietly files a discovered product for next time. */
  function addCandidate(candidate: ScoredCandidate, factor: number) {
    const macros = scaleCandidate(candidate, factor);

    onAdd({
      name: factor === 1 ? candidate.name : `${formatFactor(factor, candidate)} ${candidate.name}`,
      macros,
      dataQuality: candidate.dataQuality,
      servings: factor,
      source: candidate.matchedByBarcode
        ? 'barcode'
        : candidate.source === 'library'
          ? 'favorite'
          : 'search',
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
        barcode: candidate.barcode ?? null,
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
    const serving = manualServing(manualUnit, manualAmount);
    if (!serving) return;
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
      servings: 1,
      servingLabel: serving.label,
      servingG: serving.grams,
      source: 'manual',
      slot,
    });
  }

  const manualUnitDetails = manualUnitOption(manualUnit);
  const manualMissingAmount = (manualUnit === 'g' || manualUnit === 'ml') && parsePositive(manualAmount) === null;

  return (
    <div className="stack-sm">
      <BarcodePanel
        allFoods={allFoods}
        busy={busy}
        scanPaused={selected !== null}
        onFound={(candidate) => {
          search.reset();
          setSelected(candidate);
        }}
      />

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
                  onClick={() => setSelected(candidate)}
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
                setManualAmount((current) => current || manualUnitOption(next).placeholder);
              }}
              aria-label="Einheit"
            >
              {MANUAL_UNITS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button type="button" className="button block" disabled={busy || (!manualKcal && !manualProtein) || manualMissingAmount} onClick={submitManual}>
            <Check size={16} /> Hinzufügen
          </button>
        </div>
      </details>
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
}: {
  allFoods: readonly FoodItem[];
  busy: boolean;
  scanPaused: boolean;
  onFound: (candidate: ScoredCandidate) => void;
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
        const local = allFoods.find((food) => normalizeBarcode(food.barcode ?? '') === code);
        if (local) {
          onFound(candidateFromFood(local, code));
          setStatus(`${local.name} gefunden.`);
          return;
        }

        const product = await findOpenFoodFactsByBarcode(code);
        if (product) {
          onFound(candidateFromOff(product));
          setStatus(`${product.name} gefunden.`);
          return;
        }

        setStatus('Kein Produkt gefunden. Du kannst es unten manuell eintragen.');
      } finally {
        setLookingUp(false);
      }
    },
    [allFoods, onFound],
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

    flushSync(() => setCameraOpen(true));
    setStatus(null);
    await scannerRef.current?.start('environment');
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
        onReady={rememberBarcodeCamera}
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

  const reader = await createZxingOneDReader();
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

async function createZxingOneDReader() {
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatOneDReader(hints, {
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

function rememberBarcodeCamera(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BARCODE_CAMERA_READY_KEY, '1');
  } catch {
    // Private mode can block storage; the scanner still works without memory.
  }
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

function barcodeCameraConstraints(facingMode: CameraFacingMode, tuned = true): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: tuned ? 1280 : 640 },
      height: { ideal: tuned ? 720 : 480 },
      ...(tuned ? { advanced: CAMERA_TUNING } : {}),
    } as MediaTrackConstraints,
  };
}

async function requestBarcodeCameraStream(facingMode: CameraFacingMode): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(barcodeCameraConstraints(facingMode));
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia(barcodeCameraConstraints(facingMode, false));
    } catch {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
  }
}

const CameraScanner = forwardRef<CameraScannerHandle, {
  visible: boolean;
  onDetected: (raw: string) => void;
  onReady: () => void;
  onClose: () => void;
}>(function CameraScanner({
  visible,
  onDetected,
  onReady,
  onClose,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const nativeTimerRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const runningRef = useRef(false);
  const closedRef = useRef(false);
  const detectedRef = useRef(false);
  const facingModeRef = useRef<CameraFacingMode>('environment');
  const nativeErrorCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('environment');

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
    const reader = await createZxingOneDReader();
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
    onReady();
  }, [clearNativeLoop, completeScan, onReady, setScanRunning]);

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

  const startScan = useCallback(async (nextFacingMode: CameraFacingMode = facingModeRef.current) => {
    if (startingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Kamera ist hier nicht verfügbar.');
      return;
    }

    if (runningRef.current) stopScan();

    setError(null);
    detectedRef.current = false;
    nativeErrorCountRef.current = 0;
    facingModeRef.current = nextFacingMode;
    setFacingMode(nextFacingMode);
    startingRef.current = true;
    setStarting(true);
    try {
      const video = videoRef.current;
      if (!video) return;

      const stream = await requestBarcodeCameraStream(nextFacingMode);
      if (closedRef.current) {
        stopMediaStream(stream);
        return;
      }

      await attachCameraStream(video, stream);
      setTorchAvailable(await prepareCameraStream(stream));

      const nativeDetector = await createNativeBarcodeDetector();
      if (nativeDetector) {
        setScanRunning(true);
        onReady();
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
  }, [onReady, scheduleNativeScan, setScanRunning, startZxingOnStream, stopScan]);

  useImperativeHandle(ref, () => ({
    start: startScan,
    stop: stopScan,
  }), [startScan, stopScan]);

  const switchCamera = useCallback(async () => {
    const next: CameraFacingMode = facingModeRef.current === 'environment' ? 'user' : 'environment';
    await startScan(next);
  }, [startScan]);

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
          {running ? 'Stoppen' : 'Weiter'}
        </button>
        <button type="button" className="button ghost compact" disabled={starting} onClick={() => void switchCamera()}>
          <SwitchCamera size={14} />
          {facingMode === 'environment' ? 'Front' : 'Rück'}
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
