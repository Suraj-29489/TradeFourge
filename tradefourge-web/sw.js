/**
 * TradeFourge Service Worker
 * Enables offline capability, instant load caching, and PWA installation.
 */

const CACHE_NAME = 'tradefourge-v1.4.7';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './privacy-policy.html',
  './terms-of-service.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './css/auth.css',
  './css/legal.css',
  './js/xlsx.full.min.js',
  './js/html2pdf.bundle.min.js',
  './js/config.js',
  './js/storage.js',
  './js/theme.js',
  './js/google-auth.js',
  './js/google-drive.js',
  './js/cloud-sync.js',
  './js/auth.js',
  './js/parser.js',
  './js/analytics.js',
  './js/charts.js',
  './js/calendar.js',
  './js/offline-strategy-engine.js',
  './js/strategy-bot.js',
  './js/mt5.js',
  './js/app.js',
  './assets/icons/logo.png',
  './assets/icons/icon.svg',
  './assets/icons/favicon.svg',
  './assets/icons/favicon-32.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_ASSETS.map((assetUrl) =>
          fetch(new Request(assetUrl, { cache: 'reload' }))
            .then((res) => (res && res.ok ? cache.put(assetUrl, res) : null))
            .catch(() => null)
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Never cache dynamic backend APIs, local runtime overrides, or Google Auth/Drive API traffic
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/api/') || url.pathname.endsWith('/js/config.local.js'))
  ) {
    return;
  }

  if (
    url.hostname === 'accounts.google.com' ||
    url.hostname.endsWith('.googleapis.com') ||
    url.hostname.endsWith('.googleusercontent.com') ||
    url.hostname === 'apis.google.com'
  ) {
    return;
  }

  // Navigation requests: Network-first, fallback to matching cached page
  if (request.mode === 'navigate') {
    const targetCacheKey =
      (url.pathname === '/privacy-policy' || url.pathname === '/privacy-policy.html')
        ? './privacy-policy.html'
        : (url.pathname === '/terms-of-service' || url.pathname === '/terms-of-service.html')
          ? './terms-of-service.html'
          : './index.html';
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(targetCacheKey, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(targetCacheKey))
    );
    return;
  }

  // Same-origin assets: Network-first with revalidation everywhere so deployments apply
  // immediately on refresh while preserving full offline PWA fallback from cache.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // External CDN assets (Chart.js, Google Fonts, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      }).catch(() => {/* offline */});
    })
  );
});
