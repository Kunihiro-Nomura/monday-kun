// ゲームエンジン（ルールの本体）。描画や入力には いっさい さわらない純ロジック。
// こうしておくと ルールの単体テストが しやすく、80面ぶんの バランス調整も やりやすい。

import { TERRAIN, CHAR_TO_TERRAIN } from './data/terrain.js';
import { UNITS, baseDamage } from './data/units.js';

export const CAPTURE_POINTS = 20;
const MAX_HP = 100; // 内部は 100。画面には 10段階で見せる。

let nextUnitId = 1;

export function hpBars(hp100) {
  return Math.max(0, Math.ceil(hp100 / 10));
}

export class Game {
  constructor(mapData) {
    this.mapData = mapData;
    this.height = mapData.rows.length;
    this.width = mapData.rows[0].length;

    // マップの行の長さが そろっているか、知らない文字がないかを ここで はじく。
    // 80面を 手で書くので、データのミスは 早く 大きな声で 教えてもらうほうがよい。
    mapData.rows.forEach((row, y) => {
      if (row.length !== this.width) {
        throw new Error(`マップ ${mapData.id}: ${y}行目の長さが ${row.length}（期待値 ${this.width}）`);
      }
      for (const ch of row) {
        if (!CHAR_TO_TERRAIN[ch]) {
          throw new Error(`マップ ${mapData.id}: 知らない地形文字 "${ch}"`);
        }
      }
    });

    this.grid = mapData.rows.map((row) => [...row].map((ch) => CHAR_TO_TERRAIN[ch]));

    // 占領できる地形（樹液場・巣・花畑・女王の巣）の所有状況
    this.props = new Map();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (TERRAIN[this.grid[y][x]].capturable) {
          this.props.set(key(x, y), { x, y, team: null, capture: CAPTURE_POINTS, capturedBy: null });
        }
      }
    }
    (mapData.owners || []).forEach((o) => {
      const p = this.props.get(key(o.x, o.y));
      if (!p) throw new Error(`マップ ${mapData.id}: (${o.x},${o.y}) は 占領できる地形ではない`);
      p.team = o.team;
    });

    this.units = (mapData.units || []).map((u) => this.makeUnit(u.type, u.team, u.x, u.y));

    this.funds = { player: mapData.startFunds || 0, enemy: mapData.startFunds || 0 };
    this.income = mapData.incomePerProperty || 1000;
    this.turnTeam = 'player';
    this.turnCount = 1;
    this.status = 'playing'; // 'playing' | 'win' | 'lose'
    this.log = [];
  }

  makeUnit(type, team, x, y) {
    return {
      id: nextUnitId++,
      type,
      team,
      x,
      y,
      hp: MAX_HP,
      acted: false, // このターンに 行動ずみか
    };
  }

  spec(unit) {
    return UNITS[unit.type];
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  terrainAt(x, y) {
    return TERRAIN[this.grid[y][x]];
  }

  terrainIdAt(x, y) {
    return this.grid[y][x];
  }

  propAt(x, y) {
    return this.props.get(key(x, y)) || null;
  }

  unitAt(x, y) {
    return this.units.find((u) => u.x === x && u.y === y && u.hp > 0) || null;
  }

  unitsOf(team) {
    return this.units.filter((u) => u.team === team && u.hp > 0);
  }

  propsOf(team) {
    return [...this.props.values()].filter((p) => p.team === team);
  }

  moveCost(unit, x, y) {
    const cost = this.terrainAt(x, y).move[this.spec(unit).moveType];
    return cost == null ? Infinity : cost;
  }

  // 移動できるマスを ダイクストラで もとめる。
  // 敵ユニットのいるマスは 通りぬけ できない。味方のマスは 通れるが 止まれない。
  moveRange(unit) {
    const result = new Map();
    const start = key(unit.x, unit.y);
    result.set(start, { x: unit.x, y: unit.y, cost: 0, canStop: true });

    const frontier = [{ x: unit.x, y: unit.y, cost: 0 }];
    const maxMove = this.spec(unit).move;

    while (frontier.length) {
      frontier.sort((a, b) => a.cost - b.cost);
      const cur = frontier.shift();
      const curKey = key(cur.x, cur.y);
      if (result.has(curKey) && result.get(curKey).cost < cur.cost) continue;

      for (const [nx, ny] of neighbors(cur.x, cur.y)) {
        if (!this.inBounds(nx, ny)) continue;
        const step = this.moveCost(unit, nx, ny);
        if (!isFinite(step)) continue;

        const occupant = this.unitAt(nx, ny);
        if (occupant && occupant.team !== unit.team) continue; // 敵は 通りぬけ できない

        const cost = cur.cost + step;
        if (cost > maxMove) continue;

        const nKey = key(nx, ny);
        const known = result.get(nKey);
        if (known && known.cost <= cost) continue;

        result.set(nKey, {
          x: nx,
          y: ny,
          cost,
          canStop: !occupant, // 味方が いるマスには 止まれない
        });
        frontier.push({ x: nx, y: ny, cost });
      }
    }
    return result;
  }

  // 移動できて、かつ 止まれるマスだけ
  movableTiles(unit) {
    return [...this.moveRange(unit).values()].filter((t) => t.canStop);
  }

  canMoveTo(unit, x, y) {
    const t = this.moveRange(unit).get(key(x, y));
    return !!(t && t.canStop);
  }

  moveUnit(unit, x, y) {
    if (!this.canMoveTo(unit, x, y)) return false;
    unit.x = x;
    unit.y = y;
    return true;
  }

  // 行動を かくてい する。占領のとちゅうで その場所を はなれたら しんちょくは 0 にもどる。
  // 移動そのものでは まだ かくてい しないので、画面側で「もどる」（取り消し）が できる。
  commitUnit(unit) {
    for (const p of this.props.values()) {
      if (p.capturedBy === unit.id && (p.x !== unit.x || p.y !== unit.y)) {
        p.capture = CAPTURE_POINTS;
        p.capturedBy = null;
      }
    }
    unit.acted = true;
  }

  // ある地点から こうげき できる 敵ユニット一覧
  targetsFrom(unit, fromX, fromY, hasMoved) {
    const spec = this.spec(unit);
    const indirect = spec.minRange > 1;
    if (indirect && hasMoved) return []; // 間接こうげきは 動いたターンは うてない

    const out = [];
    for (const enemy of this.units) {
      if (enemy.hp <= 0 || enemy.team === unit.team) continue;
      const d = Math.abs(enemy.x - fromX) + Math.abs(enemy.y - fromY);
      if (d < spec.minRange || d > spec.maxRange) continue;
      if (baseDamage(unit.type, enemy.type) <= 0) continue;
      out.push(enemy);
    }
    return out;
  }

  // ダメージ計算（0〜100 の内部HPスケール）
  // ダメージ = 基礎いりょく × (攻撃側HPの割合) × (地形の守りによる軽減) × 小さな運
  calcDamage(attacker, defender, luck = true) {
    const base = baseDamage(attacker.type, defender.type);
    if (base <= 0) return 0;

    // 飛んでいる虫は 地形の えいきょうを 受けない
    const airborne = this.spec(defender).moveType === 'air';
    const defStars = airborne ? 0 : this.terrainAt(defender.x, defender.y).def;

    let dmg = base * (attacker.hp / MAX_HP) * (1 - defStars * 0.07);
    if (luck) dmg *= 0.9 + Math.random() * 0.2;
    return Math.max(1, Math.round(dmg));
  }

  attack(attacker, defender) {
    const spec = this.spec(attacker);
    const dmg = this.calcDamage(attacker, defender);
    defender.hp -= dmg;

    const result = { attacker, defender, damage: dmg, counter: 0, defenderDied: false, attackerDied: false };

    if (defender.hp <= 0) {
      defender.hp = 0;
      result.defenderDied = true;
      this.cancelCaptureBy(defender);
    } else if (spec.maxRange === 1 && this.spec(defender).maxRange === 1) {
      // はんげき（となりあった 直接こうげき どうしのみ）。間接こうげきは はんげきを うけない。
      const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
      if (dist === 1 && baseDamage(defender.type, attacker.type) > 0) {
        const counter = this.calcDamage(defender, attacker);
        attacker.hp -= counter;
        result.counter = counter;
        if (attacker.hp <= 0) {
          attacker.hp = 0;
          result.attackerDied = true;
          this.cancelCaptureBy(attacker);
        }
      }
    }

    this.cleanupDead();
    this.checkVictory();
    return result;
  }

  cleanupDead() {
    this.units = this.units.filter((u) => u.hp > 0);
  }

  // ---- 占領 ----

  canCapture(unit) {
    if (!this.spec(unit).canCapture) return false;
    const prop = this.propAt(unit.x, unit.y);
    return !!prop && prop.team !== unit.team;
  }

  capture(unit) {
    const prop = this.propAt(unit.x, unit.y);
    if (!prop || prop.team === unit.team) return null;

    if (prop.capturedBy !== unit.id) {
      prop.capture = CAPTURE_POINTS;
      prop.capturedBy = unit.id;
    }
    prop.capture -= hpBars(unit.hp);

    if (prop.capture <= 0) {
      prop.team = unit.team;
      prop.capture = CAPTURE_POINTS;
      prop.capturedBy = null;
      this.checkVictory();
      return { captured: true, prop };
    }
    return { captured: false, prop, remaining: prop.capture };
  }

  cancelCaptureBy(unit) {
    for (const p of this.props.values()) {
      if (p.capturedBy === unit.id) {
        p.capture = CAPTURE_POINTS;
        p.capturedBy = null;
      }
    }
  }

  // ---- 生産 ----

  canProduceAt(x, y, team) {
    const prop = this.propAt(x, y);
    if (!prop || prop.team !== team) return null;
    const kind = this.terrainAt(x, y).produce;
    if (!kind) return null;
    if (this.unitAt(x, y)) return null; // すでに 虫が 立っている
    return kind;
  }

  produce(x, y, type, team) {
    const kind = this.canProduceAt(x, y, team);
    if (!kind) return null;
    const spec = UNITS[type];
    if (!spec) return null;
    const unitKind = spec.moveType === 'air' ? 'air' : 'ground';
    if (unitKind !== kind) return null;
    if (this.funds[team] < spec.cost) return null;

    this.funds[team] -= spec.cost;
    const unit = this.makeUnit(type, team, x, y);
    unit.acted = true; // つくった ターンは まだ 動けない
    this.units.push(unit);
    return unit;
  }

  // ---- ターン ----

  endTurn() {
    this.turnTeam = this.turnTeam === 'player' ? 'enemy' : 'player';
    if (this.turnTeam === 'player') this.turnCount++;
    this.startTurn(this.turnTeam);
  }

  startTurn(team) {
    // 収入
    this.funds[team] += this.propsOf(team).length * this.income;

    // 自分の 樹液場・巣・花畑に いる虫は かいふく（樹液を すって 元気になる）
    for (const unit of this.unitsOf(team)) {
      unit.acted = false;
      const prop = this.propAt(unit.x, unit.y);
      if (prop && prop.team === team && unit.hp < MAX_HP) {
        unit.hp = Math.min(MAX_HP, unit.hp + 20);
      }
    }
  }

  hasActionsLeft(team) {
    return this.unitsOf(team).some((u) => !u.acted);
  }

  checkVictory() {
    if (this.status !== 'playing') return this.status;

    const playerHQ = [...this.props.values()].find((p) => this.terrainAt(p.x, p.y).hq && p.team === 'player');
    const enemyHQ = [...this.props.values()].find((p) => this.terrainAt(p.x, p.y).hq && p.team === 'enemy');

    if (!enemyHQ || this.unitsOf('enemy').length === 0) this.status = 'win';
    else if (!playerHQ || this.unitsOf('player').length === 0) this.status = 'lose';

    return this.status;
  }
}

// ---- ちいさな道具 ----

export function key(x, y) {
  return `${x},${y}`;
}

export function neighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
}

export function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
