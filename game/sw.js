// ホーム画面に ついかしたあと、電波がなくても あそべるようにする。
// バージョンを 上げると 古いキャッシュを すてて 入れかえる。

const VERSION = 'konchu-senso-v1';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/engine.js',
  './js/ai.js',
  './js/render.js',
  './js/data/units.js',
  './js/data/terrain.js',
  './js/data/maps.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// まず ネットワーク、だめなら キャッシュ。
// 開発中に 古いファイルを つかみ続けないための じゅんばん。
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html')))
  );
});
