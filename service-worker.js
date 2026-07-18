const CACHE_NAME = 'szakipiac-360-v1-20260718';

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/kivitelezes-pro.html',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL_URLS).catch(() => undefined))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
  })());
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {
    payload = { body: event.data ? event.data.text() : 'Új munka érkezett.' };
  }

  const title = payload.title || 'SzakiPiac 360 Munkafigyelő';
  const options = {
    body: payload.body || 'Új munka vagy közbeszerzés érkezett.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'szakipiac-munkafigyelo',
    renotify: true,
    data: { url: payload.url || '/index.html#munkafigyelo' },
    actions: [{ action: 'open', title: 'Megnyitás' }]
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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const networkFirst = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/munkafigyelo.js') ||
    url.pathname.endsWith('/service-worker.js');

  if (networkFirst) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
