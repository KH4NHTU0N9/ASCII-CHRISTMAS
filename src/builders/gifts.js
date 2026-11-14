import { PART_KINDS } from '../partsBuffer.js';

const GIFT_SPECS = [
  {
    cx: -0.44, cz: 0.34, w: 0.26, h: 0.2, d: 0.24, yaw: 0.35,
    boxCol: [0.92, 0.15, 0.18], ribCol: [1.0, 0.84, 0.26], t0: 8.3,
  },
  {
    cx: 0.46, cz: 0.28, w: 0.28, h: 0.22, d: 0.26, yaw: -0.42,
    boxCol: [0.18, 0.45, 0.96], ribCol: [1.0, 0.84, 0.28], t0: 8.7,
  },
  {
    cx: 0.08, cz: 0.56, w: 0.22, h: 0.16, d: 0.2, yaw: 0.18,
    boxCol: [0.96, 0.68, 0.16], ribCol: [0.92, 0.16, 0.2], t0: 9.0,
  },
  {
    cx: -0.32, cz: -0.46, w: 0.24, h: 0.18, d: 0.22, yaw: 0.68,
    boxCol: [0.16, 0.72, 0.46], ribCol: [0.95, 0.96, 1.0], t0: 9.3,
  },
  {
    cx: 0.36, cz: -0.42, w: 0.22, h: 0.17, d: 0.22, yaw: -0.25,
    boxCol: [0.88, 0.18, 0.36], ribCol: [1.0, 0.88, 0.42], t0: 9.6,
  },
];

function addBoxPoint(buffer, spec, lx, ly, lz, lnx, lny, lnz, isRibbon) {
  const c = Math.cos(spec.yaw);
  const s = Math.sin(spec.yaw);
  const wx = spec.cx + lx * c - lz * s;
  const wy = -0.04 + ly;
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
    kind, t0, 0.0, isRibbon ? 0.6 : 0.22
  );
}

function sampleGiftBox(buffer, spec) {
  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const ribbonBand = 0.03;
  const nu = 14;
  const nv = 12;

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
  for (let k = 0; k < 16; k++) {
    const a = (Math.PI * 2 * k) / 16;
    const rx = 0.042 * Math.cos(a);
    const ry = spec.h + 0.02 + 0.018 * Math.abs(Math.sin(a));
    const rz = 0.018 * Math.sin(a * 2);
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
