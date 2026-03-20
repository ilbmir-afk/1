const CACHE_NAME = 'electroplan-v4';

const STATIC_ASSETS = [
  './',
  'index.html',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.svg',
  './icons/icon-512x512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const findCachedEntryPoint = async () => {
    const candidates = ['./index.html', 'index.html', './', '/index.html'];
    for (const candidate of candidates) {
      const match = await caches.match(candidate);
      if (match) return match;
    }
    return undefined;
  };

  // For SPA/PWA navigation always try network first, then local cached entry point.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cachedIndex = await findCachedEntryPoint();
          return cachedIndex || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          if (cached) return cached;
          if (url.pathname.endsWith('/index.html') || url.pathname === '/index.html') {
            return (await findCachedEntryPoint()) || Response.error();
          }
          return Response.error();
        });
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});