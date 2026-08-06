// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 戦闘カットイン（PLAN §6.4）。
//
// 大事な原則: ここでは 勝ち負けを いっさい 計算しない。
// engine.attack() が 出した けっかを 受けとって 再生するだけ。
// ルールと 演出を 分けておくと、演出を いくら 変えても ゲームが こわれない。
//
// もうひとつの ねらい: この アニメは そのまま 学習コンテンツになる。
// 「その虫が ほんとうは どうやって たたかうのか」を 見せるための ものなので、
// 動きは units.js の motion（＝実際の生態）に もとづいて 決めている。

import { UNITS } from './data/units.js';
import { TERRAIN } from './data/terrain.js';
import { hpBars } from './engine.js';

const SETTING_KEY = 'konchu-senso/battle-anim/v1';
const SEEN_KEY = 'konchu-senso/battle-seen/v1';

// 演出の ながさ（ミリ秒）。short は 見なれた 組み合わせ用。
const TIMELINE = {
  full: { wipeIn: 200, faceoff: 300, attack: 700, hit: 220, wipeOut: 300 },
  short: { wipeIn: 100, faceoff: 0, attack: 300, hit: 150, wipeOut: 150 },
};

// ---- 設定と「見たことがある組み合わせ」の記録 ----

export function getBattleMode() {
  try {
    return localStorage.getItem(SETTING_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function setBattleMode(mode) {
  try {
    localStorage.setItem(SETTING_KEY, mode);
  } catch {
    /* 保存できなくても 遊べる */
  }
}

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

let seen = loadSeen();

function markSeen(k) {
  if (seen.has(k)) return;
  seen.add(k);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* 保存できなくても 遊べる */
  }
}

// 一度でも 戦闘アニメで 見た虫は、図鑑に「たたかい方」が のる
export function hasSeenFight(unitType) {
  return [...seen].some((k) => k.startsWith(`${unitType}>`));
}

// ---- モーション（＝その虫の 本当の たたかい方） ----
//
// t は 0〜1（攻撃フェーズの しんこう度）。
// 返す値は 画面上の ずれ（マスの大きさに 対する 割合）と、当たる しゅんかん。

const MOTIONS = {
  // カブトムシ: ツノを 下に さしこんで すくい上げ、投げとばす
  charge: {
    hitAt: 0.5,
    attacker: (t) => (t < 0.5 ? { x: easeIn(t / 0.5) * 0.75, y: 0, rot: 0 } : { x: 0.75 - easeOut((t - 0.5) / 0.5) * 0.75, y: 0, rot: -0.25 * (1 - (t - 0.5) / 0.5) }),
    defender: (t) => (t < 0.5 ? { x: 0, y: 0, rot: 0 } : { x: easeOut((t - 0.5) / 0.5) * 0.5, y: -Math.sin(((t - 0.5) / 0.5) * Math.PI) * 1.1, rot: ((t - 0.5) / 0.5) * 2.2 }),
    particle: 'dust',
  },

  // クワガタ: 大アゴで はさんで 持ち上げる
  grab: {
    hitAt: 0.45,
    attacker: (t) => ({ x: t < 0.45 ? easeIn(t / 0.45) * 0.7 : 0.7 - easeOut((t - 0.45) / 0.55) * 0.7, y: 0, rot: 0 }),
    defender: (t) => (t < 0.45 ? { x: 0, y: 0, rot: 0 } : { x: 0, y: -easeOut((t - 0.45) / 0.55) * 0.45, y2: 0, rot: Math.sin((t - 0.45) * 22) * 0.12 }),
    particle: 'dust',
  },

  // カマキリ: 一しゅんで カマが しなる。0.05秒の はやさを 残像で 見せる
  slash: {
    hitAt: 0.42,
    afterimage: true,
    attacker: (t) => {
      if (t < 0.3) return { x: -easeOut(t / 0.3) * 0.16, y: 0, rot: -0.12 }; // ためる
      if (t < 0.42) return { x: -0.16 + ((t - 0.3) / 0.12) * 0.86, y: 0, rot: 0.1 }; // 一気に
      return { x: 0.7 - easeOut((t - 0.42) / 0.58) * 0.7, y: 0, rot: 0 };
    },
    defender: (t) => (t < 0.42 ? { x: 0, y: 0, rot: 0 } : { x: easeOut((t - 0.42) / 0.58) * 0.3, y: 0, rot: 0.35 }),
    particle: 'slash',
  },

  // アリ・テントウムシ: 小さく とびかかって かみつく
  bite: {
    hitAt: 0.5,
    attacker: (t) => ({ x: Math.sin(Math.min(t, 1) * Math.PI) * 0.6, y: -Math.sin(Math.min(t, 1) * Math.PI) * 0.15, rot: 0 }),
    defender: (t) => (t < 0.5 ? { x: 0, y: 0, rot: 0 } : { x: easeOut((t - 0.5) / 0.5) * 0.22, y: 0, rot: 0.15 }),
    particle: 'dust',
  },

  // ミイデラゴミムシ: その場から 高温のガスを ふき出す
  spray: {
    hitAt: 0.55,
    attacker: (t) => ({ x: t > 0.3 ? -0.12 : 0, y: 0, rot: t > 0.3 ? 0.18 : 0 }),
    defender: (t) => (t < 0.55 ? { x: 0, y: 0, rot: 0 } : { x: easeOut((t - 0.55) / 0.45) * 0.35, y: 0, rot: 0.2 }),
    particle: 'gas',
    particleFrom: 0.32,
  },

  // スズメバチ: 空へ 上がって きゅうこうか
  dive: {
    hitAt: 0.62,
    attacker: (t) => {
      if (t < 0.32) return { x: -0.1, y: -easeOut(t / 0.32) * 0.85, rot: -0.2 };
      if (t < 0.62) return { x: -0.1 + ((t - 0.32) / 0.3) * 0.85, y: -0.85 + easeIn((t - 0.32) / 0.3) * 0.85, rot: 0.35 };
      return { x: 0.75 - easeOut((t - 0.62) / 0.38) * 0.75, y: -easeOut((t - 0.62) / 0.38) * 0.3, rot: 0 };
    },
    defender: (t) => (t < 0.62 ? { x: 0, y: 0, rot: 0 } : { x: easeOut((t - 0.62) / 0.38) * 0.3, y: 0, rot: 0.25 }),
    particle: 'sting',
  },

  // オニヤンマ: 空中で あしを かごのように 広げて つかまえる
  catch: {
    hitAt: 0.45,
    attacker: (t) => ({
      x: t < 0.45 ? easeIn(t / 0.45) * 0.72 : 0.72 - easeOut((t - 0.45) / 0.55) * 0.72,
      y: -0.35 + Math.sin(t * Math.PI * 2) * 0.08,
      rot: t < 0.45 ? 0.1 : 0,
    }),
    defender: (t) => (t < 0.45 ? { x: 0, y: 0, rot: 0 } : { x: -easeOut((t - 0.45) / 0.55) * 0.2, y: -easeOut((t - 0.45) / 0.55) * 0.25, rot: -0.5 }),
    particle: 'catch',
  },
};

function motionFor(type) {
  return MOTIONS[UNITS[type]?.motion] || MOTIONS.bite;
}

const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// ---- 戦闘シーン ----

export class BattleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.skip = false;

    const requestSkip = () => {
      this.skip = true;
    };
    canvas.addEventListener('pointerdown', requestSkip);
    canvas.addEventListener('click', requestSkip);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;

    // 演出は 画面いっぱいではなく、まんなかの 帯（アリーナ）で 見せる。
    // 上下を 暗くすることで 「カットイン」らしくなり、余白も 気にならない。
    const bandH = Math.min(this.h * 0.92, Math.max(240, this.w * 0.85));
    this.band = {
      top: (this.h - bandH) / 2,
      height: bandH,
      groundY: (this.h - bandH) / 2 + bandH * 0.68,
    };
  }

  // scene = {
  //   attacker: { type, team, hpBefore, hpAfter },
  //   defender: { type, team, hpBefore, hpAfter },
  //   damage, counter, terrainId,
  // }
  async play(scene) {
    const mode = getBattleMode();
    if (mode === 'off') return;

    const key = `${scene.attacker.type}>${scene.defender.type}`;
    // 初めて見る 組み合わせは かならず フル再生（学習のため）。
    // 2回目からは 短くして テンポを 保つ。
    const isFirst = !seen.has(key);
    const style = mode === 'full' ? 'full' : mode === 'short' ? 'short' : isFirst ? 'full' : 'short';
    markSeen(key);

    this.skip = false;
    this.canvas.classList.remove('hidden');
    this.resize();

    const T = TIMELINE[style];
    const hasCounter = scene.counter > 0;
    const total =
      T.wipeIn + T.faceoff + T.attack + T.hit + (hasCounter ? T.attack + T.hit : 0) + T.wipeOut;

    this.particles = [];
    const start = performance.now();

    await new Promise((resolve) => {
      const frame = (now) => {
        const elapsed = this.skip ? total : now - start;
        this.render(scene, elapsed, T, hasCounter);
        if (elapsed >= total) {
          this.canvas.classList.add('hidden');
          resolve();
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  // 経過時間から 今どの場面かを 決めて 描く
  render(scene, elapsed, T, hasCounter) {
    const ctx = this.ctx;
    const { w, h } = this;

    // --- 場面の わりふり ---
    let phase = 'wipeIn';
    let t = 0; // その場面の しんこう度 0〜1
    let attacking = 'attacker'; // どちらが せめているか
    let cursor = elapsed;

    if (cursor < T.wipeIn) {
      phase = 'wipeIn';
      t = cursor / T.wipeIn;
    } else if ((cursor -= T.wipeIn) < T.faceoff) {
      phase = 'faceoff';
      t = T.faceoff ? cursor / T.faceoff : 1;
    } else if ((cursor -= T.faceoff) < T.attack) {
      phase = 'attack';
      t = cursor / T.attack;
    } else if ((cursor -= T.attack) < T.hit) {
      phase = 'hit';
      t = cursor / T.hit;
    } else if (hasCounter && (cursor -= T.hit) < T.attack) {
      phase = 'attack';
      attacking = 'defender';
      t = cursor / T.attack;
    } else if (hasCounter && (cursor -= T.attack) < T.hit) {
      phase = 'hit';
      attacking = 'defender';
      t = cursor / T.hit;
    } else {
      phase = 'wipeOut';
      cursor -= hasCounter ? T.hit : T.hit;
      t = clamp01(cursor / T.wipeOut);
    }

    // --- 画面ゆれ ---
    let shakeX = 0;
    let shakeY = 0;
    if (phase === 'hit') {
      const power = (1 - t) * 9;
      shakeX = (Math.random() - 0.5) * power;
      shakeY = (Math.random() - 0.5) * power;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackground(scene.terrainId);

    // 左＝いま せめている がわ、右＝うけている がわ
    const left = attacking === 'attacker' ? scene.attacker : scene.defender;
    const right = attacking === 'attacker' ? scene.defender : scene.attacker;

    const motion = motionFor(left.type);
    const groundY = this.band.groundY;
    const unitSize = Math.min(w * 0.36, this.band.height * 0.42);
    const leftX = w * 0.27;
    const rightX = w * 0.73;

    let lo = { x: 0, y: 0, rot: 0 };
    let ro = { x: 0, y: 0, rot: 0 };

    if (phase === 'attack') {
      lo = motion.attacker(t);
      ro = motion.defender(t);

      // 当たった しゅんかんに つぶを 出す
      if (t >= motion.hitAt && !this._hitDone) {
        this._hitDone = true;
        this.spawnParticles(motion.particle, rightX, groundY, unitSize);
      }
      if (t < motion.hitAt) this._hitDone = false;

      // ガスは 当たる前から ふき出しつづける
      if (motion.particle === 'gas' && t > (motion.particleFrom || 0.3) && Math.random() < 0.6) {
        this.spawnParticles('gasPuff', leftX + unitSize * 0.5, groundY, unitSize);
      }
    } else if (phase === 'hit') {
      // 当たったあとの よろけ
      ro = { x: 0.3 * (1 - t), y: 0, rot: 0.3 * (1 - t) };
    }

    // HPは 当たったあとに 減って見えるようにする
    const showResult = phase === 'hit' || phase === 'wipeOut' || (phase === 'attack' && t > motion.hitAt);
    const leftHp = attacking === 'attacker' ? scene.attacker.hpBefore : hpOf(scene.attacker, showResult);
    const rightHp = attacking === 'attacker' ? hpOf(scene.defender, showResult) : scene.defender.hpBefore;

    this.updateParticles();
    this.drawParticlesBehind();

    this.drawFighter(left, leftX + lo.x * unitSize, groundY + lo.y * unitSize, unitSize, lo.rot, false, leftHp);
    this.drawFighter(right, rightX + ro.x * unitSize, groundY + ro.y * unitSize, unitSize, ro.rot, true, rightHp);

    this.drawParticlesFront();

    // ダメージの数字
    if (phase === 'hit') {
      const dmg = attacking === 'attacker' ? scene.damage : scene.counter;
      this.drawDamage(dmg, rightX, groundY - unitSize * 0.9 - t * 26, 1 - t * 0.5);
    }

    ctx.restore();

    // --- ワイプ（帯を 上下から とじる／ひらく） ---
    if (phase === 'wipeIn' || phase === 'wipeOut') {
      const cover = phase === 'wipeIn' ? 1 - t : t;
      const half = (this.band.height / 2) * cover;
      ctx.fillStyle = '#0d150a';
      ctx.fillRect(0, this.band.top, w, half);
      ctx.fillRect(0, this.band.top + this.band.height - half, w, half);
    }

    // スキップの案内
    if (phase !== 'wipeOut') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('タップで とばす', w - 10, this.band.top + this.band.height + 10);
    }
  }

  drawBackground(terrainId) {
    const ctx = this.ctx;
    const { top, height, groundY } = this.band;

    // 盤面を うっすら 透かしながら 全体を 暗くする
    ctx.fillStyle = 'rgba(6,10,5,0.86)';
    ctx.fillRect(0, 0, this.w, this.h);

    // アリーナの帯。地形の色は「におわせる」程度に とどめ、
    // 虫（とくに 緑色の虫）が 背景に とけこまないよう しっかり 暗くする。
    const base = (TERRAIN[terrainId] || TERRAIN.plain).color;
    const sky = mix(base, '#0a1408', 0.82);
    const ground = mix(base, '#141b0e', 0.62);

    const grad = ctx.createLinearGradient(0, top, 0, top + height);
    grad.addColorStop(0, sky);
    grad.addColorStop(0.66, mix(ground, '#000000', 0.15));
    grad.addColorStop(1, mix(ground, '#000000', 0.45));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, this.w, height);

    // 中央を ほんのり 明るくする（虫に 目が いくように）
    const vig = ctx.createRadialGradient(this.w / 2, groundY - height * 0.12, 0, this.w / 2, groundY, this.w * 0.85);
    vig.addColorStop(0, 'rgba(255,255,255,0.10)');
    vig.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, top, this.w, height);

    // 地面
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, groundY + 4, this.w, top + height - groundY - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 4);
    ctx.lineTo(this.w, groundY + 4);
    ctx.stroke();

    // 帯の ふちを 光らせて カットインらしく見せる
    ctx.strokeStyle = 'rgba(245,224,122,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(this.w, top);
    ctx.moveTo(0, top + height);
    ctx.lineTo(this.w, top + height);
    ctx.stroke();
  }

  drawFighter(side, x, y, size, rot, flip, hp) {
    const ctx = this.ctx;
    const spec = UNITS[side.type];
    const groundY = this.band.groundY;

    // 虫の うしろに 暗い ぼかしを 敷く。
    // これが ないと、緑の虫（カマキリなど）が 草の背景に とけこんで 見えなくなる。
    const halo = ctx.createRadialGradient(x, y - size * 0.42, size * 0.1, x, y - size * 0.42, size * 0.72);
    halo.addColorStop(0, 'rgba(0,0,0,0.55)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y - size * 0.42, size * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, groundY + 6, size * 0.3, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y - size * 0.42);
    ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.font = `${Math.round(size)}px system-ui, "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.icon, 0, 0);
    ctx.restore();

    // 名前と HP
    const barW = size * 1.15;
    const barY = groundY + size * 0.36;
    ctx.font = `bold ${Math.round(size * 0.19)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(spec.name, x, barY);
    ctx.fillStyle = '#fff';
    ctx.fillText(spec.name, x, barY);

    const bars = Math.max(0, hpBars(hp));
    const segW = barW / 10;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i < bars ? (side.team === 'player' ? '#4fa3ff' : '#ff6b52') : 'rgba(0,0,0,0.45)';
      ctx.fillRect(x - barW / 2 + i * segW + 1, barY + 8, segW - 2, size * 0.1);
    }
  }

  drawDamage(value, x, y, alpha) {
    if (!value) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.round(Math.min(this.w, this.h) * 0.13)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#3a1200';
    ctx.strokeText(`-${value}`, x, y);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`-${value}`, x, y);
    ctx.restore();
  }

  // ---- つぶ（パーティクル） ----

  spawnParticles(kind, x, y, size) {
    const presets = {
      dust: { n: 14, color: '#d8c9a3', speed: 3.5, life: 26, r: size * 0.05, front: false },
      slash: { n: 10, color: '#ffffff', speed: 5, life: 16, r: size * 0.04, front: true },
      gas: { n: 18, color: '#f2f2f2', speed: 3, life: 30, r: size * 0.09, front: true },
      gasPuff: { n: 3, color: '#e8e8e8', speed: 2.2, life: 24, r: size * 0.08, front: true },
      sting: { n: 12, color: '#ffe27a', speed: 4.2, life: 20, r: size * 0.045, front: true },
      catch: { n: 12, color: '#bfe8ff', speed: 3.6, life: 22, r: size * 0.05, front: true },
    };
    const p = presets[kind] || presets.dust;
    for (let i = 0; i < p.n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y: y - size * 0.4,
        vx: Math.cos(a) * p.speed * (0.4 + Math.random()),
        vy: Math.sin(a) * p.speed * (0.4 + Math.random()) - 1,
        life: p.life,
        maxLife: p.life,
        r: p.r * (0.6 + Math.random() * 0.8),
        color: p.color,
        front: p.front,
      });
    }
  }

  updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawParticlesBehind() {
    this.drawParticles(false);
  }

  drawParticlesFront() {
    this.drawParticles(true);
  }

  drawParticles(front) {
    const ctx = this.ctx;
    for (const p of this.particles) {
      if (!!p.front !== front) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function hpOf(side, showResult) {
  return showResult ? side.hpAfter : side.hpBefore;
}

// 2色を まぜる。amount が 1 に 近いほど b に よる。
function mix(a, b, amount) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * amount);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
