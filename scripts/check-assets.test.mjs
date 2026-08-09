// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 受け入れ検査そのものの テスト。
//   node scripts/check-assets.test.mjs
//
// 「落ちなかった」だけでは、検査が 効いているのか 効いていないのか 分からない。
// わざと 汚した 絵を つくって、**ちゃんと 捕まえること** を たしかめる。
// 承認ずみの kabuto.png も 一緒に 見て、通るべきものが 通ることも 押さえる。

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodePng, encodePng, backgroundSpill } from './png.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  NG  ${name}\n      ${err.message}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'konchu-art-'));
const SIZE = 96;
const GREEN = '#00FF00';
const MAGENTA = '#FF00FF';

// 虫を 1匹 描いた だけの 画像を つくる。
//   body    … 体の色
//   outline … 輪郭線の色（仕様で 濃い線を 要求している）
//   bleed   … 体の まわりに 残した 背景色（切り抜きもれ。null なら 透明）
function draw({ body, outline = [20, 16, 14], bleed = null }) {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rBody = SIZE * 0.38;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const d = Math.hypot(x - cx, y - cy);

      let color = null;
      if (d <= rBody - 2) color = body;
      else if (d <= rBody) color = outline; // 濃い輪郭線
      else if (bleed && d <= rBody + 2) color = bleed; // 抜き残した 背景

      if (color) {
        rgba[i] = color[0];
        rgba[i + 1] = color[1];
        rgba[i + 2] = color[2];
        rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

function save(name, rgba) {
  const path = join(dir, `${name}.png`);
  writeFileSync(path, encodePng(SIZE, SIZE, rgba));
  return decodePng(path);
}

console.log('\n== 色かぶりの 検出 ==');

test('きれいに 抜けた 赤褐色の 虫は 通る（カブトムシと 同じ 色みで 見る）', () => {
  const png = save('clean', draw({ body: [110, 45, 30] }));
  const spill = backgroundSpill(png, GREEN);
  assert.equal(spill.strong, 0, `背景の 残りを 誤検出した（${spill.strong}画素）`);
  assert.ok(spill.tintedRatio < 0.05, `にごりを 誤検出した（${(spill.tintedRatio * 100).toFixed(1)}%）`);
});

test('濃い輪郭線だけでは 色かぶりに ならない', () => {
  // 輪郭を 真っ黒にした もの。黒は 寄りぐあい 0 なので 巻きこんでは いけない。
  const png = save('outline', draw({ body: [110, 45, 30], outline: [0, 0, 0] }));
  const spill = backgroundSpill(png, GREEN);
  assert.ok(spill.tintedRatio < 0.05, `輪郭線を 色かぶりと 判定した（${(spill.tintedRatio * 100).toFixed(1)}%）`);
});

test('緑の背景が 抜き残っていると 捕まる', () => {
  const png = save('bleed', draw({ body: [110, 45, 30], bleed: [0, 255, 0] }));
  const spill = backgroundSpill(png, GREEN);
  assert.ok(spill.strong > 0, '抜き残した 背景を 見のがした');
});

test('体ぜんたいが オリーブ色に にごると 捕まる', () => {
  // カブトムシの 初回納品で 起きた 状態。緑が 上翅に 映りこんで 濁る。
  const png = save('olive', draw({ body: [95, 105, 45] }));
  const spill = backgroundSpill(png, GREEN);
  assert.equal(spill.strong, 0, '純粋な 背景色では ないので strong では 捕まらない はず');
  assert.ok(spill.tintedRatio > 0.3, `にごりを 見のがした（${(spill.tintedRatio * 100).toFixed(1)}%）`);
});

test('緑の虫を マゼンタ背景で 作れば 誤検出しない（カマキリ対策）', () => {
  const png = save('mantis', draw({ body: [90, 150, 60] }));
  const spill = backgroundSpill(png, MAGENTA);
  assert.equal(spill.strong, 0, '緑の 体を マゼンタの 残りと 判定した');
  assert.ok(spill.tintedRatio < 0.05, `緑の 体を にごりと 判定した（${(spill.tintedRatio * 100).toFixed(1)}%）`);
});

test('マゼンタの背景が 抜き残っていると 捕まる', () => {
  const png = save('mantis-bleed', draw({ body: [90, 150, 60], bleed: [255, 0, 255] }));
  const spill = backgroundSpill(png, MAGENTA);
  assert.ok(spill.strong > 0, '抜き残した マゼンタを 見のがした');
});

console.log('\n== 承認ずみの 絵 ==');

test('kabuto.png は 通る（通るべきものを 落とさない）', () => {
  const path = new URL('../game/assets/units/kabuto.png', import.meta.url).pathname;
  if (!existsSync(path)) {
    console.log('      （まだ 納品されていないので とばす）');
    return;
  }
  const spill = backgroundSpill(decodePng(path), GREEN);
  assert.equal(spill.strong, 0, `背景の 残りが ${spill.strong}画素`);
  assert.ok(spill.tintedRatio < 0.12, `緑寄りの画素が ${(spill.tintedRatio * 100).toFixed(1)}%`);
});

console.log('\n== けっか ==');
console.log(`  せいこう ${passed} / しっぱい ${failed}\n`);
process.exit(failed ? 1 : 0);
