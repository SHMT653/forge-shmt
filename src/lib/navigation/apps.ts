/**
 * Registry der drei SHMT-Apps.
 *
 * NEO (Haushalt), FORGE (Training & Ernährung) und VAULT (Finanzen) sind
 * eigenstaendige Deployments, sollen sich fuer die Nutzung aber wie ein
 * System anfuehlen. Diese Liste ist die eine Quelle fuer den App-Umschalter;
 * dieselbe Datei liegt spiegelbildlich in Neo und Vault.
 */

export type ShmtAppId = 'neo' | 'forge' | 'vault';

export interface ShmtApp {
  id: ShmtAppId;
  name: string;
  /** Kurzbeschreibung – erscheint als Tooltip im Umschalter. */
  tagline: string;
  url: string;
  /** Markenfarbe der App – nur fuer den Punkt im Umschalter. */
  hue: string;
}

/** Diese App. In Neo/Vault steht hier entsprechend 'neo' bzw. 'vault'. */
export const CURRENT_APP: ShmtAppId = 'forge';

function url(envValue: string | undefined, fallback: string) {
  return (envValue ?? fallback).replace(/\/$/, '');
}

export const SHMT_APPS: ShmtApp[] = [
  {
    id: 'neo',
    name: 'NEO',
    tagline: 'Haushalt & Alltag',
    url: url(process.env.NEXT_PUBLIC_NEO_URL, 'https://neo-shmt.vercel.app'),
    hue: '#8b5cf6',
  },
  {
    id: 'forge',
    name: 'FORGE',
    tagline: 'Training & Ernährung',
    url: url(process.env.NEXT_PUBLIC_FORGE_URL, 'https://forge-shmt.vercel.app'),
    hue: '#f0c674',
  },
  {
    id: 'vault',
    name: 'VAULT',
    tagline: 'Finanzen & Zähler',
    url: url(process.env.NEXT_PUBLIC_VAULT_URL, 'https://vault-shmt.vercel.app'),
    hue: '#5fd6c4',
  },
];

export const OTHER_APPS = SHMT_APPS.filter((app) => app.id !== CURRENT_APP);
