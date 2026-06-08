'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/web/hooks/useAuth';
import { signInWithPassword, signUpWithPassword } from '@/services/supabase/auth';

type Mode = 'login' | 'register';

export function AuthView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password);
      } else {
        await signUpWithPassword(email, password, displayName.trim());
        setInfo('Konto erstellt. Falls eine Bestätigung nötig ist, prüfe dein Postfach — danach kannst du dich anmelden.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <Image src="/forge-logo.svg" alt="FORGE" width={96} height={96} className="auth-logo" />
          <div>
            <p className="h2">FORGE</p>
            <p className="copy">Dein persönliches Fortschrittssystem für Körper, Gewohnheiten und Disziplin.</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => setMode('login')}
          >
            Anmelden
          </button>
          <button
            type="button"
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => setMode('register')}
          >
            Registrieren
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="field">
              <label className="field-label" htmlFor="displayName">
                Name
              </label>
              <input
                id="displayName"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Wie sollen wir dich nennen?"
                required
              />
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="email">
              E-Mail
            </label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.de"
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">
              Passwort
            </label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          {error && <p className="auth-note" style={{ color: 'var(--danger)' }}>{error}</p>}
          {info && <p className="auth-note" style={{ color: 'var(--success)' }}>{info}</p>}

          <button type="submit" className="button block" disabled={submitting}>
            {submitting ? 'Einen Moment …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>

        <button
          type="button"
          className="auth-alt-link"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Bereits ein Konto? Anmelden'}
        </button>

        <p className="auth-note">Deine Daten werden sicher in der Cloud gespeichert und auf all deinen Geräten synchronisiert.</p>
      </div>
    </div>
  );
}
