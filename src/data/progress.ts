import { getSupabaseClient } from '@/services/supabase/client';
import type { BiaValues, BodyMetric, PhotoPose, ProgressPhoto } from '@/domain/types';

const METRIC_COLUMNS =
  'id, log_date, weight_kg, waist_cm, chest_cm, arms_cm, body_fat_pct, fat_mass_kg, lean_mass_kg, ' +
  'muscle_mass_kg, muscle_rate_pct, skeletal_muscle_pct, body_water_pct, visceral_fat, bmr, bmi, source';

/** Postgres `numeric` comes back as a string — normalise to number | null. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBia(row: Record<string, unknown>): BiaValues | null {
  const bia: BiaValues = {
    bodyFatPct: num(row.body_fat_pct),
    fatMassKg: num(row.fat_mass_kg),
    leanMassKg: num(row.lean_mass_kg),
    muscleMassKg: num(row.muscle_mass_kg),
    muscleRatePct: num(row.muscle_rate_pct),
    skeletalMusclePct: num(row.skeletal_muscle_pct),
    bodyWaterPct: num(row.body_water_pct),
    visceralFat: num(row.visceral_fat),
    bmr: num(row.bmr),
    bmi: num(row.bmi),
  };
  // Nothing measured → no BIA block at all, so the UI can skip the section.
  return Object.values(bia).some((v) => v !== null) ? bia : null;
}

function toMetric(row: Record<string, unknown>): BodyMetric {
  return {
    id: row.id as string,
    logDate: row.log_date as string,
    weightKg: num(row.weight_kg),
    waistCm: num(row.waist_cm),
    chestCm: num(row.chest_cm),
    armsCm: num(row.arms_cm),
    bia: toBia(row),
    source: row.source === 'bia' ? 'bia' : row.source === 'apple_health' ? 'apple_health' : 'manual',
  };
}

export async function listBodyMetrics(userId: string, limit = 90): Promise<BodyMetric[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_body_metrics')
    .select(METRIC_COLUMNS)
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toMetric(row as unknown as Record<string, unknown>)).reverse();
}

export type BodyMetricInput = {
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armsCm: number | null;
  bia?: Partial<BiaValues> | null;
  source?: 'manual' | 'bia' | 'apple_health';
};

export async function saveBodyMetric(userId: string, logDate: string, values: BodyMetricInput): Promise<void> {
  const supabase = getSupabaseClient();
  const bia = values.bia ?? null;
  const { error } = await supabase.from('forge_body_metrics').upsert(
    {
      user_id: userId,
      log_date: logDate,
      weight_kg: values.weightKg,
      waist_cm: values.waistCm,
      chest_cm: values.chestCm,
      arms_cm: values.armsCm,
      body_fat_pct: bia?.bodyFatPct ?? null,
      fat_mass_kg: bia?.fatMassKg ?? null,
      lean_mass_kg: bia?.leanMassKg ?? null,
      muscle_mass_kg: bia?.muscleMassKg ?? null,
      muscle_rate_pct: bia?.muscleRatePct ?? null,
      skeletal_muscle_pct: bia?.skeletalMusclePct ?? null,
      body_water_pct: bia?.bodyWaterPct ?? null,
      visceral_fat: bia?.visceralFat ?? null,
      bmr: bia?.bmr ?? null,
      bmi: bia?.bmi ?? null,
      source: values.source ?? (bia ? 'bia' : 'manual'),
    },
    { onConflict: 'user_id,log_date' },
  );
  if (error) throw error;
}

const PHOTO_BUCKET = 'forge-progress-photos';
const PHOTO_URL_TTL_SECONDS = 60 * 60 * 24;

async function progressPhotoUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, PHOTO_URL_TTL_SECONDS);
  if (!error && data?.signedUrl) return data.signedUrl;

  const { data: fallback } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  return fallback?.publicUrl ?? null;
}

export async function listProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_progress_photos')
    .select('id, taken_at, storage_path, pose, weight_kg')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
    .limit(120);
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      takenAt: row.taken_at,
      storagePath: row.storage_path,
      url: await progressPhotoUrl(row.storage_path),
      pose: (row.pose ?? 'front') as PhotoPose,
      weightKg: row.weight_kg !== null && row.weight_kg !== undefined ? Number(row.weight_kg) : null,
    })),
  );
}

export async function listProgressPhotoDates(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_progress_photos')
    .select('taken_at')
    .eq('user_id', userId)
    .order('taken_at', { ascending: true });
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.taken_at as string))];
}

export async function uploadProgressPhoto(
  userId: string,
  file: File,
  takenAt: string,
  pose: PhotoPose = 'front',
  weightKg: number | null = null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const extension = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${takenAt}-${pose}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from('forge_progress_photos')
    .insert({ user_id: userId, taken_at: takenAt, storage_path: path, pose, weight_kg: weightKg });
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
