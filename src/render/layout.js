// 게임 좌표(격자 유닛) ↔ 3D 월드 좌표
// 게임 좌표: 판 중심 (0,0), 가로/세로 -4..4, +y 가 화면 위쪽
// 월드 좌표: +x 오른쪽, -z 가 화면 위쪽(카메라는 +z 쪽에 있다)

export const UNIT = 1.3; // 격자 1유닛 = 월드 1.3
export const HALF = 4 * UNIT; // 판 안쪽 반지름 5.2
export const FIELD = HALF * 2;

export const FLOOR_Y = 0; // 게임판 바닥 윗면
export const UTENSIL_Y = 0.16; // 식사 도구가 놓이는 높이
export const UTENSIL_H = 0.3; // 도구 두께
export const RIM_W = 0.5; // 판 가장자리 턱 두께
export const RIM_H = 0.78; // 턱 높이
export const PIT_DEPTH = 1.15; // 함정 구덩이 깊이
export const PIT_W = 2.3; // 함정 구덩이 폭 (판 바깥쪽으로)
export const TRAY_LIP = 0.65; // 바깥 트레이 테두리 두께
export const TRAY_H = 1.35;

export const toWorldX = (gx) => gx * UNIT;
export const toWorldZ = (gy) => -gy * UNIT;
export const toWorld = (gx, gy) => ({ x: gx * UNIT, z: -gy * UNIT });
export const toGame = (wx, wz) => ({ x: wx / UNIT, y: -wz / UNIT });

/** 도구 방향 → Y축 회전. H(가로)는 월드 X축, V(세로)는 월드 Z축을 따른다. */
export const orientRotY = (o) => (o === 'H' ? 0 : Math.PI / 2);

/** 트레이 전체 크기 */
export const TRAY_W = FIELD + (RIM_W + PIT_W + TRAY_LIP) * 2;
export const TRAY_D = FIELD + (RIM_W + TRAY_LIP) * 2;
