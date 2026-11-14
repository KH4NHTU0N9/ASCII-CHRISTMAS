import { TAU, envelope, normalize3 } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates a slender, sparkling golden tinsel garland draped in swags
 * around the outer pine branches. Encodes normalized arc progress into phase
 * so a continuous light wave travels upward from base to apex.
 */
export function buildGarland(buffer, rng, { y0 = 0.42, y1 = 2.55 } = {}) {
  const steps = 880;
  const turns = 4.2;
  const strands = 3;

  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    const yg = y0 + 0.14 + (y1 - y0 - 0.36) * u;
    const ag = TAU * turns * u + 0.9;
    const swag = -0.025 * Math.abs(Math.sin(ag * 2.5));
    const rg = envelope(yg, y0, y1) * 1.05 + 0.032;

    const bx = rg * Math.cos(ag);
    const by = yg + swag;
    const bz = rg * Math.sin(ag);
    const t0 = 5.4 + 2.1 * u;

    // Monotonic arc phase from 0 at base to 18*PI at top for upward wave chase
    const arcPhase = u * Math.PI * 18;

    for (let k = 0; k < strands; k++) {
      const offAngle = (TAU * k) / strands + u * 28;
      const rad = 0.012;
      const ox = rad * Math.cos(offAngle) * Math.cos(ag);
      const oy = rad * Math.sin(offAngle);
      const oz = rad * Math.cos(offAngle) * Math.sin(ag);

      const [nx, ny, nz] = normalize3(
        Math.cos(ag) + 0.35 * Math.cos(offAngle),
        0.35 + 0.35 * Math.sin(offAngle),
        Math.sin(ag)
      );

      const gleam = rng.uniform(0.9, 1.12);
      buffer.addPoint(
        bx + ox,
        by + oy,
        bz + oz,
        nx,
        ny,
        nz,
        1.0 * gleam,
        0.86 * gleam,
        0.28 * gleam,
        PART_KINDS.GARLAND,
        t0,
        arcPhase,
        0.95
      );
    }
  }
}
