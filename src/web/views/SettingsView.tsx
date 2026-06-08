'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Target, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { useSettings } from '@/web/hooks/useSettings';
import { signOut } from '@/services/supabase/auth';
import { CardHead } from '@/web/components/CardHead';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours} Std ${minutes} Min`;
  return `${minutes} Min`;
}

export function SettingsView() {
  const { user } = useAuth();
  const { profile, goals, stats, loading, error, saveName, saveGoals } = useSettings();
  const router = useRouter();

  const [name, setName] = useState('');
  const [calorieGoal, setCalorieGoal] = useState('');
  const [proteinGoal, setProteinGoal] = useState('');
  const [weightGoal, setWeightGoal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (profile) setName(profile.displayName);
  }, [profile]);

  useEffect(() => {
    if (goals) {
      setCalorieGoal(String(goals.calorieGoal));
      setProteinGoal(String(goals.proteinGoal));
      setWeightGoal(goals.weightGoal !== null ? String(goals.weightGoal) : '');
    }
  }, [goals]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await saveName(name.trim());
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleGoalsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingGoals(true);
    try {
      await saveGoals({
        calorieGoal: Number(calorieGoal) || 2200,
        proteinGoal: Number(proteinGoal) || 150,
        weightGoal: weightGoal.trim() ? Number(weightGoal) : null,
      });
    } finally {
      setSavingGoals(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/auth');
    } finally {
      setSigningOut(false);
    }
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

      <section className="panel">
        <CardHead icon={User} tone="violet" title="Profil" />
        <form className="auth-form" style={{ marginTop: 12 }} onSubmit={handleProfileSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="displayName">Name</label>
            <input id="displayName" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <button type="submit" className="button secondary compact" disabled={savingProfile}>{savingProfile ? 'Speichert …' : 'Speichern'}</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <CardHead icon={Target} tone="teal" title="Ziele" />
        <p className="copy">Diese Werte steuern die Fortschrittsanzeigen auf "Heute".</p>
        <form className="split" style={{ marginTop: 12, gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }} onSubmit={handleGoalsSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="calorieGoal">Kalorienziel (kcal)</label>
            <input id="calorieGoal" className="input compact" inputMode="numeric" value={calorieGoal} onChange={(e) => setCalorieGoal(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="proteinGoal">Proteinziel (g)</label>
            <input id="proteinGoal" className="input compact" inputMode="numeric" value={proteinGoal} onChange={(e) => setProteinGoal(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="weightGoal">Gewichtsziel (kg)</label>
            <input id="weightGoal" className="input compact" inputMode="decimal" value={weightGoal} onChange={(e) => setWeightGoal(e.target.value)} placeholder="optional" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="button secondary compact" disabled={savingGoals}>{savingGoals ? 'Speichert …' : 'Ziele speichern'}</button>
          </div>
        </form>
      </section>

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
