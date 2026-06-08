'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  deleteProgressPhoto,
  listBodyMetrics,
  listProgressPhotos,
  listStrengthBests,
  saveBodyMetric,
  uploadProgressPhoto,
} from '@/data/progress';
import type { BodyMetric, ProgressPhoto } from '@/domain/types';

export function useProgress() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [strengthBests, setStrengthBests] = useState<{ exerciseName: string; weightKg: number; reps: number; date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [m, p, s] = await Promise.all([
        listBodyMetrics(user.id),
        listProgressPhotos(user.id),
        listStrengthBests(user.id),
      ]);
      setMetrics(m);
      setPhotos(p);
      setStrengthBests(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fortschritt konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const addMetric = useCallback(
    async (logDate: string, values: { weightKg: number | null; waistCm: number | null; chestCm: number | null; armsCm: number | null }) => {
      if (!user) return;
      await saveBodyMetric(user.id, logDate, values);
      await load();
    },
    [user, load],
  );

  const addPhoto = useCallback(
    async (file: File, takenAt: string) => {
      if (!user) return;
      await uploadProgressPhoto(user.id, file, takenAt);
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

  return { metrics, photos, strengthBests, loading, error, addMetric, addPhoto, removePhoto };
}
