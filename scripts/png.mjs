// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// ちいさな PNG デコーダ。
// 受け入れ検査（透過・占有率・余白・色かぶり）のために 使う。
// 外部ライブラリは 使わない（グラフィック担当の環境に 何が入っているか わからないため）。
// 8ビット / 非インターレース の PNG に 対応する。

import { readFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function decodePng(path) {
  const buf = readFileSync(path);

  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('PNG ではありません');
  }

  let pos = 8;
  let ihdr = null;
  const idat = [];
  let trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  if (!ihdr) throw new Error('IHDR が ありません');

  const result = {
    width: ihdr.width,
    height: ihdr.height,
    bitDepth: ihdr.bitDepth,
    colorType: ihdr.colorType,
    // 色タイプ 4/6 は アルファつき。3（パレット）は tRNS があれば 透過できる
    hasAlphaChannel: ihdr.colorType === 4 || ihdr.colorType === 6 || (ihdr.colorType === 3 && !!trns),
    alpha: null,
    rgb: null,
    decodable: false,
  };

  // アルファの実データを 読めるのは この条件のときだけ。
  // 読めなくても「アルファチャンネルの有無」だけは 上で わかる。
  if (ihdr.bitDepth !== 8 || ihdr.interlace !== 0 || (ihdr.colorType !== 6 && ihdr.colorType !== 4)) {
    return result;
  }

  const ch = CHANNELS[ihdr.colorType];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * ch;
  const out = Buffer.alloc(stride * ihdr.height);

  // フィルタを もどす（PNG の 各行の 先頭 1バイトが フィルタ種別）
  let src = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[src++];
    const line = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const x = raw[src++];
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= ch ? prev[i - ch] : 0;

      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error(`知らないフィルタ種別: ${filter}`);
      }
      line[i] = v & 0xff;
    }
  }

  // アルファと 色を 取り出す
  const count = ihdr.width * ihdr.height;
  const alpha = new Uint8Array(count);
  const rgb = new Uint8Array(count * 3);
  const gray = ch === 2; // 色タイプ4 は グレー＋アルファ

  for (let i = 0; i < count; i++) {
    alpha[i] = out[i * ch + (ch - 1)];
    if (gray) {
      const v = out[i * ch];
      rgb[i * 3] = v;
      rgb[i * 3 + 1] = v;
      rgb[i * 3 + 2] = v;
    } else {
      rgb[i * 3] = out[i * ch];
      rgb[i * 3 + 1] = out[i * ch + 1];
      rgb[i * 3 + 2] = out[i * ch + 2];
    }
  }

  result.alpha = alpha;
  result.rgb = rgb;
  result.decodable = true;
  return result;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// 中身（不透明な部分）の 外接矩形。透明なら null。
export function contentBounds(png, threshold = 16) {
  if (!png.alpha) return null;
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.alpha[y * png.width + x] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// 中身を つながりごとに 分ける。本体から 離れた 欠片を 見つけるため。
// カブトムシに 本体と つながっていない 横線が 1本 入っていた（y=88・幅82px）。
// これが 外接矩形を ひろげ、占有率を 85% に 見せていた（虫だけなら 76%）。
export function contentBlobs(png, threshold = 16) {
  if (!png.alpha) return [];
  const { width: w, height: h, alpha } = png;
  const seen = new Uint8Array(w * h);
  const blobs = [];

  for (let start = 0; start < w * h; start++) {
    if (seen[start] || alpha[start] <= threshold) continue;
    const stack = [start];
    seen[start] = 1;
    const b = { count: 0, minX: w, minY: h, maxX: -1, maxY: -1 };

    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      b.count++;
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (!seen[k] && alpha[k] > threshold) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
    }
    b.width = b.maxX - b.minX + 1;
    b.height = b.maxY - b.minY + 1;
    blobs.push(b);
  }
  return blobs.sort((a, b) => b.count - a.count);
}

