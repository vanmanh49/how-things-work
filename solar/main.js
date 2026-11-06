import * as THREE from 'three';
import { hasWebGL, createView } from '../core/view.js';
import { startLoop } from '../core/loop.js';
import { sliceProgress, initScroll } from '../core/scroll.js';
import { createSystem, createLabels, renderMoonInset } from './scene.js';
import { initSandbox } from './sandbox.js';
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

  // Part labels (only in "Meet the system") and the Moon-view / daylight inset.
  const labelLayer = document.getElementById('labels');
  const labels = createLabels(system, labelLayer);
  const insetBox = document.getElementById('inset-box');
  const insetLabel = insetBox.querySelector('.inset-label');

  const box = createView(document.getElementById('sandbox-canvas'));
  const sandbox = initSandbox(box, document.getElementById('sandbox-ui'));

  let scroll = { slice: sliceProgress(0, STEPS), raw: -1 };
  initScroll(document.getElementById('walkthrough'), STEPS, (slice, raw) => { scroll = { slice, raw }; });

  const camPos = new THREE.Vector3(0, 105, 165), camLook = new THREE.Vector3();
  let t = 0;
  startLoop([stage, labels, box, sandbox.labels], (dt) => {
    if (box.visible) sandbox.tick(dt);
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
    if (st.inset === 'moonView') renderMoonInset(stage, system, insetBox);
    labelLayer.hidden = !st.labels;
    if (st.labels) labels.render(stage.scene, stage.camera);
  });
}

start();
