/*
 * Service worker: caches the app shell only (HTML/CSS/JS/vendor files).
 * Map tiles are handled separately via IndexedDB in js/tilecache.js, since
 * they need custom eviction/size logic the Cache API doesn't give us.
 *
 * Stays in the repo root on purpose: a service worker can only control
 * pages at or below its own path, so moving it into /js would limit its
 * scope to /js/ and leave index.html uncontrolled.
 *
 * thought up by human, coded by ai
 */

// Single source of truth for the version, shared with index.html.
importScripts('js/version.js');

// Chart tile hosts, handled by the IndexedDB cache rather than here.
const TILE_HOSTS = ['kartverket.no', 'geonorge.no', 'openseamap.org'];

// Version in the cache name doubles as cache busting: a new APP_VERSION
// creates a new cache and the activate handler drops the previous one.
const SHELL_CACHE = `seenavi-shell-v${APP_VERSION}`;
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/version.js',
  './js/sources.js',
  './js/app.js',
  './js/tilecache.js',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png',
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

  // Never intercept chart tile requests; those go through js/tilecache.js
  // and IndexedDB, not the service worker.
  if (TILE_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
