'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, LogOut, Moon, User, Target, ShieldCheck, Calculator } from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { useSettings } from '@/web/hooks/useSettings';
import { signOut } from '@/services/supabase/auth';
import { GOALS_DEFAULTS } from '@/data/profile';
import { CardHead } from '@/web/components/CardHead';
import { formatDuration } from '@/domain/dates';
import { calculateMacros, GOAL_TYPE_LABELS, ACTIVITY_LABELS } from '@/domain/macroCalculator';
import { GOAL_CATEGORIES, FASTING_PROTOCOLS, getProgram } from '@/domain/programs';
import { PHASES, PHASE_ORDER, resolveTargets, type PhaseType } from '@/domain/goalPhase';
import { EQUIPMENT, TRAINING_FOCUS, type EquipmentId, type TrainingFocusId } from '@/domain/equipment';
import { startPhase } from '@/data/goalPhases';
import { todayKey } from '@/domain/dates';
import type { ActivityLevel, Gender, GoalType, UserGoals } from '@/domain/types';
import type { ProgramId, FastingProtocol } from '@/domain/programs';
import { parseDecimal, parseDecimalOr } from '@/domain/numbers';
import { DataDeleteCard } from '@/web/components/DataDeleteCard';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseDecimalOr(trimmed, Number.NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="habit-row" style={{ padding: '12px 14px' }}>
      <div className="habit-body">
        <p className="h3" style={{ fontSize: 14 }}>{label}</p>
        <p className="muted-sm">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`habit-toggle${checked ? ' done' : ''}`}
      >
        {checked ? '✓' : ''}
      </button>
    </div>
  );
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male',   label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
  { value: 'other',  label: 'Keine Angabe' },
];

