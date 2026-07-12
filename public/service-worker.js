// service-worker.js — CampusConnect PWA: role-aware hybrid caching + background sync
const SHELL_CACHE = 'cc-shell-v6';   // App shell (HTML, CSS, JS, icons, fonts)
const POSTS_CACHE = 'cc-posts-v1';   // API GET responses (posts/channels)
const OFFLINE_QUEUE = 'cc-queue-v1'; // Reserved cache name (queue itself lives in IndexedDB)

const SHELL_ASSETS = [
  '/', '/index.html', '/app.html', '/offline.html',
  '/css/styles.css',
  '/js/app.js', '/js/api.js', '/js/login.js', '/js/sw-register.js', '/js/theme.js',
  '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css'
];

// Current user role, set at runtime via postMessage from sw-register.js.
let currentRole = 'viewer';

// ---- Install: pre-cache the app shell (Cache First targets) ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS).catch(err => {
        // Don't fail the whole install if one CDN asset is unreachable.
        console.warn('SW pre-cache partial:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: drop stale caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => ![SHELL_CACHE, POSTS_CACHE, OFFLINE_QUEUE].includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Receive role from the page ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_ROLE') {
    currentRole = event.data.role || 'viewer';
  }
});

// ---- Fetch routing ----
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle http(s). Schemes like chrome-extension: can't be stored in the
  // Cache API (put() throws), so let the browser handle them directly.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // POST /api/posts is intentionally NOT intercepted here. When offline the
  // request must fail so the page's compose handler catches it and persists the
  // payload to IndexedDB (window.CCQueue). If the SW answered with a synthetic
  // "queued" response, res.ok would be true, the page would skip queueing, and
  // the post would be silently lost. The queue is replayed by syncPendingPosts
  // (Background Sync) and/or the page's own reconnect flush.
  if (req.method !== 'GET') return; // writes: network only (page handles offline queueing)

  // Posts & channels feeds: Network First, fall back to cache.
  if (url.pathname.startsWith('/api/posts') || url.pathname.startsWith('/api/channels')) {
    event.respondWith(networkFirst(req, POSTS_CACHE));
    return;
  }

  // All other API GETs: network only (do not cache mutable/sensitive data).
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: serve cached shell, else offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then(r => r || caches.match('/offline.html'))
      )
    );
    return;
  }

  // Everything else (shell + CDN): Cache First, refresh in background.
  event.respondWith(cacheFirst(req, SHELL_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) {
    // Update in the background (don't await).
    fetch(req).then(res => {
      if (res && res.ok) caches.open(cacheName).then(c => c.put(req, res.clone()));
    }).catch(() => { });
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Graceful empty payload so the UI doesn't hard-crash offline.
    return new Response(JSON.stringify({ posts: [], channels: [], offline: true }), {
      headers: { 'Content-Type': 'application/json' }, status: 200
    });
  }
}

// ---- Offline post replay ----
// Queued offline posts are replayed entirely by the page (app.js
// maybeFlushQueue) on the `online` event and on load. That path is reliable
// across browsers and runs as a single owner, so there is no Background Sync
// `sync` handler here — having both replay the same IndexedDB queue on
// reconnect would risk publishing a post twice.

// ---- Push notifications ----
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'RVCE Connect';
  const options = {
    body: data.body || 'New announcement on RVCE Connect',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { postId: data.postId || null }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const postId = event.notification.data && event.notification.data.postId;
  const target = '/app.html' + (postId ? ('?post=' + postId) : '');
  event.waitUntil(self.clients.openWindow(target));
});
