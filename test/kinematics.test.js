import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STROKE, R, L, MAX_LIFT, INTAKE, EXHAUST,
  wrapTheta, pistonY, valveLift, strokeAt, cylinderPhase, advanceTheta,
} from '../js/kinematics.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test('pistonY: TDC at 0/360, BDC at 180/540, travel = stroke', () => {
  const tdc = pistonY(0), bdc = pistonY(180);
  close(pistonY(360), tdc); close(pistonY(540), bdc);
  close(tdc - bdc, STROKE);
  for (let t = 0; t < 720; t += 5) assert.ok(pistonY(t) <= tdc + 1e-9 && pistonY(t) >= bdc - 1e-9);
});

test('pistonY is exact slider-crank, not a sine', () => {
  close(pistonY(90), Math.sqrt(L * L - R * R)); // ≈ 136.4, not the midpoint 143
});

test('valves closed through compression and power', () => {
  for (let t = 180; t <= 540; t += 1) {
    close(valveLift(t, INTAKE), 0);
    close(valveLift(wrapTheta(t), EXHAUST), 0);
  }
});

test('valve lift peaks at window midpoint', () => {
  close(valveLift(90, INTAKE), MAX_LIFT);
  close(valveLift(630, EXHAUST), MAX_LIFT);
});

test('strokeAt', () => {
  assert.equal(strokeAt(90), 'intake'); assert.equal(strokeAt(270), 'compression');
  assert.equal(strokeAt(450), 'power'); assert.equal(strokeAt(630), 'exhaust');
  assert.equal(strokeAt(-90), 'exhaust'); assert.equal(strokeAt(810), 'intake');
});

test('wrapTheta', () => {
  assert.equal(wrapTheta(-5), 715); assert.equal(wrapTheta(720), 0); assert.equal(wrapTheta(1445), 5);
});

test('inline-4: exactly one cylinder in power at any θ, firing 1,3,4,2', () => {
  const local = (t, i) => wrapTheta(t - cylinderPhase(i));
  const fired = [];
  for (let t = 0; t < 720; t += 1) {
    const inPower = [1, 2, 3, 4].filter(i => strokeAt(local(t, i)) === 'power');
    assert.equal(inPower.length, 1);
    if (fired.at(-1) !== inPower[0]) fired.push(inPower[0]);
  }
  const k = fired.indexOf(1);
  assert.deepEqual([...fired.slice(k), ...fired.slice(0, k)], [1, 3, 4, 2]);
});

test('advanceTheta: 6000 RPM shows 360°/s, rpm 0 stays, dt clamped to 0.1 s', () => {
  close(advanceTheta(0, 6000, 1 / 60), 6);
  assert.equal(advanceTheta(100, 0, 0.5), 100);
  close(advanceTheta(0, 6000, 30), 36); // 30 s hidden tab → only 0.1 s applied
  close(advanceTheta(719, 6000, 0.1), 35);
});
