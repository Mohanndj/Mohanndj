// Offline support for «مساعد المعلم»: network first, the cache when there is no connection.
const VERSION = 1;
const CACHE = `muallim-v${VERSION}`;
const ASSETS = ['./', './index.html', './q.html', './style.css', './qcodec.js', './core.js', './students.js', './behavior.js', './messages.js', './grades.js', './quizzes.js',
  '../xlsx-read.js', '../xlsx.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('muallim-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? (await cache.match('./index.html')) || Response.error() : Response.error());
    }
  })());
});
