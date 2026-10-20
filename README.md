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

The demo reproduces the navigation, cream background, Manrope variable font, section copy, scientific citations, desktop/mobile section lengths, product card and three pod colors. It retains the original GLB geometry, embedded textures and HDR lighting assets, including the separate mobile material treatment. There is no mesh decimation, texture recompression, or canvas device-pixel-ratio reduction. During the cell/product overlap only, the blurred transmission backdrop uses CSS-pixel resolution; the hero and final product keep full-resolution transmission. See the measured image differences in [PERFORMANCE.md](PERFORMANCE.md).

The small brand mark is a static local image. The story has a keyboard-accessible chapter navigator, a pause control, a mobile menu, a contact dialog and reduced-motion support. Contact uses the existing email address. People, Science, legal pages and the waitlist link lead to the existing public site; this demo does not implement Webflow's form submission backend or its regional signup flow. No analytics or production form requests run in the preview.

## Animation design

- `js/main.js` initializes the page UI and app. Importing `anim.js` no longer starts an app as a side effect.
- `js/core/anim.js` owns the frame scheduler. Scroll and asynchronous loads invalidate the scene. Lenis, tweens, camera controls and particle motion update at display cadence; canvas submission is paced to at most 60 fps to avoid flooding the GPU on 120 Hz displays. Dirty state persists until rendered, including final tween/scroll states. Settled product views and paused scenes stop scheduling frames; hidden tabs stop immediately. Ambient motion also sleeps after 40 seconds without activity and wakes on input.
- `js/core/scroll.js` maps absolute scroll positions to chapters and product poses. Layout measurements are cached on initialization, font readiness and resize. Forward seeks, reverse scrolling and chapter jumps all use the same calculations.
- `js/effects/speckles.js` preserves the particle count, sizes and tilted-axis orbital motion. Each group rotates as a whole, replacing 600 matrix decompositions, compositions and instance uploads per animated desktop frame. Instance matrices change only when positions are randomized.
- `js/effects/starfield.js` uses the existing instanced shader with one progress uniform. It has no MeshLine dependency, polling timer or skipped update frames.
- `js/effects/podColors.js` runs the existing five-stage pod change as a guarded tween chain. Color and opacity changes update uniforms without forcing shader recompilation.
- `js/components/components.js` shares one GLTF/Draco loader with a two-worker limit. A shared product-loading promise prevents duplicate downloads. Product preparation starts at an idle opportunity after the hero is available; entering the microbes chapter also starts it immediately if it has not begun. This fetches the approximately 1 MB product earlier, without making the initial hero wait for it. Errors can be retried without resetting scroll.
- `js/core/sceneManager.js` owns rendering and GPU resource teardown. Models remain resident while visiting chapters, avoiding disposal/reupload churn on reverse scroll. Shader preparation includes screen and linear transmission passes, back faces, both product material phases and their lighting. Materials specify their precision explicitly to avoid traversal-order-dependent shader variants in Three r173; product materials retain the original product's effective `lowp` precision. Two bounded idle tasks prepare actual GPU draws and allocations, restoring the visible scene before returning. Separate cameras retain the two transmission-target sizes instead of reallocating them on each crossing. This trades earlier loading work and additional intermediate-buffer memory for smoother transitions. Resources are released when the app is torn down.

Open `/?perf` to expose `window.taxaDebug.app` and `window.taxaDebug.performanceMonitor.snapshot()` in browser DevTools. These diagnostics count scheduled story renders, excluding bounded loading warm-up draws. They do not run a separate animation loop.

## Validation and measurements

The browser suite covers story seeks in both directions, chapter-button navigation, all pod colors, load deduplication, same-origin requests, static-frame suspension, mobile layout, reduced motion, contact/menu behavior, resize poses, repeated-visit GPU geometry counts, product retry and a readable fallback after a failed cell download.

The local benchmark compares the original `main` animation against the optimized animation in the same HTML/CSS shell at 1440 × 900 and DPR 1. Original model URLs are redirected to local copies for this comparison. It samples three seconds per settled scene. `BASELINE_URL` can point to a separately served copy of the original animation that exposes its app as `window.taxaBaseline`:

```sh
BASELINE_URL=http://127.0.0.1:4174/ npm run benchmark
```

Results and screenshots are written to `test-results/benchmark/`. See [PERFORMANCE.md](PERFORMANCE.md) for the recorded results and their limitations.

The transition benchmark instead sweeps 150 frames through product progress 0.2–0.99 at DPR 2, after settling the actual pitch palette. It uses GPU timer queries when available and reports CPU render submission separately. Its diagnostic ablations intentionally hide objects or change rendering resolution to isolate costs; those modes are not shipped in the page. `ABLATIONS=0` records only cold/warm sweeps, `GPU_TIMERS=0` removes timer-query overhead, `MOBILE=1` uses a 390 × 844 DPR 3 touch viewport, and `BENCH_LABEL` names the output JSON. `BENCH_URL` can select an independently served earlier build. The harness owns the render loop, so it measures rendering cost rather than claiming to count compositor-dropped frames.

`compare:transmission` compares the current policy against full-resolution transmission at eight fixed poses, with motion frozen. It writes PNG pairs and per-channel differences under `test-results/transition/visual/`; `MOBILE=1` writes `visual-mobile/`. Playwright outputs live in `test-results/playwright/` so running tests does not erase performance evidence.

The live Webflow site and remote `main` remain unchanged. This branch is for local review; nothing has been deployed or pushed.
