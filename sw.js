
const CACHE_NAME = 'fibertrack-v2';

// 1. App Shell (Static Files)
const STATIC_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(STATIC_URLS);
    })
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-http/https (e.g., chrome-extension://) and Firestore APIs
  if (!url.protocol.startsWith('http') || url.pathname.includes('firestore.googleapis.com')) {
    return;
  }

  // Strategy: Serve from Cache, then Update from Network
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache valid responses (JS, CSS, Images, Fonts)
        if (
          networkResponse.ok && 
          (url.pathname.endsWith('.js') || 
           url.pathname.endsWith('.css') || 
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.woff2') ||
           event.request.destination === 'script' ||
           event.request.destination === 'style')
        ) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch((err) => {
         // Network failed
         console.log('Network fetch failed', err);
         // If we don't have a cached response, we might want to return a fallback here
      });

      return cachedResponse || fetchPromise;
    })
  );
});
