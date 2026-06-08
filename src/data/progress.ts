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
    .from('body_metrics')
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
  const { error } = await supabase.from('body_metrics').upsert(
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
    .from('progress_photos')
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
    .from('progress_photos')
    .insert({ user_id: userId, taken_at: takenAt, storage_path: path });
  if (error) throw error;
}

export async function deleteProgressPhoto(userId: string, photoId: string, storagePath: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  const { error } = await supabase.from('progress_photos').delete().eq('id', photoId).eq('user_id', userId);
  if (error) throw error;
}

/** Best (highest) weight per exercise from completed sets — basis for the strength progress list. */
export async function listStrengthBests(userId: string): Promise<{ exerciseName: string; weightKg: number; reps: number; date: string }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, completed_at, session_exercises(id, exercise_name, session_sets(reps, weight_kg, completed))')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(60);
  if (error) throw error;

  const bestByExercise = new Map<string, { exerciseName: string; weightKg: number; reps: number; date: string }>();

  for (const session of data ?? []) {
    const completedAt = session.completed_at as string;
    for (const exercise of session.session_exercises ?? []) {
      for (const set of exercise.session_sets ?? []) {
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
