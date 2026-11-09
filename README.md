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
npm run verify      # Build, asset integrity, both browsers and Webflow integration
npm run benchmark   # Local frame/render/CPU samples and screenshots
npm run benchmark:transition # Retina transition GPU timings and diagnostic ablations
npm run compare:transmission # Pixel comparisons with full-resolution refraction
npm run format      # Format maintained source files
```

The build copies only runtime assets. It excludes both offline HDR sources, the original TTF, the exploratory `blobs.html` page, tests, and dependencies that are not part of the bundle. `node_modules` is installed from the lockfile instead of tracked in Git. Bundle analysis is written to `test-results/build-meta.json`.

The HTML is the source template. Serve the build with `npm run dev` rather than opening `index.html` as a file: glTF, reflection-map, font and Draco loading require HTTP and the decoder files are copied by the build.

## Visual reference and scope

The demo reproduces the navigation, cream background, Manrope variable font, section copy, scientific citations, desktop/mobile section lengths, product card and three pod colors. It retains the original models, embedded textures and production reflection appearance, including the separate mobile material treatment. The HDR reflection treatment is prepared offline in linear half-float format to avoid per-visit filtering. One deliberate geometry repair remains: the peel seal's old cut-through SWAP lettering is replaced with a smooth center beneath the Taxa mark. There is no general mesh decimation, texture recompression, or canvas device-pixel-ratio reduction. During the cell/product overlap only, the blurred transmission backdrop uses CSS-pixel resolution; the hero and final product keep full-resolution transmission. See the measured image differences and reproducible asset repair in [PERFORMANCE.md](PERFORMANCE.md).

The small brand mark is a static local image. The story has a keyboard-accessible chapter navigator, a pause control, a mobile menu, a contact dialog and reduced-motion support. Contact uses the existing email address. People, Science, legal pages and the waitlist link lead to the existing public site; this demo does not implement Webflow's form submission backend or its regional signup flow. No analytics or production form requests run in the preview.

## Animation design

- `js/main.js` initializes and tears down the page UI and app. `StoryApp` starts explicitly; importing a module does not start the story. `js/ui/page.js` owns menu, contact dialog and keyboard/focus behavior independently of model loading; `js/ui/loadingStatus.js` owns loading messages and avoids repeated DOM writes. `js/ui/productFallback.js` owns the optional final-product preview and fades it out only after a real scene frame is drawn.
- `js/core/app.js` owns the frame scheduler. Scroll and asynchronous loads invalidate the scene. Lenis, tweens, camera controls and particle motion update at display cadence; canvas submission is paced to at most 60 fps to avoid flooding the GPU on 120 Hz displays. Dirty state persists until rendered, including final tween/scroll states. Settled product views and paused scenes stop scheduling frames; hidden tabs stop immediately. Ambient motion also sleeps after 40 seconds without activity and wakes on input.
- `js/core/timeline.js` maps absolute scroll positions to chapters and product poses. Layout measurements are cached on initialization, font readiness and resize. Forward seeks, reverse scrolling and chapter jumps all use the same calculations. Original shell colors and surface settings are retained as a small value snapshot, without cloning a renderer material.
- `js/effects/speckles.js` preserves the particle count, sizes and tilted-axis orbital motion. Each group rotates as a whole, replacing 600 matrix decompositions, compositions and instance uploads per animated desktop frame. Instance matrices change only when positions are randomized.
- `js/effects/zoomStreaks.js` uses the existing instanced shader with one progress uniform. It has no MeshLine dependency, polling timer or skipped update frames.
- `js/effects/podSelector.js` runs the existing five-stage pod change as a guarded tween chain. Color and opacity changes update uniforms without forcing shader recompilation.
- `js/models/loader.js` shares one GLTF/Draco loader with a two-worker limit. Product and reflection downloads share `js/utils/loadBinary.js` for native gzip decompression, raw compatibility downloads and abort handling. `loadCellModel()` and `loadProductModel()` perform asynchronous loading explicitly; constructors return ordinary objects. The product owns its applicator and material phases, and its overflow-mask geometry lives in a separate module. A shared product-loading promise prevents duplicate downloads. The cell models and environment load first. Once they are ready, the product download starts immediately, overlapping the hero’s shader preparation. Product parsing and GPU preparation wait until the first visible story frame. The build prepares a runtime product GLB without unused data (867,484 bytes), then generates its lossless `swap.glb.gz` companion (431,557 bytes). Native decompression restores that exact prepared GLB; browsers without `DecompressionStream` use its raw counterpart. Teardown cancels the product fetch and releases the first-frame wait. Errors can be retried without resetting scroll. If a reader gets ahead of loading, the cell remains visible at the pre-product pose. The final product section requests one responsive WebP preview only while waiting, then fades it out after the 3D scene renders at the current scroll position. Preview failure retains the cell, and normal ready-product visits request no preview. Regenerate both previews from the real model with `node scripts/capture-product-previews.mjs` against `npm run dev` after changing final product framing or materials.
- `js/core/sceneManager.js` owns rendering and GPU resource teardown. Models remain resident while visiting chapters, avoiding disposal/reupload churn on reverse scroll. Shader preparation includes screen and linear transmission passes, back faces, both product material phases and their lighting. Materials specify their precision explicitly to avoid traversal-order-dependent shader variants in Three r173; product materials retain the original product's effective `lowp` precision. Two bounded idle tasks prepare actual GPU draws and allocations, restoring the visible scene before returning. Separate cameras retain the two transmission-target sizes instead of reallocating them on each crossing. This trades earlier loading work and additional intermediate-buffer memory for smoother transitions. Resources are released when the app is torn down.

Runtime dependencies belong to `StoryApp`: `scroller` owns smooth scrolling and `tweens` owns the animation group. The timeline, speckles and pod selector receive the app explicitly; there is no global runtime-state module. Model modules do not import UI effects. `core/cellMaterials.js` creates materials for each app, and `core/productConfig.js` holds pod labels/colors, named material phases (`transition` and `display`) and `PRODUCT_TIMING` for the zoom, tilt, turn, cap descent and lock. Durations are explicit to preserve interpolation arithmetic. `ProductModel` prepares its mesh/material collections once; phase changes and pod selection reuse those collections. Model roots are exposed consistently as `.root`, with cell bounds as `.bounds`. Markup and CSS use role-based names (`story-panel`, `story-title`, `topic-panel`, `product-card`, `waitlist-link`), while chapter anchor IDs stay stable.

| Directory | Responsibility |
| --- | --- |
| `js/core/` | App lifecycle, frame scheduling, timeline, scene rendering and visual configuration |
| `js/models/` | Asset loading, model/material setup and mask geometry |
| `js/effects/` | Speckle motion, zoom streaks and pod-selection animation |
| `js/ui/` | Navigation, contact dialog and loading status |
| `js/utils/` | Prepared binary downloads, resource disposal and opt-in performance measurements |

Open `/?perf` to expose `window.taxaDebug.app` and `window.taxaDebug.performanceMonitor.snapshot()` in browser DevTools. These diagnostics count scheduled story renders, excluding bounded loading warm-up draws. They do not run a separate animation loop. Intentional sleep, tab hiding and GPU loss reset the sampling clock so those gaps do not count as slow frames; render pacing keeps its separate fractional clock.

The render clock carries fractional time between submissions, maintaining the 60 fps target on 90/144/165 Hz displays without catch-up bursts after stalls. Open menus and contact dialogs suspend ambient motion; closing them resumes it. Chapter text and loading UI update only when their state changes. The chapter controls have 44 × 44 px targets with transform-only visual indicators. Short viewports use a bounded, independently scrollable product card so the waitlist remains reachable.

## Validation and measurements

Use `npm run verify` before a release. It checks source formatting, builds the site, verifies prepared assets, captures the production Webflow page, then runs the complete browser suite and Webflow integration checks in Chrome and WebKit. It serves the fresh build on an isolated loopback port and shuts that server down on success or failure. Install Google Chrome and Playwright WebKit first; internet access is required for the production-page capture and its existing CDN assets. It does not deploy or change the production site. Browser outputs are retained separately under `test-results/playwright-chromium/` and `test-results/playwright-webkit/`.

Individual browser checks and preview-based diagnostics share one target convention: `PREVIEW_URL`, otherwise `http://127.0.0.1:${PORT}`, otherwise port 4173. For example, use `PORT=4175 npm run benchmark:transition` or `PREVIEW_URL=http://127.0.0.1:4175 npm test`. With `PREVIEW_URL`, tests use the existing server; otherwise Playwright starts or reuses the local development server. `verify` always owns its isolated server. Reference-image sweeps and performance benchmarks remain separate commands.