export function SettingsView() {
  const { user } = useAuth();
  const { profile, goals, stats, loading, error, saveName, saveGoals } = useSettings();
  const router = useRouter();

  const [name, setName] = useState('');
  const [calorieGoal, setCalorieGoal] = useState('');
  const [proteinGoal, setProteinGoal] = useState('');
  const [weightGoal, setWeightGoal] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState<Gender>('other');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goalType, setGoalType] = useState<GoalType>('maintain');
  const [programId, setProgramId] = useState<ProgramId | null>(null);
  const [fastingProtocol, setFastingProtocol] = useState<FastingProtocol | null>(null);
  const [fastingStartHour, setFastingStartHour] = useState(12);
  const [autoCalc, setAutoCalc] = useState<{ calories: number; protein: number } | null>(null);

  // ── Phase, ranges, tracking routine and feature switches (§44/§70) ──
  const [phaseType, setPhaseType] = useState<PhaseType | null>(null);
  const [caloriesMin, setCaloriesMin] = useState('');
  const [caloriesMax, setCaloriesMax] = useState('');
  const [proteinMin, setProteinMin] = useState('');
  const [proteinMax, setProteinMax] = useState('');
  const [stepsGoal, setStepsGoal] = useState('');
  const [waterGoalMl, setWaterGoalMl] = useState('');
  const [sleepGoalH, setSleepGoalH] = useState('');
  const [weighInWeekday, setWeighInWeekday] = useState(0);
  const [photoIntervalDays, setPhotoIntervalDays] = useState(14);
  const [progressStartDate, setProgressStartDate] = useState('');
  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocusId[]>([]);
  const [weeklyTrainingGoal, setWeeklyTrainingGoal] = useState('3');
  // Remembers which phase was active when the form loaded, so we can tell a
  // real phase switch from an ordinary edit.
  const [loadedPhase, setLoadedPhase] = useState<PhaseType | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (profile) setName(profile.displayName);
  }, [profile]);

  useEffect(() => {
    if (!goals) return;
    setCalorieGoal(String(goals.calorieGoal));
    setProteinGoal(String(goals.proteinGoal));
    setWeightGoal(goals.weightGoal !== null ? String(goals.weightGoal) : '');
    setCurrentWeight(goals.currentWeight !== null ? String(goals.currentWeight) : '');
    setHeightCm(goals.heightCm !== null ? String(goals.heightCm) : '');
    setBirthYear(goals.birthYear !== null ? String(goals.birthYear) : '');
    setGender(goals.gender);
    setActivityLevel(goals.activityLevel);
    setGoalType(goals.goalType);
    setProgramId(goals.programId);
    setFastingProtocol(goals.fastingProtocol);
    setFastingStartHour(goals.fastingStartHour ?? 12);

    // Show the ranges FORGE is actually using, whether stored or derived —
    // an empty box would hide the fact that a real target already exists.
    const resolved = resolveTargets(goals);
    setPhaseType(goals.phaseType);
    setCaloriesMin(String(resolved.calories.min));
    setCaloriesMax(String(resolved.calories.max));
    setProteinMin(String(resolved.protein.min));
    setProteinMax(String(resolved.protein.max));
    setStepsGoal(String(resolved.steps));
    setWaterGoalMl(String(resolved.waterMl));
    setSleepGoalH(String(resolved.sleepH));
    setWeighInWeekday(goals.weighInWeekday);
    setPhotoIntervalDays(goals.photoIntervalDays);
    setProgressStartDate(goals.progressStartDate ?? '');
    setFastingEnabled(goals.fastingEnabled);
    setEquipment(goals.equipment);
    setTrainingFocus(goals.trainingFocus);
    setWeeklyTrainingGoal(String(resolved.weeklyTrainingGoal));
    setLoadedPhase(goals.phaseType);
  }, [goals]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try { await saveName(name.trim()); } finally { setSavingProfile(false); }
  }

  function buildGoalsPayload(): UserGoals {
    return {
      // Spread first so phase ranges, tracking routine and feature switches
      // survive a save from this form — it only edits a subset of the fields.
      ...(goals ?? GOALS_DEFAULTS),
      calorieGoal:     parseDecimalOr(calorieGoal, 2200),
      proteinGoal:     parseDecimalOr(proteinGoal, 150),
      weightGoal:      parseDecimal(weightGoal),
      currentWeight:   parseDecimal(currentWeight),
      heightCm:        parseDecimal(heightCm),
      birthYear:       parseDecimal(birthYear),
      gender,
      activityLevel,
      goalType,
      programId,
      fastingProtocol,
      fastingStartHour: fastingProtocol ? fastingStartHour : null,
      phaseType,
      caloriesMin: numberOrNull(caloriesMin),
      caloriesMax: numberOrNull(caloriesMax),
      proteinMin: numberOrNull(proteinMin),
      proteinMax: numberOrNull(proteinMax),
      stepsGoal: numberOrNull(stepsGoal),
      waterGoalMl: numberOrNull(waterGoalMl),
      sleepGoalH: numberOrNull(sleepGoalH),
      weighInWeekday,
      photoIntervalDays,
      progressStartDate: progressStartDate || null,
      fastingEnabled,
      equipment,
      trainingFocus,
      weeklyTrainingGoal: numberOrNull(weeklyTrainingGoal),
    };
  }

  /** Applies the recommended range for a phase, so picking one is a single tap. */
  function applyPhase(next: PhaseType) {
    setPhaseType(next);
    const preview = resolveTargets({
      ...(goals ?? GOALS_DEFAULTS),
      phaseType: next,
      caloriesMin: null,
      caloriesMax: null,
      proteinMin: null,
      proteinMax: null,
    });
    setCaloriesMin(String(preview.calories.min));
    setCaloriesMax(String(preview.calories.max));
    setProteinMin(String(preview.protein.min));
    setProteinMax(String(preview.protein.max));
  }

  function handleAutoCalc() {
    const payload = buildGoalsPayload();
    const result = calculateMacros(payload);
    if (!result) return;
    setAutoCalc(result);
    setCalorieGoal(String(result.calories));
    setProteinGoal(String(result.protein));
  }

  async function handleGoalsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingGoals(true);
    try {
      const payload = buildGoalsPayload();
      await saveGoals(payload);

      // Changing the phase closes the old one and opens a new one, so the
      // history keeps a real date range for each (§29).
      if (user && phaseType && phaseType !== loadedPhase) {
        await startPhase(user.id, {
          phaseType,
          label: '',
          startDate: todayKey(),
          caloriesMin: payload.caloriesMin,
          caloriesMax: payload.caloriesMax,
          proteinMin: payload.proteinMin,
          proteinMax: payload.proteinMax,
          stepsGoal: payload.stepsGoal,
          waterGoalMl: payload.waterGoalMl,
          sleepGoalH: payload.sleepGoalH,
          weeklyTrainingGoal: payload.weeklyTrainingGoal,
          weightGoal: payload.weightGoal,
          weeklyWeightChangeKg: null,
        });
        setLoadedPhase(phaseType);
      }
    } finally {
      setSavingGoals(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); router.push('/auth'); } finally { setSigningOut(false); }
  }

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Einstellungen</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Dein Konto.</h1>
        <p className="copy">{user?.email}</p>
      </section>

      {error && <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!loading && stats && (
        <section className="metric-grid">
          <div className="metric-card">
            <span className="metric-value">{stats.sessionCount}</span>
            <span className="metric-label">Trainings abgeschlossen</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{formatDuration(stats.totalSeconds)}</span>
            <span className="metric-label">Trainingszeit gesamt</span>
          </div>
          <div className="metric-card">
            <span className="metric-value sync-row"><span className="sync-dot online" /></span>
            <span className="metric-label">Cloud Sync aktiv</span>
          </div>
        </section>
      )}

      {/* Profile */}
      <section className="panel">
        <CardHead icon={User} tone="violet" title="Profil" />
        <form className="auth-form" style={{ marginTop: 12 }} onSubmit={handleProfileSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="displayName">Name</label>
            <input id="displayName" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <button type="submit" className="button secondary compact" disabled={savingProfile}>
              {savingProfile ? 'Speichert …' : 'Speichern'}
            </button>
          </div>
        </form>
      </section>

      {/* Fitness profile */}
      <section className="panel">
        <CardHead icon={Calculator} tone="teal" title="Körper & Ziel" />
        <p className="copy">Mit diesen Angaben berechnet FORGE automatisch dein Kalorien- und Proteinziel.</p>
        <form style={{ marginTop: 12 }} onSubmit={handleGoalsSubmit}>
          <div className="split-3" style={{ marginBottom: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="currentWeight">Aktuelles Gewicht (kg)</label>
              <input id="currentWeight" className="input compact" inputMode="decimal"
                value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} placeholder="z. B. 80" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="heightCm">Körpergröße (cm)</label>
              <input id="heightCm" className="input compact" inputMode="numeric"
                value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="z. B. 180" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="birthYear">Geburtsjahr</label>
              <input id="birthYear" className="input compact" inputMode="numeric"
                value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="z. B. 1995" />
            </div>
          </div>

          <div className="split-3" style={{ marginBottom: 16 }}>
            <div className="field">
              <label className="field-label" htmlFor="gender">Geschlecht</label>
              <select id="gender" className="input compact" value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="activityLevel">Aktivitätslevel</label>
              <select id="activityLevel" className="input compact" value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}>
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="goalType">Ziel</label>
              <select id="goalType" className="input compact" value={goalType}
                onChange={(e) => setGoalType(e.target.value as GoalType)}>
                {Object.entries(GOAL_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="button secondary compact"
            style={{ marginBottom: 16, width: '100%' }}
            onClick={handleAutoCalc}
            disabled={!currentWeight.trim() || !heightCm.trim() || !birthYear.trim()}
          >
            <Calculator size={16} /> Ziele automatisch berechnen (BMR/TDEE)
          </button>

          {autoCalc && (
            <div className="panel soft" style={{ marginBottom: 16 }}>
              <p className="copy" style={{ margin: 0, fontWeight: 700 }}>
                Berechnetes Ziel: {autoCalc.calories} kcal · {autoCalc.protein} g Protein
              </p>
              <p className="copy" style={{ margin: '4px 0 0', fontSize: 12 }}>
                Basierend auf Mifflin-St-Jeor Formel × Aktivitätsfaktor · Ziel: {GOAL_TYPE_LABELS[goalType]}
              </p>
            </div>
          )}

          <CardHead icon={Target} tone="gold" title="Phase & Zielbereiche" />
          <p className="copy" style={{ marginTop: 4 }}>
            FORGE arbeitet mit Zielbereichen statt einer harten Zahl — du bist entweder darin, darunter
            oder darüber, und alle drei haben eine ruhige Antwort.
          </p>

          <div className="chip-row" style={{ marginTop: 10 }}>
            {PHASE_ORDER.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip${phaseType === type ? ' active' : ''}`}
                onClick={() => applyPhase(type)}
              >
                {PHASES[type].label}
              </button>
            ))}
          </div>
          {phaseType && (
            <p className="muted-sm" style={{ marginTop: 8 }}>{PHASES[phaseType].description}</p>
          )}

          <div className="split" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="caloriesMin">Kalorien von</label>
              <input id="caloriesMin" className="input compact" inputMode="numeric"
                value={caloriesMin} onChange={(e) => setCaloriesMin(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="caloriesMax">Kalorien bis</label>
              <input id="caloriesMax" className="input compact" inputMode="numeric"
                value={caloriesMax} onChange={(e) => setCaloriesMax(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="proteinMin">Protein von (g)</label>
              <input id="proteinMin" className="input compact" inputMode="decimal"
                value={proteinMin} onChange={(e) => setProteinMin(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="proteinMax">Protein bis (g)</label>
              <input id="proteinMax" className="input compact" inputMode="decimal"
                value={proteinMax} onChange={(e) => setProteinMax(e.target.value)} />
            </div>
          </div>

          <div className="split-3" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="stepsGoal">Schritte / Tag</label>
              <input id="stepsGoal" className="input compact" inputMode="numeric"
                value={stepsGoal} onChange={(e) => setStepsGoal(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="waterGoalMl">Wasser (ml)</label>
              <input id="waterGoalMl" className="input compact" inputMode="numeric"
                value={waterGoalMl} onChange={(e) => setWaterGoalMl(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="sleepGoalH">Schlaf (h)</label>
              <input id="sleepGoalH" className="input compact" inputMode="decimal"
                value={sleepGoalH} onChange={(e) => setSleepGoalH(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="weightGoal">Gewichtsziel (kg)</label>
              <input id="weightGoal" className="input compact" inputMode="decimal"
                value={weightGoal} onChange={(e) => setWeightGoal(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>
              Alte Einzelwerte
            </summary>
            <div className="split" style={{ marginTop: 10 }}>
              <div className="field">
                <label className="field-label" htmlFor="calorieGoal">Kalorienziel (kcal)</label>
                <input id="calorieGoal" className="input compact" inputMode="numeric"
                  value={calorieGoal} onChange={(e) => setCalorieGoal(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="proteinGoal">Proteinziel (g)</label>
                <input id="proteinGoal" className="input compact" inputMode="decimal"
                  value={proteinGoal} onChange={(e) => setProteinGoal(e.target.value)} />
              </div>
            </div>
            <p className="muted-sm" style={{ marginTop: 6 }}>
              Werden nur noch als Rückfallwert genutzt, wenn kein Bereich gesetzt ist.
            </p>
          </details>

          {/* ── Tracking routine (§26/§27) ── */}
          <div style={{ marginTop: 18 }}>
            <CardHead icon={Calculator} tone="teal" title="Tracking" />
            <div className="split" style={{ marginTop: 10 }}>
              <div className="field">
                <label className="field-label" htmlFor="weighDay">Wiegetag</label>
                <select id="weighDay" className="select" value={weighInWeekday}
                  onChange={(e) => setWeighInWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="photoInterval">Foto-Intervall (Tage)</label>
                <input id="photoInterval" className="input compact" inputMode="numeric"
                  value={String(photoIntervalDays)}
                  onChange={(e) => setPhotoIntervalDays(Number(e.target.value) || 14)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="progressStart">Startdatum Fortschritt</label>
                <input
                  id="progressStart"
                  className="input compact"
                  type="date"
                  max={todayKey()}
                  value={progressStartDate}
                  onChange={(e) => setProgressStartDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── Training setup (§32/§33) ── */}
          <div style={{ marginTop: 18 }}>
            <CardHead icon={Target} tone="violet" title="Training" />
            <p className="copy" style={{ marginTop: 4, fontSize: 13 }}>
              Womit trainierst du und worauf willst du hinaus? Danach richten sich Mini-Sessions,
              Planvorschläge und die Übungsauswahl.
            </p>

            <p className="section-label" style={{ marginTop: 12 }}>Equipment</p>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {EQUIPMENT.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${equipment.includes(item.id) ? ' active' : ''}`}
                  onClick={() => setEquipment((prev) => (prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]))}
                >
                  <span aria-hidden>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>

            <p className="section-label" style={{ marginTop: 14 }}>Fokus</p>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {TRAINING_FOCUS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${trainingFocus.includes(item.id) ? ' active' : ''}`}
                  onClick={() => setTrainingFocus((prev) => (prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]))}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="field" style={{ marginTop: 14, maxWidth: 240 }}>
              <label className="field-label" htmlFor="weeklyTraining">Einheiten pro Woche</label>
              <input id="weeklyTraining" className="input compact" inputMode="numeric"
                value={weeklyTrainingGoal} onChange={(e) => setWeeklyTrainingGoal(e.target.value)} />
            </div>
          </div>

          {/* ── Feature switches (§41/§70) ── */}
          <div style={{ marginTop: 18 }}>
            <CardHead icon={ShieldCheck} tone="violet" title="Funktionen" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              <ToggleRow
                label="Essensfenster"
                hint="Intervallfasten ist optional — ohne diesen Schalter taucht es nirgends auf."
                checked={fastingEnabled}
                onChange={(next) => { setFastingEnabled(next); if (!next) setFastingProtocol(null); }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="submit" className="button compact" disabled={savingGoals}>
              {savingGoals ? 'Speichert …' : 'Ziele speichern'}
            </button>
          </div>
        </form>
      </section>

      {/* Apple Health (§9) — renders a plain explanation in the browser */}

      {/* Goal selection — specific goals in categories */}
      <section className="panel">
        <CardHead icon={Target} tone="violet" title="Mein Ziel" />
        <p className="copy" style={{ marginTop: 6 }}>Was willst du erreichen? Wähle dein genaues Ziel — die App passt sich komplett darauf an.</p>

        {GOAL_CATEGORIES.map((cat) => (
          <div key={cat.id} style={{ marginTop: 18 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {cat.icon} {cat.label}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cat.programs.map((p) => {
                const active = programId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProgramId(active ? null : p.id)}
                    style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                      border: `1.5px solid ${active ? p.accentColor : 'rgba(255,255,255,0.08)'}`,
                      background: active ? `${p.accentColor}14` : 'rgba(255,255,255,0.02)',
                      touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                      transition: 'border-color 0.15s, background 0.15s',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: active ? p.accentColor : 'var(--text)' }}>{p.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.4 }}>{p.tagline}</p>
                    </div>
                    {active && (
                      <span style={{ fontSize: 16, color: p.accentColor, flexShrink: 0 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {programId && (() => {
          const p = getProgram(programId);
          if (!p) return null;
          return (
            <div style={{ marginTop: 16, padding: '14px', background: `${p.accentColor}10`, border: `1px solid ${p.accentColor}30`, borderRadius: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: p.accentColor }}>{p.icon} {p.title}</p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{p.description}</p>
              <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }}>
                {p.highlights.map((h) => (
                  <li key={h} style={{ fontSize: 12, color: 'var(--subtle)', marginBottom: 3 }}>{h}</li>
                ))}
              </ul>
              <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 600, color: p.accentColor }}>
                💡 {p.tip}
              </p>
            </div>
          );
        })()}

        <div style={{ marginTop: 14 }}>
          <button type="button" className="button compact" onClick={() => void saveGoals(buildGoalsPayload())} disabled={savingGoals}>
            {savingGoals ? 'Speichert …' : 'Ziel speichern'}
          </button>
        </div>
      </section>

      {/* Intervallfasten — only when the user turned it on (§41) */}
      {fastingEnabled && (
      <section className="panel">
        <CardHead icon={Moon} tone="violet" title="Intervallfasten" />
        <p className="copy" style={{ marginTop: 6 }}>Wähle ein Fastenprogramm oder deaktiviere es. Der Timer läuft dann auf deiner Startseite.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 14 }}>
          {/* "Kein Fasten" option */}
          <button
            type="button"
            onClick={() => setFastingProtocol(null)}
            style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', gridColumn: '1 / -1',
              border: `1.5px solid ${fastingProtocol === null ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
              background: fastingProtocol === null ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
              touchAction: 'manipulation',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Kein Intervallfasten</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--subtle)' }}>Fasten deaktiviert</p>
          </button>

          {FASTING_PROTOCOLS.map((fp) => {
            const active = fastingProtocol === fp.id;
            return (
              <button
                key={fp.id}
                type="button"
                onClick={() => setFastingProtocol(fp.id)}
                style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  border: `1.5px solid ${active ? '#a990ff' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(123,92,240,0.15)' : 'rgba(255,255,255,0.02)',
                  touchAction: 'manipulation',
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: active ? '#a990ff' : 'var(--text)' }}>{fp.shortTitle}</p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.35 }}>{fp.description}</p>
              </button>
            );
          })}
        </div>

        {fastingProtocol && fastingProtocol !== '5:2' && (
          <div style={{ marginTop: 14 }}>
            <label className="field-label">Essensfenster beginnt um</label>
            <select
              className="select"
              value={String(fastingStartHour)}
              onChange={(e) => setFastingStartHour(Number(e.target.value))}
              style={{ marginTop: 6 }}
            >
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00 Uhr</option>
              ))}
            </select>
            <p className="copy" style={{ marginTop: 6, fontSize: 12 }}>
              {(() => {
                const fp = FASTING_PROTOCOLS.find((p) => p.id === fastingProtocol);
                if (!fp) return '';
                const endHour = (fastingStartHour + fp.eatHours) % 24;
                return `Essensfenster: ${String(fastingStartHour).padStart(2,'0')}:00 – ${String(endHour).padStart(2,'0')}:00 · Fasten: ${String(endHour).padStart(2,'0')}:00 – ${String(fastingStartHour).padStart(2,'0')}:00`;
              })()}
            </p>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <button type="button" className="button compact" onClick={() => void saveGoals(buildGoalsPayload())} disabled={savingGoals}>
            {savingGoals ? 'Speichert …' : 'Fasten speichern'}
          </button>
        </div>
      </section>
      )}

      {/* Sign out */}
      <section className="panel">
        <CardHead icon={ShieldCheck} tone="danger" title="Sitzung" />
        <p className="copy">Melde dich ab, um das Konto zu wechseln oder FORGE auf einem anderen Gerät zu nutzen.</p>
        <button type="button" className="button danger compact" onClick={handleSignOut} disabled={signingOut}>
          <LogOut size={16} /> {signingOut ? 'Wird abgemeldet …' : 'Abmelden'}
        </button>

        {/* ── Deleting stored data (§14) ── */}
        <div style={{ marginTop: 18 }}>
          <CardHead icon={Trash2} tone="violet" title="Gespeicherte Daten" />
          <DataDeleteCard />
        </div>
      </section>
    </>
  );
}
