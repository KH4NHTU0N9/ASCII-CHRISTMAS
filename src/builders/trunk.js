import { TAU } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

/**
 * Generates the cylindrical wooden trunk with procedural bark striping.
 */
export function buildTrunk(buffer) {
  const heightSteps = 48;
  const angleSteps = 36;
  const radius = 0.105;
  const hMin = -0.05;
  const hMax = 0.58;

  for (let ih = 0; ih < heightSteps; ih++) {
    const f = ih / (heightSteps - 1);
    const h = hMin + (hMax - hMin) * f;
    const t0 = 0.15 + 0.9 * f;

    for (let ia = 0; ia < angleSteps; ia++) {
      const a = (TAU * ia) / angleSteps;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const bark = 0.75 + 0.25 * Math.sin(h * 90 + a * 3);

      buffer.addPoint(
        radius * ca,
        h,
        radius * sa,
        ca,
        0,
        sa,
        0.42 * bark,
        0.26 * bark,
        0.14 * bark,
        PART_KINDS.TRUNK,
        t0,
        0.0,
        0.05
      );
    }
  }
}
