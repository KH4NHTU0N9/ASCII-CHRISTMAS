import { CONFIG } from './config.js';
import { TAU, clamp, createRng, envelope } from './math.js';

const SPIRAL_GLYPHS = ['✦', '*', '+', '·'];
const BURST_PALETTE = [
  'rgb(255,224,104)',
  'rgb(255,112,124)',
  'rgb(104,244,176)',
  'rgb(124,216,255)',
  'rgb(255,244,220)',
];

/**
 * Generates deterministic 3D helical stardust seeds orbiting the tree.
 */
export function createMagicSpiral(count = 56, seed = 99) {
  const rng = createRng(seed);
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      u0: rng.random(),
      speed: rng.uniform(0.055, 0.115),
      angleOffset: rng.uniform(0, TAU),
      radOffset: rng.uniform(0.14, 0.34),
      phase: rng.uniform(0, TAU),
      glyph: SPIRAL_GLYPHS[i % SPIRAL_GLYPHS.length],
      warm: i % 3 !== 0,
    });
  }
  return particles;
}

/**
 * Projects ascending 3D golden/cyan stardust particles through the active Z-buffer.
 */
export function renderMagicSpiral(
  particles,
  grid,
  { elapsedSec, rotationDeg, widthPx, heightPx, cellW, cellH, pitchOffset = 0, zoom = 1 }
) {
  if (elapsedSec < 1.2) return;
  const { cols, rows, depth, kinds, chars, colors, glow, glowColors } = grid;
  const { cameraPitchRad, cameraDist, cameraTargetY, focalScale } = CONFIG.render;

  const yaw = (rotationDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const pitch = clamp(cameraPitchRad + pitchOffset, -0.35, 0.72);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const scalePx = Math.min(heightPx, widthPx * 1.12) * 0.345 * zoom;
  const centerX = widthPx * 0.5;
  const centerY = heightPx * 0.49;
  const y0 = CONFIG.tree.y0 - 0.25;
  const ySpan = CONFIG.tree.y1 + 0.55 - y0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const u = (p.u0 + p.speed * elapsedSec) % 1;
    const wy = y0 + ySpan * u - cameraTargetY;
    const rad = envelope(y0 + ySpan * u) + p.radOffset * (1 - 0.3 * u);
    const a = p.angleOffset + u * TAU * 2.5 + elapsedSec * 0.6;

    const wx = rad * Math.cos(a);
    const wz = rad * Math.sin(a);

    const rx = wx * cy + wz * sy;
    const rz = -wx * sy + wz * cy;
    const py = wy * cp + rz * sp;
    const pz = -wy * sp + rz * cp;

    const zCam = cameraDist + pz;
    if (zCam <= 0.35) continue;

    const proj = focalScale / zCam;
    const col = Math.floor((centerX + rx * proj * scalePx) / cellW);
    const row = Math.floor((centerY - py * proj * scalePx) / cellH);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    if (zCam >= depth[idx]) continue;

    const shimmer = 0.55 + 0.45 * Math.sin(elapsedSec * 6.0 + p.phase);
    const fadeEdge = Math.sin(u * Math.PI);
    const intensity = shimmer * fadeEdge;
    if (intensity < 0.22) continue;

    depth[idx] = zCam;
    if (kinds) kinds[idx] = -1;
    chars[idx] = p.glyph;
    const colStr = p.warm
      ? `rgb(${Math.round(255 * intensity)},${Math.round(220 * intensity)},${Math.round(108 * intensity)})`
      : `rgb(${Math.round(145 * intensity)},${Math.round(232 * intensity)},${Math.round(255 * intensity)})`;
    colors[idx] = colStr;
    if (intensity > 0.65) {
      glow[idx] = Math.max(glow[idx], intensity * 0.48);
      glowColors[idx] = colStr;
    }
  }
}

/**
 * Renders periodic diagonal shooting stars across the upper night sky.
 */
