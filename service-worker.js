const CACHE_NAME = 'szakipiac-v17-munkafigyelo-force-submit-v5-20260704';

// Azok a fájlok, amik az app "burkolatát" (shell) adják
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/kivitelezes-pro.html',
  '/En/index.html',
  // A logók, amiket az oldalad használ
  'https://raw.githubusercontent.com/Atika76/szakipiac-2025/main/logo.png',
  'https://raw.githubusercontent.com/Atika76/szakipiac-2025/main/szakipiac-logo-promo.png',
  'https://raw.githubusercontent.com/Atika76/szakipiac-2025/main/szakipiac-reklam.png'
];

// Telepítés: Elmentjük az app-shellt a gyorsítótárba
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Cache megnyitva, app-shell mentése.');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// Munkafigyelő web push. A szerver csak a felhasználó által beállított
// szakma/megye/sürgősség szűrőnek megfelelő munkát küldi ide.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {
    payload = { body: event.data ? event.data.text() : 'Új munka érkezett.' };
  }

  const title = payload.title || 'SzakiPiac Munkafigyelő';
  const options = {
    body: payload.body || 'Új munka érkezett a beállított területeden.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'szakipiac-munkafigyelo',
    renotify: true,
    data: { url: payload.url || '/index.html#munkafigyelo' },
    actions: [{ action: 'open', title: 'Munka megnyitása' }]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || '/index.html#munkafigyelo', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  })());
});

// Aktiválás: Töröljük a régi (pl. 'szakipiac-v1') cache-t
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter(cacheName => cacheName !== CACHE_NAME).map(cacheName => caches.delete(cacheName)));
  })());
});

// Fetch (Kérés) kezelése: Ez a legfontosabb rész
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Fontos: az index.html és a munkafigyelo.js mindig hálózatról induljon,
  // különben a böngésző a régi gombhibás fájlt tarthatja cache-ben.
  const networkFirst = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/munkafigyelo.js') ||
    url.pathname.endsWith('/service-worker.js');

  if (networkFirst) {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (url.pathname.startsWith('/En/')) return caches.match('/En/index.html');
        return caches.match('/index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => cachedResponse || fetch(event.request))
  );
});

// nincs-talalat-lathato-visszajelzes-20260524
// munkafigyelo-force-submit-v5-20260704
