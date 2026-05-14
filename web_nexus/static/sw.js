// Nexus AI Terminal — Service Worker
// Cache-first for static assets, network-first for API calls
const CACHE_NAME = 'nexus-v2';
// Pre-cache only the HTML shell + icon. JS/CSS files use cache-busted URLs
// (?v=xxx) which change on every deploy, so they're cached on-demand via
// the fetch handler instead of pre-cached here.
const STATIC_ASSETS = [
  '/nexus/login',
  '/nexus/',
  '/nexus/icon.svg',
  '/nexus/favicon.ico',
];

// Install — pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, auth, or POST requests
  if (event.request.method !== 'GET' ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/login/') ||
      url.hostname !== self.location.hostname) {
    return;
  }

  // Static assets — cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful responses
        if (response.ok && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback — serve the login page
      if (event.request.mode === 'navigate') {
        return caches.match('/nexus/login');
      }
    })
  );
});
