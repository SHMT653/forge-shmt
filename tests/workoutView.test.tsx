// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { WorkoutSession } from '@/domain/types';

const state: { loading: boolean; session: WorkoutSession | null } = { loading: true, session: null };

vi.mock('@/web/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/data/workouts', () => ({ listExerciseSnapshots: async () => [] }));
vi.mock('@/data/profile', () => ({ getUserGoals: async () => ({ currentWeight: 80, equipment: [] }) }));
vi.mock('@/data/cardio', () => ({ addCardioLog: vi.fn() }));
vi.mock('@/data/exercises', () => ({ findCustomExerciseByName: async () => null }));
vi.mock('@/web/hooks/useActiveWorkout', () => ({
  useActiveWorkout: () => ({
    session: state.session,
    loading: state.loading,
    error: null,
    lastPerformance: new Map(),
    saveSet: vi.fn(), addSet: vi.fn(), finish: vi.fn(), abandon: vi.fn(), reload: vi.fn(),
  }),
}));

import { WorkoutView } from '@/web/views/WorkoutView';

const session: WorkoutSession = {
  id: 's1', planId: 'p1', planName: 'Ganzkörper', dayName: 'Tag 1',
  startedAt: '2026-08-23T10:00:00.000Z', completedAt: null, durationSeconds: null, kind: 'full',
  exercises: [{
    id: 'se1', exerciseName: 'Klimmzüge', targetSets: 3, targetReps: '6-10', position: 0,
    sets: [{ id: 'set1', setNumber: 1, reps: null, weightKg: null, durationSeconds: null, completed: false }],
  }],
} as unknown as WorkoutSession;

afterEach(() => { cleanup(); state.loading = true; state.session = null; });

describe('WorkoutView', () => {
  it('survives the transition from loading to loaded', () => {
    // Regression: state and effects sat below five early returns, so the first
    // render ran six hooks and the second ran ten. React aborts the render with
    // "rendered more hooks than during the previous render" — which reaches the
    // user as a blank "this page couldn't load".
    const { rerender } = render(<WorkoutView sessionId="s1" />);
    expect(screen.getByText(/wird geladen/)).toBeTruthy();

    state.loading = false;
    state.session = session;
    rerender(<WorkoutView sessionId="s1" />);

    expect(screen.getByRole('heading', { name: 'Klimmzüge' })).toBeTruthy();
  });

  it('offers the rest countdown without needing a set ticked off first', () => {
    state.loading = false;
    state.session = session;
    render(<WorkoutView sessionId="s1" />);
    expect(screen.getByRole('button', { name: /Pause starten/ })).toBeTruthy();
  });

  it('reports a missing session instead of crashing', () => {
    state.loading = false;
    state.session = null;
    render(<WorkoutView sessionId="s1" />);
    expect(screen.getByText(/nicht gefunden/)).toBeTruthy();
  });
});
