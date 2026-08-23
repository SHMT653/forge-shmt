// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { OfflineBanner } from '@/web/components/OfflineBanner';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

afterEach(() => { cleanup(); setOnline(true); });

describe('OfflineBanner', () => {
  it('stays out of the way while there is a connection', () => {
    setOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('says so when the connection is gone', () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status').textContent).toMatch(/Offline/);
  });

  it('appears and disappears with the connection', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();

    setOnline(false);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(screen.getByRole('status')).toBeTruthy();

    setOnline(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('removes its listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<OfflineBanner />);
    unmount();
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function));
    remove.mockRestore();
  });
});
