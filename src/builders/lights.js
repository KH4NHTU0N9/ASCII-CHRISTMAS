import { TAU, envelope } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

const LIGHT_PALETTE = [
  [1.0, 0.88, 0.34],  // Warm amber
  [1.0, 0.26, 0.3],   // Crimson red
  [0.34, 0.96, 0.58], // Festive emerald
  [0.36, 0.84, 1.0],  // Ice cyan
  [1.0, 0.96, 0.86],  // Warm white
];

/**
 * Places twinkling fairy lights on the outer canopy silhouette so they
 * remain visible above the pine needles as the tree rotates.
 */
export function buildLights(buffer, rng, { y0 = 0.42, y1 = 2.55, lightCount = 170 } = {}) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const span = y1 - y0;

  for (let i = 0; i < lightCount; i++) {
    const u = (i + 0.5) / lightCount;
    const y = y0 + 0.08 + (span - 0.16) * Math.pow(u, 0.86);
    const angle = i * goldenAngle + rng.uniform(-0.14, 0.14);
    const r = envelope(y, y0, y1) * rng.uniform(1.06, 1.16);

    const px = r * Math.cos(angle);
    const pz = r * Math.sin(angle);
    const col = LIGHT_PALETTE[i % LIGHT_PALETTE.length];
    const t0 = 5.6 + 2.8 * u;
    const phase = rng.uniform(0, TAU);

    buffer.addPoint(
      px,
      y,
      pz,
      Math.cos(angle),
      0.28,
      Math.sin(angle),
      col[0],
      col[1],
      col[2],
      PART_KINDS.LIGHT,
      t0,
      phase,
      1.0
    );
  }
}
