import * as THREE from 'three';
import { createEngine } from './engine.js';
import { createEffects } from './effects.js';
import { scrollState, initScroll } from './scroll.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { advanceTheta } from './kinematics.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?theta=N pins the crank angle (used for screenshots).
const pinned = new URLSearchParams(location.search).get('theta');
const pinnedTheta = pinned === null || isNaN(+pinned) ? null : +pinned;

// Part labels shown during "Meet the parts": [text, nudge side, local y offset on the anchor mesh].
const LABELS = {
  piston: ['Piston', 'right', 0], rod: ['Connecting rod', 'right', 7], crankshaft: ['Crankshaft', 'right', 0],
  intakeValve: ['Intake valve', 'left', 0], exhaustValve: ['Exhaust valve', 'right', 0],
  camshaft: ['Camshaft', 'left', 0], sparkPlug: ['Spark plug', 'right', 1.5],
};

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
  const NEAR = new THREE.Vector3(42, 30, 62), FAR = new THREE.Vector3(70, 46, 104), LOOK = new THREE.Vector3(0, 14, 0);
  const placeCamera = (t) => { stage.camera.position.lerpVectors(NEAR, FAR, t); stage.camera.lookAt(LOOK); };
  placeCamera(0);

  const labelLayer = document.getElementById('labels');
  const labels = new CSS2DRenderer({ element: labelLayer });
  const sizeLabels = () => labels.setSize(labelLayer.clientWidth, labelLayer.clientHeight);
  sizeLabels();

  // Builds engine + effects (+ part labels on cylinder 1) for n cylinders; disposes the old ones.
  let engine, effects;
  function build(n) {
    engine?.dispose(); effects?.dispose();
    labelLayer.replaceChildren();
    engine = createEngine(n);
    effects = createEffects(engine);
    stage.scene.add(engine.group, effects.group);
    const anchors = engine.group.userData.labelAnchors;
    for (const [id, [text, side, y]] of Object.entries(LABELS)) {
      if (!anchors[id]) continue;
      const el = document.createElement('div');
      el.className = `label ${side}`;
      el.innerHTML = `<span>${text}</span>`;
      const obj = new CSS2DObject(el);
      obj.position.y = y;
      anchors[id].add(obj);
    }
  }
  build(1);

  const views = [stage];
  addEventListener('resize', () => { views.forEach((v) => v.resize()); sizeLabels(); });

  let scroll = { state: scrollState(0), raw: -1 };
  initScroll(document.getElementById('walkthrough'), (state, raw) => { scroll = { state, raw }; });

  let theta = 0;
  let last = performance.now();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (stage.visible) {
      const { state, raw } = scroll;
      const inHero = raw < 0;
      const cylinders = inHero ? 1 : state.cylinders;
      if (cylinders !== engine.cylinders) build(cylinders);
      if (pinnedTheta !== null) theta = pinnedTheta;
      else if (inHero) { if (!reducedMotion) theta = advanceTheta(theta, 600, dt); }
      else theta = state.theta;
      placeCamera(!inHero && state.step === 'multi' ? Math.min(1, state.stepProgress / 0.4) : 0);
      labelLayer.hidden = inHero || state.step !== 'parts';
      engine.update(theta);
      effects.update(theta);
      stage.render();
      if (!labelLayer.hidden) labels.render(stage.scene, stage.camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
