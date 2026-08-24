/**
 * Weight trend analysis.
 *
 * Daily scale weight swings by a kilo or more from water, salt, carbs and
 * digestion (§25). Reacting to a single reading is how people talk themselves
 * out of a working plan, so every judgement here is made on a smoothed trend
 * line, never on the raw number.
 */

import { dateKeyAddDays } from './dates';
import type { BodyMetric } from './types';

export type WeightPoint = {
  date: string;
  /** The measurement, if one exists on this day. */
  raw: number | null;
  /** Centred/trailing moving average — the line that actually matters. */
  trend: number | null;
};

export type WeightChange = {
  /** kg difference over the window; negative = lost weight. */
  deltaKg: number | null;
  /** Days actually covered by the comparison. */
  spanDays: number;
  /** Whether there was enough data to say anything at all. */
  reliable: boolean;
};

export type WeightSummary = {
  latest: number | null;
  latestDate: string | null;
  trendNow: number | null;
  change7d: WeightChange;
  change30d: WeightChange;
  changeTotal: WeightChange;
  points: WeightPoint[];
  /** kg per week, from the trend line. Negative = losing. */
  weeklyRateKg: number | null;
};

const EMPTY_CHANGE: WeightChange = { deltaKg: null, spanDays: 0, reliable: false };

/**
 * Builds a continuous daily series between the first and last measurement,
 * carrying a trailing average across gaps so a missed weigh-in does not punch
 * a hole in the chart.
 */
export function buildWeightSeries(metrics: readonly BodyMetric[], windowDays = 7): WeightPoint[] {
  const weighed = metrics
    .filter((m): m is BodyMetric & { weightKg: number } => m.weightKg !== null)
    .sort((a, b) => a.logDate.localeCompare(b.logDate));
  if (weighed.length === 0) return [];

  const byDate = new Map(weighed.map((m) => [m.logDate, m.weightKg]));
  const first = weighed[0];
  const last = weighed[weighed.length - 1];
  if (!first || !last) return [];

  const points: WeightPoint[] = [];
  let cursor = first.logDate;

  while (cursor <= last.logDate) {
    const raw = byDate.get(cursor) ?? null;

    // Trailing window average over whatever measurements fall inside it.
    const windowStart = dateKeyAddDays(cursor, -(windowDays - 1));
    const inWindow = weighed.filter((m) => m.logDate >= windowStart && m.logDate <= cursor);
    const trend =
      inWindow.length > 0
        ? Math.round((inWindow.reduce((sum, m) => sum + m.weightKg, 0) / inWindow.length) * 100) / 100
        : null;

    points.push({ date: cursor, raw, trend });
    cursor = dateKeyAddDays(cursor, 1);
  }

  return points;
}

function trendAt(points: readonly WeightPoint[], date: string): number | null {
  // Nearest point at or before `date`.
  let found: number | null = null;
  for (const p of points) {
    if (p.date <= date && p.trend !== null) found = p.trend;
    if (p.date > date) break;
  }
  return found;
}

function changeOver(points: readonly WeightPoint[], days: number): WeightChange {
  const last = points[points.length - 1];
  if (!last || last.trend === null) return EMPTY_CHANGE;

  const fromDate = dateKeyAddDays(last.date, -days);
  const earlier = trendAt(points, fromDate);
  if (earlier === null) return { deltaKg: null, spanDays: 0, reliable: false };

  const spanDays = points.filter((p) => p.date >= fromDate).length;
  return {
    deltaKg: Math.round((last.trend - earlier) * 100) / 100,
    spanDays,
    // A 7-day claim off two readings a week apart is noise, not a trend.
    reliable: points.filter((p) => p.date >= fromDate && p.raw !== null).length >= 3,
  };
}

