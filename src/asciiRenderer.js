import { CONFIG } from './config.js';
import { clamp } from './math.js';
import { PART_KINDS } from './partsBuffer.js';
import { computePointShade } from './treeEngine.js';
import { renderSkyToGrid } from './skyParticles.js';

const RAMP = CONFIG.render.ramp;

// Quantized RGB string cache to avoid thousands of string allocations per frame
const RGB_CACHE = new Map();

function getQuantizedRgb(rLin, gLin, bLin) {
  const rr = clamp(Math.round(rLin * 255), 0, 255) & 0xfc;
  const gg = clamp(Math.round(gLin * 255), 0, 255) & 0xfc;
  const bb = clamp(Math.round(bLin * 255), 0, 255) & 0xfc;
  const key = (rr << 16) | (gg << 8) | bb;
  let str = RGB_CACHE.get(key);
  if (!str) {
    str = `rgb(${rr},${gg},${bb})`;
    RGB_CACHE.set(key, str);
  }
  return { str, rr, gg, bb };
}

/**
 * Creates or resizes a reusable ASCII character + Z-buffer grid.
 */
export function createAsciiGrid(cols, rows) {
  const len = Math.max(1, cols * rows);
  return {
    cols,
    rows,
    depth: new Float32Array(len),
    kinds: new Int16Array(len).fill(-1),
    chars: new Array(len).fill(' '),
    colors: new Array(len).fill(''),
    rgbPacked: new Uint32Array(len),
    glow: new Float32Array(len),
    glowColors: new Array(len).fill(''),
  };
}

function resetGrid(grid) {
  grid.depth.fill(1000);
  grid.kinds.fill(-1);
  grid.chars.fill(' ');
  grid.colors.fill('');
  grid.rgbPacked.fill(0);
  grid.glow.fill(0);
  grid.glowColors.fill('');
}

function glyphFromLuminance(lum, kind) {
  if (kind === PART_KINDS.LIGHT) return lum > 0.85 ? '@' : '*';
  if (kind === PART_KINDS.STAR) return lum > 0.9 ? '@' : '#';
  if (kind === PART_KINDS.GARLAND) return lum > 0.72 ? '*' : '+';
  if (kind === PART_KINDS.GROUND) {
    const groundRamp = ' .·:;-=+';
    const idx = clamp(Math.floor(lum * (groundRamp.length - 1)), 1, groundRamp.length - 1);
    return groundRamp[idx];
  }
  const idx = clamp(Math.floor(lum * 1.15 * (RAMP.length - 1)), 1, RAMP.length - 1);
  return RAMP[idx];
}

/**
 * Projects rotated 3D scene points onto an AsciiGrid using perspective Z-buffering.
 * Decoupled from DOM Canvas for deterministic Node.js unit testing.
 */
