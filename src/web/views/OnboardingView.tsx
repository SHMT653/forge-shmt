'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { saveUserGoals } from '@/data/profile';
import { startPhase } from '@/data/goalPhases';
import { PHASES, PHASE_ORDER, resolveTargets, TARGET_FALLBACKS, type PhaseType } from '@/domain/goalPhase';
import { EQUIPMENT, TRAINING_FOCUS, type EquipmentId, type TrainingFocusId } from '@/domain/equipment';
import { ACTIVITY_LABELS } from '@/domain/macroCalculator';
import { todayKey } from '@/domain/dates';
import type { ActivityLevel, Gender, UserGoals } from '@/domain/types';

const PHASE_ICON: Record<PhaseType, string> = {
  cut: '🔥',
  recomp: '⚖️',
  lean_bulk: '💪',
  maintain: '🧘',
  custom: '⚙️',
};

const STEPS = ['Ziel', 'Körper', 'Aktivität', 'Training', 'Zielwerte'] as const;

/**
 * First-run setup (§26).
 *
 * Every number FORGE uses afterwards comes out of this flow. The app proposes,
 * the user decides — a suggestion is labelled as a suggestion and stays
 * editable on the last step (§27).
 */
export function OnboardingView({ goals, onDone }: { goals: UserGoals; onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [phaseType, setPhaseType] = useState<PhaseType>('recomp');
  const [gender, setGender] = useState<Gender>(goals.gender);
  const [birthYear, setBirthYear] = useState(goals.birthYear !== null ? String(goals.birthYear) : '');
  const [heightCm, setHeightCm] = useState(goals.heightCm !== null ? String(goals.heightCm) : '');
  const [currentWeight, setCurrentWeight] = useState(goals.currentWeight !== null ? String(goals.currentWeight) : '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(goals.activityLevel);
  const [equipment, setEquipment] = useState<EquipmentId[]>(goals.equipment);
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocusId[]>(goals.trainingFocus);
  const [weeklyTrainingGoal, setWeeklyTrainingGoal] = useState(String(goals.weeklyTrainingGoal ?? TARGET_FALLBACKS.weeklyTrainingGoal));

  // Editable target fields, seeded from the suggestion once we reach step 5.
  const [caloriesMin, setCaloriesMin] = useState('');
  const [caloriesMax, setCaloriesMax] = useState('');
  const [proteinMin, setProteinMin] = useState('');
  const [proteinMax, setProteinMax] = useState('');
  const [stepsGoal, setStepsGoal] = useState(String(TARGET_FALLBACKS.steps));
  const [waterGoalMl, setWaterGoalMl] = useState(String(TARGET_FALLBACKS.waterMl));
  const [sleepGoalH, setSleepGoalH] = useState(String(TARGET_FALLBACKS.sleepH));

  const draft: UserGoals = useMemo(
    () => ({
      ...goals,
      gender,
      birthYear: numberOrNull(birthYear),
      heightCm: numberOrNull(heightCm),
      currentWeight: numberOrNull(currentWeight),
      activityLevel,
      phaseType,
      caloriesMin: null,
      caloriesMax: null,
      proteinMin: null,
      proteinMax: null,
    }),
    [goals, gender, birthYear, heightCm, currentWeight, activityLevel, phaseType],
  );

  const suggestion = useMemo(() => resolveTargets(draft), [draft]);

  function goToTargets() {
    // Seed the editable fields from the proposal the moment we show them.
    setCaloriesMin(String(suggestion.calories.min));
    setCaloriesMax(String(suggestion.calories.max));
    setProteinMin(String(suggestion.protein.min));
    setProteinMax(String(suggestion.protein.max));
    setStep(4);
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const next: UserGoals = {
        ...draft,
        equipment,
        trainingFocus,
        weeklyTrainingGoal: numberOrNull(weeklyTrainingGoal),
        caloriesMin: numberOrNull(caloriesMin),
        caloriesMax: numberOrNull(caloriesMax),
        proteinMin: numberOrNull(proteinMin),
        proteinMax: numberOrNull(proteinMax),
        stepsGoal: numberOrNull(stepsGoal),
        waterGoalMl: numberOrNull(waterGoalMl),
        sleepGoalH: numberOrNull(sleepGoalH),
        onboardedAt: new Date().toISOString(),
      };

      await saveUserGoals(user.id, next);
      // The first phase starts today and stays open, so later phases can be
      // compared against it (§29).
      await startPhase(user.id, {
        phaseType,
        label: '',
        startDate: todayKey(),
        caloriesMin: next.caloriesMin,
        caloriesMax: next.caloriesMax,
        proteinMin: next.proteinMin,
        proteinMax: next.proteinMax,
        stepsGoal: next.stepsGoal,
        waterGoalMl: next.waterGoalMl,
        sleepGoalH: next.sleepGoalH,
        weeklyTrainingGoal: next.weeklyTrainingGoal,
        weightGoal: next.weightGoal,
        weeklyWeightChangeKg: null,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <p className="section-label">Einrichtung · Schritt {step + 1} von {STEPS.length}</p>
      <h1 className="h2" style={{ marginTop: 6, fontSize: 20 }}>{STEP_TITLE[step]}</h1>

      <div className="range-bar" style={{ marginTop: 12, marginBottom: 18 }}>
        <div className="range-bar-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--violet)' }} />
      </div>

      {step === 0 && (
        <div className="stack-sm">
          {PHASE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              className="habit-row"
              onClick={() => setPhaseType(type)}
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                borderColor: phaseType === type ? 'rgba(139,92,246,0.45)' : undefined,
                background: phaseType === type ? 'var(--violet-soft)' : undefined,
              }}
            >
              <span className="habit-icon" aria-hidden>{PHASE_ICON[type]}</span>
              <div className="habit-body">
                <p className="h3" style={{ fontSize: 14 }}>{PHASES[type].label}</p>
                <p className="muted-sm">{PHASES[type].short}</p>
              </div>
              {phaseType === type && <Check size={16} color="var(--violet)" />}
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="stack-sm">
          <div className="field">
            <label className="field-label">Geschlecht</label>
            <div className="chip-row">
              {(['male', 'female', 'other'] as Gender[]).map((value) => (
                <button key={value} type="button" className={`chip${gender === value ? ' active' : ''}`} onClick={() => setGender(value)}>
                  {value === 'male' ? 'Männlich' : value === 'female' ? 'Weiblich' : 'Keine Angabe'}
                </button>
              ))}
            </div>
          </div>
          <div className="split-3">
            <Field label="Geburtsjahr" value={birthYear} onChange={setBirthYear} placeholder="2006" />
            <Field label="Größe (cm)" value={heightCm} onChange={setHeightCm} placeholder="185" />
            <Field label="Gewicht (kg)" value={currentWeight} onChange={setCurrentWeight} placeholder="73" decimal />
          </div>
          <p className="muted-sm">Daraus schlägt FORGE deine Zielwerte vor. Ändern kannst du sie im letzten Schritt.</p>
        </div>
      )}

      {step === 2 && (
        <div className="stack-sm">
          {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              className={`chip${activityLevel === level ? ' active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => setActivityLevel(level)}
            >
              {ACTIVITY_LABELS[level]}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <div>
            <p className="section-label">Verfügbares Equipment</p>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {EQUIPMENT.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${equipment.includes(item.id) ? ' active' : ''}`}
                  onClick={() => setEquipment((prev) => toggle(prev, item.id))}
                >
                  <span aria-hidden>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="section-label">Fokus</p>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {TRAINING_FOCUS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${trainingFocus.includes(item.id) ? ' active' : ''}`}
                  onClick={() => setTrainingFocus((prev) => toggle(prev, item.id))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Trainingseinheiten pro Woche" value={weeklyTrainingGoal} onChange={setWeeklyTrainingGoal} placeholder="3" />
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <div className="panel soft" style={{ padding: 12 }}>
            <p className="section-label">Vorgeschlagen</p>
            <p className="copy" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>
              {suggestion.calories.min.toLocaleString('de-DE')}–{suggestion.calories.max.toLocaleString('de-DE')} kcal
              {' · '}{suggestion.protein.min}–{suggestion.protein.max} g Protein
            </p>
            <p className="muted-sm" style={{ marginTop: 4 }}>
              Ein Vorschlag auf Basis deiner Angaben — keine Vorgabe. Passe alles an, was für dich nicht stimmt.
            </p>
          </div>

          <div className="split">
            <Field label="Kalorien von" value={caloriesMin} onChange={setCaloriesMin} />
            <Field label="Kalorien bis" value={caloriesMax} onChange={setCaloriesMax} />
            <Field label="Protein von (g)" value={proteinMin} onChange={setProteinMin} />
            <Field label="Protein bis (g)" value={proteinMax} onChange={setProteinMax} />
          </div>
          <div className="split-3">
            <Field label="Schritte" value={stepsGoal} onChange={setStepsGoal} />
            <Field label="Wasser (ml)" value={waterGoalMl} onChange={setWaterGoalMl} />
            <Field label="Schlaf (h)" value={sleepGoalH} onChange={setSleepGoalH} decimal />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        {step > 0 && (
          <button type="button" className="button secondary" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft size={16} /> Zurück
          </button>
        )}
        {step < 3 && (
          <button type="button" className="button" style={{ flex: 1 }} onClick={() => setStep((s) => s + 1)}>
            Weiter <ArrowRight size={16} />
          </button>
        )}
        {step === 3 && (
          <button type="button" className="button" style={{ flex: 1 }} onClick={goToTargets}>
            Zielwerte ansehen <ArrowRight size={16} />
          </button>
        )}
        {step === 4 && (
          <button type="button" className="button" style={{ flex: 1 }} onClick={finish} disabled={saving}>
            {saving ? 'Wird gespeichert …' : 'Los geht’s'} <Check size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

const STEP_TITLE = [
  'Was möchtest du erreichen?',
  'Deine Körperdaten',
  'Wie aktiv bist du?',
  'Wie und womit trainierst du?',
  'Deine Zielwerte',
];

function Field({
  label,
  value,
  onChange,
  placeholder,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  decimal?: boolean;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="input compact"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...(placeholder ? { placeholder } : {})}
      />
    </div>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
