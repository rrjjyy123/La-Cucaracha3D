// 게임판 3D — 바깥 트레이, 조각돌 바닥, 가장자리 턱, 네 모서리 함정 구덩이, 차단문
import * as THREE from 'three';
import { TRAPS } from '../game/board.js';
import { createTerrazzo, createWood, createStone, variant, WOODS } from './textures.js';
import {
  UNIT,
  HALF,
  FIELD,
  RIM_W,
  RIM_H,
  PIT_DEPTH,
  PIT_W,
  TRAY_LIP,
  TRAY_H,
  toWorldZ,
} from './layout.js';

const OUT = HALF + RIM_W; // 턱 바깥면
const PIT_OUT = OUT + PIT_W; // 구덩이 바깥면
const TRAY_X = PIT_OUT + TRAY_LIP;
const TRAY_Z = OUT + TRAY_LIP;

/** 함정 입구의 월드 z 범위 (게임 y 가 클수록 -z) */
export function trapZRange(trap) {
  const a = toWorldZ(trap.to);
  const b = toWorldZ(trap.from);
  return [Math.min(a, b), Math.max(a, b)];
}

export function createBoard(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const terrazzo = createTerrazzo({ size: 1024, cells: 30 });
  const wood = createWood({ ...WOODS.tray, size: 512 });
  const table = createWood({ ...WOODS.table, size: 512 });
  const stone = createStone({ size: 512 });

  // ── 식탁 ──────────────────────────────────────────────────────────────
  const tableMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      map: variant(table.map, { repeat: [40, 40] }),
      bumpMap: variant(table.bumpMap, { repeat: [40, 40] }),
      bumpScale: 0.5,
      roughness: 0.82,
      metalness: 0,
    }),
  );
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = -TRAY_H - 0.02;
  tableMesh.receiveShadow = true;
  group.add(tableMesh);

  const woodMat = new THREE.MeshStandardMaterial({
    map: variant(wood.map, { repeat: [7, 7] }),
    bumpMap: variant(wood.bumpMap, { repeat: [7, 7] }),
    bumpScale: 0.4,
    roughness: 0.66,
    metalness: 0.03,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: variant(stone.map, { repeat: [2, 2] }),
    bumpMap: variant(stone.bumpMap, { repeat: [2, 2] }),
    bumpScale: 0.7,
    roughness: 0.94,
    metalness: 0,
  });

  const box = (w, h, d, mat, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // ── 바깥 트레이 ───────────────────────────────────────────────────────
  box(TRAY_X * 2, TRAY_H, TRAY_Z * 2, woodMat, 0, -TRAY_H / 2 - PIT_DEPTH / 2, 0, false);
  const lipH = TRAY_H * 0.62;
  box(TRAY_X * 2, lipH, TRAY_LIP, woodMat, 0, lipH / 2 - PIT_DEPTH, TRAY_Z - TRAY_LIP / 2, false);
  box(TRAY_X * 2, lipH, TRAY_LIP, woodMat, 0, lipH / 2 - PIT_DEPTH, -(TRAY_Z - TRAY_LIP / 2), false);
  box(TRAY_LIP, lipH, TRAY_Z * 2, woodMat, TRAY_X - TRAY_LIP / 2, lipH / 2 - PIT_DEPTH, 0, false);
  box(TRAY_LIP, lipH, TRAY_Z * 2, woodMat, -(TRAY_X - TRAY_LIP / 2), lipH / 2 - PIT_DEPTH, 0, false);

  // ── 게임판 본체 ───────────────────────────────────────────────────────
  const slabH = 0.55;
  box(FIELD + RIM_W * 2, slabH, FIELD + RIM_W * 2, woodMat, 0, -slabH / 2, 0, false);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD, FIELD),
    new THREE.MeshStandardMaterial({
      map: variant(terrazzo.map, { repeat: [1, 1] }),
      bumpMap: variant(terrazzo.bumpMap, { repeat: [1, 1] }),
      bumpScale: 0.35,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.012; // 슬래브 윗면과 겹쳐 z-파이팅이 나지 않도록
  floor.receiveShadow = true;
  group.add(floor);

  // ── 가장자리 턱 (함정 입구는 뚫려 있다) ────────────────────────────────
  const rimY = RIM_H / 2;
  box(FIELD + RIM_W * 2, RIM_H, RIM_W, stoneMat, 0, rimY, -(HALF + RIM_W / 2));
  box(FIELD + RIM_W * 2, RIM_H, RIM_W, stoneMat, 0, rimY, HALF + RIM_W / 2);

  for (const sign of [-1, 1]) {
    const traps = TRAPS.filter((t) => Math.sign(t.x) === sign)
      .map(trapZRange)
      .sort((a, b) => a[0] - b[0]);
    let z = -HALF;
    const pieces = [];
    for (const [z0, z1] of traps) {
      if (z0 > z) pieces.push([z, z0]);
      z = z1;
    }
    if (z < HALF) pieces.push([z, HALF]);
    for (const [z0, z1] of pieces) {
      box(RIM_W, RIM_H, z1 - z0, stoneMat, sign * (HALF + RIM_W / 2), rimY, (z0 + z1) / 2);
    }
  }

  // ── 함정 구덩이 ───────────────────────────────────────────────────────
  const trapParts = {};
  for (const t of TRAPS) {
    const [z0, z1] = trapZRange(t);
    const sign = Math.sign(t.x);
    const cx = sign * (OUT + PIT_W / 2);
    const cz = (z0 + z1) / 2;
    const depth = z1 - z0 + RIM_W * 2;

    // 구덩이 바닥 — 함정 주인 색으로 은은하게 빛난다
    const pitFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(PIT_W, depth),
      new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.92, emissive: 0x000000 }),
    );
    pitFloor.rotation.x = -Math.PI / 2;
    pitFloor.position.set(cx, -PIT_DEPTH, cz);
    pitFloor.receiveShadow = true;
    group.add(pitFloor);

    // 구덩이 앞뒤 칸막이
    for (const s of [-1, 1]) {
      box(PIT_W, PIT_DEPTH + RIM_H, RIM_W, stoneMat, cx, (RIM_H - PIT_DEPTH) / 2, cz + s * (depth / 2 - RIM_W / 2));
    }
    // 구덩이 바깥벽
    box(RIM_W, PIT_DEPTH + RIM_H, depth, stoneMat, sign * (PIT_OUT - RIM_W / 2), (RIM_H - PIT_DEPTH) / 2, cz);

    // 판에서 구덩이로 이어지는 경사 (라쿠카라차가 미끄러져 떨어진다)
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(RIM_W * 1.9, 0.12, z1 - z0),
      new THREE.MeshStandardMaterial({ color: 0xc8541c, roughness: 0.5, metalness: 0.12, emissive: 0x000000 }),
    );
    ramp.position.set(sign * (HALF + RIM_W * 0.5), -0.16, cz);
    ramp.rotation.z = sign * 0.32;
    ramp.receiveShadow = true;
    group.add(ramp);

    // 주인 표시 띠
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(PIT_W * 0.82, 0.1, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0x000000, roughness: 0.4 }),
    );
    trim.position.set(cx, -PIT_DEPTH + 0.06, cz + depth / 2 - RIM_W - 0.2);
    group.add(trim);

    // 차단문 — 막힌 함정에만 세운다
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(RIM_W * 0.8, RIM_H * 1.15, z1 - z0),
      new THREE.MeshStandardMaterial({ color: 0xb8451a, roughness: 0.45, metalness: 0.15 }),
    );
    door.position.set(sign * (HALF + RIM_W / 2), (RIM_H * 1.15) / 2, cz);
    door.castShadow = true;
    door.receiveShadow = true;
    group.add(door);

    trapParts[t.id] = { door, trim, ramp, pitFloor, center: { x: cx, z: cz }, pitY: -PIT_DEPTH };
  }

  /** 열린 함정은 차단문을 치우고, 주인 색으로 띠를 칠한다 */
  function setTraps(openTraps, ownerColors = {}) {
    for (const t of TRAPS) {
      const p = trapParts[t.id];
      const open = openTraps.includes(t.id);
      p.door.visible = !open;
      p.ramp.visible = open;
      const c = ownerColors[t.id];
      p.trim.material.color.set(open && c ? c : 0x4a3a30);
      p.trim.material.emissive.set(open && c ? c : 0x000000);
      p.trim.material.emissiveIntensity = open && c ? 0.6 : 0;
      p.pitFloor.material.color.set(open && c ? c : 0x2a1a12);
      p.pitFloor.material.emissive.set(open && c ? c : 0x000000);
      p.pitFloor.material.emissiveIntensity = open && c ? 0.4 : 0;
      p.ramp.material.color.set(c ?? 0xc8541c);
      p.ramp.material.emissive.set(c ?? 0x000000);
      p.ramp.material.emissiveIntensity = c ? 0.26 : 0;
    }
  }

  return { group, setTraps, trapParts, floor };
}
