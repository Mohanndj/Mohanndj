// «مساعد المعلم» moved to /muallim/: this old worker removes itself (its caches are left to the new app, which shares the names)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(self.registration.unregister()); });
