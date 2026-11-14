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
    cameraPitchRad: 0.22,
    cameraDist: 3.6,
    cameraTargetY: 1.24,
    focalScale: 2.8,
  },
  audio: {
    // Set to './assets/music.mp3' after placing your MP3 in /assets,
    // or use the in-app MP3 picker / drag-and-drop.
    mp3Path: '',
    defaultVolume: 0.65,
    tempoBpm: 112,
  },
});
