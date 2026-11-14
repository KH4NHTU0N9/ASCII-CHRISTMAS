# ASCII-CHRISTMAS

Interactive 3D ASCII Christmas tree web experience built with pure HTML, CSS, JavaScript (ES Modules), and HTML5 Canvas 2D (`CanvasRenderingContext2D`), featuring progressive bottom-up tree construction, Z-buffered micro-ASCII lighting, falling snow, a live auto-typing code pane, and autoplay-compliant holiday music.

## Features

- **3D Point-Cloud ASCII Engine:**
  - Seeded deterministic geometry (`src/math.js`, `src/treeEngine.js`): snowy ground ripples, textured bark trunk, 24 whorls of drooping pine foliage & upper snowcaps, spiral golden tinsel garland, Fibonacci-sphere baubles, 170 staggered twinkling fairy lights, a 3D bevelled apex star, and wrapped gift boxes with bows.
  - Perspective Z-buffer rasterizer (`src/asciiRenderer.js`) with Lambertian + Blinn-Phong lighting, progressive frost-birth shimmer, ASCII halos, and additive light bloom.
  - Twinkling night starfield, northern aurora shimmer, shooting stars, and wind-swept falling snow (`src/skyParticles.js`, `src/magicEffects.js`).
- **Interactive Effects & Light Modes:**
  - Drag to orbit/tilt the 3D tree, scroll to zoom, and click/tap anywhere on the canvas to launch ASCII firework sparkle bursts (`src/magicEffects.js`).
  - Cycle 4 fairy-light animation modes (`Twinkle`, `Cascade`, `Warm Gold`, `Aurora`) with the `✦` button or `L` key.
- **Live Auto-Typing Code Pane:**
  - Displays the live `src/treeEngine.js` source code with syntax highlighting (`src/syntaxHighlighter.js`), line numbers, auto-scroll, and blinking red cursor synced to elapsed time (`src/codeTyper.js`).
  - Toggleable via the `</> Code` button or `C` key to expand the 3D tree viewport full screen.
- **Autoplay-Compliant Audio (`src/audioController.js`):**
  - Starts silently on page load in compliance with browser Autoplay policies.
  - Clicking `♪ Music`, the greeting pill, or pressing `M` starts playback using:
    1. Custom MP3 configured in `src/config.js` (`audio.mp3Path`) or loaded locally via the `MP3` file picker / drag-and-drop onto the viewport, or
    2. Built-in polyphonic Web Audio API holiday synthesizer (`src/audioSynth.js`) with zero external dependencies.

## Project Structure

```text
ASCII-CHRISTMAS/
├── index.html                  # Split-pane terminal layout & HUD
├── styles/
│   ├── main.css                # Responsive viewport, HUD bar & controls
│   └── editor.css              # Dark syntax highlighting & cursor styling
├── src/
│   ├── config.js               # Centralized customization (handle, greeting, timing)
│   ├── math.js                 # Mulberry32 PRNG, fibSphere, envelope, vector math
│   ├── partsBuffer.js          # Flat TypedArray 3D particle buffer
│   ├── builders/               # Modular geometry generators (ground..gifts)
│   ├── treeEngine.js           # Unified 3D scene builder & Blinn-Phong shading
│   ├── skyParticles.js         # Starfield & falling snow particle system
│   ├── asciiRenderer.js        # Z-buffered 3D-to-ASCII renderer & bloom pass
│   ├── audioSynth.js           # Web Audio API polyphonic holiday chime synth
│   ├── audioController.js      # MP3 loader, local file handler & synth fallback
│   ├── syntaxHighlighter.js    # Safe JS tokenizer & HTML escaper
│   ├── codeTyper.js            # Time-synced typing editor & auto-scroll
│   ├── codeSource.js           # Live HTTP source loader & offline fallback
│   └── main.js                 # Main requestAnimationFrame loop & controls
├── tests/                      # Automated Node.js unit test suite
├── docs/PLAN.md                # 5-Phase project execution plan
└── assets/                     # Optional custom MP3 folder (ignored by git)
```

## Customization

Edit [src/config.js](./src/config.js) to personalize:
- `identity.handle` (default: `@KH4NHTU0NG · 2026`)
- `identity.greeting` (default: `Merry Christmas & Happy New Year`)
- `audio.mp3Path` (e.g. `'./assets/music.mp3'` after placing your local MP3 in `assets/`)
- `animation.rotationSpeedDegPerSec`, `tree.tiers`, `tree.lightCount`, `tree.seed`

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `L` | Cycle fairy-light modes (Twinkle / Cascade / Warm Gold / Aurora) |
| `M` | Play / Pause holiday music |
| `R` | Replay progressive build & live code typing |
| `C` | Show / Hide bottom code pane |
| `Space` | Pause / Resume rotation and build animation |

## Running Locally & Testing

Start any static HTTP server from the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/` in your browser.

Run the automated test suite (Node.js 24+):

```bash
node --test tests/*.test.mjs
```

## References

- MDN Web Docs — *CanvasRenderingContext2D*: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
- MDN Web Docs — *Autoplay guide for media and Web Audio APIs*: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- GitHub Docs — *GitHub Acceptable Use Policies (Section 4)*: https://docs.github.com/site-policy/acceptable-use-policies/github-acceptable-use-policies#4-spam-and-inauthentic-activity-on-github
