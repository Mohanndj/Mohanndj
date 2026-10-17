/* عامل الخدمة: يجعل المدونة تطبيقًا يُثبَّت، وتُقرأ مقالاتها دون إنترنت بعد أول زيارة.
   الصفحات والبيانات: الشبكة أولًا (فيرى القارئ آخر نسخة)، والمخزّن عند الانقطاع.
   الملفات ذات البصمة والصور: المخزّن أولًا. لوحة التحكم وواجهات الخادم لا تمرّ به. */
const VERSION = "__BUILD__";
const PRECACHE = __PRECACHE__;
const SHELL = `shell-${VERSION}`, RUNTIME = `runtime-${VERSION}`, MEDIA = "media-v3", FONTS = "fonts-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => (k.startsWith("shell-") && k !== SHELL) || (k.startsWith("runtime-") && k !== RUNTIME) || (k.startsWith("media-") && k !== MEDIA)).map((k) => caches.delete(k))
  )).then(() => self.clients.claim()));
});

async function networkFirst(req, cacheName, fallback) {
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") (await caches.open(cacheName)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req, { ignoreSearch: req.mode === "navigate" })) || (fallback && (await caches.match(fallback))) || Response.error();
  }
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const p = url.pathname;
    if (p.startsWith("/api/") || p.startsWith("/admin") || p.startsWith("/a/") || p === "/sw.js") return;
    if (req.mode === "navigate") return e.respondWith(networkFirst(req, RUNTIME, "/"));
    if (p.startsWith("/assets/")) return e.respondWith(cacheFirst(req, RUNTIME));
    if (p.startsWith("/media/") || p.startsWith("/icons/")) return e.respondWith(cacheFirst(req, MEDIA));
    if (p.startsWith("/data/")) return e.respondWith(networkFirst(req, RUNTIME));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(staleWhileRevalidate(req, FONTS));
});