The 46-test browser suite covers story seeks in both directions, chapter-button navigation, cell/dot fades, all pod colors, load deduplication, same-origin requests, static-frame suspension, mobile and short-screen layouts, reduced motion, contact/menu focus behavior, overlay suspension, resize poses, repeated-visit GPU geometry and shader counts, product retry, a readable fallback after a failed cell download, scroll DOM mutations and frame pacing from 60 to 240 Hz. All 46 checks passed in full runs in both Chrome and WebKit during the latest cleanup. PERFORMANCE.md records the results, the stock Safari smoke check and the limits of device emulation.

Reliability checks also cover failed and late model loads, teardown during loading or shader preparation, product-preparation cleanup/retry, live reduced-motion changes, idle timing, delayed product delivery, and GPU context loss during loading, compilation and the settled product. Before/after context-recovery screenshots are saved with the test output. The prepared reflection map retains 688,128 bytes of CPU texels for reupload after context loss, without another download or GPU filtering pass. Damaged reflection data falls back to readable page content.

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

The transition benchmark instead sweeps 150 frames through product progress 0.2–0.99 at DPR 2, after settling the actual pitch palette. It uses GPU timer queries when available and reports CPU render submission separately. Its diagnostic ablations intentionally hide objects or change rendering resolution to isolate costs; those modes are not shipped in the page. `ABLATIONS=0` records only cold/warm sweeps, `GPU_TIMERS=0` removes timer-query overhead, `MOBILE=1` uses a 390 × 844 DPR 3 touch viewport, and `BENCH_LABEL` names the output JSON. `PREVIEW_URL` can select an independently served build; `BENCH_URL` remains a legacy override for this benchmark. The harness owns the render loop, so it measures rendering cost rather than claiming to count compositor-dropped frames.

