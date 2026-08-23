import { describe, expect, it } from 'vitest';
import { scoreDay, type DayContext } from '@/domain/dayEvaluation';
import { rateDay, type DayAggregate } from '@/domain/dayRating';
import { resolveTargets } from '@/domain/goalPhase';
import type { UserGoals } from '@/domain/types';

/**
 * The calendar square and the day view have to show the same number for the
 * same day. They used to run two different algorithms with different weights
 * and different treatment of untracked metrics, so a day scored 6.2 in one
 * place and 7.4 in the other.
 */

const goals = {
  calorieGoal: 2400, proteinGoal: 160, weightGoal: null, currentWeight: 80,
  heightCm: 180, birthYear: 1998, gender: 'male', activityLevel: 'moderate',
  goalType: 'maintain', programId: null, fastingProtocol: null, fastingStartHour: null,
  phaseType: null, phaseStartDate: null, phaseEndDate: null,
  caloriesMin: 2200, caloriesMax: 2600, proteinMin: 150, proteinMax: 200,
  stepsGoal: 10000, waterGoalMl: 3000, sleepGoalH: 8,
  weighInWeekday: 1, photoIntervalDays: 14,
  equipment: [], weeklyTrainingGoal: 3, onboardedAt: '2026-01-01',
} as unknown as UserGoals;

const targets = resolveTargets(goals);

type Day = { kcal: number; proteinG: number; steps: number; waterMl: number; sleepH: number; trained: boolean };

function asAggregate(day: Day): DayAggregate {
  return {
    date: '2026-08-20',
    kcal: day.kcal > 0 ? day.kcal : null,
    proteinG: day.proteinG > 0 ? day.proteinG : null,
    steps: day.steps > 0 ? day.steps : null,
    sleepH: day.sleepH > 0 ? day.sleepH : null,
    waterMl: day.waterMl > 0 ? day.waterMl : null,
    trained: day.trained,
    miniSession: false,
  };
}

function asContext(day: Day, hour: number): DayContext {
  return {
    today: '2026-08-20',
    hour,
    targets,
    nutrition: {
      kcal: day.kcal, proteinG: day.proteinG, carbsG: 0, fatG: 0,
      quality: 'verified', entryCount: day.kcal > 0 || day.proteinG > 0 ? 3 : 0,
    },
    metrics: { steps: day.steps, waterMl: day.waterMl, sleepH: day.sleepH },
    training: {
      trainedToday: day.trained, hasActiveSession: false,
      lastWorkoutDate: null, lastWorkoutName: null,
      fullWorkoutsThisWeek: day.trained ? 1 : 0, miniSessionsThisWeek: 0,
      plannedDayName: null, weeklyTarget: 3,
    },
    soreness: null,
    weight: { latest: 80, trend: null, weeklyChangeKg: null, direction: 'flat', readings: [] } as unknown as DayContext['weight'],
    weekly: { avgKcal: null, avgProtein: null, avgSteps: null, daysWithData: 0 },
  };
}

const cases: Record<string, Day> = {
  'a strong day':      { kcal: 2400, proteinG: 170, steps: 11000, waterMl: 3000, sleepH: 8,   trained: true },
  'a weak day':        { kcal: 3400, proteinG: 60,  steps: 2000,  waterMl: 500,  sleepH: 5,   trained: false },
  'a middling day':    { kcal: 2700, proteinG: 130, steps: 7000,  waterMl: 2000, sleepH: 7,   trained: false },
  'nothing tracked':   { kcal: 0,    proteinG: 0,   steps: 0,     waterMl: 0,    sleepH: 0,   trained: false },
  'only food tracked': { kcal: 2400, proteinG: 165, steps: 0,     waterMl: 0,    sleepH: 0,   trained: false },
  'only training':     { kcal: 0,    proteinG: 0,   steps: 0,     waterMl: 0,    sleepH: 0,   trained: true },
};

describe('the calendar and the day view agree', () => {
  for (const [label, day] of Object.entries(cases)) {
    it(`gives the same score for ${label}`, () => {
      const fromCalendar = rateDay(asAggregate(day), targets, { dayInProgress: false });
      const fromToday = scoreDay(asContext(day, 22)); // 22:00 — the day is over
      expect(fromToday.score).toBe(fromCalendar.score ?? 0);
    });
  }

  it('agrees while the day is still running too', () => {
    const day = cases['a middling day']!;
    const fromCalendar = rateDay(asAggregate(day), targets, { dayInProgress: true });
    const fromToday = scoreDay(asContext(day, 14));
    expect(fromToday.score).toBe(fromCalendar.score ?? 0);
  });

  it('does not punish a metric the user never tracks', () => {
    // §43: someone who does not log water must not lose points for it.
    const withWater = rateDay(asAggregate(cases['only food tracked']!), targets);
    const zeroWater = rateDay(
      { ...asAggregate(cases['only food tracked']!), waterMl: 0 },
      targets,
    );
    expect(withWater.score).toBe(zeroWater.score);
  });

  it('scores a day with nothing tracked as no data rather than as a failure', () => {
    const rating = rateDay(asAggregate(cases['nothing tracked']!), targets);
    expect(rating.hasData).toBe(false);
    expect(rating.score).toBeNull();
    expect(rating.tone).toBe('neutral');
  });
});
