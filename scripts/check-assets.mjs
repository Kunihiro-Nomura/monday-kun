// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 納品されたスプライトの 受け入れ検査。
//   node scripts/check-assets.mjs
//
// グラフィック担当（ChatGPT / Codex）が PR を出すと GitHub Actions が これを 走らせる。
// 人が 1枚ずつ 目で 見なくても、仕様どおりかを 機械が 判定する。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  decodePng,
  contentBounds,
  backgroundSpill,
  contentBlobs,
  edgeQuality,
  haloBrightness,
  colorCount,
} from './png.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const UNITS_DIR = join(ROOT, 'game/assets/units');
const ORDERS = join(ROOT, 'game/art/orders.json');

const orders = JSON.parse(readFileSync(ORDERS, 'utf8'));
const byId = new Map(orders.orders.map((o) => [o.id, o]));
const CANVAS = orders.common.canvas;
const MIN_MARGIN = orders.common.minMargin;
const OCCUPANCY_TOLERANCE = 0.05;
// 背景色に 寄った画素が どれだけ あったら 落とすか（色かぶり）。
// 承認ずみの kabuto.png が 4.6% なので、そこから 十分に 離してある。
// 体ぜんたいが にごった 絵は 90% を こえるので、あいだは 広い。
// 見本が 1枚しか ないので、**落とす線は ゆるく、知らせる線は きびしく** している。
// まちがって 落として 納品を 止めるより、数字を 出して 人が 見るほうが 損が 小さい。
const SPILL_WARN_RATIO = 0.12;
const SPILL_FAIL_RATIO = 0.3;
// これ未満の 欠片は アンチエイリアスで ちぎれた 触角の先などなので 見のがす。
const STRAY_MIN_PIXELS = 20;
// ふち1画素あたりの 半透明の数。届いた12枚は 0.00（2値化）と 1.02〜1.96 に きれいに 割れる。
const SMOOTHNESS_MIN = 0.5;
// ふちが 本体より どれだけ 明るければ ハローと 見なすか。
// 良い12枚は -79.2〜+0.2。ハローが 付いた オオクワガタは +106.5 だった。
const HALO_LIMIT = 30;

let errors = 0;
let warnings = 0;
const lines = [];

function fail(id, msg) {
  errors++;
  lines.push(`  NG  ${id}: ${msg}`);
}
function warn(id, msg) {
  warnings++;
  lines.push(`  △   ${id}: ${msg}`);
}
function ok(id, msg) {
  lines.push(`  ok  ${id}: ${msg}`);
}

console.log('\n== スプライトの受け入れ検査 ==\n');

if (!existsSync(UNITS_DIR)) {
  console.log('  game/assets/units/ が まだ ありません（絵は 未納品）\n');
  process.exit(0);
}

const files = readdirSync(UNITS_DIR).filter((f) => f.toLowerCase().endsWith('.png'));

if (!files.length) {
  console.log('  まだ 1枚も 納品されていません（ゲームは 絵文字で 動きます）\n');
  process.exit(0);
}

