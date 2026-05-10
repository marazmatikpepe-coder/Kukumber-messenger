// sw.js - Service Worker для PWA
const CACHE_NAME = 'k-messenger-v1';
// Используем динамический путь к корню приложения
const APP_ROOT = '/Kukumber-messenger/';

const urlsToCache = [
    APP_ROOT,
    APP_ROOT + 'index.html',
    APP_ROOT + 'css/style.css',
    APP_ROOT + 'js/app.js',
    APP_ROOT + 'js/auth.js',
    APP_ROOT + 'js/chat.js',
    APP_ROOT + 'js/calls.js',
    APP_ROOT + 'js/upload.js',
    APP_ROOT + 'js/slices.js',
    APP_ROOT + 'js/settings.js',
    APP_ROOT + 'js/sounds.js',
    APP_ROOT + 'js/chat-profile.js',
    APP_ROOT + 'manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (const url of urlsToCache) {
                try {
                    await cache.add(url);
                } catch (err) {
                    console.log('Не удалось закэшировать:', url, err);
                }
            }
        })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => {
                return caches.match(APP_ROOT + 'index.html');
            });
        })
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
