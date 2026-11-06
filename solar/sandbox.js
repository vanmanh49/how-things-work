// Free-explore sandbox: speed, play/pause, stepping, jump-to-event, latitude, toggles, click-a-body cards.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSystem, createLabels, renderMoonInset, SUN_LAYER } from './scene.js';
import {
  YEAR, advanceTime, nextEvent, speedFromSlider, phaseName, illuminatedFraction, dayLength, noonAltitude,
  seasonNorth, seasonSouth, eclipseAt,
} from './orbits.js';
import { BODIES } from './bodies.js';
import { bindPicking, createCard } from '../core/cards.js';

const latText = (lat) => (lat === 0 ? '0°' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`);
const speedText = (dps) => (dps < 1 ? `${(dps * 24).toFixed(1)} hours per second` : `${dps.toFixed(1)} days per second`);

export function initSandbox(view, ui) {
  const $ = (id) => document.getElementById(id);
  const speed = $('speed'), speedOut = $('speed-out'), play = $('play'), lat = $('lat'), latOut = $('lat-out');
  const readout = $('readout'), inset = $('sandbox-inset'), insetLabel = inset.querySelector('.inset-label');
  const paths = $('paths'), labelsToggle = $('labels-toggle'), moonInset = $('moon-inset');

  view.camera.far = 1000; view.camera.updateProjectionMatrix();
  view.camera.layers.enable(SUN_LAYER);
  const system = createSystem();
  view.scene.add(system.group);
  const labelLayer = $('sandbox-labels');
  const labels = createLabels(system, labelLayer);

  // Orbit around Earth; the target follows Earth, keeping the user's chosen viewing angle.
  const controls = new OrbitControls(view.camera, view.renderer.domElement);
  controls.enableZoom = false;   // wheel must keep scrolling the page
  controls.enablePan = false;
  const offset = new THREE.Vector3(26, 12, 26);

  let t = 0;
  let dps = speedFromSlider(+speed.value);
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setPlaying = (on) => { playing = on; play.textContent = on ? 'Pause' : 'Play'; };
  setPlaying(playing);
  const pauseAt = (newT) => { setPlaying(false); t = newT; };

  speedOut.textContent = speedText(dps);
  speed.addEventListener('input', () => { dps = speedFromSlider(+speed.value); speedOut.textContent = speedText(dps); });
  play.addEventListener('click', () => setPlaying(!playing));
  for (const [id, d] of [['back-day', -1], ['back-hour', -1 / 24], ['fwd-hour', 1 / 24], ['fwd-day', 1]]) {
    $(id).addEventListener('click', () => pauseAt(t + d));
  }
  ui.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => pauseAt(nextEvent(t, b.dataset.kind))));
  lat.addEventListener('input', () => { latOut.textContent = latText(+lat.value); });
  paths.addEventListener('change', () => system.setPaths(paths.checked));

  // Click (not drag) a body → info card. Escape or clicking empty space closes it.
  const card = createCard($('part-card'));
  bindPicking(view.renderer.domElement, view.camera, () => system.parts, (hits) => {
    const body = BODIES[hits[0].object.userData.bodyId];
    card.show(body.name, body.text);
  }, () => card.hide());

  let lastText = '';
  function tick(dt) {
    if (playing) t = advanceTime(t, dps, dt);
    const la = +lat.value;
    system.update(t, { lat: la });
    const ecl = eclipseAt(t);
    system.setShadowCone(ecl);

    // Keep the camera's offset from Earth while the user orbits.
    offset.copy(view.camera.position).sub(controls.target);
    controls.target.copy(system.earth.position);
    view.camera.position.copy(controls.target).add(offset);
    controls.update();

    const day = Math.floor(((t % YEAR) + YEAR) % YEAR);
    const text = [
      `Day ${day} of year`,
      `North: ${seasonNorth(t)} · South: ${seasonSouth(t)}`,
      `At ${latText(la)}: ${dayLength(la, t).toFixed(1)} h daylight, noon Sun ${Math.round(noonAltitude(la, t))}°`,
      `Moon: ${phaseName(t)} (${Math.round(100 * illuminatedFraction(t))}% lit)`,
      `Eclipse: ${ecl ?? 'none'}`,
    ].join('\n');
    if (text !== lastText) { readout.textContent = text; lastText = text; }

    view.render();
    inset.hidden = !moonInset.checked;
    if (moonInset.checked) {
      insetLabel.textContent = `Seen from Earth: ${phaseName(t)}`;
      renderMoonInset(view, system, inset, ecl);
    }
    labelLayer.hidden = !labelsToggle.checked;
    if (labelsToggle.checked) labels.render(view.scene, view.camera);
  }

  // Start the camera at its offset from Earth.
  system.update(0, { lat: +lat.value });
  controls.target.copy(system.earth.position);
  view.camera.position.copy(controls.target).add(offset);
  controls.update();

  return { tick, labels };
}
