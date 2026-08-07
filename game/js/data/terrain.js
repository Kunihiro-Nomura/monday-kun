// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 地形データ。ゲーム上の役割を、昆虫が実際にすんでいる場所に読み替えている。
// move: 移動タイプごとの移動コスト。null は通行できない。
// def:  防御星（0〜4）。高いほどダメージを受けにくい。

export const TERRAIN = {
  plain: {
    name: '草はら',
    color: '#8fc866',
    def: 1,
    move: { foot: 1, ground: 1, air: 1, water: null },
  },
  road: {
    name: 'けもの道',
    color: '#d8c9a3',
    def: 0,
    move: { foot: 1, ground: 1, air: 1, water: null },
  },
  forest: {
    name: '雑木林',
    color: '#3f8a4a',
    def: 3,
    move: { foot: 1, ground: 2, air: 1, water: null },
    note: 'クヌギの森。カブトムシやクワガタが樹液に集まる場所。かくれやすく守りが かたい。',
  },
  mountain: {
    name: '岩場',
    color: '#a08b6c',
    def: 4,
    move: { foot: 2, ground: null, air: 1, water: null },
    note: 'ごつごつした岩場。歩く虫しか登れないが、いちばん守りが かたい。',
  },
  river: {
    name: '小川',
    color: '#7fc4e8',
    def: 0,
    sinks: true, // ハリガネムシに あやつられた虫が むかう 水べ
    move: { foot: 2, ground: null, air: 1, water: 1 },
  },
  water: {
    name: '池',
    color: '#3d8fd1',
    def: 0,
    sinks: true, // ハリガネムシに あやつられた虫が むかう 水べ
    move: { foot: null, ground: null, air: 1, water: 1 },
    note: 'ゲンゴロウやタガメがすむ池。水の中を泳げる虫だけが入れる。',
  },
  sap: {
    name: '樹液場',
    color: '#c98a3c',
    def: 3,
    capturable: true,
    income: true,
    move: { foot: 1, ground: 1, air: 1, water: null },
    note: '木からしみ出た樹液に虫が集まる えさ場。とりかえすと まいターン お金が入る。',
  },
  nest: {
    name: '巣',
    color: '#9a7bd0',
    capturable: true,
    income: true,
    produce: 'ground', // 歩く虫・地上の虫を生産できる
    def: 3,
    move: { foot: 1, ground: 1, air: 1, water: null },
    note: 'なかまを うみ出すコロニー。ここで新しい虫を生産できる。',
  },
  flower: {
    name: '花畑',
    color: '#e58fc0',
    capturable: true,
    income: true,
    produce: 'air', // 飛ぶ虫を生産できる
    def: 3,
    move: { foot: 1, ground: 1, air: 1, water: null },
    note: 'ミツをすいに飛ぶ虫が集まる花畑。トンボやハチはここから飛び立つ。',
  },
  queen: {
    name: '女王の巣',
    color: '#e8d24a',
    capturable: true,
    income: true,
    hq: true,
    def: 4,
    move: { foot: 1, ground: 1, air: 1, water: null },
    note: '女王がいる いちばん大事な巣。ここを うばわれたら まけ。',
  },
};

// マップの文字 → 地形ID
export const CHAR_TO_TERRAIN = {
  '.': 'plain',
  '-': 'road',
  F: 'forest',
  M: 'mountain',
  '~': 'river',
  W: 'water',
  S: 'sap',
  N: 'nest',
  '*': 'flower',
  Q: 'queen',
};

export function terrainAt(map, x, y) {
  return TERRAIN[map.grid[y][x]];
}
