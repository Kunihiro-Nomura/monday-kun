// Copyright (c) 2026 Kunihiro Nomura. All rights reserved.
// 昆虫戦争 (Konchu Senso) — 無断複製・改変・再配布を禁じます。詳細は /LICENSE を参照。

// 画面のながれと 入力の せいぎょ。
// ルールは engine.js、絵は render.js に 分けてあるので、ここは「つなぎ」に てっしている。

import { Game, hpBars, distance } from './engine.js';
import { AI } from './ai.js';
import { Renderer, TEAM_COLOR, TEAM_LABEL, loadSprites } from './render.js';
import { BattleScene, getBattleMode, setBattleMode, hasSeenFight } from './battle.js';
import { MAPS, getMap } from './data/maps.js';
import { UNITS, baseDamage } from './data/units.js';
import { TERRAIN } from './data/terrain.js';

const SAVE_KEY = 'konchu-senso/progress/v1';
const ZUKAN_KEY = 'konchu-senso/zukan/v1';

// ---- セーブデータ ----
// Safari は ストレージを 消すことがあるので、こわれていても 落ちないようにしておく。
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できなくても 遊べるようにする */
  }
}

let progress = loadJSON(SAVE_KEY, { cleared: {} });
let zukan = new Set(loadJSON(ZUKAN_KEY, []));

function discover(types) {
  let added = false;
  for (const t of types) {
    if (!zukan.has(t)) {
      zukan.add(t);
      added = true;
    }
  }
  if (added) saveJSON(ZUKAN_KEY, [...zukan]);
}

// ---- 画面きりかえ ----
const screens = {
  title: document.getElementById('screen-title'),
  stages: document.getElementById('screen-stages'),
  game: document.getElementById('screen-game'),
  zukan: document.getElementById('screen-zukan'),
};
let previousScreen = 'title';

function show(name) {
  const current = Object.keys(screens).find((k) => screens[k].classList.contains('active'));
  if (current && current !== name) previousScreen = current;
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
  if (name === 'stages') renderStageList();
  if (name === 'zukan') renderZukan();
  if (name === 'game' && renderer) {
    requestAnimationFrame(() => {
      renderer.resize();
      renderer.draw();
    });
  }
}

document.querySelectorAll('[data-goto]').forEach((el) => {
  el.addEventListener('click', () => show(el.dataset.goto));
});
document.getElementById('zukan-back').addEventListener('click', () => show(previousScreen === 'zukan' ? 'title' : previousScreen));

// ---- モーダル ----
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalActions = document.getElementById('modal-actions');

function openModal(html, buttons) {
  modalBody.innerHTML = html;
  modalActions.innerHTML = '';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = `btn ${b.className || ''}`;
    btn.textContent = b.label;
    btn.addEventListener('click', () => {
      closeModal();
      b.onClick && b.onClick();
    });
    modalActions.appendChild(btn);
  }
  modal.classList.remove('hidden');
}
function closeModal() {
  modal.classList.add('hidden');
}

// ---- ステージ選択 ----
function isUnlocked(index) {
  if (index === 0) return true;
  return !!progress.cleared[MAPS[index - 1].id];
}

function renderStageList() {
  const list = document.getElementById('stage-list');
  list.innerHTML = '';
  MAPS.forEach((map, i) => {
    const unlocked = isUnlocked(i);
    const cleared = progress.cleared[map.id];

    const card = document.createElement('div');
    card.className = `stage-card${unlocked ? '' : ' locked'}${cleared ? ' cleared' : ''}`;
    card.innerHTML = `
      <div class="stage-no">${cleared ? '★' : map.stage}</div>
      <div class="stage-body">
        <div class="stage-name">${unlocked ? map.name : '？？？'}</div>
        <div class="stage-hint">${unlocked ? map.hint : 'まえの ステージを クリアすると あそべるよ'}</div>
        ${cleared ? `<div class="stage-badge">クリア！ ${cleared.turns}ターン</div>` : ''}
      </div>`;
    if (unlocked) card.addEventListener('click', () => startStage(map.id));
    list.appendChild(card);
  });
}

// ---- ゲーム本編 ----
const canvas = document.getElementById('board');
const banner = document.getElementById('banner');
const tileinfo = document.getElementById('tileinfo');
const actionsEl = document.getElementById('actions');

let game = null;
let ai = null;
let renderer = null;
let currentMap = null;
const battle = new BattleScene(document.getElementById('battle'));

