import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { updateTweens } from './anim.js';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140d09);
  scene.fog = new THREE.FogExp2(0x140d09, 0.017);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight || 1, 0.5, 240);
  camera.position.set(0, 16.5, 11.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 46;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = 1.15;
  controls.target.set(0, 0.3, 0);

  // 주방 조명: 따뜻한 천장등 + 은은한 필 + 차가운 림
  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x4a2c18, 1.05);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffd9a6, 1.95);
  key.position.set(8, 22, 10);
  key.castShadow = true;
  key.shadow.camera.left = key.shadow.camera.bottom = -14;
  key.shadow.camera.right = key.shadow.camera.top = 14;
  key.shadow.camera.near = 6;
  key.shadow.camera.far = 54;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.5);
  rim.position.set(-13, 9, -12);
  scene.add(rim);

  // 판 위를 비추는 식탁등
  const lamp = new THREE.SpotLight(0xffb066, 60, 42, 0.85, 0.55, 1.4);
  lamp.position.set(0, 14, 0);
  lamp.target.position.set(0, 0, 0);
  scene.add(lamp, lamp.target);

  // 화면 비율이 달라져도 게임판 전체가 딱 맞게 보이도록 카메라 거리를 맞춘다.
  // 바운딩 박스의 여덟 꼭짓점을 카메라 축에 투영해 필요한 최소 거리를 구한다.
  const FIT_BOX = [
    [-8.2, -0.95, -6.0],
    [8.2, 0.8, 6.0],
  ];
  const corners = [];
  for (const x of [FIT_BOX[0][0], FIT_BOX[1][0]])
    for (const y of [FIT_BOX[0][1], FIT_BOX[1][1]])
      for (const z of [FIT_BOX[0][2], FIT_BOX[1][2]]) corners.push(new THREE.Vector3(x, y, z));

  const _dir = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _v = new THREE.Vector3();

  let userMoved = false;
  controls.addEventListener('start', () => {
    userMoved = true;
  });

  function fitView(margin = 1.0) {
    _dir.copy(camera.position).sub(controls.target);
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 1.4, 1);
    _dir.normalize();
    if (!userMoved) {
      // 세로로 긴 화면일수록 더 위에서 내려다봐야 판이 크게 보인다
      const t = THREE.MathUtils.clamp((camera.aspect - 0.7) / (1.6 - 0.7), 0, 1);
      const polar = THREE.MathUtils.lerp(0.26, 0.62, t);
      const az = Math.atan2(_dir.x, _dir.z);
      _dir.set(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    }
    _right.crossVectors(_dir, camera.up).normalize();
    _up.crossVectors(_right, _dir).normalize();

    const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const hTan = vTan * camera.aspect;
    let need = 0;
    for (const c of corners) {
      _v.copy(c).sub(controls.target);
      const z = _v.dot(_dir);
      need = Math.max(need, z + Math.abs(_v.dot(_right)) / hTan, z + Math.abs(_v.dot(_up)) / vTan);
    }
    const d = Math.max(controls.minDistance, need * margin);
    camera.position.copy(controls.target).addScaledVector(_dir, d);
    controls.maxDistance = Math.max(d * 1.8, 46);
    controls.update();
  }

  const quality = { high: true };
  function setQuality(high) {
    quality.high = high;
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    key.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    key.shadow.radius = high ? 4 : 1;
    if (key.shadow.map) {
      key.shadow.map.dispose();
      key.shadow.map = null;
    }
    renderer.shadowMap.needsUpdate = true;
  }
  setQuality(true);

  const onFrame = new Set();
  const resizeHandlers = new Set();
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return; // 숨겨진 탭 등 크기 0 이면 무시 (NaN 방지)
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitView();
    for (const fn of resizeHandlers) fn(w, h);
  }
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(container);

  const timer = new THREE.Timer();
  const loop = () => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const time = timer.getElapsed();
    updateTweens(dt);
    for (const fn of onFrame) fn(dt, time);
    controls.update();
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(loop);

  return { loop, fitView, renderer, scene, camera, controls, lights: { key, hemi, rim, lamp }, onFrame, resizeHandlers, setQuality, quality, resize };
}
