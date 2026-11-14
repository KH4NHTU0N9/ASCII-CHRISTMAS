# ASCII-CHRISTMAS

<p align="center">
  <a href="https://kh4nhtu0n9.github.io/ASCII-CHRISTMAS/" title="Open interactive 3D ASCII Christmas Tree">
    <img src="./assets/profile-tree.svg" alt="ASCII-CHRISTMAS 3D Terminal Tree" width="800" />
  </a>
</p>

Interactive 3D ASCII Christmas tree web experience built with pure HTML, CSS, JavaScript (ES Modules), and HTML5 Canvas 2D (`CanvasRenderingContext2D`), featuring progressive bottom-up tree construction, Z-buffered micro-ASCII lighting, falling snow, a live auto-typing code pane, and autoplay-compliant holiday music.

## Features

- **3D Point-Cloud ASCII Engine:**
  - Seeded deterministic geometry (`src/math.js`, `src/treeEngine.js`): snowy ground ripples, textured bark trunk, 24 whorls of drooping pine foliage & upper snowcaps, upward-pulsing spiral golden tinsel garland (`src/builders/garland.js`), Fibonacci-sphere baubles, 170 staggered twinkling fairy lights, 3D bevelled apex star, wrapped gift boxes with bows, and a cozy village edge featuring a snow-topped wooden cabin (glowing hearth windows + chimney) and 3D snowman (`src/builders/village.js`).
  - Perspective Z-buffer rasterizer (`src/asciiRenderer.js`) with Lambertian + Blinn-Phong lighting, progressive frost-birth shimmer, ASCII halos, and additive light bloom.
  - Twinkling night starfield, northern aurora shimmer, shooting stars, falling snow (`src/skyParticles.js`), rising helical stardust, and gentle curling ASCII chimney smoke (`~`, `s`) in `src/magicEffects.js`.
- **Interactive Camera, Hover & Customization UI:**
  - Drag to orbit/tilt the 3D tree, scroll to zoom closely (`0.6x–2.8x`) into individual ASCII glyphs on gifts/foliage, double-click to reset view, move pointer over the tree to gently part (`repel`) and brighten nearby particles, and click/tap anywhere to launch ASCII firework sparkle bursts.
  - **Quick Control Panel (`P` / `⚙ Tune`):** Instantly switch color themes (`Classic`, `Cyberpunk Neon`, `Frozen Ice Blue`), switch ASCII glyph sets (`ASCII`, `Binary 0/1`, `Math ∑∞`), toggle `Auto-Rotate`, or reset the camera.
  - **Zen Mode (`H` / `⛶ Zen`, `Esc` to exit):** Hides the code pane, HUD bar, and corner telemetry for an unobstructed fullscreen tree view ideal for enjoying or recording video.
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
│   ├── svgExporter.js          # Crisp vector SVG + pure CSS 60fps generator
│   └── main.js                 # Main requestAnimationFrame loop & controls
├── scripts/
│   ├── export-svg.mjs          # Generates assets/profile-tree.svg (+ Chrome check)
│   └── export-preview.mjs      # Optional raster 360° WebP banner exporter
├── tests/                      # Automated Node.js unit test suite
├── docs/PLAN.md                # 5-Phase project execution plan
└── assets/                     # Profile SVG/WebP assets & optional local MP3s
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
| `P` | Toggle Quick Control Panel (Color Themes, Glyph Sets, Auto-Rotate) |
| `H` | Toggle Fullscreen Zen Mode (`Esc` also exits Zen / closes Panel) |
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

### Embed on Your GitHub Profile (`KH4NHTU0N9/KH4NHTU0N9`)

1. Ensure **GitHub Pages** is active in repository **Settings -> Pages** (`Deploy from a branch` -> `main` -> `/ (root)`).
2. Add this snippet to your Profile `README.md` (uses the ultra-crisp 70-row, 45-angle slow-rotating 3D vector SVG flipbook with pure CSS `@keyframes`, zero blur on Retina displays):

```markdown
<p align="center">
  <a href="https://kh4nhtu0n9.github.io/ASCII-CHRISTMAS/" title="Click to open interactive 3D ASCII Christmas Tree">
    <img src="https://raw.githubusercontent.com/KH4NHTU0N9/ASCII-CHRISTMAS/main/assets/profile-tree.svg?v=2" alt="3D ASCII Christmas Tree" width="800" />
  </a>
</p>
```

Regenerate the slow-rotating 3D SVG flipbook (or pass `--static` for a single 92-row frame) and verify CSS animations in Chrome:

```bash
node scripts/export-svg.mjs --verify
node scripts/export-preview.mjs
```

Run the automated test suite (Node.js 24+):

```bash
node --test tests/*.test.mjs
```

## References

- MDN Web Docs — *CanvasRenderingContext2D*: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
- MDN Web Docs — *Autoplay guide for media and Web Audio APIs*: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- GitHub Docs — *GitHub Acceptable Use Policies (Section 4)*: https://docs.github.com/site-policy/acceptable-use-policies/github-acceptable-use-policies#4-spam-and-inauthentic-activity-on-github
