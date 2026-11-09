# Performance investigation

Measured locally on October 20, 2026. Work is isolated to `optimize/story-demo`; remote `main` remains at `66063d1637e8c24ee600ea7f3c663f44856068c6`. The initial measurements below predate deployment; the October 25 loading update is published only to the separate here.now demo.

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

Context loss suspends scheduled rendering without marking unfinished initialization complete. At this stage, restoration regenerated the PMREM environment from a retained 1 MiB decoded HDR source, then resumed the current scroll pose and selected pod. The November 9 reflection update below replaces that conversion with direct texture reupload. This trades that bounded CPU memory for recovery without another environment download. Captured final-product images before/after recovery were pixel-identical in Chrome and WebKit. WebKit testing also identified a dialog focus-restoration difference; the page now returns focus explicitly to the visible opener.

The expanded suite has 31 tests, including ten new reliability checks. The final runs passed **31/31 in Chrome and 31/31 in WebKit**, with no skipped checks. Build, formatting, Git whitespace and import-graph checks also passed (18 modules, 25 local imports, no cycles). The JavaScript bundle is 687,369 bytes, gzip 179,139 bytes and Brotli 148,387 bytes; this reliability pass adds 740 gzip bytes compared with the previous naming refactor. Recovery captures and their comparison are retained in `test-results/chromium/`, `test-results/webkit/` and `test-results/resilience/recovery-visual.json`. GPU recovery tests cover loss during initial model loading, product shader preparation and the settled product, plus teardown during compilation. These simulated failures do not cover every possible driver failure.

### Throttled local loading

Chrome DevTools tested a 390 × 844, DPR 3 touch viewport with Slow 4G networking and 4× CPU throttling. A recorded navigation reported **1,714 ms LCP and 0.00 CLS**. A separate cold-load observation reached the first 3D frame at approximately **14.7 seconds**; the product download completed around **21 seconds** in the traced load. LCP measures the visible page content, not 3D readiness.

This exposed a network wait, not a polygon-count diagnosis: the uncompressed local JavaScript response took about five seconds, then the environment/models/decoder downloads dominated the next nine seconds. The approximately 1 MB product followed after the hero. The local esbuild server sends the roughly 687 KB JavaScript bundle without content encoding; its gzip equivalent is about 179 KB. These are development-server observations, not production-hosting measurements. Production delivery should be checked with actual compression and cache headers when deployment is authorized. This pass changes neither production nor its hosting.

Delayed-product tests separately hold the request while seeking between chapters and opening contact, then verify that one product request completes at the current scroll pose. Core page controls remain usable while the 3D scene loads.

### Cap fade continuity

The product GLB exports the frosted outer cap with a 0.5 alpha-test cutoff, despite having no alpha cutout texture. During the scroll fade, this discarded the entire cap below half opacity and exposed the cream background before abruptly rendering it again. Product initialization now disables that redundant cutoff before shader preparation. The existing opacity curve, frosted material, geometry and textures remain intact; no additional render pass or per-frame work is introduced.

Desktop frame comparisons at product progress 0.499 reproduced the missing surface: removing the cutoff changed 53.48% of pixels by more than eight channel levels. Sampled desktop frames from 0.501 onward, including the final product, were pixel-identical. Mobile samples retained their appearance (at most two channel levels of isolated render variation); the mobile framing did not expose the same background gap at half opacity. Comparison images are retained under `test-results/cap/` and `test-results/cap-mobile/`.

A rendered-pixel regression check now crosses half opacity in both scroll directions and rejects a large frame discontinuity. It passed in Chrome and WebKit, alongside desktop/mobile Retina shader and texture reuse checks: **3/3 targeted checks in each browser**. Build, formatting and Git whitespace checks also passed.

### Removing the old seal branding

The faint SWAP mark beneath the Taxa decal was cut-through geometry in `film-cover`, not a texture or a transparency sorting failure. The product asset now has a repaired center on both sides of the domed seal, using radial height samples from its intact surface. The outer seal, pull tab, side text, all other meshes, materials, transforms and embedded textures are preserved. Binary comparisons confirmed that only the seal's position, normal and index buffers changed.

