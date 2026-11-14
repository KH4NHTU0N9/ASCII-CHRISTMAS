import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSceneToAnimatedSvg, renderSceneToFlipbookSvg } from '../src/svgExporter.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT_DIR, 'assets', 'profile-tree.svg');

function parseArgs(argv) {
  const isStatic = argv.includes('--static');
  const opts = {
    outPath: DEFAULT_OUT,
    shotOut: null,
    shot2Out: null,
    verify: argv.includes('--verify'),
    isStatic,
    width: 820,
    height: 500,
    rows: isStatic ? 92 : 70,
    frames: 45,
    duration: 22.5,
    rotationDeg: 10,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) opts.outPath = path.resolve(argv[++i]);
    if (arg === '--shot-out' && argv[i + 1]) opts.shotOut = path.resolve(argv[++i]);
    if (arg === '--shot2-out' && argv[i + 1]) opts.shot2Out = path.resolve(argv[++i]);
    if (arg === '--rows' && argv[i + 1]) opts.rows = Number(argv[++i]);
    if (arg === '--frames' && argv[i + 1]) opts.frames = Number(argv[++i]);
    if (arg === '--duration' && argv[i + 1]) opts.duration = Number(argv[++i]);
    if (arg === '--rotation' && argv[i + 1]) opts.rotationDeg = Number(argv[++i]);
  }
  return opts;
}

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);

  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  throw new Error('Could not locate Chrome/Chromium executable for SVG verification.');
}

async function createCdpSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', (err) => reject(err.error || new Error('CDP WS failed')), {
      once: true,
    });
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  return {
    send,
    close() {
      ws.close();
    },
  };
}

async function verifySvgInChrome(svgContent, opts) {
  const chromeBin = findChromeBinary();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ascii-svg-verify-'));
  let chromeProc = null;

  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/profile-tree.svg')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
      res.end(svgContent);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><html><body style="margin:0;background:#0d1117;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img id="tree" src="/profile-tree.svg" width="${opts.width}" height="${opts.height}" alt="ASCII-CHRISTMAS"/></body></html>`
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    chromeProc = spawn(
      chromeBin,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    const debugPort = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome DevTools port timed out')), 10000);
      chromeProc.stderr.on('data', (chunk) => {
        const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(chunk.toString());
        if (m) {
          clearTimeout(timer);
          resolve(Number(m[1]));
        }
      });
    });

    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const target = pages.find((p) => p.type === 'page') || pages[0];
    const cdp = await createCdpSession(target.webSocketDebuggerUrl);

    try {
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: opts.width + 40,
        height: opts.height + 40,
        deviceScaleFactor: 2,
        mobile: false,
      });

      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });

      await cdp.send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `new Promise((resolve, reject) => {
          const check = () => {
            const img = document.getElementById('tree');
            if (img && img.complete && img.naturalWidth > 0) {
              resolve({ w: img.naturalWidth, h: img.naturalHeight });
            } else {
              setTimeout(check, 40);
            }
          };
          setTimeout(() => reject(new Error('Image load timeout')), 8000);
          check();
        })`,
      });

      const dims = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => { const img = document.getElementById('tree'); return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }; })()`,
      });

      await new Promise((r) => setTimeout(r, 150));
      const shotARes = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const waitMs = opts.isStatic ? 420 : Math.max(600, Math.round((opts.duration * 1000) / opts.frames) * 4);
      await new Promise((r) => setTimeout(r, waitMs));
      const shotBRes = await cdp.send('Page.captureScreenshot', { format: 'png' });

      const shotA = Buffer.from(shotARes.data, 'base64');
      const shotB = Buffer.from(shotBRes.data, 'base64');
      const animated = !shotA.equals(shotB);

      if (opts.shotOut) {
        fs.mkdirSync(path.dirname(opts.shotOut), { recursive: true });
        fs.writeFileSync(opts.shotOut, shotA);
      }
      if (opts.shot2Out) {
        fs.mkdirSync(path.dirname(opts.shot2Out), { recursive: true });
        fs.writeFileSync(opts.shot2Out, shotB);
      }

      if (!animated) {
        throw new Error('SVG rendered statically inside <img>; CSS keyframes did not advance frames.');
      }

      console.log(
        `Chrome <img> verify passed: natural=${dims.result.value.naturalWidth}x${dims.result.value.naturalHeight}, CSS animation active (${waitMs}ms frame delta verified)`
      );
    } finally {
      cdp.close();
    }
  } finally {
    server.close();
    if (chromeProc) chromeProc.kill('SIGKILL');
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const svg = opts.isStatic
    ? renderSceneToAnimatedSvg({
        width: opts.width,
        height: opts.height,
        rows: opts.rows,
        rotationDeg: opts.rotationDeg,
      })
    : renderSceneToFlipbookSvg({
        width: opts.width,
        height: opts.height,
        rows: opts.rows,
        frameCount: opts.frames,
        durationSec: opts.duration,
        startRotationDeg: opts.rotationDeg,
      });

  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  fs.writeFileSync(opts.outPath, svg, 'utf8');

  const bytes = Buffer.byteLength(svg, 'utf8');
  console.log(
    `Generated ${path.relative(ROOT_DIR, opts.outPath)} (${bytes} bytes / ${(bytes / 1048576).toFixed(2)} MB, mode=${opts.isStatic ? 'static' : `flipbook ${opts.frames}f/${opts.duration}s`}, rows=${opts.rows})`
  );

  if (opts.verify) {
    await verifySvgInChrome(svg, opts);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
