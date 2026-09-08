import { test, expect } from '@playwright/test';

/**
 * Startet die App ueberhaupt?
 *
 * Klingt banal, war es aber nicht: FORGE stand live auf "Laedt ..." und
 * reagierte auf gar nichts mehr. Ursache war ein `.remove()` auf den
 * `theme-color`-Metas, die Next aus dem `viewport`-Export rendert — die
 * gehoeren Reacts Baum. Nach dem Entfernen zeigte React auf abgehaengte
 * Knoten und starb beim naechsten Wechsel mit `parentNode.removeChild`. Ab da
 * ging kein Tab mehr auf.
 *
 * Weder Build noch `tsc` noch die Unit-Tests haben davon etwas gemerkt. Nur
 * ein echter Browser sieht so etwas — deshalb dieser Test.
 */
test('die App startet ohne JavaScript-Fehler', async ({ page }) => {
  const fehler: string[] = [];
  page.on('pageerror', (error) => fehler.push(error.message));
  page.on('console', (message) => {
    if (message.text().includes('cannot contain a nested')) fehler.push(message.text());
  });

  await page.goto('/');
  await page.waitForURL((url) => url.pathname === '/auth', { timeout: 20_000 });

  // Die Anmeldemaske muss wirklich dastehen — nicht nur "Laedt ...".
  await expect(page.getByRole('button').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Lädt', { exact: false })).toHaveCount(0);

  expect(fehler, `JavaScript-Fehler beim Start:\n${fehler.join('\n')}`).toEqual([]);
});

test('Next liefert keine theme-color-Metas mehr aus', async ({ request }) => {
  // Der Kern des Fehlers: solange `viewport.themeColor` in app/layout.tsx
  // steht, rendert Next diese Tags in Reacts Baum — und `applyThemeColor`
  // hat sie danach herausgerissen. Deshalb hier das rohe Server-HTML pruefen,
  // bevor JavaScript ueberhaupt laeuft. Am fertig gerenderten DOM sieht man
  // es nicht: dort steht am Ende so oder so genau ein Tag.
  const html = await (await request.get('/auth')).text();
  expect(html, 'viewport.themeColor darf keine theme-color-Metas erzeugen')
    .not.toMatch(/name="theme-color"[^>]*media=|media=[^>]*name="theme-color"/);
});
