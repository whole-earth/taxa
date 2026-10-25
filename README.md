# Taxa story demo

A standalone recreation of the Webflow homepage at [taxa.tech](https://taxa.tech), which redirects to [taxatech.com](https://www.taxatech.com/). The reference was inspected on October 20, 2026. Work is isolated on `optimize/story-demo`, based on `main` at `66063d1637e8c24ee600ea7f3c663f44856068c6`.

## Local preview

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4173>. The server binds to loopback. JavaScript and CSS rebuild automatically; HTML and site assets are copied when changed. Refresh the browser to see edits. The preview has `noindex` metadata.

```sh
npm run build       # Standalone, minified site in dist/
npm test            # Browser regression suite; uses installed Google Chrome
npm run benchmark   # Local frame/render/CPU samples and screenshots
npm run benchmark:transition # Retina transition GPU timings and diagnostic ablations
npm run compare:transmission # Pixel comparisons with full-resolution refraction
npm run format      # Format maintained source files
```

The build copies only runtime assets. It excludes the full-resolution HDR source, the original TTF, the exploratory `blobs.html` page, tests, and dependencies that are not part of the bundle. `node_modules` is installed from the lockfile instead of tracked in Git. Bundle analysis is written to `test-results/build-meta.json`.

The HTML is the source template. Serve the build with `npm run dev` rather than opening `index.html` as a file: glTF, HDR, font and Draco loading require HTTP and the decoder files are copied by the build.

## Visual reference and scope

The demo reproduces the navigation, cream background, Manrope variable font, section copy, scientific citations, desktop/mobile section lengths, product card and three pod colors. It retains the original models, embedded textures and HDR lighting assets, including the separate mobile material treatment, with one deliberate geometry repair: the peel seal's old cut-through SWAP lettering is replaced with a smooth center beneath the Taxa mark. There is no general mesh decimation, texture recompression, or canvas device-pixel-ratio reduction. During the cell/product overlap only, the blurred transmission backdrop uses CSS-pixel resolution; the hero and final product keep full-resolution transmission. See the measured image differences and reproducible asset repair in [PERFORMANCE.md](PERFORMANCE.md).

The small brand mark is a static local image. The story has a keyboard-accessible chapter navigator, a pause control, a mobile menu, a contact dialog and reduced-motion support. Contact uses the existing email address. People, Science, legal pages and the waitlist link lead to the existing public site; this demo does not implement Webflow's form submission backend or its regional signup flow. No analytics or production form requests run in the preview.

## Animation design

- `js/main.js` initializes and tears down the page UI and app. `StoryApp` starts explicitly; importing a module does not start the story. `js/ui/page.js` owns menu, contact dialog and keyboard/focus behavior independently of model loading; `js/ui/loadingStatus.js` owns loading messages and avoids repeated DOM writes.
- `js/core/app.js` owns the frame scheduler. Scroll and asynchronous loads invalidate the scene. Lenis, tweens, camera controls and particle motion update at display cadence; canvas submission is paced to at most 60 fps to avoid flooding the GPU on 120 Hz displays. Dirty state persists until rendered, including final tween/scroll states. Settled product views and paused scenes stop scheduling frames; hidden tabs stop immediately. Ambient motion also sleeps after 40 seconds without activity and wakes on input.
- `js/core/timeline.js` maps absolute scroll positions to chapters and product poses. Layout measurements are cached on initialization, font readiness and resize. Forward seeks, reverse scrolling and chapter jumps all use the same calculations.
- `js/effects/speckles.js` preserves the particle count, sizes and tilted-axis orbital motion. Each group rotates as a whole, replacing 600 matrix decompositions, compositions and instance uploads per animated desktop frame. Instance matrices change only when positions are randomized.
- `js/effects/starfield.js` uses the existing instanced shader with one progress uniform. It has no MeshLine dependency, polling timer or skipped update frames.
- `js/effects/podSelector.js` runs the existing five-stage pod change as a guarded tween chain. Color and opacity changes update uniforms without forcing shader recompilation.
- `js/models/loader.js` shares one GLTF/Draco loader with a two-worker limit. `loadCellModel()` and `loadProductModel()` perform asynchronous loading explicitly; constructors return ordinary objects. The product owns its applicator and material phases, and its overflow-mask geometry lives in a separate module. A shared product-loading promise prevents duplicate downloads. The cell models and environment load first. Once they are ready, the product download starts immediately, overlapping the hero’s shader preparation. Product parsing and GPU preparation wait until the first visible story frame. The build generates a lossless `swap.glb.gz` (441,371 bytes versus 989,096 bytes for the original); native decompression restores the exact GLB, with the original asset used on browsers without `DecompressionStream`. Teardown cancels the product fetch and releases the first-frame wait. Errors can be retried without resetting scroll.
- `js/core/sceneManager.js` owns rendering and GPU resource teardown. Models remain resident while visiting chapters, avoiding disposal/reupload churn on reverse scroll. Shader preparation includes screen and linear transmission passes, back faces, both product material phases and their lighting. Materials specify their precision explicitly to avoid traversal-order-dependent shader variants in Three r173; product materials retain the original product's effective `lowp` precision. Two bounded idle tasks prepare actual GPU draws and allocations, restoring the visible scene before returning. Separate cameras retain the two transmission-target sizes instead of reallocating them on each crossing. This trades earlier loading work and additional intermediate-buffer memory for smoother transitions. Resources are released when the app is torn down.

Runtime dependencies belong to `StoryApp`: `scroller` owns smooth scrolling and `tweens` owns the animation group. The timeline, speckles and pod selector receive the app explicitly; there is no global runtime-state module. Model modules do not import UI effects. `core/cellMaterials.js` creates materials for each app, and `core/productConfig.js` holds pod labels/colors and named product phases (`transition` and `display`). Model roots are exposed consistently as `.root`, with cell bounds as `.bounds`. Markup and CSS use role-based names (`story-panel`, `story-title`, `topic-panel`, `product-card`, `waitlist-link`), while chapter anchor IDs stay stable.

| Directory | Responsibility |
| --- | --- |
| `js/core/` | App lifecycle, frame scheduling, timeline, scene rendering and visual configuration |
| `js/models/` | Asset loading, model/material setup and mask geometry |
| `js/effects/` | Speckle motion, starfield and pod-selection animation |
| `js/ui/` | Navigation, contact dialog and loading status |
| `js/utils/` | Resource disposal and opt-in performance measurements |

Open `/?perf` to expose `window.taxaDebug.app` and `window.taxaDebug.performanceMonitor.snapshot()` in browser DevTools. These diagnostics count scheduled story renders, excluding bounded loading warm-up draws. They do not run a separate animation loop. Intentional sleep, tab hiding and GPU loss reset the sampling clock so those gaps do not count as slow frames; render pacing keeps its separate fractional clock.

The render clock carries fractional time between submissions, maintaining the 60 fps target on 90/144/165 Hz displays without catch-up bursts after stalls. Open menus and contact dialogs suspend ambient motion; closing them resumes it. Chapter text and loading UI update only when their state changes. The chapter controls have 44 × 44 px targets with transform-only visual indicators. Short viewports use a bounded, independently scrollable product card so the waitlist remains reachable.

## Validation and measurements

The 31-test browser suite covers story seeks in both directions, chapter-button navigation, cell/dot fades, all pod colors, load deduplication, same-origin requests, static-frame suspension, mobile and short-screen layouts, reduced motion, contact/menu focus behavior, overlay suspension, resize poses, repeated-visit GPU geometry and shader counts, product retry, a readable fallback after a failed cell download, scroll DOM mutations and frame pacing from 60 to 240 Hz. All 31 checks passed in both Chrome and WebKit. PERFORMANCE.md records the results, the stock Safari smoke check and the limits of device emulation.

Reliability checks also cover failed and late model loads, teardown during loading or shader preparation, product-preparation cleanup/retry, live reduced-motion changes, idle timing, delayed product delivery, and GPU context loss during loading, compilation and the settled product. Before/after context-recovery screenshots are saved with the test output. The environment source retains 1 MiB of decoded CPU data so generated lighting can be rebuilt without another download; its temporary GPU upload is released after conversion.

Run the same suite against WebKit locally:

```sh
npx playwright install webkit
BROWSER=webkit npm test
```

WebKit checks include mobile-sized layouts and touch/Retina contexts. They do not replace physical iPhone or Android testing. For separate retained outputs, use `npx playwright test --output test-results/chromium` and `BROWSER=webkit npx playwright test --output test-results/webkit`.

The local benchmark compares the original `main` animation against the optimized animation in the same HTML/CSS shell at 1440 × 900 and DPR 1. Original model URLs are redirected to local copies for this comparison. It samples three seconds per settled scene. `BASELINE_URL` can point to a separately served copy of the original animation that exposes its app as `window.taxaBaseline`:

```sh
BASELINE_URL=http://127.0.0.1:4174/ npm run benchmark
```

Results and screenshots are written to `test-results/benchmark/`. See [PERFORMANCE.md](PERFORMANCE.md) for the recorded results and their limitations.

The transition benchmark instead sweeps 150 frames through product progress 0.2–0.99 at DPR 2, after settling the actual pitch palette. It uses GPU timer queries when available and reports CPU render submission separately. Its diagnostic ablations intentionally hide objects or change rendering resolution to isolate costs; those modes are not shipped in the page. `ABLATIONS=0` records only cold/warm sweeps, `GPU_TIMERS=0` removes timer-query overhead, `MOBILE=1` uses a 390 × 844 DPR 3 touch viewport, and `BENCH_LABEL` names the output JSON. `BENCH_URL` can select an independently served earlier build. The harness owns the render loop, so it measures rendering cost rather than claiming to count compositor-dropped frames.

`compare:transmission` compares the current policy against full-resolution transmission at eight fixed poses, with motion frozen. It writes PNG pairs and per-channel differences under `test-results/transition/visual/`; `MOBILE=1` writes `visual-mobile/`. Playwright outputs live in `test-results/playwright/` so running tests does not erase performance evidence.

The live Webflow site and remote `main` remain unchanged. This branch is for local review; nothing has been deployed or pushed.