export function summarizeWeight(metrics: readonly BodyMetric[], startDate: string | null = null): WeightSummary {
  const start = normalizeDateKey(startDate);
  const scopedMetrics = start ? metrics.filter((m) => m.logDate >= start) : metrics;
  const points = buildWeightSeries(scopedMetrics);
  const weighed = scopedMetrics.filter((m) => m.weightKg !== null).sort((a, b) => a.logDate.localeCompare(b.logDate));
  const newest = weighed[weighed.length - 1] ?? null;
  const oldest = weighed[0] ?? null;
  const last = points[points.length - 1] ?? null;
  const first = points[0] ?? null;

  const changeTotal: WeightChange =
    first?.trend !== null && first !== null && last?.trend != null
      ? {
          deltaKg: Math.round((last.trend - first.trend) * 100) / 100,
          spanDays: points.length,
          reliable: weighed.length >= 2,
        }
      : EMPTY_CHANGE;

  const change7d = changeOver(points, 7);
  const weeklyRateKg =
    change7d.deltaKg !== null && change7d.reliable
      ? change7d.deltaKg
      : changeOver(points, 14).deltaKg !== null
        ? Math.round(((changeOver(points, 14).deltaKg ?? 0) / 2) * 100) / 100
        : null;

  return {
    latest: newest?.weightKg ?? null,
    latestDate: newest?.logDate ?? null,
    trendNow: last?.trend ?? null,
    change7d,
    change30d: changeOver(points, 30),
    changeTotal,
    points,
    weeklyRateKg,
  };
}

