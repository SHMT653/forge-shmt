// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// The plan editor pulls in Supabase-backed hooks; only the picker entry point
// is under test here, so those are stubbed out.
vi.mock('@/web/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, session: null, loading: false }) }));
vi.mock('@/data/profile', () => ({ getUserGoals: async () => ({ equipment: ['bodyweight', 'bands', 'pullup_bar'] }) }));
vi.mock('@/data/exercises', () => ({ listCustomExercises: async () => [] }));

import { ExercisePickerSheet } from '@/web/components/ExercisePickerSheet';

afterEach(cleanup);

describe('picking an exercise for a plan', () => {
  it('a home setup still gets a real selection to choose from', () => {
    render(<ExercisePickerSheet available={['bodyweight', 'bands', 'pullup_bar']} onPick={vi.fn()} onClose={vi.fn()} />);
    const count = Number(/(\d+) Übungen/.exec(screen.getByText(/\d+ Übungen/).textContent ?? '')?.[1] ?? '0');
    // Before the table was expanded this would have been about fifteen.
    expect(count).toBeGreaterThan(70);
  });

  it('finds an exercise typed without its umlaut', () => {
    render(<ExercisePickerSheet available={[]} onPick={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'klimmzug' } });
    expect(screen.getByText('Klimmzüge')).toBeTruthy();
  });

  it('every muscle group has something for a home setup', () => {
    render(<ExercisePickerSheet available={['bodyweight', 'bands', 'pullup_bar']} onPick={vi.fn()} onClose={vi.fn()} />);
    for (const group of ['Brust', 'Rücken', 'Beine', 'Schultern', 'Bizeps', 'Trizeps', 'Bauch']) {
      fireEvent.click(screen.getByRole('button', { name: group }));
      const label = screen.getByText(/\d+ Übungen/).textContent ?? '';
      const count = Number(/(\d+) Übungen/.exec(label)?.[1] ?? '0');
      expect(count, `${group} braucht Heim-Übungen`).toBeGreaterThan(0);
    }
  });
});
