const CACHE = 'szakilead-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone()
    caches.open(CACHE).then(cache => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('/'))))
})

self.addEventListener('push', event => {
  let payload = { title: 'Új SzakiLead találat', body: 'Új munkalehetőség érkezett.', url: '/' }
  try { payload = { ...payload, ...event.data.json() } } catch { /* alapértelmezett üzenet */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icon.svg', badge: '/icon.svg', tag: payload.tag || 'new-lead',
    renotify: true, data: { url: payload.url || '/' },
    actions: [{ action: 'open', title: 'Megnyitás' }],
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action && event.action !== 'open') return
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => client.url.startsWith(self.location.origin))
    if (existing) return existing.navigate(target).then(() => existing.focus())
    return clients.openWindow(target)
  }))
})
