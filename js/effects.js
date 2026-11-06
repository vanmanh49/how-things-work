// Gas colour per stroke, intake/exhaust flow particles, spark flash. Everything is a function of θ,
// so scrubbing the scroll backwards plays the effects backwards too.
import * as THREE from 'three';
import { wrapTheta, strokeAt, cylinderPhase, pistonY, valveLift, INTAKE, EXHAUST } from './kinematics.js';
import { ENGINE_DIMS } from './engine.js';

const { HEAD_Y, PIN_TO_TOP, BORE_UNITS, VALVE_Z } = ENGINE_DIMS;
const FRESH = new THREE.Color('#3b82f6');
const SQUEEZED = new THREE.Color('#facc15');
const BURNING = new THREE.Color('#f97316');
const SPENT = new THREE.Color('#9ca3af');
const PER_PORT = 20;

const smooth = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

export function createEffects(engine) {
  const group = new THREE.Group();
  const n = engine.cylinders;
  const xs = engine.group.userData.chambers.map((c) => c.position.x);

  const gasGeo = new THREE.CylinderGeometry(BORE_UNITS / 2 - 0.15, BORE_UNITS / 2 - 0.15, 1, 32);
  gasGeo.translate(0, 0.5, 0);
  const sparkGeo = new THREE.SphereGeometry(0.35, 12, 8);
  const dotGeo = new THREE.SphereGeometry(0.22, 8, 6);

  const flows = [FRESH, SPENT].map((color) => {
    const m = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color }), n * PER_PORT);
    m.frustumCulled = false;
    group.add(m);
    return m;
  });

  const cyls = xs.map((x, k) => {
    const gas = new THREE.Mesh(gasGeo, new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.55, depthWrite: false }));
    gas.position.x = x;
    const spark = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xfff7cc, transparent: true }));
    spark.position.set(x, HEAD_Y - 0.3, 0);
    const light = new THREE.PointLight(0xffb347, 0, 25);
    light.position.copy(spark.position);
    group.add(gas, spark, light);
    return { i: k + 1, x, gas, spark, light };
  });

  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  // Port path: outside the head → under the valve. Intake runs it forwards, exhaust backwards.
  function placeFlow(mesh, k, x, side, open, progress, inward) {
    for (let j = 0; j < PER_PORT; j++) {
      const idx = k * PER_PORT + j;
      if (!open) { mesh.setMatrixAt(idx, zero); continue; }
      let t = (j / PER_PORT + progress * 3) % 1;
      if (!inward) t = 1 - t;
      const wobble = Math.sin(j * 12.9) * 0.6;
      p.set(x + wobble, smooth(HEAD_Y + 1.5, HEAD_Y - 1.2, t), side * smooth(8, VALVE_Z * 0.6, t));
      mesh.setMatrixAt(idx, m4.makeTranslation(p.x, p.y, p.z));
    }
  }

  function update(theta) {
    cyls.forEach((c, k) => {
      const local = wrapTheta(theta - cylinderPhase(c.i));
      const top = pistonY(local) / 10 + PIN_TO_TOP;
      c.gas.position.y = top;
      c.gas.scale.y = Math.max(0.01, HEAD_Y - top);

      const mat = c.gas.material;
      const stroke = strokeAt(local);
      const f = (local % 180) / 180;
      mat.emissive.setRGB(0, 0, 0);
      if (stroke === 'intake') { mat.color.copy(FRESH); mat.opacity = 0.5; }
      else if (stroke === 'compression') { mat.color.copy(FRESH).lerp(SQUEEZED, f); mat.opacity = 0.55 + 0.25 * f; }
      else if (stroke === 'power') {
        mat.color.copy(BURNING).lerp(SPENT, f);
        mat.emissive.copy(BURNING).multiplyScalar(1 - f);
        mat.opacity = 0.75 - 0.2 * f;
      } else { mat.color.copy(SPENT); mat.opacity = 0.55 * (1 - f) + 0.05; }

      // Spark: bright over local 355–370°, off elsewhere.
      const s = local >= 355 && local <= 370 ? 1 - Math.abs(local - 360) / 10 : 0;
      c.spark.material.opacity = s;
      c.spark.visible = s > 0;
      c.light.intensity = s * 400;

      const inLift = valveLift(local, INTAKE), exLift = valveLift(local, EXHAUST);
      placeFlow(flows[0], k, c.x, -1, inLift > 0.5, (local - INTAKE[0]) / 180, true);
      placeFlow(flows[1], k, c.x, 1, exLift > 0.5, (local - EXHAUST[0]) / 180, false);
    });
    flows.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }

  function dispose() {
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    group.removeFromParent();
  }

  update(0);
  return { group, update, dispose };
}
