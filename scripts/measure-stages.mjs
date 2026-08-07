// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// ステージの むずかしさを 数字で はかる。
//   node scripts/measure-stages.mjs          # ぜんぶ
//   node scripts/measure-stages.mjs w1s6 w1s7
//   node scripts/measure-stages.mjs --world 1
//
// 「遊んでみて 難しかった」では 80面を さばけない。
// 同じ AI どうしで 何回も 回して、決着ターン数と 勝率を 見る。
//
// 実機テストで「1面が難しすぎる」と言われたとき、この やり方で
// 平均18ターン・勝率33% という 数字が 出て、作り直す 判断が できた。

import { Game } from '../game/js/engine.js';
import { AI } from '../game/js/ai.js';
import { MAPS, getMap } from '../game/js/data/maps.js';

const RUNS = 20;
const MAX_TURNS = 60;

const args = process.argv.slice(2);
let targets = MAPS;
if (args[0] === '--world') {
  const w = Number(args[1]);
  targets = MAPS.filter((m) => m.world === w);
} else if (args.length) {
  targets = args.map((id) => {
    const m = getMap(id);
    if (!m) {
      console.error(`"${id}" という面は ありません`);
      process.exit(1);
    }
    return m;
  });
}

// 1回ぶん 回して、決着したか・何ターンかかったかを かえす
function playOnce(map) {
  const g = new Game(map);
  const red = new AI(g, map.aiLevel || 1);
  const blue = new AI(g, map.aiLevel || 1);
  blue.team = 'player';

  for (let t = 0; t < MAX_TURNS && g.status === 'playing'; t++) {
    const actor = g.turnTeam === 'enemy' ? red : blue;
    let guard = 0;
    while (actor.takeOneAction() && guard++ < 300);
    actor.produce();
    if (g.status !== 'playing') break;
    g.endTurn();
  }
  return { status: g.status, turns: g.turnCount };
}

console.log(`\n同じ強さの AI どうしで ${RUNS}回ずつ 回した けっか\n`);
console.log('面      名まえ                  決着   あお勝率  ターン(中央値/最長)  ひとこと');
console.log('─'.repeat(96));

let anyProblem = false;

for (const map of targets) {
  const results = [];
  for (let i = 0; i < RUNS; i++) results.push(playOnce(map));

  const decided = results.filter((r) => r.status !== 'playing');
  const wins = results.filter((r) => r.status === 'win').length;
  const turns = decided.map((r) => r.turns).sort((a, b) => a - b);
  const median = turns.length ? turns[Math.floor(turns.length / 2)] : null;
  const worst = turns.length ? turns[turns.length - 1] : null;

  const notes = [];
  // 世界1の 前半は 手びきの場。ここで つまずくと 先に 進めない
  const isTutorial = map.world === 1 && map.stage <= 3;
  if (decided.length < RUNS * 0.8) notes.push('決着しにくい');
  if (isTutorial && wins < RUNS * 0.9) notes.push('チュートリアルなのに 負ける');
  if (!isTutorial && (wins < RUNS * 0.25 || wins > RUNS * 0.85)) notes.push(`かたより(${Math.round((wins / RUNS) * 100)}%)`);
  // 世界1の 1〜2面は「1つだけ 教える」場なので、みじかいのが 正しい
  const meantToBeShort = map.world === 1 && map.stage <= 2;
  if (!meantToBeShort && median != null && median <= 3) notes.push('みじかすぎ');
  if (median != null && median >= 25) notes.push('ながすぎ');
  if (notes.length) anyProblem = true;

  const id = `${map.id}`.padEnd(7);
  const name = `${map.name}`.padEnd(22, '　').slice(0, 22);
  const dec = `${decided.length}/${RUNS}`.padStart(5);
  const rate = `${Math.round((wins / RUNS) * 100)}%`.padStart(7);
  const tt = `${median ?? '—'} / ${worst ?? '—'}`.padStart(17);
  console.log(`${id} ${name} ${dec} ${rate} ${tt}   ${notes.join('、')}`);
}

console.log('─'.repeat(96));
console.log(
  anyProblem
    ? '\n※ ひとこと の ついた面は 見なおす。数字は AI どうしの 目安で、人が 遊ぶと もう少し やさしくなる。\n'
    : '\nぜんぶの面が 目安の はんいに 入っている。\n'
);
