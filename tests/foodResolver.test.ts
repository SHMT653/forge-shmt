import { describe, expect, it } from 'vitest';
import { editDistance, normalizeFood, relevance, resolveFood, scaleCandidate, type FoodCandidate } from '@/domain/foodResolver';

function candidate(patch: Partial<FoodCandidate> & { name: string; source: FoodCandidate['source'] }): FoodCandidate {
  return {
    id: patch.id ?? patch.name,
    brand: '',
    macros: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
    portionLabel: '100 g',
    portionG: 100,
    dataQuality: 'estimated',
    ...patch,
  };
}

describe('normalizeFood', () => {
  it('folds umlauts so typing without them still matches', () => {
    expect(normalizeFood('Müsli')).toBe('muesli');
    expect(normalizeFood('Käsebrötchen')).toBe('kaesebroetchen');
  });

  it('drops punctuation and case', () => {
    expect(normalizeFood('ESN Isoclear, 30g!')).toBe('esn isoclear 30g');
  });
});

describe('editDistance', () => {
  it('is zero for identical words', () => {
    expect(editDistance('skyr', 'skyr')).toBe(0);
  });

  it('counts a single typo', () => {
    expect(editDistance('isoclar', 'isoclear')).toBe(1);
  });

  it('bails out early once the budget is blown', () => {
    expect(editDistance('apfel', 'schokolade', 2)).toBeGreaterThan(2);
  });

  it('rejects on a length difference without doing the work', () => {
    expect(editDistance('ei', 'eiweissbrot', 2)).toBeGreaterThan(2);
  });
});

describe('relevance', () => {
  it('scores an exact match highest', () => {
    expect(relevance('skyr', 'Skyr')).toBe(100);
  });

  it('ranks a prefix above a mere substring', () => {
    expect(relevance('skyr', 'Skyr Vanille')).toBeGreaterThan(relevance('skyr', 'Protein Skyr Drink'));
  });

  it('prefers the plain product over a padded one', () => {
    const plain = relevance('skyr', 'Skyr');
    const padded = relevance('skyr', 'Skyr Drink Vanille Multipack Family');
    expect(plain).toBeGreaterThan(padded);
  });

  it('tolerates a typo', () => {
    expect(relevance('isoclar', 'ESN Isoclear')).toBeGreaterThan(0);
  });

  it('matches multi-word queries in any order', () => {
    expect(relevance('skyr himbeeren', 'Skyr mit Himbeeren')).toBeGreaterThan(0);
  });

  it('returns zero for unrelated words', () => {
    expect(relevance('schokolade', 'Hähnchenbrust')).toBe(0);
  });

  it('does not match on an empty query', () => {
    expect(relevance('', 'Skyr')).toBe(0);
  });
});

describe('resolveFood — source trust', () => {
  it('puts the user’s own product above an equally-named foreign one', () => {
    const results = resolveFood('isoclear', [
      candidate({ name: 'ESN Isoclear', source: 'off', popularity: 900 }),
      candidate({ name: 'ESN Isoclear', source: 'library', id: 'mine', dataQuality: 'verified' }),
    ]);
    expect(results[0]?.source).toBe('library');
  });

  it('still lets a much better match win over a weak library hit', () => {
    const results = resolveFood('skyr', [
      candidate({ name: 'Protein Riegel Skyr Style Vanille Doppelpack', source: 'library' }),
      candidate({ name: 'Skyr', source: 'off', popularity: 800 }),
    ]);
    expect(results[0]?.name).toBe('Skyr');
  });

  it('ranks a popular OFF entry above an obscure one', () => {
    const results = resolveFood('skyr natur', [
      candidate({ name: 'Skyr Natur', source: 'off', id: 'a', popularity: 2000 }),
      candidate({ name: 'Skyr Natur', source: 'off', id: 'b', brand: 'Andere', popularity: 0 }),
    ]);
    expect(results[0]?.id).toBe('a');
  });

  it('drops candidates below the score floor', () => {
    const results = resolveFood('skyr', [candidate({ name: 'Rindersteak', source: 'off' })]);
    expect(results).toHaveLength(0);
  });

  it('removes duplicates of the same product', () => {
    const results = resolveFood('skyr', [
      candidate({ name: 'Skyr', source: 'off', id: 'a' }),
      candidate({ name: 'skyr', source: 'off', id: 'b' }),
    ]);
    expect(results).toHaveLength(1);
  });

  it('keeps the same name from different brands apart', () => {
    const results = resolveFood('skyr', [
      candidate({ name: 'Skyr', brand: 'Arla', source: 'off', id: 'a' }),
      candidate({ name: 'Skyr', brand: 'Lidl', source: 'off', id: 'b' }),
    ]);
    expect(results).toHaveLength(2);
  });

  it('honours the limit', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      candidate({ name: `Skyr Sorte ${i}`, source: 'off', id: String(i) }),
    );
    expect(resolveFood('skyr', many, { limit: 5 })).toHaveLength(5);
  });

  it('returns nothing for an empty candidate list', () => {
    expect(resolveFood('skyr', [])).toEqual([]);
  });
});

describe('scaleCandidate', () => {
  it('scales a portion without float noise', () => {
    const scaled = scaleCandidate(candidate({ name: 'Skyr', source: 'off' }), 1.5);
    expect(scaled.kcal).toBe(150);
    expect(scaled.proteinG).toBe(15);
  });

  it('handles a half portion', () => {
    expect(scaleCandidate(candidate({ name: 'Skyr', source: 'off' }), 0.5).kcal).toBe(50);
  });
});
