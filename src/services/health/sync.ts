import { setHealthMetric, saveHealthConnection, type HealthMetricField } from '@/data/dailyHealth';
import { listBodyMetrics, saveBodyMetric } from '@/data/progress';
import { todayKey, dateKeyAddDays } from '@/domain/dates';
import { HEALTH_ROLLOUT, type HealthMetricKey } from '@/domain/health';
import type { HealthProvider } from './provider';

export type SyncOutcome = {
  updated: HealthMetricKey[];
  skipped: HealthMetricKey[];
  /** Set only when something genuinely failed; never a raw platform error (§17). */
  error: string | null;
  syncedAt: string;
};

/**
 * Pulls the current state of health data into FORGE.
 *
 * Two rules shape this:
 *  - Only aggregates are stored. Raw samples stay in Apple Health, which is
 *    their home and where they are already backed up (§13).
 *  - Every write goes through `setHealthMetric`, which refuses to overwrite a
 *    manual correction. A sync can therefore run as often as it likes without
 *    fighting the user (§43).
 */
export async function syncHealth(
  provider: HealthProvider,
  userId: string,
  options: { days?: number; metrics?: HealthMetricKey[] } = {},
): Promise<SyncOutcome> {
  const syncedAt = new Date().toISOString();
  const updated: HealthMetricKey[] = [];
  const skipped: HealthMetricKey[] = [];

  const granted = await provider.grantedMetrics();
  const wanted = (options.metrics ?? HEALTH_ROLLOUT).filter((metric) => granted.includes(metric));

  if (wanted.length === 0) {
    await saveHealthConnection(userId, { lastSyncedAt: syncedAt, lastError: null });
    return { updated, skipped: options.metrics ?? [], error: null, syncedAt };
  }

  // A short window covers the common cases — a phone that was offline, or a
  // late-night sleep sample landing after midnight — without re-reading months.
  const days = Math.max(1, Math.min(14, options.days ?? 3));
  const dates = Array.from({ length: days }, (_, offset) => dateKeyAddDays(todayKey(), -offset));

  try {
    for (const metric of wanted) {
      const didUpdate = await syncMetric(provider, userId, metric, dates);
      (didUpdate ? updated : skipped).push(metric);
    }
    await saveHealthConnection(userId, { connected: true, grantedTypes: granted, lastSyncedAt: syncedAt, lastError: null });
    return { updated, skipped, error: null, syncedAt };
  } catch {
    // The user gets a plain sentence; the platform's own message is not useful
    // to them and may contain health details we should not surface (§14/§17).
    const message = 'Apple Health konnte nicht aktualisiert werden.';
    await saveHealthConnection(userId, { lastError: message });
    return { updated, skipped, error: message, syncedAt };
  }
}

async function syncMetric(
  provider: HealthProvider,
  userId: string,
  metric: HealthMetricKey,
  dates: string[],
): Promise<boolean> {
  let changed = false;

  for (const date of dates) {
    switch (metric) {
      case 'steps': {
        const value = await provider.getSteps(date);
        if (value !== null) changed = (await write(userId, date, 'steps', value)) || changed;
        break;
      }
      case 'sleep': {
        const reading = await provider.getSleep(date);
        if (reading) changed = (await write(userId, date, 'sleepMinutes', reading.minutes)) || changed;
        break;
      }
      case 'activeEnergy': {
        const value = await provider.getActiveEnergy(date);
        if (value !== null) changed = (await write(userId, date, 'activeEnergyKcal', value)) || changed;
        break;
      }
      case 'distance': {
        const value = await provider.getWalkingRunningDistance(date);
        if (value !== null) changed = (await write(userId, date, 'walkingDistanceM', value)) || changed;
        break;
      }
      case 'weight': {
        changed = (await syncWeight(provider, userId, date)) || changed;
        break;
      }
      case 'workouts':
        // Imported workouts count as activity, never as a FORGE strength
        // session (§21). Wiring them into the activity log is phase 5 of the
        // rollout; reading them here would create half-finished state.
        break;
    }
  }

  return changed;
}

async function write(userId: string, date: string, field: HealthMetricField, value: number): Promise<boolean> {
  return setHealthMetric(userId, date, field, value, 'apple_health');
}

/**
 * Weight is stored per measurement rather than per day, so it needs its own
 * path. A scale that syncs to Apple Health reaches FORGE this way without any
 * brand-specific integration (§18).
 */
async function syncWeight(provider: HealthProvider, userId: string, date: string): Promise<boolean> {
  const reading = await provider.getWeight(date);
  if (!reading) return false;

  const existing = await listBodyMetrics(userId, 30);
  const onThatDay = existing.find((metric) => metric.logDate === date);

  // A hand-entered or BIA measurement for the day stays untouched.
  if (onThatDay && onThatDay.source !== 'apple_health' && onThatDay.weightKg !== null) return false;
  if (onThatDay?.weightKg === reading.kg) return false;

  await saveBodyMetric(userId, date, {
    weightKg: reading.kg,
    waistCm: onThatDay?.waistCm ?? null,
    chestCm: onThatDay?.chestCm ?? null,
    armsCm: onThatDay?.armsCm ?? null,
    source: 'apple_health',
  });
  return true;
}
