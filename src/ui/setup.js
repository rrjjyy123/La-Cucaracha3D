// 시작 화면 — 인원, 이름, 함정, 속도, 제한 시간, 첫 배치
import { PINS, TRAP_IDS, OPPOSITE, getTrap } from '../game/board.js';
import { LAYOUTS } from '../game/layouts.js';
import { loadCustomLayouts, deleteCustomLayout } from '../game/state.js';
import { PLAYER_COLORS, DEFAULT_NAMES, defaultTraps, validateTraps } from '../game/rules.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const MIN_SECONDS = 3;
export const MAX_SECONDS = 120;

/** 배치 미리보기 SVG (7×7 격자 위의 24개 막대) */
export function layoutThumb(layout, size = 78) {
  const p = 9;
  const s = (78 - p * 2) / 6;
  const bars = PINS.map((pin, i) => {
    const cx = p + pin.col * s;
    const cy = p + pin.row * s;
    const h = layout.orients[i] === 'H';
    const x1 = h ? cx - s : cx;
    const x2 = h ? cx + s : cx;
    const y1 = h ? cy : cy - s;
    const y2 = h ? cy : cy + s;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');
  return `<svg viewBox="0 0 78 78" width="${size}" height="${size}" aria-hidden="true">
    <rect x="1" y="1" width="76" height="76" rx="7" fill="#e2802f" opacity="0.28"/>
    <g stroke="#fdf1e2" stroke-width="3.2" stroke-linecap="round" opacity="0.92">${bars}</g>
  </svg>`;
}

/**
 * 프리셋 4개 + 직접 만든 미로를 한 줄로 보여주는 배치 선택기.
 * 여러 화면(시작 화면, 라운드 종료 화면)에서 같은 모양으로 쓴다.
 */
export function renderLayoutPicker(el, { selected, onPick, onEdit, onDelete }) {
  const all = [...LAYOUTS, ...loadCustomLayouts()];
  el.innerHTML = '';
  el.classList.add('layout-pick');
  for (const l of all) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${layoutThumb(l)}<span class="lname">${l.name}</span>`;
    b.classList.toggle('active', l.id === selected);
    b.addEventListener('click', () => onPick(l.id));
    if (l.custom && onDelete) {
      const x = document.createElement('span');
      x.className = 'del';
      x.textContent = '×';
      x.title = '이 미로 지우기';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomLayout(l.id);
        onDelete(l.id);
      });
      b.appendChild(x);
    }
    el.appendChild(b);
  }
  if (onEdit) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'make';
    add.innerHTML = '<span class="plus">＋</span><span class="lname">직접 만들기</span>';
    add.addEventListener('click', onEdit);
    el.appendChild(add);
  }
  return all;
}

export function createSetup({ onStart, onResume, onOpenRules, onEditLayout }) {
  const el = $('#setup');
  const rowsEl = $('#player-rows');
  const noteEl = $('#trap-note');
  const secInput = $('#turn-seconds');
  const unlimited = $('#turn-unlimited');

  let count = 3;
  let players = [];
  let speed = 'normal';
  let layoutId = LAYOUTS[0].id;

  /** 입력창 + 무제한 체크박스 → 초 (0 이면 무제한) */
  function readSeconds() {
    if (unlimited.checked) return 0;
    const n = Math.round(Number(secInput.value));
    if (!Number.isFinite(n)) return 15;
    return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n));
  }

  function writeSeconds(sec) {
    unlimited.checked = sec === 0;
    secInput.disabled = sec === 0;
    if (sec > 0) secInput.value = String(sec);
  }

  function resetPlayers(n) {
    const traps = defaultTraps(n);
    players = Array.from({ length: n }, (_, i) => ({
      name: players[i]?.name ?? DEFAULT_NAMES[i],
      color: PLAYER_COLORS[i],
      trap: traps[i],
    }));
  }

  function pickTrap(idx, trap) {
    if (players.some((p, i) => i !== idx && p.trap === trap)) return;
    players[idx].trap = trap;
    if (count === 2) players[1 - idx].trap = OPPOSITE[trap]; // 2인은 반드시 마주보게
    renderRows();
  }

  function renderRows() {
    rowsEl.innerHTML = '';
    players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'prow';
      row.style.color = p.color;
      row.innerHTML = `
        <span class="swatch"></span>
        <input type="text" maxlength="10" value="${p.name.replace(/"/g, '&quot;')}" aria-label="${i + 1}번 플레이어 이름" />
        <span class="traps-label">함정</span>
        <div class="traps">
          ${TRAP_IDS.map(
            (t) =>
              `<button data-trap="${t}" title="${getTrap(t).label} 함정" aria-label="${getTrap(t).label} 함정"></button>`,
          ).join('')}
        </div>`;
      $('input', row).addEventListener('input', (e) => {
        p.name = e.target.value.trim() || DEFAULT_NAMES[i];
      });
      $$('.traps button', row).forEach((b) => {
        const t = b.dataset.trap;
        if (p.trap === t) b.classList.add('on');
        else if (players.some((q) => q.trap === t)) b.classList.add('taken');
        b.addEventListener('click', () => pickTrap(i, t));
      });
      rowsEl.appendChild(row);
    });
    const err = validateTraps(players.map((p) => p.trap));
    noteEl.textContent =
      err ??
      (count === 2
        ? '2명은 서로 마주보는 함정을 씁니다. 나머지 둘은 차단문으로 막습니다.'
        : count === 3
          ? '남는 함정 하나는 차단문으로 막습니다.'
          : '네 함정을 모두 씁니다.');
    $('#btn-start').disabled = !!err;
  }

  function renderLayouts() {
    const all = renderLayoutPicker($('#layout-seg'), {
      selected: layoutId,
      onPick: (id) => {
        layoutId = id;
        renderLayouts();
      },
      onEdit: async () => {
        const start = all.find((l) => l.id === layoutId)?.orients;
        el.classList.remove('show');
        const made = await onEditLayout({ orients: start });
        el.classList.add('show');
        if (made) layoutId = made.id;
        renderLayouts();
      },
      onDelete: (id) => {
        if (layoutId === id) layoutId = LAYOUTS[0].id;
        renderLayouts();
      },
    });
  }

  function bindSeg(sel, apply) {
    $$(`${sel} button`).forEach((b) =>
      b.addEventListener('click', () => {
        $$(`${sel} button`).forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        apply(b.dataset);
      }),
    );
  }

  bindSeg('#player-count', (d) => {
    count = +d.n;
    resetPlayers(count);
    renderRows();
  });
  bindSeg('#speed-seg', (d) => (speed = d.speed));

  unlimited.addEventListener('change', () => (secInput.disabled = unlimited.checked));
  secInput.addEventListener('blur', () => writeSeconds(readSeconds()));

  const config = () => ({
    players: players.map((p) => ({ ...p })),
    settings: { speed, turnSeconds: readSeconds(), layoutId }, // 승리 방식은 기본 규칙으로 고정
  });

  $('#btn-start').addEventListener('click', () => onStart(config()));
  $('#btn-rules-open').addEventListener('click', onOpenRules);
  $('#btn-resume').addEventListener('click', onResume);

  resetPlayers(count);
  renderRows();
  renderLayouts();
  writeSeconds(15);

  return {
    show(saved) {
      const btn = $('#btn-resume');
      btn.hidden = !saved;
      if (saved) btn.textContent = `이어하기 (${saved.round}라운드)`;
      renderLayouts();
      el.classList.add('show');
    },
    hide: () => el.classList.remove('show'),
    /** 저장된 게임을 불러올 때 화면 값을 맞춘다 */
    apply(saved) {
      count = saved.players.length;
      players = saved.players.map((p) => ({ ...p }));
      speed = saved.settings.speed;
      layoutId = saved.layoutId;
      writeSeconds(saved.settings.turnSeconds ?? 15);
      $$('#player-count button').forEach((b) => b.classList.toggle('active', +b.dataset.n === count));
      $$('#speed-seg button').forEach((b) => b.classList.toggle('active', b.dataset.speed === speed));
      renderRows();
      renderLayouts();
    },
    get config() {
      return config();
    },
  };
}
