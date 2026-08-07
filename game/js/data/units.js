// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 昆虫ユニットのデータ。
//
// 設計方針: ゲーム上の強さの数値には、かならず「本物の昆虫の特徴」という理由をつける。
// 遊んでいるうちに、なぜこの虫が強いのかが自然と身につくようにする。
// bio の内容は昆虫ずかん（学習要素）にそのまま表示する。
//
// icon の絵文字はプロトタイプ用のかりの絵。あとでドット絵に差しかえる。
//
// fromWorld: その虫を「生産できるようになる」世界。
//   ステージごとに 手で リストを 書くと 80面ぶん 破たんするので、世界の番号だけで きめる。
//   （PLAN.md §4 の 解禁表と 対応。敵として 出てくるのは これとは 別で、マップが きめる）
//
// parasite: この虫が「とりつく」ときの 効果。
//   寄生ユニットは こうげき力を いっさい 持たない。かわりに となりの敵に とりつく。
//   数値の 調整は ここだけで 完結させる（engine 側に 虫の名前を 書かない）。

export const UNITS = {
  ant: {
    id: 'ant',
    name: 'アリ',
    kana: 'アリ',
    icon: '🐜',
    role: '歩兵',
    cost: 1000,
    move: 3,
    moveType: 'foot',
    minRange: 1,
    maxRange: 1,
    canCapture: true,
    vision: 2,
    motion: 'bite', // 戦闘アニメの型（battle.js）
    bodyMm: 5, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 2〜12mm くらい（しゅるいによる）',
      where: '土の中や木の下。日本中どこにでもいる',
      food: 'あまいミツ、ほかの虫、木の実など',
      season: '春〜秋',
      fact: '自分の体重の 50倍いじょう の物を持ちあげられる とんでもない力もち。',
      why: '巣で何万びきも くらす社会性昆虫なので、安く たくさん 出せる。占領できるのはアリのなかまだけ。',
      fight: '大アゴで かみつく。なかまが 多いときは みんなで 群がって おそう。',
    },
  },

  mantis: {
    id: 'mantis',
    name: 'カマキリ',
    kana: 'カマキリ',
    icon: '🦗',
    role: '重歩兵・対空',
    cost: 3000,
    move: 3,
    moveType: 'foot',
    minRange: 1,
    maxRange: 1,
    canCapture: true,
    vision: 2,
    motion: 'slash', // 戦闘アニメの型（battle.js）
    bodyMm: 80, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 7〜9cm くらい（オオカマキリ）',
      where: '草はらや やぶ。えものを じっと まちぶせする',
      food: 'バッタ、チョウ、ハチなど 生きた虫',
      season: '夏〜秋',
      fact: 'カマをふりかぶって えものを つかまえるまで たった 0.05秒。まばたきより はやい。',
      why: '飛んでいる虫を カマで つかまえる ハンター。だから 地上にいながら 空の虫と たたかえる。',
      fight: 'カマを ふりかぶって 一しゅんで つかまえる。その はやさ 0.05びょう。',
    },
  },

  ladybug: {
    id: 'ladybug',
    name: 'テントウムシ',
    kana: 'テントウムシ',
    icon: '🐞',
    role: '偵察',
    cost: 4000,
    move: 8,
    moveType: 'ground',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 5,
    motion: 'bite', // 戦闘アニメの型（battle.js）
    bodyMm: 7, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 5〜8mm くらい（ナナホシテントウ）',
      where: '草はらや畑。アブラムシのいる草の上',
      food: 'アブラムシ（1日に100びき食べることも）',
      season: '春〜秋',
      fact: 'おそわれると あしの関節から 黄色くて にがい しるを出して 身をまもる。',
      why: 'すばしっこく 動きまわって えものを さがす虫。だから 移動きょりが 長く、遠くまで 見わたせる。',
      fight: '体当たりで ぶつかる。おそわれると あしの関節から 黄色い しるを 出す。',
    },
  },

  kabuto: {
    id: 'kabuto',
    name: 'カブトムシ',
    kana: 'カブトムシ',
    icon: '🪲',
    role: '戦車',
    cost: 7000,
    move: 6,
    moveType: 'ground',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 3,
    motion: 'charge', // 戦闘アニメの型（battle.js）
    bodyMm: 45, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 3〜5cm くらい（ツノをふくむ）',
      where: 'クヌギやコナラの雑木林。夜に樹液に集まる',
      food: '木からしみ出る樹液',
      season: '夏（7〜8月ごろ）',
      fact: '頭の大きなツノで あいてを すくい上げて 投げとばす。「昆虫の王さま」とよばれる。',
      why: 'かたい外こっかくに つつまれ、ツノで 投げとばす力もち。だから 攻げきも まもりも 高い 主力ユニット。',
      fight: 'ツノを あいての 下に さしこんで、すくい上げて 投げとばす。',
    },
  },

  kuwagata: {
    id: 'kuwagata',
    name: 'クワガタ',
    kana: 'オオクワガタ',
    icon: '🦂',
    role: '重戦車',
    cost: 16000,
    move: 5,
    moveType: 'ground',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 3,
    motion: 'grab', // 戦闘アニメの型（battle.js）
    bodyMm: 55, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 3〜8cm くらい（大アゴをふくむ）',
      where: 'クヌギの雑木林。木の うろ に かくれている',
      food: '木からしみ出る樹液',
      season: '夏',
      fact: '大アゴで あいてを はさんで 動けなくする。オオクワガタは なかなか 見つからず「黒いダイヤ」とよばれた。',
      why: 'はさんだら はなさない 大アゴを持つ。だから いちばん 強いが、お金が高くて 動きは おそい。',
      fight: '大アゴで はさみこんで 持ち上げ、あいての うごきを ふうじる。',
    },
  },

  bombardier: {
    id: 'bombardier',
    name: 'ミイデラゴミムシ',
    kana: 'ミイデラゴミムシ',
    icon: '🐛',
    role: '自走砲（間接攻撃）',
    cost: 6000,
    move: 5,
    moveType: 'ground',
    minRange: 2,
    maxRange: 3,
    canCapture: false,
    vision: 2,
    motion: 'spray', // 戦闘アニメの型（battle.js）
    bodyMm: 15, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 1〜2cm くらい',
      where: '川原や田んぼのそば。石の下など',
      food: 'ほかの小さな虫',
      season: '春〜秋',
      fact: 'おしりから 100度ちかい 高温のガスを ボンッ と ふき出して てきを おいはらう。「ヘッピリムシ」ともよばれる。',
      why: '遠くへ ガスを ふき出して たたかう虫。だから はなれた ばしょから こうげき でき、はんげき を うけない。かわりに 動いたターンは こうげき できない。',
      fight: 'おしりを あいてに 向けて、100度ちかい 高温のガスを ボンッ と ふき出す。',
    },
  },

  hornet: {
    id: 'hornet',
    name: 'スズメバチ',
    kana: 'オオスズメバチ',
    icon: '🐝',
    role: '爆撃機（飛行）',
    cost: 22000,
    move: 7,
    moveType: 'air',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 4,
    motion: 'dive', // 戦闘アニメの型（battle.js）
    bodyMm: 38, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 3〜4cm くらい（オオスズメバチ）',
      where: '林の中や土の中に大きな巣をつくる',
      food: 'ほかの虫、樹液',
      season: '夏〜秋（秋がいちばん きけん）',
      fact: '1回の飛行で 数百メートル〜数キロも とべる。強いどくばりを持つので、見つけても ぜったいに ちかづかないこと。',
      why: '遠くまで とんでいって 強いどくばりで さす。だから 地上の虫に とても 強い。ただし 空の虫とは たたかえない。',
      fight: '空から きゅうこうか して、するどい どくばりで さす。',
    },
  },

  dragonfly: {
    id: 'dragonfly',
    name: 'オニヤンマ',
    kana: 'オニヤンマ',
    icon: '🦋',
    role: '戦闘機（飛行・制空）',
    cost: 20000,
    move: 9,
    moveType: 'air',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 5,
    motion: 'catch', // 戦闘アニメの型（battle.js）
    bodyMm: 100, // 実物のおおよその体長(mm)。戦闘画面の 大きさ比べに つかう
    fromWorld: 1, // 世界1から つくれる
    bio: {
      size: '体長 9〜11cm くらい（日本さいだいのトンボ）',
      where: 'きれいな小川や わき水のあるところ',
      food: 'ハエ、アブ、ガ、そしてスズメバチ',
      season: '夏',
      fact: '4まいの はねを 1まいずつ べつべつに 動かせるので、空中で ピタッと止まったり きゅうに 曲がったり できる。',
      why: '空中で スズメバチさえ つかまえて 食べる 空の王者。だから 飛ぶ虫との たたかいに めっぽう 強く、移動も いちばん はやい。',
      fight: '空中で あしを かごのように 広げて、あいてを つかまえる。',
    },
  },

  // ── 寄生ユニット（外道の 生存せんりゃく）──────────────────────
  // どれも こうげき力は ゼロ。DAMAGE表に 行を 書かないことで それを 表している。
  // かわりに となりの敵に「とりつく」。もろいので、まもって 運ぶ虫が いる。
  //
  // 寄生＝わるもの、という 単純な 図式には しない。
  // 生きのこるための やり方が いろいろ あるということを つたえる。

  komayubachi: {
    id: 'komayubachi',
    name: 'コマユバチ',
    kana: 'コマユバチ',
    icon: '🦟',
    role: '寄生（よわらせる）',
    cost: 5000,
    move: 4,
    moveType: 'foot',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 3,
    motion: 'bite',
    bodyMm: 3,
    fromWorld: 4,
    parasite: {
      kind: 'drain',
      label: 'とりつく',
      turns: 3, // 3ターンで 育ちきって はなれる
      hpPerTurn: 10, // 毎ターン HP 1目もり
      end: 'detach',
      short: '毎ターン HPが 1へる（3ターン）',
    },
    bio: {
      size: '体長 2〜5mm くらい',
      where: 'イモムシや アブラムシの いる 草むら',
      food: 'おとなは 花のミツ。よう虫は ほかの虫の 体の中',
      season: '春〜秋',
      fact: 'イモムシの 体に たまごを うみつける。よう虫は 中で そだち、大きくなると 皮を やぶって 出てくる。',
      why: 'こうげき する 口も 針も 持たない。かわりに 相手の 体の中で そだち、じわじわ 弱らせる。',
      fight: 'たたかわない。相手の 体に たまごを うみつけて、はなれていく。',
    },
  },

  yadoribae: {
    id: 'yadoribae',
    name: 'ヤドリバエ',
    kana: 'ヤドリバエ',
    icon: '🪰',
    role: '寄生（力を うばう）',
    cost: 6000,
    move: 5,
    moveType: 'foot',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 3,
    motion: 'bite',
    bodyMm: 8,
    fromWorld: 4,
    parasite: {
      kind: 'weaken',
      label: 'とりつく',
      turns: null, // 自分の 陣地で 休むまで ずっと つづく
      power: 0.5, // こうげき力が 半分に なる
      short: 'こうげき力が 半分に なる',
    },
    bio: {
      size: '体長 5〜15mm くらい',
      where: 'はらっぱや 林。えものの 虫を さがして とびまわる',
      food: 'おとなは 花のミツ。よう虫は 寄主の 体の中',
      season: '春〜秋',
      fact: 'カメムシや イモムシの 体に たまごを うみつける。よう虫は 生きた まま 中を 食べて そだつ。',
      why: '中から 体を 食べられた 虫は、力が 出せなくなる。だから こうげき力が 半分に なる。',
      fight: 'たたかわない。とびついて たまごを うみつける。',
    },
  },

  harigane: {
    id: 'harigane',
    name: 'ハリガネムシ',
    kana: 'ハリガネムシ',
    icon: '🪱',
    role: '寄生（水へ みちびく）',
    cost: 12000,
    move: 1, // いちばん おそい。とどく前に たおすのが 正しい 対しょ法
    moveType: 'foot',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 2,
    motion: 'grab',
    bodyMm: 200, // 長さは 10〜30cm ある。ただし 糸のように 細い
    fromWorld: 5,
    parasite: {
      kind: 'drown',
      label: 'とりつく',
      turns: 2,
      end: 'drown', // 2ターン後、水べへ 歩き出して しずむ
      short: '2ターン後、水に 入って しずむ',
    },
    bio: {
      size: '長さ 10〜30cm。でも 糸のように 細い',
      where: '川や 池。おとなは 水の中で くらす',
      food: 'カマキリや カマドウマの 体の中の えいよう',
      season: '夏〜秋',
      fact: 'カマキリの 脳に はたらきかけ、水面の 光を 目じるしに して 水へ とびこませる。そして 出てきて 水中で たまごを うむ。',
      why: 'こうげき力は ないが、とりついた 相手を かならず 水へ みちびく。動きが とても おそいので、ちかづかれる前に たおせば こわくない。',
      fight: 'たたかわない。体に 入りこみ、水へ 行きたいと 思わせる。',
    },
  },

  aritake: {
    id: 'aritake',
    name: 'タイワンアリタケ',
    kana: 'タイワンアリタケ',
    icon: '🍄',
    role: '寄生（のっとる）',
    cost: 9000,
    move: 2,
    moveType: 'foot',
    minRange: 1,
    maxRange: 1,
    canCapture: false,
    vision: 2,
    motion: 'grab',
    bodyMm: 10,
    fromWorld: 6,
    parasite: {
      kind: 'takeover',
      label: 'のっとる',
      needHalfHp: true, // 弱った 相手にしか きかない
      short: '弱った 敵を 味方に する（HP 半分いか）',
    },
    bio: {
      size: 'アリの 体長 5mm ほど。頭から キノコが のびる',
      where: 'あたたかい 森の 中',
      food: 'アリの 体そのもの',
      season: '一年中（あたたかい ところ）',
      fact: 'キノコの なかまが アリの 体の中で そだち、脳を つつんで 行動を あやつる。アリは 高い 葉に のぼって かみつき、そこで 動かなくなる。そして 頭から キノコが のびて 胞子を まく。',
      why: '相手を 味方に できる かわりに、のっとった 虫は 毎ターン 弱っていき、かならず たおれる。使いすての 切りふだ。',
      fight: 'たたかわない。胞子を つけて、その虫を 内がわから あやつる。',
    },
  },
};

