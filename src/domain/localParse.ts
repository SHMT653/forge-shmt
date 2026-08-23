/**
 * Deterministic parser for the input FORGE actually receives.
 *
 * Most entries are highly regular — "7000 Schritte", "2 Isoclear",
 * "Liegestütze 10 9 8". None of that needs a language model: rules handle it
 * instantly, offline, and at no cost. The model is only worth calling for
 * genuinely unstructured input like "Restaurant-Pizza mit Pommes".
 *
 * Returns the same shape as the AI path, so the UI cannot tell the difference.
 */

import type { ValidatedEntry, ValidatedParseResult } from './parsedEntry';

export type LibraryItem = {
  id: string;
  kind: 'food' | 'recipe';
  name: string;
  /** kcal/protein per serving, so a local hit needs no lookup afterwards. */
  macros?: { kcal: number; proteinG: number; carbsG: number; fatG: number };
};

/** Strips diacritics and case so "Müsli" matches "muesli" and "MUSLI". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s.,:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "7.000" → 7000, "7,5" → 7.5. German separators, both directions. */
function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

// ── Metric patterns ─────────────────────────────────────────────────────────

type MetricRule = {
  pattern: RegExp;
  build: (match: RegExpMatchArray) => ValidatedEntry | null;
};

const METRIC_RULES: MetricRule[] = [
  // "7000 Schritte" / "Schritte 7000" / "7.500 steps"
  {
    pattern: /(?:^|\s)(\d[\d.,]*)\s*(?:schritte?|steps?)(?:\s|$)|(?:schritte?|steps?)\s*(\d[\d.,]*)/,
    build: (m) => {
      const value = parseNumber(m[1] ?? m[2] ?? '');
      return value && value > 0
        ? { kind: 'metric', metric: 'steps', value: Math.round(value), name: 'Schritte' }
        : null;
    },
  },
  // "2 Liter Wasser" / "500 ml" / "0,5l getrunken"
  {
    pattern: /(?:^|\s)(\d[\d.,]*)\s*(ml|l|liter)(?:\s|$)/,
    build: (m) => {
      const value = parseNumber(m[1] ?? '');
      if (!value || value <= 0) return null;
      const unit = (m[2] ?? '').toLowerCase();
      const ml = unit === 'ml' ? value : value * 1000;
      return { kind: 'metric', metric: 'water_ml', value: Math.round(ml), name: 'Wasser' };
    },
  },
  // "8 Stunden geschlafen" / "7,5h" / "8:30 geschlafen"
  {
    pattern: /(?:^|\s)(\d{1,2})[:.](\d{2})\s*(?:h|std|stunden)?\s*(?:geschlafen|schlaf)|(?:^|\s)(\d[\d.,]*)\s*(?:h|std|stunden)\b/,
    build: (m) => {
      if (m[1] && m[2]) {
        const hours = Number(m[1]) + Number(m[2]) / 60;
        return hours > 0 && hours <= 24
          ? { kind: 'metric', metric: 'sleep_h', value: Math.round(hours * 100) / 100, name: 'Schlaf' }
          : null;
      }
      const value = parseNumber(m[3] ?? '');
      return value && value > 0 && value <= 24
        ? { kind: 'metric', metric: 'sleep_h', value, name: 'Schlaf' }
        : null;
    },
  },
  // "73,2 kg" — only when the text is about weighing, so a "20 kg Hantel"
  // in a workout note is not mistaken for bodyweight.
  {
    pattern: /(?:gewicht|gewogen|wiege|waage)\D*(\d[\d.,]*)\s*kg|(?:^|\s)(\d{2,3}[.,]\d)\s*kg(?:\s|$)/,
    build: (m) => {
      const value = parseNumber(m[1] ?? m[2] ?? '');
      return value && value >= 25 && value <= 400
        ? { kind: 'metric', metric: 'weight_kg', value, name: 'Gewicht' }
        : null;
    },
  },
];

// ── Workout pattern ─────────────────────────────────────────────────────────

