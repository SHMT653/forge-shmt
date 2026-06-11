'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Plus, Trash2, Droplets, X } from 'lucide-react';
import { useNutrition } from '@/web/hooks/useNutrition';
import { searchFood, estimateMacros } from '@/domain/foodDatabase';
import type { FoodItem } from '@/domain/foodDatabase';

const GLASS_ML = 250;

function fmtWater(ml: number): string {
  if (ml >= 1000) {
    const l = ml / 1000;
    return `${l.toLocaleString('de-DE', { minimumFractionDigits: l % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })} L`;
  }
  return `${ml} ml`;
}

// ─── Donut Chart ───────────────────────────────────────────────────────────────

function MacroDonut({
  proteinKcal, carbsKcal, fatKcal, totalKcal, goalKcal,
}: {
  proteinKcal: number;
  carbsKcal:   number;
  fatKcal:     number;
  totalKcal:   number;
  goalKcal:    number;
}) {
  const r     = 52;
  const cx    = 64;
  const cy    = 64;
  const sw    = 14;
  const circ  = 2 * Math.PI * r;
  const cap   = Math.max(goalKcal, totalKcal, 1);

  const segments = [
    { kcal: proteinKcal, color: 'var(--teal)'   },
    { kcal: carbsKcal,   color: '#c9a227'        },
    { kcal: fatKcal,     color: '#d96060'        },
  ];

  let cumOffset = 0;
  const arcs = segments.map((seg) => {
    const arc    = (seg.kcal / cap) * circ;
    const offset = cumOffset;
    cumOffset   += arc;
    return { color: seg.color, dasharray: `${arc} ${circ}`, dashoffset: -offset };
  });

  const pct = Math.round(Math.min(totalKcal / Math.max(goalKcal, 1), 1) * 100);

  return (
    <svg width={128} height={128} viewBox="0 0 128 128" aria-label={`${totalKcal} von ${goalKcal} kcal`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {arcs.map((arc, i) => (
          <circle
            key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={sw}
            strokeDasharray={arc.dasharray} strokeDashoffset={arc.dashoffset}
          />
        ))}
      </g>
      <text x={cx} y={cy - 8}  textAnchor="middle" fill="var(--text)"   fontSize={22} fontWeight={700}>{totalKcal}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--subtle)" fontSize={10}>von {goalKcal} kcal</text>
      <text x={cx} y={cy + 23} textAnchor="middle" fill="var(--subtle)" fontSize={10}>{pct}%</text>
    </svg>
  );
}

// ─── Macro Bar ─────────────────────────────────────────────────────────────────

function MacroBar({ label, value, goal, unit, color }: {
  label: string; value: number; goal: number; unit: string; color: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 13 }}>
          <strong style={{ color }}>{value}{unit}</strong>
          <span style={{ color: 'var(--subtle)' }}> / {goal}{unit}</span>
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── Meal Row ──────────────────────────────────────────────────────────────────

