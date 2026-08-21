/**
 * Apple HealthKit, reached through a small Capacitor bridge.
 *
 * The native side is deliberately thin: it exposes a handful of aggregate
 * queries and nothing else. FORGE never pulls raw HealthKit samples across the
 * bridge, because it has no use for them and storing them would be a privacy
 * cost with no benefit (§13).
 */

import type { HealthMetricKey, WorkoutImport } from '@/domain/health';
import type { HealthProvider, PermissionResult, SleepReading, WeightReading } from './provider';

/** Shape of the native plugin. Mirrors ios/App/App/HealthPlugin.swift. */
type NativeHealthPlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(options: { types: string[] }): Promise<{ granted: string[]; denied: string[] }>;
  getAuthorizationStatus(): Promise<{ granted: string[] }>;
  querySteps(options: { date: string }): Promise<{ value: number | null }>;
  querySleep(options: { date: string }): Promise<{ minutes: number | null; startedAt: string | null }>;
  queryWeight(options: { date: string }): Promise<{ kg: number | null; measuredAt: string | null }>;
  queryActiveEnergy(options: { date: string }): Promise<{ value: number | null }>;
  queryDistance(options: { date: string }): Promise<{ value: number | null }>;
  queryWorkouts(options: { date: string }): Promise<{ workouts: WorkoutImport[] }>;
};

const SUPPORTED: HealthMetricKey[] = ['steps', 'sleep', 'weight', 'activeEnergy', 'distance', 'workouts'];

/**
 * Resolves the plugin without importing Capacitor at module scope.
 *
 * A static `import '@capacitor/core'` would pull the package into the web
 * bundle and make the browser build depend on it — exactly what §3 forbids.
 */
async function getPlugin(): Promise<NativeHealthPlugin | null> {
  if (typeof window === 'undefined') return null;
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  const plugin = capacitor.Plugins?.ForgeHealth;
  return (plugin as NativeHealthPlugin | undefined) ?? null;
}

export class AppleHealthProvider implements HealthProvider {
  readonly id = 'apple_health' as const;
  readonly label = 'Apple Health';

  async isAvailable(): Promise<boolean> {
    const plugin = await getPlugin();
    if (!plugin) return false;
    try {
      const result = await plugin.isAvailable();
      return result.available;
    } catch {
      return false;
    }
  }

  supportedMetrics(): HealthMetricKey[] {
    return [...SUPPORTED];
  }

  async requestPermissions(metrics: HealthMetricKey[]): Promise<PermissionResult> {
    const plugin = await getPlugin();
    if (!plugin) return { granted: [], denied: metrics };
    try {
      const result = await plugin.requestAuthorization({ types: metrics });
      return {
        granted: result.granted.filter(isMetricKey),
        denied: result.denied.filter(isMetricKey),
      };
    } catch {
      return { granted: [], denied: metrics };
    }
  }

  async grantedMetrics(): Promise<HealthMetricKey[]> {
    const plugin = await getPlugin();
    if (!plugin) return [];
    try {
      const result = await plugin.getAuthorizationStatus();
      return result.granted.filter(isMetricKey);
    } catch {
      return [];
    }
  }

  async getSteps(date: string): Promise<number | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;
    try {
      const { value } = await plugin.querySteps({ date });
      return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
    } catch {
      return null;
    }
  }

  async getSleep(date: string): Promise<SleepReading | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;
    try {
      const result = await plugin.querySleep({ date });
      if (typeof result.minutes !== 'number' || !Number.isFinite(result.minutes) || result.minutes <= 0) return null;
      return { minutes: Math.round(result.minutes), startedAt: result.startedAt };
    } catch {
      return null;
    }
  }

  async getWeight(date: string): Promise<WeightReading | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;
    try {
      const result = await plugin.queryWeight({ date });
      if (typeof result.kg !== 'number' || !Number.isFinite(result.kg) || result.kg <= 0) return null;
      return { kg: Math.round(result.kg * 10) / 10, measuredAt: result.measuredAt ?? `${date}T00:00:00.000Z` };
    } catch {
      return null;
    }
  }

  async getActiveEnergy(date: string): Promise<number | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;
    try {
      const { value } = await plugin.queryActiveEnergy({ date });
      return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
    } catch {
      return null;
    }
  }

  async getWalkingRunningDistance(date: string): Promise<number | null> {
    const plugin = await getPlugin();
    if (!plugin) return null;
    try {
      const { value } = await plugin.queryDistance({ date });
      return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
    } catch {
      return null;
    }
  }

  async getWorkouts(date: string): Promise<WorkoutImport[]> {
    const plugin = await getPlugin();
    if (!plugin) return [];
    try {
      const { workouts } = await plugin.queryWorkouts({ date });
      return Array.isArray(workouts) ? workouts : [];
    } catch {
      return [];
    }
  }
}

function isMetricKey(value: string): value is HealthMetricKey {
  return SUPPORTED.includes(value as HealthMetricKey);
}
