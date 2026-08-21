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
import { listExerciseSnapshots, listRecentSessions, listTrainedExerciseNames } from '@/data/workouts';
import { listNutritionLogs } from '@/data/nutrition';
import { ensureDefaultHabits, listHabitLogsForRange } from '@/data/habits';
import { getUserGoals } from '@/data/profile';
import { buildDayMetrics, metricsForDate } from '@/data/dailyMetrics';
import { errorMessage } from '@/domain/errors';
import { dateKeyAddDays, todayKey } from '@/domain/dates';
import { resolveTargets, type ResolvedTargets } from '@/domain/goalPhase';
import { summarizeWeight, type WeightSummary } from '@/domain/weightTrend';
import { computeTrend, type ExerciseSnapshot, type ProgressionTrend } from '@/domain/progression';
import { buildWeeklyReview, eachDayOfWeek, weekBoundsFor, type WeeklyReview } from '@/domain/weeklyReview';
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
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [exercises, setExercises] = useState<ExerciseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const today = todayKey();
      const bounds = weekBoundsFor(today);

      const [bodyMetrics, photoList, userGoals, exerciseNames, habits, habitLogs, sessions] = await Promise.all([
        listBodyMetrics(user.id, 180),
        listProgressPhotos(user.id),
        getUserGoals(user.id),
        listTrainedExerciseNames(user.id),
        ensureDefaultHabits(user.id),
        listHabitLogsForRange(user.id, dateKeyAddDays(today, -14)),
        listRecentSessions(user.id, 60),
      ]);

      const resolved = resolveTargets(userGoals);
      const weightSummary = summarizeWeight(bodyMetrics);

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

      // ── Weekly review ────────────────────────────────────────────────
      const nutritionLogs = await listNutritionLogs(user.id, bounds.start, bounds.end);
      const metricsByDate = buildDayMetrics(habits, habitLogs);
      const days = eachDayOfWeek(bounds).map((date) => {
        const log = nutritionLogs.find((l) => l.logDate === date);
        const day = metricsForDate(metricsByDate, date);
        return {
          date,
          kcal: log?.calories ?? 0,
          proteinG: log?.proteinG ?? 0,
          steps: day.steps,
          waterMl: day.waterMl,
          sleepH: day.sleepH,
          hasNutrition: (log?.calories ?? 0) > 0,
        };
      });

      const inWeek = (iso: string | null) => {
        if (!iso) return false;
        const key = iso.slice(0, 10);
        return key >= bounds.start && key <= bounds.end;
      };

      setMetrics(bodyMetrics);
      setPhotos(photoList);
      setGoals(userGoals);
      setTargets(resolved);
      setWeight(weightSummary);
      setExercises(exerciseProgress);
      setReview(
        buildWeeklyReview({
          bounds,
          targets: resolved,
          days,
          fullWorkouts: sessions.filter((s) => s.kind === 'full' && inWeek(s.completedAt)).length,
          miniSessions: sessions.filter((s) => s.kind === 'mini' && inWeek(s.completedAt)).length,
          weight: weightSummary,
          exerciseHistories: exerciseProgress.map((e) => ({ name: e.name, snapshots: e.snapshots })),
        }),
      );
    } catch (err) {
      setError(errorMessage(err, 'Fortschritt konnte nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  return { metrics, photos, goals, targets, weight, review, exercises, loading, error, addMetric, addPhoto, removePhoto, reload: load };
}
