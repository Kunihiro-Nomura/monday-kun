// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// ホーム画面に ついかしたあと、電波がなくても あそべるようにする。
// バージョンを 上げると 古いキャッシュを すてて 入れかえる。

// ⚠ ファイルを 足したり 中身を 変えたら、かならず この数字を 上げること。
// 上げ忘れると、ホーム画面に ついかずみの 端末で 古い版が 残りつづける。
const VERSION = 'konchu-senso-v6';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/engine.js',
  './js/ai.js',
  './js/render.js',
  './js/battle.js',
  './js/data/units.js',
  './js/data/terrain.js',
  './js/data/maps.js',
  './assets/units/manifest.json',
  './assets/units/kabuto.png',
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