This is an offline asset correction: there is no new runtime material, mask, shader, dependency or draw call. The seal has **8,504 triangles instead of 8,862**, and the GLB is **989,096 bytes instead of 1,006,216**. A geometric audit cast 1,632 probes through the old lettering region; every probe crossed exactly two seal surfaces with positive thickness. Desktop/mobile close-ups with the Taxa decal temporarily hidden confirm the old lettering is absent; the normal view retains the single Taxa mark. Captures are in `test-results/branding-repaired/` and `test-results/branding-repaired-mobile/`.

The repair is reproducible from the original asset in Git. The script validates its source hash, reconstructs only the seal center and compacts that mesh's buffers. It is deliberately separate from the site build and never runs in the browser:

```sh
git show a7972a2:assets/product/swap.glb > /tmp/taxa-original-product.glb
node scripts/repair-product-seal.mjs /tmp/taxa-original-product.glb /tmp/taxa-repaired-product.glb
```

The generated asset was verified byte-identical to the committed repair. The story suite passed **14/14 checks in Chrome and 14/14 in WebKit**, including forward/reverse scrolling, desktop/mobile pod changes, cap fade continuity and shader/texture reuse. These results describe the repaired asset; the earlier pixel-identical cap-fade comparisons predate this intentional branding change.

### Pull-tab occlusion during the reveal

The imported seal uses alpha blending with depth writing disabled. During the reveal, the orange rim could therefore draw through the nearer pull tab. Enabling depth writing directly exposed inconsistent overlap between the seal's upper and lower surfaces. The transition now draws the seal's nearest depth with a colorless basic material, then shades that surface once. This shares the existing geometry and replaces the previous two-sided color draws: sampled desktop and mobile **draw counts and submitted triangle counts are unchanged**.

The initial occlusion fix used seal opacity `1 - (1 - opacity)²` to preserve the apparent opacity of its previous two blended surfaces. The staged reveal below supersedes that accelerated fade. The depth mesh participates in normal shader preparation and shared-resource disposal. It is disabled in the final product phase, which retains its original rendering; sampled final-product frames were pixel-identical.

New desktop/mobile pixel tests hide the rim and verify that pixels covered by the tab stay unchanged while exposed rim pixels change. They repeat after visiting the final product and seeking backward. These checks, cap fade continuity, desktop/mobile shader reuse and product interactions passed: **6 targeted checks in Chrome and 6 in WebKit**. Build, formatting and Git whitespace checks passed. Before/after captures and draw statistics are in `test-results/seal-fixed/` and `test-results/seal-fixed-mobile/`.

### Staged optical zoom and product reveal

The cell-to-product zoom now separates optical refraction, the product body, the seal, the Taxa wordmark and exposure. The refractive cap retains its original fade and movement. Smooth fades introduce the body over 20–85% of the zoom, the seal over 55–95%, and the wordmark over 68–98%. Darkening starts at 35% and reaches the original exposure at the end. These are fractions of the existing zoom interval (product chapter progress 0.3–0.7), not additional section height or time-based animations.

At the zoom midpoint, the seal and wordmark remain hidden and exposure is above 0.9. At three quarters, the seal is half visible instead of the previous 93.75%. Both seal and branding are fully revealed before the product tilts. The timeline owns the named timing intervals in `PRODUCT_REVEAL`; ProductModel applies the individual material opacities while retaining seal occlusion. Direct seeking, reverse scrolling and mobile use the same absolute-progress staging.

This changes only opacity and exposure values: no additional geometry, materials, draws, shader variants or assets. Desktop and mobile comparisons at the end of the zoom and in the final product pose were pixel-identical to the previous version. Before/after sequences are retained in `test-results/reveal-timing/`. Eight targeted checks passed in each of Chrome and WebKit, covering staging and reverse seeking, partial-opacity tab occlusion, cap continuity, product interaction and shader/texture reuse. Build, formatting and Git whitespace checks also passed.

### Continuous interior-to-seal handoff

Dense sampling exposed a discontinuity missed by the earlier keyframe comparisons: the seal's depth-only draw ran before the internal product surfaces. As the camera crossed the seal, it abruptly blocked those surfaces, even while the seal color was nearly invisible. The transition now renders the interior first, then seal depth, seal color, the rim and branding. This keeps the optical interior visible beneath the fade while preserving the pull tab's occlusion of the orange rim. Normal sorting resumes in the final product phase.

