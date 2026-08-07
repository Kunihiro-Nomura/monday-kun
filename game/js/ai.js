// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 敵AI。
// Lv1（世界1〜2）: 目の前の敵を なぐる。アリは 近くの 樹液場を とりにいく。
// Lv2 以降は これを 土台に「相性のよい相手をねらう」「間接こうげきの間合い管理」を足していく。

import { key, neighbors, distance } from './engine.js';
import { UNITS, baseDamage, producibleAt } from './data/units.js';

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

    // 0. 寄生ユニットは こうげき できない。とりつくことだけを 考える
    if (g.parasiteSpec(unit)) return this.planParasite(unit, tiles);

    // いのちに かかわる 寄生（入水・体力ぎれ）を 受けたら、自陣に さがって なおす。
    // なおる道が あることを AI にも 使わせないと、寄生が 一方的な 技に なってしまう。
    if (this.level >= 2 && unit.parasite && this.isDeadly(unit)) {
      const home = this.nearestHome(unit);
      if (home) {
        const tile = this.stepToward(unit, tiles, home);
        if (tile) return { type: 'move', tile };
      }
    }

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

  // その寄生を ほうっておくと この虫は たおれるか？
  isDeadly(unit) {
    const p = unit.parasite && UNITS[unit.parasite.type].parasite;
    if (!p) return false;
    if (p.end === 'drown') return true;
    if (p.hpPerTurn && unit.parasite.turnsLeft != null) {
      return unit.hp <= p.hpPerTurn * unit.parasite.turnsLeft;
    }
    return false;
  }

  // 寄生ユニットの 行動。となりに とりつける敵が いれば とりつき、
  // いなければ いちばん おいしい えものへ 近づく。
  planParasite(unit, tiles) {
    const g = this.game;
    let best = null;
    for (const tile of tiles) {
      for (const target of g.infestTargetsFrom(unit, tile.x, tile.y)) {
        // 高い虫ほど うばう・弱らせる かちが 大きい
        const score = UNITS[target.type].cost;
        if (!best || score > best.score) best = { type: 'infest', tile, target, score };
      }
    }
    if (best) return best;

    const prey = this.bestPrey(unit);
    if (prey) {
      const tile = this.stepToward(unit, tiles, prey);
      if (tile) return { type: 'move', tile };
    }
    return { type: 'wait', tile: { x: unit.x, y: unit.y } };
  }

  // 寄生ユニットが ねらうべき えもの。
  // のっとりは 弱った虫にしか きかないので、その 条件も 見て えらぶ。
  bestPrey(unit) {
    const g = this.game;
    const p = g.parasiteSpec(unit);
    const enemies = g.units.filter((u) => u.hp > 0 && u.team !== unit.team && !u.parasite && !u.zombie);
    const ready = p.needHalfHp ? enemies.filter((u) => u.hp <= 50) : enemies;
    const list = ready.length ? ready : enemies;

    let best = null;
    let bestScore = -Infinity;
    for (const e of list) {
      const score = UNITS[e.type].cost / 1000 - distance(unit, e);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  // いちばん近い 自陣（寄生を なおせる場所）
  nearestHome(unit) {
    return this.pickNearest(unit, this.game.propsOf(this.team));
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
      // 戦闘カットインの 再生に つかうので、こうげき前の HP を おぼえておく
      report.target = action.target;
      report.hpBefore = { attacker: unit.hp, defender: action.target.hp };
      report.terrainId = g.terrainIdAt(action.target.x, action.target.y);
      report.result = g.attack(unit, action.target);
    } else if (action.type === 'infest') {
      report.target = action.target;
      report.result = g.infest(unit, action.target);
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

      const world = g.mapData.world || 99;
      const mine = g.unitsOf(this.team);
      const affordable = producibleAt(kind, world).filter((u) => u.cost <= g.funds[this.team]);
      if (!affordable.length) continue;

      const priciest = (list) => list.reduce((a, b) => (a.cost > b.cost ? a : b));
      const fighters = affordable.filter((u) => !u.parasite);
      const parasites = affordable.filter((u) => u.parasite);

      // 寄生ユニットは こうげき力が ゼロ。ねだんは 高いが「強い虫」では ない。
      // ねだん順に えらぶと ハリガネムシ(12000)を カブトムシ(7000)より 先に 買ってしまい、
      // 何も こうげき できない軍に なる。
      //
      // なので 寄生ユニットは「ぜいたく品」として あつかう。
      // 本隊が そろっていて、しかも 買っても なお 戦う虫を 1体 買えるだけの
      // お金が あるときにしか 手を出さない。回数では なく お金で 線を 引くのは、
      // 面ごとの 事情（収入・拠点の数）に ひとりでに 合うから。
      const fighterCount = mine.filter((u) => !UNITS[u.type].parasite).length;
      const hasParasite = mine.some((u) => UNITS[u.type].parasite);
      const luxury =
        !hasParasite &&
        fighterCount >= 5 &&
        parasites.length > 0 &&
        fighters.length > 0 &&
        g.funds[this.team] >= priciest(parasites).cost + priciest(fighters).cost;

      // 占領する虫が いなくなると 収入が 止まるので、そこは 最ゆうせん
      const needCapturer = mine.filter((u) => UNITS[u.type].canCapture).length < 2;
      const capturers = affordable.filter((u) => u.canCapture);

      let pick;
      if (needCapturer && capturers.length) pick = priciest(capturers);
      else if (luxury) pick = priciest(parasites);
      else if (fighters.length) pick = priciest(fighters);
      else continue; // 寄生ユニットしか 買えないなら 買わずに お金を のこす

      const unit = g.produce(base.x, base.y, pick.id, this.team);
      if (unit) made.push(unit);
    }
    return made;
  }
}
