# Taxa story demo

A standalone recreation of the Webflow homepage at [taxa.tech](https://taxa.tech), which redirects to [taxatech.com](https://www.taxatech.com/). The reference was inspected on October 20, 2026. Editable source lives on `optimize/story-demo`, originally based on `main` at `66063d1637e8c24ee600ea7f3c663f44856068c6`. Production `main` contains the deployable tree; do not merge source modules over its retained legacy runtime files.

## Current production release — November 10, 2026

The optimized animation is live on [Taxa](https://taxa.tech). GitHub Pages successfully deployed [`829db57`](https://github.com/whole-earth/taxa/commit/829db5789e43d16bf1e84d33439f062bd7b70ce9) from `main`. The original deployed revision is preserved on [`pre-optimization`](https://github.com/whole-earth/taxa/tree/pre-optimization) at `66063d1637e8c24ee600ea7f3c663f44856068c6`. The editable source is preserved on [`optimize/story-demo`](https://github.com/whole-earth/taxa/tree/optimize/story-demo); release code corresponds to `65e2324`.

Webflow still loads `https://whole-earth.github.io/taxa/js/core/anim.js`; no Webflow configuration was edited. New runtime assets are under `assets/releases/b87d78fcfce1e4128993/`, including both late-product preview images. All 1,131 legacy supporting files were preserved byte-for-byte. The final package excludes macOS metadata and the unused Draco encoder from the new asset folder. The public entry and all 12 versioned assets returned HTTP 200, matching SHA-256 hashes and cross-origin access headers. The entry SHA-256 is `4c61785426325dfee2015d9a811429889d8861417f279049facea1c0392af3b9`.

The final staged package passed Chrome/WebKit desktop/mobile Webflow integration, including deliberately delayed product loading and fallback-image handoff. Live-page tests then passed section geometry, feature colors, forward/reverse product movement, cap closure, pod selection, inactivity pause/resume and Science-overlay behavior in Chrome and WebKit at both sizes. No animation assets were intercepted during the live tests; test-only guards blocked analytics and form submission. The initial accelerated WebKit idle check timed out immediately after an instantaneous chapter jump; allowing native scroll events to settle before advancing the test clock produced passing desktop/mobile reruns. A subsequent live mobile WebKit check used the actual timeout without advancing the clock: it paused at about 40.1 seconds, stopped rendering, and resumed on touch. These automated browser checks do not substitute for the user's physical-phone review.

Deployment records, manifest, rollback/source archives, live hashes, reports and screenshots are retained under `test-results/release/`. To roll back, restore the entry from `pre-optimization` in a new deployment commit while retaining the versioned assets for browsers that cached the optimized entry. The public entry advertises a 10-minute cache lifetime, so test a fresh/private tab if a device still shows the earlier animation. The here.now demo has not been updated by this production release.

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
- `js/core/app.js` owns the frame scheduler. Scroll and asynchronous loads invalidate the scene. Lenis, tweens, camera controls and particle motion update at display cadence; canvas submission is paced to at most 60 fps to avoid flooding the GPU on 120 Hz displays. Dirty state persists until rendered, including final tween/scroll states. Settled product views and paused scenes stop scheduling frames; hidden tabs stop immediately. Ambient motion also sleeps after 40 seconds without activity, showing production’s blurred play overlay and waking on input. The overlay stays clear of the page bottom, open panels, manual pause and reduced-motion mode; a single idle deadline also handles already-static scenes. Webflow contact/Science overlays and the mobile menu suspend ambient motion throughout their fades. Native scroll events request frames without keeping the loop alive after scrolling settles.
- `js/core/timeline.js` maps absolute scroll positions to chapters and product poses. Layout measurements are cached on initialization, font readiness and resize. Forward seeks, reverse scrolling and chapter jumps all use the same calculations. Original shell colors and surface settings are retained as a small value snapshot, without cloning a renderer material. The base meshes stay hidden through the straight-through zoom, then fade in from product progress 0.70 to 0.85 as the product turns. Their final opaque materials return before the unchanged cap descent (0.90–0.95) and locking turn (0.95–1.00).
- `js/effects/cellRotation.js` owns scroll-driven rotation momentum. It measures viewport heights per second, filters sparse input before limiting it, and eases the camera toward a bounded speed. `CELL_ROTATION` holds the baseline (0.4 OrbitControls units), forward boost (2.8), smaller reverse boost (1.6), and response times. Reverse input brakes before changing direction; release coasts back toward baseline. Camera damping preserves the existing 60 Hz feel using elapsed time on other displays. Pause, reduced motion, overlays and the product handoff clear the scroll momentum. Page-scroll behavior, section heights and product poses are independent of these settings.
- `js/effects/speckles.js` preserves the particle count, sizes and tilted-axis orbital motion. Each group rotates as a whole, replacing 600 matrix decompositions, compositions and instance uploads per animated desktop frame. Instance matrices change only when positions are randomized.
- `js/effects/zoomStreaks.js` uses the existing instanced shader with one progress uniform. It has no MeshLine dependency, polling timer or skipped update frames.
- `js/effects/podSelector.js` runs the existing five-stage pod change as a guarded tween chain. Color and opacity changes update uniforms without forcing shader recompilation.
- `js/models/loader.js` shares one GLTF/Draco loader with a two-worker limit. Product and reflection downloads share `js/utils/loadBinary.js` for native gzip decompression, raw compatibility downloads and abort handling. `loadCellModel()` and `loadProductModel()` perform asynchronous loading explicitly; constructors return ordinary objects. The product owns its applicator and material phases, and its overflow-mask geometry lives in a separate module. A shared product-loading promise prevents duplicate downloads. The cell models and environment load first. Once they are ready, the product download starts immediately, overlapping the hero’s shader preparation. Product parsing and GPU preparation wait until the first visible story frame. The build prepares a runtime product GLB without unused data (867,484 bytes), then generates its lossless `swap.glb.gz` companion (431,557 bytes). Native decompression restores that exact prepared GLB; browsers without `DecompressionStream` use its raw counterpart. Teardown cancels the product fetch and releases the first-frame wait. Errors can be retried without resetting scroll. If a reader gets ahead of loading, the cell remains visible at the pre-product pose. The final product section requests one responsive WebP preview only while waiting, then fades it out after the 3D scene renders at the current scroll position. Preview failure retains the cell, and normal ready-product visits request no preview. Regenerate both previews from the real model with `node scripts/capture-product-previews.mjs` against `npm run dev` after changing final product framing or materials.
- `js/core/sceneManager.js` owns rendering and GPU resource teardown. Models remain resident while visiting chapters, avoiding disposal/reupload churn on reverse scroll. Shader preparation includes screen and linear transmission passes, back faces, the zoom, base-reveal and final product material phases and their lighting. Materials specify their precision explicitly to avoid traversal-order-dependent shader variants in Three r173; product materials retain the original product's effective `lowp` precision. Three bounded idle tasks prepare actual GPU draws and allocations, restoring the visible scene before returning. Separate cameras retain the two transmission-target sizes instead of reallocating them on each crossing. This trades earlier loading work and additional intermediate-buffer memory for smoother transitions. Resources are released when the app is torn down.

Runtime dependencies belong to `StoryApp`: `scroller` owns smooth scrolling and `tweens` owns the animation group. The timeline, speckles and pod selector receive the app explicitly; there is no global runtime-state module. Model modules do not import UI effects. `core/cellMaterials.js` creates materials for each app, and `core/productConfig.js` holds pod labels/colors, named material phases (`transition`, `turn` and `display`) and `PRODUCT_TIMING` for the zoom, tilt, turn, base reveal, cap descent and lock. Durations are explicit to preserve interpolation arithmetic. `ProductModel` prepares its mesh/material collections once; phase changes and pod selection reuse those collections. Model roots are exposed consistently as `.root`, with cell bounds as `.bounds`. Markup and CSS use role-based names (`story-panel`, `story-title`, `topic-panel`, `product-card`, `waitlist-link`), while chapter anchor IDs stay stable.

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

The 62-test browser suite covers story seeks in both directions, chapter-button navigation, cell/dot fades, all pod colors, load deduplication, same-origin requests, static-frame suspension, mobile and short-screen layouts, reduced motion, contact/menu focus behavior, overlay suspension, resize poses, repeated-visit GPU geometry and shader counts, product retry, a readable fallback after a failed cell download, scroll DOM mutations and frame pacing from 60 to 240 Hz. The November 9 preflight passed all 62 distinct checks in Chrome across the full run and focused rerun, and all 62 in a full WebKit run, plus desktop/mobile Webflow integration in both engines. Seven new regression checks cover inactivity wake-up, the visibility handler, reduced-motion navigation and stale native-scroll state, fractional tween completion and the inactivity overlay. PERFORMANCE.md records the findings, earlier intermittent failures, the stock Safari smoke check and the limits of device emulation.

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

Before the production cutover recorded above, the latest standalone demo (code commit `57cb90c`) was published on November 9 to the existing permanent [Taxa review site](https://waxen-thistle-f2av.here.now/), including the integration, reflection, geometry, cleanup, base-reveal timing and UI-ownership updates. Its here.now version is `01M70NK93XCMNMDRGYDC22M5JH`. All 26 published file hashes matched the local build; a live WebKit check at a 390 × 844 mobile viewport confirmed product loading, the hidden base during zoom, its fade through the turn and the final closed cap pose. The custom `taxa.here.now` address is not configured on this account.

## Preparing reflections

`assets/cell/reflections.bin` preserves the production render’s rippled highlights. Production filtered the HDR into a CubeUV atlas, then treated that atlas as equirectangular and filtered it again. The bake reproduces that appearance without performing either filtering step at runtime. The texture stays linear RGBA16F; no exposure, tone mapping, material color or saturation is baked into it. Materials still reflect it dynamically as the cell rotates.

Run `npm run bake:reflections` after changing `assets/cell/aloe.hdr` or upgrading the pinned Three.js version, then rebuild. Baking uses installed Chrome via Playwright; normal builds use the checked-in asset and need no browser. The binary header validates its format, dimensions and Three revision because the CubeUV layout belongs to that renderer version. The build supplies a lossless gzip transfer and the raw file for browsers without native decompression.

Run `PORT=4175 node scripts/check-reflections.mjs` against a built preview to compare the prepared map with the original production processing at three viewport widths and seven poses. Use `BROWSER=webkit` for WebKit. Images and pixel differences are saved under `test-results/reflections/`. After changing the reflection asset, regenerate product fallback images with `PORT=4175 node scripts/capture-product-previews.mjs` and rebuild. Keep the HDR source for future bakes; it is excluded from the runtime build.

## Lossless model preparation

The source GLBs under `assets/` remain unchanged. During builds, `scripts/prepare-model.mjs` creates runtime copies: product indices use 16 bits where every index fits, unused UVs and unlit wordmark normals are removed, and the exported pod materials/normal map that `ProductModel` replaces are pruned. The ribbon's Draco payload stays byte-identical; its metadata no longer requests unused normals from the decoder. Positions, used normals/UVs, triangle order, retained images, transforms and animation inputs are preserved.

Draco still emits 32-bit triangle indices. `js/models/geometry.js` compacts these once after decoding and before upload; indices at or above the WebGL primitive-restart boundary retain their original type. The prepared product already has compact indices, so it avoids that conversion.

Run `npm run build && npm run test:assets` to verify source/prepared vertex bytes, triangle order, hierarchy, retained images and index-boundary behavior. The normal browser tests cover the complete loaded story and context recovery. `node scripts/check-geometry.mjs` additionally sweeps 171 poses at desktop and mobile sizes against a saved pre-cleanup build at `test-results/geometry-baseline/site` (override with `BASELINE_DIR`). The current preview uses the shared `PREVIEW_URL`/`PORT` convention (default 4173); use `BROWSER=webkit` for WebKit. It compares original/prepared geometry through one renderer, checking decoded geometry, effective materials, draw counts and pixel differences. Small rasterization differences are measured rather than treated as geometry changes. Reports and selected comparison images are saved under `test-results/geometry/`.

## Webflow integration preview

The production-compatible entry is `js/core/anim.js`; the build emits the self-contained ES module at `dist/js/core/anim.js`. It binds to Webflow's existing `.main > .splash/.zoom/.pitch/.product`, `.child`, `.zoom-child`, pod IDs and CTA module. Webflow retains ownership of navigation, form handlers, tag fills, progress-dot styling, footer behavior and all section heights. Demo-only page controls are not initialized in this entry. The animation supplies its loading/retry, late-product fallback and inactivity overlay behavior. The shared app reports its first rendered frame through a callback; the demo and Webflow adapters own their respective reveal classes. The demo adapter alone wires the pause button, and `LoadingStatus` owns the retry-button listener under the app’s abort signal. Automatic inactivity pausing and the blurred play overlay are shared by the demo and production entry; this temporary overlay is separate from the demo-only persistent pause button. Reduced-motion preference changes complete active chapter navigation immediately and settle pending visual transitions.

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

The integration check uses the captured production page and an independently hosted animation origin, verifies unchanged section dimensions/IDs, asset resolution, tag fills, chapter navigation, reverse seeking, final cap pose, pod labels/CTA tint and mobile menu/footer behavior. The November 9 preflight passed build, formatting and asset-integrity checks, all 62 distinct behavior tests in both Chrome and WebKit, plus desktop/mobile Webflow integration in each engine. Chrome’s full run passed 61 tests; the new footer test initially stopped above the page bottom, then passed in a seven-test focused rerun after correcting its scroll destination. WebKit passed all 62 in its full run. These checks also verify the first-frame reveal classes, absence of the demo pause button, and sleeping/resumption around Science, Contact and mobile-menu overlays. Reports and screenshots are written to `test-results/webflow/`. `PREVIEW_URL` overrides its default local origin. `PORT` also selects the development-server/test port when 4173 is occupied.

The November 9 compatibility work retains section heights and all pose timing. The subsequent base-reveal adjustment changes only when the base surfaces become visible, without altering those poses. The next pacing review should redistribute progress within the existing product section, preserving absolute-progress evaluation and reverse scrolling. The current mobile zoom starts at scale 26 (live original: 18); this remains unchanged pending a visual decision.


## Planned production cutover

When explicitly approved, preserve the then-current remote production `main` commit on a GitHub branch named `pre-optimization` before updating `main`. Confirm the GitHub Pages deployment source and retain the deployed revision for rollback. The replacement must publish the built `dist/js/core/anim.js` at the existing `/taxa/js/core/anim.js` URL with `dist/assets/` at `/taxa/assets/`. A source-only merge is not a release: `dist/` is ignored, and the source animation entry is not the self-contained bundle. Preserve the existing Webflow embed and retain the old branch/assets for rollback. No production branch or deployment changes have been made as part of the local rotation tuning.


### Hosting review — November 10, 2026

Read-only inspection confirmed GitHub Pages uses branch publishing (`build_type: legacy`) from `main` at `/`. The deployed revision and remote `main` both resolve to `66063d1637e8c24ee600ea7f3c663f44856068c6`. Recheck those values immediately before releasing; the backup must preserve the then-current revision. The live Webflow page still contains one active module embed at `https://whole-earth.github.io/taxa/js/core/anim.js`. This URL must remain unchanged because Webflow editing access is unavailable.

The live script response permits cross-origin loading and advertises `Cache-Control: max-age=600`. Old code also requests model assets through `https://cdn.jsdelivr.net/gh/whole-earth/taxa@main/assets/`. A cache-safe release should retain the legacy supporting JavaScript and original asset paths, publish the optimized assets in a versioned subdirectory, and point the replacement bundle's internal asset base there. The release staging command below implements that packaging; the normal demo build still uses `../../assets/`. Do not overwrite overlapping legacy modules with the optimized source modules or simply copy prepared models over the old assets. The single public entry URL can stay fixed while the internal asset path changes. Verify the published bytes, asset responses and actual Webflow render after deployment; cached visitors may retain the old entry until revalidation.

The November 10 review of code `fdd6e14` passed a fresh `npm run verify`: all 62 tests in a full Chrome run, all 62 in a full WebKit run, asset integrity, formatting/build checks and desktop/mobile Webflow integration in both engines. An isolated Chrome browser also loaded the actual live Webflow page while locally intercepting the existing animation/asset URLs with the built replacement. Desktop and mobile checks passed loading, asset-path resolution, forward/reverse product traversal and pod selection without JavaScript errors. No production files or GitHub settings were changed. Evidence is in `test-results/release-review/`, `test-results/webflow/` and `/tmp/taxa-release-review.log`.


### Staging the production replacement locally

With a clean committed checkout and the verified deployed revision available locally, run:

```sh
npm run stage:release -- <full-deployed-commit-sha>
node scripts/preview-webflow.mjs
RELEASE_DIR=test-results/release PORT=4175 node scripts/check-webflow.mjs
RELEASE_DIR=test-results/release PORT=4175 BROWSER=webkit node scripts/check-webflow.mjs
```

The existing local preview must serve `dist/` for the browser checks. Staging creates a fresh normal build, checks prepared model integrity, then constructs `test-results/release/site/` from the deployed Git revision. It replaces only `js/core/anim.js`, adds `.nojekyll`, and copies the new runtime assets into `assets/releases/<content-hash>/`. The release bundle uses that versioned path at compile time. All other legacy files remain byte-identical, including files loaded through jsDelivr. Shared compiler options keep the release and preview bundles consistent; animation behavior is unchanged.

The sibling `manifest.json` records source/deployed revisions, the asset path and every published file hash. `rollback.tar` preserves the original deployed tree; `source.tar` preserves the optimized source checkout. The captured Webflow preview, manifest and archives are outside `site/` and must not be published. `npm run check:release` verifies the staged hashes and legacy files against Git blobs. Browser integration in release mode intercepts the unchanged production script URL and requires asset requests to use the versioned folder. These commands neither push nor change GitHub Pages settings. Each staging run replaces only this generated local release directory.

Before an actual cutover, recheck remote `main` and the deployed revision against the manifest baseline. Preserve that revision as `pre-optimization`, retain the optimization source branch, and publish the staged tree at the existing Pages paths. Rollback restores the original entry and supporting tree; retain the new versioned assets as well so clients with a cached replacement bundle can still load them. A backup branch alone does not instantly invalidate cached entry scripts. Source files must not be merged over the retained legacy runtime paths.


The first staged package (November 10, source `bb86cb7`, baseline `66063d1`) passed legacy-file/archive integrity checks and normal-versus-release Webflow integration in Chrome and WebKit at desktop/mobile sizes. All 1,131 legacy files other than the replaced entry remain byte-identical. The versioned assets are under `assets/releases/69cbd056af754077c2b0/`. After normalizing that one asset-path string, the release bundle is byte-identical to the normal Webflow bundle. Section dimensions, feature colors and sampled cap poses match exactly between their integration reports. Negative checks confirmed rejection of altered legacy bytes even when manifest hashes were updated, and rejection of an accidentally included Webflow snapshot. No remote branch, Pages setting or production file was changed. Package checks are under `test-results/release/checks/`; comparison results are in `test-results/release-validation/comparison.json`.
