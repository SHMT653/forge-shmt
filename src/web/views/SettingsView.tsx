'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Target, ShieldCheck, Calculator } from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { useSettings } from '@/web/hooks/useSettings';
import { signOut } from '@/services/supabase/auth';
import { CardHead } from '@/web/components/CardHead';
import { formatDuration } from '@/domain/dates';
import { calculateMacros, GOAL_TYPE_LABELS, ACTIVITY_LABELS } from '@/domain/macroCalculator';
import type { ActivityLevel, Gender, GoalType, UserGoals } from '@/domain/types';

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
  const [autoCalc, setAutoCalc] = useState<{ calories: number; protein: number } | null>(null);

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
  }, [goals]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try { await saveName(name.trim()); } finally { setSavingProfile(false); }
  }

  function buildGoalsPayload(): UserGoals {
    return {
      calorieGoal:   Number(calorieGoal) || 2200,
      proteinGoal:   Number(proteinGoal) || 150,
      weightGoal:    weightGoal.trim() ? Number(weightGoal) : null,
      currentWeight: currentWeight.trim() ? Number(currentWeight) : null,
      heightCm:      heightCm.trim() ? Number(heightCm) : null,
      birthYear:     birthYear.trim() ? Number(birthYear) : null,
      gender,
      activityLevel,
      goalType,
    };
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
    setAutoCalc(null);
    try { await saveGoals(buildGoalsPayload()); } finally { setSavingGoals(false); }
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

          <CardHead icon={Target} tone="gold" title="Manuelle Ziele" />
          <p className="copy" style={{ marginTop: 4 }}>Diese Werte steuern die Fortschrittsanzeigen auf "Heute".</p>
          <div className="split-3" style={{ marginTop: 8 }}>
            <div className="field">
              <label className="field-label" htmlFor="calorieGoal">Kalorienziel (kcal)</label>
              <input id="calorieGoal" className="input compact" inputMode="numeric"
                value={calorieGoal} onChange={(e) => setCalorieGoal(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="proteinGoal">Proteinziel (g)</label>
              <input id="proteinGoal" className="input compact" inputMode="numeric"
                value={proteinGoal} onChange={(e) => setProteinGoal(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="weightGoal">Gewichtsziel (kg)</label>
              <input id="weightGoal" className="input compact" inputMode="decimal"
                value={weightGoal} onChange={(e) => setWeightGoal(e.target.value)} placeholder="optional" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="button compact" disabled={savingGoals}>
                {savingGoals ? 'Speichert …' : 'Ziele speichern'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Sign out */}
      <section className="panel">
        <CardHead icon={ShieldCheck} tone="danger" title="Sitzung" />
        <p className="copy">Melde dich ab, um das Konto zu wechseln oder FORGE auf einem anderen Gerät zu nutzen.</p>
        <button type="button" className="button danger compact" onClick={handleSignOut} disabled={signingOut}>
          <LogOut size={16} /> {signingOut ? 'Wird abgemeldet …' : 'Abmelden'}
        </button>
      </section>
    </>
  );
}