for (const file of files.sort()) {
  const id = file.replace(/\.png$/i, '');
  const order = byId.get(id);
  const path = join(UNITS_DIR, file);

  if (!order) {
    warn(id, `orders.json に この ID の 発注が ありません（ファイル名の まちがい？）`);
    continue;
  }

  let png;
  try {
    png = decodePng(path);
  } catch (e) {
    fail(id, `PNG として 読めません — ${e.message}`);
    continue;
  }

  // 1. 大きさ
  if (png.width !== CANVAS || png.height !== CANVAS) {
    fail(id, `大きさが ${png.width}×${png.height}（${CANVAS}×${CANVAS} にしてください）`);
  }

  // 2. 透過（不透明だと チーム色の 台座を かくしてしまう）
  if (!png.hasAlphaChannel) {
    fail(id, '透過されていません。背景を 抜いて アルファつきの PNG にしてください');
    continue;
  }

  if (!png.decodable) {
    warn(id, `中身を 解析できない形式です（bitDepth=${png.bitDepth} colorType=${png.colorType}）。8ビットの RGBA で 書き出してください`);
    continue;
  }

  const bounds = contentBounds(png);
  if (!bounds) {
    fail(id, '中身が すべて 透明です（絵が 入っていません）');
    continue;
  }

  // 3. 四隅が 透明か（背景が 抜けているかの ざっくり判定）
  const corners = [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ];
  const opaqueCorners = corners.filter(([x, y]) => png.alpha[y * png.width + x] > 16).length;
  if (opaqueCorners > 0) {
    fail(id, `四隅のうち ${opaqueCorners}か所が 透明では ありません。背景が 残っています`);
  }

  // 4. 余白
  const margin = Math.min(
    bounds.minX / png.width,
    bounds.minY / png.height,
    (png.width - 1 - bounds.maxX) / png.width,
    (png.height - 1 - bounds.maxY) / png.height
  );
  if (margin < MIN_MARGIN - 0.001) {
    fail(id, `余白が ${(margin * 100).toFixed(1)}%（最低 ${MIN_MARGIN * 100}% 必要）。被写体を 少し 小さくしてください`);
  }

  // 5. 占有率（虫どうしの 大きさの 比率が くるわないように）
  const occupancy = Math.max(bounds.width / png.width, bounds.height / png.height);
  const diff = occupancy - order.occupancy;
  if (Math.abs(diff) > OCCUPANCY_TOLERANCE) {
    fail(
      id,
      `占有率が ${(occupancy * 100).toFixed(0)}%（指定は ${(order.occupancy * 100).toFixed(0)}%±${OCCUPANCY_TOLERANCE * 100}）。` +
        (diff > 0 ? '大きすぎます' : '小さすぎます')
    );
  }

  // 6. 色かぶり（生成に つかった 背景色が 絵に 残っていないか）
  //    カブトムシの 初回納品が これで 作り直しに なった。目で 気づきにくいので 数字で 見る。
  const bgHex = orders.common.backgrounds[order.background];
  const spill = bgHex ? backgroundSpill(png, bgHex) : null;
  if (spill) {
    const bgName = order.background === 'magenta' ? 'マゼンタ' : 'グリーン';
    const pct = (spill.tintedRatio * 100).toFixed(1);
    if (spill.strong > 0) {
      fail(
        id,
        `${bgName}の背景が ${spill.strong}画素 そのまま 残っています（切り抜きもれ）。背景を きれいに 抜いてください`
      );
    } else if (spill.tintedRatio > SPILL_FAIL_RATIO) {
      fail(
        id,
        `絵の ${pct}% が ${bgName}に にごっています（色かぶり）。` +
          '背景色の 映りこみを 取りのぞくか、生成時点で 透過PNGを 直接 出力してください'
      );
    } else if (spill.tintedRatio > SPILL_WARN_RATIO) {
      warn(id, `${bgName}寄りの画素が ${pct}% あります（色かぶりの 気配）。実物の色から ずれていないか 見てください`);
    }
  }

  // 7. 本体から 離れた 欠片
  //    細い直線は まず 書き出しの ゴミ。それ以外は 形の一部かもしれないので 人に 見せる。
  for (const b of contentBlobs(png).slice(1)) {
    if (b.count < STRAY_MIN_PIXELS) continue;
    const thin = b.height <= 2 || b.width <= 2;
    const long = Math.max(b.width, b.height) >= png.width * 0.25;
    if (thin && long) {
      fail(
        id,
        `本体から 離れた 細い線が 入っています（${b.width}×${b.height}・y=${b.minY}）。` +
          '書き出しの ゴミです。消してください'
      );
    } else {
      warn(
        id,
        `本体から 離れた 部分が あります（${b.count}画素・x=${b.minX}..${b.maxX} y=${b.minY}..${b.maxY}）。` +
          'つながっているべき形なら つなげてください'
      );
    }
  }

  // 8. ふちの なめらかさ（アルファを 2値に つぶしていないか）
  const edges = edgeQuality(png);
  if (edges && edges.smoothness < SMOOTHNESS_MIN) {
    fail(
      id,
      `ふちが ギザギザです（半透明の画素が ${edges.semi}個しか ありません）。` +
        'PNG を 書き出し直すときに 透明度が 0か100 に つぶれています。' +
        'アンチエイリアスを 残したまま 書き出してください'
    );
  }

  // 9. ふちの ハロー（明るい 光の輪）
  const halo = haloBrightness(png);
  if (halo !== null && halo > HALO_LIMIT) {
    fail(
      id,
      `ふちに 明るい 光の輪が 付いています（本体より +${halo.toFixed(0)}・上限 +${HALO_LIMIT}）。` +
        'アルファを ぼかして ふちを 足さないでください。' +
        '大きい絵から 縮小すれば、ふちは 自然に なめらかに なります'
    );
  }

  if (!lines.some((l) => l.includes(`${id}:`) && l.startsWith('  NG'))) {
    // 色数と なめらかさも 出す。落とす基準では ないが、絵が 痩せたときに 気づける。
    // （差し替えで 1482色 → 61色 に なった カブトムシは、当時 どの検査も 通った）
    ok(
      id,
      `${png.width}×${png.height} / 占有率 ${(occupancy * 100).toFixed(0)}% / 余白 ${(margin * 100).toFixed(1)}%` +
        ` / 色数 ${colorCount(png)} / なめらかさ ${edges ? edges.smoothness.toFixed(2) : '—'}`
    );
  }
}

console.log(lines.join('\n'));

// 発注ずみで まだ 届いていないもの
const missing = orders.orders.filter((o) => o.inGame && !files.some((f) => f.toLowerCase() === `${o.id}.png`));
if (missing.length) {
  console.log(`\n  まだ 届いていない（ゲームでは 絵文字を つかいます）:`);
  console.log(`    ${missing.map((o) => `${o.name}(${o.id})`).join('、')}`);
}

console.log(`\n  エラー ${errors} / 注意 ${warnings}\n`);
process.exit(errors ? 1 : 0);
