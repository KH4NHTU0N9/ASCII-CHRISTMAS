import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTreeScene, PART_KINDS } from '../src/treeEngine.js';
import { createSkyParticles } from '../src/skyParticles.js';
import { createAsciiGrid, projectSceneToGrid } from '../src/asciiRenderer.js';
import { createMagicSpiral } from '../src/magicEffects.js';
import { highlightLineToHtml, tokenizeLine } from '../src/syntaxHighlighter.js';

test('projectSceneToGrid reveals more glyphs as build progresses over time', () => {
  const scene = buildTreeScene();
  const sky = createSkyParticles(2026);
  const grid = createAsciiGrid(150, 70);

  const countEarly = projectSceneToGrid(scene, grid, {
    elapsedSec: 0.4,
    rotationDeg: 7.2,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.3,
    cellH: 8.0,
    sky,
  });

  const countFull = projectSceneToGrid(scene, grid, {
    elapsedSec: 12.0,
    rotationDeg: 216,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.3,
    cellH: 8.0,
    sky,
  });

  assert.ok(countEarly > 400, `Expected ground+sky glyphs early, got ${countEarly}`);
  assert.ok(
    countFull > countEarly + 500,
    `Expected full tree (${countFull}) to exceed early state (${countEarly})`
  );

  // Verify every decoration type visibly wins Z-buffer cells on the front tree
  const byKind = new Map();
  for (let i = 0; i < grid.kinds.length; i++) {
    const k = grid.kinds[i];
    if (k >= 0) byKind.set(k, (byKind.get(k) || 0) + 1);
  }
  assert.ok((byKind.get(PART_KINDS.NEEDLE) || 0) >= 400, 'Expected dense pine needles');
  assert.ok((byKind.get(PART_KINDS.BALL) || 0) >= 80, 'Expected visible ornament baubles');
  assert.ok((byKind.get(PART_KINDS.GARLAND) || 0) >= 100, 'Expected visible tinsel garland');
  assert.ok((byKind.get(PART_KINDS.LIGHT) || 0) >= 40, 'Expected visible fairy lights');
  assert.ok((byKind.get(PART_KINDS.STAR) || 0) >= 20, 'Expected visible apex star');
  assert.ok((byKind.get(PART_KINDS.GIFT) || 0) >= 100, 'Expected visible gift boxes');
  assert.ok((byKind.get(PART_KINDS.RIBBON) || 0) >= 30, 'Expected visible gift ribbons');
});

test('light modes, magic spiral, and luminous brightness render cleanly', () => {
  const scene = buildTreeScene();
  const sky = createSkyParticles(2026);
  const magicSpiral = createMagicSpiral(48, 99);
  const grid = createAsciiGrid(150, 70);

  for (const mode of ['twinkle', 'cascade', 'warm', 'aurora']) {
    const count = projectSceneToGrid(scene, grid, {
      elapsedSec: 12.2,
      rotationDeg: 180,
      widthPx: 800,
      heightPx: 560,
      cellW: 5.3,
      cellH: 8.0,
      sky,
      magicSpiral,
      lightMode: mode,
    });
    assert.ok(count > 2000, `Mode ${mode} produced too few glyphs: ${count}`);
  }

  // Verify tree/snow cells have lifted perceptual brightness (mean channel > 90/255)
  let sumBright = 0;
  let treeCells = 0;
  for (let i = 0; i < grid.rgbPacked.length; i++) {
    if (grid.kinds[i] === PART_KINDS.NEEDLE || grid.kinds[i] === PART_KINDS.GROUND) {
      const p = grid.rgbPacked[i];
      sumBright += Math.max((p >> 16) & 0xff, (p >> 8) & 0xff, p & 0xff);
      treeCells++;
    }
  }
  const avgPeak = sumBright / Math.max(1, treeCells);
  assert.ok(avgPeak > 95, `Expected bright lifted glyphs (>95), got ${avgPeak.toFixed(1)}`);
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