/**
 * "Liegestütze 10 9 8" / "pushups 12/10/9" — a name followed by rep counts.
 * Runs on the normalised text, because `[a-z]` never matches "ü".
 */
function parseWorkout(normalized: string): ValidatedEntry | null {
  const match = normalized.match(/^([a-z][a-z\s-]{2,30}?)\s+((?:\d{1,3}\s*[\/,x-]?\s*){2,8})$/);
  if (!match) return null;

  const name = (match[1] ?? '').trim();
  const reps = (match[2] ?? '')
    .split(/[\s\/,x-]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 1000);

  if (reps.length < 2 || !name) return null;
  return { kind: 'workout', name: capitalize(name), reps };
}

// ── Library matching ────────────────────────────────────────────────────────

/**
 * Finds a saved food or recipe in a phrase like "2 Isoclear".
 * Requires a confident match — a vague partial hit is left to the model or the
 * user rather than guessed at (§11).
 */
function matchLibrary(segment: string, library: readonly LibraryItem[]): ValidatedEntry | null {
  const quantityMatch = segment.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|×|mal)?\s+(.*)$/);
  const quantity = quantityMatch ? (parseNumber(quantityMatch[1] ?? '') ?? 1) : 1;
  const phrase = normalize(quantityMatch ? (quantityMatch[2] ?? '') : segment);
  if (phrase.length < 3) return null;

  let best: { item: LibraryItem; score: number } | null = null;

  for (const item of library) {
    const name = normalize(item.name);
    if (!name) continue;

    let score = 0;
    if (name === phrase) score = 100;
    else if (phrase.startsWith(name) || name.startsWith(phrase)) score = 80;
    else if (phrase.includes(name) || name.includes(phrase)) score = 60;
    else {
      // Token overlap catches "skyr himbeeren" against "Skyr mit Himbeeren".
      const phraseTokens = new Set(phrase.split(' ').filter((t) => t.length > 2));
      const nameTokens = name.split(' ').filter((t) => t.length > 2);
      if (nameTokens.length > 0) {
        const hits = nameTokens.filter((token) => phraseTokens.has(token)).length;
        const ratio = hits / nameTokens.length;
        if (ratio >= 0.6) score = Math.round(40 * ratio);
      }
    }

    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }

  if (!best || best.score < 24) return null;

  return {
    kind: 'food',
    name: best.item.name,
    libraryId: best.item.id,
    libraryKind: best.item.kind,
    quantity: quantity > 0 && quantity <= 50 ? quantity : 1,
    estimate: null,
    range: null,
    // A library hit is the user's own confirmed number.
    dataQuality: 'verified',
    confidence: 'high',
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

export type LocalParseResult = ValidatedParseResult & {
  /** Segments the rules could not explain — the case worth asking a model about. */
  unresolved: string[];
};

/**
 * Splits the input on "und" / commas and applies the rules to each piece.
 * Anything unexplained is reported rather than guessed at.
 */
export function parseLocally(text: string, library: readonly LibraryItem[] = []): LocalParseResult {
  const entries: ValidatedEntry[] = [];
  const unresolved: string[] = [];

  const segments = text
    // A comma between two digits is a German decimal point, not a list
    // separator — splitting on it turned "0,5 l" into "0" and "5 l".
    .split(/\s+und\s+|\s*[;+]\s*|\s*,(?!\d)\s*|\s*\n+\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const normalized = normalize(segment);

    const metric = METRIC_RULES.reduce<ValidatedEntry | null>((found, rule) => {
      if (found) return found;
      const match = normalized.match(rule.pattern);
      return match ? rule.build(match) : null;
    }, null);
    if (metric) {
      entries.push(metric);
      continue;
    }

    const workout = parseWorkout(normalized);
    if (workout) {
      entries.push(workout);
      continue;
    }

    const food = matchLibrary(segment, library);
    if (food) {
      entries.push(food);
      continue;
    }

    unresolved.push(segment);
  }

  return { entries, question: null, note: null, rejected: 0, unresolved };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
