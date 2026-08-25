import { describe, expect, it } from 'vitest';
import { resolveTargets } from '@/domain/goalPhase';
import { buildDayStatus, scoreDay, type DayContext } from '@/domain/dayEvaluation';
import { assessReadiness } from '@/domain/trainingReadiness';
import { buildNextMove } from '@/domain/nextMove';
import type { UserGoals } from '@/domain/types';

const goals = {
  calorieGoal: 2400, proteinGoal: 160, weightGoal: 78, currentWeight: 80,
  heightCm: 180, birthYear: 1998, gender: 'male', activityLevel: 'moderate',
  goalType: 'maintain', programId: null, fastingProtocol: null, fastingStartHour: null,
  phaseType: null, phaseStartDate: null, phaseEndDate: null,
  caloriesMin: 2200, caloriesMax: 2600, proteinMin: 150, proteinMax: 200,
  stepsGoal: 10000, waterGoalMl: 3000, sleepGoalH: 8,
  weighInWeekday: 1, photoIntervalDays: 14, progressStartDate: null,
  fastingEnabled: false, units: 'metric',
  equipment: ['bodyweight'], trainingFocus: [], weeklyTrainingGoal: 3,
  onboardedAt: '2026-01-01', healthEnabled: false,
} as unknown as UserGoals;

const targets = resolveTargets(goals);

function ctx(patch: Partial<DayContext> = {}): DayContext {
  return {
    today: '2026-08-19',
    hour: 14,
    targets,
    nutrition: { kcal: 1400, proteinG: 90, carbsG: 120, fatG: 40, quality: 'verified', entryCount: 3 },
    metrics: { steps: 6000, waterMl: 1500, sleepH: 7 },
    training: {
      trainedToday: false, hasActiveSession: false, lastWorkoutDate: '2026-08-17',
      lastWorkoutName: 'Oberkörper', fullWorkoutsThisWeek: 1, miniSessionsThisWeek: 0,
      plannedDayName: 'Unterkörper', weeklyTarget: 3,
    },
    soreness: null,
    weight: { latest: 80, trendNow: 80, weeklyChangeKg: -0.2, direction: 'down', points: [] } as DayContext['weight'],
    weekly: { avgKcal: 2300, avgProtein: 150, avgSteps: 8000, daysWithData: 5 },
    ...patch,
  };
}

function moveFor(day: DayContext, overrides: { weighInDue?: boolean; photoDue?: boolean; activeSessionId?: string | null } = {}) {
  const readiness = assessReadiness({
    today: day.today,
    weekEnd: '2026-08-23',
    fullWorkoutsThisWeek: day.training.fullWorkoutsThisWeek,
    miniSessionsThisWeek: day.training.miniSessionsThisWeek,
    weeklyTarget: day.training.weeklyTarget,
    lastWorkoutDate: day.training.lastWorkoutDate,
    trainedToday: day.training.trainedToday,
    hasActiveSession: day.training.hasActiveSession,
    sorenessHistory: day.soreness ? [{ date: day.today, soreness: day.soreness }] : [],
    plannedDayName: day.training.plannedDayName,
  });

  return buildNextMove({
    ctx: day,
    readiness,
    dayScore: scoreDay(day),
    dayStatus: buildDayStatus(day),
    weighInDue: overrides.weighInDue ?? false,
    photoDue: overrides.photoDue ?? false,
    activeSessionId: overrides.activeSessionId ?? null,
  });
}

describe('buildNextMove', () => {
  it('priorisiert laufende Trainings', () => {
    const move = moveFor(ctx({ training: { ...ctx().training, hasActiveSession: true } }), { activeSessionId: 's1' });
    expect(move.primary.kind).toBe('resume-workout');
    expect(move.title).toContain('offen');
  });

  it('setzt bei starkem Muskelkater auf Recovery', () => {
    const move = moveFor(ctx({ soreness: 'strong' }));
    expect(move.tone).toBe('gold');
    expect(move.title).toContain('Recovery');
  });

  it('macht Protein zur nächsten Handlung, wenn Training nicht drängt', () => {
    const day = ctx({
      training: { ...ctx().training, fullWorkoutsThisWeek: 3 },
      nutrition: { kcal: 1100, proteinG: 60, carbsG: 100, fatG: 30, quality: 'verified', entryCount: 2 },
    });
    const move = moveFor(day);
    expect(move.primary.kind).toBe('entry');
    expect(move.title).toContain('Protein');
  });
});
