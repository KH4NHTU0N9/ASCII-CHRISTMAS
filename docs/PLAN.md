# Project Execution Plan: ASCII-CHRISTMAS

## Phase 1: Initiation (Khởi tạo)
- **Objective:** Build an interactive, lightweight web application rendering a 3D animated ASCII Christmas tree with progressive bottom-up growth, falling snow, starfield, glowing lights, live auto-typing source code view, and policy-compliant holiday audio.
- **In-Scope:**
  - Pure HTML/CSS/JS (ES Modules) + HTML5 Canvas 2D (`CanvasRenderingContext2D`) [1].
  - 3D point-cloud scene: ground snow ripples, trunk, 24-tier pine foliage & snowcaps, spiral tinsel garland, baubles, blinking fairy lights, bevelled top star, and wrapped gift boxes.
  - Split-pane terminal IDE layout with HUD telemetry (`t`, `rotation`, `lights`, `letters`, `fps`, configurable `@KH4NHTU0NG · 2026`) and toggleable live code editor pane.
  - Autoplay-compliant audio controller supporting user MP3 (`./assets/music.mp3` or file picker / drag-drop) and Web Audio API synthesized fallback [2].
  - Automated Node.js test suite (`node --test`) and headless browser verification.
- **Out-of-Scope:**
  - Backend database/auth servers, heavy 3D WebGL frameworks, or copyrighted MP3 redistribution.
  - Artificial commit-inflation scripts violating GitHub Acceptable Use Policies [3].

## Phase 2: Planning (Lập kế hoạch)
- **Architecture:**
  - `src/config.js`: Centralized customization (handle, greeting, file label, timing, palette, audio path).
  - `src/math.js` & `src/partsBuffer.js`: Seeded PRNG, `fibSphere`, `envelope`, typed array buffers.
  - `src/builders/*.js` & `src/treeEngine.js`: Modular 3D geometry builders assembled into a unified scene.
  - `src/skyParticles.js` & `src/asciiRenderer.js`: Starfield/snow simulation, perspective Z-buffer projection, directional + Blinn-Phong lighting, frost birth-frontier shimmer, and light bloom.
  - `src/audioSynth.js` & `src/audioController.js`: Web Audio API polyphonic holiday synth + MP3 player.
  - `src/syntaxHighlighter.js`, `src/codeTyper.js`, `src/codeSource.js`: Real-time JS tokenizer & live typing pane showing `src/treeEngine.js`.
  - `src/main.js`, `index.html`, `styles/*.css`: Main loop (`requestAnimationFrame`), HUD, keyboard/mouse controls, responsive layout.
- **Risks & Mitigations:**
  - *Canvas DPI blur / monospace squashing:* Scale canvas by `devicePixelRatio` and compute exact cell aspect ratio from `ctx.measureText('M').width`.
  - *Frame drops on dense point clouds:* Use flat `Float32Array`/`Uint8Array` particle buffers and avoid per-point allocations inside the render loop.
  - *Browser Autoplay blocking:* Start muted visual scene immediately and unlock audio cleanly on first click/button press [2].

## Phase 3: Execution (Thực thi)
- Implement each subsystem incrementally via clean, atomic commits on `main`.
- Maintain strict modularity and synchronized live code source (`src/codeSource.js`).

## Phase 4: Monitoring (Giám sát)
- Run automated unit tests (`node --test tests/*.test.mjs`) verifying math invariants, particle bounds, Z-buffer occlusion, tokenizer accuracy, and code-source sync.
- Run local HTTP server and inspect rendered UI + console errors via browser verification.

## Phase 5: Closure (Đóng dự án)
- Complete documentation in `README.md`.
- Verify clean working tree and push atomic commits to `https://github.com/KH4NHTU0NG/ASCII-CHRISTMAS.git`.

## References
- `[1]` MDN Web Docs — CanvasRenderingContext2D: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
- `[2]` MDN Web Docs — Autoplay guide for media and Web Audio APIs: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- `[3]` GitHub Docs — GitHub Acceptable Use Policies (Section 4): https://docs.github.com/site-policy/acceptable-use-policies/github-acceptable-use-policies#4-spam-and-inauthentic-activity-on-github