// ふちの なめらかさ。半透明の 画素が どれだけ あるかで 見る。
//
// PNG を 書き出し直すときに アルファを 2値（0か255）に つぶしてしまうことがある。
// 見た目は ギザギザに なるが、透過・大きさ・占有率・余白は すべて 通ってしまう。
// オオクワガタが これで 届いた（半透明 0画素・他は 18〜73%）。
export function edgeQuality(png, threshold = 16) {
  if (!png.alpha) return null;
  const { width: w, height: h, alpha } = png;
  const visible = (i) => alpha[i] > threshold;
  let solid = 0;
  let semi = 0;
  let edge = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!visible(i)) continue;
      if (alpha[i] < 240) semi++;
      else solid++;
      if (
        (x > 0 && !visible(i - 1)) ||
        (x < w - 1 && !visible(i + 1)) ||
        (y > 0 && !visible(i - w)) ||
        (y < h - 1 && !visible(i + w))
      ) {
        edge++;
      }
    }
  }
  if (!edge) return null;
  // ふち1画素あたり 半透明が いくつ あるか。なめらかな絵は 1.0 前後、2値化された絵は 0。
  return { solid, semi, edge, smoothness: semi / edge };
}

// 生成に つかった 背景色が 絵に 残っていないかを 見る（色かぶり／green spill）。
//
// つやのある 暗い色の 虫を 緑の 背景で 作ると、上翅に 緑が 映りこんで オリーブ色に にごる。
// カブトムシの 初回納品が これで 作り直しに なった。目で 見て 気づける 濁りでは ないので、
// 数字で 出す。
//
// 見かたは 2つ:
//   1. 背景色 そのものが 残っている（切り抜きもれ）→ 背景色に とても 近い画素がある
//   2. 絵の 広い範囲が 背景色に 寄っている（色かぶり）→ 寄った画素の 割合が 多い
//
// 「背景色への 寄りぐあい」は チャンネルの 差で 測る。緑背景なら g-max(r,b)、
// マゼンタ背景なら min(r,b)-g。カマキリのように 体そのものが 緑の 虫は
// 背景に マゼンタを 使う 決まりなので、地の色を 誤検出しない。
//
// この測り方に しているのは、「ふちの色を 内側と くらべる」やり方だと
// **濃い輪郭線を 色かぶりと まちがえる** から。輪郭は 黒に 近く（寄りぐあい≒0）、
// 赤褐色の 体（≒-59）より 数字が 高く 出てしまう。輪郭線は 仕様で 要求している
// ものなので、それを 落とす検査に しては いけない。
export function backgroundSpill(png, hex, alphaThreshold = 16) {
  if (!png.rgb || !png.alpha) return null;

  const bg = hexToRgb(hex);
  if (!bg) return null;

  // 背景色の どのチャンネルが 立っているか（#00FF00 なら 緑、#FF00FF なら 赤と青）
  const high = [];
  const low = [];
  ['r', 'g', 'b'].forEach((_, i) => (bg[i] >= 128 ? high : low).push(i));
  if (!high.length || !low.length) return null; // 白・黒の背景は この測り方が できない

  const { width, height, alpha, rgb } = png;
  const signature = (i) => {
    let hi = 255;
    let lo = 0;
    for (const c of high) hi = Math.min(hi, rgb[i * 3 + c]);
    for (const c of low) lo = Math.max(lo, rgb[i * 3 + c]);
    return hi - lo;
  };

  let visible = 0;
  let strong = 0; // 背景色 そのもの（切り抜きもれ）
  let tinted = 0; // 背景色に 寄っている（にごり）

  for (let i = 0; i < width * height; i++) {
    if (alpha[i] <= alphaThreshold) continue;
    visible++;
    const s = signature(i);
    if (s > STRONG) strong++;
    if (s >= TINTED) tinted++;
  }

  if (!visible) return null;
  return { visible, strong, tinted, tintedRatio: tinted / visible };
}

// 背景色 そのものと 言える 寄りぐあい。純粋な #00FF00 は 255。
// 100 は 「背景が 半分ほど 混ざった 画素」にあたる。
const STRONG = 100;
// 「背景色に 寄っている」と 数える 下限。
// 実際に 起きた オリーブ色の にごりは、チャンネル差で +10 ほどしか ない。
// 一方 黒に 近い 輪郭線・灰色・黄色は 0 以下なので、8 なら 巻きこまない。
const TINTED = 8;

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// テストで 検査そのものを 検査するために つかう ちいさな PNG エンコーダ。
// rgba は 画素ごとに 4バイト。8ビット RGBA・非インターレースで 書き出す。
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // フィルタなし
    Buffer.from(rgba.buffer ?? rgba, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bitDepth
  ihdr[9] = 6; // colorType RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
