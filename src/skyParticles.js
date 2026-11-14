import { TAU, createRng } from './math.js';

/**
 * Generates deterministic twinkling night stars, drifting winter snow with
 * wind gusts, and subtle northern aurora curtains in the upper sky.
 */
export function createSkyParticles(seed = 2026) {
  const rng = createRng(seed);
  const stars = [];
  const snow = [];

  const starGlyphs = ['.', '·', '+', '*'];
  for (let i = 0; i < 220; i++) {
    stars.push({
      u: rng.random(),
      v: rng.uniform(0.01, 0.86),
      phase: rng.uniform(0, TAU),
      speed: rng.uniform(1.2, 3.6),
      glyph: starGlyphs[i % starGlyphs.length],
      bright: rng.uniform(0.55, 1.0),
    });
  }

  const snowGlyphs = ['.', '·', '*', '+'];
  for (let i = 0; i < 115; i++) {
    snow.push({
      u0: rng.random(),
      v0: rng.random(),
      vy: rng.uniform(0.04, 0.105),
      vx: rng.uniform(-0.018, 0.028),
      swayAmp: rng.uniform(0.006, 0.018),
      phase: rng.uniform(0, TAU),
      glyph: snowGlyphs[i % snowGlyphs.length],
      inFront: i % 3 === 0,
      bright: rng.uniform(0.7, 1.0),
    });
  }

  return { stars, snow };
}

/**
 * Stamps subtle aurora shimmer, stars, and wind-blown snow into empty/front grid cells.
 */
export function renderSkyToGrid(sky, grid, elapsedSec) {
  const { cols, rows, depth, chars, colors } = grid;

  // Subtle Northern Lights (Aurora Borealis) shimmer high in the night sky
  const auroraMaxRow = Math.floor(rows * 0.36);
  for (let r = 2; r < auroraMaxRow; r += 2) {
    const v = r / rows;
    const rowOff = r * cols;
    for (let c = 1; c < cols; c += 3) {
      const idx = rowOff + c;
      if (depth[idx] < 900 || chars[idx] !== ' ') continue;
      const u = c / cols;
      const wave =
        Math.sin(u * 9.0 + elapsedSec * 0.45 + v * 4.5) *
        Math.cos(u * 5.2 - elapsedSec * 0.32);
      if (wave < 0.48) continue;

      const fade = (1 - v / 0.36) * ((wave - 0.48) / 0.52);
      const ar = Math.round(18 + 38 * fade);
      const ag = Math.round(62 + 88 * fade);
      const ab = Math.round(78 + 82 * fade);
      chars[idx] = fade > 0.55 ? '~' : '·';
      colors[idx] = `rgb(${ar},${ag},${ab})`;
    }
  }

  // Twinkling starfield
  for (let i = 0; i < sky.stars.length; i++) {
    const s = sky.stars[i];
    const col = Math.floor(s.u * cols);
    const row = Math.floor(s.v * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    if (depth[idx] < 900) continue;

    const twinkle = 0.52 + 0.48 * Math.sin(elapsedSec * s.speed + s.phase);
    const v = Math.round(155 + 100 * s.bright * twinkle);
    chars[idx] = s.glyph;
    colors[idx] = `rgb(${v - 12},${v - 4},${Math.min(255, v + 12)})`;
  }

  // Wind-swept falling snow
  const windGust = 0.015 * Math.sin(elapsedSec * 0.35);
  for (let i = 0; i < sky.snow.length; i++) {
    const f = sky.snow[i];
    const u =
      (((f.u0 + (f.vx + windGust) * elapsedSec + f.swayAmp * Math.sin(elapsedSec * 1.5 + f.phase)) % 1) +
        1) %
      1;
    const v = (f.v0 + f.vy * elapsedSec) % 1;

    const col = Math.floor(u * cols);
    const row = Math.floor(v * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    const flakeDepth = f.inFront ? 0.5 : 950;
    if (flakeDepth >= depth[idx]) continue;

    depth[idx] = flakeDepth;
    const c = Math.round(205 + 50 * f.bright);
    chars[idx] = f.glyph;
    colors[idx] = `rgb(${c - 8},${c},${Math.min(255, c + 12)})`;
  }
}
