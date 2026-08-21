/**
 * Goal phases and target RANGES.
 *
 * FORGE deliberately does not track a single hard calorie number (§6). A number
 * like "1.632 kcal übrig" invites two failure modes: it makes 1.633 feel like a
 * failure, and it makes 1.200 look like a success. A range fixes both — you are
 * either inside it, under it, or over it, and all three have a calm answer.
 */

import type { UserGoals } from './types';
import { calculateTdee } from './macroCalculator';

export type PhaseType = 'cut' | 'recomp' | 'maintain' | 'lean_bulk' | 'custom';

export type TargetRange = { min: number; max: number };

/** Where a measured value sits relative to its target range. */
export type RangeStatus = 'far_under' | 'under' | 'in' | 'slightly_over' | 'over';

/** Traffic-light tone. `neutral` = nothing logged yet, so no judgement. */
export type Tone = 'green' | 'yellow' | 'red' | 'neutral';

export type PhaseDefinition = {
  type: PhaseType;
  label: string;
  short: string;
  description: string;
  /** kcal offset applied to TDEE for the middle of the range */
  kcalOffset: number;
  /** protein grams per kg bodyweight, [min, max] */
  proteinPerKg: TargetRange;
  /** expected weekly weight change in kg, used to judge whether things are on track */
  weeklyWeightChangeKg: TargetRange;
  /**
   * Which numbers this phase leads with on the dashboard (§37). A cut is judged
   * on the calorie range; a lean bulk on whether strength is actually rising.
   */
  emphasis: ('calories' | 'protein' | 'weight' | 'strength' | 'activity')[];
};

export const PHASES: Record<PhaseType, PhaseDefinition> = {
  cut: {
    type: 'cut',
    label: 'Cut',
    short: 'Fett reduzieren',
    description: 'Moderates Defizit. Ziel ist Fettverlust bei möglichst vollem Muskelerhalt — deshalb bleibt Protein hoch und Krafttraining wichtig.',
    kcalOffset: -400,
    proteinPerKg: { min: 2.0, max: 2.4 },
    weeklyWeightChangeKg: { min: -0.7, max: -0.2 },
    emphasis: ['calories', 'protein', 'weight'],
  },
  recomp: {
    type: 'recomp',
    label: 'Recomposition',
    short: 'Fett runter, Muskeln rauf',
    description: 'Leichtes Defizit bei hohem Protein und konsequentem Training. Das Gewicht bewegt sich langsam — Fortschritt zeigt sich vor allem in Kraft und Optik.',
    kcalOffset: -150,
    proteinPerKg: { min: 2.0, max: 2.4 },
    weeklyWeightChangeKg: { min: -0.3, max: 0.1 },
    emphasis: ['protein', 'strength', 'weight'],
  },
  maintain: {
    type: 'maintain',
    label: 'Maintenance',
    short: 'Gewicht halten',
    description: 'Kalorien auf Erhaltungsniveau. Gut nach einer Diät, in stressigen Phasen oder als Pause zwischen zwei Zielen.',
    kcalOffset: 0,
    proteinPerKg: { min: 1.8, max: 2.2 },
    weeklyWeightChangeKg: { min: -0.2, max: 0.2 },
    emphasis: ['weight', 'activity', 'protein'],
  },
  lean_bulk: {
    type: 'lean_bulk',
    label: 'Lean Bulk',
    short: 'Kontrolliert aufbauen',
    description: 'Leichter Überschuss. Ziel ist Muskelaufbau mit möglichst wenig Fettzuwachs — deshalb kontrolliert, nicht "so viel wie möglich".',
    kcalOffset: 250,
    proteinPerKg: { min: 1.8, max: 2.2 },
    weeklyWeightChangeKg: { min: 0.1, max: 0.4 },
    emphasis: ['calories', 'strength', 'protein'],
  },
  custom: {
    type: 'custom',
    label: 'Eigenes Ziel',
    short: 'Selbst definiert',
    description: 'Du legst Kalorien, Protein und die übrigen Zielwerte selbst fest. FORGE schlägt nichts vor und wertet nur gegen deine eigenen Zahlen aus.',
    kcalOffset: 0,
    proteinPerKg: { min: 1.6, max: 2.2 },
    weeklyWeightChangeKg: { min: -0.5, max: 0.5 },
    emphasis: ['calories', 'protein', 'activity'],
  },
};

export const PHASE_ORDER: PhaseType[] = ['cut', 'recomp', 'maintain', 'lean_bulk', 'custom'];

export function isPhaseType(value: string | null | undefined): value is PhaseType {
  return PHASE_ORDER.includes(value as PhaseType);
}

