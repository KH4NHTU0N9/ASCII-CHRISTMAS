import { TAU, envelope, normalize3 } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates 24 whorls of drooping pine branches with ambient occlusion
 * shading, upper-surface snow caps, and returns branch tip anchors.
 */
export function buildFoliage(buffer, rng, { y0 = 0.42, y1 = 2.55, tiers = 24 } = {}) {
  const tips = [];
  const span = y1 - y0;

  for (let i = 0; i < tiers; i++) {
    const fTier = i / (tiers - 1);
    const y = y0 + 0.02 + (span - 0.06) * fTier;
    const R = envelope(y, y0, y1);
    const ratio = (y - y0) / span;
    const nb = Math.floor(7 + 11 * (1 - ratio));

    for (let b = 0; b < nb; b++) {
      const a = (TAU * b) / nb + i * 0.618 * TAU + rng.normal(0, 0.18);
      const L = R * rng.uniform(0.82, 1.06);
      const n = Math.floor(38 + 145 * L);

      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const sideX = -dz;
      const sideZ = dx;

      for (let k = 0; k < n; k++) {
        const s = Math.pow(rng.random(), 0.65);
        const spread = (0.035 + 0.105 * s) * rng.normal(0, 1);
        const dist = s * L;
        const yy =
          y +
          0.07 * dist -
          0.22 * dist * dist +
          0.028 * rng.normal(0, 1);

        const px = dx * dist + sideX * spread;
        const pz = dz * dist + sideZ * spread;

        const [nx, ny, nz] = normalize3(
          dx * 0.72 + rng.normal(0, 0.25),
          0.56 + rng.normal(0, 0.2),
          dz * 0.72 + rng.normal(0, 0.25)
        );

        const ao = 0.35 + 0.65 * Math.pow(s, 1.3);
        const tone = ao * rng.uniform(0.76, 1.12);
        const cr = (0.07 + 0.06 * s) * tone;
        const cg = (0.39 + 0.18 * s) * tone;
        const cb = (0.13 + 0.06 * s) * tone;

        const t0 = 0.95 + 5.1 * ratio + 0.45 * s;
        const isSnow = s > 0.48 && rng.random() < 0.085 && ny > 0.32;

        if (isSnow) {
          buffer.addPoint(
            px,
            yy + 0.012,
            pz,
            nx,
            Math.max(0.5, ny),
            nz,
            0.93 * (0.85 + 0.15 * ao),
            0.96 * (0.85 + 0.15 * ao),
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

      const tipDist = L * 0.93;
      const tipY = y + 0.07 * tipDist - 0.22 * tipDist * tipDist;
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
