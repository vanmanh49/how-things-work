// Free-explore sandbox: RPM, play/pause, stepping, cutaway, 1/4 cylinders, click-a-part cards.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEngine } from './engine.js';
import { createEffects } from './effects.js';
import { advanceTheta, wrapTheta, strokeAt, cylinderPhase } from './kinematics.js';
import { PARTS } from './parts.js';

const HIGHLIGHT = 0x664400;

export function initSandbox(view, ui) {
  const $ = (id) => document.getElementById(id);
  const rpmInput = $('rpm'), rpmOut = $('rpm-out'), play = $('play'), cutaway = $('cutaway');
  const readout = $('readout'), card = $('part-card');

  view.camera.position.set(50, 34, 76);
  const controls = new OrbitControls(view.camera, view.renderer.domElement);
  controls.target.set(0, 14, 0);
  controls.enableZoom = false;   // wheel must keep scrolling the page
  controls.enablePan = false;
  controls.update();

  let theta = 0;
  let rpm = +rpmInput.value;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let engine, effects, highlighted = [];

  function build(n) {
    engine?.dispose(); effects?.dispose();
    engine = createEngine(n);
    effects = createEffects(engine);
    engine.setCutaway(cutaway.checked);
    view.scene.add(engine.group, effects.group);
    closeCard();
  }

  const setPlaying = (on) => { playing = on; play.textContent = on ? 'Pause' : 'Play'; };
  setPlaying(playing);

  rpmInput.addEventListener('input', () => { rpm = +rpmInput.value; rpmOut.textContent = rpm; });
  play.addEventListener('click', () => setPlaying(!playing));
  $('step-back').addEventListener('click', () => { setPlaying(false); theta = wrapTheta(theta - 5); });
  $('step-fwd').addEventListener('click', () => { setPlaying(false); theta = wrapTheta(theta + 5); });
  cutaway.addEventListener('change', () => engine.setCutaway(cutaway.checked));
  ui.querySelectorAll('input[name="cyl"]').forEach((r) => r.addEventListener('change', () => build(+r.value)));

  function closeCard() {
    card.hidden = true;
    highlighted.forEach((m) => m.material.emissive.setHex(0));
    highlighted = [];
  }
  card.querySelector('button').addEventListener('click', closeCard);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });

  // Click (not drag) → raycast. The translucent block is skipped when something solid is behind it.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const canvas = view.renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, view.camera);
    const hits = ray.intersectObjects(engine.parts.filter((m) => m.visible), false);
    const hit = hits.find((h) => h.object.userData.partId !== 'block') ?? hits[0];
    closeCard();
    if (!hit) return;
    const { partId, cylinder } = hit.object.userData;
    highlighted = engine.parts.filter((m) => m.userData.partId === partId && m.userData.cylinder === cylinder && m.material.emissive);
    highlighted.forEach((m) => m.material.emissive.setHex(HIGHLIGHT));
    card.querySelector('h3').textContent = PARTS[partId].name + (cylinder && engine.cylinders > 1 ? ` (cylinder ${cylinder})` : '');
    card.querySelector('p').textContent = PARTS[partId].text;
    card.hidden = false;
  });

  let lastText = '';
  function tick(dt) {
    if (playing) theta = advanceTheta(theta, rpm, dt);
    engine.update(theta);
    effects.update(theta);
    const rows = Array.from({ length: engine.cylinders }, (_, k) =>
      `Cyl ${k + 1}: ${strokeAt(wrapTheta(theta - cylinderPhase(k + 1)))}`);
    const text = `θ = ${Math.round(theta)}°\n${rows.join('\n')}`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
  }

  build(+ui.querySelector('input[name="cyl"]:checked').value);
  return { tick };
}
