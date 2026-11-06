import test from 'node:test';
import assert from 'node:assert/strict';
import {
  YEAR, SYNODIC, TILT,
  sunLongitude, sunDeclination, dayLength, noonAltitude, subsolarLongitude,
  illuminatedFraction, phaseName, seasonNorth, seasonSouth, eclipseAt, nextEvent, advanceTime, speedFromSlider,
} from '../../solar/orbits.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('declination: 0 at equinoxes, ±TILT at solstices', () => {
  close(sunDeclination(0), 0); close(sunDeclination(YEAR / 2), 0);
  close(sunDeclination(YEAR / 4), TILT); close(sunDeclination(3 * YEAR / 4), -TILT);
});

test('day length: equator always 12 h; everywhere 12 h at equinox', () => {
  for (let t = 0; t < YEAR; t += 7) close(dayLength(0, t), 12);
  for (let lat = -60; lat <= 60; lat += 10) close(dayLength(lat, 0), 12);
});

test('day length and noon Sun at the June solstice', () => {
  const j = YEAR / 4;
  const n = dayLength(40, j); assert.ok(n > 14.8 && n < 15.2, n);
  const s = dayLength(-40, j); assert.ok(s > 8.8 && s < 9.2, s);
  close(noonAltitude(40, j), 73.44, 0.01);
  assert.equal(dayLength(70, j), 24); assert.equal(dayLength(70, 3 * YEAR / 4), 0);
});

test('poles never NaN', () => {
  for (const t of [0, YEAR / 4, YEAR / 2, 3 * YEAR / 4]) for (const lat of [90, -90]) {
    const d = dayLength(lat, t); assert.ok(Number.isFinite(d) && d >= 0 && d <= 24, `${lat} ${t} ${d}`);
  }
});

test('Moon illumination and phase names', () => {
  close(illuminatedFraction(0), 0); close(illuminatedFraction(SYNODIC / 2), 1); close(illuminatedFraction(SYNODIC / 4), 0.5);
  const names = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];
  names.forEach((nm, k) => assert.equal(phaseName((k / 8) * SYNODIC), nm));
  assert.equal(phaseName(-SYNODIC / 2), 'full');
});

test('noon at longitude 0 when t = n + 0.5, including negative t', () => {
  for (const n of [0, 1, 2, 3, -1]) close(subsolarLongitude(n + 0.5), 0);
  close(sunLongitude(-YEAR / 4), 270);
});

test('seasons by hemisphere', () => {
  assert.equal(seasonNorth(YEAR / 4 + 1), 'summer'); assert.equal(seasonSouth(YEAR / 4 + 1), 'winter');
  assert.equal(seasonNorth(3 * YEAR / 4 + 1), 'winter'); assert.equal(seasonSouth(3 * YEAR / 4 + 1), 'summer');
});

test('eclipses: only near nodes, ≥1 solar per season, not every month', () => {
  assert.equal(eclipseAt(0), 'solar');
  const solarTimes = []; let newMoons = 0, eclipsedNewMoons = 0;
  for (let t = 0; t < 2 * YEAR; t += 0.01) if (eclipseAt(t) === 'solar') solarTimes.push(t);
  for (const t of solarTimes) {
    const d = Math.min(...[0, YEAR / 2, YEAR, 1.5 * YEAR, 2 * YEAR].map((n) => Math.abs(t - n)));
    assert.ok(d <= 17.5, `solar eclipse ${t} is ${d} d from a node`);
  }
  for (const [a, b] of [[-20, 20], [YEAR / 2 - 20, YEAR / 2 + 20], [YEAR - 20, YEAR + 20], [1.5 * YEAR - 20, 1.5 * YEAR + 20]])
    assert.ok(solarTimes.some((t) => t >= a && t <= b), `no solar eclipse in season ${a}..${b}`);
  for (let k = 0; k * SYNODIC < 2 * YEAR; k++) { newMoons++; if (eclipseAt(k * SYNODIC) === 'solar') eclipsedNewMoons++; }
  assert.ok(eclipsedNewMoons < newMoons / 2, `${eclipsedNewMoons}/${newMoons}`);
});

test('nextEvent: strictly after t, analytic kinds exact, eclipse skips the current one', () => {
  close(nextEvent(0, 'juneSolstice'), YEAR / 4); close(nextEvent(0, 'fullMoon'), SYNODIC / 2);
  close(nextEvent(0, 'marchEquinox'), YEAR); close(nextEvent(YEAR / 4, 'juneSolstice'), 1.25 * YEAR);
  close(nextEvent(1, 'newMoon'), SYNODIC);
  const e = nextEvent(0, 'eclipse'); assert.ok(e > 100 && eclipseAt(e) !== null, e);
});

test('advanceTime clamps dt to 0.1 s', () => {
  close(advanceTime(0, 30, 5), 3); close(advanceTime(10, 1 / 24, 0.05), 10 + 0.05 / 24); close(advanceTime(5, -1, 0.1), 4.9);
});

test('speed slider is log-scaled 1 h/s … 30 d/s', () => {
  close(speedFromSlider(0), 1 / 24); close(speedFromSlider(100), 30); close(speedFromSlider(50), Math.sqrt(30 / 24));
});
