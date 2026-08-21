/**
 * Health data abstraction (§6).
 *
 * Nothing in FORGE talks to HealthKit directly. Screens ask a HealthProvider,
 * and which implementation answers depends on where the app is running — a
 * browser tab gets the manual one, the iOS shell gets the Apple one. That is
 * also what keeps a future Google Health or Garmin provider a drop-in rather
 * than a rewrite.
 */

import type { HealthMetricKey, WorkoutImport } from '@/domain/health';

export type SleepReading = {
  /** Total asleep minutes for the night attributed to this date. */
  minutes: number;
  /** When the platform says the sleep started, for display only. */
  startedAt: string | null;
};

export type WeightReading = {
  kg: number;
  measuredAt: string;
};

export type PermissionResult = {
  granted: HealthMetricKey[];
  denied: HealthMetricKey[];
};

export interface HealthProvider {
  readonly id: 'apple_health' | 'manual';
  readonly label: string;

  /** True only where the platform can actually serve health data. */
  isAvailable(): Promise<boolean>;

  /** Which metrics this provider can serve at all. */
  supportedMetrics(): HealthMetricKey[];

  /**
   * Asks the platform for read access. Returns what was actually granted —
   * a user may allow steps and refuse sleep, and the UI has to say so (§9).
   */
  requestPermissions(metrics: HealthMetricKey[]): Promise<PermissionResult>;

  /** Which metrics are currently readable without prompting again. */
  grantedMetrics(): Promise<HealthMetricKey[]>;

  getSteps(date: string): Promise<number | null>;
  getSleep(date: string): Promise<SleepReading | null>;
  getWeight(date: string): Promise<WeightReading | null>;
  getActiveEnergy(date: string): Promise<number | null>;
  getWalkingRunningDistance(date: string): Promise<number | null>;
  getWorkouts(date: string): Promise<WorkoutImport[]>;
}

/**
 * The provider used in a browser: available, but serves nothing.
 *
 * It exists so calling code never has to null-check a provider. Screens ask
 * `supportedMetrics()` — which is empty here — and fall back to manual input
 * without a single `if (isIOS)` anywhere in the UI (§5).
 */
export class ManualHealthProvider implements HealthProvider {
  readonly id = 'manual' as const;
  readonly label = 'Manuelle Eingabe';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  supportedMetrics(): HealthMetricKey[] {
    return [];
  }

  async requestPermissions(): Promise<PermissionResult> {
    return { granted: [], denied: [] };
  }

  async grantedMetrics(): Promise<HealthMetricKey[]> {
    return [];
  }

  async getSteps(): Promise<number | null> {
    return null;
  }

  async getSleep(): Promise<SleepReading | null> {
    return null;
  }

  async getWeight(): Promise<WeightReading | null> {
    return null;
  }

  async getActiveEnergy(): Promise<number | null> {
    return null;
  }

  async getWalkingRunningDistance(): Promise<number | null> {
    return null;
  }

  async getWorkouts(): Promise<WorkoutImport[]> {
    return [];
  }
}
