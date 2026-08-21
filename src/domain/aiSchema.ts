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
export type RawEntry = {
  kind: 'food' | 'metric' | 'workout';
  name: string;
  libraryId: string | null;
  libraryKind: 'food' | 'recipe' | 'none';
  quantity: number;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  kcalMin: number | null;
  kcalMax: number | null;
  confidence: ParseConfidence;
  metric: ParsedMetric | 'none';
  metricValue: number | null;
  reps: number[];
};

export type RawParseResult = {
  entries: RawEntry[];
  question: string | null;
  note: string | null;
};

/**
 * JSON Schema for `output_config.format`.
 *
 * Structured outputs reject numeric/string constraints (`minimum`, `maxLength`
 * …) and require `additionalProperties: false` plus a complete `required` list,
 * so optional values are modelled as nullable types rather than omitted keys.
 * Bounds are enforced in `validateParseResult` instead.
 */
export const PARSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      description: 'One row per thing the user logged. Empty when nothing could be identified.',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['food', 'metric', 'workout'],
            description: 'food = eaten or drunk; metric = steps/water/sleep/weight; workout = an exercise with reps.',
          },
          name: { type: 'string', description: 'Short label as the user would recognise it.' },
          libraryId: {
            type: ['string', 'null'],
            description: 'Exact id from the provided library when this matches a saved item. Null otherwise.',
          },
          libraryKind: { type: 'string', enum: ['food', 'recipe', 'none'] },
          quantity: {
            type: 'number',
            description: 'How many servings/portions. 2 Isoclear = 2. Half a portion = 0.5. Use 1 when unclear.',
          },
          kcal: {
            type: ['number', 'null'],
            description: 'ONLY when libraryId is null and you are estimating. Never fill this for a library item.',
          },
          proteinG: { type: ['number', 'null'] },
          carbsG: { type: ['number', 'null'] },
          fatG: { type: ['number', 'null'] },
          kcalMin: {
            type: ['number', 'null'],
            description: 'Lower bound of a plausible range. Required when confidence is low.',
          },
          kcalMax: { type: ['number', 'null'], description: 'Upper bound of a plausible range.' },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'high = from the library or a packaged product; low = a rough guess from a description.',
          },
          metric: { type: 'string', enum: ['steps', 'water_ml', 'sleep_h', 'weight_kg', 'none'] },
          metricValue: { type: ['number', 'null'], description: 'Value in the metric unit: ml, hours, kg, steps.' },
          reps: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Reps per set for a workout entry, e.g. [10, 9, 8]. Empty for other kinds.',
          },
        },
        required: [
          'kind', 'name', 'libraryId', 'libraryKind', 'quantity', 'kcal', 'proteinG', 'carbsG', 'fatG',
          'kcalMin', 'kcalMax', 'confidence', 'metric', 'metricValue', 'reps',
        ],
        additionalProperties: false,
      },
    },
    question: {
      type: ['string', 'null'],
      description: 'A short question in German when the input is too vague to log honestly. Null when not needed.',
    },
    note: { type: ['string', 'null'], description: 'One short German sentence of context. Null when not needed.' },
  },
  required: ['entries', 'question', 'note'],
  additionalProperties: false,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Validation — the gate between model output and the app
// ═══════════════════════════════════════════════════════════════════════════

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
export function validateParseResult(raw: unknown): ValidatedParseResult {
  const out: ValidatedParseResult = { entries: [], question: null, note: null, rejected: 0 };
  if (!raw || typeof raw !== 'object') return out;

  const root = raw as Partial<RawParseResult>;
  out.question = typeof root.question === 'string' && root.question.trim() ? root.question.trim() : null;
  out.note = typeof root.note === 'string' && root.note.trim() ? root.note.trim() : null;

  if (!Array.isArray(root.entries)) return out;

  for (const item of root.entries) {
    const entry = validateEntry(item);
    if (entry) out.entries.push(entry);
    else out.rejected += 1;
  }

  return out;
}

