// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
vi.mock('@/data/exercises', () => ({ listCustomExercises: async () => [] }));

import { ExercisePickerSheet } from '@/web/components/ExercisePickerSheet';

afterEach(cleanup);

function open(available: Parameters<typeof ExercisePickerSheet>[0]['available'] = []) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(<ExercisePickerSheet available={available} onPick={onPick} onClose={onClose} />);
  return { onPick, onClose };
}

describe('ExercisePickerSheet renders and works', () => {
  it('opens with a list of exercises', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Übung auswählen' })).toBeTruthy();
    expect(screen.getByText(/\d+ Übungen/)).toBeTruthy();
    expect(screen.getByText('Liegestütze')).toBeTruthy();
  });

  it('filters down to a muscle group when a chip is pressed', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Bauch', pressed: false }));
    // A chest exercise must be gone once Bauch is selected.
    expect(screen.queryByText('Bankdrücken')).toBeNull();
    expect(screen.getByText('Plank')).toBeTruthy();
  });

  it('filters by equipment', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Band', pressed: false }));
    expect(screen.queryByText('Bankdrücken')).toBeNull();
    expect(screen.getByText('Band-Rudern')).toBeTruthy();
  });

  it('searching narrows the list', () => {
    open();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'klimmzug' } });
    expect(screen.getByText('Klimmzüge')).toBeTruthy();
    expect(screen.queryByText('Bankdrücken')).toBeNull();
  });

  it('hands the picked exercise back with its defaults', () => {
    const { onPick } = open();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Liegestütze' } });
    fireEvent.click(screen.getByRole('button', { name: 'Liegestütze hinzufügen' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ name: 'Liegestütze', defaultSets: 3 });
  });

  it('expands an exercise into a full explanation', () => {
    open();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Pike Push-ups' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Pike Push-ups/, expanded: false })[0]!);

    expect(screen.getByText('Überkopf-Drücken')).toBeTruthy();
    expect(screen.getByText('Hauptsächlich')).toBeTruthy();
    expect(screen.getByText('Ausführung')).toBeTruthy();
    expect(screen.getByText('Häufige Fehler')).toBeTruthy();
    expect(screen.getByText(/Tempo/)).toBeTruthy();
  });

  it('separates the main target from the assisting muscles', () => {
    open();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Bankdrücken' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Bankdrücken/, expanded: false })[0]!);
    expect(screen.getByText('Mitbeansprucht')).toBeTruthy();
  });

  it('keeps the sheet open while several exercises are added', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ExercisePickerSheet available={[]} onPick={onPick} onClose={onClose} multiple />);
    fireEvent.change(screen.getAllByLabelText('Übung suchen')[0]!, { target: { value: 'Plank' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Plank hinzufügen' })[0]!);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers to create an exercise that is not in the table', () => {
    const onCreateCustom = vi.fn();
    render(
      <ExercisePickerSheet available={[]} onPick={vi.fn()} onClose={vi.fn()} onCreateCustom={onCreateCustom} />,
    );
    fireEvent.change(screen.getAllByLabelText('Übung suchen')[0]!, { target: { value: 'Sandsack-Wurf' } });
    fireEvent.click(screen.getByRole('button', { name: /als eigene Übung anlegen/ }));
    expect(onCreateCustom).toHaveBeenCalledWith('Sandsack-Wurf');
  });

  it('restricts to the user’s own equipment when asked', () => {
    open(['bodyweight', 'bands']);
    // The toggle defaults on when equipment is configured.
    expect(screen.queryByText('Bankdrücken')).toBeNull();
    expect(screen.getByText('Liegestütze')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Nur mein Equipment/ }));
    expect(screen.getByText('Bankdrücken')).toBeTruthy();
  });

  it('marks what the user cannot do rather than hiding it silently', () => {
    open(['bodyweight']);
    fireEvent.click(screen.getByRole('button', { name: /Nur mein Equipment/ }));
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Bankdrücken' } });
    // Bankdrücken and Schrägbankdrücken both match, and both need a barbell.
    expect(screen.getAllByText(/braucht Langhantel/).length).toBeGreaterThan(0);
  });

  it('says so when a filter combination has no results', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Brust', pressed: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Ausdauer', pressed: false }));
    expect(screen.getByText(/Keine Übung passt/)).toBeTruthy();
  });

  it('resets the filters', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Bauch', pressed: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(screen.getByText('Bankdrücken')).toBeTruthy();
  });

  it('closes on the close button', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalled();
  });
});
