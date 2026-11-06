import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollState } from '../../engine/scroll.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);
const pick = (s) => ({ step: s.step, theta: s.theta, cylinders: s.cylinders });

test('scrollState maps slices to steps and θ', () => {
  assert.deepEqual(pick(scrollState(0)), { step: 'parts', theta: 0, cylinders: 1 });
  assert.equal(scrollState(1.5 / 6).step, 'intake'); close(scrollState(1.5 / 6).theta, 90);
  assert.equal(scrollState(2.5 / 6).step, 'compression'); close(scrollState(2.5 / 6).theta, 270);
  assert.equal(scrollState(3.5 / 6).step, 'power'); close(scrollState(3.5 / 6).theta, 450);
  assert.equal(scrollState(4.5 / 6).step, 'exhaust'); close(scrollState(4.5 / 6).theta, 630);
  const m = scrollState(5.5 / 6); assert.equal(m.step, 'multi'); assert.equal(m.cylinders, 4); close(m.theta, 360);
});

test('scrollState clamps out-of-range progress', () => {
  assert.equal(scrollState(-0.3).step, 'parts'); assert.equal(scrollState(1.7).step, 'multi');
});

test('scrollState is a pure function of progress (same input → same output)', () => {
  assert.deepEqual(scrollState(0.42), scrollState(0.42));
});
