// 3D 주사위 — 6면: 나이프 1 · 포크 1 · 숟가락 1 · 물음표 3
import * as THREE from 'three';
import { DIE_FACES } from '../game/dice.js';
import { tween, ease } from './anim.js';

const SIZE = 0.92;

/** 면이 위로 오게 하는 회전값 (BoxGeometry 재질 순서: +x, -x, +y, -y, +z, -z) */
const FACE_UP = [
  { x: 0, z: Math.PI / 2 },
  { x: 0, z: -Math.PI / 2 },
  { x: 0, z: 0 },
  { x: Math.PI, z: 0 },
  { x: -Math.PI / 2, z: 0 },
  { x: Math.PI / 2, z: 0 },
];

function faceTexture(face) {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#f6efe2';
  g.fillRect(0, 0, s, s);
  // 살짝 낡은 느낌
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(150,130,100,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  g.strokeStyle = '#3a2c1c';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = '#3a2c1c';

  const cx = s / 2;
  if (face === 'any') {
    g.font = 'bold 150px "Noto Sans KR", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cx, cx + 6);
  } else if (face === 'fork') {
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(cx, 150);
    g.lineTo(cx, 208);
    g.stroke();
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(cx + i * 30, 52);
      g.lineTo(cx + i * 30, 112);
      g.stroke();
    }
    g.lineWidth = 15;
    g.beginPath();
    g.moveTo(cx - 32, 112);
    g.lineTo(cx + 32, 112);
    g.lineTo(cx + 18, 150);
    g.lineTo(cx - 18, 150);
    g.closePath();
    g.fill();
  } else if (face === 'knife') {
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(cx, 148);
    g.lineTo(cx, 208);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 20, 148);
    g.quadraticCurveTo(cx - 26, 80, cx - 6, 48);
    g.quadraticCurveTo(cx + 22, 86, cx + 18, 148);
    g.closePath();
    g.fill();
  } else {
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(cx, 140);
    g.lineTo(cx, 208);
    g.stroke();
    g.beginPath();
    g.ellipse(cx, 96, 36, 50, 0, 0, Math.PI * 2);
    g.fill();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createDice(scene, { x = 0, y = 0, z = 0 } = {}) {
  const mats = DIE_FACES.map(
    (f) => new THREE.MeshStandardMaterial({ map: faceTexture(f), roughness: 0.52, metalness: 0.02 }),
  );
  const geom = new THREE.BoxGeometry(SIZE, SIZE, SIZE, 2, 2, 2);
  const mesh = new THREE.Mesh(geom, mats);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const home = mesh.position.clone();
  let idle = 0;

  /** 굴려서 index 면이 위로 오게 한다 */
  function rollTo(index) {
    const target = FACE_UP[index % 6];
    const spins = 3 + Math.floor(Math.random() * 2);
    const fromX = mesh.rotation.x;
    const fromY = mesh.rotation.y;
    const fromZ = mesh.rotation.z;
    const toX = target.x + Math.PI * 2 * spins;
    const toY = Math.PI * 2 * (1 + Math.floor(Math.random() * 2));
    const toZ = target.z + Math.PI * 2 * spins;
    return tween({
      duration: 0.95,
      easing: ease.out,
      update: (k, raw) => {
        mesh.rotation.x = fromX + (toX - fromX) * k;
        mesh.rotation.y = fromY + (toY - fromY) * k;
        mesh.rotation.z = fromZ + (toZ - fromZ) * k;
        mesh.position.y = home.y + Math.sin(raw * Math.PI) * 1.5 + Math.abs(Math.sin(raw * Math.PI * 4)) * (1 - raw) * 0.35;
      },
      complete: () => {
        mesh.rotation.set(target.x, 0, target.z);
        mesh.position.copy(home);
      },
    });
  }

  function update(dt, time) {
    idle = time;
    mesh.position.y = home.y + Math.sin(time * 2.2) * 0.012;
  }

  return { mesh, rollTo, update };
}
