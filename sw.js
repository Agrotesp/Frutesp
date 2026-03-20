/* ═══ FRUTESP — SERVICE WORKER OFFLINE FIRST ═══ */
const CACHE = 'frutesp-v4';
const BASE  = '/Frutesp/';

/* Todos os recursos necessários para o app funcionar offline */
const SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  /* CDNs — precisam estar em cache para o app abrir offline */
  'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

/* ── INSTALL: cachear tudo ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url =>
        cache.add(new Request(url, {cache: 'reload'})).catch(err => {
          console.warn('[SW] Falhou ao cachear:', url, err);
        })
      ))
    ).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: limpar caches antigos ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Removendo cache antigo:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: estratégia por tipo de recurso ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* 1. Supabase API — sempre rede, nunca cache */
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          JSON.stringify({error: 'offline', message: 'Sem conexão'}),
          {status: 503, headers: {'Content-Type': 'application/json'}}
        )
      )
    );
    return;
  }

  /* 2. Google Fonts CSS — rede primeiro, cache como fallback */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  /* 3. CDNs (jsPDF, Supabase JS, Chart.js) — cache primeiro */
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  /* 4. App shell (github.io) — rede primeiro, cache como fallback */
  if (url.hostname.includes('github.io')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached =>
          cached ||
          caches.match(BASE + 'index.html') ||
          caches.match(BASE)
        )
      )
    );
    return;
  }

  /* 5. Tudo mais — cache primeiro */
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request)
    )
  );
});

/* ── BACKGROUND SYNC ── */
self.addEventListener('sync', e => {
  if (e.tag === 'sync-chamados') {
    e.waitUntil(
      self.clients.matchAll({includeUncontrolled: true}).then(clients =>
        clients.forEach(c => c.postMessage({type: 'SYNC_NOW'}))
      )
    );
  }
});

/* ── MESSAGE ── */
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});