// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { resolveTargets } from '@/domain/goalPhase';
import { assessReadiness, type Readiness } from '@/domain/trainingReadiness';
import { buildDayStatus, scoreDay, type DayContext } from '@/domain/dayEvaluation';
import type { UserGoals } from '@/domain/types';

/**
 * The dashboard is the screen that opens every time and the one that survived
 * the most surgery: recipes, batches, the coach headline and the insight list
 * all left its data, and the readiness card arrived. None of that is visible to
 * the type checker once the shape compiles — only rendering it is.
 */

const goals = {
  calorieGoal: 2400, proteinGoal: 160, weightGoal: 78, currentWeight: 80,
  heightCm: 180, birthYear: 1998, gender: 'male', activityLevel: 'moderate',
  goalType: 'maintain', programId: null, fastingProtocol: null, fastingStartHour: null,
  phaseType: null, phaseStartDate: null, phaseEndDate: null,
  caloriesMin: 2200, caloriesMax: 2600, proteinMin: 150, proteinMax: 200,
  stepsGoal: 10000, waterGoalMl: 3000, sleepGoalH: 8,
  weighInWeekday: 1, photoIntervalDays: 14,
  equipment: ['bodyweight'], trainingFocus: [], weeklyTrainingGoal: 3,
  onboardedAt: '2026-01-01', units: 'metric',
} as unknown as UserGoals;

const targets = resolveTargets(goals);

const dayContext: DayContext = {
  today: '2026-08-19', hour: 14, targets,
  nutrition: { kcal: 1400, proteinG: 90, carbsG: 120, fatG: 40, quality: 'verified', entryCount: 3 },
  metrics: { steps: 6000, waterMl: 1500, sleepH: 7 },
  training: {
    trainedToday: false, hasActiveSession: false, lastWorkoutDate: '2026-08-17',
    lastWorkoutName: 'Oberkörper', fullWorkoutsThisWeek: 1, miniSessionsThisWeek: 0,
    plannedDayName: 'Unterkörper', weeklyTarget: 3,
  },
  soreness: null,
  weight: { latest: 80, trendNow: 80, weeklyChangeKg: -0.2, direction: 'down', points: [] } as unknown as DayContext['weight'],
  weekly: { avgKcal: 2300, avgProtein: 150, avgSteps: 8000, daysWithData: 5 },
};

const readiness: Readiness = assessReadiness({
  today: '2026-08-19', weekEnd: '2026-08-23',
  fullWorkoutsThisWeek: 1, miniSessionsThisWeek: 0, weeklyTarget: 3,
  lastWorkoutDate: '2026-08-17', trainedToday: false, hasActiveSession: false,
  sorenessHistory: [], plannedDayName: 'Unterkörper',
});

const data = {
  goals, targets, activePhase: null,
  activePlan: null, suggestedDay: { id: 'd1', name: 'Unterkörper', exercises: [] }, activeSession: null,
  recentTrainingDates: new Set<string>(), fullWorkoutsThisWeek: 1, miniSessionsThisWeek: 0,
  habits: [], todayLogs: new Map(),
  metrics: { steps: 6000, waterMl: 1500, sleepH: 7, activeEnergyKcal: null, walkingDistanceM: null,
             sources: { steps: 'manual', energy: 'manual', distance: 'manual', sleep: 'manual' } },
  checkin: null, recentCheckins: [], readiness,
  entries: [], totals: { kcal: 1400, proteinG: 90, carbsG: 120, fatG: 40 },
  caloriesBurned: { steps: 200, workout: 0, cardio: 0, total: 200 },
  favoriteFoods: [], allFoods: [], recentMeals: [],
  weight: dayContext.weight,
  weekly: { avgKcal: 2300, avgProtein: 150, avgSteps: 8000, avgSleep: 7, daysWithData: 5 },
  dailyStreak: 4, trainingStreak: 2,
  dayContext, dayStatus: buildDayStatus(dayContext), dayScore: scoreDay(dayContext),
  weighInDue: false, photoDue: false,
};

const context = {
  data, loading: false, error: null,
  addEntry: vi.fn(), removeEntry: vi.fn(), addWater: vi.fn(), setMetric: vi.fn(),
  setSoreness: vi.fn(), saveFood: vi.fn(), startSuggestedWorkout: vi.fn(), reload: vi.fn(),
};

vi.mock('@/web/hooks/TodayDataProvider', () => ({
  useTodayContext: () => context,
  useTodayContextOptional: () => context,
}));
vi.mock('@/web/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/data/progress', () => ({ saveBodyMetric: vi.fn() }));
vi.mock('@/data/workouts', () => ({ startMiniSession: vi.fn() }));

import { DashboardView } from '@/web/views/DashboardView';

afterEach(cleanup);

describe('DashboardView', () => {
  it('renders without the data that was removed from under it', () => {
    render(<DashboardView />);
    expect(screen.getByText('Heute')).toBeTruthy();
  });

  it('shows the day rings', () => {
    render(<DashboardView />);
    // The regression the user reported: the rings replaced by the old bars.
    expect(document.querySelectorAll('circle').length).toBeGreaterThan(2);
  });

  it('offers training with the reasoning, not a bare nudge', () => {
    render(<DashboardView />);
    expect(screen.getByText(readiness.headline)).toBeTruthy();
    expect(screen.getByText(readiness.detail)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Training starten/ })).toBeTruthy();
  });

  it('has exactly one way into a workout', () => {
    // The duplicate "Weiter" in the action row outlived the session it pointed
    // at, which is how an abandoned workout stayed reachable.
    render(<DashboardView />);
    expect(screen.queryByRole('link', { name: /Weiter/ })).toBeNull();
  });

  it('asks about soreness while it is unanswered', () => {
    render(<DashboardView />);
    expect(screen.getByText('Muskelkater heute?')).toBeTruthy();
  });
});
