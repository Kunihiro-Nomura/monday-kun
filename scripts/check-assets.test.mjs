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
import {
  decodePng,
  encodePng,
  backgroundSpill,
  contentBlobs,
  edgeQuality,
  haloBrightness,
  colorCount,
} from './png.mjs';

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
//   smooth  … ふちに 半透明を 置くか（本物の絵は アンチエイリアスが かかっている）
//   stray   … 本体から 離れた 欠片 {x0,x1,y0,y1}
//   fringe  … ふちの 半透明に つかう 色（既定は 本体側の色。明るい色を 渡すと ハローに なる）
function draw({ body, outline = [20, 16, 14], bleed = null, smooth = true, stray = null, fringe = null }) {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rBody = SIZE * 0.38;
  const put = (x, y, color, a = 255) => {
    const i = (y * SIZE + x) * 4;
    rgba[i] = color[0];
    rgba[i + 1] = color[1];
    rgba[i + 2] = color[2];
    rgba[i + 3] = a;
  };

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const outer = bleed ? rBody + 2 : rBody;

      if (d <= rBody - 2) put(x, y, body);
      else if (d <= rBody) put(x, y, outline); // 濃い輪郭線
      else if (bleed && d <= rBody + 2) put(x, y, bleed); // 抜き残した 背景
      else if (smooth && d <= outer + 1.5) {
        // ふちの 1.5px を 半透明に する
        const a = Math.round(255 * Math.max(0, 1 - (d - outer) / 1.5));
        if (a > 0) put(x, y, fringe || bleed || outline, a);
      }
    }
  }

  if (stray) {
    for (let y = stray.y0; y <= stray.y1; y++) {
      for (let x = stray.x0; x <= stray.x1; x++) put(x, y, outline);
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

console.log('\n== 離れた欠片 ==');

test('ふつうの絵は かたまりが 1つ', () => {
  const png = save('one-blob', draw({ body: [110, 45, 30] }));
  const big = contentBlobs(png).filter((b) => b.count >= 20);
  assert.equal(big.length, 1, `かたまりが ${big.length} 個 見つかった`);
});

test('本体から 離れた 細い線を 見つけられる', () => {
  // カブトムシに 入っていたもの（y=88 に 幅82px の 1px 線）と 同じ形。
  const png = save('stray-line', draw({ body: [110, 45, 30], stray: { x0: 7, x1: 88, y0: 88, y1: 88 } }));
  const strays = contentBlobs(png)
    .slice(1)
    .filter((b) => b.count >= 20);
  assert.equal(strays.length, 1, '離れた線を 見のがした');
  const b = strays[0];
  assert.ok(b.height <= 2 && b.width >= SIZE * 0.25, `細い直線と 判定できない（${b.width}×${b.height}）`);
});

test('離れた線は 外接矩形を ひろげ、占有率を 大きく 見せる', () => {
  // これが カブトムシで 起きたこと。占有率だけ 見ていると 見ぬけない。
  const withLine = save('occ-with', draw({ body: [110, 45, 30], stray: { x0: 7, x1: 88, y0: 88, y1: 88 } }));
  const blobs = contentBlobs(withLine);
  const body = blobs[0];
  const all = blobs.reduce(
    (acc, b) => ({
      minX: Math.min(acc.minX, b.minX),
      maxX: Math.max(acc.maxX, b.maxX),
    }),
    { minX: SIZE, maxX: -1 }
  );
  assert.ok(all.maxX - all.minX > body.maxX - body.minX, '線が 外接矩形を ひろげていない');
});

console.log('\n== ふちの なめらかさ ==');

test('アンチエイリアスが かかった絵は 通る', () => {
  const png = save('aa', draw({ body: [110, 45, 30], smooth: true }));
  const q = edgeQuality(png);
  assert.ok(q.smoothness >= 0.5, `なめらかさ ${q.smoothness.toFixed(2)}`);
});

test('アルファが 2値に つぶれていると 捕まる', () => {
  // オオクワガタが これで 届いた。透過・大きさ・占有率・余白は すべて 通ってしまう。
  const png = save('hard', draw({ body: [110, 45, 30], smooth: false }));
  const q = edgeQuality(png);
  assert.equal(q.semi, 0, `半透明が ${q.semi}個 ある（2値化の 再現に なっていない）`);
  assert.ok(q.smoothness < 0.5, `なめらかさ ${q.smoothness.toFixed(2)}`);
});

console.log('\n== ふちの ハロー ==');

test('ふつうに 縮小した ふちは ハローに ならない', () => {
  const png = save('no-halo', draw({ body: [110, 45, 30] }));
  const halo = haloBrightness(png);
  assert.ok(halo <= 30, `本体より +${halo.toFixed(0)} 明るい`);
});

test('黒い虫に 明るい ふちを 足すと 捕まる', () => {
  // オオクワガタの 2回目の 納品が これ。ギザギザを 直そうとして
  // アルファを ぼかし、外側に 明るい 半透明が 付いた。
  const png = save('halo', draw({ body: [15, 12, 10], outline: [10, 8, 6], fringe: [235, 235, 235] }));
  const halo = haloBrightness(png);
  assert.ok(halo > 30, `ハローを 見のがした（+${halo.toFixed(0)}）`);
});

test('ギザギザの絵には ハローの 判定を かけない（半透明が 無いので）', () => {
  const png = save('hard-nohalo', draw({ body: [15, 12, 10], smooth: false }));
  assert.equal(haloBrightness(png), null, 'ふちが 無いのに 数字が 出た');
});

console.log('\n== 色数 ==');

test('見えている色だけを 数える（透明な部分は 数えない）', () => {
  // 落とす基準では ないが、絵が 痩せたときに 人が 気づくための 数字なので、
  // 数えかたが 合っていることは 押さえておく。
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  const palette = [
    [200, 10, 10],
    [10, 200, 10],
    [10, 10, 200],
  ];
  palette.forEach((c, n) => {
    for (let x = 0; x < 10; x++) {
      const i = ((5 + n) * SIZE + x) * 4;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = 255;
    }
  });
  // 透明なのに 色が 入っている画素。数に 入れては いけない。
  const ghost = (40 * SIZE + 40) * 4;
  rgba[ghost] = 255;
  rgba[ghost + 1] = 255;
  rgba[ghost + 2] = 0;
  rgba[ghost + 3] = 0;

  assert.equal(colorCount(save('palette', rgba)), 3);
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