This supersedes the separate seal and wordmark timing above. Both now fade together over 70–98% of the zoom interval, after the camera clears the seal on desktop and mobile. Optical refraction, body timing, exposure and movement retain their existing curves. There are no additional materials, geometry, draw passes or per-frame allocations.

A 421-position sweep from product progress 0.300 to 0.720 checked adjacent rendered frames on desktop (1440 × 900, DPR 2) and mobile (390 × 844, DPR 3). At the desktop seal crossing, the mean RGB frame difference dropped from 7.14 to 1.38 levels out of 255; the corrected mobile crossing measured 1.76. These are image-continuity measurements, not frame-rate measurements. Final-product desktop/mobile captures were pixel-identical to the previous version. Diagnostic sequences and sweep JSON are retained in `test-results/seamless/`.

Rendered-pixel regressions cover the crossing in both scroll directions, including revisiting it after the final product phase. They supplement the partial-opacity tab occlusion, reveal timing, cap continuity, product interaction and Retina shader/texture reuse checks. All ten targeted checks passed in Chrome and all ten passed in WebKit. Build, formatting and Git whitespace checks passed; the JavaScript bundle is 688,482 bytes (179,458 gzip).

## Product loading: cell-first downloads and lossless transfer

The product GLB contains all eight meshes and five embedded images; there are no separate cap/base downloads. In the previous sequence, the three cell models and environment loaded first, the hero shaders warmed, and an idle callback then started the product download (1,500 ms timeout, or a 300 ms timer fallback). Product parsing, both shader phases and two GPU warm-up draws followed before the product was exposed to the timeline.

On 2026-10-25, the published here.now asset response advertised 989,096 bytes with no content encoding. A local cold-cache Chrome test at 500,000 bytes/s, 100 ms latency and 4× CPU throttling measured about 2.08 seconds for that transfer. The initial idle callback ran within a few milliseconds in those samples: the dominant cost was the uncompressed transfer, not the nominal 1.5-second idle timeout.

The build now generates `swap.glb.gz` at 441,371 bytes, a **55.4% reduction**, and retains the original GLB for browsers without native `DecompressionStream`. Decompressing the built file was verified byte-identical to the source. No model, texture, animation, material or camera-path data changed. The product starts downloading as soon as the cell models and environment are ready, overlapping hero GPU preparation; a first-frame promise delays product parsing and GPU work until the first story frame has been submitted and the app yields a task. Teardown aborts the fetch and releases that wait. Product errors, manual retry and the existing single shared preparation promise remain in place.

Across three hardware-rendered Chrome samples per version under those network/CPU settings, median product transfer time fell from **2.082 s to 0.990 s**. Median time from the first hero frame to product readiness fell from **2.288 s to 1.146 s**. Median hero readiness remained about **5.1 s**. These small local samples are not a device guarantee: one new-version sample spent 1.8 seconds in shader preparation and took 2.86 seconds after the hero. Separate software-rendered Chromium runs were much slower, reinforcing that GPU/driver behavior is independent of download size. Raw stages and resource timings are in `test-results/loading/{baseline,optimized,baseline-headless,optimized-headless}.json`. Chrome startup was intermittently blocked in this environment; the later hardware runs used an in-process network-service launch workaround. Timing starts at page navigation, not browser launch.

All 40 distinct checks passed in Chrome and WebKit across the validation runs, including the two new loading-order/native-decompression-fallback checks. The full Chrome run had 39 passes and one browser-launch timeout before the test began; that check passed when rerun. The full WebKit run had 39 passes and one intermittent reduced-motion assertion; the isolated rerun passed without a code change. Delayed delivery, manual retry, reverse scrolling, resource reuse, teardown and GPU recovery checks passed. Formatting, whitespace and production build checks passed; the JavaScript bundle is 689,021 bytes (179,679 gzip), an increase of 221 gzip bytes. These changes were subsequently published to the separate here.now demo; see the hosted validation below.

## Tradeoffs and limits

