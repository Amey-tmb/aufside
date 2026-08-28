// Aufside service worker — enables installability and basic offline support.
//
// Strategy:
//  - App shell (HTML/CSS/JS/icons): cache-first, so the app still loads with
//    no connection, then updates in the background for next time.
//  - API calls (/api/*) and any other cross-origin request (FPL's own API,
//    football-data.org via our proxy, etc.): always network-first — this data
//    changes constantly (scores, prices, points) so we never want a stale
//    cached copy to win over a fresh one. We only fall back to cache if the
//    network request fails outright (e.g. fully offline).
//
// Bump CACHE_VERSION whenever the app-shell file list changes so old caches
// get cleaned up on the next visit.
const CACHE_VERSION = 'aufside-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/api.js',
  '/js/app.js',
  '/js/constants.js',
  '/js/match-card.js',
  '/js/nav.js',
  '/js/news.js',
  '/js/router.js',
  '/js/scoring.js',
  '/js/skeletons.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/theme.js',
  '/js/tool-shell.js',
  '/js/utils.js',
  '/js/views/deadlines.js',
  '/js/views/fixtures.js',
  '/js/views/injuries.js',
  '/js/views/landing.js',
  '/js/views/live.js',
  '/js/views/mini-league.js',
  '/js/views/my-team.js',
  '/js/views/players.js',
  '/js/views/team.js',
  '/js/views/transfer-news.js',
  '/js/views/transfers.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept POST/PUT/etc.

  const url = new URL(req.url);

  // Cross-origin data requests (e.g. fantasy.premierleague.com fetched
  // directly by the page) and our own /api/* proxy endpoints: network-first.
  if (isApiRequest(url) || url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache successful, cacheable responses as an offline fallback.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin app shell files: cache-first, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
