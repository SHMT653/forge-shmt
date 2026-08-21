import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the existing FORGE web app; it does not replace it (§1).
 *
 * The app is loaded from the deployed Next.js site rather than a bundled
 * export, because FORGE's AI routes are server handlers — a static export
 * would have to drop them. The service worker caches the shell, so the
 * container still works offline after the first launch (§44).
 *
 * Set FORGE_APP_URL when building for a different environment. `webDir` only
 * holds the offline fallback page; the live site is the real source.
 */
const appUrl = process.env.FORGE_APP_URL ?? 'https://forge.shmt.app';

const config: CapacitorConfig = {
  appId: 'de.shmt.forge',
  appName: 'FORGE',
  webDir: 'public/shell',
  server: {
    url: appUrl,
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    // The web layer paints its own background; matching it avoids a white
    // flash between the splash screen and first paint.
    backgroundColor: '#0a0a0d',
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#0a0a0d',
      showSpinner: false,
      launchAutoHide: true,
    },
  },
};

export default config;
