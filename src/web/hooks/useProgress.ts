'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  deleteProgressPhoto,
  listBodyMetrics,
  listProgressPhotos,
  saveBodyMetric,
  uploadProgressPhoto,
  type BodyMetricInput,
} from '@/data/progress';
import { listExerciseSnapshots, listTrainedExerciseNames } from '@/data/workouts';
import { getUserGoals, saveUserGoals } from '@/data/profile';
import { errorMessage } from '@/domain/errors';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import { resolveTargets, type ResolvedTargets } from '@/domain/goalPhase';
import { summarizeWeight, type WeightSummary } from '@/domain/weightTrend';
import { computeTrend, type ExerciseSnapshot, type ProgressionTrend } from '@/domain/progression';
import { summarizeRange, type RangeStats } from '@/domain/rangeStats';
import { loadDayAggregates } from '@/data/overview';
import type { BodyMetric, PhotoPose, ProgressPhoto, UserGoals } from '@/domain/types';

export type ExerciseProgress = {
  name: string;
  snapshots: ExerciseSnapshot[];
  trend: ProgressionTrend | null;
};

export function useProgress() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [targets, setTargets] = useState<ResolvedTargets | null>(null);
  const [weight, setWeight] = useState<WeightSummary | null>(null);
  /** How far back the statistics look. The user's choice, not a fixed week. */
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [stats, setStats] = useState<RangeStats | null>(null);
  const [exercises, setExercises] = useState<ExerciseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const today = todayKey();
      const from = dateKeyAddDays(today, -(rangeDays - 1));

      const [bodyMetrics, photoList, userGoals, exerciseNames, aggregates] = await Promise.all([
        listBodyMetrics(user.id, 400),
        listProgressPhotos(user.id),
        getUserGoals(user.id),
        listTrainedExerciseNames(user.id),
        loadDayAggregates(user.id, from, today),
      ]);

      const resolved = resolveTargets(userGoals);
      const weightSummary = summarizeWeight(bodyMetrics, userGoals.progressStartDate);

      // Per-exercise histories, most-trained first. Capped so the screen stays
      // responsive for someone with a long history.
      const snapshotLists = await Promise.all(
        exerciseNames.slice(0, 12).map(async (name) => ({
          name,
          snapshots: await listExerciseSnapshots(user.id, name),
        })),
      );
      const exerciseProgress: ExerciseProgress[] = snapshotLists
        .filter((entry) => entry.snapshots.length > 0)
        .map((entry) => ({ ...entry, trend: computeTrend(entry.snapshots) }))
        .sort((a, b) => b.snapshots.length - a.snapshots.length);

      // Every day in the span, including the ones with nothing on them, so a
      // gap counts as a gap rather than vanishing from the denominator.
      const span = Array.from({ length: rangeDays }, (_, i) => dateKeyAddDays(from, i));
      const days = span.map(
        (date) =>
          aggregates.get(date) ?? {
            date, kcal: null, proteinG: null, steps: null, sleepH: null, waterMl: null,
            trained: false, miniSession: false,
          },
      );

      setStats(summarizeRange(days, resolved));
      setMetrics(bodyMetrics);
      setPhotos(photoList);
      setGoals(userGoals);
      setTargets(resolved);
      setWeight(weightSummary);
      setExercises(exerciseProgress);
    } catch (err) {
      setError(errorMessage(err, 'Fortschritt konnte nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user, rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const addMetric = useCallback(
    async (logDate: string, values: BodyMetricInput) => {
      if (!user) return;
      await saveBodyMetric(user.id, logDate, values);
      await load();
    },
    [user, load],
  );

  const addPhoto = useCallback(
    async (file: File, takenAt: string, pose: PhotoPose, weightKg: number | null) => {
      if (!user) return;
      await uploadProgressPhoto(user.id, file, takenAt, pose, weightKg);
      await load();
    },
    [user, load],
  );

  const removePhoto = useCallback(
    async (photo: ProgressPhoto) => {
      if (!user) return;
      await deleteProgressPhoto(user.id, photo.id, photo.storagePath);
      await load();
    },
    [user, load],
  );

  const saveProgressStartDate = useCallback(
    async (startDate: string | null) => {
      if (!user || !goals) return;
      const next: UserGoals = { ...goals, progressStartDate: startDate };
      setGoals(next);
      await saveUserGoals(user.id, next);
      await load();
    },
    [user, goals, load],
  );

  return {
    metrics, photos, goals, targets, weight, exercises, stats, rangeDays, setRangeDays,
    loading, error, addMetric, addPhoto, removePhoto, saveProgressStartDate, reload: load,
  };
}
