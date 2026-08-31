/*
  Offline support for the hosted (GitHub Pages) build only.

  Network-first, cache-fallback: the librarian always gets the newest version when
  the school wifi is up, and the app still opens when it is not. The alternative
  (cache-first) would pin her to a stale build until the cache expired, which is
  the wrong trade for an app that gets fixed between school weeks.

  Not used by the file:// build — nothing registers this when opened locally.
*/
const CACHE = 'library-reward-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Never touch anything outside this app's own origin.
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit ?? caches.match('./')),
      ),
  );
});
