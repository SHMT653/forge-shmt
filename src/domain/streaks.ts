import { dateKeyAddDays, todayKey } from './dates';

/**
 * Counts consecutive days ending today (or yesterday, so a missed "today" doesn't
 * zero the streak before the day is over) for which `dateKeys` contains an entry.
 */
export function consecutiveDayStreak(dateKeys: Iterable<string>): number {
  const days = new Set(dateKeys);
  const today = todayKey();
  let cursor = days.has(today) ? today : dateKeyAddDays(today, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = dateKeyAddDays(cursor, -1);
  }
  return streak;
}

/**
 * Counts consecutive 7-day windows (ending with the current week) that each contain
 * at least `minPerWeek` qualifying days.
 */
export function weeklyStreak(dateKeys: Iterable<string>, minPerWeek: number): number {
  const days = [...new Set(dateKeys)].sort();
  if (days.length === 0) return 0;

  const today = todayKey();
  let streak = 0;
  let windowEnd = today;

  for (;;) {
    const windowStart = dateKeyAddDays(windowEnd, -6);
    const count = days.filter((d) => d >= windowStart && d <= windowEnd).length;
    if (count < minPerWeek) break;
    streak += 1;
    windowEnd = dateKeyAddDays(windowStart, -1);
  }

  return streak;
}
