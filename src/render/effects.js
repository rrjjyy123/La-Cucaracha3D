// 연출 — 함정 낙하 먼지, 승리 컨페티, 화면 흔들림
import * as THREE from 'three';

function pointTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createEffects(scene, shakeTarget) {
  const MAX = 420;
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const sizes = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const spin = new Float32Array(MAX);
  let cursor = 0;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.3,
    map: pointTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  scene.add(points);

  const tint = new THREE.Color();

  function emit(x, y, z, { color = 0xffc47a, count = 30, speed = 2.4, spread = 1, up = 2.2, ttl = 0.9, gravity = 6 } = {}) {
    tint.set(color);
    for (let n = 0; n < count; n++) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed * spread;
      positions[i * 3] = x + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = y + Math.random() * 0.2;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
      vel[i * 3] = Math.cos(a) * r;
      vel[i * 3 + 1] = up * (0.5 + Math.random());
      vel[i * 3 + 2] = Math.sin(a) * r;
      colors[i * 3] = tint.r * (0.75 + Math.random() * 0.45);
      colors[i * 3 + 1] = tint.g * (0.75 + Math.random() * 0.45);
      colors[i * 3 + 2] = tint.b * (0.75 + Math.random() * 0.45);
      sizes[i] = 0.16 + Math.random() * 0.3;
      life[i] = maxLife[i] = ttl * (0.7 + Math.random() * 0.6);
      spin[i] = gravity;
    }
  }

  /** 함정에 빠졌을 때 먼지 */
  const dust = (x, y, z, color) => emit(x, y, z, { color, count: 46, speed: 2.1, up: 2.6, ttl: 1.1 });

  /** 승리 컨페티 — 위에서 쏟아진다 */
  function confetti(color = 0xffd479) {
    for (let i = 0; i < 4; i++) {
      emit((Math.random() - 0.5) * 12, 9 + Math.random() * 3, (Math.random() - 0.5) * 10, {
        color: [color, 0xffffff, 0x8be36b, 0x57c7ff][i % 4],
        count: 55,
        speed: 1.2,
        up: -0.4,
        ttl: 2.6,
        gravity: 3.2,
      });
    }
  }

  let shake = 0;
  const shakeBase = shakeTarget ? shakeTarget.position.clone() : null;
  const addShake = (v) => {
    shake = Math.max(shake, v);
  };

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) {
        sizes[i] = 0;
        continue;
      }
      life[i] -= dt;
      vel[i * 3 + 1] -= spin[i] * dt;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const k = Math.max(0, life[i] / maxLife[i]);
      sizes[i] = 0.3 * k;
      colors[i * 3] *= 1 - dt * 0.15;
      colors[i * 3 + 1] *= 1 - dt * 0.2;
      colors[i * 3 + 2] *= 1 - dt * 0.25;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    geom.attributes.size.needsUpdate = true;

    if (shakeTarget && shakeBase) {
      if (shake > 0.001) {
        shake *= Math.exp(-7 * dt);
        shakeTarget.position.set(
          shakeBase.x + (Math.random() - 0.5) * shake,
          shakeBase.y + (Math.random() - 0.5) * shake * 0.6,
          shakeBase.z + (Math.random() - 0.5) * shake,
        );
      } else {
        shakeTarget.position.copy(shakeBase);
      }
    }
  }

  return { emit, dust, confetti, shake: addShake, update };
}