// engine.attack() の けっかを 戦闘カットインで 再生する。
// 勝ち負けは すでに engine が 決めているので、ここは 見せるだけ。
function playBattle(attacker, defender, before, result) {
  return battle.play({
    attacker: { type: attacker.type, team: attacker.team, hpBefore: before.attacker, hpAfter: attacker.hp },
    defender: { type: defender.type, team: defender.team, hpBefore: before.defender, hpAfter: defender.hp },
    damage: result.damage,
    counter: result.counter,
    terrainId: game.terrainIdAt(defender.x, defender.y),
  });
}

// 入力の じょうたい
// idle: なにも えらんでいない / moving: 移動先を えらぶ / action: 行動を えらぶ / target: こうげき相手を えらぶ
// ai: 敵のターン中 / over: しょうはい が ついた
let ui = { mode: 'idle', unit: null, origin: null, moved: false, targets: [] };

function startStage(mapId) {
  currentMap = getMap(mapId);
  game = new Game(currentMap);
  ai = new AI(game, currentMap.aiLevel || 1);
  ui = { mode: 'idle', unit: null, origin: null, moved: false, targets: [] };

  if (!renderer) renderer = new Renderer(canvas, game);
  else renderer.setGame(game);

  discover(game.units.map((u) => u.type));
  game.startTurn('player');

  show('game');
  startTutorial(currentMap);
  setBanner(`せかい${currentMap.world}-${currentMap.stage}　${currentMap.name}`, 2200);
  setTileInfo(currentMap.hint);
  refresh();
}

function refresh() {
  renderer.overlay.move = null;
  renderer.overlay.attack = null;
  renderer.overlay.selected = null;

  if (ui.mode === 'moving' && ui.unit) {
    renderer.overlay.move = game.movableTiles(ui.unit);
    renderer.overlay.selected = { x: ui.unit.x, y: ui.unit.y };
  } else if (ui.mode === 'action' && ui.unit) {
    renderer.overlay.selected = { x: ui.unit.x, y: ui.unit.y };
  } else if (ui.mode === 'target' && ui.unit) {
    renderer.overlay.attack = ui.targets.map((t) => ({ x: t.x, y: t.y }));
    renderer.overlay.selected = { x: ui.unit.x, y: ui.unit.y };
  }

  updateHud();
  renderer.draw();
}

function updateHud() {
  const turnEl = document.getElementById('hud-turn');
  turnEl.textContent = TEAM_LABEL[game.turnTeam];
  turnEl.className = `hud-turn ${game.turnTeam}`;
  document.getElementById('hud-count').textContent = `ターン ${game.turnCount}`;
  document.getElementById('hud-funds').textContent = `💰 ${game.funds.player.toLocaleString()}`;
  document.getElementById('btn-endturn').disabled = game.turnTeam !== 'player' || game.status !== 'playing';
}

// ---- 手びき（チュートリアル） ----
// マップに steps があれば、順番に 出していく。
// シミュレーションゲームを はじめて さわる子でも、次に何をすれば
// よいかが つねに 画面に 出ている ようにする。
const tutorialEl = document.getElementById('tutorial');
let tutorialQueue = [];

function startTutorial(map) {
  tutorialQueue = (map.steps || []).map((s) => ({ ...s }));
  tutorialEl.classList.add('hidden');
  fireTutorial('start');
}

// on に あう手びきが 先頭にあれば 出して、次へ すすめる
function fireTutorial(event) {
  if (!tutorialQueue.length) return;
  if (tutorialQueue[0].on !== event) return;
  const step = tutorialQueue.shift();
  tutorialEl.textContent = step.text;
  tutorialEl.classList.remove('hidden');
}

function setBanner(text, ms = 1600) {
  banner.textContent = text;
  banner.classList.remove('hidden');
  clearTimeout(setBanner._t);
  setBanner._t = setTimeout(() => banner.classList.add('hidden'), ms);
}

function setTileInfo(html) {
  tileinfo.innerHTML = html;
}

