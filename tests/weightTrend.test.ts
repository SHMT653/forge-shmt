import { describe, expect, it } from 'vitest';
import {
  buildWeightSeries,
  daysSinceLastWeighIn,
  formatKg,
  isPhotoDue,
  isWeighInDue,
  progressPhotoDateStatus,
  summarizeWeight,
  weightOnOrBefore,
} from '@/domain/weightTrend';
import type { BodyMetric } from '@/domain/types';

function metric(logDate: string, weightKg: number | null): BodyMetric {
  return { id: logDate, logDate, weightKg, waistCm: null, chestCm: null, armsCm: null, bia: null, source: 'manual' };
}

describe('buildWeightSeries (§25)', () => {
  it('produces a continuous daily series across gaps', () => {
    const points = buildWeightSeries([metric('2026-01-01', 74), metric('2026-01-05', 73.5)]);
    expect(points).toHaveLength(5);
    expect(points[0]?.raw).toBe(74);
    expect(points[1]?.raw).toBeNull();
    // The trend carries across the gap so the chart has no hole.
    expect(points[1]?.trend).not.toBeNull();
  });

  it('smooths daily noise into a trend', () => {
    const points = buildWeightSeries([
      metric('2026-01-01', 73.0),
      metric('2026-01-02', 74.2), // a salty dinner
      metric('2026-01-03', 73.1),
    ]);
    const last = points[points.length - 1];
    expect(last?.raw).toBe(73.1);
    // The trend sits between the extremes rather than chasing the spike.
    expect(last?.trend).toBeGreaterThan(73.0);
    expect(last?.trend).toBeLessThan(74.2);
  });

  it('returns nothing when no weight was ever recorded', () => {
    expect(buildWeightSeries([metric('2026-01-01', null)])).toEqual([]);
  });
});

describe('summarizeWeight', () => {
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    // Losing roughly 0.4 kg a week, with noise.
    return metric(`2026-01-${day}`, 75 - i * 0.06 + (i % 3 === 0 ? 0.3 : 0));
  });

  it('reports the latest raw measurement, not the trend, as "current"', () => {
    const summary = summarizeWeight(daily);
    expect(summary.latest).toBe(daily[daily.length - 1]?.weightKg);
    expect(summary.latestDate).toBe('2026-01-30');
  });

  it('computes a downward 7-day change', () => {
    const summary = summarizeWeight(daily);
    expect(summary.change7d.deltaKg).toBeLessThan(0);
    expect(summary.change7d.reliable).toBe(true);
  });

  it('marks a change as unreliable when there is barely any data', () => {
    const summary = summarizeWeight([metric('2026-01-01', 74), metric('2026-01-08', 73)]);
    expect(summary.change7d.reliable).toBe(false);
  });

  it('handles an empty history without throwing', () => {
    const summary = summarizeWeight([]);
    expect(summary.latest).toBeNull();
    expect(summary.trendNow).toBeNull();
    expect(summary.change7d.deltaKg).toBeNull();
  });

  it('handles a single measurement', () => {
    const summary = summarizeWeight([metric('2026-01-01', 74)]);
    expect(summary.latest).toBe(74);
    expect(summary.changeTotal.deltaKg).toBe(0);
  });
});

describe('formatKg', () => {
  it('formats with an explicit sign when asked', () => {
    expect(formatKg(-0.4, true)).toBe('−0,4 kg');
    expect(formatKg(0.4, true)).toBe('+0,4 kg');
    expect(formatKg(null)).toBe('–');
  });
});

describe('reminders (§26/§27)', () => {
  it('counts days since the last weigh-in', () => {
    expect(daysSinceLastWeighIn('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysSinceLastWeighIn(null, '2026-01-08')).toBeNull();
  });

  it('is due on the configured weekday', () => {
    // 2026-01-04 is a Sunday.
    expect(isWeighInDue('2026-01-01', '2026-01-04', 0)).toBe(true);
  });

  it('is not due when already weighed today', () => {
    expect(isWeighInDue('2026-01-04', '2026-01-04', 0)).toBe(false);
  });

  it('nudges anyway after a long silence', () => {
    expect(isWeighInDue('2026-01-01', '2026-01-20', 0)).toBe(true);
  });

  it('is quiet mid-week after a recent weigh-in', () => {
    expect(isWeighInDue('2026-01-04', '2026-01-06', 0)).toBe(false);
  });

  it('asks for photos on the first run and after the interval', () => {
    expect(isPhotoDue(null, '2026-01-01', 14)).toBe(true);
    expect(isPhotoDue('2026-01-01', '2026-01-15', 14)).toBe(true);
    expect(isPhotoDue('2026-01-01', '2026-01-10', 14)).toBe(false);
  });

  it('allows the first progress photo to set the baseline', () => {
    expect(progressPhotoDateStatus('2026-01-05', [], 14, '2026-01-10').allowed).toBe(true);
  });

  it('blocks progress photos before the interval has elapsed', () => {
    const status = progressPhotoDateStatus('2026-01-10', ['2026-01-01'], 14, '2026-01-20');
    expect(status.allowed).toBe(false);
    expect(status.nextDate).toBe('2026-01-15');
  });

  it('allows progress photos once the interval has elapsed', () => {
    expect(progressPhotoDateStatus('2026-01-15', ['2026-01-01'], 14, '2026-01-20').allowed).toBe(true);
  });

  it('keeps existing photo days open for the other poses', () => {
    expect(progressPhotoDateStatus('2026-01-15', ['2026-01-01', '2026-01-15'], 14, '2026-01-20').allowed).toBe(true);
  });

  it('blocks future progress photos', () => {
    expect(progressPhotoDateStatus('2026-01-21', ['2026-01-01'], 14, '2026-01-20').allowed).toBe(false);
  });

  it('does not allow a backfilled photo too close to the next recorded photo day', () => {
    const status = progressPhotoDateStatus('2026-01-15', ['2026-01-01', '2026-01-20'], 14, '2026-01-25');
    expect(status.allowed).toBe(false);
    expect(status.nextDate).toBe('2026-01-20');
  });
});

describe('weightOnOrBefore', () => {
  const metric = (logDate: string, weightKg: number | null) => ({
    id: logDate, logDate, weightKg, waistCm: null, chestCm: null, armsCm: null,
    bia: null, source: 'manual' as const,
  });

  it('stamps a back-dated photo with the weight of its own day', () => {
    const metrics = [metric('2026-08-01', 82), metric('2026-08-10', 80), metric('2026-08-20', 78)];
    expect(weightOnOrBefore(metrics, '2026-08-10')).toBe(80);
  });

  it('falls back to the most recent earlier reading', () => {
    const metrics = [metric('2026-08-01', 82), metric('2026-08-20', 78)];
    expect(weightOnOrBefore(metrics, '2026-08-10')).toBe(82);
  });

  it('never reaches forward in time', () => {
    // Otherwise a photo from June would be labelled with August's weight.
    expect(weightOnOrBefore([metric('2026-08-20', 78)], '2026-06-01')).toBeNull();
  });

  it('ignores rows without a weight', () => {
    const metrics = [metric('2026-08-01', 82), metric('2026-08-15', null)];
    expect(weightOnOrBefore(metrics, '2026-08-20')).toBe(82);
  });
});
