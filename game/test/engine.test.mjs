// エンジンの 動作かくにん。ブラウザを 立ち上げずに ルールだけを ためす。
//   node game/test/engine.test.mjs
// 80面ぶんの データを 足していくとき、マップの 書きまちがいも ここで 見つかる。

import assert from 'node:assert/strict';
import { Game, hpBars, CAPTURE_POINTS } from '../js/engine.js';
import { AI } from '../js/ai.js';
import { MAPS, getMap } from '../js/data/maps.js';
import { UNITS, DAMAGE, baseDamage } from '../js/data/units.js';
import { TERRAIN, CHAR_TO_TERRAIN } from '../js/data/terrain.js';

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

console.log('\n== データの せいごうせい ==');

test('すべてのマップが エラーなく 読みこめる', () => {
  for (const map of MAPS) new Game(map);
});

test('すべてのマップに 両チームの 女王の巣が ある', () => {
  for (const map of MAPS) {
    const g = new Game(map);
    for (const team of ['player', 'enemy']) {
      const hq = [...g.props.values()].filter((p) => g.terrainAt(p.x, p.y).hq && p.team === team);
      assert.equal(hq.length, 1, `${map.id}: ${team} の女王の巣が ${hq.length} 個`);
    }
  }
});

test('すべてのマップで 初期ユニットが 通れる地形に いる', () => {
  for (const map of MAPS) {
    const g = new Game(map);
    for (const u of g.units) {
      const cost = g.terrainAt(u.x, u.y).move[g.spec(u).moveType];
      assert.notEqual(cost, null, `${map.id}: ${UNITS[u.type].name} が (${u.x},${u.y}) の ${g.terrainAt(u.x, u.y).name} に いる`);
    }
  }
});

test('すべてのマップで 初期ユニットが かさなっていない', () => {
  for (const map of MAPS) {
    const seen = new Set();
    for (const u of map.units) {
      const k = `${u.x},${u.y}`;
      assert.ok(!seen.has(k), `${map.id}: (${k}) に ユニットが かさなっている`);
      seen.add(k);
    }
  }
});

test('攻撃力表が すべてのユニットの くみあわせを もっている', () => {
  const ids = Object.keys(UNITS);
  for (const a of ids) {
    assert.ok(DAMAGE[a], `${a} の こうげき行が ない`);
    for (const d of ids) {
      assert.equal(typeof DAMAGE[a][d], 'number', `${a} → ${d} の 数値が ない`);
    }
  }
});

test('地形の 移動コストが 全タイプぶん さだめられている', () => {
  for (const [id, t] of Object.entries(TERRAIN)) {
    for (const type of ['foot', 'ground', 'air', 'water']) {
      assert.ok(type in t.move, `地形 ${id} に ${type} の コストが ない`);
    }
  }
  for (const ch of Object.keys(CHAR_TO_TERRAIN)) {
    assert.ok(TERRAIN[CHAR_TO_TERRAIN[ch]], `文字 "${ch}" の 地形が ない`);
  }
});

test('どの飛行ユニットも 地上ユニット だけでは たおせない、ということが ない', () => {
  // 空の虫に まったく 手が出ないと ゲームが こわれる。
  // カマキリ（飛ぶ虫を つかまえる）が その 役わりを はたしているか かくにん する。
  for (const [id, u] of Object.entries(UNITS)) {
    if (u.moveType !== 'air') continue;
    const groundCounters = Object.values(UNITS).filter(
      (g) => g.moveType !== 'air' && baseDamage(g.id, id) > 0
    );
    assert.ok(groundCounters.length > 0, `${u.name} に 地上から 対こう できない`);
  }
});

test('すべての虫に 本物の 体長（bodyMm）が ついている', () => {
  // 戦闘画面の 大きさ比べは この数字だけで 決まる。
  // 実機テストで「アリより カブトムシが 小さい」と 言われたのが これの もれ。
  // 虫を 足すときは かならず 実物の 体長を 書くこと。
  for (const [id, u] of Object.entries(UNITS)) {
    assert.equal(typeof u.bodyMm, 'number', `${u.name} に bodyMm が ない`);
    assert.ok(u.bodyMm > 0 && u.bodyMm <= 200, `${id}: bodyMm ${u.bodyMm} は ありえない`);
  }
});

