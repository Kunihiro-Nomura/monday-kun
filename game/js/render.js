// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// Canvas への 描画。ゲームのルールは いっさい 知らない。
//
// ユニットの絵は assets/units/<id>.png があれば それを使い、
// なければ 絵文字に フォールバックする（ART_SPEC.md の 26カットを 順に 差しかえていくため）。

import { TERRAIN } from './data/terrain.js';
import { UNITS } from './data/units.js';
import { hpBars, key, CAPTURE_POINTS } from './engine.js';

// ---- スプライトの読みこみ ----
// 絵が できあがった虫だけを manifest.json に 書いておき、それだけを 読みこむ。
// 絵が まだ ない虫は 絵文字のまま なので、1体ずつ 順に 差しかえていける。
// （存在しないファイルを 決め打ちで 取りにいくと、毎回 404 が 出て じゃまなので manifest 方式にした）
const sprites = new Map();

export async function loadSprites(basePath = 'assets/units') {
  let ids = [];
  try {
    const res = await fetch(`${basePath}/manifest.json`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.units)) ids = data.units.filter((id) => UNITS[id]);
    }
  } catch {
    // manifest が なくても 絵文字で 遊べる
  }

  return Promise.all(
    ids.map(
      (id) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            sprites.set(id, img);
            resolve({ id, ok: true });
          };
          img.onerror = () => {
            console.warn(`スプライトを 読みこめませんでした: ${id}.png`);
            resolve({ id, ok: false });
          };
          img.src = `${basePath}/${id}.png`;
        })
    )
  );
}

export function hasSprite(id) {
  return sprites.has(id);
}

// 戦闘シーン（battle.js）からも 同じ絵を つかうための 取り出し口
export function getSprite(id) {
  return sprites.get(id) || null;
}

export const TEAM_COLOR = {
  player: '#2f7fd8',
  enemy: '#d8452f',
  null: '#9aa0a6',
};

export const TEAM_LABEL = {
  player: 'あおチーム',
  enemy: 'あかチーム',
};

