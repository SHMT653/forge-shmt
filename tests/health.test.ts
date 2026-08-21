import { describe, expect, it } from 'vitest';
import { formatDistance, formatSleep, formatSyncedAgo, shouldReplace } from '@/domain/health';
import { buildDayMetrics, mergeHealth, metricsForDate } from '@/data/dailyMetrics';
import { ManualHealthProvider } from '@/services/health/provider';
import { canPerform, equipmentFromExerciseLabel } from '@/domain/equipment';
import { suggestMiniSession } from '@/domain/miniSessions';
import type { DailyHealth } from '@/domain/health';
import type { Habit, HabitLog } from '@/domain/types';

function health(patch: Partial<DailyHealth> & { date: string }): DailyHealth {
  return {
    steps: null,
    activeEnergyKcal: null,
    walkingDistanceM: null,
    sleepMinutes: null,
    sources: { steps: 'manual', energy: 'manual', distance: 'manual', sleep: 'manual' },
    syncedAt: null,
    ...patch,
  };
}

const habits: Habit[] = [
  { id: 'h-steps', key: 'steps', label: 'Schritte', unit: 'Schritte', target: 8000, orderIndex: 0, active: true },
  { id: 'h-water', key: 'water', label: 'Wasser', unit: 'ml', target: 2500, orderIndex: 1, active: true },
  { id: 'h-sleep', key: 'sleep', label: 'Schlaf', unit: 'h', target: 8, orderIndex: 2, active: true },
];

function log(habitId: string, logDate: string, value: number): HabitLog {
  return { habitId, logDate, value, completed: false };
}

describe('source precedence (§43)', () => {
  it('accepts anything when nothing is stored yet', () => {
    expect(shouldReplace('manual', null, 'apple_health')).toBe(true);
  });

  it('lets a manual correction override an automatic value', () => {
    expect(shouldReplace('apple_health', 7350, 'manual')).toBe(true);
  });

  it('refuses to let a sync undo a manual correction', () => {
    // This is the case that would otherwise make the number change on its own
    // after the user had just fixed it.
    expect(shouldReplace('manual', 9000, 'apple_health')).toBe(false);
  });

  it('lets a newer automatic value replace an older one', () => {
    expect(shouldReplace('apple_health', 7000, 'apple_health')).toBe(true);
  });
});

describe('mergeHealth — replace, never add (§11/§43)', () => {
  const habitMetrics = buildDayMetrics(habits, [
    log('h-steps', '2026-08-21', 5000),
    log('h-water', '2026-08-21', 1500),
  ]);

  it('replaces a habit-logged step count instead of summing it', () => {
    const merged = mergeHealth(habitMetrics, [
      health({ date: '2026-08-21', steps: 7350, sources: { steps: 'apple_health', energy: 'manual', distance: 'manual', sleep: 'manual' } }),
    ]);
    const day = metricsForDate(merged, '2026-08-21');
    // Not 12.350 — that is the bug this whole design exists to prevent.
    expect(day.steps).toBe(7350);
    expect(day.sources.steps).toBe('apple_health');
  });

  it('leaves water alone — it is never health-sourced', () => {
    const merged = mergeHealth(habitMetrics, [health({ date: '2026-08-21', steps: 7350 })]);
    expect(metricsForDate(merged, '2026-08-21').waterMl).toBe(1500);
  });

  it('keeps the habit value when health has nothing for that metric', () => {
    const merged = mergeHealth(habitMetrics, [health({ date: '2026-08-21', sleepMinutes: 480 })]);
    const day = metricsForDate(merged, '2026-08-21');
    expect(day.steps).toBe(5000);
    expect(day.sleepH).toBe(8);
  });

  it('adds days that exist only in health data', () => {
    const merged = mergeHealth(habitMetrics, [health({ date: '2026-08-22', steps: 9000 })]);
    expect(metricsForDate(merged, '2026-08-22').steps).toBe(9000);
  });

  it('returns zeroes for a day with no data at all', () => {
    const day = metricsForDate(mergeHealth(habitMetrics, []), '2026-01-01');
    expect(day.steps).toBe(0);
    expect(day.sources.steps).toBe('manual');
  });

  it('does not mutate the input map', () => {
    const before = metricsForDate(habitMetrics, '2026-08-21').steps;
    mergeHealth(habitMetrics, [health({ date: '2026-08-21', steps: 7350 })]);
    expect(metricsForDate(habitMetrics, '2026-08-21').steps).toBe(before);
  });
});

