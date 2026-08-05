// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 敵AI。
// Lv1（世界1〜2）: 目の前の敵を なぐる。アリは 近くの 樹液場を とりにいく。
// Lv2 以降は これを 土台に「相性のよい相手をねらう」「間接こうげきの間合い管理」を足していく。

import { key, neighbors, distance } from './engine.js';
import { UNITS, baseDamage } from './data/units.js';

export class AI {
  constructor(game, level = 1) {
    this.game = game;
    this.level = level;
    this.team = 'enemy';
  }

  // 1体ぶんの 行動を 決めて 実行する。動かす虫が なくなったら null を返す。
  // 1手ずつ 返すことで、画面側で アニメーションや 間を 入れられるようにしている。
  takeOneAction() {
    const g = this.game;
    if (g.status !== 'playing') return null;

    const unit = g.unitsOf(this.team).find((u) => !u.acted);
    if (!unit) return null;

    const action = this.planFor(unit);
    return this.execute(unit, action);
  }

  planFor(unit) {
    const g = this.game;
    const spec = g.spec(unit);
    const tiles = g.movableTiles(unit);

    // 1. こうげき できるなら いちばん とくな こうげきを する
    let best = null;
    for (const tile of tiles) {
      const hasMoved = tile.x !== unit.x || tile.y !== unit.y;
      // 移動先から こうげき できるか 調べるため、いったん 場所を かりに 動かす
      const targets = g.targetsFrom(unit, tile.x, tile.y, hasMoved);
      for (const target of targets) {
        const score = this.scoreAttack(unit, tile, target);
        if (!best || score > best.score) best = { type: 'attack', tile, target, score };
      }
    }
    if (best) return best;

    // 2. 占領できる虫（アリ・カマキリ）は 樹液場や 巣を とりにいく
    if (spec.canCapture) {
      const onProp = g.propAt(unit.x, unit.y);
      if (onProp && onProp.team !== unit.team) {
        return { type: 'capture', tile: { x: unit.x, y: unit.y } };
      }
      const goal = this.nearestCapturable(unit);
      if (goal) {
        const tile = this.stepToward(unit, tiles, goal);
        if (tile) {
          const arrived = tile.x === goal.x && tile.y === goal.y;
          return { type: arrived ? 'capture' : 'move', tile };
        }
      }
    }

    // 3. それ以外は いちばん近い敵に むかって 進む
    const prey = this.nearestEnemy(unit);
    if (prey) {
      const tile = this.stepToward(unit, tiles, prey);
      if (tile) return { type: 'move', tile };
    }

    return { type: 'wait', tile: { x: unit.x, y: unit.y } };
  }

  // こうげきの とくさ = あたえるダメージの価値 − はんげきで うける損
  scoreAttack(unit, tile, target) {
    const g = this.game;
    const expected = g.calcDamage({ ...unit, x: tile.x, y: tile.y }, target, false);
    const targetCost = UNITS[target.type].cost;
    const myCost = UNITS[unit.type].cost;

    let score = (Math.min(expected, target.hp) / 100) * targetCost;

    // とどめを さすのは とくに うれしい
    if (expected >= target.hp) score *= 1.5;

    // はんげきの 見つもり
    const dist = Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y);
    if (dist === 1 && UNITS[target.type].maxRange === 1 && baseDamage(target.type, unit.type) > 0 && expected < target.hp) {
      const survivingHp = target.hp - expected;
      const counter = g.calcDamage({ ...target, hp: survivingHp }, { ...unit, x: tile.x, y: tile.y }, false);
      score -= (Math.min(counter, unit.hp) / 100) * myCost;
    }

