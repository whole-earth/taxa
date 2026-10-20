# Performance investigation

Measured locally on October 20, 2026. Work is isolated to `optimize/story-demo`; remote `main` remains at `66063d1637e8c24ee600ea7f3c663f44856068c6`. Nothing was deployed.

## What made the cell-to-stick transition expensive

| Contributor | Evidence | Change |
| --- | --- | --- |
| Full-resolution refraction and overdraw | Both the desktop cell shell and product cap use physical transmission. Three r173 renders an intermediate multisampled image, resolves it and generates mipmaps. At 1440 × 900 and DPR 2 this starts with 5.18 million pixels. Diagnostic removal of the product or reduction of the transmission buffer reduced GPU time substantially. | During product progress 0.3–0.7 only, render the blurred transmission backdrop at CSS-pixel resolution. Keep the canvas, silhouettes, textures and final product at native DPR. |
| Shaders first encountered during scrolling | The old preparation missed linear-color transmission shaders, back-face variants and the final spotlight/material phase. Program counts grew during the first transition. | Prepare the actual lighting/material/output variants before publishing the product to the timeline. Subsequent forward/reverse visits do not create shader programs. |
| Traversal-dependent precision | Three r173's `WebGLPrograms.getParameters` retains the last explicitly requested precision. `lowp` particles could change later materials with `precision === null`, creating a previously unwarmed mobile shader. | Explicit precision per material: renderer-default precision for scene materials, original effective `lowp` for product materials and particles. |
| First GPU draw and target allocation | `compileAsync` alone did not eliminate visible-browser first-draw stalls. A controlled mobile-sized visible-browser test still recorded a 162 ms render submission without GPU draw preparation. | Prepare both product phases in bounded idle loading tasks. Each task restores the current scene before yielding, so the preparation poses are not presented. The corresponding first visible transition subsequently recorded a 3.6 ms maximum submission in that check. |
| Excess submissions on high-refresh displays | The visible browser delivered approximately 120 Hz callbacks. Submitting a full-resolution transmission frame on each callback could saturate the GPU queue. | Cap canvas submission at 60 fps while updating scroll/motion state at display cadence. Preserve pending dirty state until it is rendered. |
| Repeated intermediate-buffer allocation | Changing the transmission scale on one camera resizes its target when crossing each boundary. | Retain full-size and transition-size targets through two cameras with identical transforms. This uses additional buffer memory but avoids repeated allocation on reverse scrolling. |
| Particle CPU work | The original desktop particle path decomposed/rebuilt 600 matrices each animated frame. An isolated 1,000-update sample took approximately 40 ms versus 0.4 ms after grouping. | Rotate the five particle groups instead; preserve particle counts, geometry and orbital motion. This is a component-level result, not a claim of 100× whole-page speed. |
| Idle and invisible rendering | The original settled product rendered continuously; invisible cell components could still incur draws. | Demand-driven rendering, hidden-tab suspension, explicit visibility for zero-opacity ribbons/particles, and idle sleep. |
| Empty shadow work | No model mesh casts or receives shadows, but the product spotlight enabled shadow rendering. | Remove the empty shadow-map setup. Ablations showed this was not the dominant transition cost. |

## Loading versus geometry

The product GLB is **1,006,216 bytes**; the product scene uses about **20,938 triangles**, including the runtime mask geometry. The three cell meshes contain **272,352 triangles** before particle instances. The cell is dense, but the measured overlap cost was more sensitive to product refraction and render resolution than to removing the cell alone. Removing the starfield had little effect.

Local product transfers ranged from a few milliseconds to tens of milliseconds; decoding, shader preparation and GPU preparation cost more. Repeat transitions incurred no new product download, so network loading cannot explain their sustained slowdown. Slow-network behavior still matters for first arrival. Preparation now begins after the hero is available, with one shared promise and a retry path.

The original GLB/HDR files and embedded texture bytes are unchanged. No mesh decimation, texture recompression, particle-count reduction, or canvas-DPR cap was applied. The Manrope TTF was converted losslessly to WOFF2 (158,292 → 50,172 bytes), and unused source assets are excluded from the runtime build.

## Measurement method