describe('ManualHealthProvider — the browser case (§5)', () => {
  const provider = new ManualHealthProvider();

  it('is available but supports nothing, so no UI has to check the platform', async () => {
    expect(await provider.isAvailable()).toBe(true);
    expect(provider.supportedMetrics()).toEqual([]);
  });

  it('returns null rather than throwing for every reading', async () => {
    expect(await provider.getSteps()).toBeNull();
    expect(await provider.getSleep()).toBeNull();
    expect(await provider.getWeight()).toBeNull();
    expect(await provider.getActiveEnergy()).toBeNull();
    expect(await provider.getWalkingRunningDistance()).toBeNull();
    expect(await provider.getWorkouts()).toEqual([]);
  });

  it('grants nothing when asked for permissions', async () => {
    expect(await provider.requestPermissions()).toEqual({ granted: [], denied: [] });
    expect(await provider.grantedMetrics()).toEqual([]);
  });
});

describe('health formatting (§17/§20)', () => {
  it('formats sleep as hours and minutes', () => {
    expect(formatSleep(514)).toBe('8 h 34 min');
    expect(formatSleep(480)).toBe('8 h');
    expect(formatSleep(null)).toBe('–');
    expect(formatSleep(0)).toBe('–');
  });

  it('formats distance in kilometres', () => {
    expect(formatDistance(5300)).toBe('5,3 km');
    expect(formatDistance(null)).toBe('–');
  });

  it('describes sync age in plain German', () => {
    const now = new Date('2026-08-21T12:00:00Z');
    expect(formatSyncedAgo('2026-08-21T11:56:00Z', now)).toBe('vor 4 Minuten');
    expect(formatSyncedAgo('2026-08-21T11:59:40Z', now)).toBe('gerade eben');
    expect(formatSyncedAgo('2026-08-21T09:00:00Z', now)).toBe('vor 3 Stunden');
    expect(formatSyncedAgo('2026-08-19T12:00:00Z', now)).toBe('vor 2 Tagen');
    expect(formatSyncedAgo(null, now)).toBeNull();
  });

  it('survives a malformed timestamp', () => {
    expect(formatSyncedAgo('not-a-date')).toBeNull();
  });
});

describe('equipment (§33)', () => {
  it('always allows bodyweight work', () => {
    expect(canPerform([], 'bodyweight')).toBe(true);
    expect(canPerform([], 'none')).toBe(true);
  });

  it('requires the equipment the user actually owns', () => {
    expect(canPerform(['bodyweight'], 'dumbbells')).toBe(false);
    expect(canPerform(['bodyweight', 'dumbbells'], 'dumbbells')).toBe(true);
  });

  it('treats a gym as implying the free weights inside it', () => {
    expect(canPerform(['gym'], 'barbell')).toBe(true);
    expect(canPerform(['gym'], 'dumbbells')).toBe(true);
  });

  it('maps the exercise database labels onto equipment ids', () => {
    expect(equipmentFromExerciseLabel('Widerstandsband')).toBe('bands');
    expect(equipmentFromExerciseLabel('Klimmzugstange')).toBe('pullup_bar');
    expect(equipmentFromExerciseLabel('Kurzhantel')).toBe('dumbbells');
    expect(equipmentFromExerciseLabel('Körpergewicht')).toBe('bodyweight');
  });
});

describe('suggestMiniSession (§19/§33)', () => {
  it('only proposes exercises the user can actually do', () => {
    const session = suggestMiniSession(['bodyweight']);
    expect(session.exercises.every((e) => !['Klimmzüge', 'Band Rows', 'Bizepscurls'].includes(e.name))).toBe(true);
  });

  it('uses the extra equipment when it is there', () => {
    const names = suggestMiniSession(['bodyweight', 'pullup_bar', 'bands']).exercises.map((e) => e.name);
    expect(names.length).toBeGreaterThan(0);
  });

  it('is never empty, even with no equipment configured', () => {
    expect(suggestMiniSession([]).exercises.length).toBeGreaterThan(0);
  });
});
