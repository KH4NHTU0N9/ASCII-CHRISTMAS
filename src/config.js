/**
 * Centralized customization configuration for ASCII-CHRISTMAS.
 * Edit handle, greeting, fileLabel, or timing values to personalize the card.
 */
export const CONFIG = Object.freeze({
  identity: {
    handle: '@KH4NHTU0NG · 2026',
    greeting: 'Merry Christmas & Happy New Year',
    fileLang: 'js',
    fileName: 'treeEngine.js',
  },
  animation: {
    rotationSpeedDegPerSec: 18,
    targetFps: 30,
    buildDurationSec: 10.5,
    typingDurationSec: 19.5,
    birthFlashWindowSec: 0.6,
  },
  tree: {
    y0: 0.42,
    y1: 2.55,
    tiers: 24,
    lightCount: 170,
    seed: 7,
  },
  render: {
    ramp: ' .:-=+*#%@',
    skyColor: '#020308',
    cameraPitchRad: 0.24,
    cameraDist: 4.5,
    cameraTargetY: 1.18,
    focalScale: 2.15,
  },
  audio: {
    mp3Path: './assets/music.mp3',
    defaultVolume: 0.65,
    tempoBpm: 112,
  },
});
