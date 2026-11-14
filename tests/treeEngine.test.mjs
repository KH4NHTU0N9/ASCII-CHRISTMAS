import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTreeScene, computeTelemetry } from '../src/treeEngine.js';

test('buildTreeScene produces valid aligned TypedArrays with 170 lights', () => {
  const scene = buildTreeScene();
  assert.ok(scene.count > 10000, `Expected dense tree cloud, got ${scene.count}`);
  assert.equal(scene.lightTotal, 170);
  assert.equal(scene.positions.length, scene.count * 3);
  assert.equal(scene.normals.length, scene.count * 3);
  assert.equal(scene.colors.length, scene.count * 3);
  assert.equal(scene.kinds.length, scene.count);
  assert.equal(scene.t0.length, scene.count);

  for (let i = 0; i < scene.positions.length; i++) {
    assert.ok(Number.isFinite(scene.positions[i]), 'Position must be finite');
  }
});

test('computeTelemetry tracks staggered light reveal and angle wrap', () => {
  const scene = buildTreeScene();
  const early = computeTelemetry(scene, 0.5, 9, 4200);
  const mid = computeTelemetry(scene, 8.2, 147.6, 7500);
  const full = computeTelemetry(scene, 11.0, 378.5, 8400);

  assert.equal(early.lightsCount, 0);
  assert.ok(mid.lightsCount > 0 && mid.lightsCount < 170);
  assert.equal(full.lightsCount, 170);
  assert.equal(full.rotationText, '018.50°');
});
