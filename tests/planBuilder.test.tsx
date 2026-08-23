// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/web/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, session: null, loading: false }) }));
vi.mock('@/data/profile', () => ({ getUserGoals: async () => ({ equipment: ['bodyweight', 'bands', 'pullup_bar'] }) }));
vi.mock('@/data/exercises', () => ({ listCustomExercises: async () => [] }));
vi.mock('@/web/hooks/usePlans', () => ({
  usePlans: () => ({
    plans: [], loading: false, error: null,
    applyTemplate: vi.fn(), createCustom: vi.fn(), activate: vi.fn(), remove: vi.fn(),
  }),
}));

import { PlansView } from '@/web/views/PlansView';

afterEach(cleanup);

async function openBuilder() {
  render(<PlansView />);
  fireEvent.click(await screen.findByRole('button', { name: 'Eigener Plan' }));
}

async function openPicker() {
  await openBuilder();
  fireEvent.click(await screen.findByRole('button', { name: /Übungen hinzufügen/ }));
  return screen.findByRole('dialog', { name: 'Übung auswählen' });
}

describe('Eigenen Plan erstellen', () => {
  it('leads with the exercise table instead of an empty text field', async () => {
    // Regression: picking an exercise was hidden behind an unlabelled 16px
    // icon next to a free-text input, which read as "type it yourself".
    await openBuilder();
    expect(await screen.findByRole('button', { name: /Übungen hinzufügen/ })).toBeTruthy();
    expect(screen.queryByPlaceholderText('Übung')).toBeNull();
  });

  it('opens the picker with the full table', async () => {
    await openPicker();
    expect(screen.getByText('Liegestütze')).toBeTruthy();
  });

  it('adds the picked exercise with its defaults', async () => {
    await openPicker();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Klimmzüge' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Klimmzüge hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: /übernommen|Fertig/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Klimmzüge/ })).toBeTruthy());
    const sets = screen.getAllByLabelText('Sätze') as HTMLInputElement[];
    expect(sets[0]?.value).toBe('4');
    const reps = screen.getAllByLabelText('Wiederholungen') as HTMLInputElement[];
    expect(reps[0]?.value).toBe('6-10');
  });

  it('stays open so a whole day can be filled in one go', async () => {
    await openPicker();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Klimmzüge' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Klimmzüge hinzufügen' }));
    // The sheet must still be there — reopening it per exercise was the slow part.
    expect(screen.getByRole('dialog', { name: 'Übung auswählen' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Liegestütze' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Liegestütze hinzufügen' }));
    expect(screen.getByRole('button', { name: /2 übernommen/ })).toBeTruthy();
  });

  it('marks what is already in the day', async () => {
    await openPicker();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Klimmzüge' } });
    const add = await screen.findByRole('button', { name: 'Klimmzüge hinzufügen' });
    expect(add.className).not.toContain('added');
    fireEvent.click(add);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Klimmzüge hinzufügen' }).className).toContain('added');
    });
  });

  it('lets a picked exercise be swapped for another', async () => {
    await openPicker();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Klimmzüge' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Klimmzüge hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: /übernommen|Fertig/ }));

    fireEvent.click(await screen.findByRole('button', { name: /Klimmzüge/ }));
    fireEvent.change(await screen.findByLabelText('Übung suchen'), { target: { value: 'Plank' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Plank hinzufügen' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Plank/ })).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Klimmzüge/ })).toBeNull();
  });

  it('removes an exercise again', async () => {
    await openPicker();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Klimmzüge' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Klimmzüge hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: /übernommen|Fertig/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Übung 1 entfernen' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Klimmzüge/ })).toBeNull());
  });

  it('keeps sets and reps editable per exercise', async () => {
    await openPicker();
    fireEvent.change(screen.getByLabelText('Übung suchen'), { target: { value: 'Plank' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Plank hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: /übernommen|Fertig/ }));

    const sets = (await screen.findAllByLabelText('Sätze'))[0] as HTMLInputElement;
    fireEvent.change(sets, { target: { value: '5' } });
    expect(sets.value).toBe('5');
  });
});
