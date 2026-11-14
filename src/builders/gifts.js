import { PART_KINDS } from '../partsBuffer.js';

const GIFT_SPECS = [
  {
    cx: -0.68, cz: 0.48, w: 0.34, h: 0.25, d: 0.3, yaw: 0.35,
    boxCol: [0.95, 0.16, 0.2], ribCol: [1.0, 0.86, 0.28], t0: 7.2,
  },
  {
    cx: 0.68, cz: 0.42, w: 0.36, h: 0.28, d: 0.32, yaw: -0.42,
    boxCol: [0.2, 0.48, 0.98], ribCol: [1.0, 0.86, 0.3], t0: 7.6,
  },
  {
    cx: 0.26, cz: 0.78, w: 0.28, h: 0.21, d: 0.26, yaw: 0.22,
    boxCol: [0.98, 0.72, 0.18], ribCol: [0.94, 0.16, 0.22], t0: 8.0,
  },
  {
    cx: -0.46, cz: -0.72, w: 0.3, h: 0.23, d: 0.28, yaw: 0.68,
    boxCol: [0.18, 0.76, 0.48], ribCol: [0.96, 0.98, 1.0], t0: 8.4,
  },
  {
    cx: 0.52, cz: -0.66, w: 0.28, h: 0.22, d: 0.28, yaw: -0.25,
    boxCol: [0.92, 0.2, 0.42], ribCol: [1.0, 0.88, 0.42], t0: 8.8,
  },
];

function addBoxPoint(buffer, spec, lx, ly, lz, lnx, lny, lnz, isRibbon) {
  const c = Math.cos(spec.yaw);
  const s = Math.sin(spec.yaw);
  const wx = spec.cx + lx * c - lz * s;
  const wy = -0.01 + ly;
  const wz = spec.cz + lx * s + lz * c;

  const wnx = lnx * c - lnz * s;
  const wnz = lnx * s + lnz * c;

  const col = isRibbon ? spec.ribCol : spec.boxCol;
  const kind = isRibbon ? PART_KINDS.RIBBON : PART_KINDS.GIFT;
  const t0 = spec.t0 + 0.45 * (ly / spec.h);

  buffer.addPoint(
    wx, wy, wz,
    wnx, lny, wnz,
    col[0], col[1], col[2],
    kind, t0, 0.0, isRibbon ? 0.65 : 0.25
  );
}

function sampleGiftBox(buffer, spec) {
  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const ribbonBand = 0.04;
  const nu = 22;
  const nv = 18;

  // Top face
  for (let iu = 0; iu <= nu; iu++) {
    const lx = -hw + (spec.w * iu) / nu;
    for (let iv = 0; iv <= nv; iv++) {
      const lz = -hd + (spec.d * iv) / nv;
      const isRibbon = Math.abs(lx) < ribbonBand || Math.abs(lz) < ribbonBand;
      addBoxPoint(buffer, spec, lx, spec.h, lz, 0, 1, 0, isRibbon);
    }
  }

  // Front & back (+z, -z)
  for (const sign of [-1, 1]) {
    for (let iu = 0; iu <= nu; iu++) {
      const lx = -hw + (spec.w * iu) / nu;
      for (let iv = 0; iv <= nv; iv++) {
        const ly = (spec.h * iv) / nv;
        const isRibbon = Math.abs(lx) < ribbonBand;
        addBoxPoint(buffer, spec, lx, ly, sign * hd, 0, 0, sign, isRibbon);
      }
    }
  }

  // Left & right (+x, -x)
  for (const sign of [-1, 1]) {
    for (let iu = 0; iu <= nu; iu++) {
      const lz = -hd + (spec.d * iu) / nu;
      for (let iv = 0; iv <= nv; iv++) {
        const ly = (spec.h * iv) / nv;
        const isRibbon = Math.abs(lz) < ribbonBand;
        addBoxPoint(buffer, spec, sign * hw, ly, lz, sign, 0, 0, isRibbon);
      }
    }
  }

  // Ribbon bow loop on top center
  for (let k = 0; k < 28; k++) {
    const a = (Math.PI * 2 * k) / 28;
    const rx = 0.056 * Math.cos(a);
    const ry = spec.h + 0.024 + 0.024 * Math.abs(Math.sin(a));
    const rz = 0.024 * Math.sin(a * 2);
    addBoxPoint(buffer, spec, rx, ry, rz, 0, 1, 0, true);
  }
}

/**
 * Generates wrapped gift boxes with cross ribbons and bows around the trunk.
 */
export function buildGifts(buffer) {
  for (let i = 0; i < GIFT_SPECS.length; i++) {
    sampleGiftBox(buffer, GIFT_SPECS[i]);
  }
}
