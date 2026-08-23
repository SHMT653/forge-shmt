/**
 * The contract between FORGE and the language model.
 *
 * Two rules shape this file (§53/§54/§78):
 *
 *  1. The model returns REFERENCES and QUANTITIES, not nutrition maths. When an
 *     item exists in the user's library, FORGE looks up its macros itself —
 *     the model must not add up calories it was already told.
 *  2. Nothing the model returns reaches the database directly. It is parsed
 *     into these types, validated, shown to the user, and only then saved.
 */

import type { DataQuality } from './types';

export type ParseConfidence = 'high' | 'medium' | 'low';
export type ParsedMetric = 'steps' | 'water_ml' | 'sleep_h' | 'weight_kg';

/** One raw row exactly as the model returns it. Every field is always present. */
/**
 * JSON Schema for `output_config.format`.
 *
 * Structured outputs reject numeric/string constraints (`minimum`, `maxLength`
 * …) and require `additionalProperties: false` plus a complete `required` list,
 * so optional values are modelled as nullable types rather than omitted keys.
 * Bounds are enforced in `validateParseResult` instead.
 */
export type ValidatedFoodEntry = {
  kind: 'food';
  name: string;
  libraryId: string | null;
  libraryKind: 'food' | 'recipe' | null;
  quantity: number;
  /** Present only for entries the model estimated. */
  estimate: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  range: { min: number; max: number } | null;
  dataQuality: DataQuality;
  confidence: ParseConfidence;
};

export type ValidatedMetricEntry = {
  kind: 'metric';
  metric: ParsedMetric;
  value: number;
  name: string;
};

export type ValidatedWorkoutEntry = {
  kind: 'workout';
  name: string;
  reps: number[];
};

export type ValidatedEntry = ValidatedFoodEntry | ValidatedMetricEntry | ValidatedWorkoutEntry;

export type ValidatedParseResult = {
  entries: ValidatedEntry[];
  question: string | null;
  note: string | null;
  /** Rows dropped because they were unusable — surfaced for debugging, not shown raw. */
  rejected: number;
};

/** Plausibility ceilings. A model slip should never write 90.000 kcal into a day. */
const LIMITS = {
  kcal: 6000,
  protein: 500,
  quantity: 50,
  steps: 100_000,
  waterMl: 10_000,
  sleepH: 24,
  weightKg: 400,
  reps: 1000,
} as const;

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function clampPositive(value: number | null, max: number): number | null {
  if (value === null || value < 0 || value > max) return null;
  return value;
}

/**
 * Converts raw model output into entries the app is willing to act on.
 * Anything implausible is dropped rather than corrected — a silently "fixed"
 * value is worse than a missing one, because the user cannot see it happen.
 */
