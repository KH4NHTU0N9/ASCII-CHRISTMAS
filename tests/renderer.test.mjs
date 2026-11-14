import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTreeScene, computePointShade, PART_KINDS } from '../src/treeEngine.js';
import { createSkyParticles } from '../src/skyParticles.js';
import { createAsciiGrid, projectSceneToGrid } from '../src/asciiRenderer.js';
import { createMagicSpiral, renderChimneySmoke } from '../src/magicEffects.js';
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

  // Verify tree/snow cells have balanced 3D shading contrast (neither crushed black nor blown out white)
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
  assert.ok(
    avgPeak > 45 && avgPeak < 140,
    `Expected balanced crisp shading (45..140), got ${avgPeak.toFixed(1)}`
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

test('village cabin, snowman, rising chimney smoke, and upward spiral pulse work', () => {
  const scene = buildTreeScene();
  assert.ok(Array.isArray(scene.chimneyPos) && scene.chimneyPos.length === 3);
  scene.chimneyPos.forEach((v) => assert.ok(Number.isFinite(v)));

  const grid = createAsciiGrid(150, 70);
  projectSceneToGrid(scene, grid, {
    elapsedSec: 10.5,
    rotationDeg: 0,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.3,
    cellH: 8.0,
  });

  let cabinCount = 0;
  let snowmanCount = 0;
  for (let i = 0; i < grid.kinds.length; i++) {
    if (grid.kinds[i] === PART_KINDS.CABIN) cabinCount++;
    if (grid.kinds[i] === PART_KINDS.SNOWMAN) snowmanCount++;
  }
  assert.ok(cabinCount >= 40, `Expected visible cabin cells, got ${cabinCount}`);
  assert.ok(snowmanCount >= 30, `Expected visible snowman cells, got ${snowmanCount}`);

  // Smoke renders '~' / 's' curls above chimney after cabin completes
  const smokeGrid = createAsciiGrid(150, 70);
  renderChimneySmoke(scene.chimneyPos, smokeGrid, {
    elapsedSec: 12.0,
    rotationDeg: 0,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.3,
    cellH: 8.0,
  });
  const smokeChars = smokeGrid.chars.filter((c) => c === '~' || c === 's').length;
  assert.ok(smokeChars >= 5, `Expected rising chimney smoke wisps, got ${smokeChars}`);

  // Spiral garland luminance forms a continuous travelling wave across phase
  const phases = [0, 1.5, 3.0, 4.5];
  const lums = phases.map(
    (ph) => computePointShade(0, 0.2, 1, 0.6, PART_KINDS.GARLAND, 10.0, 6.0, ph, 'twinkle').lum
  );
  const spread = Math.max(...lums) - Math.min(...lums);
  assert.ok(spread > 0.4, `Expected travelling garland wave modulation, got ${spread.toFixed(2)}`);
});

test('color themes, binary/math glyph sets, and cursor hover repel/glow work', () => {
  const scene = buildTreeScene();
  const baseGrid = createAsciiGrid(140, 70);
  const binGrid = createAsciiGrid(140, 70);
  const mathGrid = createAsciiGrid(140, 70);
  const hoverGrid = createAsciiGrid(140, 70);

  projectSceneToGrid(scene, baseGrid, {
    elapsedSec: 12.0,
    rotationDeg: 0,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.7,
    cellH: 8.0,
    colorTheme: 'cyberpunk',
    glyphSet: 'ascii',
  });

  projectSceneToGrid(scene, binGrid, {
    elapsedSec: 12.0,
    rotationDeg: 0,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.7,
    cellH: 8.0,
    colorTheme: 'frozen',
    glyphSet: 'binary',
  });

  for (let i = 0; i < binGrid.kinds.length; i++) {
    if (binGrid.kinds[i] >= 0) {
      assert.ok(
        binGrid.chars[i] === '0' || binGrid.chars[i] === '1',
        `Expected 0/1 in binary mode, got '${binGrid.chars[i]}'`
      );
    }
  }

  projectSceneToGrid(scene, mathGrid, {
    elapsedSec: 12.0,
    rotationDeg: 0,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.7,
    cellH: 8.0,
    glyphSet: 'math',
  });
  const hasMath = mathGrid.chars.some((c) => '±×÷π∑∫∞'.includes(c));
  assert.ok(hasMath, 'Expected mathematical glyphs in math mode');

  projectSceneToGrid(scene, hoverGrid, {
    elapsedSec: 12.0,
    rotationDeg: 0,
    widthPx: 800,
    heightPx: 560,
    cellW: 5.7,
    cellH: 8.0,
    colorTheme: 'cyberpunk',
    cursor: { active: true, u: 0.5, v: 0.5 },
  });

  let glowBase = 0;
  let glowHover = 0;
  for (let i = 0; i < baseGrid.glow.length; i++) {
    if (baseGrid.glow[i] > 0.4) glowBase++;
    if (hoverGrid.glow[i] > 0.4) glowHover++;
  }
  assert.ok(glowHover > glowBase, `Expected cursor hover glow increase (${glowHover} > ${glowBase})`);
});
