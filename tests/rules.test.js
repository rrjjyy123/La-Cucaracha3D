import { describe, it, expect } from 'vitest';
import {
  createGame,
  roll,
  rotate,
  pass,
  canRotate,
  rotatableIndices,
  catchRoach,
  startRound,
  validateTraps,
  defaultTraps,
  currentPlayer,
  TARGET_TOKENS,
} from '../src/game/rules.js';
import { PINS } from '../src/game/board.js';
import { DIE_FACES } from '../src/game/dice.js';

const game = (n = 3, settings = {}) =>
  createGame({
    players: defaultTraps(n).map((trap, i) => ({ name: `P${i}`, trap })),
    settings,
  });

const forceFace = (g, face) => ({ ...g, die: { face, index: 0 }, phase: 'turn' });

describe('주사위', () => {
  it('6면 = 나이프1 · 포크1 · 숟가락1 · 물음표3', () => {
    expect(DIE_FACES).toHaveLength(6);
    const count = (f) => DIE_FACES.filter((x) => x === f).length;
    expect([count('knife'), count('fork'), count('spoon'), count('any')]).toEqual([1, 1, 1, 3]);
  });
});

describe('함정 배정', () => {
  it('2인은 마주보는 함정만 허용', () => {
    expect(validateTraps(['LT', 'RB'])).toBeNull();
    expect(validateTraps(['LT', 'RT'])).not.toBeNull();
  });
  it('같은 함정을 두 명이 고를 수 없다', () => {
    expect(validateTraps(['LT', 'LT'])).not.toBeNull();
  });
  it('인원수만큼만 함정이 열린다', () => {
    expect(game(2).openTraps).toHaveLength(2);
    expect(game(4).openTraps).toHaveLength(4);
  });
});

describe('차례', () => {
  it('주사위를 굴려야 도구를 돌릴 수 있다', () => {
    const g = game();
    expect(canRotate(g, 0)).toBe(false);
    expect(canRotate(roll(g, () => 0.9), 0)).toBe(true); // 물음표 면 → 아무거나
  });

  it('나온 그림에 해당하는 도구만 돌릴 수 있다', () => {
    const g = forceFace(game(), 'fork');
    const allowed = rotatableIndices(g);
    expect(allowed).toHaveLength(8);
    expect(allowed.every((i) => PINS[i].kind === 'fork')).toBe(true);
    const knife = PINS.find((p) => p.kind === 'knife').i;
    expect(canRotate(g, knife)).toBe(false);
  });

  it('물음표면 24개 모두 돌릴 수 있다', () => {
    expect(rotatableIndices(forceFace(game(), 'any'))).toHaveLength(24);
  });

  it('도구를 돌리면 90° 바뀌고 다음 사람 차례가 된다', () => {
    const g = forceFace(game(3), 'any');
    const before = g.orients[5];
    const after = rotate(g, 5);
    expect(after.orients[5]).toBe(before === 'H' ? 'V' : 'H');
    expect(after.current).toBe(1);
    expect(after.phase).toBe('roll');
  });

  it('시계방향으로 한 바퀴 돈다', () => {
    let g = game(3);
    for (let i = 0; i < 3; i++) g = pass(g);
    expect(g.current).toBe(0);
  });

  it('시간이 지나면 회전 없이 넘어간다', () => {
    const g = forceFace(game(2), 'fork');
    const after = pass(g);
    expect(after.orients).toEqual(g.orients);
    expect(after.current).toBe(1);
  });
});

describe('토큰과 승패', () => {
  it('함정 주인이 토큰을 받는다', () => {
    const g = game(3);
    const trap = g.players[2].trap;
    const after = catchRoach(g, trap);
    expect(after.players[2].tokens).toBe(1);
    expect(after.phase).toBe('round-over');
  });

  it('차단문으로 막힌 함정은 아무 일도 없다', () => {
    const g = game(2); // LT, RB 만 열림
    expect(catchRoach(g, 'RT')).toEqual(g);
  });

  it('토큰을 받은 사람부터 새 라운드를 시작한다', () => {
    let g = game(3);
    g = catchRoach(g, g.players[2].trap);
    g = startRound(g, 'grid');
    expect(currentPlayer(g).id).toBe(2);
    expect(g.layoutId).toBe('grid');
    expect(g.round).toBe(2);
  });

  it('5개를 먼저 모으면 승리', () => {
    let g = game(2);
    const trap = g.players[0].trap;
    for (let i = 0; i < TARGET_TOKENS; i++) g = catchRoach(g, trap);
    expect(g.phase).toBe('game-over');
    expect(g.over).toEqual({ winnerId: 0 });
  });

  it('변형 규칙에서는 5개를 먼저 모으면 패배', () => {
    let g = game(2, { mode: 'lose' });
    const trap = g.players[1].trap;
    for (let i = 0; i < TARGET_TOKENS; i++) g = catchRoach(g, trap);
    expect(g.over).toEqual({ loserId: 1 });
  });
});
