import { TAU, envelope, normalize3 } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates a drooping golden tinsel garland spiralling up the tree in swags.
 */
export function buildGarland(buffer, rng, { y0 = 0.42, y1 = 2.55 } = {}) {
  const steps = 420;
  const turns = 3.6;
  const strands = 5;

  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    const yg = y0 + 0.15 + (y1 - y0 - 0.45) * u;
    const ag = TAU * turns * u + 0.9;
    const swag = -0.06 * Math.abs(Math.sin(ag * 2.5));
    const rg = envelope(yg, y0, y1) * 1.02 + 0.03;

    const bx = rg * Math.cos(ag);
    const by = yg + swag;
    const bz = rg * Math.sin(ag);
    const t0 = 6.5 + 1.9 * u;

    for (let k = 0; k < strands; k++) {
      const offAngle = (TAU * k) / strands + u * 18;
      const rad = 0.014;
      const ox = rad * Math.cos(offAngle) * Math.cos(ag);
      const oy = rad * Math.sin(offAngle);
      const oz = rad * Math.cos(offAngle) * Math.sin(ag);

      const [nx, ny, nz] = normalize3(
        Math.cos(ag) + 0.35 * Math.cos(offAngle),
        0.35 + 0.35 * Math.sin(offAngle),
        Math.sin(ag)
      );

      const gleam = rng.uniform(0.82, 1.05);
      buffer.addPoint(
        bx + ox,
        by + oy,
        bz + oz,
        nx,
        ny,
        nz,
        1.0 * gleam,
        0.82 * gleam,
        0.26 * gleam,
        PART_KINDS.GARLAND,
        t0,
        u * TAU * 4,
        0.75
      );
    }
  }
}