The refraction change is an intermediate-rendering adjustment, not mathematically identical rendering during the overlap. The full-resolution hero and final-product policy is retained. Two transmission target sizes stay resident to avoid allocation churn, so intermediate-buffer memory is higher than with a single target. GPU preparation performs bounded extra loading draws and fetches the product earlier; it does not make that work free.

The canvas intentionally tops out at 60 fps even on faster displays. The page stops rendering when settled. This favors predictable frame delivery and lower GPU/power usage over attempting 120 full-resolution 3D frames per second.

WebKit and throttled-network checks now supplement the Chrome results. Stock Safari 26.5.2 was also checked through the native UI: the hero rendered and chapter navigation reached the product. Its WebDriver suite could not run because “Allow remote automation” is disabled. No connected physical device or configured iOS simulator was available. Real iOS/Android GPU and thermal performance remain unverified; mobile viewport emulation is not a physical-phone performance result. Browser/device variability and first-load preparation remain relevant; this report does not promise zero missed frames on every device.

Run commands and artifact locations are documented in [README.md](README.md). Benchmark JSON and PNG pairs are retained under `test-results/`; Playwright uses its own subdirectory so it does not erase profiling evidence.

## Hosted loading and conditional preview — October 25

The loader update was published to the existing permanent here.now demo without changing production `taxa.tech` or remote `main`. A cold mobile-viewport Chrome run at 375,000 bytes/s, 150 ms latency and 4× CPU throttling reproduced a blank product view when jumping directly from the first hero frame to the final section. The jump occurred at 5.701 s and the product was ready at 7.337 s. The compressed model transferred from 5.607 s to 7.069 s; the initial request uses 441,371 bytes. This is one diagnostic sample, not a general load-time guarantee.

A conditional fallback now holds the cell at its pre-product pose while the model is unavailable. If the reader reaches the final product text, it requests a responsive still captured from the actual final 3D scene: 40,646 bytes on mobile or 76,858 bytes on desktop. The preview fades out only after a real frame renders at the current scroll position. Reverse scrolling hides it, image failure retains the cell, and normal visits with a ready model make no preview request. Loaded-model animation, geometry, materials and camera paths remain unchanged. The preview adds no model variants or runtime dependencies. Regeneration instructions are in README.

All 43 Chrome checks passed in one run. WebKit passed 42 in the full run; the existing live reduced-motion assertion failed intermittently and passed in isolation without a source change. All new delayed-loading, preview-failure and zero-unnecessary-download checks passed in both browsers. Production build, source formatting and Git whitespace checks passed. The bundle is 690,152 bytes (180,058 gzip), adding 379 gzip bytes relative to the loader-only version; CSS is 10,943 bytes (3,222 gzip).

Hosted evidence is retained under `test-results/hosted-loading/`. Mobile viewport/network throttling tests do not establish physical-device GPU or thermal performance: no physical phone or booted iOS simulator was available.

The fallback is live as here.now version `01M5TE267QRGPB0RYE6FBWV43A`. In the hosted cold mobile fast-jump rerun under the same throttle, arrival at 5.395 s retained the visible cell while the product was unavailable. The 40,646-byte preview request finished at 5.837 s; the product rendered and the preview was hidden by 7.117 s, with scroll position unchanged at 15,868 px and no JavaScript errors. Hosted WebKit mobile navigation returned HTTP 200, displayed the hero and product, requested no preview when ready, and had no failed requests or JavaScript errors. An initial Chrome browser-page creation stalled before navigation and was restarted; this browser startup issue is excluded from page timings.

The hosting helper reported its generic WebAssembly/cross-origin-isolation notice. The included Draco decoder uses independent workers without shared-memory pthreads, so cross-origin isolation is not required for this build; both hosted browsers decoded the cell successfully. The authenticated deployment remains permanent on the existing account with no plan upgrade.

## Webflow compatibility review — November 9

The live Webflow animation and scroll scripts were byte-identical to the repository's original `origin/main` copies during review. The demo's missing topic fills, stretched-circle chapter indicators and mobile footer collision were CSS differences. The standalone demo now restores production topic colors/hover fills, uses a 48 px tall indicator with circular ends, and mirrors the mobile-home footer policy while retaining legal links in its menu.

