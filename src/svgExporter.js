import { CONFIG } from './config.js';
import { clamp, createRng } from './math.js';
import { PART_KINDS } from './partsBuffer.js';
import { createAsciiGrid, projectSceneToGrid } from './asciiRenderer.js';
import { createMagicSpiral } from './magicEffects.js';
import { createSkyParticles } from './skyParticles.js';
import { buildTreeScene } from './treeEngine.js';

const FONT_STACK =
  '"JetBrains Mono","Fira Code","SF Mono",Menlo,Consolas,"Liberation Mono",monospace';

/**
 * Escapes XML special characters for safe SVG text serialization.
 */
export function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Converts a CSS rgb(r,g,b) string into a compact lowercase hex color.
 */
export function rgbToHex(rgbStr) {
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(rgbStr);
  if (!m) return '#ffffff';
  const r = clamp(Number(m[1]), 0, 255);
  const g = clamp(Number(m[2]), 0, 255);
  const b = clamp(Number(m[3]), 0, 255);
  const hex =
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  if (hex[0] === hex[1] && hex[2] === hex[3] && hex[4] === hex[5]) {
    return `#${hex[0]}${hex[2]}${hex[4]}`;
  }
  return `#${hex}`;
}

/**
 * Computes exact screen-space coordinates for a 3D world point using
 * the same perspective camera transform as projectSceneToGrid.
 */
