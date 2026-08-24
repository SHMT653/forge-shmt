/**
 * Week boundaries.
 *
 * The week is the unit the training target is measured against, which is what
 * these are for. There was also a weekly review here that wrote a paragraph
 * about how the week went; the statistics screen replaced it with counted
 * numbers over a span the user chooses.
 */

import { dateKeyAddDays } from './dates';

export type WeekBounds = { start: string; end: string; label: string };

/** Monday-based week containing `dateKey`. */
export function weekBoundsFor(dateKey: string): WeekBounds {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  const dow = date.getDay(); // 0 = Sunday
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const start = dateKeyAddDays(dateKey, offsetToMonday);
  const end = dateKeyAddDays(start, 6);
  return { start, end, label: formatWeekLabel(start, end) };
}

function formatWeekLabel(start: string, end: string): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function eachDayOfWeek(bounds: WeekBounds): string[] {
  return Array.from({ length: 7 }, (_, i) => dateKeyAddDays(bounds.start, i));
}

