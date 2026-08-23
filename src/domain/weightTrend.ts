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

export function summarizeWeight(metrics: readonly BodyMetric[]): WeightSummary {
  const points = buildWeightSeries(metrics);
  const weighed = metrics.filter((m) => m.weightKg !== null).sort((a, b) => a.logDate.localeCompare(b.logDate));
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
export function isPhotoDue(lastPhotoDate: string | null, today: string, intervalDays: number): boolean {
  if (!lastPhotoDate) return true;
  const since = daysSinceLastWeighIn(lastPhotoDate, today);
  return since !== null && since >= intervalDays;
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