export function renderShootingStars(grid, elapsedSec) {
  const { cols, rows, depth, chars, colors, glow, glowColors } = grid;
  const period = 4.8;
  const phaseTime = elapsedSec % period;
  if (phaseTime > 0.95) return;

  const cycle = Math.floor(elapsedSec / period);
  const progress = phaseTime / 0.95;

  const startU = 0.14 + ((cycle * 0.37) % 0.62);
  const startV = 0.06 + ((cycle * 0.19) % 0.18);
  const dirU = cycle % 2 === 0 ? 0.28 : -0.28;
  const dirV = 0.16;

  const headU = startU + dirU * progress;
  const headV = startV + dirV * progress;
  const tailSteps = 8;

  for (let s = 0; s < tailSteps; s++) {
    const t = s / tailSteps;
    const u = headU - dirU * 0.18 * t;
    const v = headV - dirV * 0.18 * t;
    const col = Math.floor(u * cols);
    const row = Math.floor(v * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    if (depth[idx] < 900) continue;

    const fade = (1 - t) * Math.sin(progress * Math.PI);
    if (fade < 0.15) continue;

    const bright = Math.round(180 + 75 * fade);
    const colStr = `rgb(${bright},${bright},${Math.min(255, bright + 24)})`;
    chars[idx] = s === 0 ? '@' : s < 3 ? '*' : s < 6 ? '=' : '·';
    colors[idx] = colStr;
    if (s <= 1) {
      glow[idx] = Math.max(glow[idx], fade * 0.75);
      glowColors[idx] = colStr;
    }
  }
}

/**
 * Manages temporary interactive firework/sparkle bursts spawned on click/tap.
 */
export function createBurstManager() {
  const bursts = [];

  function spawn(u, v) {
    const rng = createRng(Math.floor(performance.now() * 100) ^ bursts.length);
    const sparks = [];
    for (let i = 0; i < 26; i++) {
      const a = (TAU * i) / 26 + rng.uniform(-0.18, 0.18);
      const spd = rng.uniform(0.08, 0.26);
      sparks.push({
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd * 1.15 - 0.04,
        glyph: i % 3 === 0 ? '*' : i % 3 === 1 ? '+' : '·',
        color: BURST_PALETTE[i % BURST_PALETTE.length],
      });
    }
    bursts.push({ u, v, bornAt: performance.now() / 1000, sparks });
    if (bursts.length > 6) bursts.shift();
  }

  function render(grid) {
    if (bursts.length === 0) return;
    const nowSec = performance.now() / 1000;
    const { cols, rows, chars, colors, glow, glowColors } = grid;

    for (let b = bursts.length - 1; b >= 0; b--) {
      const burst = bursts[b];
      const age = nowSec - burst.bornAt;
      if (age > 1.25) {
        bursts.splice(b, 1);
        continue;
      }

      const life = 1 - age / 1.25;
      for (let i = 0; i < burst.sparks.length; i++) {
        const sp = burst.sparks[i];
        const u = burst.u + sp.vx * age;
        const v = burst.v + sp.vy * age + 0.16 * age * age;
        const col = Math.floor(u * cols);
        const row = Math.floor(v * rows);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

        const idx = row * cols + col;
        chars[idx] = age < 0.25 && i % 2 === 0 ? '@' : sp.glyph;
        colors[idx] = sp.color;
        if (life > 0.35) {
          glow[idx] = Math.max(glow[idx], life * 0.85);
          glowColors[idx] = sp.color;
        }
      }
    }
  }

  return { spawn, render };
}

const SMOKE_GLYPHS = ['~', 's', '~', 's', '·'];

/**
 * Renders gentle curling ASCII chimney smoke (~, s) rising from the cozy cabin.
 */
export function renderChimneySmoke(
  chimneyPos,
  grid,
  { elapsedSec, rotationDeg, widthPx, heightPx, cellW, cellH, pitchOffset = 0, zoom = 1 }
) {
  if (!chimneyPos || elapsedSec < 6.6) return;

  const { cols, rows, depth, kinds, chars, colors } = grid;
  const { cameraPitchRad, cameraDist, cameraTargetY, focalScale } = CONFIG.render;

  const yaw = (rotationDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const pitch = clamp(cameraPitchRad + pitchOffset, -0.35, 0.72);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const scalePx = Math.min(heightPx, widthPx * 1.12) * 0.345 * zoom;
  const centerX = widthPx * 0.5;
  const centerY = heightPx * 0.49;

  const age = elapsedSec - 6.6;
  const speed = 0.36;
  const count = 20;

  for (let i = 0; i < count; i++) {
    const phaseOff = i / count;
    const progress = age * speed;
    if (progress < phaseOff) continue;
    const cycle = (progress - phaseOff) % 1;

    const rise = cycle * 0.88;
    const curl = 0.03 + 0.14 * cycle;
    const wx =
      chimneyPos[0] +
      Math.sin(cycle * 5.2 + elapsedSec * 1.9 + i * 0.9) * curl +
      cycle * 0.18;
    const wy = chimneyPos[1] + 0.03 + rise - cameraTargetY;
    const wz =
      chimneyPos[2] +
      Math.cos(cycle * 4.4 + elapsedSec * 1.5 + i * 1.1) * (0.02 + 0.09 * cycle);

    const rx = wx * cy + wz * sy;
    const rz = -wx * sy + wz * cy;
    const py = wy * cp + rz * sp;
    const pz = -wy * sp + rz * cp;

    const zCam = cameraDist + pz;
    if (zCam <= 0.35) continue;

    const proj = focalScale / zCam;
    const col = Math.floor((centerX + rx * proj * scalePx) / cellW);
    const row = Math.floor((centerY - py * proj * scalePx) / cellH);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const idx = row * cols + col;
    if (zCam >= depth[idx]) continue;

    const fade = Math.sin(cycle * Math.PI) * (1 - 0.35 * cycle);
    if (fade < 0.16) continue;

    depth[idx] = zCam;
    if (kinds) kinds[idx] = -1;
    const glyphIdx =
      cycle > 0.78 ? SMOKE_GLYPHS.length - 1 : (i + Math.floor(cycle * 3)) % 4;
    chars[idx] = SMOKE_GLYPHS[glyphIdx];

    const lum = clamp(0.38 + 0.58 * fade, 0.25, 0.95);
    const rr = Math.round(192 * lum);
    const gg = Math.round(206 * lum);
    const bb = Math.round(228 * lum);
    colors[idx] = `rgb(${rr},${gg},${bb})`;
  }
}