function describeTile(x, y) {
  const t = game.terrainAt(x, y);
  const prop = game.propAt(x, y);
  const unit = game.unitAt(x, y);
  const owner = prop ? (prop.team ? TEAM_LABEL[prop.team] : 'だれのものでもない') : '';

  let html = `<b>${t.name}</b>　まもり ★${t.def}`;
  if (prop) html += `　（${owner}）`;

  if (unit) {
    const spec = UNITS[unit.type];
    html += `<br><b>${spec.name}</b>　${spec.role}　HP ${hpBars(unit.hp)}/10　うごき ${spec.move}`;
    if (spec.minRange > 1) html += `　しゃてい ${spec.minRange}〜${spec.maxRange}`;
    html += `<span class="why">${spec.bio.why}</span>`;
  } else if (t.note) {
    html += `<span class="why">${t.note}</span>`;
  }
  return html;
}

// ---- 入力（タップと ドラッグ） ----
let pointer = { down: false, moved: false, x: 0, y: 0, startX: 0, startY: 0 };

canvas.addEventListener('pointerdown', (e) => {
  pointer.down = true;
  pointer.moved = false;
  pointer.x = pointer.startX = e.clientX;
  pointer.y = pointer.startY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointer.down) return;
  const dx = e.clientX - pointer.x;
  const dy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 10) {
    pointer.moved = true;
    renderer.pan(dx, dy);
    renderer.draw();
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!pointer.down) return;
  pointer.down = false;
  if (pointer.moved) return;

  const rect = canvas.getBoundingClientRect();
  const tile = renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
  if (tile) handleTap(tile.x, tile.y);
});

window.addEventListener('resize', () => {
  if (renderer && screens.game.classList.contains('active')) {
    renderer.resize();
    renderer.draw();
  }
});

function handleTap(x, y) {
  if (game.status !== 'playing' || ui.mode === 'ai') return;
  renderer.overlay.cursor = { x, y };

  if (ui.mode === 'idle') return tapIdle(x, y);
  if (ui.mode === 'moving') return tapMoving(x, y);
  if (ui.mode === 'target') return tapTarget(x, y);
  // action 中は ボタンで えらんでもらう
  setTileInfo(describeTile(x, y));
  refresh();
}

function tapIdle(x, y) {
  const unit = game.unitAt(x, y);
  setTileInfo(describeTile(x, y));

  if (unit && unit.team === 'player' && !unit.acted && game.turnTeam === 'player') {
    ui = { mode: 'moving', unit, origin: { x: unit.x, y: unit.y }, moved: false, targets: [] };
    fireTutorial('select');
    refresh();
    return;
  }

  // 自分の 巣・花畑が あいていれば 生産メニュー
  if (game.turnTeam === 'player' && game.canProduceAt(x, y, 'player')) {
    openProduceMenu(x, y);
    return;
  }
  refresh();
}

function tapMoving(x, y) {
  const unit = ui.unit;
  if (game.canMoveTo(unit, x, y)) {
    game.moveUnit(unit, x, y);
    ui.moved = x !== ui.origin.x || y !== ui.origin.y;
    ui.mode = 'action';
    showActionMenu();
    fireTutorial('action');
    refresh();
    return;
  }

  // 自分の いるマスは 移動はんいに 入っている（＝その場で 待つ）ので、
  // ここに 来る時点で「行けないマス」を タップしている。
  const other = game.unitAt(x, y);

  // ほかの 自分の虫を タップ → そっちに 切りかえる
  if (other && other.team === 'player' && !other.acted && game.turnTeam === 'player') {
    ui = { mode: 'moving', unit: other, origin: { x: other.x, y: other.y }, moved: false, targets: [] };
    setTileInfo(describeTile(x, y));
    refresh();
    return;
  }

  // それ以外は えらんだまま にして、「なぜ 行けないか」を つたえる。
  // だまって えらぶのを やめると、こわれたように 見えてしまう。
  setBanner(whyCannotMove(unit, x, y), 2000);
  setTileInfo(describeTile(x, y));
  refresh();
}

// なぜ そのマスへ 行けないのかを、子どもに わかる ことばで 返す
function whyCannotMove(unit, x, y) {
  const spec = UNITS[unit.type];
  const terrain = game.terrainAt(x, y);
  const other = game.unitAt(x, y);

  if (other && other.team !== unit.team) {
    return 'てきが いるよ。となりまで 行って こうげき しよう';
  }
  if (other) {
    return 'なかまが いるので、そこには 止まれないよ';
  }
  if (terrain.move[spec.moveType] == null) {
    return `${terrain.name}には ${spec.name}は 入れないよ`;
  }
  return `そこまでは とどかないよ（${spec.name}の うごきは ${spec.move}）`;
}

