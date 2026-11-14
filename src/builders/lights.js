import { TAU, envelope } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

const LIGHT_PALETTE = [
  [1.0, 0.86, 0.34], // Warm amber
  [1.0, 0.25, 0.28], // Crimson red
  [0.32, 0.92, 0.56], // Festive emerald
  [0.34, 0.82, 1.0], // Ice cyan
  [1.0, 0.95, 0.86], // Warm white
];

/**
 * Places twinkling fairy lights spiralling up the tree outer silhouette.
 * Each light is one point of PART_KINDS.LIGHT so the HUD light count matches exactly.
 */
export function buildLights(buffer, rng, { y0 = 0.42, y1 = 2.55, lightCount = 170 } = {}) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const span = y1 - y0;

  for (let i = 0; i < lightCount; i++) {
    const u = (i + 0.5) / lightCount;
    const y = y0 + 0.08 + (span - 0.16) * Math.pow(u, 0.85);
    const angle = i * goldenAngle + rng.uniform(-0.18, 0.18);
    const r = envelope(y, y0, y1) * rng.uniform(0.84, 1.03);

    const px = r * Math.cos(angle);
    const pz = r * Math.sin(angle);
    const col = LIGHT_PALETTE[i % LIGHT_PALETTE.length];
    const t0 = 7.05 + 2.35 * u;
    const phase = rng.uniform(0, TAU);

    buffer.addPoint(
      px,
      y,
      pz,
      Math.cos(angle),
      0.25,
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
