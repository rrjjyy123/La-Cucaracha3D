// 진행 상황 자동 저장 / 이어하기, 직접 만든 미로 보관 (localStorage)

import { isValidOrients } from './layouts.js';

const KEY = 'lacucaracha3d.save';
const SETTINGS_KEY = 'lacucaracha3d.settings';
const CUSTOM_KEY = 'lacucaracha3d.customLayouts';
const MAX_CUSTOM = 6;

const read = (k) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 저장 실패는 무시 (시크릿 모드 등) */
  }
};

/** 라운드가 끝날 때마다 저장한다. 바퀴벌레 위치는 저장하지 않는다(라운드 시작 상태만). */
export function saveGame(g) {
  if (!g || g.phase === 'game-over') return clearGame();
  write(KEY, {
    v: 1,
    at: Date.now(),
    settings: g.settings,
    players: g.players.map(({ name, color, trap, tokens }) => ({ name, color, trap, tokens })),
    round: g.round,
    current: g.current,
    layoutId: g.layoutId,
    orients: g.orients,
  });
}

export const loadGame = () => read(KEY);

export function clearGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

export const saveSettings = (s) => write(SETTINGS_KEY, s);
export const loadSettings = () => read(SETTINGS_KEY);

// ── 직접 만든 미로 ─────────────────────────────────────────────────────────

/** @returns {{id:string, name:string, orients:string[], custom:true}[]} */
export function loadCustomLayouts() {
  const list = read(CUSTOM_KEY);
  if (!Array.isArray(list)) return [];
  return list
    .filter((l) => l && typeof l.id === 'string' && isValidOrients(l.orients))
    .map((l) => ({ id: l.id, name: l.name || '내 미로', orients: l.orients.slice(), custom: true }));
}

/** 같은 id 가 있으면 덮어쓰고, 없으면 추가한다. 가득 차면 가장 오래된 것을 밀어낸다. */
export function saveCustomLayout({ id, name, orients }) {
  if (!isValidOrients(orients)) return loadCustomLayouts();
  const list = loadCustomLayouts();
  const entry = { id: id || `custom-${Date.now().toString(36)}`, name: name || '내 미로', orients: orients.slice(), custom: true };
  const at = list.findIndex((l) => l.id === entry.id);
  if (at >= 0) list[at] = entry;
  else list.push(entry);
  write(CUSTOM_KEY, list.slice(-MAX_CUSTOM));
  return loadCustomLayouts();
}

export function deleteCustomLayout(id) {
  write(CUSTOM_KEY, loadCustomLayouts().filter((l) => l.id !== id));
  return loadCustomLayouts();
}

export const customLayoutsFull = () => loadCustomLayouts().length >= MAX_CUSTOM;