- Chrome on Apple M4 Pro, ANGLE Metal. Local HTTP, no CPU/network throttling.
- `scripts/transition-benchmark.mjs` freezes the app loop after settling the actual pitch palette, then renders 150 poses across product progress 0.2–0.99. Desktop: 1440 × 900, DPR 2. Mobile layout: 390 × 844, DPR 3, still using the desktop GPU.
- GPU duration uses `EXT_disjoint_timer_query_webgl2`; CPU render submission, callback intervals and program counts are reported separately. GPU duration is not a compositor dropped-frame count. `GPU_TIMERS=0` permits a separate check without timer-query overhead.
- “Cold” means the first visible sweep after the application's normal preparation. The optimized version deliberately performs more preparation earlier. “Warm” repeats the sweep in the same context.
- Diagnostic ablations hide objects or reduce resolution to establish causes. They are confined to the benchmark and are not page features.
- The transition reference is a frozen copy of the local demo before these transition fixes, with the same HTML/CSS and original assets. The separate settled-scene baseline uses the original `main` animation in the same demo shell.
- Reference/baseline browser pages used for inspection were found to remain active in the browser tool. They were closed before the final isolated comparisons to avoid competing GPU workloads. Earlier exploratory timings are not interchangeable with the final isolated runs.

## Final isolated results

Desktop transition, 1440 × 900, DPR 2:

| Measurement | Earlier demo | Optimized demo |
| --- | ---: | ---: |
| First visible sweep: maximum CPU render submission | 90.4 ms | **4.7 ms** |
| First visible sweep: GPU time, p95 | 15.17 ms | **11.01 ms** |
| Repeat sweep: GPU time, p95 | 13.18 ms | **9.88 ms** |
| Repeat sweep: maximum CPU render submission | 1.9 ms | 2.2 ms |
| First sweep: callback intervals over 25 ms, out of 150 | 1 | 0 |
| Repeat sweep: callback intervals over 25 ms, out of 150 | 0 | 0 |
| Observed preparation wait before the sweep | 143.3 ms | 337.6 ms |

The final isolated run reduced the first visible submission spike by approximately **95%**, and repeat-sweep p95 GPU duration by approximately **25%**. The preparation row makes the tradeoff explicit: some work now happens earlier, after the hero is available, instead of during the handoff. Local transfer/cache conditions affect that preparation measurement.

Raw records: `test-results/transition/reference-final.json` and `optimized-final.json`. The emulated mobile layout recorded first/repeat GPU p95 of **8.47/8.05 ms**, with a **2.2 ms** maximum first-sweep CPU submission (`optimized-mobile-final.json`). This remains an Apple M4 Pro GPU result, not an Android/iPhone claim.

A separate visible-browser check at **500 × 844, DPR 2**, using actual scrolling and the normal app loop, recorded a **162 ms** maximum first-transition submission when GPU draw preparation was disabled and **3.6 ms** with it enabled. This comparison held shader preparation and frame pacing constant. The latter sample is saved in `visible-browser.json`; its callback-interval p95 was about **25.1 ms**, so it should not be described as perfectly uniform 60 fps.

The settled-scene benchmark uses 1440 × 900, DPR 1, and samples three seconds per scene:

| Scene | Original main: script time | Optimized: script time | Original / optimized scene renders |
| --- | ---: | ---: | ---: |
| Hero | 148.46 ms | **102.81 ms** | 180 / 181 |
| Microbes | 139.22 ms | **87.37 ms** | 181 / 181 |
| Settled product | 205.94 ms | **0 ms** | 181 / **0** |

The optimized product wakes on input, resize or a color change; zero idle renders does not mean frozen interaction. Raw records and screenshots are under `test-results/benchmark/`.

The final build contains **684,441 bytes** of minified JavaScript (178,399 gzip / 147,797 Brotli) and **10,637 bytes** of CSS (3,157 gzip / 2,732 Brotli). Compressed figures are size calculations; the local development server does not constitute a production compression/cache configuration.

## Visual and functional checks

`scripts/compare-transmission.mjs` compares the optimized canvas against full-resolution transmission at eight fixed poses. Desktop overlap samples differed by at most **6/255** in a color channel, with a maximum whole-image mean absolute channel difference of about **0.048/255**. The desktop samples outside the overlap were pixel-identical.

The DPR 3 mobile overlap samples had a maximum whole-image mean difference of about **0.196/255**. Sparse edge differences reached 14/255; fewer than 0.005% of pixels exceeded an 8-level difference in the worst sampled pose. Final-product mobile samples were pixel-identical. These are sampled numerical comparisons plus visual inspection, not proof that every possible device/pose produces identical pixels.

