import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { hasWebGL, createView } from '../core/view.js';
import { startLoop } from '../core/loop.js';
import { sliceProgress, initScroll } from '../core/scroll.js';
import { createMotor } from './scene.js';
import { createChart } from './chart.js';
import { commutatorSign, loopTorque, rockingAngle, spinUp, step, readouts, toRpm, SLOW } from './physics.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?angle=N pins the rotor angle to N degrees (used for screenshots).
const pinnedParam = new URLSearchParams(location.search).get('angle');
const pinnedAngle = pinnedParam === null || isNaN(+pinnedParam) ? null : +pinnedParam;

const STEPS = ['parts', 'force', 'commutator', 'backemf', 'generator', 'ev'];
const SPINUP = spinUp(6, 1, 0.5, 200);
const NONE = { field: false, current: false, force: false };

// Walkthrough step → rotor angle, commutator, mode, arrows, camera and overlays.
function motorState({ step: name, stepProgress: sp }) {
  const base = { angle: 30, commutator: 'split', mode: 'motor', arrows: NONE, camera: 'wide', lhr: false, chart: null, labels: false, crankRpm: 0 };
  switch (name) {
    case 'parts': return { ...base, labels: true };
    case 'force': return { ...base, angle: 60 * sp, arrows: { field: true, current: true, force: true }, lhr: true, camera: 'sideClose' };
    case 'commutator': return sp < 0.5
      ? { ...base, commutator: 'slip', angle: rockingAngle(2 * sp), arrows: { field: false, current: true, force: true } }
      : { ...base, angle: 360 * (2 * sp - 1), arrows: { field: false, current: true, force: true } };
    case 'backemf': {
      const i = Math.round(sp * (SPINUP.length - 1));
      return { ...base, angle: SPINUP[i].angle, chart: i, arrows: { field: false, current: true, force: true } };
    }
    case 'generator': return { ...base, mode: 'generator', crankRpm: 1500 * sp, arrows: { field: true, current: true, force: false } };
    default: return base;
  }
}

const CAMERAS = {
  wide: [new THREE.Vector3(6, 8, 20), new THREE.Vector3(0, 0, -1)],
  sideClose: [new THREE.Vector3(4, 9, 12), new THREE.Vector3(1.5, 0, 0)],
};

const LABELS = {
  magnetN: ['N pole (magnet)', 'left'], magnetS: ['S pole (magnet)', 'right'], coil: ['Coil (20 turns)', ''],
  commutator: ['Commutator (split ring)', 'right'], brushes: ['Brushes', 'left'], battery: ['Battery', ''], shaft: ['Shaft', 'right'],
};
function createLabels(motor, layer) {
  const renderer = new CSS2DRenderer({ element: layer });
  for (const [id, [text, side]] of Object.entries(LABELS)) {
    const el = document.createElement('div');
    el.className = `label ${side}`;
    el.innerHTML = `<span>${text}</span>`;
    motor.labelAnchors[id].add(new CSS2DObject(el));
  }
  const resize = () => renderer.setSize(layer.clientWidth, layer.clientHeight);
  resize();
  return { resize, render: (scene, camera) => renderer.render(scene, camera) };
}

function start() {
  if (!hasWebGL()) {
    document.getElementById('no-webgl').hidden = false;
    document.getElementById('story').hidden = true;
    document.getElementById('sandbox').hidden = true;
    return;
  }
  const $ = (id) => document.getElementById(id);
  const stage = createView($('stage-canvas'));
  const motor = createMotor();
  stage.scene.add(motor.group);
  const labelLayer = $('labels');
  const labels = createLabels(motor, labelLayer);
  const chartBox = $('chart-box'), lhr = $('lhr'), gauge = $('gauge'), gaugeFill = gauge.querySelector('i');
  const chart = createChart($('chart'), [
    { key: 'rpm', label: 'Speed (0–3000 rpm)', color: '#38bdf8', max: 3000 },
    { key: 'current', label: 'Current (0–3 A)', color: '#f97316', max: 3 },
  ]);
  const chartPoints = SPINUP.map((s) => ({ t: s.t * SLOW, rpm: toRpm(s.omega), current: s.current }));

  let scroll = { slice: sliceProgress(0, STEPS), raw: -1 };
  initScroll($('walkthrough'), STEPS, (slice, raw) => { scroll = { slice, raw }; });

  const camPos = CAMERAS.wide[0].clone(), camLook = CAMERAS.wide[1].clone();
  let heroAngle = 30, gen = { t: 0, omega: 0, angle: 30 }, lastChart = -1;

  startLoop([stage, labels], (dt) => {
    if (!stage.visible) return;
    const inHero = scroll.raw < 0;
    const st = inHero ? { ...motorState({ step: 'parts', stepProgress: 0 }), labels: false } : motorState(scroll.slice);
    let angle = st.angle;
    if (inHero) { if (!reducedMotion) heroAngle = (heroAngle + 30 * Math.min(dt, 0.1)) % 360; angle = heroAngle; }

    let currentSign = commutatorSign(angle), currentMag = 0.5, forceMag = 0.5, bulbPower = 0;
    if (st.mode === 'generator') {
      const inputs = { mode: 'generator', crankRpm: st.crankRpm, magnet: 1 };
      if (!reducedMotion) gen = step(gen, inputs, dt);
      angle = gen.angle;
      const r = readouts(gen, inputs);
      bulbPower = r.bulbPower;
      currentSign = -commutatorSign(angle);   // induced current pushes against the motion (Lenz)
      currentMag = Math.min(1, r.current / 0.6);
    } else if (st.chart !== null) {
      currentMag = forceMag = SPINUP[st.chart].current / 6;
    } else if (st.commutator === 'slip') {
      currentSign = 1;                         // slip rings never swap the connections
      forceMag = Math.abs(loopTorque(angle, 'slip'));
    } else if (scroll.slice.step === 'commutator' && !inHero) {
      forceMag = loopTorque(angle, 'split');
    }
    if (pinnedAngle !== null) angle = pinnedAngle;

    if (motor.commutator !== st.commutator) motor.setCommutator(st.commutator);
    motor.setArrows(st.arrows);
    motor.update({ angle, currentSign, currentMag: st.arrows.current ? currentMag : 0, forceMag: st.arrows.force ? forceMag : 0, mode: st.mode, bulbPower });

    // Overlays: left-hand rule, torque gauge, spin-up chart.
    lhr.hidden = !st.lhr;
    const showGauge = !inHero && scroll.slice.step === 'commutator';
    gauge.hidden = !showGauge;
    if (showGauge) {
      const tq = loopTorque(angle, st.commutator);
      gaugeFill.style.left = tq >= 0 ? '50%' : `${50 + 50 * tq}%`;
      gaugeFill.style.width = `${50 * Math.abs(tq)}%`;
      gaugeFill.style.background = tq >= 0 ? '#22c55e' : '#ef4444';
    }
    chartBox.hidden = st.chart === null;
    if (st.chart !== null && st.chart !== lastChart) chart.draw(chartPoints.slice(0, st.chart + 1), 10);
    lastChart = st.chart ?? -1;

    // Ease the camera toward its preset (snap under reduced motion).
    const [toPos, toLook] = CAMERAS[st.camera];
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt / 0.2);
    camPos.lerp(toPos, k); camLook.lerp(toLook, k);
    stage.camera.position.copy(camPos); stage.camera.lookAt(camLook);

    stage.render();
    labelLayer.hidden = !st.labels;
    if (st.labels) labels.render(stage.scene, stage.camera);
  });
}

start();
