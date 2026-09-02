const CACHE_NAME = 'swiss-driving-v2';

const PRECACHE_URLS = [
  './index.html',
  './training.html',
  './exam.html',
  './src/css/style.css',
  './src/js/utils.js',
  './src/js/quiz.js',
  './src/js/progress.js',
  './src/js/i18n.js',
  './src/js/filters.js',
  './src/js/exam.js',
  './src/js/data.js',
  './src/js/coaching.js',
  './src/js/browse.js',
  './src/js/app.js',
  './assets/questions.json',
  './assets/icons/icon-48x48.png',
  './assets/icons/icon-72x72.png',
  './assets/icons/icon-96x96.png',
  './assets/icons/icon-128x128.png',
  './assets/icons/icon-144x144.png',
  './assets/icons/icon-152x152.png',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-256x256.png',
  './assets/icons/icon-384x384.png',
  './assets/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
      return cachedResponse || networkFetch;
    })
  );
});
