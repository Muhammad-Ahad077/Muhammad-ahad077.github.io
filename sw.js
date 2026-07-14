/* ============================================================
   4S Bazzar — Service Worker
   Strategy: NETWORK-FIRST for everything.
   - The app is real-time (5s polling), so we never want stale
     data or stale JS. Cache is only a fallback when offline.
   - API calls (anything not same-origin) are never cached.
   ============================================================ */

const CACHE_NAME = '4s-bazzar-v1';

// App shell to pre-cache (relative paths so it works on GitHub
// Pages subpaths like /4s-bazzar-frontend/ too)
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './static/config.js',
  './static/app.js',
  './static/styles.css',
  './static/logo.png',
  './static/icon-192.png',
  './static/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // NEVER touch API calls (backend on Railway = different origin)
  if (url.origin !== self.location.origin) return;

  // Network-first, fall back to cache when offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
