import { describe, it, expect } from 'vitest';
import { LAYOUTS, getLayout, isValidOrients } from '../src/game/layouts.js';

describe('미로 배치', () => {
  it('직접 만든 미로 검증 — 24칸의 H/V 만 통과', () => {
    expect(isValidOrients(LAYOUTS[0].orients)).toBe(true);
    expect(isValidOrients(Array(24).fill('H'))).toBe(true);
    expect(isValidOrients(Array(23).fill('H'))).toBe(false);
    expect(isValidOrients(Array(24).fill('X'))).toBe(false);
    expect(isValidOrients(null)).toBe(false);
    expect(isValidOrients('HHHH')).toBe(false);
  });

  it('직접 만든 미로도 id 로 찾을 수 있다', () => {
    const mine = { id: 'custom-1', name: '내 미로', orients: Array(24).fill('V') };
    expect(getLayout('custom-1', [mine])).toBe(mine);
    expect(getLayout('grid', [mine]).id).toBe('grid'); // 프리셋이 우선
    expect(getLayout('없는id', [mine]).id).toBe(LAYOUTS[0].id); // 못 찾으면 첫 프리셋
  });
});
