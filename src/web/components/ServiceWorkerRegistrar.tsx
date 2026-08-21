'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker so FORGE keeps working without a connection
 * (§44). Renders nothing, and stays silent when the browser has no support —
 * a failed registration must never surface to the user.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is an enhancement; the app works fine without it.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
