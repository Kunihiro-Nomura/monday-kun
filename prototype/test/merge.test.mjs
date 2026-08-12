// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。
//
// マージ×陣取り 試作の 回帰テスト（iPhone サイズの 実ブラウザ）。
//
//   npx http-server . -p 8124 -c-1 &
//   PROTO_URL=http://localhost:8124/prototype node prototype/test/merge.test.mjs
//
// **そうさは すべて 座標タップ・座標ドラッグ だけ**で 行う。
// JSの 関数を 直接 呼ぶ 検証は 画面の 不具合を 素通しする
// （実機テスト1回目で、全項目 緑なのに 1タップも 成立しなかった）。
// window.__e2e は「いまの ばんめんを 読む」ことと、
// 時間の かかる 場面を 作る 下ごしらえ にだけ つかう。
import { chromium, devices } from 'playwright';

const BASE = process.env.PROTO_URL || 'http://localhost:8124/prototype';
const URL = `${BASE}/merge_v2.html?e2e=1`;

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'ok ' : 'NG '} ${name}${detail ? `  (${detail})` : ''}`);
  if (ok) passed++; else failed++;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ ...devices['iPhone 13'], isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`CONSOLE: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

// ---- 座標そうさ ----
const geom = () => page.evaluate(() => {
  const r = document.getElementById('tiles').getBoundingClientRect();
  return { left: r.left, top: r.top, bottom: r.bottom, right: r.right, ih: innerHeight, iw: innerWidth,
    ts: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ts')) };
});
// 盤の 大きさは とちゅうで 変わる（チュートリアルの 帯が 消えると 広がる）。
// 1回 おぼえた 座標を つかいまわすと、ぜんぜん ちがう マスを さわってしまう。
// さわる たびに 測りなおす。
async function pt(x, y) {
  const g = await geom();
  return { x: g.left + (x + 0.5) * (g.ts + 2), y: g.top + (y + 0.5) * (g.ts + 2) };
}
async function tap(x, y) {
  const p = await pt(x, y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(160);
}
async function drag(fx, fy, tx, ty) {
  const a = await pt(fx, fy), b = await pt(tx, ty);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(180);
}
const snap = () => page.evaluate(() => {
  const e = window.__e2e;
  const own = { p: 0, e: 0, grass: 0 };
  for (const t of e.tiles) { if (t.locked) own.grass++; else if (t.owner === 'p') own.p++; else if (t.owner === 'e') own.e++; }
  return {
    own, over: e.over, merges: e.merges, playerMerges: e.playerMerges, W: e.W, H: e.H,
    queen: { x: e.queen.x, y: e.queen.y },
    tiles: e.tiles.map((t) => (t.locked ? 'g' : (t.owner || 'n'))),
    units: e.units.map((u) => ({ id: u.id, side: u.side, type: u.type, x: u.x, y: u.y })),
    tut: document.getElementById('tut-text').textContent,
    banner: document.getElementById('banner').textContent,
  };
});
const mine = (s, type) => s.units.filter((u) => u.side === 'p' && u.type === type);
const freeAround = (s, x, y) =>
  [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .filter(([a, b]) => a >= 0 && b >= 0 && a < s.W && b < s.H)
    .filter(([a, b]) => s.tiles[b * s.W + a] === 'p' && !s.units.some((u) => u.x === a && u.y === b));

// 🥚を n個 そろえる（づかを 座標タップして うませる）
async function gatherEggs(n) {
  for (let i = 0; i < 24; i++) {
    const s = await snap();
    if (mine(s, 'egg').length >= n) return s;
    await tap(s.queen.x, s.queen.y);
    await page.waitForTimeout(500);
  }
  return snap();
}
// 🥚を anchor の まわりに 寄せて、ぜんぶで n個 の かたまりに する
async function clusterEggs(n) {
  const s = await snap();
  const eggs = mine(s, 'egg');
  const anchor = eggs[0];
  const near = (u) => Math.abs(u.x - anchor.x) + Math.abs(u.y - anchor.y) <= 1;
  const movers = eggs.slice(1).filter((u) => !near(u));
  let placed = eggs.filter(near).length; // anchor 自身をふくむ
  for (const m of movers) {
    if (placed >= n) break;
    const cur = await snap();
    const spot = freeAround(cur, anchor.x, anchor.y)[0];
    if (!spot) break;
    await drag(m.x, m.y, spot[0], spot[1]);
    placed++;
  }
  return anchor;
}

console.log('\n== 画面に おさまるか（実機テスト1回目の 教訓）==');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const g = await geom();
check('盤が たてに 画面の 中に おさまる', g.bottom <= g.ih + 1, `盤の 下端 ${Math.round(g.bottom)} / 画面 ${g.ih}`);
check('盤が よこに 画面の 中に おさまる', g.left >= -1 && g.right <= g.iw + 1, `${Math.round(g.left)}〜${Math.round(g.right)} / ${g.iw}`);

console.log('\n== 文章（小学校ていがくねん が 読む）==');
{
  const s = await snap();
  // ** は textContent では 太字に ならず、そのまま 記号が 見えてしまう
  check('チュートリアル文に ** が 出ない', !s.tut.includes('**'), s.tut.slice(0, 30));
  check('めあてが つねに 見えている', await page.locator('#goal').isVisible());
}

console.log('\n== 生産と マージ（試作6の 約束: タップするまで マージしない）==');
{
  const before = await snap();
  check('はじめから はたらきアリが 1匹 いる', mine(before, 'worker').length >= 1, `${mine(before, 'worker').length}匹`);

  const s = await gatherEggs(3);
  check('づかを 座標タップすると 🥚が ふえる', mine(s, 'egg').length >= 3, `${mine(s, 'egg').length}こ`);

  const anchor = await clusterEggs(3);
  await page.waitForTimeout(1200); // 自動マージが 起きないことを 見るための 間
  const waiting = await snap();
  check('3つ ならべても 自分からは マージしない', waiting.playerMerges === 0, `マージ ${waiting.playerMerges}回`);

  const cluster = waiting.units.filter((u) => u.side === 'p' && u.type === 'egg'
    && Math.abs(u.x - anchor.x) + Math.abs(u.y - anchor.y) <= 1).length;
  check('3つ そろっている', cluster >= 3, `${cluster}こ`);

  await tap(anchor.x, anchor.y);
  const merged = await snap();
  check('タップすると マージする', merged.playerMerges >= 1, `マージ ${merged.playerMerges}回`);
  check('はたらきアリが うまれる', mine(merged, 'worker').length >= 2, `${mine(merged, 'worker').length}匹`);
}

console.log('\n== かりとり（虫は さわらなくても 草を 刈る）==');
{
  const a = await snap();
  await page.waitForTimeout(9000);
  const b = await snap();
  check('ほうっておくと くさむらが へる', b.own.grass < a.own.grass, `草 ${a.own.grass} → ${b.own.grass}`);
  check('ほうっておくと 味方の 陣地が ふえる', b.own.p > a.own.p, `味方 ${a.own.p} → ${b.own.p}`);
}

console.log('\n== 前線（草が つきても 前に すすめるか）==');
// 試作6では 草が なくなると 虫の 仕事が なくなり、盤が 味方89/敵37 のまま 凍りついた。
// めあては「あいての 巣まで」なのに 進む 手だてが なかった。ここを 見張る。
{
  // 下ごしらえ: くさむらを すべて あいての 陣地に して、いちばん つらい 形を つくる。
  // そのうえで へいたいアリを 前線に 3匹 出す（ここは 時間の かかる 場面づくり なので __e2e を つかう）。
  await page.evaluate(() => {
    const e = window.__e2e;
    for (let y = 0; y < e.H; y++) for (let x = 0; x < e.W; x++) {
      const t = e.tiles[y * e.W + x];
      if (t.locked) { t.locked = false; t.owner = 'e'; }
    }
    // ここで 見たいのは「前に すすめるか」だけ。
    // あいての 虫を のこすと、あらそいの 勝ち負けで 虫が 死んで 結果が ばらつき、
    // 見たい ことが 見えなくなる（実測で ぬり返し 3〜15マスと ぶれた）。巣だけ のこす。
    for (let i = e.units.length - 1; i >= 0; i--) {
      const u = e.units[i];
      if (u.side === 'e' && u.type !== 'nest') e.units.splice(i, 1);
    }
    // マージを 積んだ プレイヤー（おおあごへいたい）を 想定する。
    // はたらきアリ1匹ぶんの おしかえしは あいての ぬり返しに かき消されて 見えにくい。
    for (const x of [2, 4, 6]) {
      if (!e.units.some((u) => u.x === x && u.y === e.H - 3)) e.spawn('major', 'p', x, e.H - 3);
    }
    e.draw();
  });
  const a = await snap();
  check('草が ぜんぶ なくなった 形に なった', a.own.grass === 0, `草 ${a.own.grass}`);

  // あいても 同時に ぬり返してくるので、はじめと おわりの 差だけを 見ると 見のがす。
  // 「むらさき だった マスが、いちどでも みどりに なったか」を 2秒ごとに ためて 数える。
  const everFlipped = new Set();
  let b = a;
  for (let i = 0; i < 11; i++) {
    await page.waitForTimeout(2000);
    b = await snap();
    a.tiles.forEach((t, k) => { if (t === 'e' && b.tiles[k] === 'p') everFlipped.add(k); });
  }
  const flipped = everFlipped.size;
  check('虫は あいての 陣地を おしかえす', flipped >= 6, `ぬり返した ${flipped}マス`);
  check('前線が 止まらない（盤が 凍らない）', b.own.p !== a.own.p || flipped > 0,
    `味方 ${a.own.p} → ${b.own.p} / 敵 ${a.own.e} → ${b.own.e}`);
}

console.log('\n== JSエラー ==');
check('エラーが 出ていない', errors.length === 0, errors.join(' / '));

console.log(`\n== けっか ==\n  せいこう ${passed} / しっぱい ${failed}`);
await browser.close();
process.exit(failed ? 1 : 0);
