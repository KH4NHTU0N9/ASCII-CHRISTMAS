import { CONFIG } from './config.js';
import { clamp } from './math.js';
import { PART_KINDS } from './partsBuffer.js';
import { computePointShade } from './treeEngine.js';
import { renderSkyToGrid } from './skyParticles.js';
import { renderChimneySmoke, renderMagicSpiral, renderShootingStars } from './magicEffects.js';

const RAMP = CONFIG.render.ramp;
const BINARY_RAMP = ' 00010111';
const MATH_RAMP = ' ·+-±×÷π∑∫∞';
const RGB_CACHE = new Map();

function applyColorTheme(baseR, baseG, baseB, kind, shineVal, colorTheme) {
  if (!colorTheme || colorTheme === 'classic') {
    return [baseR, baseG, baseB];
  }

  if (colorTheme === 'cyberpunk') {
    if (kind === PART_KINDS.NEEDLE) {
      return [0.08 + 0.14 * baseG, 0.52 + 0.42 * baseG, 0.78 + 0.2 * baseB];
    }
    if (kind === PART_KINDS.TRUNK) {
      return [0.42, 0.18, 0.58];
    }
    if (kind === PART_KINDS.GROUND) {
      return [0.34, 0.18, 0.68];
    }
    if (kind === PART_KINDS.GARLAND) {
      return [1.0, 0.28, 0.88];
    }
    if (kind === PART_KINDS.STAR) {
      return [0.38, 0.98, 1.0];
    }
    if (kind === PART_KINDS.CABIN) {
      if (shineVal > 0.6) return [1.0, 0.9, 0.28];
      if (baseB > 0.9) return [0.76, 0.72, 1.0];
      return [0.46, 0.2, 0.62];
    }
    if (kind === PART_KINDS.SNOWMAN) {
      return baseR > 0.85 && baseG < 0.35 ? [1.0, 0.2, 0.82] : [0.76, 0.84, 1.0];
    }
    if (kind === PART_KINDS.LIGHT || kind === PART_KINDS.BALL || kind === PART_KINDS.GIFT || kind === PART_KINDS.RIBBON) {
      if (baseR > baseG && baseR > baseB) return [1.0, 0.2, 0.76];
      if (baseG > baseR && baseG >= baseB) return [0.24, 1.0, 0.68];
      return [0.18, 0.94, 1.0];
    }
    return [baseR, baseG, baseB];
  }

  if (colorTheme === 'frozen') {
    if (kind === PART_KINDS.NEEDLE) {
      return [0.2 + 0.24 * baseG, 0.66 + 0.24 * baseG, 0.96];
    }
    if (kind === PART_KINDS.TRUNK) {
      return [0.32, 0.44, 0.62];
    }
    if (kind === PART_KINDS.GROUND) {
      return [0.56, 0.82, 1.0];
    }
    if (kind === PART_KINDS.GARLAND) {
      return [0.76, 0.94, 1.0];
    }
    if (kind === PART_KINDS.STAR) {
      return [0.84, 0.97, 1.0];
    }
    if (kind === PART_KINDS.CABIN) {
      if (shineVal > 0.6) return [1.0, 0.88, 0.65];
      if (baseB > 0.9) return [0.88, 0.97, 1.0];
      return [0.36, 0.48, 0.68];
    }
    if (kind === PART_KINDS.SNOWMAN) {
      return baseR > 0.85 && baseG < 0.35 ? [0.42, 0.78, 1.0] : [0.9, 0.97, 1.0];
    }
    if (kind === PART_KINDS.LIGHT || kind === PART_KINDS.BALL || kind === PART_KINDS.GIFT || kind === PART_KINDS.RIBBON) {
      if (baseR > baseG && baseR > baseB) return [0.58, 0.76, 1.0];
      if (baseG > baseR) return [0.38, 0.94, 1.0];
      return [0.86, 0.96, 1.0];
    }
  }

  return [baseR, baseG, baseB];
}

