import { fibSphere } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

const BAUBLE_PALETTE = [
  [0.95, 0.14, 0.18], // Ruby crimson
  [1.0, 0.76, 0.16],  // Warm gold
  [0.24, 0.72, 0.98], // Ice sapphire
  [0.92, 0.94, 1.0],  // Frosted silver
];

/**
 * Attaches spherical ornament baubles below sampled branch tips.
 */
export function buildBaubles(buffer, rng, tips) {
  const unitSphere = fibSphere(28);
  const candidates = tips.filter((t) => t.ratio < 0.92);

  for (let i = 0; i < candidates.length; i++) {
    if (i % 4 !== 0 && rng.random() > 0.12) continue;

    const tip = candidates[i];
    const radius = rng.uniform(0.036, 0.052);
    const col = BAUBLE_PALETTE[i % BAUBLE_PALETTE.length];
    const cx = tip.x * 0.96;
    const cy = tip.y - radius * 1.05;
    const cz = tip.z * 0.96;
    const t0 = 6.3 + 1.45 * tip.ratio + rng.uniform(0, 0.25);

    for (let j = 0; j < unitSphere.length; j++) {
      const [sx, sy, sz] = unitSphere[j];
      buffer.addPoint(
        cx + sx * radius,
        cy + sy * radius,
        cz + sz * radius,
        sx,
        sy,
        sz,
        col[0],
        col[1],
        col[2],
        PART_KINDS.BALL,
        t0,
        0.0,
        0.85
      );
    }
  }
}
