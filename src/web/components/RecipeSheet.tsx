'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Plus, Search, Trash2, X } from 'lucide-react';
import { Sheet } from './Sheet';
import { StepNumber } from './StepNumber';
import { useFoodSearch } from '@/web/hooks/useFoodSearch';
import type { RecipeInput } from '@/data/foodLibrary';
import type { FoodItem, Macros, Recipe } from '@/domain/types';
import type { ScoredCandidate } from '@/domain/foodResolver';
import { parseDecimalOr } from '@/domain/numbers';
import {
  RECIPE_STEPS,
  RECIPE_STEP_LABEL,
  UNIT_LABEL,
  describeIngredientAmount,
  draftPerServing,
  draftServings,
  draftTotals,
  emptyRecipeDraft,
  filledIngredients,
  filledSteps,
  firstOpenStep,
  moveStep,
  ingredientDraftFromSaved,
  ingredientAmount,
  ingredientFromPortion,
  ingredientMacros,
  manualIngredient,
  nextStep,
  previousStep,
  stepIssue,
  type IngredientDraft,
  type IngredientUnit,
  type RecipeDraft,
  type RecipeStep,
} from '@/domain/recipeDraft';

/**
 * Writing a recipe in three steps: what it is, what goes in, what it comes to.
 *
 * Ingredients are picked from the same search the quick-add uses, so their
 * macros come along automatically - the whole point being that "eine Portion"
 * carries real numbers afterwards, without anyone typing kcal by hand.
 */
