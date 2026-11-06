// Classroom brushed DC motor / generator. Pure maths: no Three.js, no DOM.
// Angles in degrees (θ = 0: coil plane horizontal, parallel to the field), ω in rad/s, t in real seconds.

export const TURNS = 20, COIL_L = 0.05, COIL_W = 0.04, B0 = 0.5;
export const K0 = TURNS * B0 * COIL_L * COIL_W; // 0.02 V·s/rad
export const R = 2, J = 2e-5, FRICTION = 1e-5, BULB_R = 4, MAX_LOAD = 0.05, SLOW = 20;

const SUB = 0.001; // max internal step, real seconds
const wrap360 = (a) => ((a % 360) + 360) % 360;

export const motorConstant = (magnet) => K0 * magnet;
export const current = (V, omega, k) => (V - k * omega) / R;
export const emf = (k, omega) => k * omega;
export const toRpm = (omega) => (omega * 60) / (2 * Math.PI);
export const fromRpm = (rpm) => (rpm * 2 * Math.PI) / 60;

function motorOmega(omega, { V, magnet, load }, h) {
  const k = motorConstant(magnet);
  const drive = k * current(V, omega, k) - FRICTION * omega;
  if (omega === 0 && Math.abs(drive) <= load) return 0;
  const dir = Math.sign(omega) || Math.sign(drive);
  const next = omega + (h * (drive - load * dir)) / J;
  // Brake or coasting can stop the rotor but never reverse it.
  return omega !== 0 && Math.sign(next) !== Math.sign(omega) ? 0 : next;
}

// Advance by T real seconds without clamping, in sub-steps of at most 1 ms (semi-implicit Euler).
function integrate(state, inputs, T) {
  let { t, omega, angle } = state;
  const n = Math.max(1, Math.ceil(T / SUB - 1e-9)), h = T / n;
  for (let i = 0; i < n; i++) {
    omega = inputs.mode === 'generator' ? fromRpm(inputs.crankRpm) : motorOmega(omega, inputs, h);
    angle = wrap360(angle + (omega * h * 180) / Math.PI);
    t += h;
  }
  return { t, omega, angle };
}

// dtShown is on-screen seconds; the hidden-tab clamp caps it at 0.1 s, then slow motion divides by SLOW.
export const step = (state, inputs, dtShown) => integrate(state, inputs, Math.min(dtShown, 0.1) / SLOW);

export function steadyState({ V, magnet, load }) {
  const k = motorConstant(magnet), s = Math.sign(V);
  const omega = s * Math.max(0, (k * Math.abs(V) / R - load) / (k * k / R + FRICTION));
  const I = current(V, omega, k);
  return { omega, current: I, torque: k * I };
}

export function readouts({ omega }, inputs) {
  const k = motorConstant(inputs.magnet), backEmf = emf(k, omega), rpm = toRpm(omega);
  if (inputs.mode === 'generator') {
    const I = backEmf / (R + BULB_R), bulbPower = I * I * BULB_R;
    const powerIn = k * I * omega + FRICTION * omega * omega;
    return { rpm, current: I, torque: k * I, backEmf, powerIn, powerOut: bulbPower, efficiency: powerIn > 0 ? bulbPower / powerIn : 0, bulbPower };
  }
  const I = current(inputs.V, omega, k), powerIn = inputs.V * I, powerOut = inputs.load * Math.abs(omega);
  return { rpm, current: I, torque: k * I, backEmf, powerIn, powerOut, efficiency: powerIn > 0 ? powerOut / powerIn : 0, bulbPower: 0 };
}

const cosd = (deg) => Math.cos((deg * Math.PI) / 180);
export const loopTorque = (thetaDeg, kind) => (kind === 'split' ? Math.abs(cosd(thetaDeg)) : cosd(thetaDeg));
export const commutatorSign = (thetaDeg) => { const a = wrap360(thetaDeg); return a < 90 || a > 270 ? 1 : -1; };
export const rockingAngle = (p) => 90 - 90 * Math.exp(-3 * p) * Math.cos(4 * Math.PI * p);

export function spinUp(V, magnet, seconds, n) {
  const inputs = { mode: 'motor', V, magnet, load: 0 }, k = motorConstant(magnet), dt = seconds / (n - 1);
  let s = { t: 0, omega: 0, angle: 0 };
  const out = [];
  for (let i = 0; i < n; i++) {
    if (i) s = integrate(s, inputs, dt);
    out.push({ t: i * dt, omega: s.omega, current: current(V, s.omega, k), angle: s.angle });
  }
  return out;
}
