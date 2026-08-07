# 昆虫戦争

iPhone の Safari で遊ぶ、昆虫がたたかうターン制ストラテジー。
子供が遊びながら昆虫と自然を学べることを目指しています。

著作権は野村 邦弘に帰属します（[LICENSE](LICENSE)）。オープンソースではありません。

---

## よく使うリンク（ここだけブックマークすれば足ります）

| したいこと | ここを開く |
|---|---|
| **新しい変更をとりこむ** | [変更をとりこむ画面をひらく](https://github.com/Kunihiro-Nomura/monday-kun/compare/main...claude/famicom-wars-clone-plan-fldpmj) |
| **テストが通ったか見る** | [テストの結果](https://github.com/Kunihiro-Nomura/monday-kun/actions) |
| **iPhone で遊ぶ** | https://kunihiro-nomura.github.io/monday-kun/game/ （※手順2をやってから） |
| 公開の設定をする | [公開の設定](https://github.com/Kunihiro-Nomura/monday-kun/settings/pages) |

---

## 先に、言葉の説明（3つだけ）

| 言葉 | 意味 |
|---|---|
| **ブランチ** | 作業用のコピー。本体をこわさずに試すための場所 |
| **プルリクエスト（PR）** | 「このコピーの変更を本体に入れていいですか？」というお伺い |
| **マージ** | 実際に本体（`main`）に入れること |

Claude（設計・コード担当）は、いつも `claude/famicom-wars-clone-plan-fldpmj`
という**作業用のコピー**で作業します。
野村さんが**マージ**して初めて、本体に反映されます。

---

## 手順1　新しい変更をとりこむ（毎回やること）

Claude が「push しました」と言ったら、これをやります。

- **使う端末**: パソコン・iPhone どちらでも
- **使うソフト**: ブラウザ（Safari / Chrome）または GitHub アプリ

### やりかた

1. これを開く
   → https://github.com/Kunihiro-Nomura/monday-kun/compare/main...claude/famicom-wars-clone-plan-fldpmj

2. 緑色の **「Create pull request」** を押す

3. タイトルはそのままでよいので、もう一度 **「Create pull request」** を押す

4. 画面の下のほうにテストの結果が出ます。**数分待ってください**
   - ✅ 緑のチェック → 次へ
   - ❌ 赤いバツ → **マージしないで**、そのまま Claude に「テストが落ちています」と伝える

5. **「Merge pull request」** → **「Confirm merge」** を押す

6. 完了です。iPhone のゲームを開いて、いったん閉じてから開き直すと新しくなります

> **迷ったら**: 4 で赤いバツが出たときだけ止まってください。それ以外は押して進めて大丈夫です。

---

## 手順2　iPhone で遊べるようにする（最初の1回だけ）

- **使う端末**: パソコン推奨（iPhone でも可）
- **使うソフト**: ブラウザ

### やりかた

1. これを開く → https://github.com/Kunihiro-Nomura/monday-kun/settings/pages
2. **Source** のところで **「Deploy from a branch」** を選ぶ
3. **Branch** を **`main`**、フォルダを **`/ (root)`** にする
4. **Save** を押す
5. 2〜3分待つ

これで、このURLでゲームが開きます。

```
https://kunihiro-nomura.github.io/monday-kun/game/
```

> **注意**: 最後の `/game/` を忘れないでください。
> `/game/` を付けないと、昔の「マンデーくんBot」が開いてしまいます。

### iPhone のホーム画面に置く

1. **Safari** で上のURLを開く（Chrome ではなく Safari）
2. 下の **共有ボタン**（□に↑）を押す
3. **「ホーム画面に追加」** を押す

アプリのように起動でき、電波がなくても遊べます。

---

## 手順3　ChatGPT に絵を頼む

- **使う端末**: パソコン・iPhone どちらでも
- **使うソフト**: ChatGPT（アプリでもブラウザでも）

### 先にやること

**手順1のマージを済ませてください。** マージ前だと、ChatGPT が発注書を見つけられません。

### 貼る文（これをそのままコピーして送る）

```
このリポジトリ https://github.com/Kunihiro-Nomura/monday-kun の
グラフィック担当をお願いします。

まず AGENTS.md を読んでください。
あなたの役割・守るべき絵の仕様・納品の形式がすべて書いてあります。
発注書は game/art/orders.json です。

game/assets/units/kabuto.png が承認ずみの基準絵です。
線の太さ・彩度・光の向きを、これに揃えてください。

最初の仕事:
orders.json の inGame が true で status が todo のものを、
priority 順に1体ずつ作ってください。1体できるたびに見せてください。

納品先: game/assets/units/<id>.png（96×96・透過PNG）
game/assets/ 以外のファイルは変更しないでください。
```

2回目以降は、これだけで通じます。

```
orders.json の続きを priority 順にお願いします。
kabuto.png をスタイル参照にしてください。
```

### 「GitHub につながらない」と言われたら

[`game/art/briefs/A-世界1のこり7体.md`](game/art/briefs/) を開いて、
**中身を全部コピーして ChatGPT に貼ってください。**
リポジトリを読まなくても仕様が全部伝わるように作ってあります。

絵は2つに分けてあります。**A から先に**渡してください。

| ファイル | 中身 |
|---|---|
| `A-世界1のこり7体.md` | アリ、カマキリ、テントウムシ、クワガタ、ミイデラゴミムシ、スズメバチ、オニヤンマ |
| `B-寄生4体.md` | コマユバチ、ヤドリバエ、ハリガネムシ、タイワンアリタケ |

### 1体できるたびに見せてもらうか、まとめて置いてもらうか

いまの頼み方だと、ChatGPT は**1体できるたびに見せて、承認を待ちます**。
これは「1体できるたびに見せてください」とお願いしているためです。

毎回の承認が面倒であれば、こう言えば直接置いてくれます。

```
以降は1体ずつの承認は不要です。
できたものから game/assets/units/ に置いて、
まとめて1つのプルリクエストにしてください。
```

自動の検査（透過・サイズ・占有率・余白）が GitHub 側で走るので、
仕様から外れたものはそこで止まります。プルリクエストの画面で
まとめて見てから判断できるので、こちらのほうが速いです。

### 絵ができたら

ChatGPT が GitHub につながっていれば、そのまま置いてくれます。
そうでなければ、画像を受け取って [このフォルダ](https://github.com/Kunihiro-Nomura/monday-kun/upload/main/game/assets/units)
に **Add file → Upload files** でアップロードしてください。
ファイル名は必ず `<虫のID>.png`（例: `ant.png`）です。

アップロードすると、絵の検査が自動で走ります。
結果は[テストの結果](https://github.com/Kunihiro-Nomura/monday-kun/actions)で見られます。

---

## 手順4　外出先から Claude に開発を頼む

- **使う端末**: iPhone
- **使うソフト**: Claude アプリ → 下の **「Code」**

パソコンを閉じていても、Anthropic 側の環境で作業が進みます。

### 書き方

Claude は前回の会話を覚えていません。**「何をしてほしいか」を1つ書いてください。**
「前回の続き」ではなく、用件そのものを書くのがコツです。

良い例:

```
PLAN.md の §12 の3番（難易度選択）を実装してください。
既存のテストを壊さないこと。
判断が必要なところだけ質問してください。
```

```
世界2のステージを3面つくってください。
scripts/measure-stages.mjs で難易度を測って、
あお勝率が25〜85%に収まるように調整してください。
```

```
テストが赤くなっています。原因を調べて直してください。
```

作業が終わると Claude が push するので、**手順1**でとりこみます。

---

## 中身の説明（興味があれば）

| ファイル | 何が書いてあるか |
|---|---|
| [`PLAN.md`](PLAN.md) | 企画の全体像。全8世界×10面の設計 |
| [`game/README.md`](game/README.md) | ゲーム本体の作りの説明 |
| [`WORKFLOW.md`](WORKFLOW.md) | Claude と ChatGPT の連携のしかた（詳しい版） |
| [`CLAUDE.md`](CLAUDE.md) | Claude への指示書（自動で読まれます） |
| [`AGENTS.md`](AGENTS.md) | ChatGPT への指示書（自動で読まれます） |

### いまどこまで進んでいるか

- **世界1（10面）** … 通しで遊べます
- **世界4-1 / 5-1 / 6-1** … 寄生・入水・のっとりのお試し面
- **絵** … 12体中1体（カブトムシ）だけ完成。残りは絵文字で代用中
- 世界2・3、および各世界の残り9面 … これから

くわしくは [`PLAN.md`](PLAN.md) の §12「次のアクション」を見てください。
