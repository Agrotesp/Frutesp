const CACHE_NAME = ‘frutesp-v3’;
const BASE = ‘/Frutesp/’;
const ASSETS = [
BASE,
BASE + ‘index.html’,
BASE + ‘manifest.json’,
];

self.addEventListener(‘install’, e => {
e.waitUntil(
caches.open(CACHE_NAME).then(cache =>
Promise.allSettled(ASSETS.map(url => cache.add(url)))
)
);
self.skipWaiting();
});

self.addEventListener(‘activate’, e => {
e.waitUntil(
caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
)
);
self.clients.claim();
});

self.addEventListener(‘fetch’, e => {
const url = new URL(e.request.url);

if (url.hostname.includes(‘supabase.co’)) {
e.respondWith(fetch(e.request).catch(() =>
new Response(’{“error”:“offline”}’, {headers:{‘Content-Type’:‘application/json’}})
));
return;
}

if (!url.hostname.includes(‘github.io’)) {
e.respondWith(
caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
if (res && res.status === 200) {
const clone = res.clone();
caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
}
return res;
}).catch(() => caches.match(e.request)))
);
return;
}

e.respondWith(
fetch(e.request).then(res => {
if (res && res.status === 200) {
const clone = res.clone();
caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
}
return res;
}).catch(() =>
caches.match(e.request).then(cached =>
cached || caches.match(BASE + ‘index.html’) || caches.match(BASE)
)
)
);
});

self.addEventListener(‘sync’, e => {
if (e.tag === ‘sync-chamados’) {
e.waitUntil(
self.clients.matchAll().then(clients =>
clients.forEach(c => c.postMessage({type:‘SYNC_NOW’}))
)
);
}
});

self.addEventListener(‘message’, e => {
if (e.data && e.data.type === ‘SKIP_WAITING’) self.skipWaiting();
});