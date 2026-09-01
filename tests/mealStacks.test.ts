import { describe, expect, it } from 'vitest';
import { formatServings, stackMealEntries, type StackableEntry } from '@/domain/mealStacks';

function entry(patch: Partial<StackableEntry> = {}): StackableEntry {
  return {
    id: patch.id ?? 'e1',
    name: 'Milch',
    slot: 'breakfast',
    servings: 1,
    kcal: 90,
    proteinG: 7,
    carbsG: 10,
    fatG: 3,
    kcalMin: null,
    kcalMax: null,
    dataQuality: 'verified',
    loggedAt: '2026-09-01T07:00:00.000Z',
    foodItemId: 'milk',
    recipeId: null,
    ...patch,
  };
}

describe('stackMealEntries', () => {
  it('macht aus zweimal Milch einen Stapel mit zwei Portionen', () => {
    const stacks = stackMealEntries([
      entry({ id: 'a', loggedAt: '2026-09-01T07:00:00.000Z' }),
      entry({ id: 'b', loggedAt: '2026-09-01T07:20:00.000Z' }),
    ]);

    expect(stacks).toHaveLength(1);
    expect(stacks[0]?.servings).toBe(2);
    expect(stacks[0]?.kcal).toBe(180);
    expect(stacks[0]?.proteinG).toBe(14);
    expect(stacks[0]?.entries).toHaveLength(2);
  });

  it('merkt sich den ersten und den letzten Eintrag', () => {
    const stacks = stackMealEntries([
      entry({ id: 'spaet', loggedAt: '2026-09-01T09:00:00.000Z' }),
      entry({ id: 'frueh', loggedAt: '2026-09-01T07:00:00.000Z' }),
    ]);

    expect(stacks[0]?.first.id).toBe('frueh');
    expect(stacks[0]?.latest.id).toBe('spaet');
  });

  it('zählt halbe Portionen halb', () => {
    const stacks = stackMealEntries([
      entry({ id: 'a', servings: 1 }),
      entry({ id: 'b', servings: 0.5, kcal: 45, proteinG: 3.5 }),
    ]);

    expect(stacks).toHaveLength(1);
    expect(stacks[0]?.servings).toBe(1.5);
    expect(stacks[0]?.kcal).toBe(135);
  });

  it('trennt gleichnamige Einträge mit anderen Werten', () => {
    const stacks = stackMealEntries([
      entry({ id: 'a', foodItemId: null, kcal: 90 }),
      entry({ id: 'b', foodItemId: null, kcal: 240 }),
    ]);

    expect(stacks).toHaveLength(2);
  });

  it('stapelt gleichnamige Einträge ohne Lebensmittel-Bezug', () => {
    const stacks = stackMealEntries([
      entry({ id: 'a', foodItemId: null, name: 'Milch' }),
      entry({ id: 'b', foodItemId: null, name: ' milch ' }),
    ]);

    expect(stacks).toHaveLength(1);
    expect(stacks[0]?.servings).toBe(2);
  });

  it('trennt dieselbe Mahlzeit zu verschiedenen Tageszeiten', () => {
    const stacks = stackMealEntries([
      entry({ id: 'a', slot: 'breakfast' }),
      entry({ id: 'b', slot: 'dinner' }),
    ]);

    expect(stacks).toHaveLength(2);
  });

  it('behält die Reihenfolge des ersten Eintrags', () => {
    const stacks = stackMealEntries([
      entry({ id: 'brot', name: 'Brot', foodItemId: 'bread', loggedAt: '2026-09-01T07:05:00.000Z' }),
      entry({ id: 'milch1', loggedAt: '2026-09-01T07:00:00.000Z' }),
      entry({ id: 'milch2', loggedAt: '2026-09-01T07:30:00.000Z' }),
    ]);

    expect(stacks.map((s) => s.name)).toEqual(['Milch', 'Brot']);
  });

  it('addiert Spannen geschätzter Einträge', () => {
    const stacks = stackMealEntries([
      entry({ id: 'a', dataQuality: 'estimated', kcal: 700, kcalMin: 600, kcalMax: 800 }),
      entry({ id: 'b', dataQuality: 'estimated', kcal: 700, kcalMin: 600, kcalMax: 800 }),
    ]);

    expect(stacks[0]?.kcalMin).toBe(1200);
    expect(stacks[0]?.kcalMax).toBe(1600);
    expect(stacks[0]?.dataQuality).toBe('estimated');
  });

  it('nimmt den festen Wert, wo ein Eintrag keine Spanne hat', () => {
    const stacks = stackMealEntries([
      entry({ id: 'a', kcal: 100 }),
      entry({ id: 'b', dataQuality: 'estimated', kcal: 100, kcalMin: 80, kcalMax: 120 }),
    ]);

    expect(stacks).toHaveLength(1);
    expect(stacks[0]?.kcalMin).toBe(180);
    expect(stacks[0]?.kcalMax).toBe(220);
    expect(stacks[0]?.dataQuality).toBe('estimated');
  });

  it('lässt eine leere Liste leer', () => {
    expect(stackMealEntries([])).toEqual([]);
  });
});

describe('formatServings', () => {
  it('schreibt ganze Zahlen ohne Komma', () => {
    expect(formatServings(2)).toBe('2');
  });

  it('schreibt halbe Portionen mit Komma', () => {
    expect(formatServings(1.5)).toBe('1,5');
  });
});
