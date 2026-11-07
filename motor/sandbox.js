// Free-explore sandbox: motor or generator mode, live physics, arrows, readout, rolling chart, click-a-part cards.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMotor } from './scene.js';
import { createChart } from './chart.js';
import { step, readouts, commutatorSign, SLOW } from './physics.js';
import { PARTS } from './parts.js';
import { bindPicking, createCard } from '../core/cards.js';

const WINDOW = 5;   // seconds of shown time on the chart
// Raycasting ignores visibility, so skip meshes inside a hidden group (battery/bulb, unused commutator).
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

export function initSandbox(view, ui) {
  const $ = (id) => document.getElementById(id);
  const volts = $('volts'), load = $('load'), magnet = $('magnet'), crank = $('crank'), play = $('play'), readout = $('readout');
  const toggles = { field: $('show-field'), current: $('show-current'), force: $('show-force') };

  const motor = createMotor();
  view.scene.add(motor.group);
  view.camera.position.set(6, 8, 20);
  const controls = new OrbitControls(view.camera, view.renderer.domElement);
  controls.enableZoom = false;   // wheel must keep scrolling the page
  controls.enablePan = false;
  controls.target.set(0, 0, -1);
  controls.update();

  const chart = createChart($('sandbox-chart'), [
    { key: 'rpm', label: 'Speed (0–6000 rpm)', color: '#38bdf8', max: 6000 },
    { key: 'current', label: 'Current (0–6 A)', color: '#f97316', max: 6 },
  ]);
  let points = [];

  let state = { t: 0, omega: 0, angle: 30 };
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setPlaying = (on) => { playing = on; play.textContent = on ? 'Pause' : 'Play'; };
  setPlaying(playing);
  play.addEventListener('click', () => setPlaying(!playing));

  let mode = 'motor';
  ui.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
    mode = r.value;   // state (speed and angle) carries over
    $('motor-controls').hidden = mode !== 'motor';
    $('gen-controls').hidden = mode !== 'generator';
  }));
  for (const [input, out] of [[volts, 'volts-out'], [load, 'load-out'], [magnet, 'magnet-out'], [crank, 'crank-out']]) {
    input.addEventListener('input', () => { $(out).textContent = input.value; });
  }
  Object.values(toggles).forEach((t) => t.addEventListener('change', () => motor.setArrows({
    field: toggles.field.checked, current: toggles.current.checked, force: toggles.force.checked,
  })));

  const card = createCard($('part-card'));
  bindPicking(view.renderer.domElement, view.camera, () => motor.parts.filter(shown), (hits) => {
    const p = PARTS[hits[0].object.userData.partId];
    card.show(p.name, p.text);
  }, () => card.hide());

  let lastText = '';
  function tick(dt) {
    const m = +magnet.value / 100;
    const inputs = mode === 'motor'
      ? { mode, V: +volts.value, magnet: m, load: +load.value / 1000 }
      : { mode, crankRpm: +crank.value, magnet: m };
    if (playing) state = step(state, inputs, dt);
    const r = readouts(state, inputs);

    // Force follows the current; a generator's induced current pushes against the motion (Lenz).
    const currentSign = commutatorSign(state.angle) * Math.sign(r.current || 1) * (mode === 'generator' ? -1 : 1);
    motor.update({
      angle: state.angle, currentSign, mode, bulbPower: r.bulbPower,
      currentMag: Math.min(1, Math.abs(r.current) / 6), forceMag: Math.min(1, Math.abs(r.torque) / 0.12),
    });

    if (playing) {
      points.push({ t: state.t * SLOW, rpm: Math.abs(r.rpm), current: Math.abs(r.current) });
      const cut = state.t * SLOW - WINDOW;
      if (points[0].t < cut) points = points.filter((p) => p.t >= cut);
    }
    chart.draw(points, WINDOW);

    const lines = [
      `Speed: ${r.rpm.toFixed(0)} rpm`,
      `Current: ${r.current.toFixed(2)} A · Torque: ${(r.torque * 1000).toFixed(1)} mN·m`,
      `Back-EMF: ${r.backEmf.toFixed(2)} V`,
      `Power in: ${r.powerIn.toFixed(2)} W · out: ${r.powerOut.toFixed(2)} W · Efficiency: ${(r.efficiency * 100).toFixed(0)} %`,
    ];
    if (mode === 'generator') lines.push(`Bulb: ${r.bulbPower.toFixed(2)} W`);
    const text = lines.join('\n');
    if (text !== lastText) { readout.textContent = text; lastText = text; }

    controls.update();
    view.render();
  }

  return { tick };
}
