import { CONFIG } from './config.js';
import { clamp } from './math.js';
import { PART_KINDS } from './partsBuffer.js';
import { computePointShade } from './treeEngine.js';
import { renderSkyToGrid } from './skyParticles.js';

const RAMP = CONFIG.render.ramp;

/**
 * Creates or resizes a reusable ASCII character + Z-buffer grid.
 */
export function createAsciiGrid(cols, rows) {
  const len = Math.max(1, cols * rows);
  return {
    cols,
    rows,
    depth: new Float32Array(len),
    chars: new Array(len).fill(' '),
    colors: new Array(len).fill(''),
    glow: new Float32Array(len),
    glowColors: new Array(len).fill(''),
  };
}

function resetGrid(grid) {
  grid.depth.fill(1000);
  grid.chars.fill(' ');
  grid.colors.fill('');
  grid.glow.fill(0);
  grid.glowColors.fill('');
}

function glyphFromLuminance(lum, kind) {
  if (kind === PART_KINDS.LIGHT) return lum > 0.9 ? '@' : '*';
  if (kind === PART_KINDS.STAR) return lum > 0.95 ? '@' : '#';
  if (kind === PART_KINDS.GARLAND) return lum > 0.72 ? '*' : '+';
  if (kind === PART_KINDS.GROUND) {
    const idx = clamp(Math.floor(lum * 5.2), 1, 5);
    return RAMP[idx];
  }
  const idx = clamp(Math.floor(lum * (RAMP.length - 1)), 1, RAMP.length - 1);
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
    cellW = 6.5,
    cellH = 12,
    sky = null,
  } = {}
) {
  resetGrid(grid);

  const { cols, rows, depth, chars, colors, glow, glowColors } = grid;
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

  const scalePx = Math.min(heightPx, widthPx * 1.18) * 0.43;
  const centerX = widthPx * 0.5;
  const centerY = heightPx * 0.56;

  const { count, positions, normals, colors: pColors, kinds, t0, phase, shine } = scene;

  for (let i = 0; i < count; i++) {
    const pointT0 = t0[i];
    if (elapsedSec < pointT0) continue;

    const i3 = i * 3;
    const wx = positions[i3];
    const wy = positions[i3 + 1] - cameraTargetY;
    const wz = positions[i3 + 2];

    // Rotate around Y axis
    const rx = wx * cy + wz * sy;
    const rz = -wx * sy + wz * cy;

    // Tilt camera pitch around X axis
    const py = wy * cp - rz * sp;
    const pz = wy * sp + rz * cp;

    const zCam = cameraDist + pz;
    if (zCam <= 0.35) continue;

    const proj = focalScale / zCam;
    const sx = centerX + rx * proj * scalePx;
    const syScreen = centerY - py * proj * scalePx;

    const col = Math.floor(sx / cellW);
    const row = Math.floor(syScreen / cellH);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    const cellIdx = row * cols + col;
    if (zCam >= depth[cellIdx]) continue;

    // Rotate normal for directional lighting
    const nwx = normals[i3];
    const nwy = normals[i3 + 1];
    const nwz = normals[i3 + 2];
    const nrx = nwx * cy + nwz * sy;
    const nrz = -nwx * sy + nwz * cy;
    const nry = nwy * cp - nrz * sp;
    const nrzPitch = nwy * sp + nrz * cp;

    const kind = kinds[i];
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

    depth[cellIdx] = zCam;

    // Blend base albedo toward frost-white at growth frontier
    const baseR = pColors[i3];
    const baseG = pColors[i3 + 1];
    const baseB = pColors[i3 + 2];
    const shadeFactor = kind === PART_KINDS.LIGHT || kind === PART_KINDS.STAR
      ? Math.max(0.7, lum)
      : 0.32 + 0.85 * lum;

    const rLin = baseR * shadeFactor * (1 - birth * 0.72) + 0.96 * (birth * 0.72);
    const gLin = baseG * shadeFactor * (1 - birth * 0.72) + 0.98 * (birth * 0.72);
    const bLin = baseB * shadeFactor * (1 - birth * 0.72) + 1.0 * (birth * 0.72);

    const rr = clamp(Math.round(rLin * 255), 0, 255);
    const gg = clamp(Math.round(gLin * 255), 0, 255);
    const bb = clamp(Math.round(bLin * 255), 0, 255);

    const rgb = `rgb(${rr},${gg},${bb})`;
    chars[cellIdx] = birth > 0.35 ? '#' : glyphFromLuminance(lum, kind);
    colors[cellIdx] = rgb;

    if (kind === PART_KINDS.LIGHT || kind === PART_KINDS.STAR) {
      const intensity = kind === PART_KINDS.STAR ? 0.95 : clamp(lum - 0.25, 0, 1);
      if (intensity > glow[cellIdx]) {
        glow[cellIdx] = intensity;
        glowColors[cellIdx] = rgb;
      }
      if (kind === PART_KINDS.STAR || intensity > 0.65) {
        glow[cellIdx] = Math.max(glow[cellIdx], intensity);
      }
    }
  }

  // Sprinkle soft ASCII halo sparks onto adjacent empty background cells
  applyAsciiHalos(grid);

  if (sky) {
    renderSkyToGrid(sky, grid, elapsedSec);
  }

  // Count rendered non-space ASCII glyphs
  let lettersCount = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ' ') lettersCount++;
  }

  return lettersCount;
}

