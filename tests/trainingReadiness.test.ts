import { describe, expect, it } from 'vitest';
import { assessReadiness, sorenessStreak, type ReadinessInput } from '@/domain/trainingReadiness';

const BASE: ReadinessInput = {
  today: '2026-08-19',        // Wednesday
  weekEnd: '2026-08-23',      // Sunday
  fullWorkoutsThisWeek: 1,
  miniSessionsThisWeek: 0,
  weeklyTarget: 3,
  lastWorkoutDate: '2026-08-17',
  trainedToday: false,
  hasActiveSession: false,
  sorenessHistory: [],
  plannedDayName: 'Oberkörper',
};

const input = (patch: Partial<ReadinessInput>): ReadinessInput => ({ ...BASE, ...patch });

describe('the week decides how much slack there is', () => {
  it('counts rest days as days left minus sessions left', () => {
    // Wed–Sun is 5 days, 2 sessions still to do → 3 rest days affordable.
    const r = assessReadiness(input({}));
    expect(r.slack).toBe(3);
    expect(r.state).toBe('due');
    expect(r.offerStart).toBe(true);
  });

  it('calls it mandatory once every remaining day has to carry a session', () => {
    const r = assessReadiness(input({ today: '2026-08-21', fullWorkoutsThisWeek: 0, weeklyTarget: 3 }));
    // Fri–Sun is 3 days for 3 sessions: no rest day left.
    expect(r.slack).toBe(0);
    expect(r.state).toBe('mandatory');
    expect(r.detail).toMatch(/kein Ruhetag mehr drin/);
  });

  it('still pushes when the target is already out of reach', () => {
    const r = assessReadiness(input({ today: '2026-08-23', fullWorkoutsThisWeek: 0, weeklyTarget: 3 }));
    expect(r.slack).toBeLessThan(0);
    expect(r.state).toBe('mandatory');
    // Says so plainly instead of pretending the target is still reachable.
    expect(r.detail).toMatch(/nicht mehr voll/);
    expect(r.detail).toMatch(/nächste Woche/);
  });

  it('stops nagging once the target is met', () => {
    const r = assessReadiness(input({ fullWorkoutsThisWeek: 3 }));
    expect(r.state).toBe('optional');
    expect(r.detail).toMatch(/Bonus/);
  });
});

