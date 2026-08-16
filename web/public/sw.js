const CACHE_VERSION = 'beijing-english-v2';
const AUDIO_CACHE = 'beijing-english-audio-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) {
          return n !== CACHE_VERSION && n !== AUDIO_CACHE;
        }).map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  var url = new URL(req.url);

  // Audio files: cache-first, runtime caching
  if (url.pathname.startsWith('/audio/') && req.method === 'GET') {
    e.respondWith(
      caches.open(AUDIO_CACHE).then(function(cache) {
        return cache.match(req).then(function(cached) {
          if (cached) return cached;
          return fetch(req).then(function(resp) {
            if (resp.ok) {
              var copy = resp.clone();
              cache.put(req, copy);
            }
            return resp;
          }).catch(function() { return cached; });
        });
      })
    );
    return;
  }

  // CDN resources: cache-first (React, Babel, Tailwind)
  if (url.origin !== location.origin && req.method === 'GET') {
    e.respondWith(
      caches.open(CACHE_VERSION).then(function(cache) {
        return cache.match(req).then(function(cached) {
          if (cached) return cached;
          return fetch(req).then(function(resp) {
            if (resp.ok && resp.type === 'cors') {
              var copy = resp.clone();
              cache.put(req, copy);
            }
            return resp;
          }).catch(function() { return cached; });
        });
      })
    );
    return;
  }

  // Same-origin navigation: network-first (pick up HTML updates)
  if (req.mode === 'navigate' || (req.method === 'GET' && url.pathname.endsWith('.html'))) {
    e.respondWith(
      fetch(req).then(function(resp) {
        var copy = resp.clone();
        caches.open(CACHE_VERSION).then(function(cache) { cache.put(req, copy); });
        return resp;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Other same-origin GET: stale-while-revalidate
  if (req.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      caches.open(CACHE_VERSION).then(function(cache) {
        return cache.match(req).then(function(cached) {
          var fetchPromise = fetch(req).then(function(resp) {
            if (resp.ok) {
              var copy = resp.clone();
              cache.put(req, copy);
            }
            return resp;
          }).catch(function() { return cached; });
          return cached || fetchPromise;
        });
      })
    );
  }
});
