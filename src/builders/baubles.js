import { TAU, envelope, fibSphere } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

const BAUBLE_PALETTE = [
  [0.98, 0.14, 0.18], // Rich ruby crimson
  [1.0, 0.78, 0.16],  // Warm gold
  [0.2, 0.76, 1.0],   // Ice sapphire
  [0.98, 0.42, 0.16], // Copper orange
  [0.94, 0.96, 1.0],  // Frosted pearl
];

/**
 * Attaches glossy 3D shaded spherical baubles along outer branch tips.
 */
export function buildBaubles(buffer, rng, tips, { y0 = 0.42, y1 = 2.55 } = {}) {
  const unitSphere = fibSphere(64);
  const candidates = tips.filter((t) => t.ratio < 0.9);
  const placed = [];

  for (let i = 0; i < candidates.length; i++) {
    if (i % 5 !== 0 && rng.random() > 0.12) continue;

    const tip = candidates[i];
    const radius = rng.uniform(0.044, 0.056);
    const col = BAUBLE_PALETTE[placed.length % BAUBLE_PALETTE.length];
    const cx = tip.x * 1.03;
    const cy = tip.y - radius * 0.65;
    const cz = tip.z * 1.03;
    const t0 = 5.4 + 1.45 * tip.ratio + rng.uniform(0, 0.25);

    placed.push({ cx, cy, cz, radius, col, t0 });
  }

  const extraCount = 14;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < extraCount; i++) {
    const u = (i + 0.4) / extraCount;
    const y = y0 + 0.16 + (y1 - y0 - 0.34) * Math.pow(u, 0.88);
    const a = i * goldenAngle + 0.5;
    const r = envelope(y, y0, y1) * rng.uniform(1.02, 1.08);
    const radius = rng.uniform(0.045, 0.058);
    const col = BAUBLE_PALETTE[(placed.length + i) % BAUBLE_PALETTE.length];
    const t0 = 5.6 + 1.4 * u;

    placed.push({
      cx: r * Math.cos(a),
      cy: y,
      cz: r * Math.sin(a),
      radius,
      col,
      t0,
    });
  }

  for (let i = 0; i < placed.length; i++) {
    const { cx, cy, cz, radius, col, t0 } = placed[i];
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
        1.4
      );
    }
  }
}
