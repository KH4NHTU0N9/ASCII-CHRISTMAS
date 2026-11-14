import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeAnimatedWebp } from '../src/webpMuxer.js';

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

const EXPORT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
  <style>
    html, body { margin: 0; padding: 0; background: #020308; overflow: hidden; }
    canvas { display: block; width: 760px; height: 440px; }
  </style>
</head>
<body>
  <canvas id="export-canvas"></canvas>
  <script type="module">
    import { CONFIG } from './src/config.js';
    import { buildTreeScene, computeTelemetry } from './src/treeEngine.js';
    import { createSkyParticles } from './src/skyParticles.js';
    import { createMagicSpiral } from './src/magicEffects.js';
    import { AsciiCanvasRenderer } from './src/asciiRenderer.js';

    const canvas = document.getElementById('export-canvas');
    const renderer = new AsciiCanvasRenderer(canvas);
    const scene = buildTreeScene();
    const sky = createSkyParticles(2026);
    const magicSpiral = createMagicSpiral(58, 99);

    function drawProfileBadge(ctx, widthPx, rotationText) {
      ctx.save();
      ctx.font = '500 11px "JetBrains Mono", Menlo, Consolas, monospace';
      const label = '@KH4NHTU0NG · 2026  ·  ' + rotationText;
      const textW = ctx.measureText(label).width;
      const padX = 11;
      const boxW = textW + padX * 2 + 14;
      const boxH = 24;
      const x = 14;
      const y = 12;

      ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f1c453';
      ctx.beginPath();
      ctx.arc(x + 12, y + boxH / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#d8dee9';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 21, y + boxH / 2 + 0.5);

      const hint = 'click for interactive 3D ↗';
      const hintW = ctx.measureText(hint).width;
      const hintBoxW = hintW + 20;
      const hx = widthPx - hintBoxW - 14;
      ctx.fillStyle = 'rgba(8, 12, 20, 0.65)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(hx, y, hintBoxW, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
      ctx.fillText(hint, hx + 10, y + boxH / 2 + 0.5);
      ctx.restore();
    }

    window.__EXPORT_API__ = {
      async ready() {
        await document.fonts.ready;
        renderer.resize();
        return renderer.metrics;
      },
      renderFrameWebp(elapsedSec, rotationDeg, quality = 0.78) {
        const lettersCount = renderer.render(scene, sky, elapsedSec, rotationDeg, {
          magicSpiral,
          lightMode: 'twinkle',
          zoom: 0.88,
          colorTheme: 'classic',
          glyphSet: 'ascii',
        });
        const tel = computeTelemetry(scene, elapsedSec, rotationDeg, lettersCount);
        drawProfileBadge(renderer.ctx, renderer.metrics.widthPx, tel.rotationText);
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
  const width = 760;
  const height = 440;
  const totalFrames = 90;
  const durationMs = 95; // 90 * 95ms = 8.55s full 360deg loop
  const quality = 0.78;
  const outPath = join(ROOT_DIR, 'assets', 'preview.webp');
  const samplePngPath = process.env.SAMPLE_PNG_OUT || '';

  const chromePath = findChromeBinary();
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
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await pageCdp.call('Page.navigate', {
      url: `http://127.0.0.1:${port}/_export.html`,
    });

    // Wait until window.__EXPORT_API__ is initialized and fonts are loaded
    for (let attempt = 0; attempt < 50; attempt++) {
      const check = await pageCdp.call('Runtime.evaluate', {
        expression: 'Boolean(window.__EXPORT_API__)',
        returnByValue: true,
      });
      if (check.result.value) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    await pageCdp.call('Runtime.evaluate', {
      expression: 'window.__EXPORT_API__.ready()',
      awaitPromise: true,
      returnByValue: true,
    });

    const frames = [];
    for (let i = 0; i < totalFrames; i++) {
      const rotationDeg = (i / totalFrames) * 360;
      const elapsedSec = 10.4 + i * (durationMs / 1000);
      const evalRes = await pageCdp.call('Runtime.evaluate', {
        expression: `window.__EXPORT_API__.renderFrameWebp(${elapsedSec.toFixed(4)}, ${rotationDeg.toFixed(4)}, ${quality})`,
        returnByValue: true,
      });
      const dataUrl = evalRes.result.value;
      const base64 = dataUrl.slice('data:image/webp;base64,'.length);
      frames.push(Buffer.from(base64, 'base64'));

      if (samplePngPath && i === 18) {
        const pngRes = await pageCdp.call('Runtime.evaluate', {
          expression: 'window.__EXPORT_API__.renderSamplePng()',
          returnByValue: true,
        });
        const pngB64 = pngRes.result.value.slice('data:image/png;base64,'.length);
        await writeFile(samplePngPath, Buffer.from(pngB64, 'base64'));
      }
    }

    const animWebp = encodeAnimatedWebp(frames, {
      width,
      height,
      durationMs,
      bgra: [0x08, 0x03, 0x02, 0xff],
      loopCount: 0,
    });

    await mkdir(join(ROOT_DIR, 'assets'), { recursive: true });
    await writeFile(outPath, animWebp);

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
    const verified = { ...verifyRes.result.value, animating: shotA !== shotB };

    console.log(
      JSON.stringify({
        output: outPath,
        bytes: animWebp.length,
        sizeMB: +(animWebp.length / (1024 * 1024)).toFixed(2),
        frames: frames.length,
        durationSec: +((frames.length * durationMs) / 1000).toFixed(2),
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
