// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// ちいさな PNG デコーダ。
// 受け入れ検査（透過・占有率・余白）のために アルファ値だけ 読めればよいので、
// 外部ライブラリは 使わない（グラフィック担当の環境に 何が入っているか わからないため）。
// 8ビット / 非インターレース の PNG に 対応する。

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

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

  // アルファだけ 取り出す
  const alpha = new Uint8Array(ihdr.width * ihdr.height);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = out[i * ch + (ch - 1)];
  }

  result.alpha = alpha;
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
