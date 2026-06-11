import { getSupabaseClient } from '@/services/supabase/client';
import type { BodyMetric, ProgressPhoto } from '@/domain/types';

function toMetric(row: {
  id: string;
  log_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
}): BodyMetric {
  return {
    id: row.id,
    logDate: row.log_date,
    weightKg: row.weight_kg !== null ? Number(row.weight_kg) : null,
    waistCm: row.waist_cm !== null ? Number(row.waist_cm) : null,
    chestCm: row.chest_cm !== null ? Number(row.chest_cm) : null,
    armsCm: row.arms_cm !== null ? Number(row.arms_cm) : null,
  };
}

export async function listBodyMetrics(userId: string, limit = 90): Promise<BodyMetric[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_body_metrics')
    .select('id, log_date, weight_kg, waist_cm, chest_cm, arms_cm')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toMetric).reverse();
}

export async function saveBodyMetric(
  userId: string,
  logDate: string,
  values: { weightKg: number | null; waistCm: number | null; chestCm: number | null; armsCm: number | null },
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_body_metrics').upsert(
    {
      user_id: userId,
      log_date: logDate,
      weight_kg: values.weightKg,
      waist_cm: values.waistCm,
      chest_cm: values.chestCm,
      arms_cm: values.armsCm,
    },
    { onConflict: 'user_id,log_date' },
  );
  if (error) throw error;
}

const PHOTO_BUCKET = 'forge-progress-photos';

export async function listProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_progress_photos')
    .select('id, taken_at, storage_path')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
    .limit(40);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { data: signed } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(row.storage_path);
    return {
      id: row.id,
      takenAt: row.taken_at,
      storagePath: row.storage_path,
      url: signed?.publicUrl ?? null,
    };
  });
}

export async function uploadProgressPhoto(userId: string, file: File, takenAt: string): Promise<void> {
  const supabase = getSupabaseClient();
  const extension = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${takenAt}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from('forge_progress_photos')
    .insert({ user_id: userId, taken_at: takenAt, storage_path: path });
  if (error) throw error;
}

export async function deleteProgressPhoto(userId: string, photoId: string, storagePath: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  const { error } = await supabase.from('forge_progress_photos').delete().eq('id', photoId).eq('user_id', userId);
  if (error) throw error;
}

export type ExerciseHistoryPoint = { date: string; maxWeightKg: number; totalSets: number };

/** Per-exercise weight history across all completed sessions, sorted oldest→newest. */
export async function listExerciseHistory(userId: string, exerciseName: string): Promise<ExerciseHistoryPoint[]> {
  const supabase = getSupabaseClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from('forge_workout_sessions')
    .select('id, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true });
  if (sessionsError) throw sessionsError;
  if (!sessions?.length) return [];

  const sessionDateById = new Map(sessions.map((s) => [s.id, (s.completed_at as string).slice(0, 10)]));

  const { data: exercises, error: exError } = await supabase
    .from('forge_session_exercises')
    .select('id, session_id')
    .in('session_id', sessions.map((s) => s.id))
    .eq('exercise_name', exerciseName);
  if (exError) throw exError;
  if (!exercises?.length) return [];

  const sessionIdByExId = new Map(exercises.map((e) => [e.id, e.session_id as string]));

  const { data: sets, error: setsError } = await supabase
    .from('forge_session_sets')
    .select('session_exercise_id, weight_kg')
    .in('session_exercise_id', exercises.map((e) => e.id))
    .eq('completed', true)
    .not('weight_kg', 'is', null);
  if (setsError) throw setsError;

  const bySession = new Map<string, { maxWeight: number; sets: number }>();
  for (const set of sets ?? []) {
    const sessionId = sessionIdByExId.get(set.session_exercise_id);
    if (!sessionId) continue;
    const w = Number(set.weight_kg);
    const cur = bySession.get(sessionId);
    bySession.set(sessionId, { maxWeight: Math.max(w, cur?.maxWeight ?? 0), sets: (cur?.sets ?? 0) + 1 });
  }

  return [...bySession.entries()]
    .map(([sessionId, d]) => ({ date: sessionDateById.get(sessionId) ?? '', maxWeightKg: d.maxWeight, totalSets: d.sets }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Best (highest) weight per exercise from completed sets — basis for the strength progress list. */
export async function listStrengthBests(userId: string): Promise<{ exerciseName: string; weightKg: number; reps: number; date: string }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_workout_sessions')
    .select('id, completed_at, forge_session_exercises(id, exercise_name, forge_session_sets(reps, weight_kg, completed))')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(60);
  if (error) throw error;

  const bestByExercise = new Map<string, { exerciseName: string; weightKg: number; reps: number; date: string }>();

  for (const session of data ?? []) {
    const completedAt = session.completed_at as string;
    for (const exercise of session.forge_session_exercises ?? []) {
      for (const set of exercise.forge_session_sets ?? []) {
        if (!set.completed || set.weight_kg === null) continue;
        const weight = Number(set.weight_kg);
        const current = bestByExercise.get(exercise.exercise_name);
        if (!current || weight > current.weightKg) {
          bestByExercise.set(exercise.exercise_name, {
            exerciseName: exercise.exercise_name,
            weightKg: weight,
            reps: set.reps ?? 0,
            date: completedAt,
          });
        }
      }
    }
  }

  return [...bestByExercise.values()].sort((a, b) => b.weightKg - a.weightKg);
}
