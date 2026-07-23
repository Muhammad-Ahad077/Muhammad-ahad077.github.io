/* 4S Bazzar — service worker
 * Strategy (v4 — instant updates):
 *  - HTML / JS / CSS → NETWORK-FIRST: visitors always get the newest deployed
 *    version instantly; the cache is only used when offline.
 *  - Images / fonts / icons → cache-first with background refresh (they rarely change).
 *  - /api/* → network-only (always fresh data), graceful JSON error offline.
 *  - New SW versions activate immediately (skipWaiting + clients.claim) and the
 *    page auto-reloads once via controllerchange (see index.html).
 */
const VERSION = '4sb-v5';
const SHELL = [
  '/',
  '/static/styles.css',
  '/static/app.js',
  '/static/login-art.webp',
  '/static/logo.png',
  '/static/logo-192.png',
  '/static/logo-64.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Anything that defines the app's behaviour must always be fresh.
function isAppCode(req, url) {
  return req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/' ||
    url.pathname === '/manifest.webmanifest';
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // API: network only, JSON error when offline
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline. Connect to the internet and try again.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // HTML / JS / CSS: NETWORK-FIRST → updates are visible instantly.
  // Cache is only the offline fallback.
  if (isAppCode(e.request, url)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(resp => {
        if (resp.ok && url.origin === location.origin) {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() =>
        caches.match(e.request).then(cached => cached ||
          (e.request.mode === 'navigate' ? caches.match('/') : undefined))
      )
    );
    return;
  }

  // Images / fonts / other static: cache-first, refresh in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(resp => {
        if (resp.ok && url.origin === location.origin) {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