function validateEntry(item: unknown): ValidatedEntry | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Partial<RawEntry>;
  const name = typeof row.name === 'string' ? row.name.trim().slice(0, 120) : '';

  // ── Metric ────────────────────────────────────────────────────────
  if (row.kind === 'metric') {
    const metric = row.metric;
    if (metric === undefined || metric === 'none') return null;
    const value = finiteNumber(row.metricValue);
    if (value === null || value <= 0) return null;

    const ceiling =
      metric === 'steps' ? LIMITS.steps
      : metric === 'water_ml' ? LIMITS.waterMl
      : metric === 'sleep_h' ? LIMITS.sleepH
      : metric === 'weight_kg' ? LIMITS.weightKg
      : 0;
    if (ceiling === 0 || value > ceiling) return null;

    return { kind: 'metric', metric, value, name: name || metric };
  }

  // ── Workout ───────────────────────────────────────────────────────
  if (row.kind === 'workout') {
    if (!name) return null;
    const reps = Array.isArray(row.reps)
      ? row.reps
          .map((r) => finiteNumber(r))
          .filter((r): r is number => r !== null && r > 0 && r <= LIMITS.reps)
          .map((r) => Math.round(r))
      : [];
    if (reps.length === 0) return null;
    return { kind: 'workout', name, reps };
  }

  // ── Food ──────────────────────────────────────────────────────────
  if (row.kind !== 'food' || !name) return null;

  const quantity = clampPositive(finiteNumber(row.quantity), LIMITS.quantity) ?? 1;
  if (quantity <= 0) return null;

  const libraryId =
    typeof row.libraryId === 'string' && row.libraryId.trim() ? row.libraryId.trim() : null;
  const libraryKind =
    libraryId && (row.libraryKind === 'food' || row.libraryKind === 'recipe') ? row.libraryKind : null;

  // A library hit needs no estimate — the app supplies the macros.
  if (libraryId && libraryKind) {
    return {
      kind: 'food',
      name,
      libraryId,
      libraryKind,
      quantity,
      estimate: null,
      range: null,
      dataQuality: 'verified',
      confidence: 'high',
    };
  }

  const kcal = clampPositive(finiteNumber(row.kcal), LIMITS.kcal);
  const proteinG = clampPositive(finiteNumber(row.proteinG), LIMITS.protein) ?? 0;
  const confidence: ParseConfidence =
    row.confidence === 'high' || row.confidence === 'medium' || row.confidence === 'low'
      ? row.confidence
      : 'low';

  const min = clampPositive(finiteNumber(row.kcalMin), LIMITS.kcal);
  const max = clampPositive(finiteNumber(row.kcalMax), LIMITS.kcal);
  const range = min !== null && max !== null && max > min ? { min, max } : null;

  // No number and no range at all → we genuinely do not know (§11 UNKNOWN).
  if (kcal === null && range === null) {
    return {
      kind: 'food',
      name,
      libraryId: null,
      libraryKind: null,
      quantity,
      estimate: null,
      range: null,
      dataQuality: 'unknown',
      confidence: 'low',
    };
  }

  const midpoint = kcal ?? (range ? Math.round((range.min + range.max) / 2) : 0);
  const carbsG = clampPositive(finiteNumber(row.carbsG), LIMITS.kcal) ?? 0;
  const fatG = clampPositive(finiteNumber(row.fatG), LIMITS.kcal) ?? 0;

  return {
    kind: 'food',
    name,
    libraryId: null,
    libraryKind: null,
    quantity,
    estimate: { kcal: midpoint, proteinG, carbsG, fatG },
    // Nothing from the model is ever "verified" — that word is reserved for
    // barcodes, packaging and values the user confirmed themselves.
    range,
    dataQuality: confidence === 'low' ? 'estimated' : 'estimated',
    confidence,
  };
}
