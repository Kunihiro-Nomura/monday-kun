// ブラウザでの 動作かくにん（iPhone サイズ）。
//   npx http-server game -p 8123 -c-1 &
//   node game/test/ui.test.mjs [スクリーンショットの保存先]
// 画面のながれ（えらぶ→動かす→こうげき→生産→ターン交代）が 実機サイズで 通るかを ためす。

import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.GAME_URL || 'http://localhost:8123';
const OUT = process.argv[2] || null;
if (OUT) mkdirSync(OUT, { recursive: true });

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'ok ' : 'NG '} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
}
const shot = async (page, name) => {
  if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` });
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], isMobile: true, hasTouch: true });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`CONSOLE: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

const state = () => page.evaluate(() => {
  const g = window.__e2e.game;
  return {
    mode: window.__e2e.ui.mode,
    turnTeam: g?.turnTeam,
    turnCount: g?.turnCount,
    funds: g ? { ...g.funds } : null,
    status: g?.status,
    units: g ? g.units.map((u) => ({ type: u.type, team: u.team, x: u.x, y: u.y, acted: u.acted })) : [],
  };
});

async function tapTile(tx, ty) {
  const box = await page.locator('#board').boundingBox();
  const r = await page.evaluate(() => ({ tile: window.__e2e.renderer.tile, ...window.__e2e.renderer.offset }));
  await page.mouse.click(box.x + r.x + (tx + 0.5) * r.tile, box.y + r.y + (ty + 0.5) * r.tile);
  await page.waitForTimeout(220);
}

console.log('\n== 画面のながれ ==');

await page.goto(`${BASE}/index.html?e2e=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check('タイトル画面が 出る', await page.locator('#screen-title.active').isVisible());
await shot(page, '01-title');

await page.click('text=ゲームを はじめる');
await page.waitForTimeout(250);
check('ステージ選択が 出る', await page.locator('#screen-stages.active').isVisible());
const unlocked = await page.locator('.stage-card:not(.locked)').count();
check('ステージ1だけ あそべる（あとは ロック）', unlocked === 1, `あそべる ${unlocked} 面`);
await shot(page, '02-stages');

await page.locator('.stage-card:not(.locked)').first().click();
await page.waitForTimeout(500);
check('ゲーム画面に 入る', await page.locator('#screen-game.active').isVisible());
check('チュートリアルの 手びきが 出る', await page.locator('#tutorial').isVisible());
await shot(page, '03-game');

// ここから先は しくみの テストなので、要素が そろった面（w1s3）で 行う。
// 1面は 手びき用に わざと かんたんに してある。
await page.evaluate(() => window.__e2e.startStage('w1s3'));
await page.waitForTimeout(600);

let s = await state();
check('盤面に ユニットが 配置される', s.units.length === 6, `${s.units.length}体`);
check('プレイヤーのターンで はじまる', s.turnTeam === 'player');

console.log('\n== 動かす ==');

const ant = s.units.find((u) => u.team === 'player' && u.type === 'ant');
await tapTile(ant.x, ant.y);
s = await state();
check('虫を タップすると 移動モードに なる', s.mode === 'moving', s.mode);
await shot(page, '04-selected');

await tapTile(ant.x, ant.y - 3);
s = await state();
const movedAnt = s.units.find((u) => u.team === 'player' && u.type === 'ant');
check('えらんだマスに 動く', movedAnt.y === ant.y - 3, `y=${movedAnt.y}`);
check('移動後に 行動メニューが 出る', s.mode === 'action', s.mode);
const buttons = await page.locator('#actions .btn').allTextContents();
check('メニューに「まつ」「もどる」が ある', buttons.includes('まつ') && buttons.includes('もどる'), buttons.join('/'));
await shot(page, '05-moved');

console.log('\n== とどかない場所を タップしたとき ==');
// 実機で「動かせない」と かんちがい された ところ。
// だまって せんたくを 解除すると こわれたように 見えるので、
// えらんだままにして 理由を 出す。
// 前のテストで 行動メニューが 出たままなら とじる
if (await page.locator('#actions .btn:has-text("もどる")').count()) {
  await page.click('#actions .btn:has-text("もどる")');
  await page.waitForTimeout(200);
}

// アリの「いまの位置」と、そこから 届かないマスを 取り直す
const far0 = await page.evaluate(() => {
  const g = window.__e2e.game;
  const u = g.unitsOf('player').find((x) => x.type === 'ant');
  let target = null;
  for (let y = 0; y < g.height && !target; y++)
    for (let x = 0; x < g.width && !target; x++)
      if (!g.canMoveTo(u, x, y) && !g.unitAt(x, y) && g.terrainAt(x, y).move.foot != null) target = { x, y };
  return { ant: { x: u.x, y: u.y }, target };
});
await tapTile(far0.ant.x, far0.ant.y);
check('虫を えらべる', (await state()).mode === 'moving');
await tapTile(far0.target.x, far0.target.y);
const far = await page.evaluate(() => ({
  mode: window.__e2e.ui.mode,
  banner: document.getElementById('banner').classList.contains('hidden')
    ? null
    : document.getElementById('banner').textContent,
}));
check('とどかない場所を タップしても せんたくは 外れない', far.mode === 'moving', far.mode);
check('とどかない理由が 出る', !!far.banner && far.banner.includes('とどかない'), far.banner || 'なし');

// 自分のマスを タップ → その場に とどまる（行動メニューが 出る）
await tapTile(far0.ant.x, far0.ant.y);
check('自分のマスを タップすると その場で 行動を えらべる', (await state()).mode === 'action');
await page.click('#actions .btn:has-text("もどる")');
await page.waitForTimeout(200);

console.log('\n== チュートリアル1面の あそびやすさ ==');
const tutorial = await page.evaluate(() => {
  const g = window.__e2e.game;
  const out = [];
  for (const u of g.unitsOf('player')) {
    if (!window.__e2e.game.spec(u).canCapture) continue;
    const ok = [...g.props.values()].some((p) => g.terrainIdAt(p.x, p.y) === 'sap' && g.canMoveTo(u, p.x, p.y));
    out.push(ok);
  }
  return out;
});
check('1ターン目に 樹液場へ とどく虫が いる', tutorial.some(Boolean), `占領できる虫 ${tutorial.length}体`);

console.log('\n== とりけし ==');

// この節だけで 完結するよう、あらためて えらんで 動かしてから 取り消す
await tapTile(ant.x, ant.y);
await tapTile(ant.x, ant.y - 3);
await page.click('#actions .btn:has-text("もどる")');
await page.waitForTimeout(250);
s = await state();
const backAnt = s.units.find((u) => u.team === 'player' && u.type === 'ant');
check('「もどる」で もとの位置に かえる', backAnt.x === ant.x && backAnt.y === ant.y, `(${backAnt.x},${backAnt.y})`);
check('「もどる」で まだ 行動していない', backAnt.acted === false);

console.log('\n== せんりょう ==');

// アリを 樹液場に 立たせて 占領できるか
const sap = await page.evaluate(() => {
  const g = window.__e2e.game;
  const p = [...g.props.values()].find((p) => g.terrainIdAt(p.x, p.y) === 'sap');
  const a = g.unitsOf('player').find((u) => u.type === 'ant');
  a.x = p.x; a.y = p.y; // テストのため 直接 立たせる
  window.__e2e.renderer.draw();
  return { x: p.x, y: p.y };
});
await tapTile(sap.x, sap.y);
await tapTile(sap.x, sap.y);
const capButtons = await page.locator('#actions .btn').allTextContents();
check('樹液場の 上で「せんりょう」が 出る', capButtons.includes('せんりょう'), capButtons.join('/'));
if (capButtons.includes('せんりょう')) {
  await page.click('#actions .btn:has-text("せんりょう")');
  await page.waitForTimeout(250);
  const progressed = await page.evaluate(() => {
    const g = window.__e2e.game;
    const p = [...g.props.values()].find((p) => g.terrainIdAt(p.x, p.y) === 'sap');
    return p.capture;
  });
  check('せんりょうが すすむ', progressed < 20, `のこり ${progressed}`);
}

console.log('\n== 戦闘カットイン ==');

// カブトムシを 敵アリの となりに おいて こうげき させる
const fight = await page.evaluate(() => {
  const g = window.__e2e.game;
  const kab = g.unitsOf('player').find((u) => u.type === 'kabuto');
  const ant = g.unitsOf('enemy').find((u) => u.type === 'ant');
  kab.x = ant.x;
  kab.y = ant.y + 1;
  kab.acted = false;
  window.__e2e.renderer.draw();
  return { kx: kab.x, ky: kab.y, ax: ant.x, ay: ant.y, antHp: ant.hp };
});

await tapTile(fight.kx, fight.ky);
await tapTile(fight.kx, fight.ky);
const atkButtons = await page.locator('#actions .btn').allTextContents();
check('となりに敵がいると「こうげき」が 出る', atkButtons.includes('こうげき'), atkButtons.join('/'));

await page.click('#actions .btn:has-text("こうげき")');
await page.waitForTimeout(200);
await tapTile(fight.ax, fight.ay);
await page.waitForTimeout(350);

const during = await page.evaluate(() => ({
  visible: !document.getElementById('battle').classList.contains('hidden'),
  mode: window.__e2e.ui.mode,
}));
check('戦闘カットインが 出る', during.visible);
check('演出中は 盤面の操作を うけつけない', during.mode === 'ai', during.mode);
await shot(page, '06-battle');

// 演出が かならず 終わって 盤面に もどること（止まったままにならない）
await page.waitForFunction(() => document.getElementById('battle').classList.contains('hidden'), null, { timeout: 8000 });
const after = await page.evaluate(() => ({ mode: window.__e2e.ui.mode }));
check('演出が 終わって 操作に もどる', after.mode === 'idle', after.mode);

const dmgApplied = await page.evaluate((f) => {
  const g = window.__e2e.game;
  const ant = g.unitAt(f.ax, f.ay);
  return ant ? ant.hp : 0;
}, fight);
check('ダメージが 盤面に 反映されている', dmgApplied < fight.antHp, `HP ${fight.antHp} → ${dmgApplied}`);

// 一度 たたかうと 図鑑に「たたかい方」が のる
await page.evaluate(() => window.__e2e.show('zukan'));
await page.waitForTimeout(250);
const zukanText = await page.locator('.zukan-card:not(.unknown)').first().innerText();
check('図鑑に「たたかい方」の欄が できる', zukanText.includes('たたかい方'));
await page.evaluate(() => window.__e2e.show('game'));
await page.waitForTimeout(200);

console.log('\n== 生産 ==');

const nest = await page.evaluate(() => {
  const g = window.__e2e.game;
  const p = g.propsOf('player').find((p) => g.terrainIdAt(p.x, p.y) === 'nest');
  return p ? { x: p.x, y: p.y } : null;
});
check('プレイヤーの 巣が ある', !!nest);
if (nest) {
  await tapTile(nest.x, nest.y);
  await page.waitForTimeout(250);
  const items = await page.locator('.produce-item').count();
  check('生産メニューが ひらく', items > 0, `${items}しゅるい`);
  await shot(page, '06-produce');

  const fundsBefore = (await state()).funds.player;
  await page.locator('.produce-item:not([disabled])').first().click();
  await page.waitForTimeout(300);
  s = await state();
  check('虫が うまれる', s.units.length > 6, `${s.units.length}体`);
  check('お金が へる', s.funds.player < fundsBefore, `${fundsBefore} → ${s.funds.player}`);
  const born = s.units.find((u) => u.x === nest.x && u.y === nest.y);
  check('うまれた ターンは 動けない', born?.acted === true);
}

console.log('\n== ターン交代と 敵AI ==');

await page.click('#btn-endturn');
await page.waitForTimeout(400);
s = await state();
check('敵のターンに なる', s.turnTeam === 'enemy', s.turnTeam);
await shot(page, '07-ai');

await page.waitForFunction(() => window.__e2e.game.turnTeam === 'player' || window.__e2e.game.status !== 'playing', null, { timeout: 30000 });
await page.waitForTimeout(300);
s = await state();
check('敵AIが 動いて プレイヤーに もどる', s.turnTeam === 'player', s.turnTeam);
check('ターン数が すすむ', s.turnCount === 2, `ターン ${s.turnCount}`);
const enemyMoved = s.units.filter((u) => u.team === 'enemy');
check('敵ユニットが 生きている / 動いている', enemyMoved.length > 0, `${enemyMoved.length}体`);
await shot(page, '08-after-ai');

console.log('\n== 寄生・のっとり ==');
// PLAN.md §3.3 の 目玉。画面から ほんとうに 使えるかを たしかめる。
{
  await page.evaluate(() => window.__e2e.startStage('w6s1'));
  await page.waitForTimeout(500);

  // 敵カブトムシを 弱らせて、アリタケの となりに よせる
  const pos = await page.evaluate(() => {
    const g = window.__e2e.game;
    const worm = g.unitsOf('player').find((u) => u.type === 'aritake');
    const prey = g.unitsOf('enemy').find((u) => u.type === 'kabuto');
    prey.hp = 40;
    prey.x = worm.x;
    prey.y = worm.y - 1;
    window.__e2e.renderer.draw();
    return { wx: worm.x, wy: worm.y, px: prey.x, py: prey.y };
  });

  await tapTile(pos.wx, pos.wy); // えらぶ
  await tapTile(pos.wx, pos.wy); // その場で とまる → 行動メニュー
  const labels = await page.locator('#actions .btn').allTextContents();
  check('寄生ユニットに「のっとる」が 出る', labels.some((t) => t.startsWith('のっとる')), labels.join('／'));
  check('寄生ユニットに「こうげき」は 出ない', !labels.includes('こうげき'));
  await shot(page, '10-infest-menu');

  await page.locator('#actions .btn', { hasText: 'のっとる' }).first().click();
  await page.waitForTimeout(200);
  await tapTile(pos.px, pos.py);
  await page.waitForTimeout(500);

  const z = await page.evaluate(() => {
    const g = window.__e2e.game;
    const zombie = g.units.find((u) => u.zombie);
    return zombie ? { type: zombie.type, team: zombie.team, hp: zombie.hp } : null;
  });
  check('敵が 味方に なる', z && z.team === 'player' && z.type === 'kabuto', JSON.stringify(z));
  const wormGone = await page.evaluate(() => !window.__e2e.game.units.some((u) => u.type === 'aritake'));
  check('とりついた 寄生ユニットは 盤から きえる', wormGone);
  await shot(page, '11-takeover');

  // 弱っていくことを たしかめる（毎ターン へる）
  const hpBefore = z.hp;
  await page.evaluate(() => window.__e2e.game.startTurn('player'));
  const hpAfter = await page.evaluate(() => (window.__e2e.game.units.find((u) => u.zombie) || {}).hp ?? 0);
  check('のっとった虫は 毎ターン 弱る', hpAfter < hpBefore, `${hpBefore} → ${hpAfter}`);
}

console.log('\n== マップエディタ ==');
// エディタの 出力が maps.js の 形と ずれると、貼ったとたんに 面が こわれる。
// 「読みこんで → 出して → もとと 同じか」を 全部の面で ためす。
{
  const ed = await ctx.newPage();
  const edErrors = [];
  ed.on('pageerror', (e) => edErrors.push(e.message));
  await ed.goto(`${BASE}/tools/editor.html`, { waitUntil: 'networkidle' });
  await ed.waitForTimeout(300);

  const ids = await ed.$$eval('#load option', (os) => os.map((o) => o.value));
  check('エディタが ぜんぶの面を 読める', ids.length >= 8, `${ids.length}面`);

  const diffs = [];
  for (const id of ids) {
    await ed.selectOption('#load', id);
    await ed.click('#btn-load');
    await ed.waitForTimeout(60);
    const text = await ed.inputValue('#out');
    // 出した文字列を そのまま 評価して、もとの面と くらべる
    const same = await ed.evaluate(async (src) => {
      const { getMap } = await import('../js/data/maps.js');
      const produced = eval(`(${src.trim().replace(/,$/, '')})`);
      const original = getMap(produced.id);
      const norm = (m) => JSON.stringify({
        id: m.id, world: m.world, stage: m.stage, name: m.name, hint: m.hint,
        aiLevel: m.aiLevel, startFunds: m.startFunds,
        incomePerProperty: m.incomePerProperty ?? 1000,
        rows: m.rows,
        owners: [...(m.owners || [])].sort((a, b) => a.y - b.y || a.x - b.x),
        units: [...(m.units || [])].sort((a, b) => a.y - b.y || a.x - b.x),
        steps: m.steps || [],
      });
      return norm(produced) === norm(original);
    }, text);
    if (!same) diffs.push(id);
  }
  check('読みこんで 出しなおすと もとと 同じに なる', diffs.length === 0, diffs.length ? `ずれた面: ${diffs.join('、')}` : `${ids.length}面 すべて 一致`);
  check('エディタで JSエラーが 出ない', edErrors.length === 0, edErrors.join(' / '));
  await ed.close();
}

console.log('\n== 昆虫ずかん ==');

await page.evaluate(() => window.__e2e.show('zukan'));
await page.waitForTimeout(300);
const known = await page.locator('.zukan-card:not(.unknown)').count();
const total = await page.locator('.zukan-card').count();
// 虫を 足すたびに 数字を 書きかえるのは 忘れやすい。データから 数える。
const unitCount = await page.evaluate(async () => {
  const { UNITS } = await import('../js/data/units.js');
  return Object.keys(UNITS).length;
});
check('ずかんが ひらく', total === unitCount, `${total}まい／虫は ${unitCount}しゅるい`);
check('たたかいに 出た虫が 図かんに のる', known >= 2, `${known}しゅるい`);
await shot(page, '09-zukan');

console.log('\n== しょうり画面 ==');

await page.evaluate(() => window.__e2e.show('game'));

// 敵の 女王の巣を あと少しで 落とせる じょうたいを つくり、
// 実際に「えらぶ → せんりょう」を 押して しょうりに とどくかを ためす。
const hq = await page.evaluate(() => {
  const g = window.__e2e.game;
  const p = [...g.props.values()].find((p) => g.terrainAt(p.x, p.y).hq && p.team === 'enemy');
  const ant = g.unitsOf('player').find((u) => u.type === 'ant');
  const blocker = g.unitAt(p.x, p.y);
  if (blocker) g.units = g.units.filter((u) => u !== blocker);
  ant.x = p.x;
  ant.y = p.y;
  ant.acted = false;
  ant.hp = 100;
  p.capture = 1;
  p.capturedBy = ant.id;
  g.turnTeam = 'player';
  window.__e2e.renderer.draw();
  return { x: p.x, y: p.y };
});

await tapTile(hq.x, hq.y);
await tapTile(hq.x, hq.y);
await page.click('#actions .btn:has-text("せんりょう")');
await page.waitForTimeout(600);
const modalVisible = await page.locator('#modal:not(.hidden)').isVisible().catch(() => false);
const modalText = modalVisible ? await page.locator('#modal-body').innerText() : '';
check('クリア画面が 出る', modalText.includes('クリア'), modalText.split('\n')[0] || 'モーダルなし');
check('クリア画面に まめちしきが のる', modalText.includes('まめちしき'));
await shot(page, '10-victory');

console.log('\n== JSエラー ==');
check('コンソールエラーが ない', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n  しっぱい ${failed} 件\n`);
process.exit(failed ? 1 : 0);
