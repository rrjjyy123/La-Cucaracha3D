import './ui/styles.css';
import * as THREE from 'three';

import { wallSegments, trapHit } from './game/board.js';
import { createRoach, stepRoach, unpinch, STEP, SPEEDS } from './game/roach.js';
import {
  createGame,
  roll,
  rotate,
  pass,
  canRotate,
  rotatableIndices,
  catchRoach,
  startRound,
  outcomeText,
  currentPlayer,
} from './game/rules.js';
import { saveGame, loadGame, clearGame, loadCustomLayouts } from './game/state.js';

import { createStage } from './render/scene.js';
import { createBoard } from './render/board3d.js';
import { createUtensils } from './render/utensils.js';
import { createRoach3D } from './render/roach3d.js';
import { createDice } from './render/dice3d.js';
import { createEffects } from './render/effects.js';

import { createSetup } from './ui/setup.js';
import { createHud } from './ui/hud.js';
import { createEditor } from './ui/editor.js';
import * as sfx from './audio/sfx.js';

const $ = (sel) => document.querySelector(sel);

// ── 3D 무대 ────────────────────────────────────────────────────────────────
const stage = createStage($('#stage'));
const board = createBoard(stage.scene);
const utensils = createUtensils(stage.scene);
const roach3d = createRoach3D(stage.scene);
const dice = createDice(stage.scene, { x: 8.3, y: 0.15, z: 0 }); // 트레이 오른쪽 테두리 위
const fx = createEffects(stage.scene, board.group);

const hud = createHud({ onEditLayout: ({ orients }) => editor.open({ orients }) });

// 미로 직접 만들기 — 살아 있는 3D 판을 그대로 편집기로 쓴다
let editing = false;
let hudWasHidden = true;
const editor = createEditor({
  applyOrients: (o) => utensils.setOrients(o),
  spin: (i, orient) => utensils.spin(i, orient),
  setEditing: (on) => {
    editing = on;
    roach3d.group.visible = !on;
    utensils.setHighlight(on ? utensils.items.map((it) => it.i) : [], { soft: on });
    if (on) {
      running = false;
      sfx.stopSkitter();
      hudWasHidden = $('#hud').hidden;
      hud.hide();
      board.setActiveTrap(null);
    } else {
      if (!hudWasHidden) hud.show();
      if (game) {
        utensils.setOrients(game.orients);
        render();
      }
    }
  },
});

// ── 게임 상태 ──────────────────────────────────────────────────────────────
let game = null;
let roach = null;
let walls = [];
let running = false; // 라쿠카라차가 돌아다니는 중인가
let acc = 0; // 물리 누적 시간
let turnLeft = 0;
let lastTick = 99;
let busy = false; // 연출 중에는 입력을 막는다

const syncWalls = () => {
  walls = wallSegments(game.orients, game.openTraps);
};

function refreshHighlight() {
  utensils.setHighlight(game && game.phase === 'turn' ? rotatableIndices(game) : []);
}

function render() {
  hud.update(game);
  refreshHighlight();
  // 지금 차례인 사람의 함정에만 빛기둥을 켠다
  board.setActiveTrap(game.phase === 'game-over' ? null : currentPlayer(game).trap);
}

function startTurnTimer() {
  turnLeft = game.settings.turnSeconds || 0;
  lastTick = 99;
}

function beginRound(g) {
  game = g;
  syncWalls();
  utensils.setOrients(game.orients);
  board.setTraps(
    game.openTraps,
    Object.fromEntries(game.players.map((p) => [p.trap, p.color])),
  );
  roach = createRoach(SPEEDS[game.settings.speed] ?? SPEEDS.normal);
  roach3d.reset();
  running = true;
  busy = false;
  acc = 0;
  startTurnTimer();
  saveGame(game);
  render();
  hud.showBanner(`${currentPlayer(game).name} 차례!`, currentPlayer(game).color);
  sfx.startSkitter();
}

function startGame(config) {
  setup.hide();
  hud.show();
  hud.mount(config.players);
  beginRound(createGame({ ...config, layouts: loadCustomLayouts() }));
}

