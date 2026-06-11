// Service Worker BELOTA — cache statique
const CACHE = 'belota-v1';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Ne pas intercepter les requêtes de vérification de mise à jour
  if (e.request.url.endsWith('/') && e.request.cache === 'no-store') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
