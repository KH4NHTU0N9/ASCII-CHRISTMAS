import { CONFIG } from './config.js';
import { buildTreeScene, computeTelemetry } from './treeEngine.js';
import { createSkyParticles } from './skyParticles.js';
import { AsciiCanvasRenderer } from './asciiRenderer.js';
import { AudioController } from './audioController.js';
import { CodeTyper } from './codeTyper.js';
import { FALLBACK_SOURCE, loadLiveCodeSource } from './codeSource.js';

function getDomRefs() {
  return {
    shell: document.getElementById('app-shell'),
    canvas: document.getElementById('ascii-canvas'),
    greetingBadge: document.getElementById('greeting-badge'),
    greetingText: document.getElementById('greeting-text'),
    hudTime: document.getElementById('hud-time'),
    hudHandle: document.getElementById('hud-handle'),
    hudRotation: document.getElementById('hud-rotation'),
    hudLights: document.getElementById('hud-lights'),
    hudLetters: document.getElementById('hud-letters'),
    hudLang: document.getElementById('hud-lang'),
    hudFilename: document.getElementById('hud-filename'),
    hudFps: document.getElementById('hud-fps'),
    btnMusic: document.getElementById('btn-music'),
    musicLabel: document.getElementById('music-label'),
    btnMp3: document.getElementById('btn-mp3'),
    mp3Input: document.getElementById('mp3-input'),
    btnReplay: document.getElementById('btn-replay'),
    btnToggleCode: document.getElementById('btn-toggle-code'),
    codeScroller: document.getElementById('code-scroller'),
    dropOverlay: document.getElementById('drop-overlay'),
  };
}

async function bootstrap() {
  const dom = getDomRefs();

  // Populate identity labels from centralized config
  dom.hudHandle.textContent = CONFIG.identity.handle;
  dom.greetingText.textContent = `${CONFIG.identity.greeting} · Tap for Music`;
  dom.hudLang.textContent = CONFIG.identity.fileLang;
  dom.hudFilename.textContent = CONFIG.identity.fileName;

  const scene = buildTreeScene();
  const sky = createSkyParticles(2026);
  const renderer = new AsciiCanvasRenderer(dom.canvas);
  const typer = new CodeTyper(
    dom.codeScroller,
    FALLBACK_SOURCE,
    CONFIG.animation.typingDurationSec
  );

  // Load real live treeEngine.js content when served over HTTP
  loadLiveCodeSource().then((liveText) => {
    typer.setSource(liveText);
  });

  const audio = new AudioController(({ playing, trackName }) => {
    dom.btnMusic.classList.toggle('is-active', playing);
    dom.greetingBadge.classList.toggle('is-playing', playing);
    dom.musicLabel.textContent = playing ? 'Playing' : 'Music';
    dom.greetingText.textContent = playing
      ? `${CONFIG.identity.greeting} · ♪ ${trackName}`
      : `${CONFIG.identity.greeting} · Tap for Music`;
  });

  let startTs = performance.now();
  let fpsWindowStart = startTs;
  let fpsFrames = 0;
  let currentFps = CONFIG.animation.targetFps;

  function replay() {
    startTs = performance.now();
    typer.reset();
  }

  function toggleCodePane() {
    const hidden = dom.shell.classList.toggle('code-hidden');
    dom.btnToggleCode.classList.toggle('is-active', !hidden);
    requestAnimationFrame(() => renderer.resize());
  }

  dom.btnMusic.addEventListener('click', () => audio.toggle());
  dom.greetingBadge.addEventListener('click', () => audio.toggle());
  dom.btnReplay.addEventListener('click', replay);
  dom.btnToggleCode.addEventListener('click', toggleCodePane);
  dom.btnMp3.addEventListener('click', () => dom.mp3Input.click());

  dom.mp3Input.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) audio.loadLocalFile(file);
  });

  const resizeObserver = new ResizeObserver(() => renderer.resize());
  resizeObserver.observe(dom.canvas);

  function tick(now) {
    const elapsedSec = (now - startTs) / 1000;
    const rotationDeg = elapsedSec * CONFIG.animation.rotationSpeedDegPerSec;

    const lettersCount = renderer.render(scene, sky, elapsedSec, rotationDeg);
    typer.update(elapsedSec);

    fpsFrames++;
    const fpsSpan = now - fpsWindowStart;
    if (fpsSpan >= 500) {
      currentFps = Math.max(1, Math.round((fpsFrames * 1000) / fpsSpan));
      fpsFrames = 0;
      fpsWindowStart = now;
    }

    const telemetry = computeTelemetry(scene, elapsedSec, rotationDeg, lettersCount);
    dom.hudTime.textContent = telemetry.timeText;
    dom.hudRotation.textContent = telemetry.rotationText;
    dom.hudLights.textContent = String(telemetry.lightsCount);
    dom.hudLetters.textContent = telemetry.lettersText;
    dom.hudFps.textContent = `running · ${currentFps} fps`;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return { replay, toggleCodePane, audio, renderer };
}

bootstrap();
