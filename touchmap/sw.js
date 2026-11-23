// Offline shell: everything the app needs is cached on first visit, so it works on a
// line with no Wi-Fi. Bump VERSION when files change; old caches are dropped.
const VERSION = 'touchmap-v2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/framework.js', 'js/framework-data.js', 'js/model.js', 'js/store.js', 'js/ui.js',
  'js/form.js', 'js/capture.js', 'js/log.js', 'js/insights.js', 'js/analysis.js', 'js/run.js',
  'js/guide.js', 'js/export.js', 'js/xlsx.js', 'js/demo.js', 'js/sync.js', 'js/sync-ui.js', 'sync/apps-script.gs',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('touchmap-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first, refreshed in the background: opens instantly on a line with patchy Wi-Fi,
// and picks up a new version on the next launch after it was fetched.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    return (await refresh) || (await cache.match('index.html')) || Response.error();
  }));
});
