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
  /** Holds (plank etc.) are measured in seconds, not reps. */
  durationSeconds: number | null;
  /** Band colour or level, for resistance-band work. */
  resistance: string | null;
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

/** A full planned session vs. a short "quick push" that still deserves credit (§19). */
export type WorkoutKind = 'full' | 'mini';

export type WorkoutSession = {
  id: string;
  planId: string | null;
  planName: string;
  dayName: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  kind: WorkoutKind;
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
  /** BIA scale readings (§29). Always shown as estimates, never as exact truth. */
  bia: BiaValues | null;
  /** Where the measurement came from — a scale can reach FORGE via Health (§18). */
  source: 'manual' | 'bia' | 'apple_health';
};

/** Body-composition values from a BIA scale. Every one of these is an estimate. */
export type BiaValues = {
  bodyFatPct: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  muscleMassKg: number | null;
  muscleRatePct: number | null;
  skeletalMusclePct: number | null;
  bodyWaterPct: number | null;
  visceralFat: number | null;
  bmr: number | null;
  bmi: number | null;
};

export type PhotoPose = 'front' | 'side' | 'back' | 'front_flexed';

export type ProgressPhoto = {
  id: string;
  takenAt: string;
  storagePath: string;
  url: string | null;
  pose: PhotoPose;
  weightKg: number | null;
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

  // ── Goal phase (§44). Null means "derive it" — see domain/goalPhase.ts.
  phaseType: import('@/domain/goalPhase').PhaseType | null;
  phaseStartDate: string | null;
  phaseEndDate: string | null;
  caloriesMin: number | null;
  caloriesMax: number | null;
  proteinMin: number | null;
  proteinMax: number | null;
  stepsGoal: number | null;
  waterGoalMl: number | null;
  sleepGoalH: number | null;

  // ── Tracking routine (§26/§27)
  weighInWeekday: number;      // 0 = Sunday … 6 = Saturday
  photoIntervalDays: number;

  // ── Feature switches (§41/§70)
  fastingEnabled: boolean;
  units: 'metric' | 'imperial';

  // ── Training setup (§32/§33). Empty means "not configured yet", which the
  // onboarding uses to decide whether to ask.
  equipment: import('@/domain/equipment').EquipmentId[];
  trainingFocus: import('@/domain/equipment').TrainingFocusId[];
  weeklyTrainingGoal: number | null;
  onboardedAt: string | null;
  healthEnabled: boolean;
};

/**
 * One entry in the user's goal history (§29).
 * The active phase is the one with `endDate === null`.
 */
export type GoalPhaseRecord = {
  id: string;
  phaseType: import('@/domain/goalPhase').PhaseType;
  label: string;
  startDate: string;
  endDate: string | null;
  caloriesMin: number | null;
  caloriesMax: number | null;
  proteinMin: number | null;
  proteinMax: number | null;
  stepsGoal: number | null;
  waterGoalMl: number | null;
  sleepGoalH: number | null;
  weeklyTrainingGoal: number | null;
  weightGoal: number | null;
  weeklyWeightChangeKg: number | null;
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

// ═══════════════════════════════════════════════════════════════════════════
// Nutrition library (§12/§13) and daily check-in (§22)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * How much we trust a nutrition number (§11).
 *  - verified:  from a barcode, a package, or a value the user confirmed
 *  - estimated: a plausible guess — shown with a "~" and a range
 *  - unknown:   not enough information; the app asks instead of inventing
 */
export type DataQuality = 'verified' | 'estimated' | 'unknown';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type EntrySource = 'manual' | 'search' | 'barcode' | 'ai' | 'favorite' | 'recipe' | 'prep';

export type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export type FoodItem = {
  id: string;
  name: string;
  brand: string;
  servingLabel: string;
  servingG: number | null;
  macros: Macros;
  dataQuality: DataQuality;
  barcode: string | null;
  favorite: boolean;
  useCount: number;
  lastUsedAt: string | null;
};

export type RecipeIngredient = {
  id: string;
  foodItemId: string | null;
  name: string;
  amountLabel: string;
  macros: Macros;
  orderIndex: number;
};

export type Recipe = {
  id: string;
  name: string;
  totalServings: number;
  servingLabel: string;
  isMealPrep: boolean;
  favorite: boolean;
  notes: string;
  useCount: number;
  ingredients: RecipeIngredient[];
  /** Sum over all ingredients. */
  totalMacros: Macros;
  /** totalMacros / totalServings. */
  perServing: Macros;
};

/** A cooked batch of a meal-prep recipe, with portions counted down as eaten. */
export type MealPrepBatch = {
  id: string;
  recipeId: string;
  recipeName: string;
  cookedOn: string;
  totalPortions: number;
  portionsUsed: number;
  portionsLeft: number;
  active: boolean;
};

export type Soreness = 'none' | 'light' | 'medium' | 'strong';

export type DailyCheckin = {
  logDate: string;
  soreness: Soreness | null;
  sorenessArea: string;
  energy: number | null;
  note: string;
};

