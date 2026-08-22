// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/web/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, session: null, loading: false }) }));
vi.mock('@/data/profile', () => ({ getUserGoals: async () => ({ equipment: ['bodyweight', 'bands', 'pullup_bar'] }) }));
vi.mock('@/web/hooks/usePlans', () => ({
  usePlans: () => ({
    plans: [], loading: false, error: null,
    useTemplate: vi.fn(), createCustom: vi.fn(), activate: vi.fn(), remove: vi.fn(),
  }),
}));

import { PlansView } from '@/web/views/PlansView';

afterEach(cleanup);

async function openBuilder() {
  render(<PlansView />);
  fireEvent.click(await screen.findByRole('button', { name: 'Eigener Plan' }));
}

describe('Eigenen Plan erstellen', () => {
  it('offers a way to pick an exercise from the table, not just free text', async () => {
    await openBuilder();
    // Regression: the builder had only bare text inputs, so there was no way
    // to choose from the 176 exercises at all.
    const pickers = await screen.findAllByRole('button', { name: 'Übung aus der Datenbank wählen' });
    expect(pickers.length).toBeGreaterThan(0);
  });

  it('fills name, sets and reps from the picked exercise', async () => {
    await openBuilder();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Übung aus der Datenbank wählen' }))[0]!);

    const search = await screen.findByLabelText('Übung suchen');
    fireEvent.change(search, { target: { value: 'Klimmzüge' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Klimmzüge hinzufügen' }));

    await waitFor(() => {
      const nameInputs = screen.getAllByPlaceholderText('Übung') as HTMLInputElement[];
      expect(nameInputs[0]?.value).toBe('Klimmzüge');
    });
    const setsInputs = screen.getAllByPlaceholderText('Sätze') as HTMLInputElement[];
    expect(setsInputs[0]?.value).toBe('4');
  });

  it('keeps every field of the row reachable', async () => {
    await openBuilder();
    // All three inputs must exist per row — the old grid collapsed two of them
    // to zero width, which is why the row looked broken on a phone.
    expect((await screen.findAllByPlaceholderText('Übung')).length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText('Sätze').length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText('Wdh.').length).toBeGreaterThan(0);
  });

  it('still allows typing a name by hand', async () => {
    await openBuilder();
    const nameInput = (await screen.findAllByPlaceholderText('Übung'))[0] as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Eigene Übung' } });
    expect(nameInput.value).toBe('Eigene Übung');
  });

  it('adds another exercise row', async () => {
    await openBuilder();
    const before = (await screen.findAllByPlaceholderText('Übung')).length;
    fireEvent.click(screen.getAllByRole('button', { name: /Übung hinzufügen/ })[0]!);
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Übung').length).toBe(before + 1);
    });
  });
});
