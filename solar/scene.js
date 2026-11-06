// Sun–Earth–Moon scene, not to scale. Ecliptic plane = xz, dir(λ) = (cos λ, 0, −sin λ).
// Everything is placed from orbits.js as a function of time t (days), so scrubbing time backwards works.
import * as THREE from 'three';
import {
  TILT, MOON_INCL, NODE, sunLongitude, moonLongitude, subsolarLongitude,
} from './orbits.js';

const RAD = Math.PI / 180;
const SUN_R = 10, EARTH_R = 2, EARTH_ORBIT = 60, MOON_R = 0.6, MOON_ORBIT = 8;
const DRAWN_INCL = 3 * MOON_INCL;   // drawn 3× larger so the tilt is visible; same sign as the real one

const dir = (lonDeg, out = new THREE.Vector3()) => out.set(Math.cos(lonDeg * RAD), 0, -Math.sin(lonDeg * RAD));

// Drawn Moon latitude: same sign as moonLatitude(t), exaggerated tilt.
const drawnLat = (moonLon) => Math.asin(Math.sin(DRAWN_INCL * RAD) * Math.sin((moonLon - NODE) * RAD));

// Moon offset from Earth for a given Moon longitude (shared by the Moon and its orbit line).
function moonOffset(moonLon, out = new THREE.Vector3()) {
  const b = drawnLat(moonLon);
  return dir(moonLon, out).multiplyScalar(Math.cos(b) * MOON_ORBIT).add(new THREE.Vector3(0, Math.sin(b) * MOON_ORBIT, 0));
}

// Rough continents: blobs (lat, lon, radius°). Longitude 0 sits near western Europe / Africa.
const LAND = [[15, 15, 32], [50, 10, 16], [45, 90, 38], [45, -100, 28], [-15, -60, 22], [-25, 135, 14], [65, -40, 10]];
function earthGeometry() {
  const geo = new THREE.SphereGeometry(EARTH_R, 72, 48);
  const pos = geo.attributes.position, colors = [];
  const ocean = new THREE.Color('#2563eb'), land = new THREE.Color('#16a34a'), ice = new THREE.Color('#e5e7eb');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const lat = Math.asin(v.y) / RAD, lon = Math.atan2(-v.z, v.x) / RAD;
    let c = ocean;
    for (const [la, lo, r] of LAND) {
      const d = Math.acos(Math.sin(la * RAD) * v.y + Math.cos(la * RAD) * Math.cos(lat * RAD) * Math.cos((lon - lo) * RAD)) / RAD;
      if (d < r * (1 + 0.18 * Math.sin(lon * 0.3 + lat * 0.2))) { c = land; break; }
    }
    if (Math.abs(lat) > 68) c = ice;
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

function ring(pointAt, color, n = 256) {
  const pts = Array.from({ length: n + 1 }, (_, k) => pointAt((k / n) * 360));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
}

export function createSystem() {
  const group = new THREE.Group();
  const parts = [];
  const pick = (m, bodyId) => { m.userData.bodyId = bodyId; parts.push(m); return m; };

  // Sun: the only real light source, so day/night and Moon phases come from actual lighting.
  const sun = pick(new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 32), new THREE.MeshBasicMaterial({ color: 0xfdb813 })), 'sun');
  const light = new THREE.PointLight(0xffffff, 3, 0, 0);
  group.add(sun, light, new THREE.AmbientLight(0xffffff, 0.06));

  const earthOrbit = ring((l) => dir(l).multiplyScalar(EARTH_ORBIT), 0x64748b);
  group.add(earthOrbit);

  // Earth: pivot (position) → tilt (axis fixed in space, north toward −z) → spin.
  const earth = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.x = -TILT * RAD;   // rotates +y onto (0, cos TILT, −sin TILT)
  const spin = new THREE.Group();
  const globe = pick(new THREE.Mesh(earthGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })), 'earth');
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d }));
  const axis = pick(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.4, 8), new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })), 'axis');
  const axisTop = new THREE.Object3D(); axisTop.position.y = 3.2;
  spin.add(globe, pin);
  tilt.add(spin, axis, axisTop);
  earth.add(tilt);
  group.add(earth);

  // Moon and its orbit line (follows Earth's position, not its tilt or spin).
  const moon = pick(new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 32, 24), new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 1 })), 'moon');
  const moonOrbitG = new THREE.Group();
  const moonOrbit = ring((l) => moonOffset(l), 0x94a3b8);
  moonOrbitG.add(moonOrbit);
  group.add(moon, moonOrbitG);

  const orbitLabel = new THREE.Object3D(); orbitLabel.position.copy(dir(135).multiplyScalar(EARTH_ORBIT));
  const moonOrbitLabel = new THREE.Object3D(); moonOrbitLabel.position.copy(moonOffset(300));
  moonOrbitG.add(moonOrbitLabel);
  group.add(orbitLabel);

  // Shadow cone: tip points away from the Sun; shown only during an eclipse.
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  cone.visible = false;
  group.add(cone);
  let coneKind = null;

  group.userData.labelAnchors = { sun, earth: globe, moon, axis: axisTop, earthOrbit: orbitLabel, moonOrbit: moonOrbitLabel };

  const tmp = new THREE.Vector3(), sunDir = new THREE.Vector3(), q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  function placeCone() {
    if (!coneKind) { cone.visible = false; return; }
    const from = coneKind === 'solar' ? moon.position : earth.position;
    const r = coneKind === 'solar' ? MOON_R : EARTH_R;
    const len = coneKind === 'solar' ? MOON_ORBIT : MOON_ORBIT * 1.3;
    const away = tmp.copy(from).normalize();                  // Sun is at the origin
    cone.scale.set(r, len, r);
    cone.quaternion.setFromUnitVectors(UP, away);   // cone's apex (+y) points away from the Sun; wide base at the body
    cone.position.copy(from).addScaledVector(away, len / 2);
    cone.visible = true;
  }

  function update(t, { lat = 40 } = {}) {
    const ls = sunLongitude(t);
    dir(ls + 180, earth.position).multiplyScalar(EARTH_ORBIT);

    // Spin so the subsolar longitude faces the Sun: find the Sun's azimuth in the tilted frame.
    sunDir.copy(earth.position).negate().normalize();
    q.setFromEuler(tilt.rotation).invert();
    sunDir.applyQuaternion(q);
    const sunAzimuth = Math.atan2(-sunDir.z, sunDir.x);
    spin.rotation.y = sunAzimuth - subsolarLongitude(t) * RAD;

    // Pin at (lat, 0°), pointing outward.
    const la = lat * RAD;
    pin.position.set(Math.cos(la), Math.sin(la), 0).multiplyScalar(EARTH_R + 0.2);
    pin.quaternion.setFromUnitVectors(UP, tmp.set(Math.cos(la), Math.sin(la), 0));

    moon.position.copy(earth.position).add(moonOffset(moonLongitude(t), tmp));
    moonOrbitG.position.copy(earth.position);
    placeCone();
  }

  return {
    group, parts, earth, moon, update,
    setPaths(on) { earthOrbit.visible = moonOrbit.visible = on; },
    setShadowCone(kind) { coneKind = kind; placeCone(); },
    dispose() {
      group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      group.removeFromParent();
    },
  };
}