All **21 browser checks passed** in the final complete regression run (59.9 seconds). The final pod-selector naming cleanup also passed both targeted desktop/mobile interaction checks. Formatting, the production build and the Git whitespace check also passed. The suite covers forward/reverse seeking, chapter navigation, color changes, failed-load recovery, readable fallback, mobile layout, reduced motion, resize poses, static-frame suspension, repeated resource reuse, desktop/mobile shader reuse, and a simulated 120 Hz stream that verifies final pending frames are retained. Transition checks also verify the cell stays hidden until its first rendered frame and fades in, and desktop/mobile dots fade out before their color and position change, fade back in, and cancel pending reveals when leaving the chapter. Finalization coverage adds common display refresh rates, long stalls, DOM mutation counts, overlay suspension, focus restoration and short-screen card access.

The entrance fade restores the original Webflow CSS timing (1.8 seconds, ease-out). The dot transitions restore the original scroll script's 180 ms fade-out and 400 ms fade-in. They use the existing shared tween scheduler; position buffers change once per topic while invisible. Reduced-motion mode applies topic changes immediately.

## Finalization pass

The frame limiter previously reset its clock to each actual submission. That discarded the fractional interval on displays whose refresh rate is not a multiple of 60. The corrected clock carries that remainder and skips missed slots after stalls, while retaining pending dirty frames.

| Simulated display refresh | Previous submissions / second | Corrected submissions / second |
| --- | ---: | ---: |
| 60 Hz | 60 | 60 |
| 90 Hz | 45 | 60 |
| 120 Hz | 60 | 60 |
| 144 Hz | 48 | 60 |
| 165 Hz | 55 | 60 |

The scheduler also passed at 72, 75 and 240 Hz. These are controlled scheduler tests, not a guarantee that every GPU can render the scene at 60 fps. On refresh rates that do not divide evenly, presentation intervals necessarily alternate.

A MutationObserver recorded **480 redundant DOM attribute writes over 120 updates** within one product phase. Caching text/nav state and centralizing loading status reduced this to **zero**, without changing the calculated 3D poses. Ambient rendering now stops while the contact dialog or mobile menu covers the story, and resumes when closed.

The product card previously extended below the viewport at 1280 × 720 and 844 × 390. Compact laptop spacing and a bounded scrolling card make all content and the waitlist reachable; tests cover those sizes plus 667 × 375 and 375 × 500. Larger portrait/desktop layouts retain their existing composition.

Chrome DevTools recorded **122 ms LCP and 0.00 CLS** on an unthrottled localhost navigation before these fixes. CSS/image hints offered 0 ms estimated LCP savings, so they were not prioritized. This is a local lab observation, not a public-network load benchmark or a measure of when the 3D fade completes. Lighthouse accessibility improved from **95 to 100**; desktop and mobile both returned **100 accessibility and 100 best practices** after enlarging chapter hit areas. SEO remains 63 because this local demo intentionally uses `noindex, nofollow`. Reports are retained in `test-results/finalization/`. Automated scores supplement the layout and interaction tests; they do not constitute complete accessibility certification.

## Naming and structure refactor

The app now owns its scrolling controller and tween group. Model loading uses explicit asynchronous functions rather than promise-returning constructors. Model roots and bounds use consistent `.root` and `.bounds` properties; the product owns its applicator. Shared product configuration is independent of UI effects, and the synchronous material-update helper is named for what it actually does. The README documents the module boundaries. HTML/CSS use role-based names such as `story-panel`, `topic-panel` and `product-card`; an inverse-rename comparison verified that every CSS declaration and media query remained identical.

The full 21-test suite passed after the refactor. An import-graph check found 18 source modules and 25 local imports with no missing imports or cycles. Fixed-pose captures at 1440 × 900 and 390 × 844 (DPR 1, reduced motion) compared the hero, pitch, transition and final product before/after the refactor. All six desktop poses were pixel-identical. Three mobile poses were pixel-identical; the other three differed at isolated pixels by at most 4/255 in a channel, with a maximum image-wide mean channel difference below 0.000028/255. Assets, material values and animation timings were preserved. Records are in `test-results/refactor/visual-comparison.json` with the paired PNGs.

## Loading, motion and recovery hardening

Cell roots become owned by the scene as each load resolves, while final traversal order remains deterministic. Failed materials and late results after disposal are released explicitly. Product preparation releases unadopted resources on failure or teardown. The shared Draco pool finishes pending loads before terminating workers, and page teardown is registered before initialization begins. Renderer teardown waits for outstanding shader-readiness checks; context restoration recreates programs used by those checks.

Changing the system reduced-motion preference updates wheel smoothing, completes an active scroll, finishes finite tween chains in order, and ends label fades. New speckle and material transitions apply immediately in reduced-motion mode. Intentional idle periods no longer enter frame-interval samples. The render clock remains independent so rapid isolated updates still respect the 60 fps cap.