A separate bundled `js/core/anim.js` entry now connects the optimized renderer to the unmodified production story structure. It reads the existing section dimensions and maps existing `.child`/`.zoom-child` elements, pod IDs and CTA tint target. It does not initialize the standalone page controls or replace Webflow navigation/forms. Asset URLs resolve from the animation host, including the environment, decoder, models and optional preview. Existing body loading classes are released only after the first rendered frame. No phase boundaries, product poses, reveal curves or section heights changed in this compatibility pass.

The generated local production-page snapshot and integration harness verify desktop (1440 × 900) and mobile (390 × 844) in Chrome and WebKit. Both engines passed: section dimensions and IDs remain identical before/after initialization, assets load from a separate animation origin, topic fills and native indicator styling remain intact, forward/reverse poses and final cap locking evaluate correctly, pod changes update labels and CTA tint, and the mobile menu/footer work. No page JavaScript errors were recorded. Screenshots and JSON are retained in `test-results/webflow/`.

All 43 existing demo checks passed across the Chrome validation runs. The first run passed 39: three failures were hard-coded references to port 4173 (occupied by another local project), and one was an ambiguous selector after adding menu legal links. The tests now use their configured base URL, the legal row has a distinct class, and all four targeted reruns passed. Build, source formatting and Git whitespace checks passed. This work is local only; production Webflow, remote main and the previously published here.now demo were not updated.

## Production reflection appearance — November 9, 2026

The flatter outer blobs were a rendering regression. Production first converted `aloe.hdr` into a PMREM CubeUV atlas, then marked that atlas as equirectangular. Three processed it a second time. Removing that second interpretation during optimization changed the reflection pattern even though the HDR, model and material settings matched. Fetching production's actual HDR confirmed its SHA-256 matches the local source (`213321ebbdaed2c3d3db5354868b3ccd29dfcfb102296bcde1cb0622edfc0bf6`). Controlled captures of the live production app confirmed that restoring its mapping restored the distinctive rippled highlights.

The new implementation prepares that production treatment offline with `npm run bake:reflections`. The generated `assets/cell/reflections.bin` contains a validated 16-byte header and a 336 × 256 linear RGBA16F atlas. It is uploaded directly as a CubeUV DataTexture. No material colors, exposure, tone mapping, geometry, section heights or animation progress curves change. This also retains the existing separate mobile material treatment. Both product fallback previews have been recaptured under the restored reflections.

| Resource | Previous optimized loader | Prepared reflection loader |
| --- | --- | --- |
| Environment transfer, native decompression | 451,261-byte HDR | 200,429-byte gzip binary (55.6% smaller) |
| Environment texture storage, excluding driver overhead | 1,572,864 bytes | 688,128 bytes (56.25% smaller) |
| Retained CPU texels for recovery | 1,048,576 bytes | 688,128 bytes |
| Reflection preparation per visit | HDR decode plus GPU PMREM filtering | Lossless decompression and direct texture upload |
| Context recovery | Recreate filtered target from HDR | Reupload retained texels, no request or filtering |

Browsers without native `DecompressionStream` fetch the 688,144-byte raw file; their transfer is larger than the prior HDR, while GPU preparation and storage still improve. Both files must accompany the animation bundle. Invalid/truncated data or a mismatched Three revision fails into the existing readable-content fallback. The original HDRs remain in the repository for offline baking but are excluded from `dist`.

Before integration, isolated GPU timer queries compared the previous optimized map, the production-style map and its prepared equivalent over 80 samples per variant. At 1440 × 989 / DPR 2, median GPU times were 10.55 / 10.45 / 10.60 ms; at 729 × 989 / DPR 2 they were 1.17 / 1.17 / 1.11 ms. These do not establish a steady-state frame-rate improvement. The benefit is avoiding reflection preparation and reducing asset/memory cost while restoring appearance. The production-style extra first-use conversion submitted 17 internal rendering calls in that diagnostic; the prepared map needs none. These desktop GPU measurements are not phone benchmarks.

