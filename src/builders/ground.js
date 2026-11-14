import { PART_KINDS } from '../partsBuffer.js';

// Colored light bounce pools from gift boxes & lower tree canopy onto the snow
const FLOOR_GLOWS = [
  { x: -0.68, z: 0.48, r: 0.62, col: [0.95, 0.22, 0.25], str: 0.56 },
  { x: 0.68, z: 0.42, r: 0.66, col: [0.22, 0.54, 1.0], str: 0.62 },
  { x: 0.26, z: 0.78, r: 0.56, col: [1.0, 0.78, 0.28], str: 0.5 },
  { x: -0.46, z: -0.72, r: 0.54, col: [0.22, 0.85, 0.52], str: 0.44 },
  { x: 0.52, z: -0.66, r: 0.54, col: [0.95, 0.26, 0.48], str: 0.44 },
  { x: 0.0, z: 0.0, r: 1.35, col: [0.35, 0.85, 0.42], str: 0.24 },
];

/**
 * Generates a continuous jittered Cartesian snow floor plane with gentle
 * ripples, radial perimeter fade, and colored reflections under the gifts.
 */
export function buildGround(buffer, rng) {
  const maxRadius = 2.95;
  const maxR2 = maxRadius * maxRadius;
  const step = 0.032;

  for (let gx = -maxRadius; gx <= maxRadius; gx += step) {
    for (let gz = -maxRadius; gz <= maxRadius; gz += step) {
      const px = gx + rng.uniform(-0.012, 0.012);
      const pz = gz + rng.uniform(-0.012, 0.012);
      const r2 = px * px + pz * pz;
      if (r2 > maxR2 || r2 < 0.004) continue;

      const r = Math.sqrt(r2);
      const f = r / maxRadius;
      const fade = Math.pow(1 - f, 0.75);

      const mound = 0.065 * Math.exp(-r2 * 1.4);
      const ripple = 0.011 * Math.sin(r * 10.5 + Math.atan2(pz, px) * 2.0);
      const py = -0.06 + mound + ripple;

      const shade = (0.42 + 0.58 * fade) * rng.uniform(0.9, 1.12);
      let cr = 0.82 * shade;
      let cg = 0.89 * shade;
      let cb = 1.0 * shade;

      for (let g = 0; g < FLOOR_GLOWS.length; g++) {
        const gl = FLOOR_GLOWS[g];
        const dx = px - gl.x;
        const dz = pz - gl.z;
        const gd2 = dx * dx + dz * dz;
        const gr2 = gl.r * gl.r;
        if (gd2 < gr2) {
          const w = Math.pow(1 - gd2 / gr2, 1.75) * gl.str;
          cr += gl.col[0] * w;
          cg += gl.col[1] * w;
          cb += gl.col[2] * w;
        }
      }

      buffer.addPoint(
        px,
        py,
        pz,
        0.04 * (px / r),
        1.0,
        0.04 * (pz / r),
        Math.min(1.0, cr),
        Math.min(1.0, cg),
        Math.min(1.0, cb),
        PART_KINDS.GROUND,
        0.0,
        0.0,
        0.02
      );
    }
  }
}
