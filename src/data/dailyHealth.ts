import { getSupabaseClient } from '@/services/supabase/client';
import { emptyDailyHealth, shouldReplace, type DailyHealth, type MetricSource } from '@/domain/health';

const COLUMNS =
  'log_date, steps, active_energy_kcal, walking_distance_m, sleep_minutes, ' +
  'steps_source, energy_source, distance_source, sleep_source, synced_at';

function toSource(value: unknown): MetricSource {
  return value === 'apple_health' || value === 'import' || value === 'calculated' ? value : 'manual';
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDailyHealth(row: Record<string, unknown>): DailyHealth {
  return {
    date: row.log_date as string,
    steps: num(row.steps),
    activeEnergyKcal: num(row.active_energy_kcal),
    walkingDistanceM: num(row.walking_distance_m),
    sleepMinutes: num(row.sleep_minutes),
    sources: {
      steps: toSource(row.steps_source),
      energy: toSource(row.energy_source),
      distance: toSource(row.distance_source),
      sleep: toSource(row.sleep_source),
    },
    syncedAt: (row.synced_at as string | null) ?? null,
  };
}

export async function getDailyHealth(userId: string, date: string): Promise<DailyHealth> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_daily_health')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('log_date', date)
    .maybeSingle();
  if (error) throw error;
  return data ? toDailyHealth(data as unknown as Record<string, unknown>) : emptyDailyHealth(date);
}

export async function listDailyHealth(userId: string, fromDate: string, toDate: string): Promise<DailyHealth[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_daily_health')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toDailyHealth(row as unknown as Record<string, unknown>));
}

export type HealthMetricField = 'steps' | 'activeEnergyKcal' | 'walkingDistanceM' | 'sleepMinutes';

const COLUMN_FOR: Record<HealthMetricField, { value: string; source: keyof DailyHealth['sources'] }> = {
  steps: { value: 'steps', source: 'steps' },
  activeEnergyKcal: { value: 'active_energy_kcal', source: 'energy' },
  walkingDistanceM: { value: 'walking_distance_m', source: 'distance' },
  sleepMinutes: { value: 'sleep_minutes', source: 'sleep' },
};

const SOURCE_COLUMN: Record<keyof DailyHealth['sources'], string> = {
  steps: 'steps_source',
  energy: 'energy_source',
  distance: 'distance_source',
  sleep: 'sleep_source',
};

/**
 * Writes one metric for one day, honouring source precedence.
 *
 * A sync must never overwrite a value the user corrected by hand, and a manual
 * correction must always win — otherwise the next app resume quietly undoes it
 * and the number appears to change on its own (§43).
 */
export async function setHealthMetric(
  userId: string,
  date: string,
  field: HealthMetricField,
  value: number | null,
  source: MetricSource,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const current = await getDailyHealth(userId, date);
  const mapping = COLUMN_FOR[field];

  if (!shouldReplace(current.sources[mapping.source], current[field], source)) return false;

  const row: Record<string, unknown> = {
    user_id: userId,
    log_date: date,
    [mapping.value]: value,
    [SOURCE_COLUMN[mapping.source]]: source,
    updated_at: new Date().toISOString(),
  };
  if (source === 'apple_health') row.synced_at = new Date().toISOString();

  const { error } = await supabase.from('forge_daily_health').upsert(row, { onConflict: 'user_id,log_date' });
  if (error) throw error;
  return true;
}

/** Clears a manual override so automatic syncing takes over again (§43). */
export async function clearManualOverride(userId: string, date: string, field: HealthMetricField): Promise<void> {
  const supabase = getSupabaseClient();
  const mapping = COLUMN_FOR[field];
  const { error } = await supabase
    .from('forge_daily_health')
    .update({ [mapping.value]: null, [SOURCE_COLUMN[mapping.source]]: 'manual', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('log_date', date);
  if (error) throw error;
}

// ── Connection state ────────────────────────────────────────────────────────

export type HealthConnection = {
  connected: boolean;
  grantedTypes: string[];
  lastSyncedAt: string | null;
  lastError: string | null;
};

export async function getHealthConnection(userId: string): Promise<HealthConnection> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_health_connections')
    .select('connected, granted_types, last_synced_at, last_error')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { connected: false, grantedTypes: [], lastSyncedAt: null, lastError: null };
  return {
    connected: Boolean(data.connected),
    grantedTypes: Array.isArray(data.granted_types) ? data.granted_types : [],
    lastSyncedAt: data.last_synced_at ?? null,
    lastError: data.last_error ?? null,
  };
}

export async function saveHealthConnection(userId: string, patch: Partial<HealthConnection>): Promise<void> {
  const supabase = getSupabaseClient();
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.connected !== undefined) row.connected = patch.connected;
  if (patch.grantedTypes !== undefined) row.granted_types = patch.grantedTypes;
  if (patch.lastSyncedAt !== undefined) row.last_synced_at = patch.lastSyncedAt;
  if (patch.lastError !== undefined) row.last_error = patch.lastError;

  const { error } = await supabase.from('forge_health_connections').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}