export function projectWorldPoint(
  worldPos,
  { rotationDeg, widthPx, heightPx, pitchOffset = 0, zoom = 1 }
) {
  const { cameraPitchRad, cameraDist, cameraTargetY, focalScale } = CONFIG.render;
  const yaw = (rotationDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const pitch = clamp(cameraPitchRad + pitchOffset, -0.35, 0.72);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const wx = worldPos[0];
  const wy = worldPos[1] - cameraTargetY;
  const wz = worldPos[2];

  const rx = wx * cy + wz * sy;
  const rz = -wx * sy + wz * cy;
  const py = wy * cp + rz * sp;
  const pz = -wy * sp + rz * cp;

  const zCam = cameraDist + pz;
  const proj = focalScale / Math.max(0.35, zCam);
  const scalePx = Math.min(heightPx, widthPx * 1.12) * 0.345 * zoom;

  return {
    x: widthPx * 0.5 + rx * proj * scalePx,
    y: heightPx * 0.49 - py * proj * scalePx,
    zCam,
  };
}

function classifyGlowGradient(rgbStr) {
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(rgbStr);
  if (!m) return 'gg';
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if (r > 235 && g > 235 && b > 205) return 'gw';
  if (r >= 200 && g >= 165 && b <= 165) return 'gg';
  if (r > g * 1.35 && r > b * 1.2) return 'gr';
  if (b > r * 1.25 && b >= g) return 'gb';
  if (g >= r && g >= b) return 'ge';
  return 'gg';
}

function fmt(n) {
  return Number(n.toFixed(1));
}

function isInHudZone(x, y, width) {
  if (y > 46) return false;
  return x < 205 || x > width - 178;
}

function buildRowRunsMarkup(grid, cellW, cellH, fontSize, { excludeKinds }) {
  const { cols, rows, kinds, chars, colors } = grid;
  const rowMarkup = [];
  const baselineOffset = fontSize * 0.88;

  for (let r = 0; r < rows; r++) {
    const rowOff = r * cols;
    const segments = [];
    let c = 0;

    while (c < cols) {
      const idx = rowOff + c;
      const ch = chars[idx];
      const kind = kinds[idx];
      if (ch === ' ' || excludeKinds.has(kind)) {
        c++;
        continue;
      }

      const startCol = c;
      const hex = rgbToHex(colors[idx]);
      let run = ch;
      c++;

      while (c < cols) {
        const nextIdx = rowOff + c;
        const nextCh = chars[nextIdx];
        const nextKind = kinds[nextIdx];
        if (nextCh === ' ' || excludeKinds.has(nextKind)) break;
        if (rgbToHex(colors[nextIdx]) !== hex) break;
        run += nextCh;
        c++;
      }

      segments.push(`<text x="${fmt(startCol * cellW)}" fill="${hex}">${escapeXml(run)}</text>`);
    }

    if (segments.length > 0) {
      const y = fmt(r * cellH + baselineOffset);
      rowMarkup.push(`<g transform="translate(0,${y})">${segments.join('')}</g>`);
    }
  }

  return rowMarkup.join('');
}

function buildInteractiveLayersMarkup(grid, cellW, cellH, fontSize) {
  const { cols, rows, kinds, chars, colors, glow, glowColors } = grid;
  const baselineOffset = fontSize * 0.88;

  const lightBuckets = Array.from({ length: 6 }, () => []);
  const starGlyphs = [];
  const garlandCells = [];
  const glowHalos = [];

  let minGarlandRow = rows;
  let maxGarlandRow = 0;

  for (let r = 0; r < rows; r++) {
    const rowOff = r * cols;
    const yText = fmt(r * cellH + baselineOffset);
    const cy = fmt(r * cellH + cellH * 0.5);

    for (let c = 0; c < cols; c++) {
      const idx = rowOff + c;
      const ch = chars[idx];
      if (ch === ' ') continue;

      const kind = kinds[idx];
      const x = fmt(c * cellW);
      const cx = fmt(c * cellW + cellW * 0.5);
      const hex = rgbToHex(colors[idx]);

      if (kind === PART_KINDS.LIGHT) {
        const bucket = (r * 7 + c * 13) % 6;
        lightBuckets[bucket].push(`<text x="${x}" y="${yText}" fill="${hex}">${escapeXml(ch)}</text>`);
        if (glow[idx] > 0.45) {
          const gId = classifyGlowGradient(glowColors[idx]);
          const rad = fmt(cellH * (1.1 + glow[idx] * 1.15));
          glowHalos.push({ cls: `tw${bucket}`, cx, cy, rad, gId });
        }
      } else if (kind === PART_KINDS.STAR) {
        starGlyphs.push(`<text x="${x}" y="${yText}" fill="${hex}">${escapeXml(ch)}</text>`);
        if (glow[idx] > 0.48 && (r + c) % 2 === 0) {
          const rad = fmt(cellH * (1.6 + glow[idx] * 1.4));
          glowHalos.push({ cls: 'star-g', cx, cy, rad, gId: 'gw' });
        }
      } else if (kind === PART_KINDS.GARLAND) {
        if (r < minGarlandRow) minGarlandRow = r;
        if (r > maxGarlandRow) maxGarlandRow = r;
        garlandCells.push({ r, x, yText, ch });
        if (glow[idx] > 0.62 && c % 2 === 0) {
          const rad = fmt(cellH * 1.45);
          glowHalos.push({ cls: 'rib-g', cx, cy, rad, gId: 'gg' });
        }
      } else if (glow[idx] > 0.55 && kind === PART_KINDS.CABIN && (r + c) % 2 === 0) {
        const rad = fmt(cellH * 1.6);
        glowHalos.push({ cls: 'hearth', cx, cy, rad, gId: 'gg' });
      }
    }
  }

  const garlandBands = Array.from({ length: 8 }, () => []);
  const garlandSpan = Math.max(1, maxGarlandRow - minGarlandRow);
  for (const cell of garlandCells) {
    // Band 0 sits near tree bottom, band 7 near apex so pulse climbs bottom -> top
    const normBottomUp = 1 - (cell.r - minGarlandRow) / garlandSpan;
    const band = clamp(Math.floor(normBottomUp * 8), 0, 7);
    garlandBands[band].push(
      `<text x="${cell.x}" y="${cell.yText}" fill="#fff1b8">${escapeXml(cell.ch)}</text>`
    );
  }

  const haloGroups = glowHalos
    .map(
      (h) =>
        `<circle class="${h.cls}" cx="${h.cx}" cy="${h.cy}" r="${h.rad}" fill="url(#${h.gId})"/>`
    )
    .join('');

  const lightsMarkup = lightBuckets
    .map((items, b) => (items.length ? `<g class="tw${b}">${items.join('')}</g>` : ''))
    .join('');

  const ribbonWaveMarkup = garlandBands
    .map((items, b) => (items.length ? `<g class="rw${b}">${items.join('')}</g>` : ''))
    .join('');

  const starMarkup = starGlyphs.length ? `<g class="star-p">${starGlyphs.join('')}</g>` : '';

  return { haloGroups, lightsMarkup, ribbonWaveMarkup, starMarkup };
}

function buildAtmosphereMarkup({ width, height, grid, cellW, cellH, fontSize, elapsedSec = 11.4 }) {
  const { cols, rows, chars } = grid;
  const baselineOffset = fontSize * 0.88;
  const sky = createSkyParticles(2026);

  // Subtle aurora shimmer only inside empty upper sky cells
  const auroraBuckets = [[], []];
  const auroraMaxRow = Math.floor(rows * 0.34);
  for (let r = 2; r < auroraMaxRow; r += 3) {
    const v = r / rows;
    const rowOff = r * cols;
    const y = fmt(r * cellH + baselineOffset);
    for (let c = 2; c < cols; c += 4) {
      const idx = rowOff + c;
      if (chars[idx] !== ' ') continue;
      const x = fmt(c * cellW);
      if (isInHudZone(x, y, width)) continue;

      const u = c / cols;
      const wave =
        Math.sin(u * 9.0 + elapsedSec * 0.45 + v * 4.5) *
        Math.cos(u * 5.2 - elapsedSec * 0.32);
      if (wave < 0.5) continue;

      const fade = (1 - v / 0.34) * ((wave - 0.5) / 0.5);
      const ar = Math.round(22 + 44 * fade);
      const ag = Math.round(78 + 108 * fade);
      const ab = Math.round(98 + 102 * fade);
      const hex = rgbToHex(`rgb(${ar},${ag},${ab})`);
      const glyph = fade > 0.54 ? '~' : '·';
      auroraBuckets[(r + c) % 2].push(`<text x="${x}" y="${y}" fill="${hex}">${glyph}</text>`);
    }
  }

  // Twinkling background starfield avoiding solid scene points & HUD badges
  const starBuckets = Array.from({ length: 5 }, () => []);
  for (let i = 0; i < sky.stars.length; i++) {
    const s = sky.stars[i];
    const col = Math.floor(s.u * cols);
    const row = Math.floor(s.v * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    if (chars[row * cols + col] !== ' ') continue;

    const x = fmt(col * cellW);
    const y = fmt(row * cellH + baselineOffset);
    if (isInHudZone(x, y, width)) continue;

    const v = Math.round(150 + 95 * s.bright);
    const hex = rgbToHex(`rgb(${v - 14},${v - 4},${Math.min(255, v + 12)})`);
    starBuckets[i % 5].push(`<text x="${x}" y="${y}" fill="${hex}">${escapeXml(s.glyph)}</text>`);
  }

  // Seamless wrapping parallax snow layers (primary + shifted tile at y - height)
  const snowFar = [];
  const snowNear = [];
  const snowRng = createRng(4049);
  for (let i = 0; i < 66; i++) {
    const x = fmt(snowRng.uniform(6, width - 10));
    const y = fmt(snowRng.uniform(8, height - 8));
    const glyph = i % 5 === 0 ? '*' : i % 2 === 0 ? '·' : '.';
    const isNear = i % 3 === 0;
    const col = isNear ? '#dbeafe' : '#8da2c6';
    const el = `<text x="${x}" y="${y}" fill="${col}">${glyph}</text>`;
    if (isNear) {
      snowNear.push(el);
    } else {
      snowFar.push(el);
    }
  }

  const auroraMarkup = auroraBuckets
    .map((items, idx) => (items.length ? `<g class="au${idx}">${items.join('')}</g>` : ''))
    .join('');

  const starsMarkup = starBuckets
    .map((items, idx) => (items.length ? `<g class="st${idx}">${items.join('')}</g>` : ''))
    .join('');

  const snowFarTile = snowFar.join('');
  const snowNearTile = snowNear.join('');
  const snowMarkup = `
    <g class="sn-far">
      <g>${snowFarTile}</g>
      <g transform="translate(0,${-height})">${snowFarTile}</g>
    </g>
    <g class="sn-near">
      <g>${snowNearTile}</g>
      <g transform="translate(0,${-height})">${snowNearTile}</g>
    </g>`;

  // Periodic diagonal shooting star streak in upper sky
  const meteorStartX = fmt(width * 0.16);
  const meteorStartY = fmt(height * 0.14);
  const meteorMarkup = `
    <g transform="translate(${meteorStartX},${meteorStartY})">
      <g class="meteor">
        <text x="0" y="0" fill="#ffffff">@</text>
        <text x="-4" y="-2.2" fill="#dbeafe">*</text>
        <text x="-8" y="-4.4" fill="#93c5fd">=</text>
        <text x="-12" y="-6.6" fill="#60a5fa">·</text>
      </g>
    </g>`;

  return auroraMarkup + starsMarkup + snowMarkup + meteorMarkup;
}

function buildChimneySmokeMarkup(chimneyScreen) {
  if (!chimneyScreen) return '';
  const glyphs = ['~', 's', '~', 's', '~', 's', '·'];
  const puffs = glyphs
    .map((g, idx) => {
      const cls = idx % 2 === 0 ? 'smkA' : 'smkB';
      const delay = -(idx * 0.54).toFixed(2);
      return `<text class="${cls}" x="0" y="0" fill="#dbeafe" style="animation-delay:${delay}s">${g}</text>`;
    })
    .join('');

  return `<g transform="translate(${fmt(chimneyScreen.x)},${fmt(chimneyScreen.y - 2)})">${puffs}</g>`;
}

/**
 * Exports the procedural 3D ASCII Christmas scene as a pure self-contained
 * vector SVG animated exclusively with CSS @keyframes (GitHub README/Camo safe).
 */
export function renderSceneToAnimatedSvg({
  width = 820,
  height = 500,
  rows = 92,
  elapsedSec = 11.4,
  rotationDeg = 10,
  colorTheme = 'classic',
  glyphSet = 'ascii',
  zoom = 0.99,
} = {}) {
  const targetRows = clamp(Math.round(rows), 64, 108);
  const cellH = height / targetRows;
  const fontSize = clamp(Math.round(cellH * 0.94 * 10) / 10, 3.8, 8.2);
  const cellW = Number((fontSize * 0.6).toFixed(3));
  const cols = Math.max(120, Math.floor(width / cellW));

  const scene = buildTreeScene();
  const grid = createAsciiGrid(cols, targetRows);
  const magicSpiral = createMagicSpiral();

  projectSceneToGrid(scene, grid, {
    elapsedSec,
    rotationDeg,
    widthPx: width,
    heightPx: height,
    cellW,
    cellH,
    sky: null,
    magicSpiral,
    lightMode: 'twinkle',
    zoom,
    colorTheme,
    glyphSet,
  });

  const excludeInteractive = new Set([PART_KINDS.LIGHT, PART_KINDS.STAR, -1, 255]);
  const treeBaseMarkup = buildRowRunsMarkup(grid, cellW, cellH, fontSize, {
    excludeKinds: excludeInteractive,
  });
  const { haloGroups, lightsMarkup, ribbonWaveMarkup, starMarkup } =
    buildInteractiveLayersMarkup(grid, cellW, cellH, fontSize);
  const atmosphereMarkup = buildAtmosphereMarkup({
    width,
    height,
    grid,
    cellW,
    cellH,
    fontSize,
    elapsedSec,
  });

  const chimneyScreen = scene.chimneyPos
    ? projectWorldPoint(
        [scene.chimneyPos[0], scene.chimneyPos[1] + 0.04, scene.chimneyPos[2]],
        { rotationDeg, widthPx: width, heightPx: height, zoom }
      )
    : null;
  const smokeMarkup = buildChimneySmokeMarkup(chimneyScreen);

  const css = `
    text {
      font-family: ${FONT_STACK};
      font-size: ${fontSize}px;
      font-weight: 600;
      font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "calt" 0;
    }
    .hud-txt {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.03em;
    }
    #smoke text {
      font-size: ${fmt(fontSize * 1.18)}px;
    }
    @keyframes twA { 0%,100% { opacity: .40; } 50% { opacity: 1; } }
    @keyframes twB { 0%,100% { opacity: .34; } 45% { opacity: 1; } 75% { opacity: .58; } }
    @keyframes starP { 0%,100% { opacity: .82; } 50% { opacity: 1; } }
    @keyframes starG { 0%,100% { opacity: .52; } 50% { opacity: .95; } }
    @keyframes ribWave { 0%,100% { opacity: .05; } 28%,38% { opacity: .92; } 60% { opacity: .10; } }
    @keyframes auPulse { 0%,100% { opacity: .32; } 50% { opacity: .82; } }
    @keyframes snowDown { 0% { transform: translate(0px, 0px); } 100% { transform: translate(18px, ${height}px); } }
    @keyframes meteorFly {
      0%,82% { opacity: 0; transform: translate(0px, 0px); }
      85% { opacity: 1; }
      95% { opacity: .88; transform: translate(188px, 65px); }
      100% { opacity: 0; transform: translate(220px, 78px); }
    }
    @keyframes smkA {
      0% { opacity: 0; transform: translate(0px, 0px); }
      20% { opacity: .86; transform: translate(-2.5px, -11px); }
      60% { opacity: .64; transform: translate(4.5px, -28px); }
      100% { opacity: 0; transform: translate(11px, -46px); }
    }
    @keyframes smkB {
      0% { opacity: 0; transform: translate(0px, 0px); }
      20% { opacity: .82; transform: translate(3px, -10px); }
      60% { opacity: .58; transform: translate(-1.5px, -27px); }
      100% { opacity: 0; transform: translate(8px, -44px); }
    }
    .tw0 { animation: twA 1.7s ease-in-out infinite; }
    .tw1 { animation: twB 2.3s ease-in-out -.6s infinite; }
    .tw2 { animation: twA 2.7s ease-in-out -1.1s infinite; }
    .tw3 { animation: twB 1.9s ease-in-out -1.5s infinite; }
    .tw4 { animation: twA 3.1s ease-in-out -.9s infinite; }
    .tw5 { animation: twB 2.5s ease-in-out -1.9s infinite; }
    .star-p { animation: starP 2.2s ease-in-out infinite; }
    .star-g { animation: starG 2.2s ease-in-out infinite; }
    .hearth { animation: twA 2.8s ease-in-out -.4s infinite; }
    .rib-g { animation: starP 3.2s ease-in-out infinite; }
    .rw0 { animation: ribWave 3.2s ease-in-out 0s infinite; }
    .rw1 { animation: ribWave 3.2s ease-in-out -.36s infinite; }
    .rw2 { animation: ribWave 3.2s ease-in-out -.72s infinite; }
    .rw3 { animation: ribWave 3.2s ease-in-out -1.08s infinite; }
    .rw4 { animation: ribWave 3.2s ease-in-out -1.44s infinite; }
    .rw5 { animation: ribWave 3.2s ease-in-out -1.80s infinite; }
    .rw6 { animation: ribWave 3.2s ease-in-out -2.16s infinite; }
    .rw7 { animation: ribWave 3.2s ease-in-out -2.52s infinite; }
    .st0 { animation: twA 2.9s ease-in-out infinite; }
    .st1 { animation: twB 3.7s ease-in-out -1.1s infinite; }
    .st2 { animation: twA 4.3s ease-in-out -2.2s infinite; }
    .st3 { animation: twB 3.1s ease-in-out -1.6s infinite; }
    .st4 { animation: twA 5.1s ease-in-out -.7s infinite; }
    .au0 { animation: auPulse 7s ease-in-out infinite; }
    .au1 { animation: auPulse 8.5s ease-in-out -3.4s infinite; }
    .sn-far { opacity: .48; animation: snowDown 14s linear infinite; }
    .sn-near { opacity: .82; animation: snowDown 9.2s linear -3.1s infinite; }
    .meteor { animation: meteorFly 6.4s ease-out infinite; }
    .smkA { animation: smkA 3.8s ease-out infinite; }
    .smkB { animation: smkB 3.8s ease-out infinite; }
  `.replace(/\s+/g, ' ').trim();

  const hudLeftLabel = escapeXml(CONFIG.identity.handle);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="ASCII-CHRISTMAS 3D Terminal Tree">
  <defs>
    <clipPath id="vp"><rect width="${width}" height="${height}" rx="12"/></clipPath>
    <radialGradient id="bg" cx="50%" cy="54%" r="64%">
      <stop offset="0%" stop-color="#060c1a"/>
      <stop offset="56%" stop-color="#03050d"/>
      <stop offset="100%" stop-color="${CONFIG.render.skyColor}"/>
    </radialGradient>
    <radialGradient id="gg"><stop offset="0%" stop-color="#ffe484" stop-opacity=".42"/><stop offset="45%" stop-color="#f59e0b" stop-opacity=".14"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="gr"><stop offset="0%" stop-color="#ff3b48" stop-opacity=".42"/><stop offset="45%" stop-color="#ef4444" stop-opacity=".14"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="ge"><stop offset="0%" stop-color="#32e875" stop-opacity=".40"/><stop offset="45%" stop-color="#22c55e" stop-opacity=".13"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="gb"><stop offset="0%" stop-color="#3daeff" stop-opacity=".42"/><stop offset="45%" stop-color="#3b82f6" stop-opacity=".14"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="gw"><stop offset="0%" stop-color="#fff7d6" stop-opacity=".55"/><stop offset="45%" stop-color="#fde047" stop-opacity=".18"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
    <style>${css}</style>
  </defs>
  <g clip-path="url(#vp)">
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <g id="sky">${atmosphereMarkup}</g>
    <g id="glows">${haloGroups}</g>
    <g id="tree">${treeBaseMarkup}</g>
    <g id="ribbon">${ribbonWaveMarkup}</g>
    <g id="lights">${lightsMarkup}${starMarkup}</g>
    <g id="smoke">${smokeMarkup}</g>
    <g id="hud">
      <rect x="16" y="14" width="166" height="24" rx="12" fill="#080e1c" fill-opacity=".82" stroke="#263656" stroke-width="1"/>
      <circle cx="29" cy="26" r="3" fill="#ffd970"/>
      <text class="hud-txt" x="39" y="30" fill="#cbd5e1">${hudLeftLabel}</text>
      <rect x="${width - 154}" y="14" width="138" height="24" rx="12" fill="#080e1c" fill-opacity=".82" stroke="#263656" stroke-width="1"/>
      <text class="hud-txt" x="${width - 140}" y="30" fill="#94a3b8">interactive 3D &#8599;</text>
    </g>
  </g>
  <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="12" fill="none" stroke="#1e293b" stroke-width="1"/>
</svg>`;
}