test('体長の 大小が 生きものとして 正しい', () => {
  // 図かんの 数字が 入れかわると、戦闘画面で アリが カブトムシより 大きく なる。
  const bigger = [
    ['kabuto', 'ant'],
    ['kuwagata', 'kabuto'],
    ['mantis', 'hornet'],
    ['dragonfly', 'ladybug'],
  ];
  for (const [big, small] of bigger) {
    assert.ok(
      UNITS[big].bodyMm > UNITS[small].bodyMm,
      `${UNITS[big].name}(${UNITS[big].bodyMm}mm) が ${UNITS[small].name}(${UNITS[small].bodyMm}mm) より 小さい`
    );
  }
});

console.log('\n== チュートリアルの やさしさ ==');
// 実機テストで「1面が難しすぎて先に進めない」と言われた。
// AI同士で戦わせたら 平均18ターン・勝率33% という、初心者向けでない難度だった。
// 同じことを くり返さないよう、やさしさを 数字で しばる。

test('1面は 敵ユニットが 1体だけ', () => {
  const m = getMap('w1s1');
  const enemies = m.units.filter((u) => u.team === 'enemy');
  assert.ok(enemies.length <= 1, `敵が ${enemies.length}体 いる`);
});

test('1面は 敵が 虫を つくれない（生産拠点を もたない）', () => {
  const g = new Game(getMap('w1s1'));
  const canProduce = g.propsOf('enemy').filter((p) => g.terrainAt(p.x, p.y).produce);
  assert.equal(canProduce.length, 0, `敵が 生産拠点を ${canProduce.length}個 もっている`);
});

test('1面・2面は 手びき（steps）が ついている', () => {
  for (const id of ['w1s1', 'w1s2']) {
    const m = getMap(id);
    assert.ok(m.steps && m.steps.length >= 3, `${id} に 手びきが ない`);
  }
});

test('1面は AI同士でも 12ターン以内に 決着する', () => {
  // プレイヤーが 何も わからなくても 短時間で 終わる、が 目安
  const results = [];
  for (let i = 0; i < 20; i++) {
    const g = new Game(getMap('w1s1'));
    const red = new AI(g, 1);
    const blue = new AI(g, 1);
    blue.team = 'player';
    for (let t = 0; t < 40 && g.status === 'playing'; t++) {
      const actor = g.turnTeam === 'enemy' ? red : blue;
      let guard = 0;
      while (actor.takeOneAction() && guard++ < 100);
      actor.produce();
      if (g.status !== 'playing') break;
      g.endTurn();
    }
    results.push(g.status === 'playing' ? Infinity : g.turnCount);
  }
  const worst = Math.max(...results);
  assert.ok(worst <= 12, `いちばん長いときで ${worst} ターン かかる`);
});

test('1面は プレイヤーが ほぼ 負けない', () => {
  let lost = 0;
  for (let i = 0; i < 20; i++) {
    const g = new Game(getMap('w1s1'));
    const red = new AI(g, 1);
    const blue = new AI(g, 1);
    blue.team = 'player';
    for (let t = 0; t < 40 && g.status === 'playing'; t++) {
      const actor = g.turnTeam === 'enemy' ? red : blue;
      let guard = 0;
      while (actor.takeOneAction() && guard++ < 100);
      actor.produce();
      if (g.status !== 'playing') break;
      g.endTurn();
    }
    if (g.status === 'lose') lost++;
  }
  assert.equal(lost, 0, `20回中 ${lost}回 負けた`);
});

console.log('\n== 移動 ==');

// 面の 並び順に たよると、面を 足したときに 壊れる。ID で 名ざしする。
const map1 = getMap('w1s3'); // 樹液場・巣・カブトムシが そろった 標準的な面

test('アリの 移動はんいが 移動力どおりに なる', () => {
  const g = new Game(map1);
  const ant = g.unitsOf('player').find((u) => u.type === 'ant');
  const tiles = g.movableTiles(ant);
  assert.ok(tiles.length > 1, '動けるマスが ない');
  for (const t of tiles) {
    assert.ok(t.cost <= UNITS.ant.move, `移動力を こえた マスが ある (cost=${t.cost})`);
  }
});

