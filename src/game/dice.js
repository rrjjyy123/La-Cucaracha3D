// 주사위 6면: 나이프 1 · 포크 1 · 숟가락 1 · 물음표 3
export const DIE_FACES = ['knife', 'fork', 'spoon', 'any', 'any', 'any'];

export const FACE_LABEL = { fork: '포크', knife: '나이프', spoon: '숟가락', any: '아무거나' };
export const FACE_ICON = { fork: '🍴', knife: '🔪', spoon: '🥄', any: '❓' };

/** @returns {{face:string, index:number}} */
export function rollDie(rng = Math.random) {
  const index = Math.floor(rng() * DIE_FACES.length) % DIE_FACES.length;
  return { face: DIE_FACES[index], index };
}

/** 이 주사위 결과로 해당 종류의 도구를 돌릴 수 있는가 */
export const faceAllows = (face, kind) => face === 'any' || face === kind;
