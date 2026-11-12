// SERVUS Service Worker
const CACHE_NAME = 'servus-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/style.css',
  '/src/main.js',
  '/src/api.js',
  '/src/supabase.js',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192.svg',
  '/icon-512.svg',
  '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Cache prefetch note:', err));
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Network first, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Ignore cross-origin API calls like Supabase
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler (disparado mesmo com o app/navegador fechado)
self.addEventListener('push', event => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'SERVUS - Escala da Equipe', body: event.data.text() };
    }
  }

  const title = data.title || 'SERVUS | AD Regional Bethânia';
  const options = {
    body: data.body || 'Você possui um novo lembrete de escala ou compromisso na equipe.',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    tag: data.tag || 'servus-push-alert',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Periodic background sync (executa periodicamente em segundo plano no celular)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-scales-sync' || event.tag === 'servus-scale-reminder') {
    event.waitUntil(
      self.registration.showNotification('SERVUS | Lembrete de Escala', {
        body: 'Confira suas escalas e atividades de hoje na AD Regional Bethânia.',
        icon: '/icon-192.png',
        badge: '/favicon.png',
        tag: 'servus-periodic-reminder',
        data: { url: '/' }
      })
    );
  }
});

// Message handler for triggering notifications from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