`compare:transmission` compares the current policy against full-resolution transmission at eight fixed poses, with motion frozen. It writes PNG pairs and per-channel differences under `test-results/transition/visual/`; `MOBILE=1` writes `visual-mobile/`. Playwright outputs live in `test-results/playwright/` so running tests does not erase performance evidence.

The live Webflow site and remote `main` remain unchanged. The latest standalone demo (code commit `8c2b6e0`) was published on November 9 to the existing permanent [Taxa review site](https://waxen-thistle-f2av.here.now/), including the integration, reflection, geometry and cleanup updates. Its here.now version is `01M70DBTBEPBA2XYN6D1ZXR6GP`. The custom `taxa.here.now` address is not configured on this account.

## Preparing reflections

`assets/cell/reflections.bin` preserves the production render’s rippled highlights. Production filtered the HDR into a CubeUV atlas, then treated that atlas as equirectangular and filtered it again. The bake reproduces that appearance without performing either filtering step at runtime. The texture stays linear RGBA16F; no exposure, tone mapping, material color or saturation is baked into it. Materials still reflect it dynamically as the cell rotates.

Run `npm run bake:reflections` after changing `assets/cell/aloe.hdr` or upgrading the pinned Three.js version, then rebuild. Baking uses installed Chrome via Playwright; normal builds use the checked-in asset and need no browser. The binary header validates its format, dimensions and Three revision because the CubeUV layout belongs to that renderer version. The build supplies a lossless gzip transfer and the raw file for browsers without native decompression.

Run `PORT=4175 node scripts/check-reflections.mjs` against a built preview to compare the prepared map with the original production processing at three viewport widths and seven poses. Use `BROWSER=webkit` for WebKit. Images and pixel differences are saved under `test-results/reflections/`. After changing the reflection asset, regenerate product fallback images with `PORT=4175 node scripts/capture-product-previews.mjs` and rebuild. Keep the HDR source for future bakes; it is excluded from the runtime build.

## Lossless model preparation

The source GLBs under `assets/` remain unchanged. During builds, `scripts/prepare-model.mjs` creates runtime copies: product indices use 16 bits where every index fits, unused UVs and unlit wordmark normals are removed, and the exported pod materials/normal map that `ProductModel` replaces are pruned. The ribbon's Draco payload stays byte-identical; its metadata no longer requests unused normals from the decoder. Positions, used normals/UVs, triangle order, retained images, transforms and animation inputs are preserved.

Draco still emits 32-bit triangle indices. `js/models/geometry.js` compacts these once after decoding and before upload; indices at or above the WebGL primitive-restart boundary retain their original type. The prepared product already has compact indices, so it avoids that conversion.

Run `npm run build && npm run test:assets` to verify source/prepared vertex bytes, triangle order, hierarchy, retained images and index-boundary behavior. The normal browser tests cover the complete loaded story and context recovery. `node scripts/check-geometry.mjs` additionally sweeps 171 poses at desktop and mobile sizes against a saved pre-cleanup build at `test-results/geometry-baseline/site` (override with `BASELINE_DIR`). The current preview uses the shared `PREVIEW_URL`/`PORT` convention (default 4173); use `BROWSER=webkit` for WebKit. It compares original/prepared geometry through one renderer, checking decoded geometry, effective materials, draw counts and pixel differences. Small rasterization differences are measured rather than treated as geometry changes. Reports and selected comparison images are saved under `test-results/geometry/`.

## Webflow integration preview

The production-compatible entry is `js/core/anim.js`; the build emits the self-contained ES module at `dist/js/core/anim.js`. It binds to Webflow's existing `.main > .splash/.zoom/.pitch/.product`, `.child`, `.zoom-child`, pod IDs and CTA module. Webflow retains ownership of navigation, form handlers, tag fills, progress-dot styling, footer behavior and all section heights. Demo-only page controls are not initialized in this entry. The animation supplies only its loading/retry and late-product fallback behavior.

The script resolves assets relative to its own URL, not the Webflow page. A release must include `dist/js/core/anim.js` **and the generated `dist/assets/` directory**, preserving the `../../assets/` relationship. This includes the compressed GLB, repaired product, prepared reflection map (both reflections.bin and reflections.bin.gz), Draco decoder and optional previews. Replacing the JavaScript without these companion files is not a complete deployment. No Webflow HTML/CSS edits or additional script tags are needed when the existing module embed points at the replacement location. Cross-origin hosting must allow CORS for the module and assets. Do not load the old and new animation entries together.

For a local copy of the current production page with only the animation embed substituted:

```sh
npm run build
node scripts/preview-webflow.mjs
python3 -m http.server 4175 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:4175/webflow.html?perf>. The snapshot retains production markup, CSS, Webflow navigation and CTA interactions. It removes analytics and blocks form submissions for local review. It still needs internet access for the existing Webflow/CDN assets. It is generated into ignored `dist/` and must not be deployed. Rebuilding clears it; rerun the snapshot command after a build. The original capture is in `test-results/webflow/production.html`.

```sh
PORT=4175 node scripts/check-webflow.mjs
PORT=4175 BROWSER=webkit node scripts/check-webflow.mjs
PORT=4175 npm test
```

The integration check uses the captured production page and an independently hosted animation origin, verifies unchanged section dimensions/IDs, asset resolution, tag fills, chapter navigation, reverse seeking, final cap pose, pod labels/CTA tint and mobile menu/footer behavior. Reports and screenshots are written to `test-results/webflow/`. `PREVIEW_URL` overrides its default local origin. `PORT` also selects the development-server/test port when 4173 is occupied.

The November 9 compatibility work deliberately retains the current animation phase boundaries and section heights. The next pacing review should redistribute progress within the existing product section, preserving absolute-progress evaluation and reverse scrolling. The current mobile zoom starts at scale 26 (live original: 18); this remains unchanged pending a visual decision.
