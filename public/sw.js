/**
 * FORGE service worker.
 *
 * Deliberately conservative. Two rules:
 *  - App shell and static assets: cache-first, so a cold start works offline.
 *  - Everything that touches user data (Supabase, /api/*): network-only, never
 *    cached. A stale calorie total is worse than no calorie total, and health
 *    data must not sit in a browser cache (§14).
 */

const CACHE = 'forge-shell-v1';

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/brand-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isUserData(url)) return; // straight to the network, never cached

  // Navigations: try the network so the user gets the current app, fall back to
  // the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    }),
  );
});