Context loss suspends scheduled rendering without marking unfinished initialization complete. Restoration regenerates the PMREM environment from a retained 1 MiB decoded HDR source, then resumes the current scroll pose and selected pod. This trades that bounded CPU memory for recovery without another environment download. Captured final-product images before/after recovery were pixel-identical in Chrome and WebKit. WebKit testing also identified a dialog focus-restoration difference; the page now returns focus explicitly to the visible opener.

The expanded suite has 31 tests, including ten new reliability checks. The final runs passed **31/31 in Chrome and 31/31 in WebKit**, with no skipped checks. Build, formatting, Git whitespace and import-graph checks also passed (18 modules, 25 local imports, no cycles). The JavaScript bundle is 687,369 bytes, gzip 179,139 bytes and Brotli 148,387 bytes; this reliability pass adds 740 gzip bytes compared with the previous naming refactor. Recovery captures and their comparison are retained in `test-results/chromium/`, `test-results/webkit/` and `test-results/resilience/recovery-visual.json`. GPU recovery tests cover loss during initial model loading, product shader preparation and the settled product, plus teardown during compilation. These simulated failures do not cover every possible driver failure.

### Throttled local loading

Chrome DevTools tested a 390 × 844, DPR 3 touch viewport with Slow 4G networking and 4× CPU throttling. A recorded navigation reported **1,714 ms LCP and 0.00 CLS**. A separate cold-load observation reached the first 3D frame at approximately **14.7 seconds**; the product download completed around **21 seconds** in the traced load. LCP measures the visible page content, not 3D readiness.

This exposed a network wait, not a polygon-count diagnosis: the uncompressed local JavaScript response took about five seconds, then the environment/models/decoder downloads dominated the next nine seconds. The approximately 1 MB product followed after the hero. The local esbuild server sends the roughly 687 KB JavaScript bundle without content encoding; its gzip equivalent is about 179 KB. These are development-server observations, not production-hosting measurements. Production delivery should be checked with actual compression and cache headers when deployment is authorized. This pass changes neither production nor its hosting.

Delayed-product tests separately hold the request while seeking between chapters and opening contact, then verify that one product request completes at the current scroll pose. Core page controls remain usable while the 3D scene loads.

### Cap fade continuity

The product GLB exports the frosted outer cap with a 0.5 alpha-test cutoff, despite having no alpha cutout texture. During the scroll fade, this discarded the entire cap below half opacity and exposed the cream background before abruptly rendering it again. Product initialization now disables that redundant cutoff before shader preparation. The existing opacity curve, frosted material, geometry and textures remain intact; no additional render pass or per-frame work is introduced.

Desktop frame comparisons at product progress 0.499 reproduced the missing surface: removing the cutoff changed 53.48% of pixels by more than eight channel levels. Sampled desktop frames from 0.501 onward, including the final product, were pixel-identical. Mobile samples retained their appearance (at most two channel levels of isolated render variation); the mobile framing did not expose the same background gap at half opacity. Comparison images are retained under `test-results/cap/` and `test-results/cap-mobile/`.

A rendered-pixel regression check now crosses half opacity in both scroll directions and rejects a large frame discontinuity. It passed in Chrome and WebKit, alongside desktop/mobile Retina shader and texture reuse checks: **3/3 targeted checks in each browser**. Build, formatting and Git whitespace checks also passed.

## Tradeoffs and limits

The refraction change is an intermediate-rendering adjustment, not mathematically identical rendering during the overlap. The full-resolution hero and final-product policy is retained. Two transmission target sizes stay resident to avoid allocation churn, so intermediate-buffer memory is higher than with a single target. GPU preparation performs bounded extra loading draws and fetches the product earlier; it does not make that work free.

The canvas intentionally tops out at 60 fps even on faster displays. The page stops rendering when settled. This favors predictable frame delivery and lower GPU/power usage over attempting 120 full-resolution 3D frames per second.

WebKit and throttled-network checks now supplement the Chrome results. Stock Safari 26.5.2 was also checked through the native UI: the hero rendered and chapter navigation reached the product. Its WebDriver suite could not run because “Allow remote automation” is disabled. No connected physical device or configured iOS simulator was available. Real iOS/Android GPU and thermal performance remain unverified; mobile viewport emulation is not a physical-phone performance result. Browser/device variability and first-load preparation remain relevant; this report does not promise zero missed frames on every device.

Run commands and artifact locations are documented in [README.md](README.md). Benchmark JSON and PNG pairs are retained under `test-results/`; Playwright uses its own subdirectory so it does not erase profiling evidence.
