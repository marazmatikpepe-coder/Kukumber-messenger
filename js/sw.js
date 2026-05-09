// sw.js - Service Worker для PWA
const CACHE_NAME = 'k-messenger-v1';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/auth.js',
    './js/chat.js',
    './js/calls.js',
    './js/upload.js',
    './js/slices.js',
    './js/settings.js',
    './js/sounds.js',
    './js/chat-profile.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});
