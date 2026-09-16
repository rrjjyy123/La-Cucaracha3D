// 식사 도구 24개 — 포크·나이프·숟가락을 절차적으로 만들고 90° 회전시킨다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PINS } from '../game/board.js';
import { UNIT, UTENSIL_Y, UTENSIL_H, orientRotY } from './layout.js';
import { tween, ease } from './anim.js';

const L = UNIT - 0.02; // 핀에서 끝까지 (전체 길이 2L)
const W = 0.15; // 손잡이 반폭 — roach.js 의 WALL_HALF 와 같은 두께
const HEAD = 0.42; // 손잡이가 끝나고 머리가 시작되는 지점

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

const EX = { depth: UTENSIL_H, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 8 };

function extrude(shape) {
  const g = new THREE.ExtrudeGeometry(shape, EX);
  g.rotateX(-Math.PI / 2); // 눕힌다: 로컬 +x = 길이, 두께는 월드 Y
  return g;
}

function forkGeometry() {
  const parts = [extrude(barShape(-L, HEAD + 0.28, W))];
  // 넓어지는 목
  parts.push(extrude(barShape(HEAD + 0.1, HEAD + 0.34, W * 1.34)));
  // 살 4개
  const tipW = 0.048;
  for (let i = 0; i < 4; i++) {
    const y = (i - 1.5) * 0.098;
    const s = barShape(HEAD + 0.28, L, tipW);
    const g = extrude(s);
    g.translate(0, 0, -y); // 로컬 +y 는 -z 로 눕혀졌다
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

function knifeGeometry() {
  const parts = [extrude(barShape(-L, HEAD + 0.1, W))];
  const s = new THREE.Shape();
  s.moveTo(HEAD, 0.13);
  s.quadraticCurveTo(HEAD + 0.2, 0.24, HEAD + 0.45, 0.22);
  s.quadraticCurveTo(L - 0.05, 0.19, L, 0.02); // 칼끝
  s.quadraticCurveTo(L - 0.12, -0.13, HEAD + 0.5, -0.17);
  s.quadraticCurveTo(HEAD + 0.2, -0.18, HEAD, -0.13);
  s.closePath();
  parts.push(extrude(s));
  return mergeGeometries(parts, false);
}

function spoonGeometry() {
  const parts = [extrude(barShape(-L, HEAD + 0.22, W))];
  const s = new THREE.Shape();
  const cx = HEAD + 0.5;
  const rx = 0.42;
  const ry = 0.25;
  s.absellipse(cx, 0, rx, ry, 0, Math.PI * 2, false, 0);
  parts.push(extrude(s));
  return mergeGeometries(parts, false);
}

const GEOM = { fork: forkGeometry, knife: knifeGeometry, spoon: spoonGeometry };

export function createUtensils(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const geoms = {};
  for (const k of Object.keys(GEOM)) geoms[k] = GEOM[k]();

  const pinGeom = new THREE.CylinderGeometry(0.14, 0.15, UTENSIL_H + 0.14, 16);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x6d7379, roughness: 0.32, metalness: 0.85 });
  const glowGeom = new THREE.RingGeometry(0.24, 0.52, 28);

  const items = PINS.map((p) => {
    const g = new THREE.Group();
    g.position.set(p.x * UNIT, UTENSIL_Y, -p.y * UNIT);

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xe9ecef,
      roughness: 0.42,
      metalness: 0.06,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
      emissive: 0x000000,
    });
    const mesh = new THREE.Mesh(geoms[p.kind], mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);

    const pin = new THREE.Mesh(pinGeom, pinMat);
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
    glow.position.y = UTENSIL_H + 0.12;
    g.add(glow);

    // 터치하기 쉬운 넉넉한 히트 박스
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(L * 2, 0.7, 0.62),
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
    });
  }

  /** 도구 하나를 90° 돌린다 */
  function spin(i, orient, { onHalf } = {}) {
    const it = items[i];
    const from = it.group.rotation.y;
    const to = orientRotY(orient);
    // 항상 시계 방향으로 90° 돌아가게 보정
    const delta = orient === 'V' ? Math.PI / 2 : -Math.PI / 2;
    const target = from + delta;
    it.orient = orient;
    it.spinning = true;
    let halfDone = false;
    return tween({
      duration: 0.22,
      easing: ease.outBack,
      update: (k) => {
        it.group.rotation.y = from + (target - from) * k;
        it.group.position.y = UTENSIL_Y + Math.sin(Math.min(1, k) * Math.PI) * 0.12;
        if (!halfDone && k > 0.45) {
          halfDone = true;
          onHalf?.();
        }
      },
      complete: () => {
        it.group.rotation.y = to;
        it.group.position.y = UTENSIL_Y;
        it.spinning = false;
      },
    });
  }

  /** 지금 돌릴 수 있는 도구들을 빛나게 한다 */
  function setHighlight(indices) {
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
  function setHover(i) {
    hovered = i;
  }

  function update(_dt, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4.2);
    for (const it of items) {
      const on = it.hot;
      it.glow.material.opacity = on ? 0.45 + pulse * 0.45 : 0;
      const boost = it.i === hovered && on ? 0.6 : 0;
      if (on) {
        it.mat.emissive.setHex(0xffa23c);
        it.mat.emissiveIntensity = 0.3 + pulse * 0.28 + boost;
      }
      const s = it.i === hovered && on ? 1.06 : 1;
      it.group.scale.setScalar(it.group.scale.x + (s - it.group.scale.x) * 0.2);
    }
  }

  return { group, items, hitTargets, setOrients, spin, setHighlight, setHover, update };
}
