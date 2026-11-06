import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TURNS, COIL_L, COIL_W, B0, R, SLOW,
  motorConstant, current, step, steadyState, readouts, loopTorque, commutatorSign, rockingAngle, spinUp, fromRpm,
} from '../../motor/physics.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const run = (state, inputs, realSeconds) => {
  const t0 = state.t;
  while (state.t - t0 < realSeconds - 1e-12) state = step(state, inputs, 0.05);
  return state;
};
const MOTOR = (V, magnet = 1, load = 0) => ({ mode: 'motor', V, magnet, load });

test('motor constant and stall current', () => {
  close(motorConstant(1), 0.02); close(motorConstant(1), TURNS * B0 * COIL_L * COIL_W);
  close(current(6, 0, 0.02), 3);
});
test('steady state: no-load speed, linear in load, magnet scaling', () => {
  close(steadyState(MOTOR(6)).omega, 285.714, 0.1);
  const w = [0, 0.01, 0.02].map((l) => steadyState(MOTOR(6, 1, l)).omega);
  close(w[0] - w[1], w[1] - w[2], 1e-9);
  const lo = steadyState(MOTOR(6, 0.75)).omega, hi = steadyState(MOTOR(6, 1.5)).omega;
  assert.ok(Math.abs(hi / lo - 0.5) <= 0.05, hi / lo);
  close((motorConstant(1.5) * 6 / R) / (motorConstant(0.75) * 6 / R), 2);
});
test('simulation converges to steady state; current falls as speed rises', () => {
  let s = { t: 0, omega: 0, angle: 0 }, lastI = 3.0001, lastW = -1;
  for (let k = 0; k < 400; k++) {
    s = step(s, MOTOR(6), 0.05);
    const i = current(6, s.omega, 0.02);
    assert.ok(i <= lastI && s.omega >= lastW); lastI = i; lastW = s.omega;
  }
  assert.ok(Math.abs(s.omega / steadyState(MOTOR(6)).omega - 1) < 0.01, s.omega);
});
test('reverse voltage spins backwards with the same speed', () => {
  const s = run({ t: 0, omega: 0, angle: 0 }, MOTOR(-6), 1);
  close(s.omega, -steadyState(MOTOR(6)).omega, 0.5);
});
test('brake bigger than stall torque holds the motor still', () => {
  const s = run({ t: 0, omega: 0, angle: 0 }, MOTOR(2, 1, 0.05), 1);
  assert.equal(s.omega, 0);
});
test('coasting at 0 V and braking while reversed never flip direction', () => {
  let s = { t: 0, omega: 200, angle: 0 };
  for (let k = 0; k < 2000; k++) { const n = step(s, MOTOR(0), 0.05); assert.ok(n.omega >= 0 && n.omega <= s.omega); s = n; }
  s = { t: 0, omega: -200, angle: 0 };
  for (let k = 0; k < 200; k++) { const n = step(s, MOTOR(0, 1, 0.05), 0.05); assert.ok(n.omega <= 0 && Math.abs(n.omega) <= Math.abs(s.omega)); s = n; }
});
test('dt clamp: one 5 s call advances real time by 0.1/SLOW', () => {
  close(step({ t: 0, omega: 0, angle: 0 }, MOTOR(6), 5).t, 0.1 / SLOW);
});
test('generator: EMF, current, bulb power at 1000 rpm; switching back to motor keeps speed', () => {
  const g = { mode: 'generator', crankRpm: 1000, magnet: 1 };
  const s = step({ t: 0, omega: 0, angle: 0 }, g, 0.05);
  const r = readouts(s, g);
  close(r.backEmf, 2.094, 0.001); close(r.current, 0.349, 0.001); close(r.bulbPower, 0.487, 0.001);
  const m = step(s, MOTOR(0), 0.001);
  assert.ok(Math.abs(m.omega - fromRpm(1000)) < 1, m.omega);
});
test('efficiency is 0 (never NaN) when power in is not positive', () => {
  // V = 0, and V below the back-EMF (4 V at 200 rad/s): the motor feeds power back, so power in ≤ 0
  for (const V of [0, 2]) {
    const e = readouts({ t: 0, omega: 200, angle: 0 }, MOTOR(V, 1, 0.01)).efficiency;
    assert.ok(Number.isFinite(e) && e === 0, `${V}: ${e}`);
  }
});
test('commutator: slip torque flips past vertical, split never negative, sign flips at 90/270', () => {
  assert.ok(loopTorque(80, 'slip') > 0 && loopTorque(100, 'slip') < 0 && loopTorque(260, 'slip') < 0 && loopTorque(280, 'slip') > 0);
  for (let th = 0; th < 360; th += 1) assert.ok(loopTorque(th, 'split') >= 0);
  assert.equal(commutatorSign(45), 1); assert.equal(commutatorSign(135), -1);
  assert.equal(commutatorSign(225), -1); assert.equal(commutatorSign(315), 1);
});
test('rocking angle stays in [0,180] and settles near vertical', () => {
  for (let p = 0; p <= 1; p += 0.01) { const a = rockingAngle(p); assert.ok(a >= 0 && a <= 180, a); }
  assert.ok(Math.abs(rockingAngle(1) - 90) < 5);
});
test('spinUp: evenly spaced, starts at rest with 3 A, ends near steady state', () => {
  const s = spinUp(6, 1, 0.5, 200);
  assert.equal(s.length, 200); close(s[0].omega, 0); close(s[0].current, 3);
  close(s[1].t - s[0].t, s[2].t - s[1].t, 1e-9);
  assert.ok(Math.abs(s.at(-1).omega / steadyState(MOTOR(6)).omega - 1) < 0.02);
});
