// 식사 도구 아이콘 그리기 — 주사위 면과 회전축 나사못이 같은 그림을 쓴다.
import * as THREE from 'three';

/**
 * 1×1 정규화 좌표계로 아이콘을 그린다. 호출 전에 ctx.fillStyle / strokeStyle 을 정해 둘 것.
 * @param {CanvasRenderingContext2D} g
 * @param {'fork'|'knife'|'spoon'|'any'} kind
 * @param {number} s 캔버스 한 변
 */
export function drawUtensilIcon(g, kind, s) {
  const u = s / 256; // 256 기준으로 그리고 배율만 맞춘다
  const cx = s / 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (kind === 'any') {
    g.font = `bold ${150 * u}px "Jua", "Noto Sans KR", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cx, cx + 6 * u);
    return;
  }

  if (kind === 'fork') {
    // 손잡이
    g.lineWidth = 15 * u;
    g.beginPath();
    g.moveTo(cx, 150 * u);
    g.lineTo(cx, 212 * u);
    g.stroke();
    // 살 4개
    g.lineWidth = 12 * u;
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * 24 * u;
      g.beginPath();
      g.moveTo(x, 44 * u);
      g.lineTo(x, 104 * u);
      g.stroke();
    }
    // 살을 모으는 목
    g.beginPath();
    g.moveTo(cx - 42 * u, 100 * u);
    g.lineTo(cx + 42 * u, 100 * u);
    g.lineTo(cx + 16 * u, 152 * u);
    g.lineTo(cx - 16 * u, 152 * u);
    g.closePath();
    g.fill();
    return;
  }

  if (kind === 'knife') {
    g.lineWidth = 15 * u;
    g.beginPath();
    g.moveTo(cx, 150 * u);
    g.lineTo(cx, 212 * u);
    g.stroke();
    // 한쪽으로 휜 칼날
    g.beginPath();
    g.moveTo(cx - 22 * u, 152 * u);
    g.quadraticCurveTo(cx - 30 * u, 82 * u, cx - 6 * u, 40 * u);
    g.quadraticCurveTo(cx + 26 * u, 84 * u, cx + 20 * u, 152 * u);
    g.closePath();
    g.fill();
    // 톱니
    g.lineWidth = 5 * u;
    for (let i = 0; i < 5; i++) {
      const y = (70 + i * 16) * u;
      g.beginPath();
      g.moveTo(cx + 20 * u, y);
      g.lineTo(cx + 32 * u, y + 6 * u);
      g.stroke();
    }
    return;
  }

  // 숟가락
  g.lineWidth = 15 * u;
  g.beginPath();
  g.moveTo(cx, 140 * u);
  g.lineTo(cx, 212 * u);
  g.stroke();
  g.beginPath();
  g.ellipse(cx, 92 * u, 40 * u, 54 * u, 0, 0, Math.PI * 2);
  g.fill();
}

/** 배지용 단순 글리프 — 16px 로 줄어도 형태가 남도록 굵고 크게 */
function drawBadgeGlyph(g, kind, s) {
  const u = s / 256;
  const cx = s / 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (kind === 'fork') {
    g.lineWidth = 26 * u;
    g.beginPath();
    g.moveTo(cx, 128 * u);
    g.lineTo(cx, 216 * u);
    g.stroke();
    g.lineWidth = 24 * u;
    for (const dx of [-46, 0, 46]) {
      g.beginPath();
      g.moveTo(cx + dx * u, 40 * u);
      g.lineTo(cx + dx * u, 118 * u);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx - 58 * u, 108 * u);
    g.lineTo(cx + 58 * u, 108 * u);
    g.lineTo(cx + 18 * u, 150 * u);
    g.lineTo(cx - 18 * u, 150 * u);
    g.closePath();
    g.fill();
    return;
  }

  if (kind === 'knife') {
    g.lineWidth = 26 * u;
    g.beginPath();
    g.moveTo(cx + 8 * u, 140 * u);
    g.lineTo(cx + 8 * u, 216 * u);
    g.stroke();
    // 한쪽만 볼록한 큰 칼날
    g.beginPath();
    g.moveTo(cx - 34 * u, 148 * u);
    g.lineTo(cx - 34 * u, 74 * u);
    g.quadraticCurveTo(cx - 10 * u, 30 * u, cx + 30 * u, 34 * u);
    g.lineTo(cx + 30 * u, 148 * u);
    g.closePath();
    g.fill();
    return;
  }

  // 숟가락 — 큰 원형 볼
  g.lineWidth = 26 * u;
  g.beginPath();
  g.moveTo(cx, 140 * u);
  g.lineTo(cx, 216 * u);
  g.stroke();
  g.beginPath();
  g.ellipse(cx, 84 * u, 54 * u, 62 * u, 0, 0, Math.PI * 2);
  g.fill();
}

/** 종류별 배지 색 — 멀리서도 구분되도록 테두리에 쓴다 */
export const KIND_ACCENT = { fork: '#6fc3ff', knife: '#c9d2da', spoon: '#ffc76b' };

/**
 * 나사못 윗면 배지. 게임 화면은 위에서 내려다보므로 이 원판이 종류를 알려주는 가장 확실한 단서다.
 * 멀리서도 보이도록 어두운 바탕에 밝은 글리프 + 종류색 테두리로 대비를 크게 준다.
 */
export function pinCapTexture(kind, size = 192) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;

  // 종류색 테두리
  g.fillStyle = KIND_ACCENT[kind] ?? '#c9d2da';
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();

  // 어두운 바탕
  g.fillStyle = '#20262c';
  g.beginPath();
  g.arc(r, r, r * 0.84, 0, Math.PI * 2);
  g.fill();

  // 밝은 글리프 — 원판을 꽉 채운다
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  drawBadgeGlyph(g, kind, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 주사위 한 면 */
export function dieFaceTexture(face, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#f6efe2';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(150,130,100,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  g.fillStyle = '#3a2c1c';
  g.strokeStyle = '#3a2c1c';
  drawUtensilIcon(g, face, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
