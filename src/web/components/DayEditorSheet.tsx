'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Check, Footprints, Moon, Scale, Dumbbell, Utensils, Camera } from 'lucide-react';
import { Sheet } from './Sheet';
import type { DayDetail } from '@/data/overview';
import type { DayRating } from '@/domain/dayRating';
import type { MealEntryInput, } from '@/data/nutrition';
import { formatSleep } from '@/domain/health';
import { slotForHour } from '@/domain/nutritionMath';
import { TONE_COLOR } from '@/domain/goalPhase';
import { parseDecimalOr } from '@/domain/numbers';
import type { PhotoPose, WorkoutKind } from '@/domain/types';

const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Vorne' },
  { value: 'side', label: 'Seitlich' },
  { value: 'back', label: 'Rücken' },
  { value: 'front_flexed', label: 'Angespannt' },
];

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
  onLogWorkout,
  planDays,
  onRemoveMeal,
  onSetSteps,
  onSetSleep,
  onSetWeight,
  onAddPhoto,
}: {
  date: string;
  rating: DayRating | undefined;
  load: (date: string) => Promise<DayDetail | null>;
  onClose: () => void;
  onAddMeal: (date: string, entry: MealEntryInput) => Promise<void>;
  /** Records a workout that already happened on that day. */
  onLogWorkout: (date: string, input: { dayName: string; kind: WorkoutKind; durationMinutes: number; planDayId: string | null }) => Promise<void>;
  /** Days of the active plan, so a back-filled workout can carry its name. */
  planDays: readonly { id: string; name: string }[];
  onRemoveMeal: (date: string, id: string) => Promise<void>;
  onSetSteps: (date: string, steps: number) => Promise<void>;
  onSetSleep: (date: string, hours: number) => Promise<void>;
  onSetWeight: (date: string, kg: number) => Promise<void>;
  onAddPhoto: (date: string, file: File, pose: PhotoPose, weightKg: number | null) => Promise<void>;
}) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [mealName, setMealName] = useState('');
  const [mealKcal, setMealKcal] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [steps, setSteps] = useState('');
  const [sleep, setSleep] = useState('');
  const [workoutDay, setWorkoutDay] = useState('');
  const [workoutName, setWorkoutName] = useState('');
  const [workoutMinutes, setWorkoutMinutes] = useState('');
  const [workoutKind, setWorkoutKind] = useState<WorkoutKind>('full');
  const [weight, setWeight] = useState('');
  const [photoPose, setPhotoPose] = useState<PhotoPose>('front');
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  async function submitWorkout() {
    const picked = planDays.find((d) => d.id === workoutDay);
    const name = picked?.name ?? workoutName.trim();
    if (!name) return;
    await run(async () => {
      await onLogWorkout(date, {
        dayName: name,
        kind: workoutKind,
        durationMinutes: parseDecimalOr(workoutMinutes, 45),
        planDayId: picked?.id ?? null,
      });
      setWorkoutName('');
      setWorkoutMinutes('');
      setWorkoutDay('');
    });
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

  async function handlePhotoFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (!file) return;
    await run(() => onAddPhoto(date, file, photoPose, detail?.weightKg ?? null));
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
            <div className="day-stat">
              <span className="day-stat-label"><Camera size={14} /> Fotos</span>
              <span className="day-stat-value">
                {detail?.photos.length ? `${detail.photos.length} eingetragen` : '–'}
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

          {/* ── A workout that happened but was never logged ─────────── */}
          <div className="stack-sm">
            <p className="section-label">Training nachtragen</p>
            {planDays.length > 0 ? (
              <select
                className="input"
                value={workoutDay}
                onChange={(e) => setWorkoutDay(e.target.value)}
                aria-label="Trainingstag"
              >
                <option value="">Freie Eingabe</option>
                {planDays.map((day) => (
                  <option key={day.id} value={day.id}>{day.name}</option>
                ))}
              </select>
            ) : null}
            {workoutDay === '' && (
              <input
                className="input"
                placeholder="z. B. Oberkörper"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                aria-label="Name des Trainings"
              />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input
                className="input compact"
                inputMode="numeric"
                placeholder="Minuten"
                value={workoutMinutes}
                onChange={(e) => setWorkoutMinutes(e.target.value)}
                aria-label="Dauer in Minuten"
              />
              <select
                className="input compact"
                value={workoutKind}
                onChange={(e) => setWorkoutKind(e.target.value === 'mini' ? 'mini' : 'full')}
                aria-label="Art des Trainings"
              >
                <option value="full">Volle Einheit</option>
                <option value="mini">Mini-Session</option>
              </select>
              <button
                type="button"
                className="button compact"
                disabled={busy || (workoutDay === '' && !workoutName.trim())}
                onClick={submitWorkout}
                aria-label="Training eintragen"
              >
                <Check size={15} />
              </button>
            </div>
          </div>

          <div className="split-3">
            <QuickField label="Schritte" value={steps} onChange={setSteps} busy={busy} onSave={(v) => run(() => onSetSteps(date, v))} />
            <QuickField label="Schlaf (h)" value={sleep} onChange={setSleep} busy={busy} decimal onSave={(v) => run(() => onSetSleep(date, v))} />
            <QuickField label="Gewicht (kg)" value={weight} onChange={setWeight} busy={busy} decimal onSave={(v) => run(() => onSetWeight(date, v))} />
          </div>

          <div className="stack-sm">
            <p className="section-label">Fortschrittsfoto nachtragen</p>
            <div className="chip-row">
              {POSES.map((pose) => (
                <button
                  key={pose.value}
                  type="button"
                  className={`chip${photoPose === pose.value ? ' active' : ''}`}
                  disabled={busy}
                  onClick={() => setPhotoPose(pose.value)}
                >
                  {pose.label}
                </button>
              ))}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoFile}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="button secondary block"
              disabled={busy}
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera size={15} /> Foto für diesen Tag wählen
            </button>
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
