import { getSupabaseClient as createClient } from '@/services/supabase/client';
import { normalizeMuscles } from '@/domain/exerciseDatabase';
import type { MuscleKey } from '@/domain/exerciseDatabase';

export type DbExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  muscles: MuscleKey[];
  machineInfo: string | null;
  defaultSets: number;
  defaultReps: string;
  createdBy: string | null;
};

function toDbExercise(row: Record<string, unknown>): DbExercise {
  return {
    id: row.id as string,
    name: row.name as string,
    muscleGroup: row.muscle_group as string,
    equipment: row.equipment as string,
    // Custom exercises saved before the regions were split still carry coarse
    // keys like 'chest'; normalising maps them instead of dropping them.
    muscles: normalizeMuscles((row.muscles as string[]) ?? []),
    machineInfo: (row.machine_info as string) ?? null,
    defaultSets: (row.default_sets as number) ?? 3,
    defaultReps: (row.default_reps as string) ?? '8-12',
    createdBy: (row.created_by as string) ?? null,
  };
}

export async function listCustomExercises(): Promise<DbExercise[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('forge_exercises')
    .select('*')
    .order('name');
  return (data ?? []).map(toDbExercise);
}

export async function findCustomExerciseByName(name: string): Promise<DbExercise | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('forge_exercises')
    .select('*')
    .ilike('name', name)
    .limit(1);
  if (!data || data.length === 0) return null;
  return toDbExercise(data[0]!);
}

export async function createCustomExercise(
  userId: string,
  entry: {
    name: string;
    muscleGroup: string;
    equipment: string;
    muscles: MuscleKey[];
    machineInfo?: string;
    defaultSets: number;
    defaultReps: string;
  }
): Promise<DbExercise> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('forge_exercises')
    .insert({
      name: entry.name.trim(),
      muscle_group: entry.muscleGroup,
      equipment: entry.equipment,
      muscles: entry.muscles,
      machine_info: entry.machineInfo?.trim() || null,
      default_sets: entry.defaultSets,
      default_reps: entry.defaultReps,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return toDbExercise(data as Record<string, unknown>);
}
