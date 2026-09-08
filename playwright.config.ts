import { defineConfig, devices } from '@playwright/test';

/**
 * Rauchtest im echten Browser.
 *
 * Er braucht kein Konto: die Startseite leitet auf `/auth`, und genau dort
 * ist die App zuletzt gestorben. Fuer Tests hinter dem Login fehlen die
 * Supabase-Zugangsdaten lokal — die liegen nur in Vercel.
 */
const PORT = Number(process.env.E2E_PORT ?? 3001);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `PORT=${PORT} npm run start`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
