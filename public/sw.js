/* Fonctionnement hors-ligne : les fichiers de l'appli sont gardés en cache. Change VERSION à chaque mise à jour. */
const VERSION = 'stock-v24';
/* Le site publié et le site test partagent le même domaine : chaque site a son propre cache et ne supprime que les siens. */
const SCOPE = self.registration.scope;
const KEY = VERSION + '@' + SCOPE;
const IS_TEST = /-test\/$/i.test(SCOPE);
const FILES = ['./', './index.html', './manifest.webmanifest', './vendor/xlsx.full.min.js', './vendor/supabase.js', './vendor/qrcode.js', './vendor/jsQR.js', './config.js', './i18n.js', './vintage.js', './fonts/Archivo-latin.woff2', './fonts/Archivo-latin-ext.woff2', './fonts/JetBrainsMono-latin.woff2', './fonts/JetBrainsMono-latin-ext.woff2', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

/* Une nouvelle version attend que l'utilisateur touche « Mettre à jour » dans l'appli (message SKIP_WAITING). */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(KEY).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(l => (l[0] ? l[0].focus() : self.clients.openWindow('./'))));
});

/* Notification envoyée par le serveur (fonction envoyer-rappels), même appli fermée. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (er) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Max', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag }));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== KEY && (k.endsWith('@' + SCOPE) || (!IS_TEST && k.indexOf('@') < 0))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  if (fonts) {
    e.respondWith(caches.open(KEY).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  /* config.js (clés, DSN Sentry…) : le réseau d'abord, pour qu'un changement soit vu tout de suite ; le cache sert seulement hors-ligne */
  if (url.pathname.endsWith('/config.js')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).then(r => { if (r.ok) caches.open(KEY).then(c => c.put(req, r.clone())); return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok) caches.open(KEY).then(c => c.put(req, r.clone()));
      return r;
    }).catch(() => hit || caches.match('./index.html'));
    return hit || net;
  }));
});

