import * as THREE from 'three';
import { createEngine } from './engine.js';
import { advanceTheta } from './kinematics.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x0f172a);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(30, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 50, bottom: -20 });
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 500);

  const view = {
    scene, camera, renderer, visible: true,
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render() { renderer.render(scene, camera); },
  };
  new IntersectionObserver(([e]) => { view.visible = e.isIntersecting; }).observe(canvas);
  view.resize();
  return view;
}

function start() {
  if (!hasWebGL()) {
    document.getElementById('no-webgl').hidden = false;
    document.getElementById('story').hidden = true;
    document.getElementById('sandbox').hidden = true;
    return;
  }

  const stage = createView(document.getElementById('stage-canvas'));
  stage.camera.position.set(42, 30, 62);
  stage.camera.lookAt(0, 14, 0);
  let engine = createEngine(1);
  stage.scene.add(engine.group);

  const views = [stage];
  addEventListener('resize', () => views.forEach((v) => v.resize()));

  let theta = 0;
  let last = performance.now();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (stage.visible) {
      if (!reducedMotion) theta = advanceTheta(theta, 600, dt);
      engine.update(theta);
      stage.render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
