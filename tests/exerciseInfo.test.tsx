// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/data/exercises', () => ({ findCustomExerciseByName: async () => null }));

import { ExerciseInfoModal } from '@/web/components/ExerciseInfoModal';

afterEach(cleanup);

describe('ExerciseInfoModal', () => {
  it('explains the exercise, not just its label', () => {
    render(<ExerciseInfoModal name="Kreuzheben" onClose={vi.fn()} />);
    expect(screen.getByText('Hüftbeuge')).toBeTruthy();
    expect(screen.getByText('Ausführung')).toBeTruthy();
    expect(screen.getByText('Häufige Fehler')).toBeTruthy();
    // The cue that matters most on a hinge, available mid-set.
    expect(screen.getByText(/Runder Rücken/)).toBeTruthy();
  });

  it('separates target from assisting muscles', () => {
    render(<ExerciseInfoModal name="Klimmzüge" onClose={vi.fn()} />);
    expect(screen.getByText('Hauptsächlich')).toBeTruthy();
    expect(screen.getByText('Mitbeansprucht')).toBeTruthy();
  });

  it('says so plainly for an exercise it does not know', async () => {
    render(<ExerciseInfoModal name="Völlig erfundene Übung" onClose={vi.fn()} />);
    expect(await screen.findByText(/Keine weiteren Infos/)).toBeTruthy();
  });

  it('closes', () => {
    const onClose = vi.fn();
    render(<ExerciseInfoModal name="Plank" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalled();
  });
});
