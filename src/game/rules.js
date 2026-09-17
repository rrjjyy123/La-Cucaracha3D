// 규칙 로직 — 순수 함수. 렌더링·DOM 과 무관하다.

import { PINS, UTENSIL_COUNT, TRAP_IDS, OPPOSITE, getTrap } from './board.js';
import { faceAllows, rollDie } from './dice.js';
import { getLayout, LAYOUTS } from './layouts.js';
import { SPEEDS } from './roach.js';

export const TARGET_TOKENS = 5;

export const PLAYER_COLORS = ['#ff9a3c', '#57c7ff', '#8be36b', '#ff7aa8'];
export const DEFAULT_NAMES = ['1번 방역가', '2번 방역가', '3번 방역가', '4번 방역가'];

/** 인원수별 기본 함정. 2인은 반드시 마주보는 한 쌍. */
export function defaultTraps(count) {
  if (count === 2) return ['LT', 'RB'];
  if (count === 3) return ['LT', 'RB', 'LB'];
  return ['LT', 'RT', 'RB', 'LB'];
}

/** 함정 배정이 규칙에 맞는지 */
export function validateTraps(traps) {
  if (new Set(traps).size !== traps.length) return '같은 함정을 두 명이 고를 수 없습니다.';
  if (traps.some((t) => !TRAP_IDS.includes(t))) return '없는 함정입니다.';
  if (traps.length === 2 && OPPOSITE[traps[0]] !== traps[1]) {
    return '2명이 할 때는 서로 마주보는 함정을 골라야 합니다.';
  }
  return null;
}

export const DEFAULT_SETTINGS = {
  speed: 'normal',
  turnSeconds: 15, // 0 이면 무제한
  mode: 'win', // 'win' = 5개 모으면 승리 / 'lose' = 룰북 변형: 5개 모으면 패배
  layoutId: 'rings',
  quality: 'high',
};

/** @param {object[]} layouts 직접 만든 미로까지 포함해 id 를 찾을 목록 */
export function createGame({ players, settings = {}, layouts = [] }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const layout = getLayout(s.layoutId, layouts);
  return {
    settings: s,
    speed: SPEEDS[s.speed] ?? SPEEDS.normal,
    players: players.map((p, i) => ({
      id: i,
      name: p.name || DEFAULT_NAMES[i],
      color: p.color || PLAYER_COLORS[i],
      trap: p.trap,
      tokens: 0,
    })),
    openTraps: players.map((p) => p.trap),
    orients: layout.orients.slice(),
    layoutId: layout.id,
    round: 1,
    current: 0,
    die: null,
    phase: 'roll', // roll → turn → (round-over) → roll …
    lastCatch: null, // { trap, playerId }
    over: null, // { loserId } | { winnerId }
  };
}

export const currentPlayer = (g) => g.players[g.current];
export const trapOwner = (g, trapId) => g.players.find((p) => p.trap === trapId) || null;
const next = (g) => (g.current + 1) % g.players.length;

/** 주사위를 굴린다 */
export function roll(g, rng = Math.random) {
  if (g.phase !== 'roll') return g;
  return { ...g, die: rollDie(rng), phase: 'turn' };
}

/** 지금 이 도구를 돌릴 수 있는가 */
export function canRotate(g, i) {
  if (g.phase !== 'turn' || !g.die) return false;
  if (i < 0 || i >= UTENSIL_COUNT) return false;
  return faceAllows(g.die.face, PINS[i].kind);
}

/** 돌릴 수 있는 도구 목록 */
export function rotatableIndices(g) {
  if (g.phase !== 'turn' || !g.die) return [];
  return PINS.filter((p) => faceAllows(g.die.face, p.kind)).map((p) => p.i);
}

/** 도구 하나를 90° 돌리고 차례를 넘긴다 */
export function rotate(g, i) {
  if (!canRotate(g, i)) return g;
  const orients = g.orients.slice();
  orients[i] = orients[i] === 'H' ? 'V' : 'H';
  return { ...g, orients, die: null, phase: 'roll', current: next(g) };
}

/** 제한 시간을 넘겨 그냥 넘어간다 */
export function pass(g) {
  if (g.phase !== 'turn' && g.phase !== 'roll') return g;
  return { ...g, die: null, phase: 'roll', current: next(g) };
}

/** 라쿠카라차가 함정에 빠졌다 */
export function catchRoach(g, trapId) {
  const owner = trapOwner(g, trapId);
  if (!owner) return g;
  const players = g.players.map((p) => (p.id === owner.id ? { ...p, tokens: p.tokens + 1 } : p));
  const reached = players.find((p) => p.tokens >= TARGET_TOKENS);
  const over = reached ? (g.settings.mode === 'lose' ? { loserId: reached.id } : { winnerId: reached.id }) : null;
  return {
    ...g,
    players,
    die: null,
    lastCatch: { trap: trapId, playerId: owner.id },
    phase: over ? 'game-over' : 'round-over',
    over,
  };
}

/** 다음 라운드 준비 — 토큰을 받은 사람부터 시작한다 */
export function startRound(g, layoutId = g.layoutId, layouts = []) {
  const layout = getLayout(layoutId, layouts);
  return {
    ...g,
    orients: layout.orients.slice(),
    layoutId: layout.id,
    round: g.round + 1,
    current: g.lastCatch ? g.lastCatch.playerId : g.current,
    die: null,
    phase: 'roll',
  };
}

/** 최종 순위 문구용 */
export function outcomeText(g) {
  if (!g.over) return '';
  if (g.over.winnerId != null) {
    const p = g.players[g.over.winnerId];
    return `${p.name} 승리!`;
  }
  const p = g.players[g.over.loserId];
  return `${p.name} 패배!`;
}

export { LAYOUTS, getTrap };
