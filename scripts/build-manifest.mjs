// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// game/assets/units/ に ある PNG から manifest.json を つくり直す。
//   node scripts/build-manifest.mjs
//
// グラフィック担当が 絵を 置くだけで ゲームに 反映されるように、
// この処理は GitHub Actions が 自動で 走らせて 結果を コミットする。
// 手で manifest.json を 編集する 必要は ない。

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const UNITS_DIR = join(ROOT, 'game/assets/units');
const MANIFEST = join(UNITS_DIR, 'manifest.json');
const ORDERS = join(ROOT, 'game/art/orders.json');

mkdirSync(UNITS_DIR, { recursive: true });

const orders = JSON.parse(readFileSync(ORDERS, 'utf8'));
const known = new Set(orders.orders.map((o) => o.id));

const found = readdirSync(UNITS_DIR)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .map((f) => f.replace(/\.png$/i, ''))
  .sort();

const units = found.filter((id) => known.has(id));
const unknown = found.filter((id) => !known.has(id));

const manifest = {
  _comment:
    'このファイルは scripts/build-manifest.mjs が自動生成します。手で編集しないでください。PNG を game/assets/units/ に置けば反映されます。',
  units,
};

const next = `${JSON.stringify(manifest, null, 2)}\n`;
const prev = existsSync(MANIFEST) ? readFileSync(MANIFEST, 'utf8') : '';

if (prev === next) {
  console.log(`manifest.json は最新です（${units.length} 体）`);
} else {
  writeFileSync(MANIFEST, next);
  console.log(`manifest.json を更新しました（${units.length} 体）: ${units.join(', ') || 'なし'}`);
}

if (unknown.length) {
  console.warn(`\n⚠ orders.json に無い ID のファイルがあります: ${unknown.join(', ')}`);
  console.warn('  ファイル名の間違いか、orders.json への追加漏れです。ゲームには読み込まれません。');
}
