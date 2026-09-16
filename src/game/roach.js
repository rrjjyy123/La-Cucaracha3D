// 라쿠카라차(HEXBUG nano) 움직임 시뮬레이션.
// 실물은 진동으로 앞으로 나아가다가 벽에 부딪히면 제멋대로 방향을 틀어 새 길을 찾는다.
// 여기서는 고정 타임스텝으로 "전진 + 미세 떨림 + 벽 미끄러짐"을 계산해 그 느낌을 재현한다.
// 렌더링과 무관한 순수 로직이라 테스트에서 그대로 돌릴 수 있다.

const TAU = Math.PI * 2;

export const ROACH_R = 0.2; // 몸 반지름 (유닛)
export const WALL_HALF = 0.115; // 식사 도구 막대의 반 두께
export const CLEARANCE = ROACH_R + WALL_HALF;
export const STEP = 1 / 120; // 물리 고정 타임스텝(초)

/** 난이도별 이동 속도 (유닛/초) */
export const SPEEDS = { slow: 1.5, normal: 2.3, fast: 3.2 };
export const SPEED_LABEL = { slow: '느림', normal: '보통', fast: '빠름' };

export function createRoach(speed = SPEEDS.normal, rng = Math.random) {
  const heading = rng() * TAU;
  return {
    x: 0,
    y: 0,
    heading,
    turn: 0, // 현재 각속도 (rad/s)
    speed,
    legPhase: 0, // 다리 애니메이션용
    bump: 0, // 방금 벽에 부딪혔으면 1 에서 감쇠
    stuckT: 0,
    markX: 0,
    markY: 0,
  };
}

/** 점 → 선분 최근접점 */
function closest(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - s.x1) * dx + (py - s.y1) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { cx: s.x1 + t * dx, cy: s.y1 + t * dy };
}

/**
 * 겹친 벽 밖으로 밀어낸다.
 * @returns {{nx:number, ny:number, hit:boolean}} 밀어낸 방향(정규화)
 */
export function pushOut(roach, walls, iterations = 3) {
  let sumX = 0;
  let sumY = 0;
  let hit = false;
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const s of walls) {
      const { cx, cy } = closest(roach.x, roach.y, s);
      let dx = roach.x - cx;
      let dy = roach.y - cy;
      let d = Math.hypot(dx, dy);
      if (d >= CLEARANCE) continue;
      if (d < 1e-6) {
        // 정확히 선 위 — 선분에 수직인 방향으로 빼낸다
        const sx = s.x2 - s.x1;
        const sy = s.y2 - s.y1;
        const l = Math.hypot(sx, sy) || 1;
        dx = -sy / l;
        dy = sx / l;
        d = 1e-6;
      }
      const nx = dx / d;
      const ny = dy / d;
      const push = CLEARANCE - d;
      roach.x += nx * push;
      roach.y += ny * push;
      sumX += nx;
      sumY += ny;
      hit = true;
      moved = true;
    }
    if (!moved) break;
  }
  const l = Math.hypot(sumX, sumY);
  return l > 1e-6 ? { nx: sumX / l, ny: sumY / l, hit } : { nx: 0, ny: 0, hit };
}

/**
 * 물리 한 스텝. walls 는 board.wallSegments() 결과.
 * @returns {boolean} 이번 스텝에 벽에 부딪혔는지
 */
export function stepRoach(roach, walls, dt = STEP, rng = Math.random) {
  // 1) 헥스버그 특유의 미세한 방향 떨림 (각속도 랜덤워크 + 감쇠)
  roach.turn += (rng() * 2 - 1) * 26 * dt;
  roach.turn *= Math.exp(-4 * dt);
  if (roach.turn > 4) roach.turn = 4;
  if (roach.turn < -4) roach.turn = -4;
  roach.heading += roach.turn * dt;

  // 2) 전진
  const dist = roach.speed * dt;
  roach.x += Math.cos(roach.heading) * dist;
  roach.y += Math.sin(roach.heading) * dist;
  roach.legPhase += dist * 9;

  // 3) 벽 충돌 → 밀어내고 접선 방향으로 미끄러진다
  const { nx, ny, hit } = pushOut(roach, walls);
  if (hit) {
    const cx = Math.cos(roach.heading);
    const cy = Math.sin(roach.heading);
    const into = cx * nx + cy * ny;
    if (into < 0) {
      let tx = cx - into * nx;
      let ty = cy - into * ny;
      let len = Math.hypot(tx, ty);
      if (len < 0.25) {
        // 거의 정면 충돌 — 좌우 중 하나로 튼다
        const s = rng() < 0.5 ? 1 : -1;
        tx = -ny * s;
        ty = nx * s;
        len = 1;
      }
      tx = tx / len + nx * 0.14; // 벽에서 살짝 떨어지도록
      ty = ty / len + ny * 0.14;
      roach.heading = Math.atan2(ty, tx) + (rng() - 0.5) * 0.4;
      roach.turn *= 0.3;
      roach.bump = 1;
    }
  }
  roach.bump *= Math.exp(-6 * dt);

  // 4) 구석에 박혀 못 나오면 살짝 밀어준다 (룰북의 "살짝 옆으로 밀어주세요")
  roach.stuckT += dt;
  if (roach.stuckT >= 1.2) {
    const moved = Math.hypot(roach.x - roach.markX, roach.y - roach.markY);
    if (moved < 0.35) {
      roach.heading = Math.atan2(-roach.y, -roach.x) + (rng() - 0.5) * 1.6; // 판 가운데 쪽으로
      roach.turn = 0;
    }
    roach.stuckT = 0;
    roach.markX = roach.x;
    roach.markY = roach.y;
  }
  return hit;
}

/**
 * 식사 도구를 돌린 직후 호출. 새 벽에 끼었으면 빼낸다.
 * (룰북: "식사 도구를 돌릴 때 라쿠카라차가 끼지 않도록 주의하세요.")
 */
export function unpinch(roach, walls, rng = Math.random) {
  const before = { x: roach.x, y: roach.y };
  pushOut(roach, walls, 8);
  const shifted = Math.hypot(roach.x - before.x, roach.y - before.y);
  if (shifted > 1e-4) {
    roach.heading = Math.atan2(roach.y - before.y, roach.x - before.x) + (rng() - 0.5) * 0.8;
    roach.turn = 0;
    roach.bump = 1;
  }
  return shifted;
}
