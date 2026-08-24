/**
 * Health metrics and where they came from.
 *
 * The whole point of tracking a source per metric is that Apple Health and a
 * human can both have an opinion about the same day. Without it, "7.350 aus
 * Health" plus "5.000 von Hand" silently becomes 12.350 (§43).
 */

/**
 * Where a metric came from. Only `manual` is produced now — the Apple Health
 * bridge needed the native shell, which FORGE no longer ships. Kept because
 * existing rows carry the other values and must keep reading back.
 */
export type MetricSource = 'manual' | 'apple_health' | 'import' | 'calculated';

export type DailyHealth = {
  date: string;
  steps: number | null;
  activeEnergyKcal: number | null;
  walkingDistanceM: number | null;
  sleepMinutes: number | null;
  sources: {
    steps: MetricSource;
    energy: MetricSource;
    distance: MetricSource;
    sleep: MetricSource;
  };
  syncedAt: string | null;
};

export function emptyDailyHealth(date: string): DailyHealth {
  return {
    date,
    steps: null,
    activeEnergyKcal: null,
    walkingDistanceM: null,
    sleepMinutes: null,
    sources: { steps: 'manual', energy: 'manual', distance: 'manual', sleep: 'manual' },
    syncedAt: null,
  };
}

/**
 * Decides whether an incoming reading should replace what is already stored.
 *
 * A manual value is a deliberate correction and outranks an automatic one for
 * the rest of that day — otherwise the next sync would silently undo the fix
 * the user just made (§43). Apple Health wins over an older Apple Health value
 * and over nothing at all.
 */
export function shouldReplace(
  existingSource: MetricSource,
  existingValue: number | null,
  incomingSource: MetricSource,
): boolean {
  if (existingValue === null) return true;
  if (incomingSource === 'manual') return true;
  if (existingSource === 'manual') return false;
  return true;
}

export function formatSleep(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '–';
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatDistance(meters: number | null): string {
  if (meters === null || meters <= 0) return '–';
  const km = meters / 1000;
  return `${km.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

