export type Exercise = {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  orderIndex: number;
};

export type PlanDay = {
  id: string;
  name: string;
  orderIndex: number;
  exercises: Exercise[];
};

export type TrainingPlan = {
  id: string;
  name: string;
  focus: string;
  isActive: boolean;
  createdAt: string;
  days: PlanDay[];
};

export type SetEntry = {
  id: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  completed: boolean;
};

export type SessionExercise = {
  id: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  orderIndex: number;
  sets: SetEntry[];
};

export type WorkoutSession = {
  id: string;
  planId: string | null;
  planName: string;
  dayName: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  exercises: SessionExercise[];
};

export type Habit = {
  id: string;
  key: string;
  label: string;
  unit: string;
  target: number;
  orderIndex: number;
  active: boolean;
};

export type HabitLog = {
  habitId: string;
  logDate: string;
  value: number;
  completed: boolean;
};

export type BodyMetric = {
  id: string;
  logDate: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armsCm: number | null;
};

export type ProgressPhoto = {
  id: string;
  takenAt: string;
  storagePath: string;
  url: string | null;
};

export type GoalType = 'muscle' | 'fat_loss' | 'maintain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Gender = 'male' | 'female' | 'other';

export type UserGoals = {
  calorieGoal: number;
  proteinGoal: number;
  weightGoal: number | null;
  currentWeight: number | null;
  heightCm: number | null;
  birthYear: number | null;
  gender: Gender;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  programId: import('@/domain/programs').ProgramId | null;
  fastingProtocol: import('@/domain/programs').FastingProtocol | null;
  fastingStartHour: number | null;
};

export type NutritionLog = {
  logDate: string;
  calories: number;
  proteinG: number;
};

export type Profile = {
  id: string;
  displayName: string;
};
