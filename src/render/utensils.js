// 식사 도구 24개 — 포크·나이프·숟가락을 절차적으로 만들고 90° 회전시킨다.
// 위에서 내려다보는 시점이라 종류가 한눈에 구분되어야 한다:
//   ① 머리를 손잡이만큼 크게  ② 회전축 나사못 윗면에 종류 아이콘  ③ 종류별로 아주 살짝 다른 색조
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PINS } from '../game/board.js';
import { UNIT, UTENSIL_Y, UTENSIL_H, orientRotY } from './layout.js';
import { tween, ease } from './anim.js';
import { pinCapTexture } from './icons.js';

const L = UNIT - 0.02; // 핀에서 끝까지 (전체 길이 2L)
const W = 0.15; // 손잡이 반폭 — roach.js 의 WALL_HALF 와 같은 두께
const NECK = 0.18; // 손잡이가 끝나고 머리가 시작되는 지점

/** 종류별 색조 — 실물은 모두 흰색이지만 위에서 볼 때 구분되도록 아주 살짝 달리한다 */
const TINT = { fork: 0xdfe7ef, knife: 0xcdd3d9, spoon: 0xf3e9d7 };

/** 모서리가 둥근 막대 Shape */
function barShape(x0, x1, hw) {
  const s = new THREE.Shape();
  const r = Math.min(hw, (x1 - x0) / 2);
  s.moveTo(x0 + r, hw);
  s.lineTo(x1 - r, hw);
  s.quadraticCurveTo(x1, hw, x1, hw - r);
  s.lineTo(x1, -hw + r);
  s.quadraticCurveTo(x1, -hw, x1 - r, -hw);
  s.lineTo(x0 + r, -hw);
  s.quadraticCurveTo(x0, -hw, x0, -hw + r);
  s.lineTo(x0, hw - r);
  s.quadraticCurveTo(x0, hw, x0 + r, hw);
  return s;
}

const EX = { bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 10 };

/** Shape 를 눕혀서 압출 — 로컬 +x 가 길이, 두께는 월드 Y */
function extrude(shape, depth = UTENSIL_H) {
  const g = new THREE.ExtrudeGeometry(shape, { ...EX, depth });
  g.rotateX(-Math.PI / 2);
  return g;
}

