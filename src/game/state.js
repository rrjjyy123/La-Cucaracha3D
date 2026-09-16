// 진행 상황 자동 저장 / 이어하기 (localStorage)

const KEY = 'lacucaracha3d.save';
const SETTINGS_KEY = 'lacucaracha3d.settings';

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
