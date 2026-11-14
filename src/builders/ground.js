import { TAU } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates the snowy ground disc beneath the tree with subtle snow drifts
 * and radial falloff so the outer edge dissolves into the night sky.
 */
export function buildGround(buffer, rng) {
  const rings = 56;
  const maxRadius = 2.35;

  for (let ir = 1; ir <= rings; ir++) {
    const f = ir / rings;
    const rBase = 0.08 + (maxRadius - 0.08) * Math.pow(f, 0.92);
    const steps = Math.max(18, Math.floor(20 + 170 * f));
    const fade = Math.pow(1 - f, 0.55);

    for (let ia = 0; ia < steps; ia++) {
      const a = (TAU * ia) / steps + rng.uniform(-0.015, 0.015);
      const r = rBase + rng.uniform(-0.016, 0.016);
      const px = r * Math.cos(a);
      const pz = r * Math.sin(a);

      // Gentle concentric drift ripples and slight snow mound near trunk
      const mound = 0.07 * Math.exp(-r * r * 1.4);
      const ripple = 0.014 * Math.sin(r * 9.5 + a * 2.0);
      const py = -0.06 + mound + ripple;

      const shade = (0.36 + 0.42 * fade) * rng.uniform(0.86, 1.08);
      const cr = 0.78 * shade;
      const cg = 0.84 * shade;
      const cb = 0.96 * shade;

      buffer.addPoint(
        px,
        py,
        pz,
        -0.12 * Math.cos(a),
        1.0,
        -0.12 * Math.sin(a),
        cr,
        cg,
        cb,
        PART_KINDS.GROUND,
        0.0,
        0.0,
        0.05
      );
    }
  }
}
