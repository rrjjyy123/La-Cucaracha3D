// 미로 직접 만들기 — 별도 화면을 띄우지 않고 살아 있는 3D 판을 그대로 편집기로 쓴다.
// 룰북: "규칙서에서 미로를 4가지 방법으로 소개해요. 하지만, 내 맘대로 미로를 만들어도 좋아요."
import { UTENSIL_COUNT } from '../game/board.js';
import { LAYOUTS, getLayout } from '../game/layouts.js';
import { saveCustomLayout } from '../game/state.js';

const $ = (sel) => document.querySelector(sel);

/**
 * @param {object} o
 * @param {(orients: string[]) => void} o.applyOrients 3D 판과 벽을 이 방향 배열로 맞춘다
 * @param {(i: number, orient: string) => void} o.spin   도구 하나를 회전 애니메이션과 함께 돌린다
 * @param {(on: boolean) => void} o.setEditing           편집 모드 진입/이탈 (물리 정지, 전체 강조 등)
 */
export function createEditor({ applyOrients, spin, setEditing }) {
  const bar = $('#editor-bar');
  const nameInput = $('#edit-name');
  const presetsEl = $('#edit-presets');

  let active = false;
  let orients = null;
  let editingId = null;
  let resolveOpen = null;

  function renderPresets() {
    presetsEl.innerHTML = '';
    for (const l of LAYOUTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.name;
      b.title = `${l.name} 배치에서 시작하기`;
      b.addEventListener('click', () => {
        orients = l.orients.slice();
        applyOrients(orients);
      });
      presetsEl.appendChild(b);
    }
  }

  /**
   * @returns {Promise<{id:string,name:string,orients:string[],custom:true}|null>} 저장하면 그 미로, 취소하면 null
   */
  function open({ orients: start, id = null, name = '' } = {}) {
    if (active) return Promise.resolve(null);
    active = true;
    editingId = id;
    orients = (start && start.length === UTENSIL_COUNT ? start : getLayout('rings').orients).slice();
    nameInput.value = name || `내 미로 ${new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}`;
    renderPresets();
    applyOrients(orients);
    setEditing(true);
    bar.hidden = false;
    return new Promise((resolve) => {
      resolveOpen = resolve;
    });
  }

  /** 편집 중 도구를 탭했을 때 — 주사위와 상관없이 바로 90° 돌린다 */
  function toggle(i) {
    if (!active || i < 0 || i >= UTENSIL_COUNT) return;
    orients[i] = orients[i] === 'H' ? 'V' : 'H';
    spin(i, orients[i]);
  }

  function finish(result) {
    if (!active) return;
    active = false;
    bar.hidden = true;
    setEditing(false);
    const done = resolveOpen;
    resolveOpen = null;
    done?.(result);
  }

  $('#btn-edit-cancel').addEventListener('click', () => finish(null));
  $('#btn-edit-save').addEventListener('click', () => {
    const name = nameInput.value.trim() || '내 미로';
    const id = editingId || `custom-${Date.now().toString(36)}`;
    const list = saveCustomLayout({ id, name, orients });
    finish(list.find((l) => l.id === id) ?? null);
  });

  return {
    open,
    toggle,
    get active() {
      return active;
    },
    get orients() {
      return orients;
    },
  };
}