describe('the body gets a say', () => {
  it('makes strong soreness a rest day, whatever the week wants', () => {
    const r = assessReadiness(input({ sorenessHistory: [{ date: '2026-08-19', soreness: 'strong' }] }));
    expect(r.state).toBe('rest');
    expect(r.offerStart).toBe(false);
  });

  it('keeps recommending a short session on strong soreness when the week is tight', () => {
    const r = assessReadiness(input({
      today: '2026-08-21', fullWorkoutsThisWeek: 0,
      sorenessHistory: [{ date: '2026-08-21', soreness: 'strong' }],
    }));
    expect(r.state).toBe('rest');
    expect(r.preferMini).toBe(true);
  });

  it('does not treat one light day as recovered after a long sore streak', () => {
    // The user's case: three days of real soreness, then a light one.
    const r = assessReadiness(input({
      sorenessHistory: [
        { date: '2026-08-16', soreness: 'strong' },
        { date: '2026-08-17', soreness: 'strong' },
        { date: '2026-08-18', soreness: 'medium' },
        { date: '2026-08-19', soreness: 'light' },
      ],
    }));
    expect(r.state).toBe('rest');
    expect(r.preferMini).toBe(true);
    expect(r.detail).toMatch(/3 Tage in Folge/);
  });

  it('lets a tight week overrule a sore streak', () => {
    const r = assessReadiness(input({
      today: '2026-08-21', fullWorkoutsThisWeek: 0,
      sorenessHistory: [
        { date: '2026-08-18', soreness: 'medium' },
        { date: '2026-08-19', soreness: 'medium' },
        { date: '2026-08-20', soreness: 'medium' },
      ],
    }));
    expect(r.state).toBe('mandatory');
  });

  it('shortens the session on medium soreness without cancelling it', () => {
    const r = assessReadiness(input({ sorenessHistory: [{ date: '2026-08-19', soreness: 'medium' }] }));
    expect(r.state).toBe('due');
    expect(r.preferMini).toBe(true);
    expect(r.offerStart).toBe(true);
  });

  it('rests after yesterday’s workout when today has muscle soreness', () => {
    const r = assessReadiness(input({
      lastWorkoutDate: '2026-08-18',
      sorenessHistory: [{ date: '2026-08-19', soreness: 'medium' }],
    }));
    expect(r.state).toBe('rest');
    expect(r.offerStart).toBe(false);
    expect(r.detail).toMatch(/Gestern trainiert/);
    expect(r.recoveryScore).toBeLessThan(50);
    expect(r.recoveryLabel).toBe('Recovery');
  });

  it('keeps recovery across the Sunday-to-Monday week boundary', () => {
    const r = assessReadiness(input({
      today: '2026-08-24',
      weekEnd: '2026-08-30',
      fullWorkoutsThisWeek: 0,
      lastWorkoutDate: '2026-08-23',
      sorenessHistory: [{ date: '2026-08-24', soreness: 'medium' }],
    }));
    expect(r.state).toBe('rest');
    expect(r.offerStart).toBe(false);
    expect(r.daysSinceLast).toBe(1);
  });

  it('only offers a mini session after yesterday’s workout when soreness is light', () => {
    const r = assessReadiness(input({
      lastWorkoutDate: '2026-08-18',
      sorenessHistory: [{ date: '2026-08-19', soreness: 'light' }],
    }));
    expect(r.state).toBe('rest');
    expect(r.preferMini).toBe(true);
    expect(r.offerStart).toBe(true);
  });

  it('surfaces a high recovery score after multiple quiet days', () => {
    const r = assessReadiness(input({
      lastWorkoutDate: '2026-08-15',
      sorenessHistory: [{ date: '2026-08-19', soreness: null }],
    }));
    expect(r.recoveryScore).toBeGreaterThanOrEqual(90);
    expect(r.recoveryLabel).toBe('Bereit');
    expect(r.recoveryFactors.join(' ')).toMatch(/Tage Abstand/);
  });
});

describe('nothing is suggested when there is nothing to suggest', () => {
  it('points at the open session instead', () => {
    const r = assessReadiness(input({ hasActiveSession: true }));
    expect(r.state).toBe('running');
    expect(r.offerStart).toBe(false);
  });

  it('says it is done when it is done', () => {
    const r = assessReadiness(input({ trainedToday: true, fullWorkoutsThisWeek: 2 }));
    expect(r.state).toBe('done-today');
    expect(r.offerStart).toBe(false);
  });
});

describe('sorenessStreak', () => {
  const day = (date: string, soreness: 'none' | 'light' | 'medium' | 'strong' | null) => ({ date, soreness });

  it('counts back from yesterday, not from today', () => {
    // Today being sore says nothing about how long the load has been high.
    expect(sorenessStreak([day('2026-08-19', 'strong')], '2026-08-19')).toBe(0);
  });

  it('counts an unbroken run of medium or worse', () => {
    expect(sorenessStreak([
      day('2026-08-18', 'medium'), day('2026-08-17', 'strong'), day('2026-08-16', 'medium'),
    ], '2026-08-19')).toBe(3);
  });

  it('a light day ends the streak', () => {
    expect(sorenessStreak([
      day('2026-08-18', 'medium'), day('2026-08-17', 'light'), day('2026-08-16', 'strong'),
    ], '2026-08-19')).toBe(1);
  });

  it('a day with no answer ends the streak rather than continuing it', () => {
    // An absent answer is not evidence of soreness.
    expect(sorenessStreak([
      day('2026-08-18', 'strong'), day('2026-08-16', 'strong'),
    ], '2026-08-19')).toBe(1);
  });
});
