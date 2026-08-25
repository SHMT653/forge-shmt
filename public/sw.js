/**
 * FORGE service worker.
 *
 * Deliberately conservative. The rules, in order of how much damage getting
 * them wrong does:
 *
 *  - Anything touching user data (Supabase, /api/*): network-only, never
 *    cached. A stale calorie total is worse than no calorie total, and health
 *    data must not sit in a browser cache (§14).
 *  - Application code: NEVER cache-first. An earlier version of this file
 *    cache-first'ed every same-origin GET, which included the RSC payloads and
 *    JS chunks Next.js fetches during client-side navigation. Tapping "Heute"
 *    from another tab then rendered whatever build happened to be cached first
 *    — the old dashboard, permanently, because the cache key never changed.
 *  - Only content-hashed assets under /_next/static/ are safe to serve
 *    cache-first: their URL changes whenever their content does.
 */

const CACHE = 'forge-shell-v5';

// Only the shell. Icons are deliberately absent: precaching them is the same
// trap as serving them cache-first, one install earlier.
const PRECACHE = ['/', '/brand-logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // A single missing asset must not fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isUserData(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.supabase.in')
  );
}

/** Content-hashed build output: the URL changes when the content does. */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

/**
 * Files we ship that are safe to serve stale — fonts and content images.
 *
 * NOT the app icons. Those live at fixed paths and their bytes change when the
 * artwork does, so serving them cache-first pins a phone to whichever icon it
 * saw first: a redesigned tile is uploaded, deployed, and never arrives. That
 * is exactly what happened to the icon rebuild.
 */
function isStaticFile(url) {
  if (url.pathname.startsWith('/icons/')) return false;
  if (
    [
      '/apple-touch-icon.png',
      '/icon-16.png',
      '/icon-32.png',
      '/icon-192.png',
      '/icon-512.png',
      '/icon-maskable-512.png',
    ].includes(url.pathname)
  ) return false;
  if (
    url.pathname.endsWith('.webmanifest') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest.json'
  ) return false;
  return /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname);
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    });
  });
}

function networkFirst(request, fallbackKey) {
  return fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(fallbackKey ?? request, copy)).catch(() => {});
      }
      return response;
    })
    .catch(() => caches.match(fallbackKey ?? request).then((cached) => cached ?? Response.error()));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isUserData(url)) return; // straight to the network, never cached

  // Navigations: current app when online, cached shell when not.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // RSC payloads and any other query-carrying request describe *current* state.
  // Serving these from cache is what pinned the app to an old build.
  if (url.search) return;

  if (isImmutableAsset(url) || isStaticFile(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else — app routes, chunks without a hash — prefers the network
  // and only falls back to a cached copy when offline.
  event.respondWith(networkFirst(request));
});