export function RecipeSheet({
  recipe,
  allFoods,
  onClose,
  onSave,
}: {
  recipe?: Recipe | null;
  allFoods: readonly FoodItem[];
  onClose: () => void;
  onSave: (input: RecipeInput, recipeId?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<RecipeDraft>(() => (recipe ? draftFromRecipe(recipe) : emptyRecipeDraft()));
  const [step, setStep] = useState<RecipeStep>(() => (recipe ? firstOpenStep(draftFromRecipe(recipe)) : 'basics'));
  const [saving, setSaving] = useState(false);

  const stepIndex = RECIPE_STEPS.indexOf(step);
  const issue = stepIssue(draft, step);
  const totals = draftTotals(draft);
  const perServing = draftPerServing(draft);
  const servings = draftServings(draft);
  const servingLabel = draft.servingLabel.trim() || 'Portion';

  function patch(changes: Partial<RecipeDraft>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function addIngredient(ingredient: IngredientDraft) {
    setDraft((prev) => ({ ...prev, ingredients: [...prev.ingredients, ingredient] }));
  }

  function updateIngredient(key: string, changes: Partial<IngredientDraft>) {
    setDraft((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    }));
  }

  function removeIngredient(key: string) {
    setDraft((prev) => ({ ...prev, ingredients: prev.ingredients.filter((item) => item.key !== key) }));
  }

  async function submit() {
    if (stepIssue(draft, 'basics') || stepIssue(draft, 'ingredients')) return;
    setSaving(true);
    try {
      await onSave(recipeInput(draft, recipe?.favorite ?? false), recipe?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const blocked = Boolean(stepIssue(draft, 'basics') || stepIssue(draft, 'ingredients'));

  return (
    <Sheet
      title={recipe ? 'Rezept bearbeiten' : 'Neues Rezept'}
      onClose={onClose}
      footer={
        <div className="stack-sm">
          {issue && <p className="muted-sm">{issue}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setStep(previousStep(step))}
              >
                <ArrowLeft size={16} /> Zurück
              </button>
            )}
            {step === 'review' ? (
              <button
                type="button"
                className="button"
                style={{ flex: 1 }}
                disabled={saving || blocked}
                onClick={() => void submit()}
              >
                <Check size={16} /> {saving ? 'Wird gespeichert …' : 'Rezept speichern'}
              </button>
            ) : (
              <button
                type="button"
                className="button"
                style={{ flex: 1 }}
                disabled={Boolean(issue)}
                onClick={() => setStep(nextStep(step))}
              >
                Weiter <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="stack-sm" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {RECIPE_STEPS.map((entry, index) => {
            // Backwards is always allowed; forwards only once everything in
            // between is filled in. Editing a saved recipe opens on the
            // overview, so jumping straight to the ingredients matters.
            const reachable =
              index <= stepIndex ||
              RECIPE_STEPS.slice(0, index).every((earlier) => stepIssue(draft, earlier) === null);

            return (
              <button
                key={entry}
                type="button"
                onClick={() => reachable && setStep(entry)}
                disabled={!reachable}
                aria-label={`Zu Schritt ${index + 1}: ${RECIPE_STEP_LABEL[entry]}`}
                aria-current={entry === step ? 'step' : undefined}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  background: 'transparent',
                  cursor: reachable ? 'pointer' : 'default',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: 4,
                    borderRadius: 99,
                    background: index <= stepIndex ? 'var(--violet)' : 'var(--border)',
                    transition: 'background 0.2s',
                  }}
                />
              </button>
            );
          })}
        </div>
        <p className="muted-sm" style={{ marginTop: -6 }}>
          Schritt {stepIndex + 1} von {RECIPE_STEPS.length} · {RECIPE_STEP_LABEL[step]}
        </p>
      </div>

      {step === 'basics' && (
        <div className="stack-sm">
          <div className="field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Hähnchen mit Reis"
              autoFocus
            />
          </div>

          <div className="split">
            <div className="field">
              <label className="field-label">Ergibt</label>
              <input
                className="input"
                inputMode="decimal"
                value={draft.servings}
                onChange={(e) => patch({ servings: e.target.value })}
                placeholder="4"
              />
            </div>
            <div className="field">
              <label className="field-label">Einheit</label>
              <input
                className="input"
                value={draft.servingLabel}
                onChange={(e) => patch({ servingLabel: e.target.value })}
                placeholder="Portion"
              />
            </div>
          </div>

          <p className="muted-sm">
            Im nächsten Schritt kommen die Zutaten dazu. FORGE teilt die Summe durch die Menge oben — danach
            reicht „1 {servingLabel}" und die Werte stimmen.
          </p>
        </div>
      )}

      {step === 'ingredients' && (
        <IngredientStep
          draft={draft}
          allFoods={allFoods}
          servingLabel={servingLabel}
          onAdd={addIngredient}
          onUpdate={updateIngredient}
          onRemove={removeIngredient}
        />
      )}

      {step === 'preparation' && (
        <PreparationStep
          steps={draft.steps}
          onChange={(steps) => patch({ steps })}
        />
      )}

      {step === 'review' && (
        <div className="stack-sm">
          <div>
            <p className="h3" style={{ fontSize: 16 }}>{draft.name.trim() || 'Ohne Namen'}</p>
            <p className="muted-sm">
              Ergibt {formatNumber(servings)} {servings === 1 ? servingLabel : `${servingLabel}en`} ·{' '}
              {filledIngredients(draft).length} Zutaten
            </p>
          </div>

          <p className="section-label">Pro {servingLabel}</p>
          <div className="split-4">
            <MacroCard label="kcal" value={perServing.kcal} unit="" />
            <MacroCard label="Protein" value={perServing.proteinG} />
            <MacroCard label="KH" value={perServing.carbsG} />
            <MacroCard label="Fett" value={perServing.fatG} />
          </div>

          <p className="muted-sm">
            Gesamt {Math.round(totals.kcal)} kcal · {Math.round(totals.proteinG)} g Protein ·{' '}
            {Math.round(totals.carbsG)} g KH · {Math.round(totals.fatG)} g Fett
          </p>

          <p className="section-label" style={{ marginTop: 6 }}>Zutaten</p>
          <div className="stack-sm">
            {filledIngredients(draft).map((ingredient) => (
              <div key={ingredient.key} className="row-between">
                <div style={{ minWidth: 0 }}>
                  <p className="h3" style={{ fontSize: 14 }}>{ingredient.name}</p>
                  <p className="muted-sm">{describeIngredientAmount(ingredient)}</p>
                </div>
                <span className="muted-sm" style={{ flexShrink: 0 }}>
                  {Math.round(ingredientMacros(ingredient).kcal)} kcal
                </span>
              </div>
            ))}
          </div>

          {filledSteps(draft).length > 0 && (
            <>
              <p className="section-label" style={{ marginTop: 6 }}>Zubereitung</p>
              <ol className="stack-sm" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {filledSteps(draft).map((entry, index) => (
                  <li key={index} style={{ display: 'flex', gap: 10 }}>
                    <StepNumber index={index} />
                    <p className="copy" style={{ margin: 0, flex: 1 }}>{entry}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ── Step 2: ingredients ─────────────────────────────────────────────────────

function IngredientStep({
  draft,
  allFoods,
  servingLabel,
  onAdd,
  onUpdate,
  onRemove,
}: {
  draft: RecipeDraft;
  allFoods: readonly FoodItem[];
  servingLabel: string;
  onAdd: (ingredient: IngredientDraft) => void;
  onUpdate: (key: string, changes: Partial<IngredientDraft>) => void;
  onRemove: (key: string) => void;
}) {
  const search = useFoodSearch({ foods: allFoods, recipes: [], recentMeals: [] });
  const [manualOpen, setManualOpen] = useState(false);
  /** Picked from the search, waiting for its amount. */
  const [pending, setPending] = useState<IngredientDraft | null>(null);

  function pickCandidate(candidate: ScoredCandidate) {
    setPending(
      ingredientFromPortion({
        key: `${candidate.id}-${Date.now()}`,
        name: candidate.name,
        macros: candidate.macros,
        portionG: candidate.portionG,
        portionLabel: candidate.portionLabel,
        foodItemId: candidate.libraryKind === 'food' ? candidate.libraryId ?? null : null,
      }),
    );
  }

  function confirmPending() {
    if (!pending || ingredientAmount(pending) <= 0) return;
    onAdd(pending);
    setPending(null);
    search.reset();
  }

  const totals = draftTotals(draft);
  const perServing = draftPerServing(draft);

  return (
    <div className="stack-sm">
      <div className="field">
        <div className="search-field" style={{ width: '100%' }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Zutat suchen — eigene Produkte und Datenbank"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            aria-label="Zutat suchen"
            autoComplete="off"
          />
        </div>
      </div>

      {pending && (
        <AmountPrompt
          ingredient={pending}
          onChange={(amount) => setPending({ ...pending, amount })}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
        />
      )}

      {!pending && search.results.length > 0 && (
        <div className="stack-sm">
          {search.results.slice(0, 6).map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="panel soft"
              style={{ padding: 10, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
              onClick={() => pickCandidate(candidate)}
            >
              <div className="row-between">
                <div style={{ minWidth: 0 }}>
                  <p className="h3" style={{ fontSize: 14 }}>{candidate.name}</p>
                  <p className="muted-sm">
                    {Math.round(candidate.macros.kcal)} kcal · {Math.round(candidate.macros.proteinG)} g P ·{' '}
                    {candidate.portionLabel}
                  </p>
                </div>
                <Plus size={16} style={{ flexShrink: 0, color: 'var(--violet)' }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {!pending && search.searchingOff && <p className="muted-sm">Suche in der Produktdatenbank …</p>}

      {!pending && search.query.trim().length >= 3 && search.results.length === 0 && !search.searchingOff && (
        <p className="muted-sm">Nichts gefunden — trag die Zutat unten von Hand ein.</p>
      )}

      {draft.ingredients.length === 0 ? (
        <div className="empty-state">
          <p className="copy" style={{ margin: 0 }}>Noch keine Zutaten.</p>
          <p className="muted-sm">Such oben nach einem Produkt — die Nährwerte kommen automatisch mit.</p>
        </div>
      ) : (
        <div className="stack-sm">
          <p className="section-label">Zutaten</p>
          {draft.ingredients.map((ingredient) => (
            <div key={ingredient.key} className="panel soft" style={{ padding: 10 }}>
              <div className="row-between" style={{ gap: 8 }}>
                <input
                  className="input compact"
                  value={ingredient.name}
                  onChange={(e) => onUpdate(ingredient.key, { name: e.target.value })}
                  aria-label="Zutat"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => onRemove(ingredient.key)}
                  aria-label={`${ingredient.name} entfernen`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="row-between" style={{ marginTop: 8, gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <input
                    className="input compact"
                    inputMode="decimal"
                    value={ingredient.amount}
                    onChange={(e) => onUpdate(ingredient.key, { amount: e.target.value })}
                    aria-label={`Menge ${ingredient.name}`}
                    style={{ width: 84 }}
                  />
                  <span className="muted-sm">
                    {ingredient.unit === 'portion'
                      ? (parseDecimalOr(ingredient.amount, 1) === 1 ? 'Portion' : 'Portionen')
                      : UNIT_LABEL[ingredient.unit]}
                  </span>
                </div>
                <span className="muted-sm" style={{ flexShrink: 0 }}>
                  {Math.round(ingredientMacros(ingredient).kcal)} kcal ·{' '}
                  {Math.round(ingredientMacros(ingredient).proteinG)} g P
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {manualOpen ? (
        <ManualIngredientForm
          onCancel={() => setManualOpen(false)}
          onAdd={(name, macros, reference) => {
            onAdd(manualIngredient(`manual-${Date.now()}`, name, macros, reference));
            setManualOpen(false);
          }}
        />
      ) : (
        <button type="button" className="button ghost compact" onClick={() => setManualOpen(true)}>
          <Plus size={14} /> Zutat kennt FORGE nicht
        </button>
      )}

      {draft.ingredients.length > 0 && (
        <div className="panel soft" style={{ padding: 10 }}>
          <div className="row-between">
            <span className="muted-sm">Gesamt</span>
            <span className="muted-sm">{Math.round(totals.kcal)} kcal</span>
          </div>
          <div className="row-between" style={{ marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Pro {servingLabel}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {perServing.kcal} kcal · {perServing.proteinG} g P
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: preparation ─────────────────────────────────────────────────────

/**
 * The cooking steps, one row each. Optional on purpose - a recipe is worth
 * saving for its macros alone, and being forced to write prose before the
 * numbers can be stored would be the wrong trade.
 */
function PreparationStep({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  function update(index: number, value: string) {
    onChange(steps.map((entry, position) => (position === index ? value : entry)));
  }

  function remove(index: number) {
    const next = steps.filter((_, position) => position !== index);
    onChange(next.length > 0 ? next : ['']);
  }

  return (
    <div className="stack-sm">
      <p className="muted-sm">
        Ein Schritt pro Zeile — beim Kochen liest du sie später der Reihe nach ab. Kannst du auch leer lassen.
      </p>

      {steps.map((entry, index) => (
        <div key={index} className="panel soft" style={{ padding: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <StepNumber index={index} />
            <textarea
              className="textarea"
              value={entry}
              onChange={(event) => update(index, event.target.value)}
              placeholder={index === 0 ? 'Hack in der Pfanne anbraten' : 'Nächster Schritt'}
              aria-label={`Schritt ${index + 1}`}
              rows={2}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 6 }}>
            <button
              type="button"
              className="icon-button"
              onClick={() => onChange(moveStep(steps, index, -1))}
              disabled={index === 0}
              aria-label={`Schritt ${index + 1} nach oben`}
            >
              <ChevronUp size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => onChange(moveStep(steps, index, 1))}
              disabled={index === steps.length - 1}
              aria-label={`Schritt ${index + 1} nach unten`}
            >
              <ChevronDown size={15} />
            </button>
            <button
              type="button"
              className="icon-button danger"
              onClick={() => remove(index)}
              aria-label={`Schritt ${index + 1} löschen`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="button ghost compact" onClick={() => onChange([...steps, ''])}>
        <Plus size={14} /> Schritt
      </button>
    </div>
  );
}

/**
 * The amount is asked for right at the pick: "400" over "g Hähnchenhack" is
 * how a recipe gets written down, and the macros underneath update while you
 * type - adding first and correcting the amount afterwards was a detour.
 */
function AmountPrompt({
  ingredient,
  onChange,
  onCancel,
  onConfirm,
}: {
  ingredient: IngredientDraft;
  onChange: (amount: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const amount = ingredientAmount(ingredient);
  const macros = ingredientMacros(ingredient);
  const unit = ingredient.unit === 'portion'
    ? (amount === 1 ? 'Portion' : 'Portionen')
    : UNIT_LABEL[ingredient.unit];

  return (
    <form
      className="panel soft"
      style={{ padding: 10, border: '1px solid color-mix(in srgb, var(--violet) 34%, transparent)' }}
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <div className="row-between" style={{ gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p className="h3" style={{ fontSize: 14 }}>{ingredient.name}</p>
          <p className="muted-sm">Wie viel kommt ins Rezept?</p>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Zutat verwerfen">
          <X size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input
          className="input compact"
          inputMode="decimal"
          value={ingredient.amount}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          aria-label={`Menge ${ingredient.name}`}
          style={{ width: 96 }}
          autoFocus
        />
        <span className="muted-sm" style={{ flex: 1 }}>{unit}</span>
        <button type="submit" className="button compact" disabled={amount <= 0}>
          <Plus size={14} /> Hinzufügen
        </button>
      </div>

      <p className="muted-sm" style={{ marginTop: 8 }}>
        {Math.round(macros.kcal)} kcal · {Math.round(macros.proteinG)} g Protein ·{' '}
        {Math.round(macros.carbsG)} g KH · {Math.round(macros.fatG)} g Fett
      </p>
    </form>
  );
}

/**
 * A product no database knows. The reference amount is the point: "660 kcal"
 * is only usable once it says "per 400 g" - then the same product can go into
 * the next recipe at 250 g and the numbers still hold.
 */
function ManualIngredientForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, macros: Macros, reference: { amount: number; unit: IngredientUnit }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('100');
  const [unit, setUnit] = useState<IngredientUnit>('g');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const macros: Macros = {
    kcal: parseDecimalOr(kcal, 0),
    proteinG: parseDecimalOr(protein, 0),
    carbsG: parseDecimalOr(carbs, 0),
    fatG: parseDecimalOr(fat, 0),
  };
  const referenceAmount = parseDecimalOr(amount, 0);
  const unitName = unit === 'portion'
    ? (referenceAmount === 1 ? 'Portion' : 'Portionen')
    : UNIT_LABEL[unit];

  return (
    <div className="panel soft" style={{ padding: 10 }}>
      <p className="section-label" style={{ marginBottom: 8 }}>Neue Zutat</p>
      <div className="stack-sm">
        <input
          className="input compact"
          placeholder="Name, z. B. Hähnchenhack"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name der Zutat"
        />

        <div className="field">
          <label className="field-label">Werte gelten für</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input compact"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Menge des Produkts"
              style={{ width: 96 }}
            />
            <select
              className="select"
              value={unit}
              onChange={(e) => setUnit(e.target.value as IngredientUnit)}
              aria-label="Einheit"
              style={{ flex: 1 }}
            >
              <option value="g">Gramm</option>
              <option value="ml">Milliliter</option>
              <option value="portion">Portion</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="input compact" inputMode="numeric" placeholder="kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} aria-label="Kalorien" />
          <input className="input compact" inputMode="decimal" placeholder="Protein g" value={protein} onChange={(e) => setProtein(e.target.value)} aria-label="Protein" />
          <input className="input compact" inputMode="decimal" placeholder="KH g" value={carbs} onChange={(e) => setCarbs(e.target.value)} aria-label="Kohlenhydrate" />
          <input className="input compact" inputMode="decimal" placeholder="Fett g" value={fat} onChange={(e) => setFat(e.target.value)} aria-label="Fett" />
        </div>

        <p className="muted-sm">
          Werte von der Verpackung für {referenceAmount > 0 ? formatNumber(referenceAmount) : '…'} {unitName}.
          Die Menge fürs Rezept stellst du danach in der Zutatenzeile ein.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="button secondary compact" onClick={onCancel}>Abbrechen</button>
          <button
            type="button"
            className="button compact"
            style={{ flex: 1 }}
            disabled={!name.trim() || macros.kcal <= 0 || referenceAmount <= 0}
            onClick={() => onAdd(name.trim(), macros, { amount: referenceAmount, unit })}
          >
            <Plus size={14} /> Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

function MacroCard({ label, value, unit = 'g' }: { label: string; value: number; unit?: string }) {
  return (
    <div className="metric-card">
      <span className="metric-value" style={{ fontSize: 18 }}>
        {Math.round(value).toLocaleString('de-DE')}
        {unit && <span style={{ fontSize: 12, color: 'var(--subtle)' }}> {unit}</span>}
      </span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

// ── Draft ↔ storage ─────────────────────────────────────────────────────────

function draftFromRecipe(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    servings: String(recipe.totalServings),
    servingLabel: recipe.servingLabel,
    ingredients: recipe.ingredients.map(ingredientDraftFromSaved),
    steps: recipe.steps.length > 0 ? [...recipe.steps] : [''],
  };
}

/** Ingredients are stored with the macros of the amount actually used. */
function recipeInput(draft: RecipeDraft, favorite: boolean): RecipeInput {
  return {
    name: draft.name.trim(),
    totalServings: draftServings(draft),
    servingLabel: draft.servingLabel.trim() || 'Portion',
    favorite,
    steps: filledSteps(draft),
    ingredients: filledIngredients(draft).map((ingredient) => ({
      foodItemId: ingredient.foodItemId,
      name: ingredient.name.trim(),
      amountLabel: describeIngredientAmount(ingredient),
      macros: round1Macros(ingredientMacros(ingredient)),
    })),
  };
}

function round1Macros(macros: Macros): Macros {
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return {
    kcal: round1(macros.kcal),
    proteinG: round1(macros.proteinG),
    carbsG: round1(macros.carbsG),
    fatG: round1(macros.fatG),
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toLocaleString('de-DE');
}
