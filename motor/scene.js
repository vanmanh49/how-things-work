// Simple brushed DC motor, 1 unit = 1 cm. Shaft along z, magnetic field along +x.
// θ (degrees) turns the coil about z; θ = 0 means the coil plane is horizontal.
import * as THREE from 'three';

const COL = { N: 0xef4444, S: 0x3b82f6, field: 0xfacc15, current: 0xf97316, force: 0x22c55e, copper: 0xb87333 };
const SIDE = 2;          // coil side distance from the axis (half the 4 cm width)
const COMM_Z = -4.5;     // commutator position along the shaft
const BAT = new THREE.Vector3(0, -7, -6);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...extra });

// Annular sector (in the xy plane, centred on angle `centerDeg`) extruded along z.
function sector(rIn, rOut, centerDeg, widthDeg, depth, z0) {
  const a0 = THREE.MathUtils.degToRad(centerDeg - widthDeg / 2), a1 = THREE.MathUtils.degToRad(centerDeg + widthDeg / 2);
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, a0, a1, false);
  s.absarc(0, 0, rIn, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 32 });
  g.translate(0, 0, z0);
  return g;
}

// Solid arrow (lines are 1 px in WebGL): a shaft and a cone along local +y, with ArrowHelper-like setters.
const Y = new THREE.Vector3(0, 1, 0), HEAD = 0.55;
function makeArrow(color, r) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), m);
  const head = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.2, r * 3), HEAD, 16), m);
  const a = new THREE.Group();
  a.add(shaft, head);
  a.setDirection = (dir) => a.quaternion.setFromUnitVectors(Y, dir);
  a.setLength = (len) => {
    const body = Math.max(0.01, len - HEAD);
    shaft.scale.y = body; shaft.position.y = body / 2; head.position.y = body + HEAD / 2;
  };
  a.setLength(1);
  return a;
}

