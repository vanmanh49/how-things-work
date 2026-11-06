// Procedural engine. 1 unit = 10 mm. Crank axis on the x axis at y = 0, cylinders vertical.
import * as THREE from 'three';
import {
  BORE, R, L, CR, STROKE, INTAKE, EXHAUST,
  wrapTheta, pistonY, valveLift, cylinderPhase, camRadius,
} from './kinematics.js';

const U = 0.1;                     // mm → units
const RAD = Math.PI / 180;
const SPACING = 10;                // cylinder pitch, units
const PISTON_H = 6;
const PIN_TO_TOP = 4.5;            // piston pin → crown
const TDC_TOP = pistonY(0) * U + PIN_TO_TOP;
const HEAD_Y = TDC_TOP + (STROKE * U) / (CR - 1);   // clearance volume gives 10:1
const VALVE_Z = 2;
const STEM_TOP = -0.2 + 3.4 + 3.25;   // closed-valve stem tip above HEAD_Y (disc offset + stem centre + half stem)
const CAM_BASE = 1.0;                 // lobe base-circle radius, units
const CAM_Y = HEAD_Y + STEM_TOP + CAM_BASE;   // base circle just touches the closed stem

const COLORS = {
  piston: 0xcbd5e1, rod: 0x64748b, crankshaft: 0x475569, intakeValve: 0x60a5fa,
  exhaustValve: 0xf87171, camshaft: 0xa78bfa, sparkPlug: 0xf5f5f4, block: 0x94a3b8,
};

