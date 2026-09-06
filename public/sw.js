/**
 * Service worker: network-first for navigation, cache-first for hashed build
 * assets.
 *
 * Network-first on documents matters — a stale-first worker will happily
 * serve yesterday's index.html forever and make a deploy look like it did
 * nothing. Hashed assets under /assets/ are immutable, so those are safe to
 * serve from cache.
 */

const VERSION = 'burgundy-v1';
const SHELL = ['/', '/manifest.json', '/icons/icon-192.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    );
    return;
  }

  // Immutable build output: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ?? fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        }),
      ),
    );
  }
});
