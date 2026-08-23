'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker so FORGE keeps working without a connection
 * (§44). Renders nothing, and stays silent when the browser has no support —
 * a failed registration must never surface to the user.
 *
 * It also reloads once when a new worker takes over. Without that, a phone
 * carrying an old worker keeps running the old app until every tab is closed,
 * which on an installed PWA can be weeks.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let reloading = false;
    const onControllerChange = () => {
      // Guard: skipWaiting + claim + reload would otherwise loop.
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    let registration: ServiceWorkerRegistration | null = null;
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => { registration = reg; })
        .catch(() => {
          // Offline support is an enhancement; the app works fine without it.
        });
    };

    // Re-checking when the app comes back to the foreground is what makes a
    // deployed fix actually reach an installed PWA.
    const onVisible = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {});
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