export function formatKg(value: number | null, withSign = false): string {
  if (value === null) return '–';
  const formatted = Math.abs(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (!withSign) return `${formatted} kg`;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${formatted} kg`;
}

/** Days since the last weigh-in, or null when there has never been one. */
export function daysSinceLastWeighIn(latestDate: string | null, today: string): number | null {
  if (!latestDate) return null;
  let count = 0;
  let cursor = latestDate;
  while (cursor < today && count < 400) {
    cursor = dateKeyAddDays(cursor, 1);
    count += 1;
  }
  return count;
}

/** True when today is the configured weigh-in day and none has been recorded (§26). */
export function isWeighInDue(latestDate: string | null, today: string, weekday: number): boolean {
  if (latestDate === today) return false;
  const [y, m, d] = today.split('-').map(Number);
  const todayWeekday = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).getDay();
  if (todayWeekday !== weekday) {
    // Also nudge if it has simply been a long time.
    const since = daysSinceLastWeighIn(latestDate, today);
    return since !== null && since >= 10;
  }
  return true;
}

/** True when the photo interval has elapsed (§27). */
export function isPhotoDue(
  lastPhotoDate: string | null,
  today: string,
  intervalDays: number,
  startDate: string | null = null,
): boolean {
  if (lastPhotoDate === today) return false;
  const start = normalizeDateKey(startDate);
  if (start) {
    if (today < start) return false;
    return isScheduledProgressPhotoDate(today, start, intervalDays);
  }
  if (!lastPhotoDate) return true;
  const since = daysSinceLastWeighIn(lastPhotoDate, today);
  return since !== null && since >= intervalDays;
}

export type ProgressPhotoDateStatus = {
  allowed: boolean;
  previousDate: string | null;
  nextDate: string | null;
  reason: string | null;
};

function photoInterval(intervalDays: number): number {
  return Math.max(1, Math.round(intervalDays));
}

function normalizeDateKey(value: string | null | undefined): string | null {
  const day = value?.slice(0, 10) ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function dateKeyUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function daysBetweenKeys(from: string, to: string): number {
  return Math.round((dateKeyUtcMs(to) - dateKeyUtcMs(from)) / 86_400_000);
}

export function isScheduledProgressPhotoDate(date: string, startDate: string | null, intervalDays: number): boolean {
  const day = normalizeDateKey(date);
  const start = normalizeDateKey(startDate);
  if (!day || !start || day < start) return false;
  return daysBetweenKeys(start, day) % photoInterval(intervalDays) === 0;
}

export function nextProgressPhotoDate(startDate: string | null, today: string, intervalDays: number): string | null {
  const start = normalizeDateKey(startDate);
  if (!start) return null;
  if (today <= start) return start;
  const interval = photoInterval(intervalDays);
  const elapsed = Math.max(0, daysBetweenKeys(start, today));
  return dateKeyAddDays(start, Math.ceil(elapsed / interval) * interval);
}

function uniquePhotoDates(photoDates: readonly string[]): string[] {
  return [...new Set(photoDates.map((date) => date.slice(0, 10)).filter(Boolean))].sort();
}

/**
 * Whether a progress photo can be attached to `date`.
 *
 * A photo day is a measurement checkpoint, not a random gallery. The first
 * photo sets the baseline. After that, a new photo day is only valid once the
 * configured interval has elapsed, and it must not sit too close to the next
 * already recorded photo day.
 */
export function progressPhotoDateStatus(
  date: string,
  photoDates: readonly string[],
  intervalDays: number,
  today: string,
  startDate: string | null = null,
): ProgressPhotoDateStatus {
  const day = date.slice(0, 10);
  const interval = photoInterval(intervalDays);
  const dates = uniquePhotoDates(photoDates).filter((entry) => entry <= today);
  const start = normalizeDateKey(startDate);

  if (day > today) {
    return {
      allowed: false,
      previousDate: dates.filter((entry) => entry < day).at(-1) ?? null,
      nextDate: null,
      reason: 'Fortschrittsbilder können nicht in die Zukunft eingetragen werden.',
    };
  }

  if (start) {
    const previousRecorded = dates.filter((entry) => entry < day).at(-1) ?? null;
    if (day < start) {
      return {
        allowed: false,
        previousDate: null,
        nextDate: start,
        reason: `Erstes Fortschrittsbild am Starttag ${start}.`,
      };
    }

    if (dates.includes(day)) {
      return { allowed: true, previousDate: day, nextDate: day, reason: null };
    }

    const elapsed = daysBetweenKeys(start, day);
    const passedIntervals = Math.floor(elapsed / interval);
    const previousScheduled = passedIntervals > 0 ? dateKeyAddDays(start, passedIntervals * interval) : null;

    if (elapsed % interval !== 0) {
      const nextScheduled = dateKeyAddDays(start, (passedIntervals + 1) * interval);
      return {
        allowed: false,
        previousDate: previousRecorded ?? previousScheduled,
        nextDate: nextScheduled,
        reason: `Nächster Foto-Tag: ${nextScheduled}.`,
      };
    }

    return {
      allowed: true,
      previousDate: previousRecorded ?? previousScheduled,
      nextDate: dateKeyAddDays(day, interval),
      reason: null,
    };
  }

  if (dates.includes(day)) {
    return { allowed: true, previousDate: day, nextDate: day, reason: null };
  }

  const previousDate = dates.filter((entry) => entry < day).at(-1) ?? null;
  const nextDate = dates.find((entry) => entry > day) ?? null;

  // With no baseline yet, the first photo may define the rhythm.
  if (!previousDate) {
    if (nextDate && dateKeyAddDays(day, interval) > nextDate) {
      return {
        allowed: false,
        previousDate: null,
        nextDate,
        reason: `Dieser Tag liegt zu nah am nächsten Foto (${nextDate}).`,
      };
    }
    return { allowed: true, previousDate: null, nextDate, reason: null };
  }

  const dueDate = dateKeyAddDays(previousDate, interval);
  if (day < dueDate) {
    return {
      allowed: false,
      previousDate,
      nextDate: dueDate,
      reason: `Nächstes Fortschrittsbild ab ${dueDate}.`,
    };
  }

  if (nextDate && dateKeyAddDays(day, interval) > nextDate) {
    return {
      allowed: false,
      previousDate,
      nextDate,
      reason: `Dieser Tag liegt zu nah am nächsten Foto (${nextDate}).`,
    };
  }

  return { allowed: true, previousDate, nextDate, reason: null };
}

/**
 * The weight recorded on `date`, or the most recent one before it.
 *
 * A progress photo carries the weight it was taken at, so a photo added
 * afterwards must not be stamped with today's weight — that would make the
 * before/after comparison lie about exactly the number it exists to show.
 * Returns null when nothing was recorded on or before that day.
 */
export function weightOnOrBefore(metrics: readonly BodyMetric[], date: string): number | null {
  let best: { date: string; kg: number } | null = null;
  for (const metric of metrics) {
    if (metric.weightKg === null || metric.logDate > date) continue;
    if (!best || metric.logDate > best.date) best = { date: metric.logDate, kg: metric.weightKg };
  }
  return best?.kg ?? null;
}