export function projectSceneToGrid(
  scene,
  grid,
  {
    elapsedSec = 0,
    rotationDeg = 0,
    widthPx = 600,
    heightPx = 500,
    cellW = 3.5,
    cellH = 5.5,
    sky = null,
  } = {}
) {
  resetGrid(grid);

  const {
    cols,
    rows,
    depth,
    kinds: cellKinds,
    chars,
    colors,
    rgbPacked,
    glow,
    glowColors,
  } = grid;
  const {
    cameraPitchRad,
    cameraDist,
    cameraTargetY,
    focalScale,
  } = CONFIG.render;

  const yaw = (rotationDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(cameraPitchRad);
  const sp = Math.sin(cameraPitchRad);

  const scalePx = Math.min(heightPx, widthPx * 1.12) * 0.345;
  const centerX = widthPx * 0.5;
  const centerY = heightPx * 0.49;

  const { count, positions, normals, colors: pColors, kinds, t0, phase, shine } = scene;

  for (let i = 0; i < count; i++) {
    const pointT0 = t0[i];
    if (elapsedSec < pointT0) continue;

    const i3 = i * 3;
    const wx = positions[i3];
    const wy = positions[i3 + 1] - cameraTargetY;
    const wz = positions[i3 + 2];

    const rx = wx * cy + wz * sy;
    const rz = -wx * sy + wz * cy;
    // Downward camera pitch: back ground (+rz) rises toward horizon, front (-rz) slopes toward foreground
    const py = wy * cp + rz * sp;
    const pz = -wy * sp + rz * cp;

    const zCam = cameraDist + pz;
    if (zCam <= 0.35) continue;

    const proj = focalScale / zCam;
    const sx = centerX + rx * proj * scalePx;
    const syScreen = centerY - py * proj * scalePx;

    const col = Math.floor(sx / cellW);
    const row = Math.floor(syScreen / cellH);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const kind = kinds[i];
    let zBias = 0;
    if (kind === PART_KINDS.LIGHT) {
      zBias = 0.09;
    } else if (
      kind === PART_KINDS.BALL ||
      kind === PART_KINDS.GARLAND ||
      kind === PART_KINDS.STAR
    ) {
      zBias = 0.04;
    } else if (kind === PART_KINDS.GIFT || kind === PART_KINDS.RIBBON) {
      zBias = 0.02;
    }
    const zEffective = zCam - zBias;

    const cellIdx = row * cols + col;
    if (zEffective >= depth[cellIdx]) continue;

    const nwx = normals[i3];
    const nwy = normals[i3 + 1];
    const nwz = normals[i3 + 2];
    const nrx = nwx * cy + nwz * sy;
    const nrz = -nwx * sy + nwz * cy;
    const nry = nwy * cp + nrz * sp;
    const nrzPitch = -nwy * sp + nrz * cp;

    const { lum, birth } = computePointShade(
      nrx,
      nry,
      nrzPitch,
      shine[i],
      kind,
      elapsedSec,
      pointT0,
      phase[i]
    );

    depth[cellIdx] = zEffective;
    cellKinds[cellIdx] = kind;

    const baseR = pColors[i3];
    const baseG = pColors[i3 + 1];
    const baseB = pColors[i3 + 2];
    const shadeFactor =
      kind === PART_KINDS.LIGHT || kind === PART_KINDS.STAR
        ? Math.max(0.75, lum)
        : 0.25 + 0.92 * lum;

    const rLin = baseR * shadeFactor * (1 - birth * 0.72) + 0.96 * (birth * 0.72);
    const gLin = baseG * shadeFactor * (1 - birth * 0.72) + 0.98 * (birth * 0.72);
    const bLin = baseB * shadeFactor * (1 - birth * 0.72) + 1.0 * (birth * 0.72);

    const { str, rr, gg, bb } = getQuantizedRgb(rLin, gLin, bLin);
    chars[cellIdx] = birth > 0.35 ? '#' : glyphFromLuminance(lum, kind);
    colors[cellIdx] = str;
    rgbPacked[cellIdx] = (rr << 16) | (gg << 8) | bb;

    if (kind === PART_KINDS.LIGHT || kind === PART_KINDS.STAR) {
      const intensity = kind === PART_KINDS.STAR ? 0.92 : clamp(lum - 0.2, 0, 1);
      if (intensity > glow[cellIdx]) {
        glow[cellIdx] = intensity;
        glowColors[cellIdx] = str;
      }
    }
  }

  // Radiate warm ASCII light bounce onto neighboring cells & empty halo sparks
  applyAsciiLightBounce(grid);

  if (sky) {
    renderSkyToGrid(sky, grid, elapsedSec);
  }

  let lettersCount = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ' ') lettersCount++;
  }

  return lettersCount;
}

