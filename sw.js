// Offline support + notification actions for «مهامي»
// App files are fetched from the network first so the page and its scripts always come from the
// same version; the cache is only used when there is no connection.
importScripts('timer-shared.js');

const VERSION = 78;
const CACHE = `mahami-v${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './timer-shared.js',
  './prayer.js',
  './nlp.js',
  './xlsx.js',
  './library.js',
  './notes.js',
  './inspire.js',
  './archive.js',
  './ideas.js',
  './journal.js',
  './docx.js',
  './hifz.js',
  './people.js',
  './decisions.js',
  './quits.js',
  './reminders.js',
  './benvoice.js',
  './remind.js',
  './xlsx-read.js',
  './finance.js',
  './cv.js',
  './bills.js',
  './health.js',
  './shop.js',
  './layout.js',
  './links.js',
  './route.js',
  './savings.js',
  './reading.js',
  './fines.js',
  './week.js',
  './aware.js',
  './sync.js',
  './ai.js',
  './habits.js',
  './report.js',
  './voice.js',
  './vendor/anthropic-sdk.mjs',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/badge-96.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so every file is from this version
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'mahami-actions').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // network first, cache as offline fallback
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req, { ignoreSearch: true })) ||
          (req.mode === 'navigate' ? (await cache.match('./index.html')) || Response.error() : Response.error());
      }
    })());
    return;
  }

  // only web fonts are cached from other sites; API calls (GitHub, Claude) always go to the network
  if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com$/.test(url.origin)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch {
      return Response.error();
    }
  })());
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
