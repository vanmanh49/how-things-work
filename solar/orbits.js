// Pure Sun–Earth–Moon maths (idealized: circular orbits, fixed Moon node line). No Three.js, no DOM.
// t is time in days; day 0 = March equinox = new Moon. Angles in degrees.

export const YEAR = 365.25;        // days
export const SYNODIC = 29.53;      // new Moon → new Moon, days
export const TILT = 23.44;         // Earth's axial tilt
export const MOON_INCL = 5.14;     // Moon orbit tilt to Earth's orbit
export const NODE = 0;             // ascending node longitude (fixed)
export const SUN_R = 0.266;        // angular radius of the Sun as seen from Earth
export const MOON_R = 0.259;       // angular radius of the Moon
export const SOLAR_LIMIT = 1.48;   // Sun–Moon separation for an eclipse seen somewhere on Earth (includes lunar parallax)
export const LUNAR_LIMIT = 0.96;   // Moon to anti-Sun point: Earth's umbra (0.70°) + Moon radius

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const PHASES = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export const wrap360 = (deg) => ((deg % 360) + 360) % 360;
const frac = (x) => x - Math.floor(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const sunLongitude = (t) => wrap360((360 * t) / YEAR);
export const sunDeclination = (t) => DEG * Math.asin(Math.sin(TILT * RAD) * Math.sin(sunLongitude(t) * RAD));

// Hours of daylight; clamped so polar day = 24 and polar night = 0 (never NaN, even at ±90°).
export function dayLength(lat, t) {
  const x = -Math.tan(clamp(lat, -89.999, 89.999) * RAD) * Math.tan(sunDeclination(t) * RAD);
  return (24 / Math.PI) * Math.acos(clamp(x, -1, 1));
}

export const noonAltitude = (lat, t) => 90 - Math.abs(lat - sunDeclination(t));

// Longitude where the Sun is overhead: noon at 0° when t = n + 0.5. Range (−180, 180].
export const subsolarLongitude = (t) => 180 - 360 * frac(t);

export const moonElongation = (t) => wrap360((360 * t) / SYNODIC);
export const moonLongitude = (t) => wrap360(sunLongitude(t) + moonElongation(t));
export const moonLatitude = (t) => DEG * Math.asin(Math.sin(MOON_INCL * RAD) * Math.sin((moonLongitude(t) - NODE) * RAD));

export const illuminatedFraction = (t) => (1 - Math.cos(moonElongation(t) * RAD)) / 2;
export const phaseName = (t) => PHASES[Math.floor(wrap360(moonElongation(t) + 22.5) / 45) % 8];

export const seasonNorth = (t) => SEASONS[Math.floor(sunLongitude(t) / 90) % 4];
export const seasonSouth = (t) => SEASONS[(Math.floor(sunLongitude(t) / 90) + 2) % 4];

// Great-circle separation between two ecliptic positions (lon, lat), degrees.
function separation(l1, b1, l2, b2) {
  const c = Math.sin(b1 * RAD) * Math.sin(b2 * RAD) + Math.cos(b1 * RAD) * Math.cos(b2 * RAD) * Math.cos((l1 - l2) * RAD);
  return DEG * Math.acos(clamp(c, -1, 1));
}

export function eclipseAt(t) {
  const ls = sunLongitude(t), lm = moonLongitude(t), bm = moonLatitude(t);
  if (separation(ls, 0, lm, bm) < SOLAR_LIMIT) return 'solar';
  if (separation(ls + 180, 0, lm, bm) < LUNAR_LIMIT) return 'lunar';
  return null;
}

// [period, phase offset as a fraction of the period] for events that repeat exactly.
const PERIODIC = {
  marchEquinox: [YEAR, 0], juneSolstice: [YEAR, 0.25], septEquinox: [YEAR, 0.5], decSolstice: [YEAR, 0.75],
  newMoon: [SYNODIC, 0], fullMoon: [SYNODIC, 0.5],
};

// First event of `kind` strictly after t. For 'eclipse': skip the one in progress, then return the
// moment of deepest overlap of the next one.
export function nextEvent(t, kind) {
  if (kind !== 'eclipse') {
    const [period, off] = PERIODIC[kind];
    return (Math.floor((t + 1e-9) / period - off) + 1 + off) * period;
  }
  const STEP = 0.01, END = t + 2 * YEAR;
  let s = t;
  while (s < END && eclipseAt(s) !== null) s += STEP;
  while (s < END && eclipseAt(s) === null) s += STEP;
  if (s >= END) throw new Error('no eclipse within two years');
  const kindNow = eclipseAt(s);
  const depth = (x) => kindNow === 'solar'
    ? separation(sunLongitude(x), 0, moonLongitude(x), moonLatitude(x))
    : separation(sunLongitude(x) + 180, 0, moonLongitude(x), moonLatitude(x));
  let best = s;
  for (let x = s; eclipseAt(x) === kindNow; x += STEP) if (depth(x) < depth(best)) best = x;
  return best;
}

// Time step for animation; dt clamped so a hidden tab can't make the scene jump.
export const advanceTime = (t, daysPerSecond, dtSeconds) => t + daysPerSecond * Math.min(dtSeconds, 0.1);

// Sandbox speed slider 0..100 → days per second, log scale from 1 hour/s to 30 days/s.
export const speedFromSlider = (v) => (1 / 24) * 720 ** (v / 100);
