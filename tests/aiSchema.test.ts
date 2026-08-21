import { describe, expect, it } from 'vitest';
import { validateParseResult, type RawEntry } from '@/domain/aiSchema';

function raw(patch: Partial<RawEntry>): RawEntry {
  return {
    kind: 'food',
    name: 'Test',
    libraryId: null,
    libraryKind: 'none',
    quantity: 1,
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    kcalMin: null,
    kcalMax: null,
    confidence: 'medium',
    metric: 'none',
    metricValue: null,
    reps: [],
    ...patch,
  };
}

function parse(entries: Partial<RawEntry>[]) {
  return validateParseResult({ entries: entries.map(raw), question: null, note: null });
}

describe('library references (§54)', () => {
  it('keeps a library hit as verified with no invented macros', () => {
    const result = parse([{ name: 'Isoclear', libraryId: 'abc-123', libraryKind: 'food', quantity: 2, kcal: 999 }]);
    const entry = result.entries[0];
    expect(entry?.kind).toBe('food');
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.libraryId).toBe('abc-123');
    expect(entry.quantity).toBe(2);
    expect(entry.dataQuality).toBe('verified');
    // The model's own kcal guess is discarded — the app looks the value up.
    expect(entry.estimate).toBeNull();
  });

  it('ignores a library id without a usable kind', () => {
    const result = parse([{ name: 'X', libraryId: 'abc', libraryKind: 'none', kcal: 200 }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.libraryId).toBeNull();
  });
});

describe('estimates are never verified (§11)', () => {
  it('labels a guessed item as estimated', () => {
    const result = parse([{ name: 'Restaurant-Pizza', kcal: 900, proteinG: 35, confidence: 'low', kcalMin: 700, kcalMax: 1100 }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.dataQuality).toBe('estimated');
    expect(entry.range).toEqual({ min: 700, max: 1100 });
  });

  it('marks an item with no numbers at all as unknown rather than zero', () => {
    const result = parse([{ name: 'Irgendwas', kcal: null, kcalMin: null, kcalMax: null }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.dataQuality).toBe('unknown');
    expect(entry.estimate).toBeNull();
  });

  it('derives a midpoint from a range when no single figure was given', () => {
    const result = parse([{ name: 'Pizza', kcal: null, kcalMin: 700, kcalMax: 900 }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.estimate?.kcal).toBe(800);
  });

  it('drops an inverted range instead of trusting it', () => {
    const result = parse([{ name: 'Pizza', kcal: 800, kcalMin: 900, kcalMax: 700 }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.range).toBeNull();
  });
});

describe('plausibility guards', () => {
  it('rejects an absurd calorie count outright', () => {
    const result = parse([{ name: 'Bug', kcal: 90000 }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    // Falls back to unknown rather than writing 90.000 kcal into the day.
    expect(entry.dataQuality).toBe('unknown');
  });

  it('rejects negative values', () => {
    const result = parse([{ name: 'Bug', kcal: -500 }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.estimate).toBeNull();
  });

  it('defaults a missing quantity to one', () => {
    const result = parse([{ name: 'Skyr', kcal: 150, quantity: 0 }]);
    expect(result.entries).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('drops an entry with no name', () => {
    expect(parse([{ name: '   ', kcal: 200 }]).entries).toHaveLength(0);
  });

  it('caps runaway quantities', () => {
    const result = parse([{ name: 'Wrap', kcal: 380, quantity: 9999 }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.quantity).toBe(1);
  });
});

describe('metrics', () => {
  it('accepts steps, water, sleep and weight', () => {
    const result = parse([
      { kind: 'metric', name: 'Schritte', metric: 'steps', metricValue: 7000 },
      { kind: 'metric', name: 'Wasser', metric: 'water_ml', metricValue: 2000 },
      { kind: 'metric', name: 'Schlaf', metric: 'sleep_h', metricValue: 10 },
      { kind: 'metric', name: 'Gewicht', metric: 'weight_kg', metricValue: 73.2 },
    ]);
    expect(result.entries).toHaveLength(4);
  });

  it('rejects impossible values', () => {
    const result = parse([
      { kind: 'metric', name: 'Schlaf', metric: 'sleep_h', metricValue: 99 },
      { kind: 'metric', name: 'Gewicht', metric: 'weight_kg', metricValue: 900 },
      { kind: 'metric', name: 'Schritte', metric: 'steps', metricValue: 0 },
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.rejected).toBe(3);
  });

  it('rejects a metric row with no metric named', () => {
    expect(parse([{ kind: 'metric', name: 'x', metric: 'none', metricValue: 10 }]).entries).toHaveLength(0);
  });
});

describe('workouts', () => {
  it('parses "Pushups 10 9 8" into reps', () => {
    const result = parse([{ kind: 'workout', name: 'Liegestütze', reps: [10, 9, 8] }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'workout') throw new Error('expected workout');
    expect(entry.reps).toEqual([10, 9, 8]);
  });

  it('filters out impossible reps but keeps the rest', () => {
    const result = parse([{ kind: 'workout', name: 'Liegestütze', reps: [10, -5, 99999, 8] }]);
    const entry = result.entries[0];
    if (entry?.kind !== 'workout') throw new Error('expected workout');
    expect(entry.reps).toEqual([10, 8]);
  });

  it('drops a workout with no usable reps', () => {
    expect(parse([{ kind: 'workout', name: 'Liegestütze', reps: [] }]).entries).toHaveLength(0);
  });
});

describe('malformed model output', () => {
  it('survives null', () => {
    expect(validateParseResult(null).entries).toEqual([]);
  });

  it('survives a non-object', () => {
    expect(validateParseResult('nope').entries).toEqual([]);
  });

  it('survives entries not being an array', () => {
    expect(validateParseResult({ entries: 'nope', question: null, note: null }).entries).toEqual([]);
  });

  it('survives junk inside the entries array', () => {
    const result = validateParseResult({ entries: [null, 42, 'x', {}], question: null, note: null });
    expect(result.entries).toEqual([]);
    expect(result.rejected).toBe(4);
  });

  it('keeps a clarifying question', () => {
    const result = validateParseResult({ entries: [], question: 'Wie groß war die Portion?', note: null });
    expect(result.question).toBe('Wie groß war die Portion?');
  });
});