export function createMotor() {
  const group = new THREE.Group();
  const parts = [];
  const tag = (mesh, partId) => { mesh.userData.partId = partId; parts.push(mesh); return mesh; };

  group.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(8, 14, 12);
  group.add(key);

  // Magnets: curved pole pieces, N at −x (red), S at +x (blue).
  group.add(tag(new THREE.Mesh(sector(3.4, 4.4, 180, 60, 7, -3.5), mat(COL.N)), 'magnetN'));
  group.add(tag(new THREE.Mesh(sector(3.4, 4.4, 0, 60, 7, -3.5), mat(COL.S)), 'magnetS'));

  // Shaft.
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 11, 24), mat(0x94a3b8, { metalness: 0.6, roughness: 0.3 }));
  shaft.rotation.x = Math.PI / 2; shaft.position.z = -1;
  group.add(tag(shaft, 'shaft'));

  // Rotor: coil, its leads and the split ring turn together.
  const rotor = new THREE.Group();
  group.add(rotor);
  const copper = mat(COL.copper, { metalness: 0.5, roughness: 0.35 });
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), copper); m.position.set(x, y, z); return tag(m, 'coil'); };
  rotor.add(box(0.3, 0.3, 5, SIDE, 0, 0), box(0.3, 0.3, 5, -SIDE, 0, 0));
  rotor.add(box(2 * SIDE + 0.3, 0.3, 0.3, 0, 0, 2.5), box(2 * SIDE + 0.3, 0.3, 0.3, 0, 0, -2.5));
  // Leads from the back corners down to the commutator.
  for (const sx of [1, -1]) {
    const lead = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(sx * SIDE, 0, -2.5), new THREE.Vector3(sx * 0.7, 0, COMM_Z + 0.4)), 1, 0.08), copper);
    rotor.add(tag(lead, 'coil'));
  }

  // Commutator: split ring (rotates; gaps under the ±y brushes when the coil is vertical) or two slip rings.
  const ringMat = mat(COL.copper, { metalness: 0.6, roughness: 0.3 });
  const split = new THREE.Group();
  for (const c of [90, 270]) split.add(tag(new THREE.Mesh(sector(0.4, 0.75, c, 160, 1, COMM_Z - 0.5), ringMat), 'commutator'));
  const slip = new THREE.Group();
  for (const z of [-4.2, -5]) slip.add(tag(new THREE.Mesh(sector(0.4, 0.75, 0, 359.9, 0.45, z - 0.225), ringMat), 'commutator'));
  rotor.add(split, slip);

  // Brushes (fixed) and wires to the battery / bulb.
  const brushMat = mat(0x374151, { roughness: 0.9 });
  const brushes = [1, -1].map((sy) => {
    const b = tag(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.4), brushMat), 'brushes');
    b.position.set(0, sy * 1.1, COMM_Z);
    group.add(b);
    return b;
  });
  const wireMat = mat(0x64748b);
  let wires = [];
  function buildWires() {
    wires.forEach((w) => { group.remove(w); w.geometry.dispose(); });
    const [top, bot] = brushes.map((b) => b.position);
    const paths = [
      [new THREE.Vector3(0, 1.45, top.z), new THREE.Vector3(0, 3, top.z - 1), new THREE.Vector3(3, 1, -6.5), new THREE.Vector3(3, -6, -6), new THREE.Vector3(1.8, BAT.y, BAT.z)],
      [new THREE.Vector3(0, -1.45, bot.z), new THREE.Vector3(0, -3, bot.z - 1), new THREE.Vector3(-3, -5, -6.2), new THREE.Vector3(-1.8, BAT.y, BAT.z)],
    ];
    wires = paths.map((pts) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.07, 8), wireMat));
    group.add(...wires);
  }

  // Battery (motor mode): a cell lying along x with + and − ends.
  const battery = new THREE.Group();
  battery.position.copy(BAT);
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3, 24), mat(0x1f2937));
  cell.rotation.z = Math.PI / 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.9, 24), mat(0xd97706));
  band.rotation.z = Math.PI / 2; band.position.x = 1.0;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 16), mat(0xcbd5e1, { metalness: 0.7 }));
  cap.rotation.z = Math.PI / 2; cap.position.x = 1.65;
  battery.add(tag(cell, 'battery'), tag(band, 'battery'), tag(cap, 'battery'));
  group.add(battery);

  // Bulb (generator mode): glows with the power it receives.
  const bulb = new THREE.Group();
  bulb.position.copy(BAT);
  const glassMat = mat(0xfff7d6, { emissive: 0xffc04d, emissiveIntensity: 0, transparent: true, opacity: 0.9 });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), glassMat);
  glass.position.y = 0.6;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 20), mat(0x9ca3af, { metalness: 0.6 }));
  base.position.y = -0.5;
  bulb.add(tag(glass, 'bulb'), tag(base, 'bulb'));
  group.add(bulb);

  // Arrows: field (fixed), current (on the coil sides, turn with the coil), force (world ±y, at the sides).
  const arrow = (color, r = 0.09) => makeArrow(color, r);
  const field = new THREE.Group();
  for (const [y, z] of [[2.7, 1.6], [-2.7, 1.6], [2.7, -1.6], [-2.7, -1.6], [0, 3.1]]) {
    const a = arrow(COL.field, 0.05); a.position.set(-3.3, y, z); a.setDirection(new THREE.Vector3(1, 0, 0)); a.setLength(6.6); field.add(a);
  }
  group.add(field);
  const currentArrows = [arrow(COL.current), arrow(COL.current)];
  currentArrows.forEach((a) => rotor.add(a));
  const forceArrows = [arrow(COL.force), arrow(COL.force)];
  forceArrows.forEach((a) => group.add(a));

  // Label anchors (fixed points next to each part).
  const labelAnchors = {};
  for (const [id, p] of Object.entries({
    magnetN: [-4.9, 2.6, 0], magnetS: [4.9, 2.6, 0], coil: [0, 0.3, 2.6], shaft: [0, 0, 4.5],
    commutator: [1, 0, COMM_Z], brushes: [0, 1.7, COMM_Z], battery: [0, -8, -6], bulb: [0, -8, -6],
  })) { labelAnchors[id] = new THREE.Object3D(); labelAnchors[id].position.set(...p); group.add(labelAnchors[id]); }

  let arrowsOn = { field: true, current: true, force: true };
  let kind = 'split';
  const dirZ = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);

  function setCommutator(k) {
    kind = k;
    split.visible = k === 'split'; slip.visible = k === 'slip';
    brushes[0].position.z = k === 'slip' ? -4.2 : COMM_Z;
    brushes[1].position.z = k === 'slip' ? -5 : COMM_Z;
    buildWires();
  }
  setCommutator('split');

  function setArrows(on) { arrowsOn = { ...arrowsOn, ...on }; field.visible = arrowsOn.field; }

  function update({ angle, currentSign = 1, currentMag = 0, forceMag = 0, mode = 'motor', bulbPower = 0 }) {
    const th = THREE.MathUtils.degToRad(angle);
    rotor.rotation.z = th;
    battery.visible = mode === 'motor';
    bulb.visible = mode === 'generator';
    glassMat.emissiveIntensity = mode === 'generator' ? Math.min(1, bulbPower / 0.5) * 2.5 : 0;

    // Side 0 sits at +x in the coil frame and carries +z current when currentSign = +1; side 1 carries the opposite.
    const len = 1 + 2 * currentMag;
    currentArrows.forEach((a, i) => {
      const s = (i === 0 ? 1 : -1) * currentSign;
      dirZ.set(0, 0, s);
      a.setDirection(dirZ);
      a.position.set((i === 0 ? 1 : -1) * (SIDE + 0.35), 0, -s * len / 2);
      a.setLength(len);
      a.visible = arrowsOn.current && currentMag > 0.001;
    });
    // F = I L × B with B along +x: (+z) × (+x) = +y, so each side's force is straight up or down.
    const flen = 0.5 + 3 * forceMag;
    forceArrows.forEach((a, i) => {
      const r = i === 0 ? SIDE : -SIDE, s = (i === 0 ? 1 : -1) * currentSign;
      a.position.set(r * Math.cos(th), r * Math.sin(th), 0);
      a.setDirection(s > 0 ? UP : DOWN);
      a.setLength(flen);
      a.visible = arrowsOn.force && forceMag > 0.001;
    });
  }

  function dispose() {
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    group.removeFromParent();
  }

  return { group, parts, labelAnchors, update, setCommutator, setArrows, dispose, get commutator() { return kind; } };
}
