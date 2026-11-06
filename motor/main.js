import * as THREE from 'three';
import { hasWebGL, createView } from '../core/view.js';
import { startLoop } from '../core/loop.js';
import { createMotor } from './scene.js';
import { commutatorSign } from './physics.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?angle=N pins the rotor angle to N degrees (used for screenshots).
const pinnedParam = new URLSearchParams(location.search).get('angle');
const pinnedAngle = pinnedParam === null || isNaN(+pinnedParam) ? null : +pinnedParam;

function start() {
  if (!hasWebGL()) {
    document.getElementById('no-webgl').hidden = false;
    document.getElementById('story').hidden = true;
    document.getElementById('sandbox').hidden = true;
    return;
  }
  const stage = createView(document.getElementById('stage-canvas'));
  const motor = createMotor();
  stage.scene.add(motor.group);
  stage.camera.position.set(6, 8, 20);
  stage.camera.lookAt(new THREE.Vector3(0, 0, -1));

  let angle = 30;
  startLoop([stage], (dt) => {
    if (!stage.visible) return;
    if (pinnedAngle !== null) angle = pinnedAngle;
    else if (!reducedMotion) angle = (angle + 30 * Math.min(dt, 0.1)) % 360;
    motor.update({ angle, currentSign: commutatorSign(angle), currentMag: 0.5, forceMag: 0.5 });
    stage.render();
  });
}

start();
