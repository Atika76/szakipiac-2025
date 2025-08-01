self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('szakipiac-v1').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/style.css'
      ]);
    })
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});