const CACHE_NAME = 'szakipiac-v2'; // Új verziószám, hogy frissüljön

// Azok a fájlok, amik az app "burkolatát" (shell) adják
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/En/index.html',
  // A logók, amiket az oldalad használ
  'https://raw.githubusercontent.com/Atika76/szakipiac-2025/main/logo.png',
  'https://raw.githubusercontent.com/Atika76/szakipiac-2025/main/szakipiac-logo-promo.png',
  'https://raw.githubusercontent.com/Atika76/szakipiac-2025/main/szakipiac-reklam.png'
];

// Telepítés: Elmentjük az app-shellt a gyorsítótárba
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Cache megnyitva, app-shell mentése.');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

// Aktiválás: Töröljük a régi (pl. 'szakipiac-v1') cache-t
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME; // Csak a nem egyező nevű cache-t töröljük
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch (Kérés) kezelése: Ez a legfontosabb rész
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Ha a kért fájl PONTOSAN benne van a cache-ben (pl. egy kép), adjuk vissza onnan.
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Ha nincs a cache-ben, próbáljuk letölteni a hálózatról.
      return fetch(event.request).catch(error => {
        // 3. Ha a letöltés SIKERTELEN (mert offline van), ÉS
        //    ez egy NAVIGÁCIÓS kérés (linkre kattintott a felhasználó)...
        if (event.request.mode === 'navigate') {
          
          // ...akkor nem a kért linket (pl. /index.html#rolunk) próbáljuk visszaadni,
          // hanem magát az alap HTML fájlt, amiben a JavaScript fut.
          
          const url = new URL(event.request.url);
          if (url.pathname.startsWith('/En/')) {
            // Ha angol oldalt kért, az angol alap HTML-t adjuk vissza
            return caches.match('/En/index.html');
          }
          // Minden más esetben a magyar alap HTML-t adjuk vissza
          return caches.match('/index.html');
        }
        
        // Ha nem navigáció volt (pl. egy kép, amit nem cache-eltünk), akkor nincs mit tenni.
      });
    })
  );
});
