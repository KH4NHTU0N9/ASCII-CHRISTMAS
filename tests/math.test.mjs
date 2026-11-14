import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, createRng, envelope, fibSphere, lerp } from '../src/math.js';

test('clamp and lerp handle edge bounds accurately', () => {
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(4.5, 0, 10), 4.5);
  assert.equal(lerp(10, 20, 0.25), 12.5);
});

test('createRng produces reproducible deterministic sequences', () => {
  const a = createRng(7);
  const b = createRng(7);
  for (let i = 0; i < 25; i++) {
    assert.equal(a.random(), b.random());
  }
});

test('fibSphere generates unit-length points evenly on S2', () => {
  const pts = fibSphere(32);
  assert.equal(pts.length, 32);
  for (const [x, y, z] of pts) {
    const r = Math.hypot(x, y, z);
    assert.ok(Math.abs(r - 1) < 1e-12, `Expected unit radius, got ${r}`);
  }
});

test('envelope tapers monotonically from base to apex', () => {
  const baseR = envelope(0.42);
  const midR = envelope(1.485);
  const topR = envelope(2.55);
  assert.ok(Math.abs(baseR - 0.87) < 1e-6);
  assert.ok(Math.abs(topR - 0.03) < 1e-6);
  assert.ok(baseR > midR && midR > topR);
});
