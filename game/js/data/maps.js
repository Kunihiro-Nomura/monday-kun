// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// ステージデータ。
// 地形は 1文字 = 1マス（data/terrain.js の CHAR_TO_TERRAIN を参照）。
//   . 草はら   - けもの道   F 雑木林   M 岩場   ~ 小川   W 池
//   S 樹液場   N 巣        * 花畑     Q 女王の巣
// owners で 樹液場・巣・女王の巣 の もちぬしを 指定する（書かなければ 中立）。
//
// エンジンとデータを 分けているので、80面の 量産と 調整が しやすい。

export const MAPS = [
  {
    id: 'w1s1',
    world: 1,
    stage: 1,
    name: 'はじめての草はら',
    hint: '虫をタップすると、行けるマスが 青くなるよ。アリで 樹液場（樹）に のると 占領できる。',
    aiLevel: 1,
    startFunds: 4000,
    incomePerProperty: 1000,
    // チュートリアルなので、1ターン目に 樹液場へ とどく ところに おく。
    // 遠すぎると「動かせない」と かんちがい されてしまう（実機のフィードバックより）。
    rows: [
      '..........',
      '.Q.N......',
      '..S.......',
      '...FF.....',
      '..S....S..',
      '.....FF...',
      '.......S..',
      '......N.Q.',
      '..........',
      '..........',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 3, y: 1, team: 'enemy' },
      { x: 6, y: 7, team: 'player' },
      { x: 8, y: 7, team: 'player' },
    ],
    units: [
      { x: 6, y: 8, type: 'ant', team: 'player' },
      { x: 7, y: 8, type: 'ant', team: 'player' },
      { x: 8, y: 8, type: 'kabuto', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 3, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'kabuto', team: 'enemy' },
    ],
  },

  {
    id: 'w1s2',
    world: 1,
    stage: 2,
    name: 'クヌギの雑木林',
    hint: '雑木林（こい緑）に いると 守りが かたくなる。うまく つかおう。',
    aiLevel: 1,
    startFunds: 6000,
    incomePerProperty: 1000,
    rows: [
      '............',
      '.Q.N....S...',
      '....FF......',
      '...FFF..~~..',
      '..S..F...~..',
      '.....FF..~..',
      '..~..FF.....',
      '..~...FFF...',
      '..~.....F...',
      '...S....N.Q.',
      '............',
      '............',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 3, y: 1, team: 'enemy' },
      { x: 8, y: 9, team: 'player' },
      { x: 10, y: 9, team: 'player' },
    ],
    units: [
      { x: 8, y: 10, type: 'ant', team: 'player' },
      { x: 9, y: 10, type: 'ant', team: 'player' },
      { x: 10, y: 10, type: 'kabuto', team: 'player' },
      { x: 7, y: 9, type: 'bombardier', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 3, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'kabuto', team: 'enemy' },
      { x: 4, y: 1, type: 'bombardier', team: 'enemy' },
    ],
  },

  {
    id: 'w1s3',
    world: 1,
    stage: 3,
    name: '花畑からの ふいうち',
    hint: '花畑（ピンク）では 飛ぶ虫を つくれる。カマキリは 飛ぶ虫と たたかえるぞ。',
    aiLevel: 1,
    startFunds: 12000,
    incomePerProperty: 1000,
    rows: [
      '............',
      '.Q.N.*..S...',
      '..S.........',
      '....MM......',
      '...MMM..FF..',
      '..S...F..F..',
      '..F...F..S..',
      '..FF....MM..',
      '......MMM...',
      '...S..*.N.Q.',
      '............',
      '............',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 3, y: 1, team: 'enemy' },
      { x: 5, y: 1, team: 'enemy' },
      { x: 8, y: 9, team: 'player' },
      { x: 10, y: 9, team: 'player' },
      { x: 6, y: 9, team: 'player' },
    ],
    units: [
      { x: 8, y: 10, type: 'ant', team: 'player' },
      { x: 9, y: 10, type: 'ant', team: 'player' },
      { x: 10, y: 10, type: 'kabuto', team: 'player' },
      { x: 7, y: 10, type: 'mantis', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 3, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'kabuto', team: 'enemy' },
      { x: 4, y: 2, type: 'mantis', team: 'enemy' },
      { x: 5, y: 2, type: 'hornet', team: 'enemy' },
    ],
  },
];

export function getMap(id) {
  return MAPS.find((m) => m.id === id) || null;
}
