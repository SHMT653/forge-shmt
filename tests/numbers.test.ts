import { describe, expect, it } from 'vitest';
import { parseDecimal, parseDecimalOr, parsePositive } from '@/domain/numbers';

describe('parseDecimal', () => {
  it('reads the comma a German keyboard produces', () => {
    // The bug this exists to prevent: Number('72,5') is NaN.
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal('0,5')).toBe(0.5);
  });

  it('still reads a full stop', () => {
    expect(parseDecimal('72.5')).toBe(72.5);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDecimal('  80 ')).toBe(80);
  });

  it('returns null rather than NaN for junk', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });

  it('passes numbers through', () => {
    expect(parseDecimal(42)).toBe(42);
    expect(parseDecimal(Number.NaN)).toBeNull();
    expect(parseDecimal(Infinity)).toBeNull();
  });

  it('handles negatives', () => {
    expect(parseDecimal('-2,5')).toBe(-2.5);
  });
});

describe('parseDecimalOr', () => {
  it('falls back only when there is nothing to read', () => {
    expect(parseDecimalOr('24,5', 0)).toBe(24.5);
    expect(parseDecimalOr('', 150)).toBe(150);
    expect(parseDecimalOr('abc', 150)).toBe(150);
  });

  it('keeps a legitimate zero', () => {
    expect(parseDecimalOr('0', 150)).toBe(0);
  });
});

describe('parsePositive', () => {
  it('rejects zero and negatives', () => {
    expect(parsePositive('0')).toBeNull();
    expect(parsePositive('-5')).toBeNull();
    expect(parsePositive('72,5')).toBe(72.5);
  });
});
