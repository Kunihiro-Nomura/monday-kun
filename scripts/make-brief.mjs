// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 「貼るだけ発注書」を つくる。
//   node scripts/make-brief.mjs kabuto
//   node scripts/make-brief.mjs kabuto ant mantis
//   node scripts/make-brief.mjs --todo        # まだ 届いていない ぶん すべて
//
// グラフィック担当（ChatGPT など）の環境から GitHub に つながらない ことがある。
// そのときは この出力を そのまま チャットに 貼れば、リポジトリを 読ませなくても
// 仕様が すべて 伝わる。orders.json から つくるので、手で 書き写す必要は ない。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const orders = JSON.parse(readFileSync(join(ROOT, 'game/art/orders.json'), 'utf8'));

const CLASSIFICATION_WARNING = {
  nematomorph: '⚠ これは昆虫ではありません。類線形動物です。脚・翅・触角を描かないでください。',
  fungus: '⚠ これは昆虫ではありません。菌類です。寄生された虫から生えた子実体として描いてください。',
  plant: '⚠ これは昆虫ではありません。植物です。',
};

const args = process.argv.slice(2);
let targets;

if (args.length === 0 || args[0] === '--todo') {
  targets = orders.orders.filter((o) => o.status !== 'done').sort((a, b) => a.priority - b.priority);
  if (args.length === 0) targets = targets.slice(0, 1); // 引数なしなら 最優先の1件だけ
} else {
  targets = args.map((id) => {
    const o = orders.orders.find((x) => x.id === id);
    if (!o) {
      console.error(`orders.json に "${id}" は ありません`);
      process.exit(1);
    }
    return o;
  });
}

const c = orders.common;
const bg = (name) => `${name === 'magenta' ? 'マゼンタ' : 'グリーン'}（${c.backgrounds[name]}）`;

const out = [];

out.push(`# 『昆虫戦争』グラフィック発注（${targets.length}点）

あなたはこのプロジェクトの**グラフィック担当**です。
下記の共通仕様を必ず守って、指定された絵を作ってください。

## 共通仕様（全カット共通・絶対に変えない）

- **視点**: ${c.view}。標本写真と同じ見え方
- **姿勢**: 左右の重心を揃えた自然な姿勢（機械的な完全対称にはしない）
- **タッチ**: 図鑑イラスト風のセミリアル。**擬人化しない**（顔・表情・人間の手足をつけない）
- **輪郭**: 濃い色の輪郭線をはっきり付ける（縮小しても形が残るように）
- **光**: ${c.light}。全カットで統一
- **影**: **描かない**（影はゲーム側でプログラムが付けます）
- **色**: 実物に忠実な自然色。蛍光色は使わない
- **チーム色に塗らない**: ${c.noTeamColor}
- **余白**: 被写体の外側に上下左右とも最低 ${c.minMargin * 100}% の余白を残す
- **生成サイズ**: ${c.sourceCanvas}×${c.sourceCanvas} の正方形

## 納品の形式

- **透過PNG**（背景を抜く）。不透明だとゲームのチーム色表示を隠してしまうので必須です
- **${c.canvas}×${c.canvas}** にリサイズ
- ファイル名は各項目の「ファイル名」のとおり

## 受け入れ基準（機械で検査します）

- ${c.canvas}×${c.canvas} であること
- 四隅が完全に透明であること（背景が残っていないこと）
- **占有率**が指定どおりであること（±5%）— 虫どうしの大きさの比率が狂わないための指定です
- 上下左右に ${c.minMargin * 100}% 以上の余白があること
- 48px に縮小しても、ほかの虫と見分けがつくこと
`);

for (const o of targets) {
  const warn = CLASSIFICATION_WARNING[o.classification];
  out.push(`---

## ${o.name}

| 項目 | 指定 |
|---|---|
| ファイル名 | \`${o.id}.png\` |
| 学名 | *${o.scientificName}* |
| 分類 | ${o.classification}${warn ? '（昆虫ではない）' : '（昆虫）'} |
| 占有率 | **${Math.round(o.occupancy * 100)}%**（キャンバスに占める割合） |
| 背景色 | ${bg(o.background)} |
${warn ? `\n${warn}\n` : ''}${o.note ? `\n**注意**: ${o.note}\n` : ''}
**特徴**: ${o.featureJa}

### そのまま使えるプロンプト（英語・推奨）

\`\`\`
Top-down view icon of a ${o.nameEn} (${o.scientificName}) for a strategy game.
${o.featureEn}
Head pointing up, naturally balanced posture, centered, with a small margin around it.
Semi-realistic field-guide illustration style. Not anthropomorphic, no face, no cartoon eyes.
Strong dark outline. Soft light from upper left. No cast shadow, no ground.
Flat solid ${o.background} background (${c.backgrounds[o.background]}). Square canvas.
Accurate natural coloration.${warn ? ' NOT an insect.' : ''}
\`\`\`

### 日本語版

\`\`\`
真上から見下ろした${o.name}（${o.scientificName}）のゲーム用アイコン。
${o.featureJa}
頭を上に向け、左右の重心を揃えた自然な姿勢。
図鑑イラスト風のセミリアルな描き方で、擬人化しない。顔や表情は付けない。
濃い輪郭線をはっきり付ける。光は左上から。影は描かない。
背景は単色の${bg(o.background)}。正方形。周囲に少し余白を残す。実物に忠実な色。
\`\`\`
`);
}

out.push(`---

## 作ったあと

1. 背景を抜いて透過PNGにする
2. ${c.canvas}×${c.canvas} にリサイズし、被写体を中央に、指定の占有率で配置する
3. できたファイルをこのチャットに添付して返してください

**ゲームのコードや仕様書は変更しないでください。** 絵だけをお願いします。
`);

console.log(out.join('\n'));
