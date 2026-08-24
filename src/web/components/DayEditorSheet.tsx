'use client';

import { useEffect, useState } from 'react';
import { Trash2, Check, Footprints, Moon, Scale, Dumbbell, Utensils } from 'lucide-react';
import { Sheet } from './Sheet';
import type { DayDetail } from '@/data/overview';
import type { DayRating } from '@/domain/dayRating';
import type { MealEntryInput, } from '@/data/nutrition';
import { formatSleep } from '@/domain/health';
import { slotForHour } from '@/domain/nutritionMath';
import { TONE_COLOR } from '@/domain/goalPhase';
import { parseDecimalOr } from '@/domain/numbers';

/**
 * Opens one day for review and correction.
 *
 * Everything here writes to the date being viewed, not to today — the whole
 * point is catching up on a day you forgot. The repositories already take an
 * explicit date, so a backdated entry follows the same path as a live one.
 */
export function DayEditorSheet({
  date,
  rating,
  load,
  onClose,
  onAddMeal,
  onRemoveMeal,
  onSetSteps,
  onSetSleep,
  onSetWeight,
}: {
  date: string;
  rating: DayRating | undefined;
  load: (date: string) => Promise<DayDetail | null>;
  onClose: () => void;
  onAddMeal: (date: string, entry: MealEntryInput) => Promise<void>;
  onRemoveMeal: (date: string, id: string) => Promise<void>;
  onSetSteps: (date: string, steps: number) => Promise<void>;
  onSetSleep: (date: string, hours: number) => Promise<void>;
  onSetWeight: (date: string, kg: number) => Promise<void>;
}) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [mealName, setMealName] = useState('');
  const [mealKcal, setMealKcal] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [steps, setSteps] = useState('');
  const [sleep, setSleep] = useState('');
  const [weight, setWeight] = useState('');

  const refresh = async () => {
    setLoading(true);
    const result = await load(date);
    setDetail(result);
    setSteps(result?.steps !== null && result?.steps !== undefined ? String(result.steps) : '');
    setSleep(result?.sleepMinutes ? String(Math.round((result.sleepMinutes / 60) * 100) / 100) : '');
    setWeight(result?.weightKg !== null && result?.weightKg !== undefined ? String(result.weightKg) : '');
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitMeal() {
    const kcal = parseDecimalOr(mealKcal, 0);
    const proteinG = parseDecimalOr(mealProtein, 0);
    if (!kcal && !proteinG) return;
    const remaining = Math.max(0, kcal - proteinG * 4);
    await run(async () => {
      await onAddMeal(date, {
        name: mealName.trim() || `${kcal} kcal`,
        macros: {
          kcal,
          proteinG,
          carbsG: Math.round((remaining * 0.62) / 4),
          fatG: Math.round((remaining * 0.38) / 9),
        },
        dataQuality: 'verified',
        source: 'manual',
        slot: slotForHour(12),
        // Backdated entries are stamped at midday on that date so they land in
        // the right place on the timeline instead of "now".
        loggedAt: `${date}T12:00:00.000Z`,
      });
      setMealName('');
      setMealKcal('');
      setMealProtein('');
    });
  }

  const totals = (detail?.meals ?? []).reduce(
    (acc, meal) => ({ kcal: acc.kcal + meal.kcal, proteinG: acc.proteinG + meal.proteinG }),
    { kcal: 0, proteinG: 0 },
  );

  return (
    <Sheet title={formatLongDate(date)} onClose={onClose}>
      {rating?.hasData && rating.score !== null && (
        <div className="row-between">
          <span className="readout">
            <span className="readout-value" style={{ fontSize: 26, color: TONE_COLOR[rating.tone] }}>
              {rating.score.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="readout-unit">/ 10</span>
          </span>
          {rating.notes.length > 0 && (
            <span className="muted-sm" style={{ textAlign: 'right' }}>{rating.notes.slice(0, 2).join(' · ')}</span>
          )}
        </div>
      )}

      {loading ? (
        <p className="muted-sm">Wird geladen …</p>
      ) : (
        <>
          {/* ── Overview ─────────────────────────────────────────────── */}
          <div>
            <div className="day-stat">
              <span className="day-stat-label"><Utensils size={14} /> Ernährung</span>
              <span className="day-stat-value">
                {Math.round(totals.kcal).toLocaleString('de-DE')} kcal · {Math.round(totals.proteinG)} g P
              </span>
            </div>
            <div className="day-stat">
              <span className="day-stat-label"><Footprints size={14} /> Schritte</span>
              <span className="day-stat-value">
                {detail?.steps ? detail.steps.toLocaleString('de-DE') : '–'}
              </span>
            </div>
            <div className="day-stat">
              <span className="day-stat-label"><Moon size={14} /> Schlaf</span>
              <span className="day-stat-value">
                {formatSleep(detail?.sleepMinutes ?? null)}
              </span>
            </div>
            <div className="day-stat">
              <span className="day-stat-label"><Scale size={14} /> Gewicht</span>
              <span className="day-stat-value">{detail?.weightKg ? `${detail.weightKg} kg` : '–'}</span>
            </div>
            <div className="day-stat">
              <span className="day-stat-label"><Dumbbell size={14} /> Training</span>
              <span className="day-stat-value">
                {detail?.sessions.length
                  ? detail.sessions.map((s) => `${s.dayName}${s.kind === 'mini' ? ' (Mini)' : ''}`).join(', ')
                  : '–'}
              </span>
            </div>
          </div>

          {/* ── Meals on that day ────────────────────────────────────── */}
          {(detail?.meals.length ?? 0) > 0 && (
            <div className="stack-sm">
              <p className="section-label">Mahlzeiten</p>
              {detail?.meals.map((meal) => (
                <div key={meal.id} className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <p className="h3" style={{ fontSize: 13 }}>
                      {meal.name}
                      {meal.dataQuality !== 'verified' && (
                        <span className="quality-badge estimated" style={{ marginLeft: 6 }}>geschätzt</span>
                      )}
                    </p>
                    <p className="muted-sm">{Math.round(meal.kcal)} kcal · {Math.round(meal.proteinG)} g P</p>
                  </div>
                  <button
                    type="button"
                    className="icon-button danger"
                    disabled={busy}
                    onClick={() => void run(() => onRemoveMeal(date, meal.id))}
                    aria-label="Löschen"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Add for this day ─────────────────────────────────────── */}
          <div className="stack-sm">
            <p className="section-label">Nachtragen</p>
            <input
              className="input"
              placeholder="Was hast du gegessen?"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              aria-label="Mahlzeit"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input className="input compact" inputMode="numeric" placeholder="kcal" value={mealKcal} onChange={(e) => setMealKcal(e.target.value)} aria-label="Kalorien" />
              <input className="input compact" inputMode="decimal" placeholder="Protein" value={mealProtein} onChange={(e) => setMealProtein(e.target.value)} aria-label="Protein" />
              <button type="button" className="button compact" disabled={busy || (!mealKcal && !mealProtein)} onClick={submitMeal}>
                <Check size={15} />
              </button>
            </div>
          </div>

          <div className="split-3">
            <QuickField label="Schritte" value={steps} onChange={setSteps} busy={busy} onSave={(v) => run(() => onSetSteps(date, v))} />
            <QuickField label="Schlaf (h)" value={sleep} onChange={setSleep} busy={busy} decimal onSave={(v) => run(() => onSetSleep(date, v))} />
            <QuickField label="Gewicht (kg)" value={weight} onChange={setWeight} busy={busy} decimal onSave={(v) => run(() => onSetWeight(date, v))} />
          </div>
        </>
      )}
    </Sheet>
  );
}

function QuickField({
  label,
  value,
  onChange,
  onSave,
  busy,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onSave: (value: number) => void;
  busy: boolean;
  decimal?: boolean;
}) {
  const parsed = parseDecimalOr(value, Number.NaN);
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="input compact"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minWidth: 0 }}
        />
        <button
          type="button"
          className="icon-button"
          disabled={busy || !valid}
          onClick={() => valid && onSave(parsed)}
          aria-label={`${label} speichern`}
        >
          <Check size={15} />
        </button>
      </div>
    </div>
  );
}

function formatLongDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
