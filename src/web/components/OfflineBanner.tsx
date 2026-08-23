'use client';

import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';

/**
 * Says when the connection is gone.
 *
 * Gyms are basements. The service worker keeps the app opening offline, but
 * nothing can be saved — and a set that silently fails to save is worse than
 * one the user knows to re-enter. This states the situation instead of letting
 * a tap look like it worked.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // navigator.onLine is only meaningful in the browser, and only after mount:
    // rendering it on the server would hydrate the wrong state.
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status">
      <CloudOff size={14} />
      <span>Offline — Einträge werden erst gespeichert, wenn du wieder Verbindung hast.</span>
    </div>
  );
}