/** Maps the legacy `goalType` field onto a phase, so existing users land somewhere sensible. */
export function phaseFromLegacyGoalType(goalType: UserGoals['goalType']): PhaseType {
  if (goalType === 'fat_loss') return 'cut';
  if (goalType === 'muscle') return 'lean_bulk';
  return 'maintain';
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export type ResolvedTargets = {
  phase: PhaseDefinition;
  calories: TargetRange;
  protein: TargetRange;
  steps: number;
  waterMl: number;
  sleepH: number;
  weeklyTrainingGoal: number;
  weightGoal: number | null;
  /** true when the ranges come from stored user settings rather than being derived */
  explicit: boolean;
};

/** Fallbacks used only until the user has been through onboarding (§26/§27). */
export const TARGET_FALLBACKS = {
  steps: 8000,
  waterMl: 2500,
  sleepH: 8,
  weeklyTrainingGoal: 3,
} as const;

/**
 * The single place that answers "what are today's targets?".
 *
 * Precedence: explicitly stored ranges → derived from TDEE + phase → legacy
 * single-value goals widened into a range. That last step is what keeps the app
 * working for a profile saved before this migration ran.
 */
export function resolveTargets(goals: UserGoals): ResolvedTargets {
  const phaseType = isPhaseType(goals.phaseType) ? goals.phaseType : phaseFromLegacyGoalType(goals.goalType);
  const phase = PHASES[phaseType];

  const weightKg = goals.currentWeight ?? 75;
  const tdee = calculateTdee(goals);

  // ── Calories ──────────────────────────────────────────────────────
  let calories: TargetRange;
  let explicit = false;
  if (goals.caloriesMin !== null && goals.caloriesMax !== null && goals.caloriesMax > goals.caloriesMin) {
    calories = { min: goals.caloriesMin, max: goals.caloriesMax };
    explicit = true;
  } else if (tdee !== null) {
    const mid = tdee + phase.kcalOffset;
    calories = { min: Math.max(1200, roundTo(mid - 100, 50)), max: Math.max(1400, roundTo(mid + 100, 50)) };
  } else {
    // No height/age/weight yet — widen the legacy single number by ±100.
    const mid = goals.calorieGoal;
    calories = { min: Math.max(1200, mid - 100), max: mid + 100 };
  }

  // ── Protein ───────────────────────────────────────────────────────
  let protein: TargetRange;
  if (goals.proteinMin !== null && goals.proteinMax !== null && goals.proteinMax >= goals.proteinMin) {
    protein = { min: goals.proteinMin, max: goals.proteinMax };
  } else if (goals.currentWeight !== null) {
    protein = {
      min: roundTo(weightKg * phase.proteinPerKg.min, 5),
      max: roundTo(weightKg * phase.proteinPerKg.max, 5),
    };
  } else {
    protein = { min: goals.proteinGoal, max: goals.proteinGoal + 30 };
  }

  return {
    phase,
    calories,
    protein,
    steps: goals.stepsGoal ?? TARGET_FALLBACKS.steps,
    waterMl: goals.waterGoalMl ?? TARGET_FALLBACKS.waterMl,
    sleepH: goals.sleepGoalH ?? TARGET_FALLBACKS.sleepH,
    weeklyTrainingGoal: goals.weeklyTrainingGoal ?? TARGET_FALLBACKS.weeklyTrainingGoal,
    weightGoal: goals.weightGoal,
    explicit,
  };
}

/**
 * A custom phase must never have targets invented for it — the user said they
 * want to decide. Only the explicit branch above applies; the derived branch is
 * skipped by giving it a zero offset and the user's own numbers.
 */
export function isDerivable(phaseType: PhaseType): boolean {
  return phaseType !== 'custom';
}

// ═══════════════════════════════════════════════════════════════════════════
// Range evaluation
// ═══════════════════════════════════════════════════════════════════════════

export type RangeEvaluation = {
  status: RangeStatus;
  tone: Tone;
  /** 0–1 fill fraction for a progress bar, clamped. */
  fraction: number;
  /** How far outside the range, in the value's own unit. 0 when inside. */
  deviation: number;
};

export type EvaluateOptions = {
  /**
   * While the day is still running, being under the range is simply "not done
   * yet" — not a problem. Pass false to judge a finished day (§16).
   */
  dayInProgress?: boolean;
  /** Tolerance above `max` that still counts as only "slightly over". */
  overTolerance?: number;
  /** Distance below `min` beyond which we flag under-eating. */
  underTolerance?: number;
};

export function evaluateRange(value: number, range: TargetRange, options: EvaluateOptions = {}): RangeEvaluation {
  const dayInProgress = options.dayInProgress ?? false;
  const overTolerance = options.overTolerance ?? Math.max(150, Math.round((range.max - range.min) * 1.5));
  const underTolerance = options.underTolerance ?? Math.max(250, Math.round((range.max - range.min) * 2.5));

  const fraction = range.max > 0 ? Math.min(1, Math.max(0, value / range.max)) : 0;

  if (value > range.max) {
    const deviation = value - range.max;
    return deviation > overTolerance
      ? { status: 'over', tone: 'red', fraction, deviation }
      : { status: 'slightly_over', tone: 'yellow', fraction, deviation };
  }

  if (value >= range.min) {
    return { status: 'in', tone: 'green', fraction, deviation: 0 };
  }

  const deviation = range.min - value;
  // Still eating today → under is expected, not a warning.
  if (dayInProgress) {
    return { status: 'under', tone: value === 0 ? 'neutral' : 'green', fraction, deviation };
  }
  return deviation > underTolerance
    ? { status: 'far_under', tone: 'yellow', fraction, deviation }
    : { status: 'under', tone: 'green', fraction, deviation };
}

/** Traffic-light for a simple "reach this number" goal like steps or water. */
export function evaluateGoal(value: number, goal: number, dayInProgress = false): RangeEvaluation {
  const fraction = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;
  if (value <= 0) return { status: 'under', tone: 'neutral', fraction: 0, deviation: goal };
  if (value >= goal) return { status: 'in', tone: 'green', fraction: 1, deviation: 0 };
  const deviation = goal - value;
  if (dayInProgress) return { status: 'under', tone: fraction >= 0.7 ? 'green' : 'yellow', fraction, deviation };
  return { status: 'under', tone: fraction >= 0.8 ? 'green' : 'yellow', fraction, deviation };
}

export const TONE_COLOR: Record<Tone, string> = {
  green: 'var(--teal)',
  yellow: 'var(--gold)',
  red: 'var(--danger)',
  neutral: 'var(--subtle)',
};

export const TONE_DOT: Record<Tone, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  neutral: '⚪',
};

export function formatRange(range: TargetRange, unit = ''): string {
  const suffix = unit ? ` ${unit}` : '';
  return `${range.min.toLocaleString('de-DE')}–${range.max.toLocaleString('de-DE')}${suffix}`;
}
