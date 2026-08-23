'use client';

import { useState } from 'react';
import { BookOpen, Plus, Star, Trash2, ChefHat, Box } from 'lucide-react';
import { useNutrition } from '@/web/hooks/useNutrition';
import { useAuth } from '@/web/hooks/useAuth';
import { Sheet } from '@/web/components/Sheet';
import { createRecipe, deleteFoodItem, deleteRecipe, type RecipeInput } from '@/data/foodLibrary';
import { sumMacros, scaleMacros, roundMacros } from '@/domain/nutritionMath';
import type { Macros } from '@/domain/types';
import { parseDecimalOr } from '@/domain/numbers';

type IngredientDraft = { name: string; amountLabel: string; kcal: string; proteinG: string; carbsG: string; fatG: string };

const EMPTY_INGREDIENT: IngredientDraft = { name: '', amountLabel: '', kcal: '', proteinG: '', carbsG: '', fatG: '' };

/**
 * The user's own library: saved products and recipes (§12/§35).
 * This is the database the text parser searches before anything is estimated.
 */
export function RecipesView() {
  const { state, saveAsFood, setFavorite, cookBatch, reload } = useNutrition();
  const { user } = useAuth();
  const [recipeSheet, setRecipeSheet] = useState(false);
  const [foodSheet, setFoodSheet] = useState(false);

  if (state.loading) return <div className="panel"><p className="copy">Bibliothek wird geladen …</p></div>;

  return (
    <>
      <section className="panel">
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="var(--violet)" />
            <p className="h2" style={{ fontSize: 18 }}>Bibliothek</p>
          </div>
        </div>
        <p className="copy" style={{ marginTop: 0 }}>
          Was du hier speicherst, kennt FORGE exakt — beim Eintragen, in den Favoriten und für die
          Schnelleingabe. Alles andere muss geschätzt werden.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="button" style={{ flex: 1 }} onClick={() => setRecipeSheet(true)}>
            <Plus size={16} /> Rezept
          </button>
          <button type="button" className="button secondary" style={{ flex: 1 }} onClick={() => setFoodSheet(true)}>
            <Plus size={16} /> Produkt
          </button>
        </div>
      </section>

      {/* ── Recipes ───────────────────────────────────────────────────── */}
      <section className="panel">
        <div className="section-head">
          <p className="h3" style={{ fontSize: 15 }}>Rezepte</p>
          <span className="muted-sm">{state.recipes.length}</span>
        </div>

        {state.recipes.length === 0 ? (
          <div className="empty-state">
            <p className="copy" style={{ margin: 0 }}>Noch keine Rezepte.</p>
            <p className="muted-sm">
              Leg deine Standardgerichte einmal an — danach reicht „1 Portion“ und die Werte stimmen.
            </p>
            <button type="button" className="button compact" style={{ marginTop: 8 }} onClick={() => setRecipeSheet(true)}>
              <Plus size={15} /> Erstes Rezept anlegen
            </button>
          </div>
        ) : (
          <div className="stack">
            {state.recipes.map((recipe) => (
              <div key={recipe.id} className="habit-row" style={{ alignItems: 'flex-start' }}>
                <div className="habit-body">
                  <div className="row-between">
                    <p className="h3" style={{ fontSize: 14 }}>
                      {recipe.favorite && <Star size={12} color="var(--gold)" style={{ marginRight: 4 }} />}
                      {recipe.name}
                    </p>
                    {recipe.isMealPrep && <span className="pill" style={{ minHeight: 22, fontSize: 10 }}>Meal Prep</span>}
                  </div>
                  <p className="muted-sm">
                    {recipe.totalServings} {recipe.servingLabel} · {Math.round(recipe.perServing.kcal)} kcal
                    {' · '}{Math.round(recipe.perServing.proteinG)} g Protein pro {recipe.servingLabel}
                  </p>
                  <p className="muted-sm">
                    {recipe.ingredients.length} Zutaten · gesamt {Math.round(recipe.totalMacros.kcal)} kcal
                  </p>
                  <div className="chip-row" style={{ marginTop: 6 }}>
                    {recipe.isMealPrep && (
                      <button
                        type="button"
                        className="chip"
                        style={{ minHeight: 30, fontSize: 12 }}
                        onClick={() => void cookBatch(recipe.id, recipe.totalServings)}
                      >
                        <ChefHat size={13} /> Gekocht
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip"
                      style={{ minHeight: 30, fontSize: 12 }}
                      onClick={async () => {
                        if (!user) return;
                        await deleteRecipe(user.id, recipe.id);
                        await reload();
                      }}
                    >
                      <Trash2 size={13} /> Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Meal prep batches ─────────────────────────────────────────── */}
      {state.batches.length > 0 && (
        <section className="panel soft">
          <div className="section-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Box size={15} color="var(--violet)" />
              <p className="h3" style={{ fontSize: 15 }}>Offene Batches</p>
            </div>
          </div>
          <div className="stack-sm">
            {state.batches.map((batch) => (
              <div key={batch.id} className="row-between">
                <p className="h3" style={{ fontSize: 14 }}>{batch.recipeName}</p>
                <span className="muted-sm">{batch.portionsLeft} / {batch.totalPortions} Portionen</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Own products ──────────────────────────────────────────────── */}
      <section className="panel">
        <div className="section-head">
          <p className="h3" style={{ fontSize: 15 }}>Eigene Produkte</p>
          <span className="muted-sm">{state.foods.length}</span>
        </div>

        {state.foods.length === 0 ? (
          <div className="empty-state">
            <p className="copy" style={{ margin: 0 }}>Noch keine gespeicherten Produkte.</p>
            <p className="muted-sm">Mahlzeiten lassen sich mit einem Tap hierher übernehmen.</p>
          </div>
        ) : (
          <div className="stack-sm">
            {state.foods.map((food) => (
              <div key={food.id} className="row-between">
                <div style={{ minWidth: 0 }}>
                  <p className="h3" style={{ fontSize: 14 }}>{food.name}</p>
                  <p className="muted-sm">
                    {Math.round(food.macros.kcal)} kcal · {Math.round(food.macros.proteinG)} g P · {food.servingLabel}
                    {food.brand ? ` · ${food.brand}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => void setFavorite(food.id, !food.favorite)}
                    aria-label={food.favorite ? 'Favorit entfernen' : 'Als Favorit'}
                  >
                    <Star size={15} color={food.favorite ? 'var(--gold)' : 'currentColor'} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={async () => {
                      if (!user) return;
                      await deleteFoodItem(user.id, food.id);
                      await reload();
                    }}
                    aria-label="Löschen"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {recipeSheet && user && (
        <RecipeSheet
          onClose={() => setRecipeSheet(false)}
          onSave={async (input) => {
            await createRecipe(user.id, input);
            setRecipeSheet(false);
            await reload();
          }}
        />
      )}

      {foodSheet && (
        <FoodSheet
          onClose={() => setFoodSheet(false)}
          onSave={async (name, brand, servingLabel, macros) => {
            await saveAsFood({ name, brand, servingLabel, macros, dataQuality: 'verified', favorite: true });
            setFoodSheet(false);
          }}
        />
      )}
    </>
  );
}

// ── Recipe editor ───────────────────────────────────────────────────────────

function RecipeSheet({ onClose, onSave }: { onClose: () => void; onSave: (input: RecipeInput) => Promise<void> }) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('4');
  const [servingLabel, setServingLabel] = useState('Portion');
  const [isMealPrep, setIsMealPrep] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([{ ...EMPTY_INGREDIENT }]);
  const [saving, setSaving] = useState(false);

  const parsed: Macros[] = ingredients.map((ing) => ({
    kcal: parseDecimalOr(ing.kcal, 0),
    proteinG: parseDecimalOr(ing.proteinG, 0),
    carbsG: parseDecimalOr(ing.carbsG, 0),
    fatG: parseDecimalOr(ing.fatG, 0),
  }));
  const total = sumMacros(parsed);
  const totalServings = Math.max(0.5, parseDecimalOr(servings, 1));
  const perServing = roundMacros(scaleMacros(total, 1 / totalServings));

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        totalServings,
        servingLabel: servingLabel.trim() || 'Portion',
        isMealPrep,
        favorite: true,
        ingredients: ingredients
          .filter((ing) => ing.name.trim())
          .map((ing, index) => ({
            name: ing.name.trim(),
            amountLabel: ing.amountLabel.trim(),
            macros: parsed[index] ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
          })),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      title="Rezept anlegen"
      onClose={onClose}
      footer={
        <button type="button" className="button block" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? 'Wird gespeichert …' : 'Rezept speichern'}
        </button>
      }
    >
      <div className="field">
        <label className="field-label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Caesar Chicken Wrap" />
      </div>

      <div className="split">
        <div className="field">
          <label className="field-label">Ergibt</label>
          <input className="input" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Einheit</label>
          <input className="input" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="Wraps" />
        </div>
      </div>

      <label className="habit-row" style={{ padding: '10px 12px', cursor: 'pointer' }}>
        <div className="habit-body">
          <p className="h3" style={{ fontSize: 14 }}>Meal Prep</p>
          <p className="muted-sm">Portionen werden nach dem Kochen mitgezählt.</p>
        </div>
        <input type="checkbox" checked={isMealPrep} onChange={(e) => setIsMealPrep(e.target.checked)} />
      </label>

      <div className="stack-sm">
        <p className="section-label">Zutaten</p>
        {ingredients.map((ing, index) => (
          <div key={index} className="panel soft" style={{ padding: 10 }}>
            <div className="split" style={{ gap: 8 }}>
              <input
                className="input compact"
                placeholder="Zutat"
                value={ing.name}
                onChange={(e) => updateIngredient(setIngredients, index, { name: e.target.value })}
                style={{ textAlign: 'left' }}
              />
              <input
                className="input compact"
                placeholder="Menge (z. B. 400 g)"
                value={ing.amountLabel}
                onChange={(e) => updateIngredient(setIngredients, index, { amountLabel: e.target.value })}
                style={{ textAlign: 'left' }}
              />
            </div>
            <div className="split-4" style={{ gap: 6, marginTop: 6 }}>
              <input className="input compact" inputMode="numeric" placeholder="kcal" value={ing.kcal}
                onChange={(e) => updateIngredient(setIngredients, index, { kcal: e.target.value })} />
              <input className="input compact" inputMode="decimal" placeholder="P" value={ing.proteinG}
                onChange={(e) => updateIngredient(setIngredients, index, { proteinG: e.target.value })} />
              <input className="input compact" inputMode="numeric" placeholder="KH" value={ing.carbsG}
                onChange={(e) => updateIngredient(setIngredients, index, { carbsG: e.target.value })} />
              <input className="input compact" inputMode="numeric" placeholder="F" value={ing.fatG}
                onChange={(e) => updateIngredient(setIngredients, index, { fatG: e.target.value })} />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="button secondary compact block"
          onClick={() => setIngredients((prev) => [...prev, { ...EMPTY_INGREDIENT }])}
        >
          <Plus size={15} /> Zutat
        </button>
      </div>

      <div className="panel soft" style={{ padding: 12 }}>
        <p className="section-label">Ergebnis</p>
        <p className="copy" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>
          Gesamt: {Math.round(total.kcal)} kcal · {Math.round(total.proteinG)} g Protein
        </p>
        <p className="copy" style={{ marginTop: 2, marginBottom: 0, fontSize: 13, color: 'var(--teal)' }}>
          Pro {servingLabel || 'Portion'}: {perServing.kcal} kcal · {perServing.proteinG} g Protein
        </p>
      </div>
    </Sheet>
  );
}

function updateIngredient(
  setIngredients: React.Dispatch<React.SetStateAction<IngredientDraft[]>>,
  index: number,
  patch: Partial<IngredientDraft>,
) {
  setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)));
}

// ── Own product editor ──────────────────────────────────────────────────────

function FoodSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, brand: string, servingLabel: string, macros: Macros) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingLabel, setServingLabel] = useState('1 Portion');
  const [kcal, setKcal] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), brand.trim(), servingLabel.trim() || '1 Portion', {
        kcal: parseDecimalOr(kcal, 0),
        proteinG: parseDecimalOr(proteinG, 0),
        carbsG: parseDecimalOr(carbsG, 0),
        fatG: parseDecimalOr(fatG, 0),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      title="Produkt speichern"
      onClose={onClose}
      footer={
        <button type="button" className="button block" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? 'Wird gespeichert …' : 'Speichern'}
        </button>
      }
    >
      <div className="field">
        <label className="field-label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ESN Isoclear" />
      </div>
      <div className="split">
        <div className="field">
          <label className="field-label">Marke</label>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="optional" />
        </div>
        <div className="field">
          <label className="field-label">Portion</label>
          <input className="input" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} />
        </div>
      </div>
      <div className="split-4">
        <div className="field">
          <label className="field-label">kcal</label>
          <input className="input compact" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Protein</label>
          <input className="input compact" inputMode="decimal" value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">KH</label>
          <input className="input compact" inputMode="numeric" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Fett</label>
          <input className="input compact" inputMode="numeric" value={fatG} onChange={(e) => setFatG(e.target.value)} />
        </div>
      </div>
      <p className="muted-sm">
        Werte am besten von der Verpackung — dann rechnet FORGE damit als verifiziert.
      </p>
    </Sheet>
  );
}
