// Free-explore sandbox: RPM, play/pause, stepping, cutaway, 1/4 cylinders, click-a-part cards.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEngine } from './engine.js';
import { createEffects } from './effects.js';
import { advanceTheta, wrapTheta, strokeAt, cylinderPhase } from './kinematics.js';
import { PARTS } from './parts.js';
import { bindPicking, createCard } from '../core/cards.js';

const HIGHLIGHT = 0x664400;

export function initSandbox(view, ui) {
  const $ = (id) => document.getElementById(id);
  const rpmInput = $('rpm'), rpmOut = $('rpm-out'), play = $('play'), cutaway = $('cutaway');
  const readout = $('readout');

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
    card.hide();
  }

  const setPlaying = (on) => { playing = on; play.textContent = on ? 'Pause' : 'Play'; };
  setPlaying(playing);

  rpmInput.addEventListener('input', () => { rpm = +rpmInput.value; rpmOut.textContent = rpm; });
  play.addEventListener('click', () => setPlaying(!playing));
  $('step-back').addEventListener('click', () => { setPlaying(false); theta = wrapTheta(theta - 5); });
  $('step-fwd').addEventListener('click', () => { setPlaying(false); theta = wrapTheta(theta + 5); });
  cutaway.addEventListener('change', () => engine.setCutaway(cutaway.checked));
  ui.querySelectorAll('input[name="cyl"]').forEach((r) => r.addEventListener('change', () => build(+r.value)));

  const clearHighlight = () => { highlighted.forEach((m) => m.material.emissive.setHex(0)); highlighted = []; };
  const card = createCard($('part-card'), { onHide: clearHighlight });
  // The translucent block is skipped when something solid is behind it.
  bindPicking(view.renderer.domElement, view.camera, () => engine.parts.filter((m) => m.visible), (hits) => {
    const hit = hits.find((h) => h.object.userData.partId !== 'block') ?? hits[0];
    card.hide();
    const { partId, cylinder } = hit.object.userData;
    highlighted = engine.parts.filter((m) => m.userData.partId === partId && m.userData.cylinder === cylinder && m.material.emissive);
    highlighted.forEach((m) => m.material.emissive.setHex(HIGHLIGHT));
    card.show(PARTS[partId].name + (cylinder && engine.cylinders > 1 ? ` (cylinder ${cylinder})` : ''), PARTS[partId].text);
  }, () => card.hide());

  let lastText = '';
  function tick(dt) {
    if (playing) theta = advanceTheta(theta, rpm, dt);
    engine.update(theta);
    effects.update(theta);
    const rows = Array.from({ length: engine.cylinders }, (_, k) =>
      `Cyl ${k + 1}: ${strokeAt(wrapTheta(theta - cylinderPhase(k + 1)))}`);
    const text = `θ = ${Math.round(theta) % 720}°\n${rows.join('\n')}`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
  }

  build(+ui.querySelector('input[name="cyl"]:checked').value);
  return { tick };
}