async function tapTarget(x, y) {
  const target = ui.targets.find((t) => t.x === x && t.y === y);
  if (!target) {
    // えらび直し
    ui.mode = 'action';
    showActionMenu();
    fireTutorial('action');
    refresh();
    return;
  }
  const attacker = ui.unit;
  const before = { attacker: attacker.hp, defender: target.hp };

  ui.mode = 'ai'; // 演出中は 操作を うけつけない
  hideActionMenu();
  const result = game.attack(attacker, target);
  await playBattle(attacker, target, before, result);

  let msg = `${UNITS[attacker.type].name} の こうげき！`;
  if (result.defenderDied) msg += `　${UNITS[target.type].name} は にげていった`;
  if (result.counter > 0) msg += `　はんげき ${result.counter}`;
  setBanner(msg, 1800);

  if (attacker.hp > 0) game.commitUnit(attacker);
  finishAction();
}

function cancelSelection() {
  if (ui.unit && ui.origin) {
    ui.unit.x = ui.origin.x;
    ui.unit.y = ui.origin.y;
  }
  ui = { mode: 'idle', unit: null, origin: null, moved: false, targets: [] };
  hideActionMenu();
  refresh();
}

function finishAction() {
  ui = { mode: 'idle', unit: null, origin: null, moved: false, targets: [] };
  hideActionMenu();
  refresh();
  checkGameOver();
}

// ---- 行動メニュー ----
function showActionMenu() {
  const unit = ui.unit;
  actionsEl.innerHTML = '';
  actionsEl.classList.remove('hidden');

  const targets = game.targetsFrom(unit, unit.x, unit.y, ui.moved);
  if (targets.length) {
    addAction('こうげき', () => {
      ui.targets = targets;
      ui.mode = 'target';
      hideActionMenu();
      setTileInfo('こうげき する あいてを タップしよう');
      refresh();
    });
  }

  if (game.canCapture(unit)) {
    addAction('せんりょう', () => {
      const res = game.capture(unit);
      if (res && res.captured) {
        setBanner(`${game.terrainAt(unit.x, unit.y).name} を せんりょう した！`, 1800);
        fireTutorial('captured');
      } else if (res) {
        setBanner(`せんりょう ちゅう… あと ${res.remaining}`, 1500);
        fireTutorial('capture');
      }
      game.commitUnit(unit);
      finishAction();
    });
  }

  addAction('まつ', () => {
    game.commitUnit(unit);
    fireTutorial('wait');
    finishAction();
  });

  addAction('もどる', () => cancelSelection(), 'ghost');
}

function addAction(label, onClick, className = '') {
  const btn = document.createElement('button');
  btn.className = `btn ${className}`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  actionsEl.appendChild(btn);
}

function hideActionMenu() {
  actionsEl.classList.add('hidden');
  actionsEl.innerHTML = '';
}

// ---- 生産 ----
function openProduceMenu(x, y) {
  const kind = game.canProduceAt(x, y, 'player');
  if (!kind) return;

  const list = Object.values(UNITS).filter((u) => (u.moveType === 'air' ? 'air' : 'ground') === kind);
  const placeName = game.terrainAt(x, y).name;

  let html = `<h2>${placeName}で 虫を つくる</h2><p>もっているお金: 💰 ${game.funds.player.toLocaleString()}</p>`;
  html += list
    .map((u) => {
      const can = u.cost <= game.funds.player;
      return `<button class="produce-item" data-type="${u.id}" ${can ? '' : 'disabled'}>
        <span class="produce-icon">${u.icon}</span>
        <span>
          <span class="produce-name">${u.name}</span>
          <span class="produce-meta">${u.role}／うごき ${u.move}${u.canCapture ? '／せんりょう できる' : ''}</span>
        </span>
        <span class="produce-cost">${u.cost.toLocaleString()}</span>
      </button>`;
    })
    .join('');

  openModal(html, [{ label: 'やめる', className: 'ghost' }]);

  modalBody.querySelectorAll('.produce-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const unit = game.produce(x, y, type, 'player');
      if (unit) {
        discover([type]);
        setBanner(`${UNITS[type].name} が うまれた！`, 1500);
      }
      closeModal();
      refresh();
    });
  });
}

