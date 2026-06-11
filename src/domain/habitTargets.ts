import type { UserGoals } from './types';

/**
 * Compute personalized daily habit targets from user profile.
 * Called each time habits are loaded — values auto-update when profile changes.
 */
export function computeHabitTargets(goals: UserGoals): {
  water: number;   // ml
  steps: number;
  sleep: number;   // hours
} {
  const weightKg = goals.currentWeight ?? 75;

  // ── Water ──────────────────────────────────────────────────────────
  // 35 ml per kg, rounded to nearest 100 ml, clamped 2000–4000 ml
  const water = Math.max(2000, Math.min(4000, Math.round((weightKg * 35) / 100) * 100));

  // ── Steps ──────────────────────────────────────────────────────────
  const stepsBase: Record<string, number> = {
    sedentary:   6000,
    light:       8000,
    moderate:    9500,
    active:      11000,
    very_active: 13000,
  };
  const stepsGoalAdj: Record<string, number> = {
    fat_loss: 1500,   // more walking accelerates fat loss
    maintain: 0,
    muscle:   -500,   // less cardio preserves muscle gains
  };
  const steps = Math.max(5000, Math.min(15000,
    (stepsBase[goals.activityLevel] ?? 9500) + (stepsGoalAdj[goals.goalType] ?? 0)
  ));

  // ── Sleep ──────────────────────────────────────────────────────────
  const age = goals.birthYear ? new Date().getFullYear() - goals.birthYear : 28;
  const sleep = age < 18 ? 9 : age < 26 ? 8 : age < 65 ? 7.5 : 7;

  return { water, steps, sleep };
}
