/*
 * Service worker: caches the app shell only (HTML/CSS/JS/vendor files).
 * Map tiles are handled separately via IndexedDB in tilecache.js, since
 * they need custom eviction/size logic the Cache API doesn't give us.
 */

const SHELL_CACHE = 'seenavi-shell-v0.1.0';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './tilecache.js',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept tile requests to Kartverket; those go through
  // tilecache.js / IndexedDB, not the service worker.
  if (url.hostname.includes('kartverket.no')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
