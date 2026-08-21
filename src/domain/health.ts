/**
 * Health metrics and where they came from.
 *
 * The whole point of tracking a source per metric is that Apple Health and a
 * human can both have an opinion about the same day. Without it, "7.350 aus
 * Health" plus "5.000 von Hand" silently becomes 12.350 (§43).
 */

export type MetricSource = 'manual' | 'apple_health' | 'import' | 'calculated';

export const SOURCE_LABEL: Record<MetricSource, string> = {
  manual: 'Manuell',
  apple_health: 'Apple Health',
  import: 'Import',
  calculated: 'Berechnet',
};

/** Which health metrics FORGE knows how to read. Order matters for the UI. */
export type HealthMetricKey = 'steps' | 'sleep' | 'weight' | 'activeEnergy' | 'distance' | 'workouts';

export const HEALTH_METRIC_LABEL: Record<HealthMetricKey, string> = {
  steps: 'Schritte',
  sleep: 'Schlaf',
  weight: 'Gewicht',
  activeEnergy: 'Aktive Energie',
  distance: 'Distanz',
  workouts: 'Workouts',
};

/**
 * Rollout order from §48. The UI reads this so a metric that is not wired up
 * yet is simply absent rather than present-but-broken.
 */
export const HEALTH_ROLLOUT: HealthMetricKey[] = ['steps', 'sleep', 'weight', 'activeEnergy', 'distance', 'workouts'];

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

export type WorkoutImport = {
  /** Stable id from the platform, so re-syncing does not duplicate. */
  externalId: string;
  activity: string;
  startedAt: string;
  durationMinutes: number;
  activeEnergyKcal: number | null;
  distanceM: number | null;
};

/**
 * An imported walk is activity, not a FORGE strength session (§21).
 * Everything that arrives from a health platform lands in this bucket.
 */
export type ActivityKind = 'activity' | 'strength' | 'mini';

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

/** Human phrasing for the sync banner (§17). Never a technical error string. */
export function formatSyncedAgo(syncedAt: string | null, now = new Date()): string | null {
  if (!syncedAt) return null;
  const then = new Date(syncedAt).getTime();
  if (!Number.isFinite(then)) return null;
  const minutes = Math.floor((now.getTime() - then) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Minute${minutes === 1 ? '' : 'n'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Stunde${hours === 1 ? '' : 'n'}`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
}