const MIN_TILE = 34;
const MAX_TILE = 76;

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.tile = 48;
    this.offset = { x: 0, y: 0 };
    this.overlay = { move: null, attack: null, selected: null, cursor: null, path: null };
    this.resize();
  }

  setGame(game) {
    this.game = game;
    this.overlay = { move: null, attack: null, selected: null, cursor: null, path: null };
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;

    const fit = Math.floor(Math.min(rect.width / this.game.width, rect.height / this.game.height));
    this.tile = Math.max(MIN_TILE, Math.min(MAX_TILE, fit));
    this.clampOffset();
  }

  clampOffset() {
    const mapW = this.game.width * this.tile;
    const mapH = this.game.height * this.tile;
    // マップが 画面より 小さいときは まんなかに おく
    this.offset.x = mapW <= this.viewW ? (this.viewW - mapW) / 2 : clamp(this.offset.x, this.viewW - mapW, 0);
    this.offset.y = mapH <= this.viewH ? (this.viewH - mapH) / 2 : clamp(this.offset.y, this.viewH - mapH, 0);
  }

  pan(dx, dy) {
    this.offset.x += dx;
    this.offset.y += dy;
    this.clampOffset();
  }

  screenToTile(sx, sy) {
    const x = Math.floor((sx - this.offset.x) / this.tile);
    const y = Math.floor((sy - this.offset.y) / this.tile);
    return this.game.inBounds(x, y) ? { x, y } : null;
  }

  tileToScreen(x, y) {
    return { x: x * this.tile + this.offset.x, y: y * this.tile + this.offset.y };
  }

  centerOn(x, y) {
    this.offset.x = this.viewW / 2 - (x + 0.5) * this.tile;
    this.offset.y = this.viewH / 2 - (y + 0.5) * this.tile;
    this.clampOffset();
  }

  draw() {
    const ctx = this.ctx;
    const g = this.game;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    ctx.fillStyle = '#1d2a1c';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        this.drawTile(x, y);
      }
    }

    this.drawOverlay();

    for (const unit of g.units) {
      if (unit.hp > 0) this.drawUnit(unit);
    }

    if (this.overlay.cursor) this.drawCursor(this.overlay.cursor);
  }

  drawTile(x, y) {
    const ctx = this.ctx;
    const g = this.game;
    const t = g.terrainAt(x, y);
    const p = g.propAt(x, y);
    const s = this.tileToScreen(x, y);
    const size = this.tile;

    if (s.x + size < 0 || s.y + size < 0 || s.x > this.viewW || s.y > this.viewH) return;

    ctx.fillStyle = t.color;
    ctx.fillRect(s.x, s.y, size, size);

    // 雑木林・岩場などは 見わけやすいよう もようを 足す
    if (g.terrainIdAt(x, y) === 'forest') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(s.x + size * 0.35, s.y + size * 0.4, size * 0.2, 0, Math.PI * 2);
      ctx.arc(s.x + size * 0.65, s.y + size * 0.62, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (g.terrainIdAt(x, y) === 'mountain') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(s.x + size * 0.5, s.y + size * 0.22);
      ctx.lineTo(s.x + size * 0.82, s.y + size * 0.78);
      ctx.lineTo(s.x + size * 0.18, s.y + size * 0.78);
      ctx.closePath();
      ctx.fill();
    }

    // 占領できる場所は もちぬしの色で ふちどる
    if (p) {
      const color = TEAM_COLOR[p.team] || TEAM_COLOR.null;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, size * 0.09);
      ctx.strokeRect(s.x + ctx.lineWidth / 2, s.y + ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = `${Math.round(size * 0.3)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const mark = t.hq ? '女' : t.produce === 'air' ? '花' : t.produce ? '巣' : '樹';
      ctx.fillText(mark, s.x + size / 2, s.y + size * 0.28);

      // 占領の しんちょく
      if (p.capturedBy && p.capture < CAPTURE_POINTS) {
        const ratio = 1 - p.capture / CAPTURE_POINTS;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(s.x + 3, s.y + size - 8, (size - 6) * ratio, 5);
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, size - 1, size - 1);
  }

  drawOverlay() {
    const ctx = this.ctx;
    if (this.overlay.move) {
      ctx.fillStyle = 'rgba(80,170,255,0.42)';
      for (const t of this.overlay.move) {
        const s = this.tileToScreen(t.x, t.y);
        ctx.fillRect(s.x, s.y, this.tile, this.tile);
      }
    }
    if (this.overlay.attack) {
      ctx.fillStyle = 'rgba(255,70,60,0.45)';
      for (const t of this.overlay.attack) {
        const s = this.tileToScreen(t.x, t.y);
        ctx.fillRect(s.x, s.y, this.tile, this.tile);
      }
    }
    if (this.overlay.selected) {
      const s = this.tileToScreen(this.overlay.selected.x, this.overlay.selected.y);
      ctx.strokeStyle = '#fff34d';
      ctx.lineWidth = 3;
      ctx.strokeRect(s.x + 2, s.y + 2, this.tile - 4, this.tile - 4);
    }
  }

  drawCursor(c) {
    const ctx = this.ctx;
    const s = this.tileToScreen(c.x, c.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, this.tile - 2, this.tile - 2);
  }

  drawUnit(unit) {
    const ctx = this.ctx;
    const spec = UNITS[unit.type];
    const s = this.tileToScreen(unit.x, unit.y);
    const size = this.tile;
    if (s.x + size < 0 || s.y + size < 0 || s.x > this.viewW || s.y > this.viewH) return;

    const pad = size * 0.1;
    const color = TEAM_COLOR[unit.team];

    ctx.fillStyle = unit.acted ? shade(color, -0.35) : color;
    roundRect(ctx, s.x + pad, s.y + pad, size - pad * 2, size - pad * 2, size * 0.18);
    ctx.fill();

    // 飛んでいる虫は うきあがって 見えるように かげをつける
    if (spec.moveType === 'air') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(s.x + size / 2, s.y + size * 0.9, size * 0.22, size * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = unit.acted ? 0.55 : 1;

    const sprite = sprites.get(unit.type);
    if (sprite) {
      // 絵は 正方形に 収まっている前提。マスの 8割の 大きさで 中央に おく。
      const draw = size * 0.8;
      ctx.drawImage(sprite, s.x + (size - draw) / 2, s.y + (size - draw) / 2, draw, draw);
    } else {
      ctx.font = `${Math.round(size * 0.5)}px system-ui, "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.icon, s.x + size / 2, s.y + size * 0.46);
    }
    ctx.globalAlpha = 1;

    const bars = hpBars(unit.hp);
    if (bars < 10) {
      const r = size * 0.17;
      const cx = s.x + size - r - 2;
      const cy = s.y + size - r - 2;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(size * 0.24)}px system-ui, sans-serif`;
      ctx.fillText(String(bars), cx, cy + 1);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (v) => Math.round(Math.max(0, Math.min(255, v + 255 * amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export { key };
