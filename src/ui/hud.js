// 인게임 HUD — 플레이어 바, 제한 시간 링, 주사위 결과, 배너·토스트
import { FACE_ICON, FACE_LABEL } from '../game/dice.js';
import { TARGET_TOKENS } from '../game/rules.js';
import { getTrap } from '../game/board.js';
import { renderLayoutPicker } from './setup.js';

const $ = (sel, root = document) => root.querySelector(sel);
const RING = 2 * Math.PI * 9.2;

export function createHud({ onEditLayout } = {}) {
  const hud = $('#hud');
  const bar = $('#players-bar');
  const hint = $('#action-hint');
  const rollBtn = $('#btn-roll');
  const dieBox = $('#die-result');
  const banner = $('#turn-banner');
  const toast = $('#toast');

  let cards = [];
  let toastTimer = 0;

  function mount(players) {
    bar.innerHTML = '';
    cards = players.map((p) => {
      const c = document.createElement('div');
      c.className = 'pcard';
      c.style.color = p.color;
      c.innerHTML = `
        <svg class="timer-ring" viewBox="0 0 22 22" hidden>
          <circle class="bg" cx="11" cy="11" r="9.2"></circle>
          <circle class="fg" cx="11" cy="11" r="9.2" stroke-dasharray="${RING}" stroke-dashoffset="0"></circle>
        </svg>
        <span class="dot"></span>
        <span class="nm"></span>
        <span class="pips">${'<i class="pip"></i>'.repeat(TARGET_TOKENS)}</span>`;
      bar.appendChild(c);
      return {
        el: c,
        nm: $('.nm', c),
        dot: $('.dot', c),
        ring: $('.timer-ring', c),
        fg: $('.fg', c),
        pips: [...c.querySelectorAll('.pip')],
      };
    });
  }

  function update(g) {
    g.players.forEach((p, i) => {
      const c = cards[i];
      if (!c) return;
      c.nm.textContent = p.name;
      c.el.classList.toggle('now', i === g.current && g.phase !== 'game-over');
      c.dot.hidden = i === g.current;
      c.ring.hidden = i !== g.current || !g.settings.turnSeconds;
      c.pips.forEach((pip, k) => pip.classList.toggle('on', k < p.tokens));
    });

    const turnable = g.phase === 'roll' || g.phase === 'turn';
    rollBtn.disabled = g.phase !== 'roll';
    rollBtn.hidden = !turnable;
    if (g.die) {
      dieBox.hidden = false;
      $('.die-ico', dieBox).textContent = FACE_ICON[g.die.face];
      $('.die-text', dieBox).textContent =
        g.die.face === 'any' ? '아무거나 1개!' : `${FACE_LABEL[g.die.face]} 1개!`;
    } else {
      dieBox.hidden = true;
    }

    const me = g.players[g.current];
    const goal = getTrap(me.trap)?.label ?? '';
    if (g.phase === 'roll') setHint(`${me.name} 차례 — 주사위를 굴려 ${goal} 함정으로 유인하세요`);
    else if (g.phase === 'turn') setHint(`빛나는 식사 도구를 눌러 ${goal} 함정으로 가는 길을 만드세요`);
    else setHint('');
  }

  /** 남은 시간 0~1 */
  function setTimer(idx, k) {
    const c = cards[idx];
    if (!c) return;
    c.fg.setAttribute('stroke-dashoffset', String(RING * (1 - k)));
  }

  function setHint(text) {
    if (!text) {
      hint.classList.remove('show');
      return;
    }
    hint.textContent = text;
    hint.classList.add('show');
  }

  function showBanner(text, color) {
    banner.textContent = text;
    banner.style.color = color || '#fdf1e2';
    banner.classList.remove('show');
    void banner.offsetWidth; // 애니메이션 재시작
    banner.classList.add('show');
  }

  function showToast(text, ms = 1800) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
  }

  const tokenRow = (players) =>
    players
      .map(
        (p) =>
          `<span class="tk" style="color:${p.color}"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:currentColor"></span>${p.name} ${p.tokens}</span>`,
      )
      .join('');

  /** 라운드 종료 화면. 고른 배치 id 로 resolve 한다. */
  function roundOver(g) {
    return new Promise((resolve) => {
      const panel = $('#round');
      const owner = g.players[g.lastCatch.playerId];
      $('#round-title').textContent = `${owner.name}의 함정에 빠졌다!`;
      $('#round-title').style.color = owner.color;
      $('#round-sub').textContent = `라쿠카라차 토큰 ${owner.tokens}개 / ${TARGET_TOKENS}개`;
      $('#round-tokens').innerHTML = tokenRow(g.players);

      let picked = g.layoutId;
      const wrap = $('#round-layouts');
      const draw = () => {
        const all = renderLayoutPicker(wrap, {
          selected: picked,
          onPick: (id) => {
            picked = id;
            draw();
          },
          onEdit: onEditLayout
            ? async () => {
                const start = all.find((l) => l.id === picked)?.orients;
                panel.classList.remove('show');
                const made = await onEditLayout({ orients: start });
                panel.classList.add('show');
                if (made) picked = made.id;
                draw();
              }
            : null,
          onDelete: (id) => {
            if (picked === id) picked = 'rings';
            draw();
          },
        });
      };
      draw();

      const go = () => {
        $('#btn-next-round').removeEventListener('click', go);
        panel.classList.remove('show');
        resolve(picked);
      };
      $('#btn-next-round').addEventListener('click', go);
      panel.classList.add('show');
    });
  }

  function gameOver(g, text) {
    $('#win-title').textContent = text;
    const target = g.over.winnerId ?? g.over.loserId;
    $('#win-title').style.color = g.players[target].color;
    $('#win-sub').textContent =
      g.over.winnerId != null
        ? `라쿠카라차 토큰 ${TARGET_TOKENS}개를 가장 먼저 모았습니다!`
        : `토큰 ${TARGET_TOKENS}개를 먼저 모아서 졌습니다. (룰북 변형 규칙)`;
    $('#win-board').innerHTML = tokenRow(g.players);
    $('#win').classList.add('show');
  }

  return {
    mount,
    update,
    setTimer,
    setHint,
    showBanner,
    showToast,
    roundOver,
    gameOver,
    show: () => (hud.hidden = false),
    hide: () => (hud.hidden = true),
    rollBtn,
  };
}
