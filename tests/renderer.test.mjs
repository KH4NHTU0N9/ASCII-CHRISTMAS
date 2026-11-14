import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTreeScene } from '../src/treeEngine.js';
import { createSkyParticles } from '../src/skyParticles.js';
import { createAsciiGrid, projectSceneToGrid } from '../src/asciiRenderer.js';
import { highlightLineToHtml, tokenizeLine } from '../src/syntaxHighlighter.js';

test('projectSceneToGrid reveals more glyphs as build progresses over time', () => {
  const scene = buildTreeScene();
  const sky = createSkyParticles(2026);
  const grid = createAsciiGrid(120, 48);

  const countEarly = projectSceneToGrid(scene, grid, {
    elapsedSec: 0.4,
    rotationDeg: 7.2,
    widthPx: 840,
    heightPx: 560,
    cellW: 7,
    cellH: 11.5,
    sky,
  });

  const countFull = projectSceneToGrid(scene, grid, {
    elapsedSec: 12.0,
    rotationDeg: 216,
    widthPx: 840,
    heightPx: 560,
    cellW: 7,
    cellH: 11.5,
    sky,
  });

  assert.ok(countEarly > 400, `Expected ground+sky glyphs early, got ${countEarly}`);
  assert.ok(
    countFull > countEarly + 500,
    `Expected full tree (${countFull}) to exceed early state (${countEarly})`
  );
});

test('syntaxHighlighter tokenizes JS safely without XSS injection', () => {
  const line = 'const tag = "<script>alert(1)</script>"; // note';
  const tokens = tokenizeLine(line);
  assert.equal(tokens[0].type, 'keyword');
  assert.equal(tokens[0].text, 'const');
  assert.ok(tokens.some((t) => t.type === 'string'));
  assert.ok(tokens.some((t) => t.type === 'comment'));

  const html = highlightLineToHtml(line, true);
  assert.ok(!html.includes('<script>'), 'Raw <script> tag must be escaped');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('code-cursor'));
});
