'use client';

/**
 * Vorwaermen von Screens.
 *
 * Die Navigationslinks melden schon beim Hover oder beim Antippen — also vor
 * dem eigentlichen Klick —, wohin es gleich geht. Die AppShell baut den Screen
 * daraufhin unsichtbar im Hintergrund auf, sodass seine Daten bereits
 * unterwegs sind, wenn der Finger den Bildschirm wieder verlaesst.
 */
export const WARM_ROUTE_EVENT = 'forge:warm-route';

export function warmRoute(href: string) {
  if (typeof window === 'undefined' || !href.startsWith('/')) return;
  const path = href.split(/[?#]/, 1)[0] ?? href;
  window.dispatchEvent(new CustomEvent<string>(WARM_ROUTE_EVENT, { detail: path }));
}
