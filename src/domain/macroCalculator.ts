import type { ActivityLevel, GoalType, Gender, UserGoals } from './types';

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

export type CalculatedMacros = { calories: number; protein: number };

/** Age in whole years, or null when the profile has no usable birth year. */
export function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  return age < 10 || age > 120 ? null : age;
}

/**
 * Mifflin-St Jeor BMR scaled by activity level.
 * Extracted so the goal-phase model can build calorie RANGES off the same
 * number the legacy single-value calculator uses — one formula, one truth.
 */
export function calculateTdee(goals: UserGoals): number | null {
  const { currentWeight, heightCm, birthYear, gender, activityLevel } = goals;
  if (!currentWeight || !heightCm) return null;
  const age = ageFromBirthYear(birthYear);
  if (age === null) return null;

  const base = 10 * currentWeight + 6.25 * heightCm - 5 * age;
  const bmr = gender === 'female' ? base - 161 : base + 5;
  return Math.round(bmr * ACTIVITY_MULTIPLIER[activityLevel]);
}

export function calculateMacros(goals: UserGoals): CalculatedMacros | null {
  const { currentWeight, goalType } = goals;
  const tdee = calculateTdee(goals);
  if (tdee === null || !currentWeight) return null;

  let calories: number;
  let proteinPerKg: number;

  switch (goalType as GoalType) {
    case 'muscle':
      calories = tdee + 300;
      proteinPerKg = 2.2;
      break;
    case 'fat_loss':
      calories = tdee - 500;
      proteinPerKg = 2.0;
      break;
    default:
      calories = tdee;
      proteinPerKg = 1.8;
  }

  return {
    calories: Math.max(1200, Math.round(calories)),
    protein: Math.round(currentWeight * proteinPerKg),
  };
}

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  muscle:   'Muskelaufbau',
  fat_loss: 'Fettabbau',
  maintain: 'Gewicht halten',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:   'Kaum Bewegung (Büro)',
  light:       'Leicht aktiv (1–2× Sport)',
  moderate:    'Mäßig aktiv (3–5× Sport)',
  active:      'Sehr aktiv (6–7× Sport)',
  very_active: 'Extrem aktiv (2× täglich)',
};
