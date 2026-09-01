'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

/**
 * Besuchte Screens bleiben montiert.
 *
 * Vorher hat jeder Tab-Wechsel den alten Screen abgeraeumt und den neuen bei
 * null anfangen lassen: Spinner, Supabase-Abfrage, dann erst Inhalt — und beim
 * Zurueckwechseln dasselbe nochmal. Jetzt haelt die AppShell jeden einmal
 * geoeffneten Screen montiert und blendet die inaktiven nur aus. Der Klick
 * tauscht damit nur, was zu sehen ist. Dieselbe Datei liegt spiegelbildlich
 * in Neo.
 */
const RoutePaneActiveContext = createContext(true);

export function RoutePane({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <RoutePaneActiveContext.Provider value={active}>
      <div className="route-pane" hidden={!active} aria-hidden={!active || undefined}>
        {children}
      </div>
    </RoutePaneActiveContext.Provider>
  );
}

/** True, solange der umgebende Screen sichtbar ist (ausserhalb einer Flaeche immer true). */
export function useRoutePaneActive() {
  return useContext(RoutePaneActiveContext);
}

/**
 * Laedt nach, wenn der Screen nach laengerer Pause wieder sichtbar wird —
 * beim Tab-Wechsel ebenso wie beim Zurueckkommen aus dem Hintergrund. Der
 * alte Stand steht dabei schon da; die Abfrage laeuft leise dahinter.
 */
export function useRefreshWhenVisible(refresh: () => void, staleAfterMs = 20_000) {
  const active = useRoutePaneActive();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const lastRefresh = useRef(0);

  // Frisch montiert heisst frisch geladen — auch im Hintergrund.
  useEffect(() => {
    lastRefresh.current = Date.now();
  }, []);

  useEffect(() => {
    if (!active) return;

    function refreshIfStale() {
      const now = Date.now();
      if (now - lastRefresh.current < staleAfterMs) return;
      lastRefresh.current = now;
      refreshRef.current();
    }

    refreshIfStale();

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refreshIfStale();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [active, staleAfterMs]);
}
