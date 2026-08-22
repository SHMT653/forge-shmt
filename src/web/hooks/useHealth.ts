'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { resolveHealthProvider, type HealthProvider } from '@/services/health';
import { syncHealth, type SyncOutcome } from '@/services/health/sync';
import { getHealthConnection, saveHealthConnection, type HealthConnection } from '@/data/dailyHealth';
import { errorMessage } from '@/domain/errors';
import { HEALTH_ROLLOUT, type HealthMetricKey } from '@/domain/health';

export type HealthState = {
  /** Null while we are still working out where we are running. */
  provider: HealthProvider | null;
  available: boolean;
  supported: HealthMetricKey[];
  granted: HealthMetricKey[];
  connection: HealthConnection;
  syncing: boolean;
  lastOutcome: SyncOutcome | null;
  error: string | null;
  loading: boolean;
};

const EMPTY_CONNECTION: HealthConnection = { connected: false, grantedTypes: [], lastSyncedAt: null, lastError: null };

/**
 * Health integration state for the UI.
 *
 * In a browser this settles on `available: false` and every control that
 * depends on it simply does not render — no broken buttons, no error toast
 * about a platform the user is not on (§5).
 */
export function useHealth(options: { autoSync?: boolean } = {}) {
  const autoSync = options.autoSync ?? false;
  const { user } = useAuth();
  const [state, setState] = useState<HealthState>({
    provider: null,
    available: false,
    supported: [],
    granted: [],
    connection: EMPTY_CONNECTION,
    syncing: false,
    lastOutcome: null,
    error: null,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const provider = await resolveHealthProvider();
      // "Available" here has to mean "can actually serve health data", not
      // "a provider object exists". The manual provider reports itself as
      // available — correctly, as a provider — but supports no metrics, and
      // conflating the two put a dead "Verbinden" button in the browser.
      const supported = provider.supportedMetrics();
      const available = supported.length > 0 && (await provider.isAvailable());
      const [granted, connection] = await Promise.all([
        available ? provider.grantedMetrics() : Promise.resolve([] as HealthMetricKey[]),
        getHealthConnection(user.id),
      ]);
      setState((prev) => ({
        ...prev,
        provider,
        available,
        supported,
        granted,
        connection,
        error: null,
        loading: false,
      }));
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: errorMessage(err, 'Health-Status nicht lesbar.') }));
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = useCallback(
    async (opts: { days?: number } = {}) => {
      if (!user || !state.provider || !state.available) return null;
      setState((prev) => ({ ...prev, syncing: true }));
      try {
        const outcome = await syncHealth(state.provider, user.id, opts);
        const connection = await getHealthConnection(user.id);
        setState((prev) => ({ ...prev, syncing: false, lastOutcome: outcome, connection }));
        return outcome;
      } catch (err) {
        setState((prev) => ({ ...prev, syncing: false, error: errorMessage(err, 'Synchronisierung fehlgeschlagen.') }));
        return null;
      }
    },
    [user, state.provider, state.available],
  );

  /** Runs the permission prompt, then does a first sync (§8). */
  const connect = useCallback(async () => {
    if (!user || !state.provider || !state.available) return;
    setState((prev) => ({ ...prev, syncing: true }));
    try {
      const result = await state.provider.requestPermissions(HEALTH_ROLLOUT);
      const nothingGranted = result.granted.length === 0;

      await saveHealthConnection(user.id, {
        connected: !nothingGranted,
        grantedTypes: result.granted,
        // Saying nothing after a refused dialog looks like a broken button.
        lastError: nothingGranted ? 'Keine Berechtigung erteilt. In der Health-App unter „Datenzugriff und Geräte“ nachträglich freigeben.' : null,
      });
      setState((prev) => ({ ...prev, granted: result.granted, syncing: false }));
      if (!nothingGranted) await syncHealth(state.provider, user.id, { days: 7 });
      await load();
    } catch (err) {
      setState((prev) => ({ ...prev, syncing: false, error: errorMessage(err, 'Verbindung fehlgeschlagen.') }));
    }
  }, [user, state.provider, state.available, load]);

  const disconnect = useCallback(async () => {
    if (!user) return;
    await saveHealthConnection(user.id, { connected: false, grantedTypes: [], lastError: null });
    await load();
  }, [user, load]);

  // Sync on mount and whenever the app comes back to the foreground (§12).
  useEffect(() => {
    if (!autoSync || !state.available || state.granted.length === 0) return;
    void sync();

    function onVisible() {
      if (document.visibilityState === 'visible') void sync();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [autoSync, state.available, state.granted.length, sync]);

  return { state, sync, connect, disconnect, reload: load };
}
