import { getSupabaseClient } from '@/services/supabase/client';

export type CardioLog = {
  id: string;
  logDate: string;
  activity: string;
  durationMinutes: number;
  distanceKm: number | null;
  kcalBurned: number;
  loggedAt: string;
};

function toCardioLog(row: {
  id: string; log_date: string; activity: string; duration_minutes: number;
  distance_km: number | null; kcal_burned: number; logged_at: string;
}): CardioLog {
  return {
    id: row.id,
    logDate: row.log_date,
    activity: row.activity,
    durationMinutes: row.duration_minutes,
    distanceKm: row.distance_km !== null ? Number(row.distance_km) : null,
    kcalBurned: row.kcal_burned,
    loggedAt: row.logged_at,
  };
}

export async function listCardioLogs(userId: string, logDate: string): Promise<CardioLog[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_cardio_logs')
    .select('id, log_date, activity, duration_minutes, distance_km, kcal_burned, logged_at')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toCardioLog);
}

export async function listRecentCardioLogs(userId: string, limit = 20): Promise<CardioLog[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_cardio_logs')
    .select('id, log_date, activity, duration_minutes, distance_km, kcal_burned, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toCardioLog).reverse();
}

export async function addCardioLog(
  userId: string,
  logDate: string,
  entry: { activity: string; durationMinutes: number; distanceKm: number | null; kcalBurned: number },
): Promise<CardioLog> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_cardio_logs')
    .insert({
      user_id: userId,
      log_date: logDate,
      activity: entry.activity,
      duration_minutes: entry.durationMinutes,
      distance_km: entry.distanceKm,
      kcal_burned: entry.kcalBurned,
    })
    .select('id, log_date, activity, duration_minutes, distance_km, kcal_burned, logged_at')
    .single();
  if (error) throw error;
  return toCardioLog(data);
}

export async function deleteCardioLog(userId: string, logId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_cardio_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getTodayCardioKcal(userId: string, logDate: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_cardio_logs')
    .select('kcal_burned')
    .eq('user_id', userId)
    .eq('log_date', logDate);
  if (error) return 0; // graceful fallback if table not yet migrated
  return (data ?? []).reduce((sum, r) => sum + (r.kcal_burned ?? 0), 0);
}
