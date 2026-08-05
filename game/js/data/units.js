// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 昆虫ユニットのデータ。
//
// 設計方針: ゲーム上の強さの数値には、かならず「本物の昆虫の特徴」という理由をつける。
// 遊んでいるうちに、なぜこの虫が強いのかが自然と身につくようにする。
// bio の内容は昆虫ずかん（学習要素）にそのまま表示する。
//
// icon の絵文字はプロトタイプ用のかりの絵。あとでドット絵に差しかえる。

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
    bio: {
      size: '体長 2〜12mm くらい（しゅるいによる）',
      where: '土の中や木の下。日本中どこにでもいる',
      food: 'あまいミツ、ほかの虫、木の実など',
      season: '春〜秋',
      fact: '自分の体重の 50倍いじょう の物を持ちあげられる とんでもない力もち。',
      why: '巣で何万びきも くらす社会性昆虫なので、安く たくさん 出せる。占領できるのはアリのなかまだけ。',
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
    bio: {
      size: '体長 7〜9cm くらい（オオカマキリ）',
      where: '草はらや やぶ。えものを じっと まちぶせする',
      food: 'バッタ、チョウ、ハチなど 生きた虫',
      season: '夏〜秋',
      fact: 'カマをふりかぶって えものを つかまえるまで たった 0.05秒。まばたきより はやい。',
      why: '飛んでいる虫を カマで つかまえる ハンター。だから 地上にいながら 空の虫と たたかえる。',
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
    bio: {
      size: '体長 5〜8mm くらい（ナナホシテントウ）',
      where: '草はらや畑。アブラムシのいる草の上',
      food: 'アブラムシ（1日に100びき食べることも）',
      season: '春〜秋',
      fact: 'おそわれると あしの関節から 黄色くて にがい しるを出して 身をまもる。',
      why: 'すばしっこく 動きまわって えものを さがす虫。だから 移動きょりが 長く、遠くまで 見わたせる。',
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
    bio: {
      size: '体長 3〜5cm くらい（ツノをふくむ）',
      where: 'クヌギやコナラの雑木林。夜に樹液に集まる',
      food: '木からしみ出る樹液',
      season: '夏（7〜8月ごろ）',
      fact: '頭の大きなツノで あいてを すくい上げて 投げとばす。「昆虫の王さま」とよばれる。',
      why: 'かたい外こっかくに つつまれ、ツノで 投げとばす力もち。だから 攻げきも まもりも 高い 主力ユニット。',
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
    bio: {
      size: '体長 3〜8cm くらい（大アゴをふくむ）',
      where: 'クヌギの雑木林。木の うろ に かくれている',
      food: '木からしみ出る樹液',
      season: '夏',
      fact: '大アゴで あいてを はさんで 動けなくする。オオクワガタは なかなか 見つからず「黒いダイヤ」とよばれた。',
      why: 'はさんだら はなさない 大アゴを持つ。だから いちばん 強いが、お金が高くて 動きは おそい。',
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
    bio: {
      size: '体長 1〜2cm くらい',
      where: '川原や田んぼのそば。石の下など',
      food: 'ほかの小さな虫',
      season: '春〜秋',
      fact: 'おしりから 100度ちかい 高温のガスを ボンッ と ふき出して てきを おいはらう。「ヘッピリムシ」ともよばれる。',
      why: '遠くへ ガスを ふき出して たたかう虫。だから はなれた ばしょから こうげき でき、はんげき を うけない。かわりに 動いたターンは こうげき できない。',
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
    bio: {
      size: '体長 3〜4cm くらい（オオスズメバチ）',
      where: '林の中や土の中に大きな巣をつくる',
      food: 'ほかの虫、樹液',
      season: '夏〜秋（秋がいちばん きけん）',
      fact: '1回の飛行で 数百メートル〜数キロも とべる。強いどくばりを持つので、見つけても ぜったいに ちかづかないこと。',
      why: '遠くまで とんでいって 強いどくばりで さす。だから 地上の虫に とても 強い。ただし 空の虫とは たたかえない。',
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
    bio: {
      size: '体長 9〜11cm くらい（日本さいだいのトンボ）',
      where: 'きれいな小川や わき水のあるところ',
      food: 'ハエ、アブ、ガ、そしてスズメバチ',
      season: '夏',
      fact: '4まいの はねを 1まいずつ べつべつに 動かせるので、空中で ピタッと止まったり きゅうに 曲がったり できる。',
      why: '空中で スズメバチさえ つかまえて 食べる 空の王者。だから 飛ぶ虫との たたかいに めっぽう 強く、移動も いちばん はやい。',
    },
  },
};

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
  return (DAMAGE[attackerType] && DAMAGE[attackerType][defenderType]) || 0;
}

// 巣（ground）と 花畑（air）で 生産できるユニット
export function producibleAt(produceKind) {
  return Object.values(UNITS).filter((u) => {
    const kind = u.moveType === 'air' ? 'air' : 'ground';
    return kind === produceKind;
  });
}
