const CACHE_NAME = 'frutesp-v4';
const BASE = '/Frutesp/';

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
];

// INSTALL
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS)
    )
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // 🔴 SUPABASE → SEM CACHE
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({ error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 🟢 APP SHELL → CACHE FIRST
  e.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});