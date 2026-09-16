// WebAudio 합성 효과음 (외부 오디오 파일 없음)
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('lacucaracha3d.muted') === '1';
} catch {
  /* 무시 */
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  if (m) stopSkitter();
  try {
    localStorage.setItem('lacucaracha3d.muted', m ? '1' : '0');
  } catch {
    /* 무시 */
  }
}
export const unlockAudio = () => {
  if (!muted) ac();
};

function noiseBuffer(a, dur) {
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  return buf;
}

function blip({ freq = 600, type = 'triangle', gain = 0.22, dur = 0.12, slide = 0, delay = 0 } = {}) {
  if (muted) return;
  const a = ac();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function knock({ freq = 900, q = 8, gain = 0.5, dur = 0.09, delay = 0 } = {}) {
  if (muted) return;
  const a = ac();
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, dur);
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** 식사 도구가 딸깍 돌아가는 소리 */
export const clack = () => {
  knock({ freq: 1500, q: 6, gain: 0.34, dur: 0.07 });
  blip({ freq: 320, type: 'square', gain: 0.07, dur: 0.05, slide: 120 });
};

/** 주사위가 구르는 소리 */
export function diceRoll() {
  if (muted) return;
  for (let i = 0; i < 7; i++) {
    knock({ freq: 700 + Math.random() * 900, q: 4, gain: 0.2, dur: 0.06, delay: 0.06 + i * 0.1 * Math.random() + i * 0.07 });
  }
  knock({ freq: 520, q: 3, gain: 0.3, dur: 0.12, delay: 0.85 });
}

/** 벽에 부딪히는 소리 */
export const bump = () => knock({ freq: 2400, q: 10, gain: 0.1, dur: 0.035 });

/** 함정에 빠지는 소리 */
export function fall() {
  blip({ freq: 700, type: 'sawtooth', gain: 0.16, dur: 0.5, slide: -580 });
  knock({ freq: 180, q: 2, gain: 0.5, dur: 0.3, delay: 0.42 });
}

/** 토큰 획득 */
export function token() {
  [880, 1174, 1568].forEach((f, i) => blip({ freq: f, type: 'triangle', gain: 0.16, dur: 0.2, delay: i * 0.08 }));
}

/** 승리 팡파레 */
export function fanfare() {
  [523, 659, 784, 1046, 1318].forEach((f, i) =>
    blip({ freq: f, type: 'triangle', gain: 0.18, dur: 0.32, delay: i * 0.12 }),
  );
}

/** 시간이 얼마 안 남았을 때 */
export const tick = () => blip({ freq: 1100, type: 'sine', gain: 0.08, dur: 0.05 });

/** 차례가 넘어갈 때 */
export const turn = () => blip({ freq: 560, type: 'sine', gain: 0.1, dur: 0.14, slide: 180 });

// ── 바퀴벌레가 기어다니는 소리 (루프) ──────────────────────────────────────
let skitter = null;
export function startSkitter() {
  if (muted || skitter) return;
  const a = ac();
  const src = a.createBufferSource();
  const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  src.buffer = buf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 5200;
  f.Q.value = 1.2;
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  lfo.frequency.value = 17;
  lfoGain.gain.value = 0.02;
  const g = a.createGain();
  g.gain.value = 0.012;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
  lfo.start();
  skitter = { src, lfo, g };
}

export function stopSkitter() {
  if (!skitter) return;
  try {
    skitter.src.stop();
    skitter.lfo.stop();
  } catch {
    /* 무시 */
  }
  skitter = null;
}
