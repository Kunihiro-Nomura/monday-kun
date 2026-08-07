// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// むずかしさ（PLAN.md §3.11）。
//
// 実機テストで「子どもには ちょうどよいが、大人が 遊ぶと 手ごたえが うすい」と
// 言われたのが 出どころ。かといって 数値を 上げてしまうと、いままで 遊んできた
// 子が とつぜん 勝てなくなる。そこで「はじめて」を いままでと 同じ つよさに すえおき、
// 「ふつう」だけを きびしくする。
//
// 設計の きまりごと:
//   ・数字は この表だけ。engine は「どの むずかしさか」を 知らず、
//     わたされた ばいりつを かけるだけに する
//   ・1面ごとの 手調整は しない。80面 ぜんぶに 同じ ばいりつが かかる
//   ・いじるのは あかチームの こうげき力 だけ。プレイヤー側の 数値・お金・収入は
//     さわらないので、図かんに 書いてある 数字と 手もとの お金は いつでも 正しい
//
// rank は「どちらが きびしいか」。クリア記録を 上書きするか どうかの 判断に つかう。

export const DIFFICULTIES = {
  beginner: {
    id: 'beginner',
    rank: 0,
    name: 'はじめて',
    lead: 'あそび方を おぼえる人に',
    note: 'いままでと 同じ つよさ。ゆっくり かんがえて だいじょうぶ。',
    enemyPower: 1,
  },
  normal: {
    id: 'normal',
    rank: 1,
    name: 'ふつう',
    lead: 'なれてきた人・大人に',
    note: 'あかチームの こうげきが 1わり つよい。せめられる まえに 手を うとう。',
    enemyPower: 1.1,
  },
};

export const DEFAULT_DIFFICULTY = 'beginner';

// 画面に ならべる順（やさしい → きびしい）
export const DIFFICULTY_LIST = Object.values(DIFFICULTIES).sort((a, b) => a.rank - b.rank);

// 知らない ID を わたされても 落ちないようにする。
// Safari が セーブを 消したり、むかしの セーブを 読んだりしても、
// とりあえず 遊べるほうが よい。
export function getDifficulty(id) {
  if (id && typeof id === 'object' && typeof id.enemyPower === 'number') return id;
  return DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];
}
