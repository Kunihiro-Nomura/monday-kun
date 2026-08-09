// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 届いている スプライトを 1枚の 画像に まとめる。
//   node scripts/make-contact-sheet.mjs [出力先.png]
//
// なぜ これが 要るか。
// 機械の検査は「仕様どおりか」しか 見られない。**絵として 良いか**は 人が 見るしかない。
// 実際、カブトムシが 1482色 → 61色 に 潰れて 甲虫に 見えなくなった 差し替えが、
// 透過・大きさ・占有率・余白・色かぶり・ふちの検査を **すべて 通った**。
//
// そこで「人が 見る」を いちばん 安くする。PR ごとに この1枚を 作って
// GitHub Actions の 成果物に 置けば、開いて 見るだけで 済む。
//
// 上段: 3倍に 拡大（市松は 透過部分）。形の 崩れ・色の 潰れを 見る
// 下段: 48px と 24px（盤面の 実寸に 近い）。見分けが つくかを 見る

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { decodePng, encodePng } from './png.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const UNITS_DIR = join(ROOT, 'game/assets/units');
const orders = JSON.parse(readFileSync(join(ROOT, 'game/art/orders.json'), 'utf8'));

const out = process.argv[2] || join(ROOT, 'artifacts/contact-sheet.png');

const sprites = orders.orders
  .filter((o) => o.inGame)
  .map((o) => {
    const path = join(UNITS_DIR, `${o.id}.png`);
    return existsSync(path) ? { id: o.id, png: decodePng(path) } : null;
  })
  .filter(Boolean);

if (!sprites.length) {
  console.log('まだ 1枚も 届いていないので、一覧は つくりません');
  process.exit(0);
}

const ZOOM = 3;
const COLS = 4;
const CELL = 96 * ZOOM;
const SMALL = [48, 24];
const GAP = 6;

const rows = Math.ceil(sprites.length / COLS);
const bigH = rows * CELL;
const stripH = SMALL.reduce((a, s) => a + s + GAP, GAP);
const W = Math.max(COLS * CELL, sprites.length * (48 + GAP) + GAP);
const H = bigH + stripH;
const canvas = new Uint8Array(W * H * 4);

// 上段は 市松（透過が 見えるように）、下段は 草地の色（盤面に 近い）
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    let c;
    if (y < bigH) c = ((x >> 3) + (y >> 3)) % 2 ? [235, 235, 235] : [205, 205, 205];
    else c = [126, 150, 100];
    canvas[i] = c[0];
    canvas[i + 1] = c[1];
    canvas[i + 2] = c[2];
    canvas[i + 3] = 255;
  }
}

function blend(dx, dy, r, g, b, a) {
  if (dx < 0 || dy < 0 || dx >= W || dy >= H || a <= 0) return;
  const d = (dy * W + dx) * 4;
  canvas[d] = Math.round(r * a + canvas[d] * (1 - a));
  canvas[d + 1] = Math.round(g * a + canvas[d + 1] * (1 - a));
  canvas[d + 2] = Math.round(b * a + canvas[d + 2] * (1 - a));
}

// 上段（拡大）
sprites.forEach((s, n) => {
  const { width: w, rgb, alpha } = s.png;
  const ox = (n % COLS) * CELL;
  const oy = Math.floor(n / COLS) * CELL;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const src = Math.floor(y / ZOOM) * w + Math.floor(x / ZOOM);
      blend(ox + x, oy + y, rgb[src * 3], rgb[src * 3 + 1], rgb[src * 3 + 2], alpha[src] / 255);
    }
  }
});

// 下段（実寸に近い大きさ・面積平均で 縮小する）
let oy = bigH + GAP;
for (const size of SMALL) {
  sprites.forEach((s, n) => {
    const { width: w, height: h, rgb, alpha } = s.png;
    const ox = GAP + n * (48 + GAP) + Math.floor((48 - size) / 2);
    const step = w / size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let count = 0;
        for (let sy = Math.floor(y * step); sy < Math.ceil((y + 1) * step); sy++) {
          for (let sx = Math.floor(x * step); sx < Math.ceil((x + 1) * step); sx++) {
            if (sx >= w || sy >= h) continue;
            const src = sy * w + sx;
            const al = alpha[src] / 255;
            r += rgb[src * 3] * al;
            g += rgb[src * 3 + 1] * al;
            b += rgb[src * 3 + 2] * al;
            a += al;
            count++;
          }
        }
        if (!count || a <= 0) continue;
        blend(ox + x, oy + y, r / a, g / a, b / a, a / count);
      }
    }
  });
  oy += size + GAP;
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePng(W, H, canvas));
console.log(`一覧を つくりました: ${out}（${sprites.length}体）`);
console.log(`  上段 ${ZOOM}倍 … 形の 崩れ・色の 潰れを 見る`);
console.log(`  下段 ${SMALL.join('px / ')}px … 盤面で 見分けが つくかを 見る`);
