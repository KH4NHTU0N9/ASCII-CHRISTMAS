import { TAU, createRng } from './math.js';

/**
 * Generates deterministic twinkling background stars and drifting snow particles
 * mapped in normalized [0..1] viewport coordinates.
 */
export function createSkyParticles(seed = 2026) {
  const rng = createRng(seed);
  const stars = [];
  const snow = [];

  const starGlyphs = ['.', '·', '+', '*'];
  for (let i = 0; i < 190; i++) {
    stars.push({
      u: rng.random(),
      v: rng.uniform(0.01, 0.86),
      phase: rng.uniform(0, TAU),
      speed: rng.uniform(1.2, 3.6),
      glyph: starGlyphs[i % starGlyphs.length],
      bright: rng.uniform(0.35, 0.9),
    });
  }

  const snowGlyphs = ['.', '·', '*', '+'];
  for (let i = 0; i < 85; i++) {
    snow.push({
      u0: rng.random(),
      v0: rng.random(),
      vy: rng.uniform(0.035, 0.095),
      vx: rng.uniform(-0.015, 0.025),
      swayAmp: rng.uniform(0.004, 0.014),
      phase: rng.uniform(0, TAU),
      glyph: snowGlyphs[i % snowGlyphs.length],
      inFront: i % 3 === 0,
      bright: rng.uniform(0.55, 0.95),
    });
  }

  return { stars, snow };
}

/**
 * Stamps stars and falling snow into the ASCII frame buffer without overwriting
 * closer opaque geometry.
 */
export function renderSkyToGrid(sky, grid, elapsedSec) {
  const { cols, rows, depth, chars, colors } = grid;

  // Background stars
  for (let i = 0; i < sky.stars.length; i++) {
    const s = sky.stars[i];
    const col = Math.floor(s.u * cols);
    const row = Math.floor(s.v * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    if (depth[idx] < 900) continue;

    const twinkle = 0.45 + 0.55 * Math.sin(elapsedSec * s.speed + s.phase);
    const v = Math.round(135 + 115 * s.bright * twinkle);
    chars[idx] = s.glyph;
    colors[idx] = `rgb(${v - 15},${v - 5},${Math.min(255, v + 12)})`;
  }

  // Drifting snowflakes
  for (let i = 0; i < sky.snow.length; i++) {
    const f = sky.snow[i];
    const u = ((f.u0 + f.vx * elapsedSec + f.swayAmp * Math.sin(elapsedSec * 1.4 + f.phase)) % 1 + 1) % 1;
    const v = (f.v0 + f.vy * elapsedSec) % 1;

    const col = Math.floor(u * cols);
    const row = Math.floor(v * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    const flakeDepth = f.inFront ? 0.5 : 950;
    if (flakeDepth >= depth[idx]) continue;

    depth[idx] = flakeDepth;
    const c = Math.round(190 + 65 * f.bright);
    chars[idx] = f.glyph;
    colors[idx] = `rgb(${c - 10},${c},${Math.min(255, c + 12)})`;
  }
}