    // 守りの かたい地形に 立って こうげき したい
    score += g.terrainAt(tile.x, tile.y).def * 50;
    return score;
  }

  nearestCapturable(unit) {
    const g = this.game;
    const candidates = [...g.props.values()].filter((p) => {
      if (p.team === unit.team) return false;
      const occupant = g.unitAt(p.x, p.y);
      return !occupant || occupant.team === unit.team;
    });
    return this.pickNearest(unit, candidates);
  }

  nearestEnemy(unit) {
    const g = this.game;
    const enemies = g.units.filter((u) => u.hp > 0 && u.team !== unit.team);
    return this.pickNearest(unit, enemies);
  }

  pickNearest(unit, list) {
    let best = null;
    let bestD = Infinity;
    for (const c of list) {
      const d = distance(unit, c);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // ゴールに いちばん 近づける 移動先を えらぶ。
  // 岩場や 池で 行きどまりにならないよう、ゴールから ひろげた コスト地図で 判断する。
  stepToward(unit, tiles, goal) {
    const field = this.costField(unit, goal.x, goal.y);
    let best = null;
    let bestCost = Infinity;
    for (const tile of tiles) {
      const c = field.get(key(tile.x, tile.y));
      if (c == null) continue;
      // 同じ近さなら 守りの かたい地形を えらぶ
      const adjusted = c - this.game.terrainAt(tile.x, tile.y).def * 0.01;
      if (adjusted < bestCost) {
        bestCost = adjusted;
        best = tile;
      }
    }
    return best;
  }

  // ゴールから ひろげた 移動コストの地図（ユニットの じゃまは 考えない）
  costField(unit, gx, gy) {
    const g = this.game;
    const field = new Map();
    field.set(key(gx, gy), 0);
    const frontier = [{ x: gx, y: gy, cost: 0 }];

    while (frontier.length) {
      frontier.sort((a, b) => a.cost - b.cost);
      const cur = frontier.shift();
      if (field.get(key(cur.x, cur.y)) < cur.cost) continue;

      for (const [nx, ny] of neighbors(cur.x, cur.y)) {
        if (!g.inBounds(nx, ny)) continue;
        const step = g.moveCost(unit, nx, ny);
        if (!isFinite(step)) continue;
        const cost = cur.cost + step;
        const k = key(nx, ny);
        if (field.has(k) && field.get(k) <= cost) continue;
        field.set(k, cost);
        frontier.push({ x: nx, y: ny, cost });
      }
    }
    return field;
  }

  execute(unit, action) {
    const g = this.game;
    const from = { x: unit.x, y: unit.y };
    g.moveUnit(unit, action.tile.x, action.tile.y);

    const report = { unit, from, to: { x: unit.x, y: unit.y }, type: action.type, result: null };

    if (action.type === 'attack') {
      report.result = g.attack(unit, action.target);
    } else if (action.type === 'capture') {
      report.result = g.capture(unit);
    }

    if (unit.hp > 0) g.commitUnit(unit);
    return report;
  }

  // ターンの さいごに 巣と 花畑で 虫を つくる
  produce() {
    const g = this.game;
    const made = [];
    const bases = g
      .propsOf(this.team)
      .filter((p) => g.canProduceAt(p.x, p.y, this.team));

    for (const base of bases) {
      const kind = g.canProduceAt(base.x, base.y, this.team);
      if (!kind) continue;

      const affordable = Object.values(UNITS)
        .filter((u) => (u.moveType === 'air' ? 'air' : 'ground') === kind)
        .filter((u) => u.cost <= g.funds[this.team]);
      if (!affordable.length) continue;

      // お金を ためこまず、そのとき 買える中で 強い虫を えらぶ。
      // ただし 占領する虫が いなくなると こまるので、たまに アリも まぜる。
      const needCapturer = g.unitsOf(this.team).filter((u) => UNITS[u.type].canCapture).length < 2;
      const capturers = affordable.filter((u) => u.canCapture);
      let pick;
      if (needCapturer && capturers.length) {
        pick = capturers.reduce((a, b) => (a.cost > b.cost ? a : b));
      } else {
        pick = affordable.reduce((a, b) => (a.cost > b.cost ? a : b));
      }

      const unit = g.produce(base.x, base.y, pick.id, this.team);
      if (unit) made.push(unit);
    }
    return made;
  }
}
