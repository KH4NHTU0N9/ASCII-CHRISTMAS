import { CONFIG } from './config.js';
import { clamp, createRng, envelope, fibSphere } from './math.js';
import { PART_KINDS, PartsBuffer } from './partsBuffer.js';
import { buildGround } from './builders/ground.js';
import { buildTrunk } from './builders/trunk.js';
import { buildFoliage } from './builders/foliage.js';
import { buildGarland } from './builders/garland.js';
import { buildBaubles } from './builders/baubles.js';
import { buildLights } from './builders/lights.js';
import { buildStar } from './builders/star.js';
import { buildGifts } from './builders/gifts.js';
import { buildVillage } from './builders/village.js';

export { PART_KINDS, envelope, fibSphere };

// Primary warm key light (upper front-right) & cool moonlit rim light (back-left)
const LX = 0.44;
const LY = 0.72;
const LZ = 0.54;
const RX = -0.62;
const RY = 0.45;
const RZ = -0.52;

/**
 * Builds the complete 3D Christmas tree point-cloud scene from deterministic
 * seeded geometry generators and returns flat TypedArray buffers.
 */
export function buildTreeScene(overrides = {}) {
  const opts = { ...CONFIG.tree, ...overrides };
  const rng = createRng(opts.seed);
  const parts = new PartsBuffer();

  // --- ground snow & textured bark trunk
  buildGround(parts, rng);
  buildTrunk(parts);

  // --- needles: 26 whorls of drooping branches, dense at the tips
  const tips = buildFoliage(parts, rng, opts);

  // --- tinsel garland, ornament baubles, lights, apex star, gifts & village
  buildGarland(parts, rng, opts);
  buildBaubles(parts, rng, tips, opts);
  buildLights(parts, rng, opts);
  buildStar(parts, opts);
  buildGifts(parts);
  const { chimneyPos } = buildVillage(parts);

  return {
    ...parts.toSceneBuffers(),
    chimneyPos,
  };
}

/**
 * Computes key + rim lighting, specular gleam, frost-birth flash, and
 * selectable fairy light animation modes for each rotated 3D point.
 */
export function computePointShade(
  nx,
  ny,
  nz,
  shine,
  kind,
  elapsedSec,
  t0,
  phase,
  lightMode = 'twinkle',
  flashWindow = CONFIG.animation.birthFlashWindowSec
) {
  // Key diffuse + subtle moonlit rim fill + Blinn-Phong specular
  const keyDiff = Math.max(0, nx * LX + ny * LY + nz * LZ);
  const rimDiff = Math.max(0, nx * RX + ny * RY + nz * RZ) * 0.16;
  const hx = LX;
  const hy = LY;
  const hz = LZ + 1.0;
  const hLen = Math.hypot(hx, hy, hz) || 1;
  const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
  const spec = shine > 0 ? shine * Math.pow(ndoth, 18) : 0;

  let lum = 0.25 + 0.68 * keyDiff + rimDiff + 0.52 * spec;
  let birth = 0;

  // Progressive bottom-up frost construction shimmer
  const age = elapsedSec - t0;
  if (kind !== PART_KINDS.GROUND && age >= 0 && age < flashWindow) {
    birth = clamp(1 - age / flashWindow, 0, 1);
    lum += birth * 0.75;
  }

  // Animated fairy lights, apex starburst, and flowing upward spiral ribbon
  if (kind === PART_KINDS.LIGHT) {
    const wave =
      lightMode === 'cascade'
        ? 0.5 + 0.5 * Math.sin(elapsedSec * 5.2 - t0 * 3.0)
        : 0.5 + 0.5 * Math.sin(elapsedSec * 4.8 + phase);
    lum = 0.45 + 0.92 * wave;
  } else if (kind === PART_KINDS.STAR) {
    const shimmer = 0.85 + 0.2 * Math.sin(elapsedSec * 3.2 + phase);
    lum = Math.max(lum, 0.88) * shimmer;
  } else if (kind === PART_KINDS.GARLAND) {
    // Flowing upward spiral pulse (bottom-to-top phase travel)
    const travel = Math.sin(phase - elapsedSec * 7.2);
    const crest = Math.pow(0.5 + 0.5 * travel, 2.8);
    lum = 0.42 + 0.68 * crest;
  } else if (kind === PART_KINDS.CABIN && shine > 0.6) {
    const hearthFlicker = 0.9 + 0.12 * Math.sin(elapsedSec * 4.1 + phase);
    lum = Math.max(lum, 0.82) * hearthFlicker;
  }

  return { lum: clamp(lum, 0.1, 1.35), birth };
}

/**
 * Counts active lights at elapsedSec and formats telemetry values for the HUD.
 */
export function computeTelemetry(scene, elapsedSec, rotationDeg, lettersCount) {
  const { kinds, t0, count } = scene;
  let activeLights = 0;
  for (let i = 0; i < count; i++) {
    if (kinds[i] === PART_KINDS.LIGHT && elapsedSec >= t0[i]) {
      activeLights++;
    }
  }

  const wrappedDeg = ((rotationDeg % 360) + 360) % 360;
  return {
    timeText: `t ${elapsedSec.toFixed(2).padStart(5, '0')}s`,
    rotationText: `${wrappedDeg.toFixed(2).padStart(6, '0')}°`,
    lightsCount: activeLights,
    lettersText: lettersCount.toLocaleString('en-US'),
  };
}
