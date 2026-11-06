// Pure engine maths. No Three.js, no DOM — imported by Node tests.
// θ is crank angle in degrees; one 4-stroke cycle = 720°.

export const BORE = 86;      // mm
export const STROKE = 86;    // mm
export const R = 43;         // crank radius, mm
export const L = 143;        // connecting rod length, mm
export const CR = 10;        // compression ratio
export const MAX_LIFT = 9;   // mm
export const INTAKE = [0, 180];
export const EXHAUST = [540, 720];
export const FIRING_ORDER = [1, 3, 4, 2];

const STROKES = ['intake', 'compression', 'power', 'exhaust'];
const RAD = Math.PI / 180;

export const wrapTheta = (theta) => ((theta % 720) + 720) % 720;

// Exact slider-crank: piston pin height above the crank axis.
export function pistonY(theta, r = R, l = L) {
  const a = theta * RAD;
  return r * Math.cos(a) + Math.sqrt(l * l - r * r * Math.sin(a) ** 2);
}

export function valveLift(theta, [opens, closes], maxLift = MAX_LIFT) {
  const t = wrapTheta(theta);
  if (t < opens || t > closes) return 0;
  return maxLift * Math.sin((Math.PI * (t - opens)) / (closes - opens)) ** 2;
}

export const strokeAt = (theta) => STROKES[Math.floor(wrapTheta(theta) / 180)];

export const cylinderPhase = (i, order = FIRING_ORDER) => 180 * order.indexOf(i);

// Animation runs at rpm/100 → 0.06·rpm °/s. dt clamped so a hidden tab can't jump the engine.
export const advanceTheta = (theta, rpm, dtSeconds) =>
  wrapTheta(theta + rpm * 0.06 * Math.min(dtSeconds, 0.1));
