// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { HoldTimer } from '@/web/components/HoldTimer';
import { RestTimer } from '@/web/components/RestTimer';

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

describe('HoldTimer — for planks and hangs', () => {
  it('counts up from zero once started', () => {
    render(<HoldTimer targetSeconds={45} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    advance(12_000);
    expect(screen.getByText('12s')).toBeTruthy();
  });

  it('hands the elapsed seconds to the set when stopped', () => {
    const onFinish = vi.fn();
    render(<HoldTimer targetSeconds={45} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    advance(47_000);
    fireEvent.click(screen.getByRole('button', { name: /Stopp/ }));
    expect(onFinish).toHaveBeenCalledWith(47);
  });

  it('keeps counting past the target rather than stopping at it', () => {
    render(<HoldTimer targetSeconds={30} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    advance(52_000);
    expect(screen.getByText('52s')).toBeTruthy();
  });

  it('formats past a minute as m:ss', () => {
    render(<HoldTimer targetSeconds={null} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    advance(95_000);
    expect(screen.getByText('1:35')).toBeTruthy();
  });

  it('records nothing when stopped without any time', () => {
    const onFinish = vi.fn();
    render(<HoldTimer targetSeconds={45} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    fireEvent.click(screen.getByRole('button', { name: /Stopp/ }));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('shows the target so the number is not a mystery', () => {
    render(<HoldTimer targetSeconds={60} onFinish={vi.fn()} />);
    expect(screen.getByText(/Ziel/)).toBeTruthy();
  });

  it('survives the screen sleeping mid-hold', () => {
    // Wall-clock based, so a gap in ticks does not lose time.
    const onFinish = vi.fn();
    render(<HoldTimer targetSeconds={null} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: /Start/ }));
    advance(60_000);
    fireEvent.click(screen.getByRole('button', { name: /Stopp/ }));
    expect(onFinish).toHaveBeenCalledWith(60);
  });
});

describe('RestTimer — adjustable pauses', () => {
  /** The timer now starts idle, so every test has to start it the way a user does. */
  function start(defaultSeconds = 90) {
    const view = render(<RestTimer defaultSeconds={defaultSeconds} />);
    fireEvent.click(screen.getByRole('button', { name: /Pause starten/ }));
    return view;
  }

  it('waits to be started instead of running the moment the screen opens', () => {
    render(<RestTimer defaultSeconds={90} />);
    // Regression: the timer used to auto-start, which meant it could only ever
    // be reached by ticking off a set.
    expect(screen.getByRole('button', { name: /Pause starten/ })).toBeTruthy();
    advance(10_000);
    expect(screen.queryByText('1:20')).toBeNull();
  });

  it('starts from outside when a set is completed', () => {
    const { rerender } = render(<RestTimer defaultSeconds={90} startSignal={0} />);
    rerender(<RestTimer defaultSeconds={90} startSignal={1} />);
    advance(10_000);
    expect(screen.getByText('1:20')).toBeTruthy();
  });

  it('counts down from the default', () => {
    start(90);
    advance(10_000);
    expect(screen.getByText('1:20')).toBeTruthy();
  });

  it('restarts at a preset when one is chosen', () => {
    render(<RestTimer defaultSeconds={90} />);
    fireEvent.click(screen.getByRole('button', { name: '3 min' }));
    advance(1000);
    expect(screen.getByText('2:59')).toBeTruthy();
  });

  it('remembers the chosen length for the next set', () => {
    const { unmount } = render(<RestTimer defaultSeconds={90} />);
    fireEvent.click(screen.getByRole('button', { name: '2 min' }));
    unmount();

    start(90);
    advance(1000);
    expect(screen.getByText('1:59')).toBeTruthy();
  });

  it('accepts a custom length', () => {
    render(<RestTimer defaultSeconds={90} />);
    fireEvent.change(screen.getByLabelText(/Eigene Pausenlänge/), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Setzen' }));
    advance(1000);
    expect(screen.getByText('1:14')).toBeTruthy();
  });

  it('rejects an implausible custom length rather than starting a 9-hour rest', () => {
    start(90);
    fireEvent.change(screen.getByLabelText(/Eigene Pausenlänge/), { target: { value: '99999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Setzen' }));
    advance(1000);
    expect(screen.getByText('1:29')).toBeTruthy();
  });

  it('adds thirty seconds on demand', () => {
    start(60);
    fireEvent.click(screen.getByRole('button', { name: /30 s/ }));
    advance(1000);
    expect(screen.getByText('1:29')).toBeTruthy();
  });

  it('says when the rest is over', () => {
    start(60);
    advance(61_000);
    expect(screen.getByText('Bereit')).toBeTruthy();
  });

  it('can be reset back to idle', () => {
    start(60);
    fireEvent.click(screen.getByRole('button', { name: 'Timer zurücksetzen' }));
    expect(screen.getByRole('button', { name: /Pause starten/ })).toBeTruthy();
  });
});