// ---- ターン ----
document.getElementById('btn-endturn').addEventListener('click', () => {
  if (game.turnTeam !== 'player' || game.status !== 'playing') return;
  cancelSelection();
  game.endTurn();
  runAITurn();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  const modes = [
    ['auto', 'はじめて見る くみあわせだけ くわしく（おすすめ）'],
    ['full', 'いつも くわしく'],
    ['short', 'いつも みじかく'],
    ['off', 'なし'],
  ];
  const current = getBattleMode();
  const options = modes
    .map(([v, label]) => `<button class="produce-item" data-mode="${v}">${current === v ? '● ' : '○ '}${label}</button>`)
    .join('');

  openModal(
    `<h2>せってい</h2><p><b>たたかいの アニメ</b></p>${options}
     <p style="margin-top:14px">ゲームを やめると、とちゅうの たたかいは きえてしまうよ。</p>`,
    [
      { label: 'ゲームを やめる', className: 'danger', onClick: () => show('stages') },
      { label: 'つづける', className: 'ghost' },
    ]
  );

  modalBody.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setBattleMode(btn.dataset.mode);
      closeModal();
      setBanner('せっていを かえたよ', 1200);
    });
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runAITurn() {
  ui.mode = 'ai';
  hideActionMenu();
  setBanner('あかチームの ターン', 1400);
  fireTutorial('enemyTurn');
  updateHud();
  await sleep(600);

  let guard = 0;
  while (game.status === 'playing' && guard++ < 200) {
    const report = ai.takeOneAction();
    if (!report) break;

    discover([report.unit.type]);
    // 画面の そとで 起きたことも 見えるように、動いた虫に カメラを よせる
    if (isOffScreen(report.to.x, report.to.y)) renderer.centerOn(report.to.x, report.to.y);
    renderer.draw();

    if (report.type === 'attack' && report.result) {
      discover([report.target.type]);
      await sleep(200);
      await battle.play({
        attacker: { type: report.unit.type, team: report.unit.team, hpBefore: report.hpBefore.attacker, hpAfter: report.unit.hp },
        defender: { type: report.target.type, team: report.target.team, hpBefore: report.hpBefore.defender, hpAfter: report.target.hp },
        damage: report.result.damage,
        counter: report.result.counter,
        terrainId: report.terrainId,
      });
      renderer.draw();
      await sleep(120);
    } else {
      await sleep(320);
    }
  }

  if (game.status === 'playing') {
    const made = ai.produce();
    if (made.length) {
      discover(made.map((u) => u.type));
      renderer.draw();
      await sleep(400);
    }
  }

  if (checkGameOver()) return;

  game.endTurn();
  ui = { mode: 'idle', unit: null, origin: null, moved: false, targets: [] };
  setBanner('あおチームの ターン', 1400);
  fireTutorial('playerTurn');
  setTileInfo('虫を タップして えらぼう');
  refresh();
}

function isOffScreen(x, y) {
  const s = renderer.tileToScreen(x, y);
  return s.x < 0 || s.y < 0 || s.x + renderer.tile > renderer.viewW || s.y + renderer.tile > renderer.viewH;
}

// ---- しょうはい ----
function checkGameOver() {
  const status = game.checkVictory();
  if (status === 'playing') return false;

  ui.mode = 'over';
  hideActionMenu();
  renderer.draw();

  if (status === 'win') {
    const first = !progress.cleared[currentMap.id];
    const record = progress.cleared[currentMap.id];
    if (!record || game.turnCount < record.turns) {
      progress.cleared[currentMap.id] = { turns: game.turnCount };
      saveJSON(SAVE_KEY, progress);
    }
    showVictory(first);
  } else {
    openModal(
      `<h2>まけてしまった…</h2><p>だいじょうぶ。虫の とくいなことを おもいだして、もういちど ちょうせん しよう。</p>`,
      [
        { label: 'もういちど', onClick: () => startStage(currentMap.id) },
        { label: 'ステージ選択へ', className: 'ghost', onClick: () => show('stages') },
      ]
    );
  }
  return true;
}

