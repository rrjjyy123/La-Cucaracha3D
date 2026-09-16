// 룰북에 실린 4가지 초기 배치.
// 각 문자열은 격자 한 줄(위→아래)이고, 문자 하나가 도구 하나의 방향(H=가로, V=세로).
// 줄 길이가 3-4-3-4-3-4-3 인 것은 고정핀이 체커보드로 박혀 있기 때문 (board.js 참고).

const rows = (...r) => r.join('').split('');

export const LAYOUTS = [
  {
    id: 'rings',
    name: '동심 사각형',
    hint: '가운데로 갈수록 좁아지는 고전 배치',
    orients: rows('HHH', 'VHHV', 'VHV', 'VVVV', 'VHV', 'VHHV', 'HHH'),
  },
  {
    id: 'grid',
    name: '바둑판',
    hint: '아홉 개의 방으로 나뉜 배치',
    orients: rows('HHH', 'VVVV', 'HHH', 'VVVV', 'HHH', 'VVVV', 'HHH'),
  },
  {
    id: 'cross',
    name: '십자 통로',
    hint: '가운데 방에서 사방으로 길이 뻗은 배치',
    orients: rows('VHV', 'HVVH', 'HHH', 'VVVV', 'HHH', 'HVVH', 'VHV'),
  },
  {
    id: 'nest',
    name: '겹친 방',
    hint: '작은 방이 큰 방 안에 들어앉은 배치',
    orients: rows('VVV', 'HHHH', 'VHV', 'HVVH', 'VHV', 'HHHH', 'VVV'),
  },
];

export const getLayout = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
