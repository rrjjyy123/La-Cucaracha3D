import { describe, it, expect } from 'vitest';
import {
  PINS,
  UTENSIL_COUNT,
  PINS_BY_KIND,
  HALF,
  utensilSegment,
  wallSegments,
  trapHit,
  TRAP_IDS,
  OPPOSITE,
} from '../src/game/board.js';
import { LAYOUTS } from '../src/game/layouts.js';

describe('격자', () => {
  it('고정핀은 24개', () => {
    expect(UTENSIL_COUNT).toBe(24);
  });

  it('핀은 (col+row)가 홀수인 자리에만 있다', () => {
    expect(PINS.every((p) => (p.col + p.row) % 2 === 1)).toBe(true);
  });

  it('줄마다 3-4-3-4-3-4-3 개 (실물 사진과 일치)', () => {
    const perRow = [0, 1, 2, 3, 4, 5, 6].map((r) => PINS.filter((p) => p.row === r).length);
    expect(perRow).toEqual([3, 4, 3, 4, 3, 4, 3]);
  });

  it('포크/나이프/숟가락이 8개씩', () => {
    expect(PINS_BY_KIND.fork).toHaveLength(8);
    expect(PINS_BY_KIND.knife).toHaveLength(8);
    expect(PINS_BY_KIND.spoon).toHaveLength(8);
  });

  it('종류 배치가 실물 사진(참고/IMG＿7035.jpg)과 같다', () => {
    // 실물은 종류별 자리가 고정되어 있고, 이 24개를 돌려서 기본 미로들을 만든다.
    const expected = ['FKS', 'SFKF', 'SFS', 'KKSK', 'KFK', 'FSFS', 'SKF'];
    const actual = [0, 1, 2, 3, 4, 5, 6].map((r) =>
      PINS.filter((p) => p.row === r)
        .map((p) => p.kind[0].toUpperCase())
        .join(''),
    );
    expect(actual).toEqual(expected);
  });

  it('어떤 방향 조합에서도 도구끼리 겹치지 않는다', () => {
    // 겹침 = 같은 직선 위에서 구간이 실제로 포개지는 경우
    const overlaps = (a, b) => {
      const horizA = a.y1 === a.y2;
      const horizB = b.y1 === b.y2;
      if (horizA !== horizB) return false;
      if (horizA) {
        if (a.y1 !== b.y1) return false;
        return Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 1e-9;
      }
      if (a.x1 !== b.x1) return false;
      return Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 1e-9;
    };
    // 2^24 을 다 볼 수는 없으니 무작위 조합 500 개를 검사
    for (let t = 0; t < 500; t++) {
      const orients = Array.from({ length: 24 }, () => (Math.random() < 0.5 ? 'H' : 'V'));
      const segs = orients.map((o, i) => utensilSegment(i, o));
      for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
          expect(overlaps(segs[i], segs[j])).toBe(false);
        }
      }
    }
  });

  it('가장자리 도구는 바깥 벽에 정확히 닿는다', () => {
    const xs = PINS.flatMap((p) => [utensilSegment(p.i, 'H').x1, utensilSegment(p.i, 'H').x2]);
    expect(Math.min(...xs)).toBe(-HALF);
    expect(Math.max(...xs)).toBe(HALF);
  });
});

describe('초기 배치 프리셋', () => {
  it('4가지 모두 24칸이고 H/V 만 쓴다', () => {
    expect(LAYOUTS).toHaveLength(4);
    for (const l of LAYOUTS) {
      expect(l.orients).toHaveLength(24);
      expect(l.orients.every((o) => o === 'H' || o === 'V')).toBe(true);
    }
  });

  it('서로 다른 배치다', () => {
    const keys = new Set(LAYOUTS.map((l) => l.orients.join('')));
    expect(keys.size).toBe(4);
  });
});

describe('함정', () => {
  it('마주보는 쌍이 대칭이다', () => {
    for (const id of TRAP_IDS) expect(OPPOSITE[OPPOSITE[id]]).toBe(id);
  });

  it('열린 함정으로만 빠진다', () => {
    expect(trapHit(-HALF - 0.1, 2, ['LT'])).toBe('LT');
    expect(trapHit(-HALF - 0.1, 2, ['RT'])).toBe(null); // 차단문으로 막힘
    expect(trapHit(0, 0, TRAP_IDS)).toBe(null);
  });

  it('차단문을 세우면 그 자리에 벽이 생긴다', () => {
    const orients = LAYOUTS[0].orients;
    const total = (segs) => segs.reduce((n, s) => n + Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1), 0);
    const twoOpen = total(wallSegments(orients, ['LT', 'RB']));
    const allOpen = total(wallSegments(orients, TRAP_IDS));
    // 함정 2개를 막으면 벽 길이가 그만큼(2유닛 × 2개) 늘어난다
    expect(twoOpen - allOpen).toBeCloseTo(4, 9);
  });
});