function getQuantizedRgb(rLin, gLin, bLin) {
  const rr = clamp(Math.round(clamp(rLin, 0, 1) * 255), 0, 255) & 0xfc;
  const gg = clamp(Math.round(clamp(gLin, 0, 1) * 255), 0, 255) & 0xfc;
  const bb = clamp(Math.round(clamp(bLin, 0, 1) * 255), 0, 255) & 0xfc;
  const key = (rr << 16) | (gg << 8) | bb;
  let str = RGB_CACHE.get(key);
  if (!str) {
    str = `rgb(${rr},${gg},${bb})`;
    RGB_CACHE.set(key, str);
  }
  return { str, rr, gg, bb };
}

function resolveLightTint(baseR, baseG, baseB, lightMode, elapsedSec, t0) {
  if (lightMode === 'warm') {
    return [1.0, 0.88, 0.48];
  }
  if (lightMode === 'aurora') {
    const wave = 0.5 + 0.5 * Math.sin(elapsedSec * 2.2 + t0 * 1.4);
    return [0.3 + 0.55 * wave, 0.92, 0.98 - 0.32 * wave];
  }
  return [baseR, baseG, baseB];
}

/**
 * Creates or resizes a reusable ASCII character + Z-buffer grid.
 */
export function createAsciiGrid(cols, rows) {
  const len = Math.max(1, cols * rows);
  return {
    cols,
    rows,
    depth: new Float32Array(len).fill(1000),
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

function glyphFromLuminance(lum, kind, glyphSet = 'ascii') {
  if (glyphSet === 'binary') {
    if (kind === PART_KINDS.LIGHT || kind === PART_KINDS.STAR) {
      return lum > 0.82 ? '1' : '0';
    }
    if (kind === PART_KINDS.GARLAND) {
      return lum > 0.9 ? '1' : '0';
    }
    if (kind === PART_KINDS.GROUND) {
      return lum > 0.6 ? '1' : '0';
    }
    const idx = clamp(Math.floor(lum * (BINARY_RAMP.length - 1)), 1, BINARY_RAMP.length - 1);
    return BINARY_RAMP[idx];
  }

  if (glyphSet === 'math') {
    if (kind === PART_KINDS.LIGHT) return lum > 0.9 ? '∞' : '×';
    if (kind === PART_KINDS.STAR) return lum > 0.95 ? '∑' : '∞';
    if (kind === PART_KINDS.GARLAND) return lum > 1.15 ? '∞' : lum > 0.8 ? '∑' : '±';
    if (kind === PART_KINDS.GROUND) {
      const groundMath = ' ·+-±×';
      const idx = clamp(Math.floor(lum * (groundMath.length - 1)), 1, groundMath.length - 1);
      return groundMath[idx];
    }
    const idx = clamp(Math.floor(lum * 1.02 * (MATH_RAMP.length - 1)), 1, MATH_RAMP.length - 1);
    return MATH_RAMP[idx];
  }

  if (kind === PART_KINDS.LIGHT) return lum > 0.9 ? '@' : '*';
  if (kind === PART_KINDS.STAR) return lum > 0.95 ? '@' : '#';
  if (kind === PART_KINDS.GARLAND) return lum > 1.24 ? '@' : lum > 0.84 ? '*' : '+';
  if (kind === PART_KINDS.GROUND) {
    const groundRamp = ' .·:;-=+';
    const idx = clamp(Math.floor(lum * (groundRamp.length - 1)), 1, groundRamp.length - 1);
    return groundRamp[idx];
  }
  const idx = clamp(Math.floor(lum * 1.05 * (RAMP.length - 1)), 1, RAMP.length - 1);
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
    magicSpiral = null,
    bursts = null,
    lightMode = 'twinkle',
    pitchOffset = 0,
    zoom = 1,
    colorTheme = 'classic',
    glyphSet = 'ascii',
    cursor = null,
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
  const pitch = clamp(cameraPitchRad + pitchOffset, -0.35, 0.72);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const scalePx = Math.min(heightPx, widthPx * 1.12) * 0.345 * zoom;
  const centerX = widthPx * 0.5;
  const centerY = heightPx * 0.49;

  const hasCursor = Boolean(cursor && cursor.active);
  const cursorX = hasCursor ? cursor.u * widthPx : 0;
  const cursorY = hasCursor ? cursor.v * heightPx : 0;
  const hoverRadius = Math.min(widthPx, heightPx) * 0.14;
  const hoverRadiusSq = hoverRadius * hoverRadius;

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
    const py = wy * cp + rz * sp;
    const pz = -wy * sp + rz * cp;

    const zCam = cameraDist + pz;
    if (zCam <= 0.35) continue;

    const proj = focalScale / zCam;
    let sx = centerX + rx * proj * scalePx;
    let syScreen = centerY - py * proj * scalePx;

    const kind = kinds[i];
    let hoverBoost = 0;
    if (hasCursor) {
      const dx = sx - cursorX;
      const dy = syScreen - cursorY;
      const d2 = dx * dx + dy * dy;
      if (d2 < hoverRadiusSq) {
        const dist = Math.sqrt(d2);
        const falloff = 1 - dist / hoverRadius;
        hoverBoost = falloff * falloff;
        const repelPx =
          hoverBoost * (kind === PART_KINDS.GROUND ? 5.5 : 13.5);
        if (dist > 0.5) {
          sx += (dx / dist) * repelPx;
          syScreen += (dy / dist) * repelPx;
        } else {
          sx += (i % 2 === 0 ? 1 : -1) * repelPx;
          syScreen -= repelPx * 0.7;
        }
      }
    }

    const col = Math.floor(sx / cellW);
    const row = Math.floor(syScreen / cellH);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

    let zBias = 0;
    if (kind === PART_KINDS.LIGHT) {
      zBias = 0.09;
    } else if (
      kind === PART_KINDS.BALL ||
      kind === PART_KINDS.GARLAND ||
      kind === PART_KINDS.STAR
    ) {
      zBias = 0.04;
    } else if (
      kind === PART_KINDS.GIFT ||
      kind === PART_KINDS.RIBBON ||
      kind === PART_KINDS.CABIN ||
      kind === PART_KINDS.SNOWMAN
    ) {
      zBias = 0.025;
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

    const shade = computePointShade(
      nrx,
      nry,
      nrzPitch,
      shine[i],
      kind,
      elapsedSec,
      pointT0,
      phase[i],
      lightMode
    );
    const lum = hoverBoost > 0 ? clamp(shade.lum + hoverBoost * 0.85, 0.28, 1.75) : shade.lum;
    const birth = shade.birth;

    depth[cellIdx] = zEffective;
    cellKinds[cellIdx] = kind;

    let baseR = pColors[i3];
    let baseG = pColors[i3 + 1];
    let baseB = pColors[i3 + 2];
    if (colorTheme && colorTheme !== 'classic') {
      [baseR, baseG, baseB] = applyColorTheme(baseR, baseG, baseB, kind, shine[i], colorTheme);
    }
    if (kind === PART_KINDS.LIGHT) {
      [baseR, baseG, baseB] = resolveLightTint(baseR, baseG, baseB, lightMode, elapsedSec, pointT0);
    }

    const shadeFactor =
      kind === PART_KINDS.LIGHT || kind === PART_KINDS.STAR
        ? Math.max(0.75, lum)
        : 0.25 + 0.92 * lum;

    const flashMix = clamp(birth * 0.72 + hoverBoost * 0.34, 0, 0.82);
    let rLin = baseR * shadeFactor * (1 - flashMix) + 0.96 * flashMix;
    let gLin = baseG * shadeFactor * (1 - flashMix) + 0.98 * flashMix;
    let bLin = baseB * shadeFactor * (1 - flashMix) + 1.0 * flashMix;

    if (kind === PART_KINDS.GARLAND && lum > 0.85) {
      const crestBoost = clamp((lum - 0.85) * 0.9, 0, 0.35);
      rLin = Math.min(1, rLin + 0.25 * crestBoost);
      gLin = Math.min(1, gLin + 0.22 * crestBoost);
      bLin = Math.min(1, bLin + 0.12 * crestBoost);
    }

    const { str, rr, gg, bb } = getQuantizedRgb(rLin, gLin, bLin);
    chars[cellIdx] =
      birth > 0.35
        ? glyphSet === 'binary'
          ? '1'
          : '#'
        : glyphFromLuminance(lum, kind, glyphSet);
    colors[cellIdx] = str;
    rgbPacked[cellIdx] = (rr << 16) | (gg << 8) | bb;

    if (
      kind === PART_KINDS.LIGHT ||
      kind === PART_KINDS.STAR ||
      hoverBoost > 0.35
    ) {
      let intensity = 0;
      if (kind === PART_KINDS.STAR) intensity = i % 6 === 0 ? 0.62 : 0.34;
      else if (kind === PART_KINDS.LIGHT) intensity = clamp(lum - 0.22, 0, 0.88);
      else intensity = clamp(0.46 + hoverBoost * 0.28, 0.46, 0.72);
      if (intensity > glow[cellIdx]) {
        glow[cellIdx] = intensity;
        glowColors[cellIdx] = str;
      }
    }
  }

  // Ascending 3D golden/cyan magic spiral particles
  if (magicSpiral) {
    renderMagicSpiral(magicSpiral, grid, {
      elapsedSec,
      rotationDeg,
      widthPx,
      heightPx,
      cellW,
      cellH,
      pitchOffset,
      zoom,
    });
  }

  // Gentle curling ASCII smoke rising from the cabin chimney
  if (scene.chimneyPos) {
    renderChimneySmoke(scene.chimneyPos, grid, {
      elapsedSec,
      rotationDeg,
      widthPx,
      heightPx,
      cellW,
      cellH,
      pitchOffset,
      zoom,
    });
  }

  // Warm colored light bounce onto neighboring cells & empty halo sparks
  applyAsciiLightBounce(grid);

  if (sky) {
    renderSkyToGrid(sky, grid, elapsedSec);
  }

  renderShootingStars(grid, elapsedSec);

  if (bursts) {
    bursts.render(grid);
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
 * Canvas 2D renderer wrapper with Retina DPI scaling, micro-ASCII grid,
 * luminous midnight atmosphere backdrop, and smooth radial glow falloff.
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

  render(scene, sky, elapsedSec, rotationDeg, options = {}) {
    const { widthPx, heightPx, cellW, cellH, fontSize } = this.metrics;
    const lettersCount = projectSceneToGrid(scene, this.grid, {
      elapsedSec,
      rotationDeg,
      widthPx,
      heightPx,
      cellW,
      cellH,
      sky,
      ...options,
    });

    const ctx = this.ctx;

    const themeMode = options.colorTheme || 'classic';
    if (themeMode === 'cyberpunk' || themeMode === 'frozen') {
      const bgStops =
        themeMode === 'cyberpunk'
          ? ['#0d051a', '#05020d', '#020107']
          : ['#061423', '#030a14', '#020308'];
      const bgGrad = ctx.createRadialGradient(
        widthPx * 0.5,
        heightPx * 0.54,
        10,
        widthPx * 0.5,
        heightPx * 0.54,
        Math.max(widthPx, heightPx) * 0.65
      );
      bgGrad.addColorStop(0, bgStops[0]);
      bgGrad.addColorStop(0.55, bgStops[1]);
      bgGrad.addColorStop(1, bgStops[2]);
      ctx.fillStyle = bgGrad;
    } else {
      ctx.fillStyle = CONFIG.render.skyColor;
    }
    ctx.fillRect(0, 0, widthPx, heightPx);

    const { cols, rows, chars, colors, glow, glowColors } = this.grid;

    // Subtle pinpoint radial light falloff (fades smoothly to 0% alpha — never blows out white)
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
        const radius = cellH * (1.05 + g * 1.15);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, glowColors[idx]);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.055 + g * 0.075;
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
