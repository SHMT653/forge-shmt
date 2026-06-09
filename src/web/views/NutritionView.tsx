'use client';

import { useRef, useState } from 'react';
import { Search, Plus, Trash2, Droplets } from 'lucide-react';
import { useNutrition } from '@/web/hooks/useNutrition';
import { searchFood, estimateMacros } from '@/domain/foodDatabase';
import type { FoodItem } from '@/domain/foodDatabase';

const GLASS_ML = 250;

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

  const filled = Math.min(totalKcal / cap, 1);
  const pct    = Math.round(filled * 100);

  return (
    <svg width={128} height={128} viewBox="0 0 128 128" aria-label={`${totalKcal} von ${goalKcal} kcal`}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      {/* Macro segments, rotated to start at top */}
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={sw}
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.dashoffset}
          />
        ))}
      </g>
      {/* Center text */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text)" fontSize={22} fontWeight={700}>
        {totalKcal}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--subtle)" fontSize={10}>
        von {goalKcal} kcal
      </text>
      <text x={cx} y={cy + 23} textAnchor="middle" fill="var(--subtle)" fontSize={10}>
        {pct}%
      </text>
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
        <span className="copy" style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{label}</span>
        <span className="copy" style={{ margin: 0, fontSize: 13 }}>
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
        <p className="h3" style={{ margin: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{entry.kcal} kcal</span>
          <span style={{ fontSize: 11, color: 'var(--teal)' }}>P {entry.proteinG}g</span>
          <span style={{ fontSize: 11, color: '#c9a227' }}>K {entry.carbsG}g</span>
          <span style={{ fontSize: 11, color: '#d96060' }}>F {entry.fatG}g</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(entry.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 4, flexShrink: 0 }}
        aria-label="Mahlzeit entfernen"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function NutritionView() {
  const { state, addMeal, removeMeal, addWater } = useNutrition();
  const { meals, totals, goals, water, loading, error } = state;

  const [foodQuery, setFoodQuery]   = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [manualName, setManualName]   = useState('');
  const [manualKcal, setManualKcal]   = useState('');
  const [manualProt, setManualProt]   = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat]     = useState('');
  const [saving, setSaving]           = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Derived goals
  const fatGoal   = Math.round((goals.calorieGoal * 0.28) / 9);
  const carbsGoal = Math.round((goals.calorieGoal - goals.proteinGoal * 4 - fatGoal * 9) / 4);

  // Macro kcal for donut
  const proteinKcal = Math.round(totals.proteinG * 4);
  const carbsKcal   = Math.round(totals.carbsG   * 4);
  const fatKcal     = Math.round(totals.fatG      * 9);

  function handleSearch(q: string) {
    setFoodQuery(q);
    setFoodResults(q.trim().length >= 2 ? searchFood(q) : []);
  }

  function selectFood(item: FoodItem) {
    const { carbsG, fatG } = estimateMacros(item);
    setManualName(item.name);
    setManualKcal(String(item.kcal));
    setManualProt(String(item.proteinG));
    setManualCarbs(String(carbsG));
    setManualFat(String(fatG));
    setFoodQuery('');
    setFoodResults([]);
    searchRef.current?.focus();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const kcal = Number(manualKcal) || 0;
    if (!kcal && !manualName) return;
    setSaving(true);
    try {
      await addMeal({
        name:     manualName || `${kcal} kcal`,
        kcal,
        proteinG: Number(manualProt)  || 0,
        carbsG:   Number(manualCarbs) || 0,
        fatG:     Number(manualFat)   || 0,
      });
      setManualName(''); setManualKcal(''); setManualProt(''); setManualCarbs(''); setManualFat('');
    } finally {
      setSaving(false);
    }
  }

  if (error && !meals.length) {
    return <div className="panel"><p className="copy" style={{ color: 'var(--danger)' }}>{error}</p></div>;
  }

  if (loading) {
    return <div className="panel"><p className="copy">Ernährung wird geladen …</p></div>;
  }

  const waterPct = water.habit
    ? Math.min(100, Math.round((water.todayMl / water.habit.target) * 100))
    : 0;
  const waterGlasses = Math.floor(water.todayMl / GLASS_ML);
  const waterTarget  = water.habit?.target ?? 2500;

  return (
    <>
      {/* ── Header ──────────────────────────────────────────── */}
      <section className="panel">
        <p className="eyebrow">Ernährung</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Was du heute getankt hast.</h1>
      </section>

      {/* ── Donut + Macros ──────────────────────────────────── */}
      <section className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <MacroDonut
          proteinKcal={proteinKcal}
          carbsKcal={carbsKcal}
          fatKcal={fatKcal}
          totalKcal={totals.kcal}
          goalKcal={goals.calorieGoal}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="pill" style={{ background: 'rgba(107,217,173,0.15)', color: 'var(--teal)' }}>Protein</span>
          <span className="pill" style={{ background: 'rgba(201,162,39,0.15)', color: '#c9a227' }}>Kohlenhydrate</span>
          <span className="pill" style={{ background: 'rgba(217,96,96,0.15)', color: '#d96060' }}>Fette</span>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <MacroBar label="Protein"        value={Math.round(totals.proteinG)} goal={goals.proteinGoal} unit="g" color="var(--teal)" />
          <MacroBar label="Kohlenhydrate"  value={Math.round(totals.carbsG)}   goal={carbsGoal}         unit="g" color="#c9a227" />
          <MacroBar label="Fette"          value={Math.round(totals.fatG)}     goal={fatGoal}           unit="g" color="#d96060" />
        </div>
      </section>

      {/* ── Wasser ──────────────────────────────────────────── */}
      {water.habit && (
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Droplets size={18} color="var(--teal)" />
            <p className="h3" style={{ margin: 0 }}>Wasser</p>
            <span className="copy" style={{ margin: 0, marginLeft: 'auto' }}>
              {water.todayMl} / {waterTarget} ml ({waterPct}%)
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

      {/* ── Mahlzeit hinzufügen ─────────────────────────────── */}
      <section className="panel">
        <p className="h3" style={{ marginBottom: 12 }}>Mahlzeit hinzufügen</p>

        {/* Food search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div className="search-field">
            <Search size={14} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Lebensmittel suchen (z. B. Hähnchen, Reis …)"
              value={foodQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoComplete="off"
              aria-label="Lebensmittel suchen"
            />
          </div>
          {foodResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
              background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius)', marginTop: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 260, overflowY: 'auto',
            }}>
              {foodResults.map((item) => {
                const { carbsG, fatG } = estimateMacros(item);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => selectFood(item)}
                    className="nav-button"
                    style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: 'var(--text)' }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>{item.portionLabel}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{item.kcal} kcal</span>
                      <span style={{ fontSize: 11, color: 'var(--teal)' }}>P {item.proteinG}g</span>
                      <span style={{ fontSize: 11, color: '#c9a227' }}>K {carbsG}g</span>
                      <span style={{ fontSize: 11, color: '#d96060' }}>F {fatG}g</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Manual form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="input compact"
            placeholder="Name (z. B. Mittagessen)"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
          <div className="button-row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">kcal</label>
              <input className="input compact" inputMode="numeric" placeholder="0" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Protein g</label>
              <input className="input compact" inputMode="numeric" placeholder="0" value={manualProt} onChange={(e) => setManualProt(e.target.value)} />
            </div>
          </div>
          <div className="button-row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Kohlenhydrate g</label>
              <input className="input compact" inputMode="numeric" placeholder="0" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Fette g</label>
              <input className="input compact" inputMode="numeric" placeholder="0" value={manualFat} onChange={(e) => setManualFat(e.target.value)} />
            </div>
          </div>
          <button
            type="submit"
            className="button"
            disabled={saving || (!manualKcal && !manualName)}
            style={{ marginTop: 4 }}
          >
            {saving ? 'Wird gespeichert …' : <><Plus size={16} /> Hinzufügen</>}
          </button>
        </form>
      </section>

      {/* ── Heute gegessen ──────────────────────────────────── */}
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="h3" style={{ margin: 0 }}>Heute gegessen</p>
          {meals.length > 0 && (
            <span className="copy" style={{ margin: 0, fontSize: 13 }}>
              {meals.length} {meals.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          )}
        </div>

        {meals.length === 0 ? (
          <p className="copy" style={{ textAlign: 'center', padding: '20px 0' }}>
            Noch nichts eingetragen. Füge deine erste Mahlzeit hinzu.
          </p>
        ) : (
          <>
            {meals.map((meal) => (
              <MealRow key={meal.id} entry={meal} onDelete={(id) => void removeMeal(id)} />
            ))}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
              <span className="copy" style={{ margin: 0, fontSize: 13 }}>Gesamt</span>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <strong style={{ color: 'var(--text)', fontSize: 13 }}>{totals.kcal} kcal</strong>
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
