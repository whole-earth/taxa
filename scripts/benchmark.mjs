import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Optional comparison: BASELINE_URL must serve main's original animation with
// the same HTML, CSS, assets, viewport and DPR. Never measures production traffic.
const targets = [["optimized", "http://127.0.0.1:4173/?perf"]];
if (process.env.BASELINE_URL)
  targets.unshift(["baseline", process.env.BASELINE_URL]);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = {};
await mkdir("test-results/benchmark", { recursive: true });
for (const [name, url] of targets) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(url);
  await page.waitForFunction(
    () => (window.taxaDebug?.app ?? window.taxaBaseline)?.isInitialized,
  );
  await page.evaluate(() => {
    const app = window.taxaDebug?.app ?? window.taxaBaseline;
    const renderer = app.sceneManager.renderer;
    const render = renderer.render.bind(renderer);
    window.bench = { renders: 0, intervals: [], last: 0 };
    renderer.render = (...args) => {
      const time = performance.now();
      if (window.bench.last)
        window.bench.intervals.push(time - window.bench.last);
      window.bench.last = time;
      window.bench.renders++;
      return render(...args);
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = async () =>
    Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
        m.name,
        m.value,
      ]),
    );
  results[name] = {};
  for (const [stage, y] of [
    ["hero", 1],
    ["zoom", 1200],
    ["product", 10600],
  ]) {
    // Walk through transitions so the baseline can reach its final phase.
    const from = await page.evaluate(() => scrollY);
    for (let position = from; position < y; position += 200) {
      await page.evaluate((position) => window.scrollTo(0, position), position);
      await page.waitForTimeout(20);
    }
    await page.evaluate((y) => {
      window.scrollTo(0, y);
      window.taxaDebug?.app.invalidate(true);
    }, y);
    await page.waitForTimeout(stage === "product" ? 5000 : 2600);
    await page.evaluate(() => {
      window.bench.renders = 0;
      window.bench.intervals = [];
      window.bench.last = 0;
    });
    const before = await metrics();
    await page.waitForTimeout(3000);
    const after = await metrics();
    results[name][stage] = await page.evaluate(() => {
      const { renders, intervals } = window.bench;
      intervals.sort((a, b) => a - b);
      const app = window.taxaDebug?.app ?? window.taxaBaseline;
      return {
        renders,
        medianFrameMs: intervals[Math.floor(intervals.length * 0.5)] ?? 0,
        p95FrameMs: intervals[Math.floor(intervals.length * 0.95)] ?? 0,
        drawCalls: app.sceneManager.renderer.info.render.calls,
        triangles: app.sceneManager.renderer.info.render.triangles,
        geometries: app.sceneManager.renderer.info.memory.geometries,
      };
    });
    for (const metric of [
      "TaskDuration",
      "ScriptDuration",
      "LayoutDuration",
      "RecalcStyleDuration",
    ])
      results[name][stage][`${metric}Ms`] = +(
        1000 *
        (after[metric] - before[metric])
      ).toFixed(2);
    await page.screenshot({
      path: `test-results/benchmark/${name}-${stage}.png`,
    });
  }
  await page.close();
}
await browser.close();
await writeFile(
  "test-results/benchmark/results.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
