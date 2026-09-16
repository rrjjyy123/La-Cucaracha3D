// 라쿠카라차 — HEXBUG nano 를 닮은 진동형 로봇 바퀴벌레
import * as THREE from 'three';
import { UNIT } from './layout.js';
import { tween, ease } from './anim.js';

const BODY_Y = 0.2;

export function createRoach3D(scene) {
  const group = new THREE.Group();
  group.position.y = BODY_Y;
  scene.add(group);

  const body = new THREE.Group();
  group.add(body);

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xb4501c,
    roughness: 0.3,
    metalness: 0.25,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
    emissive: 0x2a0d00,
    emissiveIntensity: 0.4,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b1810, roughness: 0.55, metalness: 0.35 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1d130d, roughness: 0.7, metalness: 0.2 });

  // 몸통 — 납작한 타원체
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), shellMat);
  abdomen.scale.set(1.25, 0.46, 0.92);
  abdomen.position.x = -0.1;
  abdomen.castShadow = true;
  body.add(abdomen);

  // 등껍질 무늬
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 10), darkMat);
  stripe.scale.set(1.35, 0.4, 0.55);
  stripe.position.set(-0.12, 0.07, 0);
  body.add(stripe);

  // 머리
  const head = new THREE.Group();
  head.position.set(0.3, 0.02, 0);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 12), shellMat);
  skull.scale.set(0.95, 0.85, 1);
  skull.castShadow = true;
  head.add(skull);

  // 커다란 만화풍 눈 (원작 토큰 그림처럼)
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.2 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(0.1, 0.13, s * 0.11);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), eyeWhite);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), pupilMat);
    p.position.set(0.07, 0.01, 0);
    e.add(w, p);
    head.add(e);
    eyes.push(p);
  }

  // 더듬이
  const antennaGeom = new THREE.CylinderGeometry(0.012, 0.02, 0.5, 6);
  const antennae = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(antennaGeom, legMat);
    a.position.set(0.18, 0.16, s * 0.07);
    a.rotation.z = -1.0;
    a.rotation.x = s * 0.35;
    head.add(a);
    antennae.push(a);
  }

  // 다리 12개 (헥스버그 nano 와 같은 개수)
  const legGeom = new THREE.CylinderGeometry(0.018, 0.01, 0.3, 5);
  const legs = [];
  for (let i = 0; i < 6; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeom, legMat);
      leg.position.set(0.16 - i * 0.1, -0.06, s * 0.2);
      leg.rotation.x = s * 0.95;
      leg.rotation.z = 0.25;
      body.add(leg);
      legs.push({ mesh: leg, phase: (i + (s > 0 ? 3 : 0)) * 1.05, side: s });
    }
  }

  let fallen = false;

  /** 물리 상태를 화면에 반영 */
  function sync(r, dt, time) {
    if (fallen) return;
    group.position.x = r.x * UNIT;
    group.position.z = -r.y * UNIT;
    group.rotation.y = r.heading;

    // 진동으로 나아가는 느낌 — 몸이 잘게 떨린다
    const buzz = Math.sin(time * 52) * 0.012 + Math.sin(time * 31.3) * 0.008;
    group.position.y = BODY_Y + Math.abs(Math.sin(r.legPhase * 0.5)) * 0.022 + buzz;
    body.rotation.z = Math.sin(r.legPhase * 0.5) * 0.06 + buzz * 0.6;
    body.rotation.x = Math.sin(time * 44) * 0.02;

    for (const l of legs) {
      const k = Math.sin(r.legPhase + l.phase);
      l.mesh.rotation.z = 0.25 + k * 0.42;
      l.mesh.rotation.y = k * 0.22;
    }
    for (let i = 0; i < antennae.length; i++) {
      antennae[i].rotation.z = -1.0 + Math.sin(time * 6.5 + i * 2.1) * 0.22;
    }
    // 부딪히면 눈이 커진다
    const startle = 1 + r.bump * 0.45;
    eyes.forEach((p) => p.scale.setScalar(startle));
  }

  /** 함정으로 미끄러져 떨어지는 연출 */
  function fallInto(target) {
    fallen = true;
    const from = group.position.clone();
    const rot = group.rotation.y;
    return tween({
      duration: 0.95,
      easing: ease.in,
      update: (k, raw) => {
        group.position.x = from.x + (target.x - from.x) * raw;
        group.position.z = from.z + (target.z - from.z) * raw;
        group.position.y = from.y + (target.y - from.y) * k - Math.sin(raw * Math.PI) * 0.25;
        group.rotation.y = rot + raw * 5.5;
        body.rotation.x = raw * Math.PI * 1.6; // 뒤집히면서 떨어진다
        body.rotation.z = raw * 1.2;
      },
    });
  }

  function reset() {
    fallen = false;
    body.rotation.set(0, 0, 0);
    group.position.set(0, BODY_Y, 0);
  }

  return { group, sync, fallInto, reset, get fallen() { return fallen; } };
}
