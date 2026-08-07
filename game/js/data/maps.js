// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// ステージデータ。
// 地形は 1文字 = 1マス（data/terrain.js の CHAR_TO_TERRAIN を参照）。
//   . 草はら   - けもの道   F 雑木林   M 岩場   ~ 小川   W 池
//   S 樹液場   N 巣        * 花畑     Q 女王の巣
// owners で 樹液場・巣・女王の巣 の もちぬしを 指定する（書かなければ 中立）。
//
// エンジンとデータを 分けているので、80面の 量産と 調整が しやすい。

// 世界の 名まえ（PLAN.md §4 の 8世界）。
// ステージ選択の 見出しに つかう。まだ 作っていない世界も 名まえだけ ここに ある。
export const WORLDS = {
  1: '草はら',
  2: '雑木林',
  3: '花畑と 大空',
  4: '里山の畑',
  5: '池と 湿地',
  6: '朽木と 地中',
  7: '熱帯の ジャングル',
  8: '女王の巣',
};

export const MAPS = [
  // ── 世界1の 前半は チュートリアル ──────────────────────────
  // 実機テストで「1面が難しすぎて先に進めない」との指摘。
  // AI同士で戦わせると平均18ターン・勝率33%という、初心者向けでない難度だった。
  // そこで 1面ずつ ひとつだけ 教える形に 作り直した。
  {
    id: 'w1s1',
    world: 1,
    stage: 1,
    name: 'うごかしてみよう',
    hint: 'アリを タップして、青いマスに 動かしてみよう。',
    aiLevel: 1,
    startFunds: 0,
    incomePerProperty: 1000,
    rows: [
      '........',
      '.Q......',
      '........',
      '........',
      '........',
      '......N.',
      '.......Q',
      '........',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 6, y: 5, team: 'player' },
      { x: 7, y: 6, team: 'player' },
    ],
    units: [
      { x: 6, y: 6, type: 'ant', team: 'player' },
      { x: 5, y: 6, type: 'kabuto', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
    ],
    // 画面に 順番に 出す みじかい 手びき
    steps: [
      { on: 'start', text: 'まずは 虫を うごかしてみよう。アリを タップ！' },
      { on: 'select', text: '青いマスに 行けるよ。行きたいマスを タップ！' },
      { on: 'action', text: '「まつ」を おすと、その虫の ばんは おわり。' },
      { on: 'wait', text: 'ぜんぶの虫を うごかしたら、右上の「ターンおわり」を おそう。' },
      { on: 'enemyTurn', text: 'あかチームの ばん。おわるまで まっててね。' },
      { on: 'playerTurn', text: 'また あおチームの ばん！ 赤い女王の巣を めざそう。' },
    ],
  },

  {
    id: 'w1s2',
    world: 1,
    stage: 2,
    name: 'せんりょう してみよう',
    hint: 'アリで 樹液場（樹）に のると、まいターン お金が もらえるよ。',
    aiLevel: 1,
    startFunds: 0,
    incomePerProperty: 1000,
    rows: [
      '.........',
      '.Q.......',
      '..S......',
      '.........',
      '....S....',
      '.........',
      '......S..',
      '.......N.',
      '........Q',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 7, y: 7, team: 'player' },
      { x: 8, y: 8, team: 'player' },
    ],
    units: [
      { x: 7, y: 8, type: 'ant', team: 'player' },
      { x: 6, y: 8, type: 'ant', team: 'player' },
      { x: 8, y: 7, type: 'kabuto', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'ant', team: 'enemy' },
    ],
    steps: [
      { on: 'start', text: '「樹」と かいてある マスが 樹液場。アリで のると せんりょう できる。' },
      { on: 'capture', text: 'せんりょう ちゅう！ もう 1ターン のっていれば 自分のものに なるよ。' },
      { on: 'captured', text: 'やった！ これで まいターン お金が もらえる。' },
    ],
  },

  {
    id: 'w1s3',
    world: 1,
    stage: 3,
    name: 'はじめての たたかい',
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
      { x: 2, y: 1, type: 'kabuto', team: 'enemy' },
    ],
  },

  {
    id: 'w1s4',
    world: 1,
    stage: 4,
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
    id: 'w1s5',
    world: 1,
    stage: 5,
    name: '花畑からの ふいうち',
    hint: '花畑（ピンク）では 飛ぶ虫を つくれる。カマキリは 飛ぶ虫と たたかえるぞ。',
    aiLevel: 1,
    // 敵は はじめから スズメバチを 持っている。
    // その ぶん、あお側に 対空の虫を すぐ つくれる お金を わたす。
    startFunds: { player: 22000, enemy: 6000 },
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
      { x: 6, y: 10, type: 'mantis', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 3, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'kabuto', team: 'enemy' },
      { x: 4, y: 2, type: 'mantis', team: 'enemy' },
      { x: 5, y: 2, type: 'hornet', team: 'enemy' },
    ],
  },

  // ── 寄生の 世界（PLAN.md §3.3 / §4）─────────────────────────
  // 世界2・3（雑木林・花畑）は これから。寄生は 計画どおり 世界4以降に おく。
  // 生産できる虫は units.js の fromWorld で きまるので、
  // ここでは world の 番号を 書くだけで 解禁が そろう。

  {
    id: 'w4s1',
    world: 4,
    stage: 1,
    name: 'はじめての 寄生',
    hint: 'コマユバチは こうげき できない。となりの敵に「とりつく」と、あいてが 弱っていくよ。',
    aiLevel: 2,
    startFunds: { player: 12000, enemy: 6000 },
    incomePerProperty: 1000,
    rows: [
      '............',
      '.Q..N...S...',
      '..S.........',
      '....FF......',
      '...FF...FF..',
      '..S....F.F..',
      '..F...F..S..',
      '..FF....FF..',
      '.....S......',
      '...S....N.Q.',
      '............',
      '............',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 4, y: 1, team: 'enemy' },
      { x: 8, y: 9, team: 'player' },
      { x: 10, y: 9, team: 'player' },
    ],
    units: [
      { x: 8, y: 10, type: 'ant', team: 'player' },
      { x: 9, y: 10, type: 'ant', team: 'player' },
      { x: 10, y: 10, type: 'kabuto', team: 'player' },
      { x: 7, y: 10, type: 'komayubachi', team: 'player' },
      { x: 6, y: 10, type: 'mantis', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'ant', team: 'enemy' },
      { x: 3, y: 2, type: 'kabuto', team: 'enemy' },
      { x: 5, y: 1, type: 'mantis', team: 'enemy' },
    ],
    steps: [
      { on: 'start', text: 'コマユバチ（🦟）を つれてきた。この虫は こうげき できないよ。' },
      { on: 'select', text: '敵の となりまで つれていこう。もろいので、カブトムシで まもってあげてね。' },
      { on: 'infest', text: 'とりついた！ あいては 毎ターン 弱っていく。じつは これ、ほんとうに ある 生き方だよ。' },
    ],
  },

  {
    id: 'w5s1',
    world: 5,
    stage: 1,
    name: '池と ハリガネムシ',
    hint: 'ハリガネムシに とりつかれた虫は、2ターン後に 水へ 歩き出して しずむ。自分の じんちで 休めば なおるよ。',
    aiLevel: 2,
    startFunds: { player: 10000, enemy: 8000 },
    incomePerProperty: 1000,
    rows: [
      '............',
      '.Q..N...S...',
      '..S.........',
      '....~~~.....',
      '...WWWW.....',
      '..S.WWW..F..',
      '..F..~~..S..',
      '..FF....FF..',
      '.....S......',
      '...S....N.Q.',
      '............',
      '............',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 4, y: 1, team: 'enemy' },
      { x: 8, y: 9, team: 'player' },
      { x: 10, y: 9, team: 'player' },
    ],
    units: [
      { x: 8, y: 10, type: 'ant', team: 'player' },
      { x: 9, y: 10, type: 'ant', team: 'player' },
      { x: 10, y: 10, type: 'kabuto', team: 'player' },
      { x: 7, y: 10, type: 'mantis', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'ant', team: 'enemy' },
      { x: 3, y: 2, type: 'kabuto', team: 'enemy' },
      { x: 5, y: 1, type: 'harigane', team: 'enemy' },
    ],
    steps: [
      { on: 'start', text: '敵に ハリガネムシ（🪱）が いる。とても おそいので、ちかづかれる前に たおそう。' },
      { on: 'enemyTurn', text: 'とりつかれたら、自分の 樹液場や 巣に もどって 休めば なおるよ。' },
    ],
  },

  {
    id: 'w6s1',
    world: 6,
    stage: 1,
    name: 'のっとりの ちから',
    hint: 'タイワンアリタケは、HPが 半分いかの 敵を 味方に できる。ただし のっとった虫は 毎ターン 弱っていく。',
    aiLevel: 2,
    startFunds: { player: 10000, enemy: 8000 },
    incomePerProperty: 1000,
    rows: [
      '.............',
      '.Q..N...S....',
      '..S..........',
      '....FF.......',
      '...FF...FF...',
      '..S....F.F.S.',
      '..F...F..S...',
      '..FF....FF...',
      '.....S.......',
      '...S....N.Q..',
      '.............',
      '.............',
    ],
    owners: [
      { x: 1, y: 1, team: 'enemy' },
      { x: 4, y: 1, team: 'enemy' },
      { x: 8, y: 9, team: 'player' },
      { x: 10, y: 9, team: 'player' },
    ],
    units: [
      { x: 8, y: 10, type: 'ant', team: 'player' },
      { x: 9, y: 10, type: 'ant', team: 'player' },
      { x: 10, y: 10, type: 'kabuto', team: 'player' },
      { x: 7, y: 10, type: 'aritake', team: 'player' },
      { x: 6, y: 10, type: 'bombardier', team: 'player' },
      { x: 5, y: 10, type: 'bombardier', team: 'player' },
      { x: 1, y: 2, type: 'ant', team: 'enemy' },
      { x: 2, y: 1, type: 'ant', team: 'enemy' },
      { x: 3, y: 2, type: 'kabuto', team: 'enemy' },
      { x: 5, y: 1, type: 'kuwagata', team: 'enemy' },
    ],
    steps: [
      { on: 'start', text: 'タイワンアリタケ（🍄）は、弱った敵を 味方に できる。まず カブトムシで 敵を けずろう。' },
      { on: 'takeover', text: 'のっとった！ でも この虫は 毎ターン 弱っていって、かならず たおれる。使いすての 切りふだだよ。' },
    ],
  },
];

export function getMap(id) {
  return MAPS.find((m) => m.id === id) || null;
}
