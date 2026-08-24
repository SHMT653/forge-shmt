import { describe, expect, it } from 'vitest';
import { dateKeyAddDays, formatRelativeDay, toDateKey, todayKey } from '@/domain/dates';
import { eachDayOfWeek, weekBoundsFor } from '@/domain/weeks';

describe('local date handling (§52)', () => {
  it('keys a date by its LOCAL day, not UTC', () => {
    // 23:30 local on the 5th must key as the 5th even where UTC has rolled over.
    const late = new Date(2026, 0, 5, 23, 30, 0);
    expect(toDateKey(late)).toBe('2026-01-05');
  });

  it('keys just after midnight as the new day', () => {
    expect(toDateKey(new Date(2026, 0, 6, 0, 5, 0))).toBe('2026-01-06');
  });

  it('crosses month boundaries', () => {
    expect(dateKeyAddDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(dateKeyAddDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('crosses year boundaries', () => {
    expect(dateKeyAddDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('handles a leap day', () => {
    expect(dateKeyAddDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('survives a DST transition without losing a day', () => {
    // Europe/Berlin springs forward on 2026-03-29.
    expect(dateKeyAddDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(dateKeyAddDays('2026-03-29', 1)).toBe('2026-03-30');
    // And falls back on 2026-10-25.
    expect(dateKeyAddDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(dateKeyAddDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('round-trips a week', () => {
    expect(dateKeyAddDays(dateKeyAddDays('2026-06-15', 7), -7)).toBe('2026-06-15');
  });

  it('labels today and yesterday relatively', () => {
    expect(formatRelativeDay(todayKey())).toBe('Heute');
    expect(formatRelativeDay(dateKeyAddDays(todayKey(), -1))).toBe('Gestern');
  });
});

describe('week bounds (§30)', () => {
  it('starts weeks on Monday', () => {
    // 2026-01-07 is a Wednesday.
    expect(weekBoundsFor('2026-01-07').start).toBe('2026-01-05');
    expect(weekBoundsFor('2026-01-07').end).toBe('2026-01-11');
  });

  it('treats Sunday as the end of the week, not the start', () => {
    // 2026-01-04 is a Sunday.
    expect(weekBoundsFor('2026-01-04').start).toBe('2025-12-29');
    expect(weekBoundsFor('2026-01-04').end).toBe('2026-01-04');
  });

  it('enumerates exactly seven days', () => {
    const days = eachDayOfWeek(weekBoundsFor('2026-01-07'));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-01-05');
    expect(days[6]).toBe('2026-01-11');
  });
});