function MealRow({ entry, onDelete }: {
  entry: { id: string; name: string; kcal: number; proteinG: number; carbsG: number; fatG: number };
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{entry.kcal} kcal</span>
          <span style={{ fontSize: 11, color: 'var(--teal)' }}>P {entry.proteinG}g</span>
          <span style={{ fontSize: 11, color: '#c9a227' }}>K {entry.carbsG}g</span>
          <span style={{ fontSize: 11, color: '#d96060' }}>F {entry.fatG}g</span>
        </div>
      </div>
      <button
        type="button" onClick={() => onDelete(entry.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 4, flexShrink: 0 }}
        aria-label="Mahlzeit entfernen"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ─── Add Meal Form ─────────────────────────────────────────────────────────────

type BaseValues = { kcal: number; prot: number; carbs: number; fat: number };

function AddMealForm({ onAdd }: { onAdd: (entry: { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number }) => Promise<void> }) {
  const [foodQuery, setFoodQuery]     = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [showDrop, setShowDrop]       = useState(false);
  const [dropPos, setDropPos]         = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 300 });

  const [portions, setPortions]   = useState(1);
  const [base, setBase]           = useState<BaseValues | null>(null);
  const [manualName, setManualName]   = useState('');
  const [manualKcal, setManualKcal]   = useState('');
  const [manualProt, setManualProt]   = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat]     = useState('');
  const [saving, setSaving]           = useState(false);

  const searchRef  = useRef<HTMLInputElement>(null);
  const searchWrap = useRef<HTMLDivElement>(null);

  // Update form fields when portions changes (only if food was selected from DB)
  useEffect(() => {
    if (!base) return;
    setManualKcal(String(Math.round(base.kcal  * portions)));
    setManualProt(String(Math.round(base.prot  * portions)));
    setManualCarbs(String(Math.round(base.carbs * portions)));
    setManualFat(String(Math.round(base.fat    * portions)));
  }, [portions, base]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDrop) return;
    function onDown(e: MouseEvent) {
      if (searchWrap.current && !searchWrap.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showDrop]);

  function openDrop() {
    if (searchWrap.current) {
      const rect = searchWrap.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setShowDrop(true);
  }

  function handleSearch(q: string) {
    setFoodQuery(q);
    const results = q.trim().length >= 2 ? searchFood(q) : [];
    setFoodResults(results);
    if (results.length > 0) {
      openDrop();
    } else {
      setShowDrop(false);
    }
  }

  function selectFood(item: FoodItem) {
    const { carbsG, fatG } = estimateMacros(item);
    const b: BaseValues = { kcal: item.kcal, prot: item.proteinG, carbs: carbsG, fat: fatG };
    setBase(b);
    setManualName(item.name);
    setManualKcal(String(Math.round(b.kcal  * portions)));
    setManualProt(String(Math.round(b.prot  * portions)));
    setManualCarbs(String(Math.round(b.carbs * portions)));
    setManualFat(String(Math.round(b.fat    * portions)));
    setFoodQuery('');
    setFoodResults([]);
    setShowDrop(false);
  }

  function clearAll() {
    setBase(null); setPortions(1);
    setManualName(''); setManualKcal(''); setManualProt(''); setManualCarbs(''); setManualFat('');
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const kcal = Number(manualKcal) || 0;
    if (!kcal && !manualName) return;
    setSaving(true);
    try {
      await onAdd({
        name:     manualName || `${kcal} kcal`,
        kcal,
        proteinG: Number(manualProt)  || 0,
        carbsG:   Number(manualCarbs) || 0,
        fatG:     Number(manualFat)   || 0,
      });
      clearAll();
    } finally {
      setSaving(false);
    }
  }

  const hasInput = !!(manualName || manualKcal);

  return (
    <div>
      {/* Search — the anchor for the fixed dropdown */}
      <div ref={searchWrap} style={{ position: 'relative', marginBottom: 12 }}>
        <div className="search-field">
          <Search size={14} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Lebensmittel suchen (z. B. Hähnchen, Reis …)"
            value={foodQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (foodResults.length > 0) openDrop(); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowDrop(false); setFoodQuery(''); setFoodResults([]); } }}
            autoComplete="off"
            aria-label="Lebensmittel suchen"
            aria-expanded={showDrop}
            aria-haspopup="listbox"
          />
          {foodQuery && (
            <button type="button" onClick={() => { setFoodQuery(''); setFoodResults([]); setShowDrop(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 2 }} aria-label="Suche löschen">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown — rendered with position:fixed so it floats above all panels */}
      {showDrop && foodResults.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'fixed',
            top:    dropPos.top,
            left:   dropPos.left,
            width:  dropPos.width,
            zIndex: 300,
            background:   'var(--panel, #16161b)',
            border:       '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            boxShadow:    '0 12px 40px rgba(0,0,0,0.7)',
            maxHeight:    260,
            overflowY:    'auto',
          }}
        >
          {foodResults.map((item) => {
            const { carbsG, fatG } = estimateMacros(item);
            return (
              <button
                key={item.name}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); selectFood(item); }}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>{item.portionLabel}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{item.kcal} kcal</span>
                  <span style={{ fontSize: 11, color: 'var(--teal)' }}>P {item.proteinG}g</span>
                  <span style={{ fontSize: 11, color: '#c9a227' }}>K {carbsG}g</span>
                  <span style={{ fontSize: 11, color: '#d96060' }}>F {fatG}g</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          className="input compact"
          placeholder="Name (z. B. Mittagessen)"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
        />

        {/* Portionen — only shown if a food was selected from the DB */}
        {base && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(139,92,246,0.1)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)' }}>
            <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>Portionen</span>
            <button type="button" className="button ghost compact" style={{ padding: '2px 10px', fontSize: 16 }}
              onClick={() => setPortions((p) => Math.max(0.5, +(p - 0.5).toFixed(1)))}>−</button>
            <span style={{ fontSize: 15, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{portions}</span>
            <button type="button" className="button ghost compact" style={{ padding: '2px 10px', fontSize: 16 }}
              onClick={() => setPortions((p) => +(p + 0.5).toFixed(1))}>+</button>
          </div>
        )}

        {/* Portionen for manual entry */}
        {!base && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--subtle)' }}>Portionen:</span>
            <button type="button" className="button ghost compact" style={{ padding: '2px 8px', fontSize: 14 }}
              onClick={() => setPortions((p) => Math.max(0.5, +(p - 0.5).toFixed(1)))}>−</button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{portions}</span>
            <button type="button" className="button ghost compact" style={{ padding: '2px 8px', fontSize: 14 }}
              onClick={() => setPortions((p) => +(p + 0.5).toFixed(1))}>+</button>
          </div>
        )}

        <div className="button-row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">kcal</label>
            <input className="input compact" inputMode="numeric" placeholder="0"
              value={manualKcal} onChange={(e) => { setBase(null); setManualKcal(e.target.value); }} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Protein g</label>
            <input className="input compact" inputMode="numeric" placeholder="0"
              value={manualProt} onChange={(e) => { setBase(null); setManualProt(e.target.value); }} />
          </div>
        </div>
        <div className="button-row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Kohlenhydrate g</label>
            <input className="input compact" inputMode="numeric" placeholder="0"
              value={manualCarbs} onChange={(e) => { setBase(null); setManualCarbs(e.target.value); }} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Fette g</label>
            <input className="input compact" inputMode="numeric" placeholder="0"
              value={manualFat} onChange={(e) => { setBase(null); setManualFat(e.target.value); }} />
          </div>
        </div>
        <div className="button-row" style={{ gap: 8, marginTop: 4 }}>
          <button type="submit" className="button" style={{ flex: 1 }} disabled={saving || !hasInput}>
            {saving ? 'Wird gespeichert …' : <><Plus size={16} /> Hinzufügen</>}
          </button>
          {hasInput && (
            <button type="button" className="button ghost compact" onClick={clearAll} aria-label="Felder leeren">
              <X size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function NutritionView() {
  const { state, addMeal, removeMeal, addWater } = useNutrition();
  const { meals, totals, goals, water, loading, error } = state;

  const fatGoal   = Math.round((goals.calorieGoal * 0.28) / 9);
  const carbsGoal = Math.round((goals.calorieGoal - goals.proteinGoal * 4 - fatGoal * 9) / 4);

  const proteinKcal = Math.round(totals.proteinG * 4);
  const carbsKcal   = Math.round(totals.carbsG   * 4);
  const fatKcal     = Math.round(totals.fatG      * 9);

  const waterPct    = water.habit ? Math.min(100, Math.round((water.todayMl / water.habit.target) * 100)) : 0;
  const waterGlasses = Math.floor(water.todayMl / GLASS_ML);
  const waterTarget  = water.habit?.target ?? 2500;

  if (error && !meals.length) {
    return <div className="panel"><p className="copy" style={{ color: 'var(--danger)' }}>{error}</p></div>;
  }
  if (loading) {
    return <div className="panel"><p className="copy">Ernährung wird geladen …</p></div>;
  }

  return (
    <>
      {/* ── Header ────────────────────────────────────────────── */}
      <section className="panel">
        <p className="eyebrow">Ernährung</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Was du heute getankt hast.</h1>
      </section>

      {/* ── Kalorien-Balance ──────────────────────────────────── */}
      <section className="panel" style={{ textAlign: 'center' }}>
        {(() => {
          const remaining = goals.calorieGoal - totals.kcal;
          const isOver = remaining < 0;
          const pct = Math.min(100, Math.round((totals.kcal / Math.max(1, goals.calorieGoal)) * 100));
          return (
            <>
              <p style={{ fontSize: 48, fontWeight: 700, margin: '0 0 2px', color: isOver ? 'var(--danger)' : 'var(--teal)', lineHeight: 1 }}>
                {Math.abs(remaining).toLocaleString('de-DE')}
              </p>
              <p className="copy" style={{ margin: '0 0 14px', fontSize: 13 }}>
                kcal {isOver ? 'über deinem Tagesziel' : 'noch verfügbar heute'}
              </p>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: isOver ? 'var(--danger)' : 'var(--teal)', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              <p className="copy" style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--subtle)' }}>
                {totals.kcal.toLocaleString('de-DE')} von {goals.calorieGoal.toLocaleString('de-DE')} kcal gegessen ({pct}%)
              </p>
            </>
          );
        })()}
      </section>

      {/* ── Donut + Macros ────────────────────────────────────── */}
      <section className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <MacroDonut
          proteinKcal={proteinKcal} carbsKcal={carbsKcal} fatKcal={fatKcal}
          totalKcal={totals.kcal}   goalKcal={goals.calorieGoal}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="pill" style={{ background: 'rgba(107,217,173,0.15)', color: 'var(--teal)' }}>Protein</span>
          <span className="pill" style={{ background: 'rgba(201,162,39,0.15)', color: '#c9a227' }}>Kohlenhydrate</span>
          <span className="pill" style={{ background: 'rgba(217,96,96,0.15)', color: '#d96060' }}>Fette</span>
        </div>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <MacroBar label="Protein"       value={Math.round(totals.proteinG)} goal={goals.proteinGoal} unit="g" color="var(--teal)" />
          <MacroBar label="Kohlenhydrate" value={Math.round(totals.carbsG)}   goal={carbsGoal}         unit="g" color="#c9a227" />
          <MacroBar label="Fette"         value={Math.round(totals.fatG)}     goal={fatGoal}           unit="g" color="#d96060" />
        </div>
      </section>

      {/* ── Wasser ────────────────────────────────────────────── */}
      {water.habit && (
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Droplets size={18} color="var(--teal)" />
            <p className="h3" style={{ margin: 0 }}>Wasser</p>
            <span className="copy" style={{ margin: 0, marginLeft: 'auto' }}>
              {fmtWater(water.todayMl)} / {fmtWater(waterTarget)} ({waterPct}%)
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${waterPct}%`, background: 'var(--teal)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="button compact" style={{ flex: 1 }} onClick={() => void addWater(1)}>
              <Plus size={14} /> +1 Glas (250 ml)
            </button>
            {waterGlasses > 0 && (
              <button type="button" className="button ghost compact" onClick={() => void addWater(-1)} aria-label="Glas abziehen">−</button>
            )}
          </div>
        </section>
      )}

      {/* ── Mahlzeit hinzufügen ───────────────────────────────── */}
      <section className="panel">
        <p className="h3" style={{ marginBottom: 14 }}>Mahlzeit hinzufügen</p>
        <AddMealForm onAdd={addMeal} />
      </section>

      {/* ── Heute gegessen ────────────────────────────────────── */}
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="h3" style={{ margin: 0 }}>Heute gegessen</p>
          {meals.length > 0 && (
            <span className="copy" style={{ margin: 0, fontSize: 13 }}>{meals.length} {meals.length === 1 ? 'Eintrag' : 'Einträge'}</span>
          )}
        </div>
        {meals.length === 0 ? (
          <p className="copy" style={{ textAlign: 'center', padding: '20px 0', color: 'var(--subtle)' }}>
            Noch nichts eingetragen. Füge deine erste Mahlzeit oben hinzu.
          </p>
        ) : (
          <>
            {meals.map((meal) => (
              <MealRow key={meal.id} entry={meal} onDelete={(id) => void removeMeal(id)} />
            ))}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--subtle)' }}>Gesamt</span>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <strong style={{ fontSize: 13 }}>{totals.kcal} kcal</strong>
                <span style={{ color: 'var(--teal)' }}>P {Math.round(totals.proteinG)}g</span>
                <span style={{ color: '#c9a227' }}>K {Math.round(totals.carbsG)}g</span>
                <span style={{ color: '#d96060' }}>F {Math.round(totals.fatG)}g</span>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
