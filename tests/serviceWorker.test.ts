import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

/**
 * The service worker decides, per request, whether the browser sees a cached
 * copy or the network. Getting that wrong is invisible in every other kind of
 * test: types pass, the build passes, the page returns 200 — and the phone
 * keeps rendering a build from three deploys ago.
 *
 * An earlier version cache-first'ed every same-origin GET, which included the
 * RSC payloads Next.js fetches during client-side navigation. Tapping "Heute"
 * from another tab then rendered the old dashboard permanently, because the
 * cache key never changed between builds.
 */

type Handler = (event: FakeEvent) => void;

type FakeEvent = {
  request: { url: string; method: string; mode: string };
  respondWith: (value: unknown) => void;
};

function loadWorker() {
  const listeners = new Map<string, Handler>();
  const put = vi.fn();
  const sandbox = {
    self: {
      addEventListener: (type: string, fn: Handler) => listeners.set(type, fn),
      location: { origin: 'https://forge.test' },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
    caches: {
      open: vi.fn(async () => ({ put, add: vi.fn(), })),
      match: vi.fn(async () => undefined),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
    },
    fetch: vi.fn(async () => ({ ok: true, type: 'basic', clone: () => ({}) })),
    Response: { error: () => ({ error: true }) },
    URL,
    setTimeout,
    console,
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), sandbox);
  const onFetch = listeners.get('fetch');
  if (!onFetch) throw new Error('no fetch listener registered');

  /** Returns true when the worker took over the request. */
  return function handles(url: string, mode = 'no-cors'): boolean {
    let handled = false;
    onFetch({
      request: { url, method: 'GET', mode },
      respondWith: () => { handled = true; },
    });
    return handled;
  };
}

let handles: ReturnType<typeof loadWorker>;
beforeEach(() => { handles = loadWorker(); });

describe('service worker request routing', () => {
  it('never serves an RSC payload from cache', () => {
    // The regression: this is how Next.js fetches a route on client-side
    // navigation. Cached, it pins the app to whichever build got there first.
    expect(handles('https://forge.test/?_rsc=1a2b3c')).toBe(false);
    expect(handles('https://forge.test/plans?_rsc=1a2b3c')).toBe(false);
  });

  it('leaves every query-carrying request to the network', () => {
    expect(handles('https://forge.test/anything?v=2')).toBe(false);
  });

  it('takes over content-hashed build assets', () => {
    // Safe to cache: the filename changes whenever the content does.
    expect(handles('https://forge.test/_next/static/chunks/main-abc123.js')).toBe(true);
  });

  it('takes over icons and images', () => {
    expect(handles('https://forge.test/icons/icon-192.png')).toBe(true);
    expect(handles('https://forge.test/brand-logo.png')).toBe(true);
  });

  it('handles navigations so the app opens offline', () => {
    expect(handles('https://forge.test/kalender', 'navigate')).toBe(true);
  });

  it('never touches health or nutrition data', () => {
    // §14: user data must not sit in a browser cache.
    expect(handles('https://abcdef.supabase.co/rest/v1/forge_meal_entries')).toBe(false);
    expect(handles('https://forge.test/api/ai/coach')).toBe(false);
    expect(handles('https://forge.test/api/health/sync', 'navigate')).toBe(false);
  });

  it('ignores other origins entirely', () => {
    expect(handles('https://de.openfoodfacts.org/cgi/search.pl')).toBe(false);
  });

  it('uses a cache name that changes between releases', () => {
    // A fixed cache name is what made the stale build survive every deploy.
    const source = readFileSync('public/sw.js', 'utf8');
    const match = /const CACHE = '([^']+)'/.exec(source);
    expect(match?.[1]).toBeTruthy();
    expect(match?.[1]).not.toBe('forge-shell-v1');
  });
});
