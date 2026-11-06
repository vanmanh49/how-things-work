import test from 'node:test';
import assert from 'node:assert/strict';
import { sliceProgress } from '../../core/scroll.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const S = ['a', 'b', 'c', 'd'];

test('sliceProgress: equal slices with in-step progress', () => {
  assert.deepEqual(sliceProgress(0, S), { step: 'a', index: 0, stepProgress: 0 });
  const m = sliceProgress(0.375, S); assert.equal(m.step, 'b'); close(m.stepProgress, 0.5);
  assert.deepEqual(sliceProgress(1, S), { step: 'd', index: 3, stepProgress: 1 });
});

test('sliceProgress clamps out-of-range progress', () => {
  assert.equal(sliceProgress(-2, S).step, 'a'); assert.equal(sliceProgress(9, S).step, 'd');
  assert.equal(sliceProgress(9, S).stepProgress, 1);
});

test('sliceProgress is pure', () => { assert.deepEqual(sliceProgress(0.6, S), sliceProgress(0.6, S)); });