// 寄生ユニットの もろさ。
//
// 寄生ユニットは たまご・よう虫・糸のように 細い虫で、まともに たたかう体では ない。
// 上の DAMAGE表を 12×12 に ふくらませると 人が 読めなくなるので、ここだけ 1つの 数字で きめる。
// 数字は「その虫が アリを こうげき するときの いりょく」に かける ばいりつ。
// つまり 強い虫ほど 強く たおせる、という 順番は そのまま 残る。
export const FRAGILITY = {
  komayubachi: 1.05,
  yadoribae: 1.05,
  harigane: 0.95, // 細くて つかまえにくい
  aritake: 1.0,
};

export function isParasite(type) {
  return !!(UNITS[type] && UNITS[type].parasite);
}

// 攻撃力表: DAMAGE[攻撃側][防御側] = 基礎いりょく（0 は こうげき できない）
// 昆虫どうしの じっさいの 力関係を もとに 決めている。
export const DAMAGE = {
  ant: { ant: 55, mantis: 45, ladybug: 12, kabuto: 5, kuwagata: 1, bombardier: 15, hornet: 0, dragonfly: 0 },
  mantis: { ant: 75, mantis: 60, ladybug: 55, kabuto: 15, kuwagata: 5, bombardier: 35, hornet: 60, dragonfly: 55 },
  ladybug: { ant: 75, mantis: 65, ladybug: 45, kabuto: 6, kuwagata: 1, bombardier: 45, hornet: 0, dragonfly: 0 },
  kabuto: { ant: 75, mantis: 70, ladybug: 85, kabuto: 55, kuwagata: 15, bombardier: 70, hornet: 0, dragonfly: 0 },
  kuwagata: { ant: 105, mantis: 95, ladybug: 105, kabuto: 85, kuwagata: 55, bombardier: 105, hornet: 0, dragonfly: 0 },
  bombardier: { ant: 90, mantis: 85, ladybug: 80, kabuto: 70, kuwagata: 45, bombardier: 75, hornet: 0, dragonfly: 0 },
  hornet: { ant: 110, mantis: 95, ladybug: 105, kabuto: 105, kuwagata: 95, bombardier: 105, hornet: 0, dragonfly: 0 },
  dragonfly: { ant: 30, mantis: 25, ladybug: 20, kabuto: 10, kuwagata: 5, bombardier: 25, hornet: 100, dragonfly: 55 },
};

export function baseDamage(attackerType, defenderType) {
  const row = DAMAGE[attackerType];
  if (!row) return 0; // 寄生ユニットは こうげき できない（DAMAGE表に 行が ない）
  if (defenderType in FRAGILITY) {
    return Math.min(120, Math.round((row.ant || 0) * FRAGILITY[defenderType]));
  }
  return row[defenderType] || 0;
}

// 巣（ground）と 花畑（air）で 生産できるユニット。
// world を わたすと、その世界で まだ 出てこない虫を のぞく（PLAN.md §4 の 解禁表）。
export function producibleAt(produceKind, world = 99) {
  return Object.values(UNITS).filter((u) => {
    const kind = u.moveType === 'air' ? 'air' : 'ground';
    return kind === produceKind && (u.fromWorld || 1) <= world;
  });
}
