'use client';

import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import { CardHead } from '@/web/components/CardHead';
import { ACCENTS, ACCENT_HUES, ACCENT_LABELS, useTheme } from '@/web/hooks/useTheme';

/**
 * Hell/Dunkel + Akzentfarbe. Die Wahl wird mit NEO abgeglichen, damit alle
 * drei SHMT-Apps gleich aussehen — dieselbe Karte steht auch in Neo und Vault.
 */
export function DesignPanel() {
  const { theme, accent, themeSource, setTheme, setAccent, followSystem } = useTheme();

  return (
    <section className="panel">
      <CardHead icon={Palette} tone="violet" title="Design" />
      <p className="copy">
        Gilt für alle drei SHMT-Apps — NEO, FORGE und VAULT übernehmen die Wahl.
      </p>

      <p className="field-label" style={{ marginTop: 16 }}>Modus</p>
      <div className="pill-row" style={{ marginTop: 6 }}>
        <button
          type="button"
          className={`pill${themeSource === 'user' && theme === 'light' ? ' active' : ''}`}
          onClick={() => setTheme('light')}
        >
          <Sun size={13} /> Hell
        </button>
        <button
          type="button"
          className={`pill${themeSource === 'user' && theme === 'dark' ? ' active' : ''}`}
          onClick={() => setTheme('dark')}
        >
          <Moon size={13} /> Dunkel
        </button>
        <button
          type="button"
          className={`pill${themeSource === 'system' ? ' active' : ''}`}
          onClick={followSystem}
        >
          <Monitor size={13} /> System
        </button>
      </div>

      <p className="field-label" style={{ marginTop: 18 }}>Akzentfarbe</p>
      <div className="pill-row" style={{ marginTop: 6 }}>
        {ACCENTS.map((option) => (
          <button
            key={option}
            type="button"
            className={`pill${accent === option ? ' active' : ''}`}
            onClick={() => setAccent(option)}
          >
            <span
              aria-hidden
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: ACCENT_HUES[option],
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28)',
              }}
            />
            {ACCENT_LABELS[option]}
          </button>
        ))}
      </div>
    </section>
  );
}