function applyAsciiLightBounce(grid) {
  const { cols, rows, depth, chars, colors, rgbPacked, glow, glowColors } = grid;

  for (let r = 2; r < rows - 2; r++) {
    const rowOff = r * cols;
    for (let c = 2; c < cols - 2; c++) {
      const idx = rowOff + c;
      const g = glow[idx];
      if (g < 0.48) continue;

      const lightCol = glowColors[idx];
      const lp = rgbPacked[idx];
      const lr = (lp >> 16) & 0xff;
      const lg = (lp >> 8) & 0xff;
      const lb = lp & 0xff;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nIdx = (r + dr) * cols + (c + dc);
          if (chars[nIdx] === ' ' && depth[nIdx] >= 900) {
            if (Math.abs(dr) + Math.abs(dc) === 1 && g > 0.62) {
              chars[nIdx] = '·';
              colors[nIdx] = lightCol;
            }
            continue;
          }
          // Softly illuminate adjacent needles/snow without overwriting lights
          if (glow[nIdx] > 0) continue;
          const p = rgbPacked[nIdx];
          const nr = (p >> 16) & 0xff;
          const ng = (p >> 8) & 0xff;
          const nb = p & 0xff;
          const boost = 0.22 * g;
          const { str } = getQuantizedRgb(
            (nr + lr * boost) / 255,
            (ng + lg * boost) / 255,
            (nb + lb * boost) / 255
          );
          colors[nIdx] = str;
        }
      }
    }
  }
}

/**
 * Canvas 2D renderer wrapper that handles Retina DPI scaling, micro-ASCII grid
 * sizing, and smooth radial glow falloff (no hard circular edges).
 */
export class AsciiCanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.grid = createAsciiGrid(140, 72);
    this.metrics = {
      widthPx: 600,
      heightPx: 400,
      cellW: 3.5,
      cellH: 5.5,
      fontSize: 5,
    };
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const widthPx = Math.max(240, Math.floor(rect.width || this.canvas.clientWidth || 600));
    const heightPx = Math.max(200, Math.floor(rect.height || this.canvas.clientHeight || 400));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(widthPx * dpr);
    this.canvas.height = Math.floor(heightPx * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ultra-dense micro-ASCII grid (~70-92 rows) for true 3D point-cloud detail
    const targetRows = clamp(Math.round(heightPx / 4.4), 68, 94);
    const cellH = heightPx / targetRows;
    const fontSize = clamp(Math.round(cellH * 0.94 * 10) / 10, 3.8, 8.2);

    this.ctx.font = `600 ${fontSize}px "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace`;
    const measuredW = this.ctx.measureText('M').width || fontSize * 0.6;
    const cellW = Math.max(2.3, measuredW * 0.95);

    const cols = Math.max(80, Math.floor(widthPx / cellW));
    const rows = Math.max(58, Math.floor(heightPx / cellH));

    this.metrics = { widthPx, heightPx, cellW, cellH, fontSize };
    if (this.grid.cols !== cols || this.grid.rows !== rows) {
      this.grid = createAsciiGrid(cols, rows);
    }
  }

  render(scene, sky, elapsedSec, rotationDeg) {
    const { widthPx, heightPx, cellW, cellH, fontSize } = this.metrics;
    const lettersCount = projectSceneToGrid(scene, this.grid, {
      elapsedSec,
      rotationDeg,
      widthPx,
      heightPx,
      cellW,
      cellH,
      sky,
    });

    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.render.skyColor;
    ctx.fillRect(0, 0, widthPx, heightPx);

    const { cols, rows, chars, colors, glow, glowColors } = this.grid;

    // Smooth radial light falloff (fades to 0% alpha at perimeter — never hard discs)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < rows; r++) {
      const cy = r * cellH + cellH * 0.5;
      const rowOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        const idx = rowOffset + c;
        const g = glow[idx];
        if (g <= 0.45) continue;
        const cx = c * cellW + cellW * 0.5;
        const radius = cellH * (1.2 + g * 1.4);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, glowColors[idx]);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.08 + g * 0.09;
        ctx.fillStyle = grad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
    }
    ctx.restore();

    ctx.font = `600 ${fontSize}px "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';

    let lastColor = '';
    for (let r = 0; r < rows; r++) {
      const y = r * cellH;
      const rowOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        const idx = rowOffset + c;
        const ch = chars[idx];
        if (ch === ' ') continue;
        const col = colors[idx];
        if (col !== lastColor) {
          ctx.fillStyle = col;
          lastColor = col;
        }
        ctx.fillText(ch, c * cellW, y);
      }
    }

    return lettersCount;
  }
}
