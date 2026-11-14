import { TAU } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates the snowy ground disc beneath the tree with subtle snow drifts
 * and radial falloff so the outer edge dissolves into the night sky.
 */
export function buildGround(buffer, rng) {
  const rings = 72;
  const maxRadius = 2.4;

  for (let ir = 1; ir <= rings; ir++) {
    const f = ir / rings;
    const rBase = 0.08 + (maxRadius - 0.08) * Math.pow(f, 0.92);
    const steps = Math.max(24, Math.floor(26 + 220 * f));
    const fade = Math.pow(1 - f, 0.55);

    for (let ia = 0; ia < steps; ia++) {
      const a = (TAU * (ia + rng.uniform(-0.35, 0.35))) / steps;
      const r = rBase + rng.uniform(-0.025, 0.025);
      const px = r * Math.cos(a);
      const pz = r * Math.sin(a);

      // Gentle concentric drift ripples and slight snow mound near trunk
      const mound = 0.07 * Math.exp(-r * r * 1.4);
      const ripple = 0.015 * Math.sin(r * 10.5 + a * 2.0);
      const py = -0.06 + mound + ripple;

      const shade = (0.34 + 0.44 * fade) * rng.uniform(0.84, 1.12);
      const cr = 0.78 * shade;
      const cg = 0.85 * shade;
      const cb = 0.98 * shade;

      buffer.addPoint(
        px,
        py,
        pz,
        0.04 * Math.cos(a),
        1.0,
        0.04 * Math.sin(a),
        cr,
        cg,
        cb,
        PART_KINDS.GROUND,
        0.0,
        0.0,
        0.02
      );
    }
  }
}