function resumeGame(saved) {
  setup.hide();
  hud.show();
  hud.mount(saved.players);
  const g = createGame({ players: saved.players, settings: saved.settings, layouts: loadCustomLayouts() });
  g.players.forEach((p, i) => (p.tokens = saved.players[i].tokens));
  g.round = saved.round;
  g.current = saved.current;
  g.layoutId = saved.layoutId;
  g.orients = saved.orients.slice();
  beginRound(g);
}

// ── 차례 진행 ──────────────────────────────────────────────────────────────
function doRoll() {
  if (busy || !game || game.phase !== 'roll') return;
  sfx.unlockAudio();
  game = roll(game);
  sfx.diceRoll();
  dice.rollTo(game.die.index);
  render();
}

async function doRotate(i) {
  if (busy || !game || !canRotate(game, i)) return;
  const nextOrient = game.orients[i] === 'H' ? 'V' : 'H';
  game = rotate(game, i);
  syncWalls();
  unpinch(roach, walls);
  sfx.clack();
  utensils.spin(i, nextOrient);
  startTurnTimer();
  render();
  sfx.turn();
}

function doPass() {
  if (!game || game.phase === 'round-over' || game.phase === 'game-over') return;
  game = pass(game);
  startTurnTimer();
  render();
  hud.showToast('시간 초과 — 다음 사람 차례');
  sfx.turn();
}

async function onCaught(trapId) {
  running = false;
  busy = true;
  sfx.stopSkitter();
  const part = board.trapParts[trapId];
  const owner = game.players.find((p) => p.trap === trapId);
  sfx.fall();
  fx.shake(0.32);
  await roach3d.fallInto({ x: part.center.x, y: part.pitY + 0.2, z: part.center.z });
  fx.dust(part.center.x, part.pitY + 0.4, part.center.z, owner?.color ?? 0xffc47a);

  game = catchRoach(game, trapId);
  sfx.token();
  render();
  saveGame(game);

  if (game.phase === 'game-over') {
    fx.confetti(game.players[game.over.winnerId ?? game.over.loserId].color);
    sfx.fanfare();
    clearGame();
    hud.gameOver(game, outcomeText(game));
    return;
  }

  const layoutId = await hud.roundOver(game);
  beginRound(startRound(game, layoutId, loadCustomLayouts()));
}

// ── 프레임 루프 ────────────────────────────────────────────────────────────
stage.onFrame.add((dt, time) => {
  utensils.update(dt, time);
  dice.update(dt, time);
  board.update(dt, time);
  fx.update(dt);

  if (!game) return;

  if (running && !busy && !editing) {
    // 물리는 고정 타임스텝으로 (프레임 속도와 무관하게 같은 움직임)
    acc = Math.min(acc + dt, 0.25);
    while (acc >= STEP) {
      acc -= STEP;
      if (stepRoach(roach, walls, STEP) && Math.random() < 0.12) sfx.bump();
      const hit = trapHit(roach.x, roach.y, game.openTraps);
      if (hit) {
        acc = 0;
        onCaught(hit);
        break;
      }
    }

    // 차례 제한 시간
    if (game.settings.turnSeconds) {
      turnLeft -= dt;
      hud.setTimer(game.current, Math.max(0, turnLeft / game.settings.turnSeconds));
      const whole = Math.ceil(turnLeft);
      if (whole <= 2 && whole > 0 && whole !== lastTick) {
        lastTick = whole;
        sfx.tick();
      }
      if (turnLeft <= 0) doPass();
    }
  }

  roach3d.sync(roach, dt, time);
});

// ── 포인터 입력 (탭으로 90° 회전) ──────────────────────────────────────────
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const canvas = stage.renderer.domElement;

function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ndc, stage.camera);
  const hits = ray.intersectObjects(utensils.hitTargets, false);
  return hits.length ? hits[0].object.userData.index : -1;
}

let downPt = null;
const onDown = (ev) => {
  downPt = { x: ev.clientX, y: ev.clientY, t: performance.now() };
};
// pointer 이벤트가 없는 환경(자동화 도구 등)도 있어서 mouse 계열도 함께 받는다
canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('mousedown', onDown);