function applyAsciiHalos(grid) {
  const { cols, rows, depth, chars, colors, glow, glowColors } = grid;
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (let r = 1; r < rows - 1; r++) {
    const rowOff = r * cols;
    for (let c = 1; c < cols - 1; c++) {
      const idx = rowOff + c;
      const g = glow[idx];
      if (g < 0.52) continue;
      const colStr = glowColors[idx];
      for (let k = 0; k < 4; k++) {
        const nIdx = (r + offsets[k][1]) * cols + (c + offsets[k][0]);
        if (depth[nIdx] < 900 || chars[nIdx] !== ' ') continue;
        chars[nIdx] = g > 0.85 ? '+' : '·';
        colors[nIdx] = colStr;
      }
    }
  }
}

/**
 * Canvas 2D renderer wrapper that handles DPI scaling, font metrics, and drawing.
 */
export class AsciiCanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.grid = createAsciiGrid(80, 40);
    this.metrics = {
      widthPx: 600,
      heightPx: 400,
      cellW: 7,
      cellH: 13,
      fontSize: 12,
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

    // Choose monospace font size scaled smoothly to viewport height
    const fontSize = clamp(Math.round(Math.min(heightPx / 42, widthPx / 54)), 9, 14);
    this.ctx.font = `600 ${fontSize}px "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace`;
    const measuredW = this.ctx.measureText('M').width || fontSize * 0.6;
    const cellW = Math.max(5.2, measuredW * 1.02);
    const cellH = Math.max(9.5, Math.round(fontSize * 1.12));

    const cols = Math.max(32, Math.floor(widthPx / cellW));
    const rows = Math.max(20, Math.floor(heightPx / cellH));

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

    ctx.font = `600 ${fontSize}px "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';

    const { cols, rows, chars, colors, glow, glowColors } = this.grid;

    // Additive light bloom pass behind bright lights & apex star
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < rows; r++) {
      const cy = r * cellH + cellH * 0.5;
      const rowOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        const idx = rowOffset + c;
        const g = glow[idx];
        if (g <= 0.25) continue;
        const cx = c * cellW + cellW * 0.5;
        const radius = cellH * (0.9 + g * 1.15);
        ctx.globalAlpha = 0.08 + g * 0.14;
        ctx.fillStyle = glowColors[idx];
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    for (let r = 0; r < rows; r++) {
      const y = r * cellH;
      const rowOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        const idx = rowOffset + c;
        const ch = chars[idx];
        if (ch === ' ') continue;
        ctx.fillStyle = colors[idx];
        ctx.fillText(ch, c * cellW, y);
      }
    }

    return lettersCount;
  }
}
