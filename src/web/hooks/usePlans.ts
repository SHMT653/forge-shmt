'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  addPlanDay, addPlanExercise, createCustomPlan, createPlanFromTemplate,
  deletePlan, listPlans, removePlanDay, removePlanExercise,
  renamePlan, renamePlanDay, setActivePlan, updatePlanExercise,
} from '@/data/plans';
import { startWorkoutSession } from '@/data/workouts';
import { errorMessage } from '@/domain/errors';
import type { PlanTemplate } from '@/domain/planTemplates';
import type { PlanDay, TrainingPlan } from '@/domain/types';

export function usePlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setPlans(await listPlans(user.id));
    } catch (err) {
      setError(errorMessage(err, 'Pläne konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const useTemplate = useCallback(
    async (template: PlanTemplate) => {
      if (!user) return;
      const id = await createPlanFromTemplate(user.id, template);
      await setActivePlan(user.id, id);
      await load();
      return id;
    },
    [user, load],
  );

  const createCustom = useCallback(
    async (name: string, focus: string, days: { name: string; exercises: { name: string; targetSets: number; targetReps: string }[] }[]) => {
      if (!user) return;
      const id = await createCustomPlan(user.id, name, focus, days);
      await load();
      return id;
    },
    [user, load],
  );

  const activate = useCallback(
    async (planId: string) => {
      if (!user) return;
      await setActivePlan(user.id, planId);
      await load();
    },
    [user, load],
  );

  const remove = useCallback(
    async (planId: string) => {
      await deletePlan(planId);
      await load();
    },
    [load],
  );

  const startDay = useCallback(
    async (plan: TrainingPlan, day: PlanDay) => {
      if (!user) return null;
      return startWorkoutSession(user.id, plan.id, plan.name, day);
    },
    [user],
  );

  const editPlanName = useCallback(async (planId: string, name: string, focus: string) => {
    await renamePlan(planId, name, focus);
    await load();
  }, [load]);

  const addDay = useCallback(async (planId: string, dayName: string, orderIndex: number) => {
    await addPlanDay(planId, dayName, orderIndex);
    await load();
  }, [load]);

  const renameDay = useCallback(async (dayId: string, name: string) => {
    await renamePlanDay(dayId, name);
    await load();
  }, [load]);

  const deleteDay = useCallback(async (dayId: string) => {
    await removePlanDay(dayId);
    await load();
  }, [load]);

  const addExercise = useCallback(async (dayId: string, name: string, sets: number, reps: string, orderIndex: number) => {
    await addPlanExercise(dayId, name, sets, reps, orderIndex);
    await load();
  }, [load]);

  const editExercise = useCallback(async (exerciseId: string, name: string, sets: number, reps: string) => {
    await updatePlanExercise(exerciseId, name, sets, reps);
    await load();
  }, [load]);

  const deleteExercise = useCallback(async (exerciseId: string) => {
    await removePlanExercise(exerciseId);
    await load();
  }, [load]);

  return {
    plans, loading, error, reload: load,
    useTemplate, createCustom, activate, remove, startDay,
    editPlanName, addDay, renameDay, deleteDay, addExercise, editExercise, deleteExercise,
  };
}
