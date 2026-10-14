// Offline cache + notification actions for «مهامي»
importScripts('timer-shared.js');
const CACHE = 'mahami-v4.0.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './timer-shared.js',
  './prayer.js',
  './nlp.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: open instantly from cache, refresh in the background
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Timer buttons (pressed on the phone or on a paired watch): record the press, refresh the
// notification at once, and let the page apply it now or the next time it wakes up.
async function timerAction(n, action) {
  const ts = Date.now();
  const { timer, title } = n.data || {};
  const c = await caches.open('mahami-actions');
  const prev = await c.match('pending');
  const list = prev ? await prev.json() : [];
  list.push({ action, ts });
  await c.put('pending', new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } }));
  const next = TimerShared.apply(timer, action, ts);
  if (next) {
    const [t, opts] = TimerShared.notification(next, title, ts);
    await self.registration.showNotification(t, opts);
  } else {
    n.close();
  }
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of all) client.postMessage({ type: 'timer-pending' });
}

self.addEventListener('notificationclick', (e) => {
  if (e.notification.tag === 'timer' && e.action) {
    e.waitUntil(timerAction(e.notification, e.action));
    return;
  }
  const { id, key } = e.notification.data || {};
  const action = e.action || 'open';
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all[0];
    if (client) {
      if (action !== 'open' && id) client.postMessage({ type: 'alarm-action', action, id, key });
      return client.focus();
    }
    const qs = action !== 'open' && id ? `?action=${action}&id=${encodeURIComponent(id)}&key=${encodeURIComponent(key || '')}` : '';
    return self.clients.openWindow(`./${qs}#${e.notification.tag === 'timer' ? 'timer' : 'today'}`);
  })());
});
