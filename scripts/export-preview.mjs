import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { encodeAnimatedWebp } from '../src/webpMuxer.js';

const execFileAsync = promisify(execFile);
const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT_DIR = resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const DEFAULT_CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome',
  'chromium',
].filter(Boolean);

function findChromeBinary() {
  for (const candidate of DEFAULT_CHROME_PATHS) {
    if (candidate.startsWith('/') && existsSync(candidate)) {
      return candidate;
    }
  }
  return DEFAULT_CHROME_PATHS[0];
}

function findImg2WebpBinary() {
  const candidates = [
    process.env.IMG2WEBP_PATH,
    '/opt/homebrew/bin/img2webp',
    '/usr/local/bin/img2webp',
    '/usr/bin/img2webp',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const EXPORT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body { margin: 0; padding: 0; background: #020308; overflow: hidden; }
    canvas { display: block; width: 540px; height: 335px; }
  </style>
</head>
<body>
  <canvas id="export-canvas"></canvas>
  <script type="module">
    import { CONFIG } from './src/config.js';
    import { buildTreeScene } from './src/treeEngine.js';
    import { createSkyParticles } from './src/skyParticles.js';
    import { createMagicSpiral } from './src/magicEffects.js';
    import { AsciiCanvasRenderer } from './src/asciiRenderer.js';

    const canvas = document.getElementById('export-canvas');
    const renderer = new AsciiCanvasRenderer(canvas);
    const scene = buildTreeScene();
    const sky = createSkyParticles(2026);
    const exportStars = sky.stars.slice(0, 95);
    const exportSnow = sky.snow.filter((f) => f.u0 >= 0.22 && f.u0 <= 0.78).slice(0, 22);
    const magicSpiral = createMagicSpiral(58, 99);

    function drawBackgroundStars(ctx, grid, metrics) {
      const { cols, rows, depth } = grid;
      const { cellW, cellH, fontSize } = metrics;
      ctx.save();
      ctx.font = '600 ' + fontSize + 'px "JetBrains Mono", Menlo, Consolas, monospace';
      ctx.textBaseline = 'top';
      for (let i = 0; i < exportStars.length; i++) {
        const s = exportStars[i];
        const col = Math.floor(s.u * cols);
        const row = Math.floor(s.v * rows);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        if (depth[row * cols + col] < 900) continue;
        const v = Math.round(148 + 75 * s.bright);
        ctx.fillStyle = 'rgb(' + (v - 10) + ',' + (v - 2) + ',' + Math.min(255, v + 14) + ')';
        ctx.fillText(s.glyph, col * cellW, row * cellH);
      }
      ctx.restore();
    }

    function drawCompactSnow(ctx, metrics, elapsedSec, loopDurationSec) {
      const { widthPx, heightPx, fontSize } = metrics;
      const t = (elapsedSec % loopDurationSec) / loopDurationSec;
      ctx.save();
      ctx.font = '600 ' + fontSize + 'px "JetBrains Mono", Menlo, Consolas, monospace';
      ctx.textBaseline = 'top';
      for (let i = 0; i < exportSnow.length; i++) {
        const f = exportSnow[i];
        const cycles = i % 2 === 0 ? 1 : 2;
        const x = ((f.u0 + 0.015 * Math.sin(t * Math.PI * 2 + f.phase)) * widthPx);
        const y = (((f.v0 + t * cycles) % 1) * heightPx);
        const v = Math.round(195 + 48 * f.bright);
        ctx.fillStyle = 'rgb(' + (v - 8) + ',' + v + ',' + Math.min(255, v + 12) + ')';
        ctx.fillText(f.glyph, x, y);
      }
      ctx.restore();
    }

    function drawProfileBadge(ctx, widthPx, heightPx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, widthPx - 1, heightPx - 1, 10);
      ctx.stroke();

      ctx.font = '500 10px "JetBrains Mono", Menlo, Consolas, monospace';
      const label = CONFIG.identity.handle;
      const textW = ctx.measureText(label).width;
      const padX = 10;
      const boxW = textW + padX * 2 + 12;
      const boxH = 21;
      const x = 12;
      const y = 10;

      ctx.fillStyle = 'rgba(8, 12, 20, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f1c453';
      ctx.beginPath();
      ctx.arc(x + 10.5, y + boxH / 2, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 18, y + boxH / 2 + 0.5);

      const hint = 'interactive 3D ↗';
      const hintW = ctx.measureText(hint).width;
      const hintBoxW = hintW + 18;
      const hx = widthPx - hintBoxW - 12;
      ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.roundRect(hx, y, hintBoxW, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
      ctx.fillText(hint, hx + 9, y + boxH / 2 + 0.5);
      ctx.restore();
    }

    window.__EXPORT_API__ = {
      async ready(rows = 78) {
        await document.fonts.ready;
        renderer.resize(rows);
        return renderer.metrics;
      },
      renderFramePng(elapsedSec, rotationDeg, frameIdx, totalFrames, loopDurationSec) {
        renderer.render(scene, null, elapsedSec, rotationDeg, {
          magicSpiral,
          lightMode: 'twinkle',
          zoom: 0.91,
          colorTheme: 'classic',
          glyphSet: 'ascii',
        });
        drawBackgroundStars(renderer.ctx, renderer.grid, renderer.metrics);
        drawCompactSnow(renderer.ctx, renderer.metrics, frameIdx * (loopDurationSec / totalFrames), loopDurationSec);
        drawProfileBadge(renderer.ctx, renderer.metrics.widthPx, renderer.metrics.heightPx);
        return canvas.toDataURL('image/png');
      },
      renderFrameWebp(elapsedSec, rotationDeg, quality = 0.82) {
        renderer.render(scene, sky, elapsedSec, rotationDeg, {
          magicSpiral,
          lightMode: 'twinkle',
          zoom: 0.91,
          colorTheme: 'classic',
          glyphSet: 'ascii',
        });
        drawProfileBadge(renderer.ctx, renderer.metrics.widthPx, renderer.metrics.heightPx);
        return canvas.toDataURL('image/webp', quality);
      },
      renderSamplePng() {
        return canvas.toDataURL('image/png');
      },
    };
  </script>
</body>
</html>`;

function startStaticServer() {
  return new Promise((resolvePromise) => {
    const server = createServer(async (req, res) => {
      const reqPath = (req.url || '/').split('?')[0];
      if (reqPath === '/_export.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(EXPORT_HTML);
        return;
      }

      const safeRel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
      const fullPath = resolve(ROOT_DIR, safeRel);
      if (!fullPath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        const data = await readFile(fullPath);
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[extname(fullPath)] || 'application/octet-stream',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolvePromise({ server, port: addr.port });
    });
  });
}

function launchChrome(chromePath, userDataDir) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(
      chromePath,
      [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    let stderrBuf = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Timed out waiting for Chrome DevTools URL.\n${stderrBuf}`));
    }, 15000);

    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
      const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolvePromise({ proc, browserWsUrl: match[1] });
      }
    });

    proc.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early (${code}).\n${stderrBuf}`));
    });
  });
}

function createCdpClient(wsUrl) {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();

    ws.addEventListener('open', () => {
      resolvePromise({
        call(method, params = {}) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) {
          rej(new Error(`${msg.error.message} (${msg.error.code})`));
        } else {
          res(msg.result);
        }
      }
    });

    ws.addEventListener('error', (err) => reject(err));
  });
}

async function run() {
  const cssWidth = 540;
  const cssHeight = 335;
  const dpr = 2; // Native 1080x670 Retina pixels
  const rows = 78;
  const totalFrames = 72; // 5 deg per frame = smooth 360deg rotation
  const durationMs = 68; // ~14.7 FPS, 4.9s smooth orbit
  const loopDurationSec = (totalFrames * durationMs) / 1000;
  const outPath = join(ROOT_DIR, 'assets', 'preview.webp');
  const samplePngPath = process.env.SAMPLE_PNG_OUT || '';

  const chromePath = findChromeBinary();
  const img2webpPath = findImg2WebpBinary();
  const userDataDir = await mkdtemp(join(tmpdir(), 'ascii-xmas-chrome-'));
  const { server, port } = await startStaticServer();

  let chromeProc = null;
  let browserCdp = null;
  let pageCdp = null;

  try {
    const launched = await launchChrome(chromePath, userDataDir);
    chromeProc = launched.proc;
    browserCdp = await createCdpClient(launched.browserWsUrl);

    const { targetId } = await browserCdp.call('Target.createTarget', {
      url: 'about:blank',
    });
    const hostPort = new URL(launched.browserWsUrl).host;
    pageCdp = await createCdpClient(`ws://${hostPort}/devtools/page/${targetId}`);

    await pageCdp.call('Page.enable');
    await pageCdp.call('Runtime.enable');
    await pageCdp.call('Emulation.setDeviceMetricsOverride', {
      width: cssWidth,
      height: cssHeight,
      deviceScaleFactor: img2webpPath ? dpr : 1,
      mobile: false,
    });

    await pageCdp.call('Page.navigate', {
      url: `http://127.0.0.1:${port}/_export.html`,
    });

    for (let attempt = 0; attempt < 50; attempt++) {
      const check = await pageCdp.call('Runtime.evaluate', {
        expression: 'Boolean(window.__EXPORT_API__)',
        returnByValue: true,
      });
      if (check.result.value) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    await pageCdp.call('Runtime.evaluate', {
      expression: `window.__EXPORT_API__.ready(${img2webpPath ? rows : 64})`,
      awaitPromise: true,
      returnByValue: true,
    });

    await mkdir(join(ROOT_DIR, 'assets'), { recursive: true });

    if (img2webpPath) {
      const pngPaths = [];
      for (let i = 0; i < totalFrames; i++) {
        const rotationDeg = 10 + (i / totalFrames) * 360;
        const elapsedSec = 11.4 + i * (durationMs / 1000);
        const evalRes = await pageCdp.call('Runtime.evaluate', {
          expression: `window.__EXPORT_API__.renderFramePng(${elapsedSec.toFixed(4)}, ${rotationDeg.toFixed(4)}, ${i}, ${totalFrames}, ${loopDurationSec.toFixed(4)})`,
          returnByValue: true,
        });
        const dataUrl = evalRes.result.value;
        const pngBuf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
        const fp = join(userDataDir, `f_${String(i).padStart(3, '0')}.png`);
        await writeFile(fp, pngBuf);
        pngPaths.push(fp);
      }

      const args = [
        '-min_size',
        '-loop',
        '0',
        '-kmin',
        String(totalFrames),
        '-kmax',
        String(totalFrames),
        '-lossy',
        '-sharp_yuv',
        '-q',
        '75',
        '-m',
        '5',
      ];
      for (const fp of pngPaths) {
        args.push('-d', String(durationMs), fp);
      }
      args.push('-o', outPath);
      await execFileAsync(img2webpPath, args, { maxBuffer: 8 * 1024 * 1024 });
    } else {
      const frames = [];
      for (let i = 0; i < totalFrames; i++) {
        const rotationDeg = 10 + (i / totalFrames) * 360;
        const elapsedSec = 11.4 + i * (durationMs / 1000);
        const evalRes = await pageCdp.call('Runtime.evaluate', {
          expression: `window.__EXPORT_API__.renderFrameWebp(${elapsedSec.toFixed(4)}, ${rotationDeg.toFixed(4)}, 0.82)`,
          returnByValue: true,
        });
        const dataUrl = evalRes.result.value;
        const base64 = dataUrl.slice('data:image/webp;base64,'.length);
        frames.push(Buffer.from(base64, 'base64'));
      }
      const animWebp = encodeAnimatedWebp(frames, {
        width: cssWidth,
        height: cssHeight,
        durationMs,
        bgra: [0x08, 0x03, 0x02, 0xff],
        loopCount: 0,
      });
      await writeFile(outPath, animWebp);
    }

    const animWebpBuf = await readFile(outPath);

    // Verify saved animated WebP decodes and actively advances animation frames in Chrome compositor
    const verifyRes = await pageCdp.call('Runtime.evaluate', {
      expression: `new Promise((resolve, reject) => {
        const img = new Image();
        img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99;';
        img.onload = () => {
          requestAnimationFrame(() => resolve({
            ok: img.complete,
            width: img.naturalWidth,
            height: img.naturalHeight,
          }));
        };
        img.onerror = () => reject(new Error('Failed to decode preview.webp'));
        img.src = './assets/preview.webp?v=' + Date.now();
        document.body.appendChild(img);
      })`,
      awaitPromise: true,
      returnByValue: true,
    });
    const shotA = (await pageCdp.call('Page.captureScreenshot', { format: 'png' })).data;
    await new Promise((r) => setTimeout(r, 320));
    const shotB = (await pageCdp.call('Page.captureScreenshot', { format: 'png' })).data;
    if (samplePngPath) {
      await writeFile(samplePngPath, Buffer.from(shotB, 'base64'));
    }
    const verified = { ...verifyRes.result.value, animating: shotA !== shotB };

    console.log(
      JSON.stringify({
        output: outPath,
        encoder: img2webpPath ? 'img2webp-delta-retina' : 'webpMuxer-fallback',
        bytes: animWebpBuf.length,
        sizeMB: +(animWebpBuf.length / (1024 * 1024)).toFixed(2),
        frames: totalFrames,
        durationSec: +loopDurationSec.toFixed(2),
        verified,
      })
    );
  } finally {
    pageCdp?.close();
    browserCdp?.close();
    chromeProc?.kill('SIGKILL');
    server.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
