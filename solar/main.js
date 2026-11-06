import * as THREE from 'three';
import { hasWebGL, createView } from '../core/view.js';
import { startLoop } from '../core/loop.js';
import { createSystem } from './scene.js';
import { advanceTime } from './orbits.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?t=N pins time to N days (used for screenshots).
const pinnedParam = new URLSearchParams(location.search).get('t');
const pinnedT = pinnedParam === null || isNaN(+pinnedParam) ? null : +pinnedParam;

function start() {
  if (!hasWebGL()) {
    document.getElementById('no-webgl').hidden = false;
    document.getElementById('story').hidden = true;
    document.getElementById('sandbox').hidden = true;
    return;
  }

  const stage = createView(document.getElementById('stage-canvas'));
  stage.camera.far = 1000; stage.camera.updateProjectionMatrix();
  stage.camera.position.set(0, 105, 165);
  stage.camera.lookAt(0, 0, 0);
  const system = createSystem();
  stage.scene.add(system.group);

  let t = 0;
  startLoop([stage], (dt) => {
    if (!stage.visible) return;
    if (pinnedT !== null) t = pinnedT;
    else if (!reducedMotion) t = advanceTime(t, 2, dt);
    system.update(t, { lat: 40 });
    stage.render();
  });
}

start();
