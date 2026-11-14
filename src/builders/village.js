import { TAU, fibSphere } from '../math.js';
import { PART_KINDS } from '../partsBuffer.js';

function transformLocal(cx, cz, yaw, lx, ly, lz) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [cx + lx * c - lz * s, -0.02 + ly, cz + lx * s + lz * c];
}

function buildCabin(buffer) {
  const cx = -1.52;
  const cz = -0.26;
  const yaw = 0.42;
  const hw = 0.24;
  const hd = 0.22;
  const wallH = 0.26;
  const roofH = 0.18;
  const t0 = 6.2;

  const woodCol = [0.68, 0.4, 0.22];
  const snowCol = [0.95, 0.98, 1.0];
  const windowCol = [1.0, 0.85, 0.35];
  const doorCol = [0.42, 0.22, 0.12];
  const chimneyCol = [0.65, 0.28, 0.24];

  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const addRot = (lx, ly, lz, nx, ny, nz, col, shine = 0.12) => {
    const [wx, wy, wz] = transformLocal(cx, cz, yaw, lx, ly, lz);
    buffer.addPoint(
      wx, wy, wz,
      nx * c - nz * s, ny, nx * s + nz * c,
      col[0], col[1], col[2],
      PART_KINDS.CABIN,
      t0 + 0.5 * (ly / (wallH + roofH)),
      0.0,
      shine
    );
  };

  // Front & back walls (+z has warm door & glowing windows)
  for (const sign of [-1, 1]) {
    for (let iu = 0; iu <= 18; iu++) {
      const lx = -hw + (2 * hw * iu) / 18;
      for (let iv = 0; iv <= 12; iv++) {
        const ly = (wallH * iv) / 12;
        const isDoor = sign > 0 && Math.abs(lx) < 0.055 && ly < 0.17;
        const isWin =
          (sign > 0 && Math.abs(Math.abs(lx) - 0.14) < 0.045 && ly > 0.1 && ly < 0.19) ||
          (sign < 0 && Math.abs(lx) < 0.06 && ly > 0.1 && ly < 0.19);
        const col = isDoor ? doorCol : isWin ? windowCol : woodCol;
        addRot(lx, ly, sign * hd, 0, 0, sign, col, isWin ? 1.0 : 0.1);
      }
    }
  }

  // Left & right walls (with glowing side windows)
  for (const sign of [-1, 1]) {
    for (let iu = 0; iu <= 16; iu++) {
      const lz = -hd + (2 * hd * iu) / 16;
      for (let iv = 0; iv <= 12; iv++) {
        const ly = (wallH * iv) / 12;
        const isWin = Math.abs(lz) < 0.065 && ly > 0.1 && ly < 0.19;
        addRot(sign * hw, ly, lz, sign, 0, 0, isWin ? windowCol : woodCol, isWin ? 1.0 : 0.1);
      }
    }
  }

  // Gable triangles + snowy pitched roof
  for (let iu = 0; iu <= 18; iu++) {
    const u = iu / 18;
    const lx = -hw * 1.12 + (2 * hw * 1.12) * u;
    const ridgeFrac = 1 - Math.abs(u * 2 - 1);
    const ly = wallH + roofH * ridgeFrac;
    const nSlope = u < 0.5 ? -0.65 : 0.65;
    for (let iv = 0; iv <= 16; iv++) {
      const lz = -hd * 1.14 + (2 * hd * 1.14 * iv) / 16;
      addRot(lx, ly, lz, nSlope, 0.76, 0, snowCol, 0.25);
    }
  }

  // Brick chimney on right roof slope
  const chimLx = 0.12;
  const chimLz = -0.06;
  for (let ih = 0; ih <= 8; ih++) {
    const ly = wallH + 0.06 + (0.18 * ih) / 8;
    for (let ia = 0; ia < 12; ia++) {
      const a = (TAU * ia) / 12;
      addRot(
        chimLx + 0.042 * Math.cos(a),
        ly,
        chimLz + 0.042 * Math.sin(a),
        Math.cos(a), 0.15, Math.sin(a),
        chimneyCol, 0.1
      );
    }
  }

  // Return exact world coordinate of chimney top for smoke emitter
  return transformLocal(cx, cz, yaw, chimLx, wallH + 0.25, chimLz);
}

