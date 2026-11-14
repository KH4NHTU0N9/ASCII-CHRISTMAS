import { TAU, envelope, normalize3 } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates 26 whorls of lush drooping pine branches with deep interior
 * ambient occlusion and frosty upper-surface snow caps.
 */
export function buildFoliage(buffer, rng, { y0 = 0.42, y1 = 2.55, tiers = 26 } = {}) {
  const tips = [];
  const span = y1 - y0;

  for (let i = 0; i < tiers; i++) {
    const fTier = i / (tiers - 1);
    const y = y0 + 0.02 + (span - 0.05) * fTier;
    const R = envelope(y, y0, y1);
    const ratio = (y - y0) / span;
    const nb = Math.floor(8 + 12 * (1 - ratio));

    for (let b = 0; b < nb; b++) {
      const a = (TAU * b) / nb + i * 0.618 * TAU + rng.normal(0, 0.16);
      const L = R * rng.uniform(0.8, 1.09);
      const n = Math.floor(62 + 205 * L);

      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const sideX = -dz;
      const sideZ = dx;

      for (let k = 0; k < n; k++) {
        const s = Math.pow(rng.random(), 0.6);
        const spread = (0.022 + 0.088 * s) * rng.normal(0, 1);
        const dist = s * L;
        const yy =
          y +
          0.075 * dist -
          0.18 * dist * dist +
          0.022 * rng.normal(0, 1);

        const px = dx * dist + sideX * spread;
        const pz = dz * dist + sideZ * spread;

        const [nx, ny, nz] = normalize3(
          dx * 0.72 + rng.normal(0, 0.25),
          0.56 + rng.normal(0, 0.2),
          dz * 0.72 + rng.normal(0, 0.25)
        );

        // Luminous outer pine tips with rich emerald ambient occlusion in crevices
        const ao = 0.42 + 0.58 * Math.pow(s, 1.25);
        const tone = ao * rng.uniform(0.84, 1.18);
        const cr = (0.06 + 0.2 * s) * tone;
        const cg = (0.44 + 0.42 * s) * tone;
        const cb = (0.14 + 0.16 * s) * tone;

        const t0 = 0.75 + 4.35 * ratio + 0.38 * s;
        const isSnow = s > 0.56 && rng.random() < 0.09 && ny > 0.36;

        if (isSnow) {
          buffer.addPoint(
            px,
            yy + 0.012,
            pz,
            nx,
            Math.max(0.55, ny),
            nz,
            0.94 * (0.85 + 0.15 * ao),
            0.97 * (0.85 + 0.15 * ao),
            1.0,
            PART_KINDS.SNOWCAP,
            t0,
            0.0,
            0.25
          );
        } else {
          buffer.addPoint(
            px,
            yy,
            pz,
            nx,
            ny,
            nz,
            cr,
            cg,
            cb,
            PART_KINDS.NEEDLE,
            t0,
            0.0,
            0.08
          );
        }
      }

      const tipDist = L * 0.95;
      const tipY = y + 0.075 * tipDist - 0.18 * tipDist * tipDist;
      tips.push({
        x: dx * tipDist,
        y: tipY,
        z: dz * tipDist,
        angle: a,
        ratio,
      });
    }
  }

  return tips;
}
