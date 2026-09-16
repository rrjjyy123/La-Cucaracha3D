import { describe, it, expect } from 'vitest';
import { createRoach, stepRoach, unpinch, STEP, CLEARANCE, SPEEDS } from '../src/game/roach.js';
import { wallSegments, trapHit, HALF, TRAP_IDS, utensilSegment } from '../src/game/board.js';
import { LAYOUTS } from '../src/game/layouts.js';

/** 재현 가능한 난수 (mulberry32) */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 식사 도구 없이 바깥 벽만 있는 빈 판 */
const emptyBoard = (openTraps = []) => wallSegments(Array(24).fill('H'), openTraps).slice(24);

const minDistToWalls = (r, walls) =>
  Math.min(
    ...walls.map((s) => {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((r.x - s.x1) * dx + (r.y - s.y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(r.x - (s.x1 + t * dx), r.y - (s.y1 + t * dy));
    }),
  );

const run = (r, walls, seconds, rng) => {
  for (let i = 0; i < 120 * seconds; i++) stepRoach(r, walls, STEP, rng);
};

describe('바퀴벌레', () => {
  it('함정을 모두 막으면 판 밖으로 절대 나가지 않는다', () => {
    const rng = seeded(7);
    const walls = wallSegments(LAYOUTS[1].orients, []);
    const r = createRoach(SPEEDS.fast, rng);
    for (let i = 0; i < 120 * 60; i++) {
      stepRoach(r, walls, STEP, rng);
      expect(Math.abs(r.x)).toBeLessThanOrEqual(HALF);
      expect(Math.abs(r.y)).toBeLessThanOrEqual(HALF);
    }
  });

  it('벽을 파고들지 않는다 (항상 여유 반지름 밖)', () => {
    const rng = seeded(99);
    const walls = wallSegments(LAYOUTS[0].orients, []);
    const r = createRoach(SPEEDS.fast, rng);
    let worst = Infinity;
    for (let i = 0; i < 120 * 30; i++) {
      stepRoach(r, walls, STEP, rng);
      worst = Math.min(worst, minDistToWalls(r, walls));
    }
    expect(worst).toBeGreaterThan(CLEARANCE - 1e-6);
  });

  it('구석에 박아놔도 빠져나와 판 곳곳을 돌아다닌다', () => {
    const rng = seeded(3);
    const walls = emptyBoard();
    const r = createRoach(SPEEDS.normal, rng);
    r.x = -HALF + CLEARANCE;
    r.y = -HALF + CLEARANCE;
    r.heading = Math.atan2(-1, -1); // 구석을 정면으로 향해 둔다
    const visited = new Set();
    for (let i = 0; i < 120 * 60; i++) {
      stepRoach(r, walls, STEP, rng);
      visited.add(`${Math.round(r.x)},${Math.round(r.y)}`);
    }
    expect(visited.size).toBeGreaterThan(30);
  });

  it('규칙서 배치에서는 가운데 방에 갇힌 채 시작한다 (실물과 동일)', () => {
    for (const layout of LAYOUTS) {
      const rng = seeded(21);
      const walls = wallSegments(layout.orients, TRAP_IDS);
      const r = createRoach(SPEEDS.fast, rng);
      run(r, walls, 20, rng);
      expect(Math.abs(r.x)).toBeLessThan(1);
      expect(Math.abs(r.y)).toBeLessThan(1);
      expect(trapHit(r.x, r.y, TRAP_IDS)).toBeNull();
    }
  });

  it('가운데 방을 열어주면 빠져나온다', () => {
    const rng = seeded(13);
    const orients = LAYOUTS[1].orients.slice();
    orients[8] = 'V'; // 가운데 방 윗벽을 90° 돌려 길을 낸다
    const walls = wallSegments(orients, []);
    const r = createRoach(SPEEDS.normal, rng);
    let escaped = false;
    for (let i = 0; i < 120 * 60 && !escaped; i++) {
      stepRoach(r, walls, STEP, rng);
      if (Math.abs(r.x) > 1.5 || Math.abs(r.y) > 1.5) escaped = true;
    }
    expect(escaped).toBe(true);
  });

  it('열린 함정으로는 빠져나간다', () => {
    const rng = seeded(11);
    const walls = emptyBoard(TRAP_IDS);
    const r = createRoach(SPEEDS.fast, rng);
    let caught = null;
    for (let i = 0; i < 120 * 120 && !caught; i++) {
      stepRoach(r, walls, STEP, rng);
      caught = trapHit(r.x, r.y, TRAP_IDS);
    }
    expect(TRAP_IDS).toContain(caught);
  });

  it('차단문으로 막은 함정 쪽으로는 나가지 못한다', () => {
    const rng = seeded(31);
    const walls = emptyBoard(['LT']); // LT 만 열림
    const r = createRoach(SPEEDS.fast, rng);
    for (let i = 0; i < 120 * 60; i++) {
      stepRoach(r, walls, STEP, rng);
      const hit = trapHit(r.x, r.y, TRAP_IDS);
      if (hit) {
        expect(hit).toBe('LT');
        return;
      }
    }
  });

  it('도구를 돌려 몸에 겹쳐도 끼지 않고 밀려난다', () => {
    const rng = seeded(5);
    const orients = LAYOUTS[1].orients.slice();
    const r = createRoach(SPEEDS.normal, rng);
    const seg = utensilSegment(0, 'H');
    r.x = (seg.x1 + seg.x2) / 2;
    r.y = (seg.y1 + seg.y2) / 2;
    orients[0] = orients[0] === 'H' ? 'V' : 'H';
    const walls = wallSegments(orients, []);
    unpinch(r, walls, rng);
    expect(minDistToWalls(r, walls)).toBeGreaterThan(CLEARANCE - 1e-6);
  });
});
