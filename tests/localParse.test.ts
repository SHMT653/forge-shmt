import { describe, expect, it } from 'vitest';
import { parseLocally, type LibraryItem } from '@/domain/localParse';

const library: LibraryItem[] = [
  { id: 'f1', kind: 'food', name: 'ESN Isoclear' },
  { id: 'f2', kind: 'food', name: 'White Red Bull' },
  { id: 'r1', kind: 'recipe', name: 'Caesar Chicken Wrap' },
  { id: 'r2', kind: 'recipe', name: 'Skyr mit Himbeeren' },
];

describe('metrics without a model', () => {
  it('reads steps', () => {
    const entry = parseLocally('7000 Schritte').entries[0];
    expect(entry).toEqual({ kind: 'metric', metric: 'steps', value: 7000, name: 'Schritte' });
  });

  it('reads German thousand separators', () => {
    const entry = parseLocally('7.482 Schritte').entries[0];
    expect(entry?.kind === 'metric' && entry.value).toBe(7482);
  });

  it('reads water in both units', () => {
    const ml = parseLocally('500 ml').entries[0];
    expect(ml?.kind === 'metric' && ml.value).toBe(500);
    const liters = parseLocally('2 Liter Wasser').entries[0];
    expect(liters?.kind === 'metric' && liters.value).toBe(2000);
    const half = parseLocally('0,5 l getrunken').entries[0];
    expect(half?.kind === 'metric' && half.value).toBe(500);
  });

  it('reads sleep as hours and as a clock value', () => {
    const hours = parseLocally('8 Stunden geschlafen').entries[0];
    expect(hours?.kind === 'metric' && hours.value).toBe(8);
    const decimal = parseLocally('7,5h').entries[0];
    expect(decimal?.kind === 'metric' && decimal.value).toBe(7.5);
    const clock = parseLocally('8:30 geschlafen').entries[0];
    expect(clock?.kind === 'metric' && clock.value).toBe(8.5);
  });

  it('reads weight only when the text is about weighing', () => {
    const explicit = parseLocally('Gewicht 73,2 kg').entries[0];
    expect(explicit).toEqual({ kind: 'metric', metric: 'weight_kg', value: 73.2, name: 'Gewicht' });
    const decimal = parseLocally('73,2 kg').entries[0];
    expect(decimal?.kind === 'metric' && decimal.metric).toBe('weight_kg');
  });

  it('does not mistake a dumbbell weight for bodyweight', () => {
    // "20 kg" with no decimal and no weighing word must not become a weigh-in.
    const result = parseLocally('Bizepscurls 20 kg');
    expect(result.entries.find((e) => e.kind === 'metric')).toBeUndefined();
  });

  it('rejects an impossible sleep value', () => {
    expect(parseLocally('99 Stunden').entries).toHaveLength(0);
  });
});

describe('workouts', () => {
  it('reads "Liegestütze 10 9 8"', () => {
    const entry = parseLocally('Liegestütze 10 9 8').entries[0];
    expect(entry).toEqual({ kind: 'workout', name: 'Liegestuetze', reps: [10, 9, 8] });
  });

  it('accepts slashes and commas between reps', () => {
    const entry = parseLocally('Pushups 12/10/9').entries[0];
    expect(entry?.kind === 'workout' && entry.reps).toEqual([12, 10, 9]);
  });

  it('needs at least two sets to count as a workout', () => {
    expect(parseLocally('Liegestütze 10').entries.find((e) => e.kind === 'workout')).toBeUndefined();
  });
});

describe('library matching', () => {
  it('matches an exact saved product with a quantity', () => {
    const entry = parseLocally('2 Isoclear', library).entries[0];
    expect(entry?.kind).toBe('food');
    if (entry?.kind !== 'food') throw new Error('expected food');
    expect(entry.libraryId).toBe('f1');
    expect(entry.quantity).toBe(2);
    expect(entry.dataQuality).toBe('verified');
  });

  it('defaults the quantity to one', () => {
    const entry = parseLocally('Isoclear', library).entries[0];
    expect(entry?.kind === 'food' && entry.quantity).toBe(1);
  });

  it('matches a recipe by loose wording', () => {
    const entry = parseLocally('Skyr Himbeeren', library).entries[0];
    expect(entry?.kind === 'food' && entry.libraryId).toBe('r2');
    expect(entry?.kind === 'food' && entry.libraryKind).toBe('recipe');
  });

  it('handles umlauts and casing', () => {
    const entry = parseLocally('1 CAESAR CHICKEN WRAP', library).entries[0];
    expect(entry?.kind === 'food' && entry.libraryId).toBe('r1');
  });

  it('reports an unknown food instead of guessing at it', () => {
    const result = parseLocally('Restaurant-Pizza mit Pommes', library);
    expect(result.entries).toHaveLength(0);
    expect(result.unresolved).toEqual(['Restaurant-Pizza mit Pommes']);
  });

  it('does not match on a single shared letter', () => {
    expect(parseLocally('x', library).entries).toHaveLength(0);
  });
});

describe('several things at once', () => {
  it('splits on "und"', () => {
    const result = parseLocally('2 Isoclear und 7000 Schritte', library);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.kind).toBe('food');
    expect(result.entries[1]?.kind).toBe('metric');
  });

  it('splits on commas', () => {
    const result = parseLocally('500 ml, 8 Stunden geschlafen, Isoclear', library);
    expect(result.entries).toHaveLength(3);
  });

  it('keeps the parts it understood and reports the rest', () => {
    const result = parseLocally('7000 Schritte und irgendein Restaurantessen', library);
    expect(result.entries).toHaveLength(1);
    expect(result.unresolved).toHaveLength(1);
  });

  it('returns nothing for empty input rather than throwing', () => {
    expect(parseLocally('').entries).toHaveLength(0);
    expect(parseLocally('   ').unresolved).toHaveLength(0);
  });
});
