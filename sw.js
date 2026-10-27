// Offline support + notification actions for «مهامي»
// The app opens at once from this version's saved copy, like an installed app (v105): every file of a version
// is saved together when its sw.js is installed, and checked to be of that version, so they always match.
// A new version is found by the browser checking sw.js, saved whole in the background, and the page then
// offers «حدّث الآن» (app.js). The manifest still comes from the site first (the phone reads it for the icon).
importScripts('timer-shared.js');

const VERSION = 142;
const CACHE = `mahami-v${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './timer-shared.js',
  './native.js',
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
  './study.js',
  './quiz.js',
  './kunnasha.js', './benplus.js', './plan.js', './planprint.js',
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
  './icons/monochrome-512.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so every file is from this version
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })));
    // a server still giving the older page or app.js just after an update would mix two versions: then this one
    // is not installed (the older one keeps working) and the browser tries again at its next check
    const [root, page, app] = await Promise.all(['./', './index.html', './app.js'].map(async (u) => (await c.match(u)).text()));
    if (![root, page].every((t) => t.includes(`APP_VERSION === ${VERSION} `)) || !app.includes(`APP_VERSION = ${VERSION};`)) {
      await caches.delete(CACHE);
      throw new Error('mixed versions');
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'mahami-actions' && !k.startsWith('muallim-')).map((k) => caches.delete(k)))) // «مساعد المعلم» shares this site: its caches are its own
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // the Android app's file: always the one on the site, never kept (it changes apart from the web app)
  if (url.origin === self.location.origin && url.pathname.endsWith('.apk')) return;
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      // the manifest: from the site first (the phone reads it to update the app's icon and name), saved copy offline
      const fresh = url.pathname.endsWith('/manifest.webmanifest');
      // this version's saved copy at once (a «?v=» or «?new=» does not change the file)
      const hit = !fresh && await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
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

// swiping an alarm notification away answers it: the app stops ringing and repeating it
self.addEventListener('notificationclose', (e) => {
  const { id, key } = e.notification.data || {};
  if (!id || !key) return;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => { for (const c of all) c.postMessage({ type: 'alarm-action', action: 'dismiss', id, key }); }));
});
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
