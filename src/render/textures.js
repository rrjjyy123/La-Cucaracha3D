// 절차적 텍스처 — 외부 이미지 없이 Canvas 로 만든다.
import * as THREE from 'three';

function makeNoise(seed) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256).map((_, i) => i);
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256).map(() => rand());
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, px = 256, py = 256) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    // perm 을 한 번 더 통과시켜 0..255 로 접어야 한다 (안 그러면 vals 범위를 넘어 NaN 이 나온다)
    const h = (a, b) => vals[perm[((((a % px) + px) % px) & 255) + perm[(((b % py) + py) % py) & 255]]];
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), xf), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), xf), yf);
  };
}

const hashi = (a, b, seed) => {
  let h = (a * 374761393 + b * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
const hashf = (a, b, seed) => hashi(a, b, seed) / 4294967296;

/**
 * 실물 게임판의 "주황색 조각돌(테라조)" 바닥.
 * 지터드 보로노이로 조각을 만들고, 조각 경계는 밝은 줄눈으로 남긴다.
 */
export function createTerrazzo({ size = 1024, cells = 26, seed = 11 } = {}) {
  const palette = [
    [236, 138, 46],
    [246, 168, 70],
    [216, 112, 34],
    [250, 196, 116],
    [228, 124, 40],
    [252, 214, 152],
    [208, 96, 30],
    [243, 156, 58],
  ];
  const grout = [253, 232, 196];
  const noise = makeNoise(seed);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const ctx = canvas.getContext('2d');
  const bctx = bump.getContext('2d');
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);

  const cs = size / cells; // 셀 한 변 (픽셀)

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // 경계를 울퉁불퉁하게 만들려고 좌표를 노이즈로 살짝 비튼다
      const wx = i + (noise((i / size) * 9, (j / size) * 9, 9, 9) - 0.5) * cs * 0.55;
      const wy = j + (noise((i / size) * 9 + 3.3, (j / size) * 9 + 7.1, 9, 9) - 0.5) * cs * 0.55;
      const ci = Math.floor(wx / cs);
      const cj = Math.floor(wy / cs);

      let f1 = 1e9;
      let f2 = 1e9;
      let best = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const a = ((ci + di) % cells + cells) % cells;
          const b = ((cj + dj) % cells + cells) % cells;
          const px = (ci + di + hashf(a, b, seed)) * cs;
          const py = (cj + dj + hashf(a, b, seed + 99)) * cs;
          const d = Math.hypot(wx - px, wy - py);
          if (d < f1) {
            f2 = f1;
            f1 = d;
            best = hashi(a, b, seed + 7) % palette.length;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }

      const edge = Math.min(1, (f2 - f1) / (cs * 0.17)); // 0 이면 조각 경계
      const c = palette[best];
      const grain = (noise((i / size) * 60, (j / size) * 60, 60, 60) - 0.5) * 26;
      const idx = (i + j * size) * 4;
      const k = edge * edge * (3 - 2 * edge); // smoothstep
      img.data[idx] = grout[0] + (c[0] - grout[0]) * k + grain;
      img.data[idx + 1] = grout[1] + (c[1] - grout[1]) * k + grain;
      img.data[idx + 2] = grout[2] + (c[2] - grout[2]) * k + grain;
      img.data[idx + 3] = 255;
      const b = 150 + k * 90 + grain * 0.7;
      bimg.data[idx] = bimg.data[idx + 1] = bimg.data[idx + 2] = b;
      bimg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  return finish(canvas, bump);
}

/** 트레이·테두리용 원목 결 */
export function createWood({ light, dark, rings = 14, seed = 1, size = 512, streak = 0.38 } = {}) {
  const noise = makeNoise(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const ctx = canvas.getContext('2d');
  const bctx = bump.getContext('2d');
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    const v = j / size;
    for (let i = 0; i < size; i++) {
      const u = i / size;
      const warp = noise(u * 4, v * 6, 4, 6) * 0.9 + noise(u * 8, v * 12, 8, 12) * 0.4;
      const d = v * rings + warp * 2.2;
      const ring = d - Math.floor(d);
      const ringT = Math.pow(Math.abs(Math.sin(ring * Math.PI)), 6);
      const fine = noise(u * 3, v * 180, 3, 180);
      const t = Math.min(1, ringT * 0.55 + fine * streak + noise(u * 40, v * 40, 40, 40) * 0.08);
      const idx = (i + j * size) * 4;
      img.data[idx] = light[0] + (dark[0] - light[0]) * t;
      img.data[idx + 1] = light[1] + (dark[1] - light[1]) * t;
      img.data[idx + 2] = light[2] + (dark[2] - light[2]) * t;
      img.data[idx + 3] = 255;
      const b = 255 - t * 110;
      bimg.data[idx] = bimg.data[idx + 1] = bimg.data[idx + 2] = b;
      bimg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  return finish(canvas, bump);
}

/** 함정 구덩이 바닥 — 어둡고 거친 돌바닥 */
export function createStone({ size = 512, seed = 5 } = {}) {
  const noise = makeNoise(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const ctx = canvas.getContext('2d');
  const bctx = bump.getContext('2d');
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size;
      const v = j / size;
      const n = noise(u * 12, v * 12, 12, 12) * 0.6 + noise(u * 40, v * 40, 40, 40) * 0.4;
      const idx = (i + j * size) * 4;
      const c = 34 + n * 46;
      img.data[idx] = c * 1.18;
      img.data[idx + 1] = c * 0.9;
      img.data[idx + 2] = c * 0.74;
      img.data[idx + 3] = 255;
      const b = 110 + n * 120;
      bimg.data[idx] = bimg.data[idx + 1] = bimg.data[idx + 2] = b;
      bimg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  return finish(canvas, bump);
}

function finish(canvas, bump) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

export function variant(tex, { offset = [0, 0], repeat = [1, 1], rotation = 0 } = {}) {
  const t = tex.clone();
  t.offset.set(offset[0], offset[1]);
  t.repeat.set(repeat[0], repeat[1]);
  t.rotation = rotation;
  t.needsUpdate = true;
  return t;
}

export const WOODS = {
  tray: { light: [104, 62, 38], dark: [48, 26, 15], rings: 16, streak: 0.42 },
  table: { light: [70, 42, 27], dark: [30, 17, 10], rings: 22, streak: 0.45 },
};