// Lobe outline from camRadius, so the face touching the stem is exactly base + valve lift.
// Shape is drawn with the nose (ψ = 0) toward −y, extruded, then turned so the cam axis is x.
function lobeGeometry(win) {
  const shape = new THREE.Shape();
  for (let k = 0; k <= 128; k++) {
    const psi = (k / 128) * 360;
    const r = CAM_BASE + camRadius(psi, win) * U;
    const a = psi * RAD;
    const x = r * Math.sin(a), y = -r * Math.cos(a);
    k ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -0.8);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export const ENGINE_DIMS = { HEAD_Y, TDC_TOP, PIN_TO_TOP, BORE_UNITS: BORE * U, VALVE_Z, SPACING };

export function createEngine(cylinders) {
  const group = new THREE.Group();
  const parts = [];
  const chambers = [];
  const labelAnchors = {};
  const blockMeshes = [];

  const mesh = (geo, partId, cylinder, opts = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[partId], metalness: 0.4, roughness: 0.45, ...opts });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = !opts.transparent;
    m.userData = { partId, cylinder };
    parts.push(m);
    if (cylinder === 1 && !labelAnchors[partId]) labelAnchors[partId] = m;
    return m;
  };
  const cyl = (r, h, seg = 32) => new THREE.CylinderGeometry(r, r, h, seg);
  const alongX = (geo) => geo.rotateZ(Math.PI / 2);

  const xOf = (i) => (i - 1 - (cylinders - 1) / 2) * SPACING;
  const len = cylinders * SPACING;

  // Crankshaft rotates with θ; throws are fixed inside it at -phase so each pin sits at its local angle.
  const crank = new THREE.Group();
  crank.add(mesh(alongX(cyl(1.2, len + 4)), 'crankshaft', 0));
  group.add(crank);

  // Two camshafts (DOHC) at half crank speed; each lobe points down when its valve is at peak lift.
  const cams = [-VALVE_Z, VALVE_Z].map((z) => {
    const c = new THREE.Group();
    c.position.set(0, CAM_Y, z);
    c.add(mesh(alongX(cyl(0.6, len + 2)), 'camshaft', 0));
    group.add(c);
    return c;
  });

  const cyls = [];
  for (let i = 1; i <= cylinders; i++) {
    const x = xOf(i);
    const phase = cylinderPhase(i);

    const throwG = new THREE.Group();
    throwG.position.x = x;
    throwG.rotation.x = -phase * RAD;
    const pin = mesh(alongX(cyl(1.0, 2.6)), 'crankshaft', i);
    pin.position.y = R * U;
    const webA = mesh(new THREE.BoxGeometry(0.8, R * U + 2.4, 2.6), 'crankshaft', i);
    webA.position.set(-1.7, (R * U) / 2 - 0.6, 0);
    const webB = webA.clone(); webB.material = webA.material.clone(); webB.userData = { ...webA.userData };
    webB.position.x = 1.7; parts.push(webB);
    const counter = mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.8, 32, 1, false, Math.PI, Math.PI), 'crankshaft', i); // half-disc opposite the pin
    counter.rotation.z = Math.PI / 2;
    counter.position.set(-1.7, 0, 0);
    throwG.add(pin, webA, webB, counter);
    crank.add(throwG);

    const piston = mesh(cyl(BORE * U / 2 - 0.1, PISTON_H), 'piston', i);
    const rod = mesh(new THREE.BoxGeometry(1.0, L * U, 1.4), 'rod', i);
    rod.geometry.translate(0, (L * U) / 2, 0);   // origin at the crank-pin end

    const valves = [['intakeValve', -VALVE_Z, INTAKE], ['exhaustValve', VALVE_Z, EXHAUST]].map(([id, z, win]) => {
      const v = mesh(cyl(1.5, 0.4), id, i);
      const stem = new THREE.Mesh(cyl(0.2, 6.5, 8), v.material);
      stem.position.y = 3.4;
      stem.userData = { ...v.userData };
      parts.push(stem);
      v.add(stem);
      v.position.set(x, HEAD_Y - 0.2, z);
      return { v, win, z };
    });

    // Lobe vector starts at -y; offset so net cam angle is 0 when local θ = window midpoint.
    valves.forEach(({ win }, k) => {
      const lobe = mesh(lobeGeometry(win), 'camshaft', i);
      const holder = new THREE.Group();
      holder.position.x = x;
      holder.rotation.x = -((win[0] + win[1]) / 2 + phase) / 2 * RAD;
      holder.add(lobe);
      cams[k].add(holder);
    });

    const plug = mesh(cyl(0.45, 3), 'sparkPlug', i);
    plug.position.set(x, HEAD_Y + 1.5, 0);

    const chamber = new THREE.Object3D();
    chamber.position.set(x, (TDC_TOP + HEAD_Y) / 2, 0);

    const blk = mesh(new THREE.BoxGeometry(SPACING - 0.4, HEAD_Y - 6, SPACING), 'block', i,
      { transparent: true, opacity: 0.18, depthWrite: false, metalness: 0.1 });
    blk.position.set(x, (HEAD_Y + 6) / 2, 0);
    const head = mesh(new THREE.BoxGeometry(SPACING - 0.4, 4, SPACING), 'block', i,
      { transparent: true, opacity: 0.18, depthWrite: false, metalness: 0.1 });
    head.position.set(x, HEAD_Y + 2, 0);
    blockMeshes.push(blk, head);

    group.add(piston, rod, plug, chamber, blk, head, ...valves.map((o) => o.v));
    chambers.push(chamber);
    cyls.push({ i, phase, piston, rod, valves });
  }

  group.userData = { chambers, labelAnchors };

  function update(theta) {
    crank.rotation.x = theta * RAD;
    cams.forEach((c) => { c.rotation.x = (theta / 2) * RAD; });
    for (const c of cyls) {
      const local = wrapTheta(theta - c.phase);
      const a = local * RAD;
      const pinY = pistonY(local) * U;
      c.piston.position.set(xOf(c.i), pinY + PIN_TO_TOP - PISTON_H / 2, 0);
      const cy = R * U * Math.cos(a), cz = R * U * Math.sin(a);
      c.rod.position.set(xOf(c.i), cy, cz);
      c.rod.rotation.x = Math.atan2(-cz, pinY - cy);   // rotate +y onto pin→piston-pin
      for (const { v, win } of c.valves) v.position.y = HEAD_Y - 0.2 - valveLift(local, win) * U;
    }
  }

  function setCutaway(on) { blockMeshes.forEach((m) => { m.visible = !on; }); }

  function dispose() {
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    group.removeFromParent();
  }

  update(0);
  return { group, parts, cylinders, update, setCutaway, dispose };
}
