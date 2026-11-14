import { TAU, normalize3 } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates a crisp 3D bevelled 5-pointed golden star at the tree apex
 * paired with slender horizontal and vertical starburst rays.
 */
export function buildStar(buffer, { y1 = 2.55 } = {}) {
  const cy = y1 + 0.16;
  const outerR = 0.195;
  const innerR = 0.072;
  const depth = 0.045;
  const pointsCount = 10;

  const ring = [];
  for (let i = 0; i < pointsCount; i++) {
    const angle = Math.PI / 2 + (TAU * i) / pointsCount;
    const rad = i % 2 === 0 ? outerR : innerR;
    ring.push([rad * Math.cos(angle), cy + rad * Math.sin(angle)]);
  }

  const radialSteps = 14;
  const edgeSteps = 10;

  for (const side of [-1, 1]) {
    const apexZ = side * depth;
    for (let i = 0; i < pointsCount; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % pointsCount];

      const [nx, ny, nz] = normalize3(
        (ax + bx) * 0.25,
        (ay + by - 2 * cy) * 0.25,
        side * 0.9
      );

      for (let ir = 0; ir <= radialSteps; ir++) {
        const u = ir / radialSteps;
        const maxE = Math.max(1, Math.round(edgeSteps * u));
        for (let ie = 0; ie <= maxE; ie++) {
          const v = ie / maxE;
          const px = u * ((1 - v) * ax + v * bx);
          const py = cy + u * ((1 - v) * (ay - cy) + v * (by - cy));
          const pz = (1 - u) * apexZ;
          const coreGlow = 1.0 - 0.1 * u;

          buffer.addPoint(
            px,
            py,
            pz,
            nx,
            ny,
            nz,
            1.0 * coreGlow,
            0.93 * coreGlow,
            0.42,
            PART_KINDS.STAR,
            5.15 + 0.45 * u,
            u * 2.0,
            1.0
          );
        }
      }
    }
  }

  // Slender diffraction starburst flare spikes (cross rays)
  const rayDirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -0.75, 0],
  ];
  for (let d = 0; d < rayDirs.length; d++) {
    const [dx, dy, dz] = rayDirs[d];
    const maxLen = d < 2 ? 0.34 : 0.28;
    for (let step = 4; step <= 14; step++) {
      const t = step / 14;
      const dist = maxLen * t;
      const falloff = 1.0 - 0.55 * t;
      buffer.addPoint(
        dx * dist,
        cy + dy * dist,
        dz * dist,
        0,
        0.5,
        0.86,
        1.0 * falloff,
        0.94 * falloff,
        0.55 * falloff,
        PART_KINDS.STAR,
        5.35 + 0.25 * t,
        t * 2.0,
        0.8
      );
    }
  }
}
