const CACHE_VERSION = 'beijing-english-v37';
const AUDIO_CACHE = 'beijing-english-audio-v2';
const PAGE_VERSION = 'v37';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) {
        if (n !== CACHE_VERSION && n !== AUDIO_CACHE) return caches.delete(n);
      }));
    }).then(function() {
      return caches.open(CACHE_VERSION).then(function(cache) {
        return cache.addAll(APP_SHELL);
      });
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.map(function(n) {
          if (n === CACHE_VERSION || n === AUDIO_CACHE) return null;
          return caches.delete(n);
        }).filter(Boolean)
      );
    }).then(function() { return self.clients.claim(); })
  ).then(function() {
    self.clients.matchAll().then(function(clients) {
      clients.forEach(function(c) { c.postMessage({ type: 'SW_UPDATED' }); });
    });
  });
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  var url = new URL(req.url);

  // Audio files: cache-first, runtime caching
  if (url.pathname.includes('/audio/') && req.method === 'GET') {
    // Range requests (e.g. bytes=0-1 from checkAudioExists) must NOT use the cache:
    // a cached 206 partial response would corrupt full playback. Only cache full 200s.
    var hasRange = req.headers.get('range');
    if (hasRange) {
      e.respondWith(fetch(req));
      return;
    }
    e.respondWith(
      caches.open(AUDIO_CACHE).then(function(cache) {
        return cache.match(req).then(function(cached) {
          if (cached) return cached;
          return fetch(req).then(function(resp) {
            if (resp.ok && resp.status === 200) {
              var copy = resp.clone();
              cache.put(req, copy);
            }
            return resp;
          }).catch(function() {
            if (cached) return cached;
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
          });
        });
      })
    );
    return;
  }

// CDN resources: cache-first (React, Babel, Tailwind)
if (url.origin !== location.origin && req.method === 'GET') {
    // Do NOT intercept model/WASM downloads from HuggingFace mirrors —
    // transformers.js manages its own Cache API; SW interception causes
    // stale/corrupt responses and empty 503 fallbacks on failure.
    if (url.hostname.includes('hf-mirror.com') || url.hostname.includes('huggingface.co') || url.hostname.includes('huggingface.co.cn')) {
      return;
    }
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
          }).catch(function() {
            return cached || new Response('', { status: 503 });
          });
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
          // Try the exact request first, then fall back to relative index
          if (cached) return cached;
          return caches.match('./index.html').then(function(fallback) {
            return fallback || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
          });
        });
      })
    );
    return;
  }

 // Other same-origin GET: stale-while-revalidate
 if (req.method === 'GET' && url.origin === location.origin) {
    // Model files under /models/: bypass SW, let transformers.js manage its own Cache API
    // SW stale-while-revalidate returns empty 503 on timeout, corrupting large ONNX downloads
    if (url.pathname.includes('/models/') || url.pathname.includes('/wasm/')) return;
   e.respondWith(
      caches.open(CACHE_VERSION).then(function(cache) {
        return cache.match(req).then(function(cached) {
          var fetchPromise = fetch(req).then(function(resp) {
            if (resp.ok) {
              var copy = resp.clone();
              cache.put(req, copy);
            }
            return resp;
          }).catch(function() {
            return cached || new Response('', { status: 503 });
          });
          return cached || fetchPromise;
        });
      })
    );
  }

});

// Handle messages from the page (outside fetch handler)
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CHECK_VERSION') {
    var mismatch = e.data.version !== PAGE_VERSION;
    try {
      if (e.ports && e.ports[0]) e.ports[0].postMessage({ mismatch: mismatch });
      else if (e.source) e.source.postMessage({ mismatch: mismatch });
    } catch(err) {}
  }
});
