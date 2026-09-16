// 게임판 격자 모델
//
// 실물 게임판은 7×7 격자점 중 (col + row)가 홀수인 자리에만 고정핀이 박혀 있다.
// 7×7에서 그런 자리는 정확히 24개 — 룰북 구성물(고정핀 24개, 식사 도구 24개)과 일치한다.
// 각 식사 도구는 "길이 2칸짜리 막대"이고 핀이 그 정중앙에 있어서,
// 가로(H)와 세로(V) 두 상태만 가진다. (룰북: "세로 또는 가로로만 돌릴 수 있으며, 비스듬하게 둘 수는 없습니다.")

export const GRID = 7; // 격자점 7×7
export const HALF = 4; // 판 중심에서 바깥 벽까지 = 4유닛 (플레이 영역 8×8유닛)

/** 도구 종류 — 포크 8, 나이프 8, 숟가락 8 */
export const KINDS = ['fork', 'knife', 'spoon'];
export const KIND_LABEL = { fork: '포크', knife: '나이프', spoon: '숟가락' };

/**
 * 고정핀 24개. col/row 는 0..6, x/y 는 판 중심 기준 좌표(-3..3).
 * 순서는 위(row 0)에서 아래로, 각 줄은 왼쪽에서 오른쪽으로.
 */
export const PINS = (() => {
  const pins = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if ((col + row) % 2 !== 1) continue;
      pins.push({
        i: pins.length,
        col,
        row,
        x: col - (GRID - 1) / 2,
        y: (GRID - 1) / 2 - row, // +y 가 화면 위쪽
        kind: KINDS[pins.length % 3],
      });
    }
  }
  return pins;
})();

export const UTENSIL_COUNT = PINS.length; // 24

/** 종류별 도구 인덱스 목록 */
export const PINS_BY_KIND = KINDS.reduce((acc, k) => {
  acc[k] = PINS.filter((p) => p.kind === k).map((p) => p.i);
  return acc;
}, {});

/**
 * 도구 하나가 점유하는 선분.
 * @param {number} i 도구 인덱스
 * @param {'H'|'V'} orient
 */
export function utensilSegment(i, orient) {
  const p = PINS[i];
  return orient === 'H'
    ? { x1: p.x - 1, y1: p.y, x2: p.x + 1, y2: p.y }
    : { x1: p.x, y1: p.y - 1, x2: p.x, y2: p.y + 1 };
}

// ── 함정 ───────────────────────────────────────────────────────────────────
// 좌·우 벽의 위/아래에 하나씩, 총 4개. 각 입구는 2유닛 길이.

export const TRAPS = [
  { id: 'LT', side: 'left', x: -HALF, from: 1, to: 3, label: '왼쪽 위' },
  { id: 'LB', side: 'left', x: -HALF, from: -3, to: -1, label: '왼쪽 아래' },
  { id: 'RT', side: 'right', x: HALF, from: 1, to: 3, label: '오른쪽 위' },
  { id: 'RB', side: 'right', x: HALF, from: -3, to: -1, label: '오른쪽 아래' },
];

export const TRAP_IDS = TRAPS.map((t) => t.id);

/** 마주보는 함정 쌍 (2인 플레이는 반드시 이 중 한 쌍) */
export const OPPOSITE = { LT: 'RB', RB: 'LT', LB: 'RT', RT: 'LB' };

export const getTrap = (id) => TRAPS.find((t) => t.id === id);

// ── 벽 선분 ────────────────────────────────────────────────────────────────

/**
 * 현재 상태에서 바퀴벌레가 부딪히는 모든 벽 선분.
 * @param {('H'|'V')[]} orients 도구 24개의 방향
 * @param {string[]} openTraps 열려 있는(차단문이 없는) 함정 id 목록
 */
export function wallSegments(orients, openTraps = TRAP_IDS) {
  const segs = [];
  for (let i = 0; i < UTENSIL_COUNT; i++) segs.push(utensilSegment(i, orients[i]));

  // 위·아래 벽은 항상 막혀 있다
  segs.push({ x1: -HALF, y1: HALF, x2: HALF, y2: HALF });
  segs.push({ x1: -HALF, y1: -HALF, x2: HALF, y2: -HALF });

  // 좌·우 벽은 열린 함정 입구만 뚫려 있다
  for (const x of [-HALF, HALF]) {
    const open = TRAPS.filter((t) => t.x === x && openTraps.includes(t.id)).sort((a, b) => a.from - b.from);
    let y = -HALF;
    for (const t of open) {
      if (t.from > y) segs.push({ x1: x, y1: y, x2: x, y2: t.from });
      y = t.to;
    }
    if (y < HALF) segs.push({ x1: x, y1: y, x2: x, y2: HALF });
  }
  return segs;
}

/** 바퀴벌레 중심이 판 밖으로 나갔다면 어느 함정에 빠진 것인지 */
export function trapHit(x, y, openTraps = TRAP_IDS) {
  for (const t of TRAPS) {
    if (!openTraps.includes(t.id)) continue;
    const out = t.x < 0 ? x < t.x : x > t.x;
    if (out && y > t.from && y < t.to) return t.id;
  }
  return null;
}
