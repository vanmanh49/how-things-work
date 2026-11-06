import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { hasWebGL, createView } from '../core/view.js';
import { startLoop } from '../core/loop.js';
import { sliceProgress, initScroll } from '../core/scroll.js';
import { createSystem } from './scene.js';
import {
  YEAR, SYNODIC, advanceTime, dayLength, noonAltitude, phaseName, illuminatedFraction, eclipseAt,
} from './orbits.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?t=N pins time to N days (used for screenshots).
const pinnedParam = new URLSearchParams(location.search).get('t');
const pinnedT = pinnedParam === null || isNaN(+pinnedParam) ? null : +pinnedParam;
const PIN_LAT = 40;

const STEPS = ['system', 'day', 'seasons', 'phases', 'eclipses'];

// Walkthrough step → time, camera preset, inset and labels.
function solarState({ step, stepProgress: sp }) {
  switch (step) {
    case 'system': return { t: 0, camera: 'wide', inset: 'none', labels: true };
    case 'day': return { t: 2 * sp, camera: 'earthClose', inset: 'none', labels: false };
    case 'seasons': return { t: YEAR * sp, camera: 'seasons', inset: 'daylight', labels: false };
    case 'phases': return { t: SYNODIC * sp, camera: 'moonTop', inset: 'moonView', labels: false };
    default: return { t: YEAR * sp, camera: 'eclipseSide', inset: 'none', labels: false };
  }
}

// [text, nudge side, local y offset on the anchor]
const LABELS = {
  sun: ['Sun', '', 12], earth: ['Earth', '', -3.2], axis: ["Earth's axis", '', 1.6], moon: ['Moon', 'right', 1],
  earthOrbit: ["Earth's orbit", '', 0], moonOrbit: ["Moon's orbit", 'right', -1.5],
};

// Camera presets: [position, look-at] for time t and the current Earth position E.
function cameraTarget(name, E) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  switch (name) {
    case 'earthClose': return [E.clone().add(v(6, 3, 8)), E.clone()];
    case 'seasons': return [E.clone().add(v(28, 6, 0)), E.clone()];   // follows Earth, side-on to the June–December line, so the lean shows
    case 'moonTop': return [E.clone().add(v(0, 24, 4)), E.clone()];
    case 'eclipseSide': {
      // Side-on to the Sun–Earth line at Earth's level, looking a little sunward of Earth.
      const sunward = E.clone().negate().normalize();
      const side = new THREE.Vector3().crossVectors(sunward, v(0, 1, 0)).normalize();
      return [E.clone().addScaledVector(side, 30).addScaledVector(sunward, 4).add(v(0, 2, 0)), E.clone().addScaledVector(sunward, 4)];
    }
    default: return [v(0, 105, 165), v(0, 0, 0)];
  }
}

function start() {
  if (!hasWebGL()) {
    document.getElementById('no-webgl').hidden = false;
    document.getElementById('story').hidden = true;
    document.getElementById('sandbox').hidden = true;
    return;
  }

  const canvas = document.getElementById('stage-canvas');
  const stage = createView(canvas);
  stage.camera.far = 1000; stage.camera.updateProjectionMatrix();
  const system = createSystem();
  stage.scene.add(system.group);

  // Part labels (only in "Meet the system").
  const labelLayer = document.getElementById('labels');
  const labels = new CSS2DRenderer({ element: labelLayer });
  const sizeLabels = () => labels.setSize(labelLayer.clientWidth, labelLayer.clientHeight);
  sizeLabels();
  const anchors = system.group.userData.labelAnchors;
  for (const [id, [text, side, y]] of Object.entries(LABELS)) {
    const el = document.createElement('div');
    el.className = `label ${side}`;
    el.innerHTML = `<span>${text}</span>`;
    const obj = new CSS2DObject(el);
    obj.position.y = y;
    anchors[id].add(obj);
  }

  // Insets: daylight text box, or a second camera on Earth's surface looking at the Moon.
  const insetBox = document.getElementById('inset-box');
  const insetLabel = document.getElementById('inset-label');
  const moonCam = new THREE.PerspectiveCamera(14, 1, 0.05, 50);
  const tmp = new THREE.Vector3();
  function renderMoonInset() {
    const c = canvas.getBoundingClientRect(), b = insetBox.getBoundingClientRect();
    const r = stage.renderer;
    const x = b.left - c.left, y = c.bottom - b.bottom, w = b.width, h = b.height;
    tmp.copy(system.moon.position).sub(system.earth.position).normalize();
    moonCam.position.copy(system.earth.position).addScaledVector(tmp, 2.1);
    moonCam.lookAt(system.moon.position);
    moonCam.aspect = w / h; moonCam.updateProjectionMatrix();
    r.setScissorTest(true);
    r.setScissor(x, y, w, h); r.setViewport(x, y, w, h);
    r.setClearColor(0x020617); r.clear();
    r.render(stage.scene, moonCam);
    r.setScissorTest(false);
    r.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    r.setClearColor(0x0f172a);
  }

  let scroll = { slice: sliceProgress(0, STEPS), raw: -1 };
  initScroll(document.getElementById('walkthrough'), STEPS, (slice, raw) => { scroll = { slice, raw }; });

  const camPos = new THREE.Vector3(0, 105, 165), camLook = new THREE.Vector3();
  let t = 0;
  startLoop([stage, { resize: sizeLabels }], (dt) => {
    if (!stage.visible) return;
    const inHero = scroll.raw < 0;
    const st = inHero ? { t, camera: 'wide', inset: 'none', labels: false } : solarState(scroll.slice);
    if (pinnedT !== null) t = pinnedT;
    else if (inHero) { if (!reducedMotion) t = advanceTime(t, 2, dt); }
    else t = st.t;

    system.update(t, { lat: PIN_LAT });
    system.setShadowCone(eclipseAt(t));
    system.setSunLine(!inHero && st.camera === 'eclipseSide');

    // Ease the camera toward its preset (snap under reduced motion).
    const [toPos, toLook] = cameraTarget(st.camera, system.earth.position);
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt / 0.2);
    camPos.lerp(toPos, k); camLook.lerp(toLook, k);
    stage.camera.position.copy(camPos); stage.camera.lookAt(camLook);

    insetBox.hidden = st.inset === 'none';
    insetBox.classList.toggle('text', st.inset === 'daylight');
    if (st.inset === 'daylight') {
      insetLabel.textContent = `Daylight at ${PIN_LAT}°N: ${dayLength(PIN_LAT, t).toFixed(1)} h · Noon Sun: ${Math.round(noonAltitude(PIN_LAT, t))}°`;
    } else if (st.inset === 'moonView') {
      insetLabel.textContent = `Seen from Earth: ${phaseName(t)} (${Math.round(100 * illuminatedFraction(t))}% lit)`;
    }

    stage.render();
    if (st.inset === 'moonView') renderMoonInset();
    labelLayer.hidden = !st.labels;
    if (st.labels) labels.render(stage.scene, stage.camera);
  });
}

start();