test('敵ユニットのマスには 移動できない', () => {
  const g = new Game(map1);
  const ant = g.unitsOf('player')[0];
  const enemy = g.unitsOf('enemy')[0];
  assert.equal(g.canMoveTo(ant, enemy.x, enemy.y), false);
});

test('味方のマスには 止まれない', () => {
  const g = new Game(map1);
  const [a, b] = g.unitsOf('player');
  assert.equal(g.canMoveTo(a, b.x, b.y), false);
});

test('歩く虫は 岩場に 入れるが、車りん型は 入れない', () => {
  assert.equal(TERRAIN.mountain.move.foot, 2);
  assert.equal(TERRAIN.mountain.move.ground, null);
  assert.equal(TERRAIN.mountain.move.air, 1);
});

console.log('\n== せんとう ==');

test('カブトムシは アリに 大ダメージ、アリの はんげきは 小さい', () => {
  const g = new Game(map1);
  const kabuto = g.unitsOf('player').find((u) => u.type === 'kabuto');
  const ant = g.unitsOf('enemy').find((u) => u.type === 'ant');
  const dmg = g.calcDamage(kabuto, ant, false);
  const counter = g.calcDamage(ant, kabuto, false);
  assert.ok(dmg > 40, `カブトムシ→アリ が よわすぎる (${dmg})`);
  assert.ok(counter < 10, `アリ→カブトムシ が つよすぎる (${counter})`);
});

test('HPが へると こうげき力も さがる', () => {
  const g = new Game(map1);
  const kabuto = g.unitsOf('player').find((u) => u.type === 'kabuto');
  const ant = g.unitsOf('enemy').find((u) => u.type === 'ant');
  const full = g.calcDamage(kabuto, ant, false);
  kabuto.hp = 50;
  const half = g.calcDamage(kabuto, ant, false);
  assert.ok(half < full * 0.6, `HP半分でも ダメージが へっていない (${full} → ${half})`);
});

test('まもりの かたい地形では ダメージが へる', () => {
  const g = new Game(getMap('w1s4'));
  const attacker = g.unitsOf('player').find((u) => u.type === 'kabuto');
  const defender = g.unitsOf('enemy').find((u) => u.type === 'ant');

  defender.x = 0; defender.y = 0; // 草はら（★1）
  const onPlain = g.calcDamage(attacker, defender, false);

  const forest = findTerrain(g, 'forest');
  defender.x = forest.x; defender.y = forest.y; // 雑木林（★3）
  const inForest = g.calcDamage(attacker, defender, false);

  assert.ok(inForest < onPlain, `雑木林で ダメージが へっていない (${onPlain} → ${inForest})`);
});

test('飛ぶ虫は 地形の まもりを 受けない', () => {
  const g = new Game(getMap('w1s5'));
  const mantis = g.unitsOf('player').find((u) => u.type === 'mantis');
  const hornet = g.unitsOf('enemy').find((u) => u.type === 'hornet');
  const forest = findTerrain(g, 'forest');

  hornet.x = 0; hornet.y = 0;
  const a = g.calcDamage(mantis, hornet, false);
  hornet.x = forest.x; hornet.y = forest.y;
  const b = g.calcDamage(mantis, hornet, false);
  assert.equal(a, b, '飛ぶ虫が 地形の まもりを うけてしまっている');
});

test('間接こうげきは はんげきを うけない', () => {
  const g = new Game(getMap('w1s4'));
  const bomb = g.unitsOf('player').find((u) => u.type === 'bombardier');
  const enemy = g.unitsOf('enemy').find((u) => u.type === 'ant');
  // となりに おいても、間接こうげき側は はんげきを うけない仕様
  bomb.x = enemy.x; bomb.y = enemy.y + 1;
  const before = bomb.hp;
  g.attack(bomb, enemy);
  assert.equal(bomb.hp, before, 'ミイデラゴミムシが はんげきを うけている');
});

test('間接こうげきは 動いたターンには うてない', () => {
  const g = new Game(getMap('w1s4'));
  const bomb = g.unitsOf('player').find((u) => u.type === 'bombardier');
  const enemy = g.unitsOf('enemy')[0];
  bomb.x = enemy.x; bomb.y = enemy.y + 2;
  assert.equal(g.targetsFrom(bomb, bomb.x, bomb.y, true).length, 0, '動いたのに うててしまう');
  assert.ok(g.targetsFrom(bomb, bomb.x, bomb.y, false).length > 0, '止まっているのに うてない');
});

