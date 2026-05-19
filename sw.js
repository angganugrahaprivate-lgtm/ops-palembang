// ═══════════════════════════════════════════════════════════
// OPS LOG Palembang — Service Worker
// Handles: offline caching, background sync
// ═══════════════════════════════════════════════════════════

const CACHE_NAME  = 'opslog-palembang-v2';
const CACHE_URLS  = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Epilogue:wght@300;400;500;600&display=swap'
];

// ── Install: cache semua asset utama ──────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(CACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: hapus cache lama ────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network first, fallback ke cache ───────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // GAS requests: selalu network (tidak di-cache)
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ error: 'Offline — tidak bisa terhubung ke GSheet' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // Google Fonts: cache first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // App shell: network first, fallback cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached =>
        cached || caches.match('./index.html')
      ))
  );
});

// ── Push notification (opsional, untuk notif order baru) ──
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'OPS Palembang', {
      body:    data.body || 'Ada update order baru',
      icon:    './icon-192.png',
      badge:   './icon-192.png',
      vibrate: [200, 100, 200],
      data:    data.url ? { url: data.url } : {}
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.notification.data?.url) {
    e.waitUntil(clients.openWindow(e.notification.data.url));
  }
});
