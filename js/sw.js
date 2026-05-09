// sw.js - простой Service Worker для PWA
self.addEventListener('fetch', (event) => {
    // Можно добавить кэширование позже, пока просто пропускаем
    event.respondWith(fetch(event.request));
});

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});