function showVictory(isFirstClear) {
  // クリアの ごほうびに、その面に 出てきた虫の まめちしき を 1つ 見せる。
  // 80ステージ ＝ 80個の まめちしき が しぜんに たまっていく。
  const seen = [...new Set(currentMap.units.map((u) => u.type))];
  const pick = UNITS[seen[Math.floor(Math.random() * seen.length)]];

  const html = `
    <h2>クリア！</h2>
    <p>${game.turnCount} ターンで しょうり したよ。</p>
    <div class="fact-card">
      <div class="fact-label">きょうの まめちしき</div>
      <div class="fact-title">${pick.icon} ${pick.kana}</div>
      <div class="fact-text">${pick.bio.fact}</div>
    </div>`;

  const buttons = [];
  const index = MAPS.findIndex((m) => m.id === currentMap.id);
  if (index >= 0 && index + 1 < MAPS.length) {
    buttons.push({ label: 'つぎの ステージへ', onClick: () => startStage(MAPS[index + 1].id) });
  }
  buttons.push({ label: '昆虫ずかんを 見る', className: 'ghost', onClick: () => show('zukan') });
  buttons.push({ label: 'ステージ選択へ', className: 'ghost', onClick: () => show('stages') });

  openModal(html, buttons);
}

// ---- 昆虫ずかん ----
function renderZukan() {
  const list = document.getElementById('zukan-list');
  const all = Object.values(UNITS);
  document.getElementById('zukan-count').textContent = `${zukan.size} / ${all.length} しゅるい`;

  list.innerHTML = all
    .map((u) => {
      if (!zukan.has(u.id)) {
        return `<div class="zukan-card unknown">？？？<br><span style="font-size:12px">たたかいに 出てくると 図かんに のるよ</span></div>`;
      }
      const dmgRow = Object.entries(UNITS)
        .filter(([id]) => baseDamage(u.id, id) >= 70)
        .map(([, s]) => s.name);

      return `<div class="zukan-card">
        <div class="zukan-head">
          <span class="zukan-icon">${u.icon}</span>
          <span>
            <div class="zukan-name">${u.kana}</div>
            <div class="zukan-role">${u.role}</div>
          </span>
        </div>
        <div class="zukan-stats">
          <span class="zukan-stat">うごき <b>${u.move}</b></span>
          <span class="zukan-stat">しゃてい <b>${u.minRange === u.maxRange ? u.maxRange : `${u.minRange}〜${u.maxRange}`}</b></span>
          <span class="zukan-stat">おかね <b>${u.cost.toLocaleString()}</b></span>
          ${u.canCapture ? '<span class="zukan-stat">せんりょう <b>できる</b></span>' : ''}
        </div>
        <dl class="zukan-facts">
          <dt>おおきさ</dt><dd>${u.bio.size}</dd>
          <dt>すんでいる ところ</dt><dd>${u.bio.where}</dd>
          <dt>たべもの</dt><dd>${u.bio.food}</dd>
          <dt>であえる きせつ</dt><dd>${u.bio.season}</dd>
          <dt>すごい ところ</dt><dd>${u.bio.fact}</dd>
          ${dmgRow.length ? `<dt>とくいな あいて</dt><dd>${dmgRow.join('、')}</dd>` : ''}
          ${hasSeenFight(u.id) ? `<dt>たたかい方</dt><dd>${u.bio.fight}</dd>` : '<dt>たたかい方</dt><dd style="opacity:.5">たたかうところを 見ると わかるよ</dd>'}
        </dl>
        <div class="zukan-why"><b>ゲームで つよい りゆう</b><br>${u.bio.why}</div>
      </div>`;
    })
    .join('');

  list.insertAdjacentHTML(
    'beforeend',
    `<div class="zukan-why" style="text-align:center">
      ほんものの 虫は とりすぎず、かんさつ したら もとの ばしょに にがして あげよう。
    </div>`
  );
}

// ---- PWA（ホーム画面に ついかして オフラインでも あそべるように） ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* オフライン対応が つかえなくても ゲームは 動く */
    });
  });
}

// 自動UIテスト（test/ui.test.mjs）から 盤面を のぞくための 入り口。
// ?e2e=1 が ついたときだけ 出すので、ふつうに あそぶときには 存在しない。
if (new URLSearchParams(location.search).has('e2e')) {
  window.__e2e = {
    get game() { return game; },
    get renderer() { return renderer; },
    get ui() { return ui; },
    show,
    startStage,
  };
}

// 用意ずみの スプライトを 読みこむ。まだ ない虫は 絵文字のまま 遊べる。
loadSprites().then((results) => {
  if (!results.length) return;
  const ready = results.filter((r) => r.ok).length;
  console.info(`スプライト ${ready}/${results.length} 体を 読みこみました`);
  if (ready && renderer) renderer.draw();
});

show('title');