test('アリは 空の虫を こうげき できない', () => {
  assert.equal(baseDamage('ant', 'hornet'), 0);
  assert.equal(baseDamage('kabuto', 'dragonfly'), 0);
});

test('カマキリと オニヤンマは 空の虫と たたかえる', () => {
  assert.ok(baseDamage('mantis', 'hornet') > 0);
  assert.ok(baseDamage('dragonfly', 'hornet') > 0);
});

test('HPが 0 になった虫は 盤から きえる', () => {
  const g = new Game(map1);
  const kabuto = g.unitsOf('player').find((u) => u.type === 'kabuto');
  const ant = g.unitsOf('enemy').find((u) => u.type === 'ant');
  ant.hp = 5;
  kabuto.x = ant.x; kabuto.y = ant.y + 1;
  const result = g.attack(kabuto, ant);
  assert.equal(result.defenderDied, true);
  assert.equal(g.unitAt(ant.x, ant.y), null);
});

console.log('\n== 占領・生産・ターン ==');

test('アリは 樹液場を せんりょう できる', () => {
  const g = new Game(map1);
  const ant = g.unitsOf('player').find((u) => u.type === 'ant');
  const sap = [...g.props.values()].find((p) => g.terrainIdAt(p.x, p.y) === 'sap');

  ant.x = sap.x; ant.y = sap.y;
  assert.equal(g.canCapture(ant), true);

  const first = g.capture(ant);
  assert.equal(first.captured, false, '1回で とれてしまった（HP満タンなら 2ターン かかる）');
  const second = g.capture(ant);
  assert.equal(second.captured, true, '2回で とれない');
  assert.equal(sap.team, 'player');
});

test('カブトムシは せんりょう できない', () => {
  const g = new Game(map1);
  const kabuto = g.unitsOf('player').find((u) => u.type === 'kabuto');
  const sap = [...g.props.values()].find((p) => g.terrainIdAt(p.x, p.y) === 'sap');
  kabuto.x = sap.x; kabuto.y = sap.y;
  assert.equal(g.canCapture(kabuto), false);
});

test('せんりょう とちゅうで はなれると しんちょくは 0 に もどる', () => {
  const g = new Game(map1);
  const ant = g.unitsOf('player').find((u) => u.type === 'ant');
  const sap = [...g.props.values()].find((p) => g.terrainIdAt(p.x, p.y) === 'sap');

  ant.x = sap.x; ant.y = sap.y;
  g.capture(ant);
  assert.ok(sap.capture < CAPTURE_POINTS);

  ant.x = sap.x + 1;
  g.commitUnit(ant);
  assert.equal(sap.capture, CAPTURE_POINTS, 'しんちょくが もどっていない');
});

test('巣で 虫を つくると お金が へる', () => {
  const g = new Game(map1);
  const nest = g.propsOf('player').find((p) => g.terrainIdAt(p.x, p.y) === 'nest');
  const before = g.funds.player;

  const unit = g.produce(nest.x, nest.y, 'ant', 'player');
  assert.ok(unit, '生産できなかった');
  assert.equal(g.funds.player, before - UNITS.ant.cost);
  assert.equal(unit.acted, true, 'つくった ターンに 動けてしまう');
});

test('お金が たりないと つくれない', () => {
  const g = new Game(map1);
  const nest = g.propsOf('player').find((p) => g.terrainIdAt(p.x, p.y) === 'nest');
  g.funds.player = 100;
  assert.equal(g.produce(nest.x, nest.y, 'kuwagata', 'player'), null);
});

test('巣では 飛ぶ虫を つくれない（花畑が いる）', () => {
  const g = new Game(map1);
  const nest = g.propsOf('player').find((p) => g.terrainIdAt(p.x, p.y) === 'nest');
  g.funds.player = 99999;
  assert.equal(g.produce(nest.x, nest.y, 'hornet', 'player'), null);
});

