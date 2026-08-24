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
  /** Which of the two the worker reached for first, per request. */
  const order: string[] = [];
  const sandbox = {
    self: {
      addEventListener: (type: string, fn: Handler) => listeners.set(type, fn),
      location: { origin: 'https://forge.test' },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
    caches: {
      open: vi.fn(async () => ({ put, add: vi.fn(), })),
      match: vi.fn(async () => { order.push('cache'); return undefined; }),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
    },
    fetch: vi.fn(async () => { order.push('network'); return { ok: true, type: 'basic', clone: () => ({}) }; }),
    Response: { error: () => ({ error: true }) },
    URL,
    setTimeout,
    console,
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), sandbox);
  const onFetch = listeners.get('fetch');
  if (!onFetch) throw new Error('no fetch listener registered');

  /**
   * Handles one request and reports what the worker did with it:
   * 'network-only' when it declined to answer, or which source it tried first.
   */
  return function route(url: string, mode = 'no-cors'): 'network-only' | 'cache-first' | 'network-first' {
    order.length = 0;
    let handled = false;
    onFetch({
      request: { url, method: 'GET', mode },
      respondWith: () => { handled = true; },
    });
    if (!handled) return 'network-only';
    return order[0] === 'cache' ? 'cache-first' : 'network-first';
  };
}

let route: ReturnType<typeof loadWorker>;
beforeEach(() => { route = loadWorker(); });
const handles = (url: string, mode?: string) => route(url, mode) !== 'network-only';

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



  it('takes over content images', () => {
    expect(route('https://forge.test/brand-logo.png')).toBe('cache-first');
  });

  it('never reaches for a cached app icon first', () => {
    // The regression: icons live at fixed paths and their bytes change when the
    // artwork does. Cache-first pinned every phone to the icon it saw first, so
    // a rebuilt tile was deployed and simply never arrived. They still fall
    // back to cache when offline — they just stop winning against the network.
    for (const icon of [
      'app-icon.svg',
      'maskable-icon.svg',
      'apple-touch-icon.png',
      'apple-touch-icon-dark.png',
      'apple-touch-icon-light.png',
      'app-icon-dark-192.png',
      'app-icon-light-192.png',
      'app-icon-dark-512.png',
      'app-icon-light-512.png',
      'icon-192.png',
      'icon-512.png',
      'maskable-512.png',
    ]) {
      expect(route(`https://forge.test/icons/${icon}`), icon).toBe('network-first');
    }
  });

  it('never reaches for a cached manifest first', () => {
    expect(route('https://forge.test/manifest.webmanifest')).toBe('network-first');
  });

  it('still prefers the cache for content-hashed build output', () => {
    expect(route('https://forge.test/_next/static/chunks/main-abc123.js')).toBe('cache-first');
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
    // Bumped whenever what is cached changes, or old entries survive forever.
    expect(match?.[1]).not.toBe('forge-shell-v3');
  });
});