`scripts/check-reflections.mjs` compares the shipped asset against production's original HDR processing in the same scene at three viewport widths (390, 729, 1440), two hero angles, the zoom and pitch palettes, and three product poses. It saves reference/current images and numeric differences under `test-results/reflections/{chrome,webkit}`. The baked texels match the production-look prototype byte for byte. The runtime bundle no longer imports RGBELoader; the Webflow animation entry is 684,996 bytes / 178,261 gzip. This update is local to the optimization branch.

Validation covered 21 reflection comparisons per browser in Chrome and WebKit. Every desktop comparison was pixel-identical; mobile differences were isolated to tiny rounding changes (maximum mean RGBA byte difference below 0.00008/255, with fewer than 0.0003% of pixels differing by more than 8/255). These are controlled captures on a desktop GPU, not proof of identical output on every driver.

The 46-test suite passed 45 checks in each full browser run. The remaining mobile crossing test used an absolute pixel-change limit calibrated to the flatter reflections: restored lighting changed that result from below 2 to about 2.15/255. Neighboring equal scroll increments changed by 2.12–2.25/255, confirming continuous optical motion. Deliberately restoring the broken depth order produced a 48.38/255 jump. The regression assertion now compares the crossing with its neighbors and still rejects that failure. Both crossing tests and affected teardown/failure checks passed in six-test focused reruns in each browser; all 46 checks therefore pass across those runs. Desktop/mobile integration with captured production Webflow markup also passed in both browsers, preserving section geometry and resolving assets against the separate animation origin. Build, formatting and Git whitespace checks passed.

## Lossless geometry and asset cleanup — November 9, 2026

This pass preserves the restored production reflections and all animation parameters. Source GLBs remain untouched. The build creates prepared runtime GLBs, and the shared model loader compacts eligible Draco indices once before upload.

| Resource | Before | After | Saving |
| --- | ---: | ---: | ---: |
| Unique non-instanced model geometry buffers | 7,426,938 bytes | 5,135,584 bytes | 2,291,354 bytes (30.85%) |
| Product GLB, raw compatibility download | 989,096 bytes | 867,484 bytes | 121,612 bytes (12.30%) |
| Product GLB, gzip download | 441,371 bytes | 431,557 bytes | 9,814 bytes (2.22%) |
| Ribbon GLB | 258,692 bytes | 258,620 bytes | 72 bytes |

The geometry-buffer saving applies to the retained typed arrays and their corresponding GPU buffers, excluding driver overhead and other scene resources. It is not a claim of a 31% reduction in total browser memory or rendering time. Index compaction accounts for 1,717,170 bytes; removing unused ribbon normals, product UVs and unlit wordmark normals accounts for the other 574,184 bytes. No vertex positions, triangle ordering, used normals/UVs, transforms or retained texture pixels are altered. There is no decimation, image recompression or new Draco quantization.

The ribbon's compressed payload remains byte-identical. Its metadata no longer requests normal extraction, avoiding a 538,848-byte attribute allocation/worker transfer/upload while retaining the existing compression. Draco still returns Uint32 triangle indices; the loader converts those to Uint16 only when all values are below 65535. The product's corresponding conversion happens at build time. The WebGL primitive-restart boundary and larger indices retain their original type.

The build also removes the exported pod materials and their 63 × 243 normal image, which the runtime replaces before rendering. That image previously incurred decoding but was not used by the final material, so its removal is not counted as a GPU texture saving. Four retained embedded images are byte-identical. The script remaps material, texture, sampler, accessor and buffer-view references and preserves the node hierarchy. The raw and gzip product files both contain the prepared model. Existing fallback previews stay unchanged because the final product appearance is preserved.

`npm run test:assets` checks retained vertex bytes, exact triangle values/order, hierarchy, retained image bytes, byte-identical ribbon Draco data and Uint16 boundary behavior. `scripts/check-geometry.mjs` loads the frozen pre-cleanup build and current build, verifies decoded positions/indices and effective material settings, and renders their geometry through the same renderer. Original geometry is copied into the current JavaScript realm with distinct geometry IDs to avoid cross-bundle cache collisions. The 171-pose sequence per viewport covers the hero at three angles, all colored topics, mobilization, 101 forward product poses, each pod color, 51 reverse product poses and reverse chapter visits. Viewports are 390 × 844 and 1440 × 900 at DPR 2. Captures include the cap reveal, optical interior and closing/twisting sequence.

