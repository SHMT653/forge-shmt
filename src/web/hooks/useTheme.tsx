'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabaseClient } from '@/services/supabase/client';
import { useAuth } from '@/web/hooks/useAuth';

export type Theme = 'light' | 'dark';
export type AccentColor = 'lilac' | 'pink' | 'red' | 'navy' | 'sky' | 'white' | 'black';
export type ThemeSource = 'user' | 'system';

export const ACCENTS: AccentColor[] = ['lilac', 'pink', 'red', 'navy', 'sky', 'white', 'black'];

const DEFAULT_ACCENT: AccentColor = 'lilac';

export const ACCENT_LABELS: Record<AccentColor, string> = {
  lilac: 'Lilak',
  pink: 'Pink',
  red: 'Rot',
  navy: 'Dunkelblau',
  sky: 'Babyblau',
  white: 'Weiß',
  black: 'Schwarz',
};

export const ACCENT_HUES: Record<AccentColor, string> = {
  lilac: '#8b5cf6',
  pink: '#ec4899',
  red: '#ef4444',
  navy: '#3b82f6',
  sky: '#0ea5e9',
  white: '#71717a',
  black: '#525252',
};

/**
 * Systemleisten-Farbe (Safari-Toolbar, Android-Statusleiste, PWA-Titelleiste)
 * an das gewaehlte App-Theme angleichen — sonst behaelt die Leiste die Farbe
 * des Systemmodus und passt nicht zur App.
 */
function applyThemeColor(theme: Theme) {
  const color = theme === 'dark' ? '#08070c' : '#f4f5fb';
  document.head.querySelectorAll('meta[name="theme-color"][media]').forEach((el) => el.remove());
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

/** `"dark:pink"` → `{ theme, accent }`. */
export function parseThemePreference(value: string | null | undefined): { theme: Theme; accent: AccentColor } | null {
  if (!value) return null;
  const [themePart, accentPart] = value.split(':');
  if (themePart !== 'light' && themePart !== 'dark') return null;
  return {
    theme: themePart,
    accent: ACCENTS.includes(accentPart as AccentColor) ? (accentPart as AccentColor) : DEFAULT_ACCENT,
  };
}

export function serializeThemePreference(theme: Theme, accent: AccentColor) {
  return `${theme}:${accent}`;
}

interface ThemeContextValue {
  theme: Theme;
  accent: AccentColor;
  /** 'system' = folgt der Systemeinstellung, 'user' = bewusst gewaehlt. */
  themeSource: ThemeSource;
  setTheme: (t: Theme) => void;
  setAccent: (accent: AccentColor) => void;
  toggleTheme: () => void;
  /** Zurueck auf automatisches Umschalten mit dem System. */
  followSystem: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  accent: DEFAULT_ACCENT,
  themeSource: 'system',
  setTheme: () => {},
  setAccent: () => {},
  toggleTheme: () => {},
  followSystem: () => {},
});

function apply(theme: Theme, accent: AccentColor, source: ThemeSource) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.setAttribute('data-accent', accent);
  applyThemeColor(theme);
  try {
    localStorage.setItem('theme-mode', theme);
    localStorage.setItem('theme-accent', accent);
    localStorage.setItem('theme-source', source);
  } catch {
    /* privater Modus – dann gilt nur die laufende Sitzung */
  }
}

/** Schickt die Wahl an NEO, damit alle drei Apps gleich aussehen. */
async function pushToNeo(preference: string) {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch('/api/design', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ theme: preference }),
    });
  } catch {
    /* Design ist kein kritischer Zustand – lokal gilt die Wahl trotzdem */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('dark');
  const [accent, setAccentState] = useState<AccentColor>(DEFAULT_ACCENT);
  const [themeSource, setThemeSourceState] = useState<ThemeSource>('system');

  // Erst lokal (kein Flackern), dann dem System folgen, falls nichts gewaehlt.
  useEffect(() => {
    let storedMode: Theme | null = null;
    let storedAccent: AccentColor | null = null;
    let storedSource: string | null = null;
    try {
      storedMode = localStorage.getItem('theme-mode') as Theme | null;
      storedAccent = localStorage.getItem('theme-accent') as AccentColor | null;
      storedSource = localStorage.getItem('theme-source');
    } catch {
      /* ignorieren */
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const chosen = storedSource === 'system' ? null : storedMode;
    const initialTheme: Theme = chosen ?? (media.matches ? 'dark' : 'light');
    const initialAccent = storedAccent ?? DEFAULT_ACCENT;

    apply(initialTheme, initialAccent, chosen ? 'user' : 'system');
    setThemeState(initialTheme);
    setAccentState(initialAccent);
    setThemeSourceState(chosen ? 'user' : 'system');

    const onChange = (e: MediaQueryListEvent) => {
      let source: string | null = null;
      try {
        source = localStorage.getItem('theme-source');
      } catch {
        /* ignorieren */
      }
      if (source === 'user') return;
      const next: Theme = e.matches ? 'dark' : 'light';
      apply(next, initialAccent, 'system');
      setThemeState(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Wahl aus NEO nachziehen, sobald jemand angemeldet ist.
  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const res = await fetch('/api/design', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;

        const body = (await res.json()) as { theme?: string | null };
        const shared = parseThemePreference(body.theme);
        if (!active || !shared) return;

        apply(shared.theme, shared.accent, 'user');
        setThemeState(shared.theme);
        setAccentState(shared.accent);
        setThemeSourceState('user');
      } catch {
        /* NEO nicht erreichbar – die lokale Wahl bleibt gueltig */
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const setTheme = useCallback(
    (next: Theme) => {
      apply(next, accent, 'user');
      setThemeState(next);
      setThemeSourceState('user');
      void pushToNeo(serializeThemePreference(next, accent));
    },
    [accent],
  );

  const setAccent = useCallback(
    (next: AccentColor) => {
      apply(theme, next, 'user');
      setAccentState(next);
      setThemeSourceState('user');
      void pushToNeo(serializeThemePreference(theme, next));
    },
    [theme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const followSystem = useCallback(() => {
    const next: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    apply(next, accent, 'system');
    setThemeState(next);
    setThemeSourceState('system');
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ theme, accent, themeSource, setTheme, setAccent, toggleTheme, followSystem }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
