import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Diagnostic ablations deliberately change appearance to isolate costs.
// They are never enabled in the application. GPU timings require a supported,
// non-disjoint EXT_disjoint_timer_query_webgl2 context.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const mobile = process.env.MOBILE === "1";
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 3 : 2,
  hasTouch: mobile,
});
await page.goto(process.env.BENCH_URL || "http://127.0.0.1:4173/?perf");
await page.waitForFunction(() => window.taxaDebug?.app.isInitialized);
const result = await page.evaluate(
  async ({ ablations, gpuTimers }) => {
    const a = window.taxaDebug.app;
    const r = a.sceneManager.renderer;
    const gl = r.getContext();
    const ext = gpuTimers && gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const started = performance.now();
    a.preloadProduct();
    await a.productPromise;
    const loadMs = performance.now() - started;
    // Reach the actual pre-transition palette and settle its time-based tweens.
    window.scrollTo(0, a.timeline.bounds[2].top + 1);
    a.invalidate(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    a.motionPaused = true;
    // Own the render loop for repeatable camera/progress. No concurrent app RAF.
    cancelAnimationFrame(a.animationFrameId);
    a.animationFrameId = null;
    a.isInitialized = false;
    a.sceneManager.controls.autoRotate = false;
    a.sceneManager.camera.position.set(0, 0, 60);
    a.sceneManager.camera.lookAt(0, 0, 0);
    const next = () => new Promise(requestAnimationFrame);
    const quantile = (arr, p) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return +(
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0
      ).toFixed(2);
    };
    const meshes = [];
    a.sceneManager.scene.traverse((n) => {
      if (n.isMesh)
        meshes.push({
          name: n.name,
          triangles:
            (n.geometry.index?.count || n.geometry.attributes.position.count) /
            3,
          instances: n.count || 1,
          material: n.material.type,
          transmission: n.material.transmission || 0,
          side: n.material.side,
          castShadow: n.castShadow,
          receiveShadow: n.receiveShadow,
        });
    });
    const runs = {};
    const shadowsEnabled = r.shadowMap.enabled;
    const { top, height } = a.timeline.bounds[3];
    const variants = ablations
      ? [
          "cold",
          "warm",
          "no-shadows",
          "no-stars",
          "no-cell",
          "no-product",
          "transmission-half",
          "dpr-one",
        ]
      : ["cold", "warm"];
    for (const variant of variants) {
      r.setPixelRatio(variant === "dpr-one" ? 1 : devicePixelRatio);
      r.shadowMap.enabled = shadowsEnabled && variant !== "no-shadows";
      const frames = [],
        pending = [];
      let last = await next();
      for (let i = 0; i < 150; i++) {
        const time = await next();
        const p = 0.2 + (i / 149) * 0.79;
        a.timeline.update(top + (height - innerHeight) * p);
        if (variant === "transmission-half")
          r.transmissionResolutionScale = 0.5;
        a.productAnchor.lookAt(a.sceneManager.camera.position);
        // Settle the initial material/particle tweens without introducing a
        // second loop. This sweep isolates rendering, not the tween scheduler.
        a.ribbons.getObject().visible = false;
        a.speckleSystem.instancedMeshes.forEach((m) => (m.visible = false));
        if (variant === "no-cell") a.cellObject.visible = false;
        if (variant === "no-product") a.product.getObject().visible = false;
        if (variant === "no-stars") a.starField.visible = false;
        let query;
        if (ext) {
          query = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        }
        const start = performance.now();
        a.sceneManager.render();
        const frame = {
          p: +p.toFixed(3),
          intervalMs: +(time - last).toFixed(2),
          submitMs: +(performance.now() - start).toFixed(2),
          calls: r.info.render.calls,
          triangles: r.info.render.triangles,
          programs: r.info.programs.length,
        };
        if (query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          pending.push({ query, frame });
        }
        frames.push(frame);
        last = time;
      }
      // Queries become available only after yielding to the browser.
      for (let i = 0; pending.length && i < 120; i++) {
        await next();
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        for (let j = pending.length - 1; j >= 0; j--) {
          const { query, frame } = pending[j];
          if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
            if (!disjoint)
              frame.gpuMs = +(
                gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6
              ).toFixed(2);
            gl.deleteQuery(query);
            pending.splice(j, 1);
          }
        }
      }
      runs[variant] = {
        summary: {
          intervalP50: quantile(
            frames.map((f) => f.intervalMs),
            0.5,
          ),
          intervalP95: quantile(
            frames.map((f) => f.intervalMs),
            0.95,
          ),
          slowFrames25ms: frames.filter((f) => f.intervalMs > 25).length,
          submitP95: quantile(
            frames.map((f) => f.submitMs),
            0.95,
          ),
          submitMax: Math.max(...frames.map((f) => f.submitMs)),
          gpuP50: quantile(
            frames.map((f) => f.gpuMs),
            0.5,
          ),
          gpuP95: quantile(
            frames.map((f) => f.gpuMs),
            0.95,
          ),
          gpuSamples: frames.filter((f) => f.gpuMs !== undefined).length,
          programs: r.info.programs.length,
        },
        frames,
      };
    }
    return {
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unknown",
      loadMs,
      meshes,
      runs,
      resources: performance
        .getEntriesByType("resource")
        .filter((x) => /glb|hdr|wasm/.test(x.name))
        .map((x) => ({
          url: x.name,
          bytes: x.encodedBodySize,
          duration: x.duration,
        })),
    };
  },
  {
    ablations: process.env.ABLATIONS !== "0",
    gpuTimers: process.env.GPU_TIMERS !== "0",
  },
);
await browser.close();
await mkdir("test-results/transition", { recursive: true });
const label = process.env.BENCH_LABEL || "current";
await writeFile(
  `test-results/transition/${label}.json`,
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify(
    {
      gpu: result.gpu,
      loadMs: result.loadMs,
      runs: Object.fromEntries(
        Object.entries(result.runs).map(([k, v]) => [k, v.summary]),
      ),
    },
    null,
    2,
  ),
);