function forkGeometry() {
  const parts = [extrude(barShape(-L, NECK + 0.22, W))];
  // 살을 받치는 넓은 목
  parts.push(extrude(barShape(NECK + 0.24, NECK + 0.42, 0.24)));
  // 살 4개 — 사이로 바닥이 비칠 만큼 벌린다
  for (let i = 0; i < 4; i++) {
    const y = (i - 1.5) * 0.125;
    const g = extrude(barShape(NECK + 0.36, L, 0.058));
    g.translate(0, 0, -y); // 로컬 +y 는 눕히면 -z 가 된다
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

function knifeGeometry() {
  const parts = [extrude(barShape(-L, NECK + 0.12, W))];
  const s = new THREE.Shape();
  s.moveTo(NECK, 0.14);
  s.quadraticCurveTo(NECK + 0.26, 0.3, NECK + 0.62, 0.28);
  s.quadraticCurveTo(L - 0.12, 0.25, L, 0.03); // 칼끝
  // 아래쪽 날에 톱니를 판다 (칼끝에서 손잡이 쪽으로)
  const teeth = 8;
  const x0 = L - 0.1;
  const x1 = NECK + 0.16;
  for (let i = 0; i < teeth; i++) {
    const t0 = i / teeth;
    const t1 = (i + 0.5) / teeth;
    s.lineTo(x0 + (x1 - x0) * t0, -0.06 - 0.14 * t0);
    s.lineTo(x0 + (x1 - x0) * t1, -0.06 - 0.14 * t1 + 0.06); // 톱니 골
  }
  s.lineTo(NECK + 0.1, -0.19);
  s.lineTo(NECK, -0.13);
  s.closePath();
  parts.push(extrude(s));
  return mergeGeometries(parts, false);
}

function spoonGeometry() {
  // 잘록한 목
  const parts = [extrude(barShape(-L, NECK + 0.24, W * 0.86))];
  const cx = NECK + 0.66;
  const rx = 0.44;
  const ry = 0.31;
  // 솟은 테두리 (바깥 타원 − 안쪽 타원)
  const rim = new THREE.Shape();
  rim.absellipse(cx, 0, rx, ry, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(cx, 0, rx - 0.1, ry - 0.09, 0, Math.PI * 2, true, 0);
  rim.holes.push(hole);
  parts.push(extrude(rim));
  // 한 단 낮은 볼 바닥 — 위에서 보면 오목하게 파여 보인다
  const floor = new THREE.Shape();
  floor.absellipse(cx, 0, rx - 0.07, ry - 0.06, 0, Math.PI * 2, false, 0);
  parts.push(extrude(floor, UTENSIL_H * 0.42));
  return mergeGeometries(parts, false);
}

const GEOM = { fork: forkGeometry, knife: knifeGeometry, spoon: spoonGeometry };

export function createUtensils(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const geoms = {};
  const capMats = {};
  for (const k of Object.keys(GEOM)) {
    geoms[k] = GEOM[k]();
    // 원기둥 머티리얼 순서: [옆면, 윗면, 아랫면] — 윗면에만 아이콘을 새긴다
    capMats[k] = [
      new THREE.MeshStandardMaterial({ color: 0x6d7379, roughness: 0.34, metalness: 0.85 }),
      new THREE.MeshStandardMaterial({ map: pinCapTexture(k), roughness: 0.62, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x555b60, roughness: 0.5, metalness: 0.6 }),
    ];
  }

  const pinGeom = new THREE.CylinderGeometry(0.28, 0.29, UTENSIL_H + 0.18, 28);
  const glowGeom = new THREE.RingGeometry(0.34, 0.66, 28);

  const items = PINS.map((p) => {
    const g = new THREE.Group();
    g.position.set(p.x * UNIT, UTENSIL_Y, -p.y * UNIT);

    const mat = new THREE.MeshPhysicalMaterial({
      color: TINT[p.kind],
      roughness: 0.4,
      metalness: 0.07,
      clearcoat: 0.6,
      clearcoatRoughness: 0.32,
      emissive: 0x000000,
    });
    const mesh = new THREE.Mesh(geoms[p.kind], mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);

    const pin = new THREE.Mesh(pinGeom, capMats[p.kind]);
    pin.position.y = UTENSIL_H / 2;
    pin.castShadow = true;
    g.add(pin);

    // 돌릴 수 있을 때 켜지는 고리
    const glow = new THREE.Mesh(
      glowGeom,
      new THREE.MeshBasicMaterial({
        color: 0xffd479,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = UTENSIL_H + 0.16;
    g.add(glow);

    // 터치하기 쉬운 넉넉한 히트 박스
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(L * 2, 0.7, 0.72),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 0.3;
    hit.userData.index = p.i;
    g.add(hit);

    group.add(g);
    return { i: p.i, kind: p.kind, group: g, mesh, mat, glow, hit, orient: 'H', spinning: false };
  });

  const hitTargets = items.map((it) => it.hit);

  /** 방향 배열을 즉시 적용 (애니메이션 없이) */
  function setOrients(orients) {
    items.forEach((it, i) => {
      it.orient = orients[i];
      it.group.rotation.y = orientRotY(orients[i]);
      it.group.position.y = UTENSIL_Y;
    });
  }

  /** 도구 하나를 90° 돌린다 */
  function spin(i, orient) {
    const it = items[i];
    const from = it.group.rotation.y;
    const to = orientRotY(orient);
    const delta = orient === 'V' ? Math.PI / 2 : -Math.PI / 2;
    const target = from + delta;
    it.orient = orient;
    it.spinning = true;
    return tween({
      duration: 0.22,
      easing: ease.outBack,
      update: (k) => {
        it.group.rotation.y = from + (target - from) * k;
        it.group.position.y = UTENSIL_Y + Math.sin(Math.min(1, k) * Math.PI) * 0.12;
      },
      complete: () => {
        it.group.rotation.y = to;
        it.group.position.y = UTENSIL_Y;
        it.spinning = false;
      },
    });
  }

  let soft = false;

  /** 지금 돌릴 수 있는 도구들을 빛나게 한다. soft 는 편집 모드처럼 전부 켤 때 눈이 아프지 않게. */
  function setHighlight(indices, opts = {}) {
    soft = !!opts.soft;
    const set = new Set(indices);
    for (const it of items) {
      it.hot = set.has(it.i);
      if (!it.hot) {
        it.mat.emissive.setHex(0x000000);
        it.mat.emissiveIntensity = 0;
      }
    }
  }

  let hovered = -1;
  const setHover = (i) => {
    hovered = i;
  };

  function update(_dt, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4.2);
    for (const it of items) {
      const on = it.hot;
      const k = soft ? 0.38 : 1;
      it.glow.material.opacity = on ? (0.3 + pulse * 0.32) * k : 0;
      const boost = it.i === hovered && on ? 0.5 : 0;
      if (on) {
        it.mat.emissive.setHex(0xffa23c);
        it.mat.emissiveIntensity = (0.22 + pulse * 0.2) * k + boost;
      }
      const s = it.i === hovered && on ? 1.06 : 1;
      it.group.scale.setScalar(it.group.scale.x + (s - it.group.scale.x) * 0.2);
    }
  }

  return { group, items, hitTargets, setOrients, spin, setHighlight, setHover, update };
}