let lastTap = 0;
function tryTap(ev) {
  if (performance.now() - lastTap < 150) return; // pointerup 과 click 이 겹쳐 두 번 처리되지 않도록
  if (downPt) {
    const moved = Math.hypot(ev.clientX - downPt.x, ev.clientY - downPt.y);
    const held = performance.now() - downPt.t;
    downPt = null;
    if (moved > 9 || held > 600) return; // 시점 회전 드래그는 무시
  }
  const i = pick(ev);
  if (i < 0) return;
  lastTap = performance.now();
  if (editing) editor.toggle(i);
  else doRotate(i);
}
canvas.addEventListener('pointerup', tryTap);
canvas.addEventListener('click', tryTap);

function onMove(ev) {
  if (ev.pointerType && ev.pointerType !== 'mouse') return;
  const i = editing || (game && game.phase === 'turn') ? pick(ev) : -1;
  utensils.setHover(i);
  canvas.style.cursor = i >= 0 && (editing || canRotate(game, i)) ? 'pointer' : '';
}
canvas.addEventListener('pointermove', onMove);

canvas.addEventListener('pointerleave', () => utensils.setHover(-1));

// ── 화면·메뉴 ──────────────────────────────────────────────────────────────
const setup = createSetup({
  onEditLayout: ({ orients }) => editor.open({ orients }),
  onStart: startGame,
  onResume: () => {
    const saved = loadGame();
    if (saved) resumeGame(saved);
  },
  onOpenRules: () => $('#rules').classList.add('show'),
});

$('#btn-rules-close').addEventListener('click', () => $('#rules').classList.remove('show'));
$('#btn-menu').addEventListener('click', () => $('#menu').classList.add('show'));
$('#btn-continue').addEventListener('click', () => $('#menu').classList.remove('show'));
$('#btn-rules').addEventListener('click', () => {
  $('#menu').classList.remove('show');
  $('#rules').classList.add('show');
});
$('#btn-restart').addEventListener('click', () => {
  $('#menu').classList.remove('show');
  const cfg = {
    players: game.players.map((p) => ({ name: p.name, color: p.color, trap: p.trap })),
    settings: game.settings,
  };
  hud.mount(cfg.players);
  beginRound(createGame({ ...cfg, layouts: loadCustomLayouts() }));
});
$('#btn-new').addEventListener('click', () => {
  $('#menu').classList.remove('show');
  toSetup();
});
$('#btn-quality').addEventListener('click', (e) => {
  const high = !stage.quality.high;
  stage.setQuality(high);
  e.currentTarget.textContent = `그래픽 품질: ${high ? '높음' : '낮음'}`;
});

$('#btn-sound').addEventListener('click', (e) => {
  const m = !sfx.isMuted();
  sfx.setMuted(m);
  e.currentTarget.textContent = m ? '🔇' : '🔊';
  if (!m && running) sfx.startSkitter();
});
$('#btn-sound').textContent = sfx.isMuted() ? '🔇' : '🔊';

$('#btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

hud.rollBtn.addEventListener('click', doRoll);

$('#btn-win-view').addEventListener('click', () => $('#win').classList.remove('show'));
$('#btn-win-new').addEventListener('click', () => {
  $('#win').classList.remove('show');
  toSetup();
});
$('#btn-win-again').addEventListener('click', () => {
  $('#win').classList.remove('show');
  const cfg = {
    players: game.players.map((p) => ({ name: p.name, color: p.color, trap: p.trap })),
    settings: game.settings,
  };
  hud.mount(cfg.players);
  beginRound(createGame({ ...cfg, layouts: loadCustomLayouts() }));
});

function toSetup() {
  running = false;
  sfx.stopSkitter();
  hud.hide();
  utensils.setHighlight([]);
  setup.show(loadGame());
}

window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && game && game.phase === 'roll') {
    e.preventDefault();
    doRoll();
  } else if (e.key === 'Escape' && !$('#hud').hidden) {
    $('#menu').classList.toggle('show');
  }
});

// 탭이 가려지면 라쿠카라차를 잠시 멈춘다
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sfx.stopSkitter();
  else if (running && !sfx.isMuted()) sfx.startSkitter();
});

if (import.meta.env.DEV) window.__debug = { stage, board, utensils, roach3d, pick, doRotate, canRotate, get game() { return game; }, get roach() { return roach; } };

// ── 시작 ───────────────────────────────────────────────────────────────────
const saved = loadGame();
setup.show(saved);
if (saved) setup.apply(saved);
requestAnimationFrame(() => {
  $('#loading').classList.remove('show');
  stage.resize();
});
