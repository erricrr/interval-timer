const CACHE_NAME = 'tempotread-v3';
const RUNTIME_CACHE = 'tempotread-runtime-v3';
const FIREBASE_CACHE = 'tempotread-firebase-v1';

// Assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
];

// Install event - precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE && key !== FIREBASE_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch event - cache strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Firebase Storage - CacheFirst (audio files)
  if (url.hostname === 'firebasestorage.googleapis.com') {
    event.respondWith(
      caches.open(FIREBASE_CACHE).then((cache) =>
        cache.match(event.request).then((response) => {
          if (response) return response;
          
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
      )
    );
    return;
  }

  // Navigation requests - NetworkFirst with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets - CacheFirst for hashed assets, NetworkFirst for others
  if (url.pathname.startsWith('/assets/')) {
    // Hashed Vite assets - CacheFirst (immutable)
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((response) => {
          if (response) return response;

          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
      )
    );
    return;
  }

  // Everything else - NetworkFirst
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cache.match(event.request))
    )
  );
});
