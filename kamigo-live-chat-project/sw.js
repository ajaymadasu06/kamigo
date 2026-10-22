// Kamigo service worker: lets the site be installed and open the app shell offline.
// Bookings, chat and sign-in always need the network (Firebase), so only same-origin static files are cached.
const VERSION = 'kamigo-v5';
const SHELL = ['index.html', 'privacy.html', 'terms.html', 'css/styles.css', 'js/app.js', 'js/config.js', 'js/i18n.js', 'js/firebase.js', 'js/auth.js', 'js/bookings.js', 'js/catalogue.js', 'js/monitor.js', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('admin') || url.pathname.includes('provider')) return;
  // network first (so updates show immediately), fall back to cache when offline
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