function buildSnowman(buffer) {
  const cx = 1.48;
  const cz = -0.18;
  const yaw = -0.38;
  const t0 = 6.5;

  const snowCol = [0.96, 0.98, 1.0];
  const scarfCol = [0.96, 0.18, 0.22];
  const carrotCol = [1.0, 0.55, 0.12];
  const coalCol = [0.18, 0.2, 0.26];
  const hatCol = [0.22, 0.24, 0.3];

  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const addRot = (lx, ly, lz, nx, ny, nz, col, shine = 0.2) => {
    const [wx, wy, wz] = transformLocal(cx, cz, yaw, lx, ly, lz);
    buffer.addPoint(
      wx, wy, wz,
      nx * c - nz * s, ny, nx * s + nz * c,
      col[0], col[1], col[2],
      PART_KINDS.SNOWMAN,
      t0 + 0.4 * Math.min(1, ly / 0.65),
      0.0,
      shine
    );
  };

  // Three stacked snow spheres (body, torso, head)
  const spheres = [
    { cy: 0.15, r: 0.165, n: 90 },
    { cy: 0.37, r: 0.125, n: 72 },
    { cy: 0.54, r: 0.092, n: 60 },
  ];

  for (const sp of spheres) {
    const pts = fibSphere(sp.n);
    for (let i = 0; i < pts.length; i++) {
      const [sx, sy, sz] = pts[i];
      addRot(sx * sp.r, sp.cy + sy * sp.r, sz * sp.r, sx, sy, sz, snowCol, 0.22);
    }
  }

  // Red scarf collar + dangling tail
  for (let i = 0; i < 24; i++) {
    const a = (TAU * i) / 24;
    addRot(0.098 * Math.cos(a), 0.46, 0.098 * Math.sin(a), Math.cos(a), 0.2, Math.sin(a), scarfCol, 0.2);
  }
  for (let k = 0; k < 6; k++) {
    addRot(0.06, 0.44 - k * 0.024, 0.095, 0, 0.1, 1, scarfCol, 0.2);
  }

  // Carrot nose pointing forward (+z)
  for (let k = 1; k <= 6; k++) {
    addRot(0, 0.545, 0.092 + k * 0.015, 0, 0.2, 1, carrotCol, 0.35);
  }

  // Coal eyes & buttons
  addRot(-0.032, 0.57, 0.088, -0.3, 0.3, 0.9, coalCol, 0.4);
  addRot(0.032, 0.57, 0.088, 0.3, 0.3, 0.9, coalCol, 0.4);
  addRot(0, 0.40, 0.124, 0, 0, 1, coalCol, 0.4);
  addRot(0, 0.34, 0.126, 0, 0, 1, coalCol, 0.4);

  // Cute top hat (brim + cylinder crown)
  for (let i = 0; i < 24; i++) {
    const a = (TAU * i) / 24;
    addRot(0.115 * Math.cos(a), 0.635, 0.115 * Math.sin(a), Math.cos(a), 0.8, Math.sin(a), hatCol, 0.25);
  }
  for (let ih = 0; ih < 6; ih++) {
    const ly = 0.64 + ih * 0.022;
    const col = ih === 0 ? scarfCol : hatCol;
    for (let i = 0; i < 18; i++) {
      const a = (TAU * i) / 18;
      addRot(0.072 * Math.cos(a), ly, 0.072 * Math.sin(a), Math.cos(a), 0.2, Math.sin(a), col, 0.25);
    }
  }
}

/**
 * Adds a cozy snow-topped wooden cabin (with glowing windows and chimney)
 * and a 3D ASCII snowman at the edges of the snowy ground plane.
 */
export function buildVillage(buffer) {
  const chimneyPos = buildCabin(buffer);
  buildSnowman(buffer);
  return { chimneyPos };
}