test('花畑では 飛ぶ虫を つくれる', () => {
  const g = new Game(getMap('w1s5'));
  const flower = g.propsOf('player').find((p) => g.terrainIdAt(p.x, p.y) === 'flower');
  g.funds.player = 99999;
  const unit = g.produce(flower.x, flower.y, 'dragonfly', 'player');
  assert.ok(unit, '花畑で 飛ぶ虫を つくれない');
});

test('ターンが かわると 収入が 入り、行動が リセットされる', () => {
  const g = new Game(map1);
  const props = g.propsOf('player').length;
  const before = g.funds.player;
  g.unitsOf('player').forEach((u) => (u.acted = true));

  g.endTurn(); // → enemy
  g.endTurn(); // → player
  assert.equal(g.funds.player, before + props * g.income);
  assert.ok(g.unitsOf('player').every((u) => !u.acted), '行動が リセットされていない');
});

test('自分の 陣地に いる虫は かいふく する', () => {
  const g = new Game(map1);
  const nest = g.propsOf('player').find((p) => g.terrainIdAt(p.x, p.y) === 'nest');
  const ant = g.unitsOf('player')[0];
  ant.x = nest.x; ant.y = nest.y;
  ant.hp = 40;
  g.startTurn('player');
  assert.equal(ant.hp, 60);
});

test('相手の 女王の巣を とると しょうり', () => {
  const g = new Game(map1);
  const hq = [...g.props.values()].find((p) => g.terrainAt(p.x, p.y).hq && p.team === 'enemy');
  hq.team = 'player';
  assert.equal(g.checkVictory(), 'win');
});

test('自分の 虫が いなくなると はいぼく', () => {
  const g = new Game(map1);
  g.units = g.units.filter((u) => u.team !== 'player');
  assert.equal(g.checkVictory(), 'lose');
});

console.log('\n== 敵AI ==');

test('AIは 1ターンで すべての虫を 動かす', () => {
  const g = new Game(map1);
  g.turnTeam = 'enemy';
  g.startTurn('enemy');
  const ai = new AI(g, 1);

  const count = g.unitsOf('enemy').length;
  let acted = 0;
  while (ai.takeOneAction()) acted++;
  assert.equal(acted, count, `${count}体のうち ${acted}体しか 動いていない`);
});

test('AIは お金が あれば 虫を つくる', () => {
  const g = new Game(map1);
  g.funds.enemy = 20000;
  const ai = new AI(g, 1);
  const made = ai.produce();
  assert.ok(made.length > 0, 'AIが 生産しなかった');
});

test('AIは 目の前の 弱い敵を こうげき する', () => {
  const g = new Game(map1);
  g.turnTeam = 'enemy';
  const kabuto = g.unitsOf('enemy').find((u) => u.type === 'kabuto');
  const ant = g.unitsOf('player').find((u) => u.type === 'ant');
  // 敵カブトムシの となりに プレイヤーのアリを おく
  ant.x = kabuto.x + 1;
  ant.y = kabuto.y;
  const hpBefore = ant.hp;

  g.unitsOf('enemy').forEach((u) => (u.acted = true));
  kabuto.acted = false;

  const ai = new AI(g, 1);
  ai.takeOneAction();
  assert.ok(ant.hp < hpBefore, 'AIが となりの敵を こうげき しなかった');
});

test('AI どうしで 30ターン 回しても エラーにならない', () => {
  // ぶきみな 無限ループや 例外が ないかを ざっくり かくにん する
  for (const map of MAPS) {
    const g = new Game(map);
    const red = new AI(g, map.aiLevel || 1);
    const blue = new AI(g, map.aiLevel || 1);
    blue.team = 'player';

    for (let i = 0; i < 30 && g.status === 'playing'; i++) {
      const actor = g.turnTeam === 'enemy' ? red : blue;
      let guard = 0;
      while (actor.takeOneAction() && guard++ < 100);
      actor.produce();
      if (g.status !== 'playing') break;
      g.endTurn();
    }
  }
});

console.log('\n== けっか ==');
console.log(`  せいこう ${passed} / しっぱい ${failed}\n`);
process.exit(failed ? 1 : 0);

function findTerrain(g, id) {
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (g.terrainIdAt(x, y) === id && !g.unitAt(x, y)) return { x, y };
    }
  }
  throw new Error(`地形 ${id} が マップに ない`);
}