These comparisons use a small rasterization tolerance (mean RGBA difference below 0.05/255, with fewer than 0.1% of pixels changing by more than 8/255). Exact hashes were unsuitable on the mobile rendering path: repeated renders of unchanged geometry and identical-build comparisons also produced isolated edge changes. Actual measured differences and before/after images are saved under `test-results/geometry/`; the source geometry checks remain exact. This is desktop hardware exercising mobile layouts, not a physical-phone benchmark.

All 684 visual comparisons passed across Chrome and WebKit (171 poses × two viewport sizes × two browsers). Every desktop comparison was pixel-identical. The worst mobile mean RGBA difference was 0.001502/255 in Chrome and 0.000899/255 in WebKit; fewer than 0.0091% of pixels differed by more than 8/255. Triangle and draw counts were identical in every comparison. All 46 interaction/recovery tests passed in full runs in each browser, including fades, cap/interior continuity, delayed loading, pod changes, reverse scroll, warmed shader reuse and context recovery. Captured production Webflow integration also passed on desktop/mobile in both browsers, preserving section dimensions and cross-origin asset loading.

An initial WebKit paired-page visual sweep encountered a shader-creation error while retaining the reference page's GPU resources. The harness now copies the required reference data, disposes its renderer and removes the reference frame before the dense sweep; the complete rerun passed. These diagnostic allocations are not part of the site. This pass measures storage and visual preservation, not a new frame-rate improvement. The Webflow bundle is 685,174 bytes / 178,329 gzip, 68 gzip bytes above the preceding reflection update. Nothing was published or pushed to production.


## Naming, structure and verification cleanup — November 9, 2026

The current appearance and scroll timing remain unchanged. `PRODUCT_TIMING` names the existing zoom, tilt, turn, cap descent, lock, lighting and interaction boundaries, retaining explicit durations and the original interpolation arithmetic. `ZoomStreaks`, `prepareProduct` and `turnProgress` replace misleading names. Product setup collects mesh/material references once; material-phase changes and pod selection reuse those collections. The unused streak shader uniform, redundant setup passes, obsolete material-update helper and stale comments were removed.

All preview-based diagnostics now share `PREVIEW_URL`, then `PORT`, then port 4173. The transition benchmark retains legacy names only when accessing frozen comparison builds. `npm run verify` checks formatting, builds, validates prepared assets, captures the production Webflow page and runs both browser suites and integration checks on an isolated loopback port. Its server is disposed on success or failure. Reference-image sweeps remain separate because they require retained baseline builds.

A frozen copy of commit `b541085` was compared with the cleanup build at 390 × 900 and 1440 × 900, DPR 2. All 684 animation-state comparisons matched exactly across Chrome and WebKit (171 poses × two sizes × two engines): transforms, visibility, material settings/colors, lighting, text state, pod selection, draw calls and triangles. The sequence covers the hero, topic colors, pitch, dense forward and reverse product progress, pod changes and reverse chapter visits. Eighteen selected screenshot pairs per browser had maximum mean RGBA differences of 0.0000611/255 in Chrome and 0.0000769/255 in WebKit, confined to small rasterization differences between separate WebGL contexts. Results and screenshots are retained under `test-results/polish/`. These desktop-browser comparisons do not replace physical-device testing.

The first verification run exposed a test synchronization race: WebKit may apply `scrollTo` asynchronously, and the old helper could accept the previous position when both seeks stayed in one chapter. The helper now waits for the requested, document-clamped position and timeline update before asserting animation state. This changes test synchronization only. The complete `npm run verify` rerun passed: 46 browser tests in each engine (92 total), desktop/mobile Webflow integration in both engines, build, prepared-asset integrity and source formatting. Git whitespace checks also passed.

The Webflow bundle is 685,284 bytes / 178,399 gzip, 70 gzip bytes above the geometry-cleanup build. This pass improves maintainability and avoids repeated collection/traversal work; it does not establish a new frame-rate improvement. No source assets, section heights, visual parameters or loading order changed. Nothing was published or pushed.
