import { getSupabaseClient } from '@/services/supabase/client';
import type { DailyCheckin, Soreness } from '@/domain/types';

const COLUMNS = 'log_date, soreness, soreness_area, energy, note';

function toSoreness(value: unknown): Soreness | null {
  return value === 'none' || value === 'light' || value === 'medium' || value === 'strong' ? value : null;
}

function toCheckin(row: Record<string, unknown>): DailyCheckin {
  return {
    logDate: row.log_date as string,
    soreness: toSoreness(row.soreness),
    sorenessArea: (row.soreness_area as string) ?? '',
    energy: row.energy === null || row.energy === undefined ? null : Number(row.energy),
    note: (row.note as string) ?? '',
  };
}

export async function getCheckin(userId: string, logDate: string): Promise<DailyCheckin | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_daily_checkins')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle();
  if (error) throw error;
  return data ? toCheckin(data as unknown as Record<string, unknown>) : null;
}

export async function listCheckins(userId: string, fromDate: string): Promise<DailyCheckin[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_daily_checkins')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('log_date', fromDate)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toCheckin(r as unknown as Record<string, unknown>));
}

export async function saveCheckin(
  userId: string,
  logDate: string,
  patch: { soreness?: Soreness | null; sorenessArea?: string; energy?: number | null; note?: string },
): Promise<void> {
  const supabase = getSupabaseClient();
  const row: Record<string, unknown> = { user_id: userId, log_date: logDate, updated_at: new Date().toISOString() };
  if (patch.soreness !== undefined) row.soreness = patch.soreness;
  if (patch.sorenessArea !== undefined) row.soreness_area = patch.sorenessArea;
  if (patch.energy !== undefined) row.energy = patch.energy;
  if (patch.note !== undefined) row.note = patch.note;

  const { error } = await supabase.from('forge_daily_checkins').upsert(row, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}
