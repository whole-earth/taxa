import { previewBase } from "./preview.mjs";
// Run after npm run build && node scripts/preview-webflow.mjs, with dist served.
// Tests the real captured Webflow DOM with the animation on a different origin.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "@playwright/test";

const origin = "https://animation-preview.invalid";
const base = previewBase;
const engine = process.env.BROWSER === "webkit" ? webkit : chromium;
const browser = await engine.launch(
  engine === chromium ? { channel: "chrome" } : {},
);
const results = [];
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const mobile = viewport.width < 768;
    const page = await browser.newPage({ viewport, hasTouch: mobile });
    const errors = [],
      assets = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/\.(?:glb|gz|hdr|wasm)(?:\?|$)/.test(request.url()))
        assets.push(request.url());
    });
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(`${origin}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/anim.js")) await gate;
      await route.fulfill({
        body: await readFile(`dist${path}`),
        headers: { "Access-Control-Allow-Origin": "*" },
        contentType: path.endsWith(".js")
          ? "text/javascript"
          : "application/octet-stream",
      });
    });
    await page.route("**/webflow.html?perf", async (route) =>
      route.fulfill({
        contentType: "text/html",
        body: (await readFile("dist/webflow.html", "utf8")).replace(
          'src="./js/core/anim.js"',
          `src="${origin}/js/core/anim.js"`,
        ),
      }),
    );
    await page.goto(`${base}/webflow.html?perf`, { waitUntil: "commit" });
    await page.waitForSelector(".main > .product", { state: "attached" });
    // WebKit may wait for module completion before fonts.ready settles. The
    // held module must not block this baseline measurement of vh-sized sections.
    await page.waitForFunction(
      () =>
        document.querySelector(".main > .product").offsetHeight >
        innerHeight * 5,
    );
    const measure = () =>
      ["splash", "zoom", "pitch", "product"].map((name) => {
        const element = document.querySelector(`.main > .${name}`);
        return {
          name,
          id: element.id,
          height: element.offsetHeight,
          top: element.offsetTop,
        };
      });
    const before = await page.evaluate(measure);
    release();
    await page.waitForFunction(() => !!window.taxaDebug?.app.product, null, {
      timeout: 60000,
    });
    assert.deepEqual(
      await page.evaluate(measure),
      before,
      "Animation changed Webflow section geometry/IDs",
    );
    assert(
      assets.length >= 5 && assets.every((url) => url.startsWith(origin)),
      "Assets must resolve against the animation host",
    );
    assert.equal(await page.locator(".load-progress").isVisible(), false);
    assert.equal(await page.locator("#motion-toggle").count(), 0);
    assert.deepEqual(
      await page.locator("body").evaluate((body) => ({
        ready: body.classList.contains("scene-ready"),
        completing: body.classList.contains("completing"),
        loading: body.classList.contains("loading"),
      })),
      { ready: true, completing: true, loading: false },
    );
    const colors = await page
      .locator(".zoom-child-elem")
      .evaluateAll((elements) =>
        elements.map((e) => getComputedStyle(e).backgroundColor),
      );
    assert.deepEqual(colors, [
      "rgba(255, 212, 156, 0.5)",
      "rgba(255, 247, 156, 0.5)",
      "rgba(210, 236, 191, 0.5)",
    ]);
    const poses = [];
    for (const progress of [0.4, 0.7, 0.8, 0.9, 0.95, 1, 0.6]) {
      await page.evaluate((progress) => {
        const app = window.taxaDebug.app;
        const { top, height } = app.timeline.bounds[3];
        window.scrollTo(0, top + (height - innerHeight) * progress);
        app.invalidate(true);
      }, progress);
      await page.waitForFunction(
        () => window.taxaDebug.app.timeline.lastScrollY === scrollY,
      );
      poses.push(
        await page.evaluate(() => {
          const app = window.taxaDebug.app;
          return {
            y: scrollY,
            progress: app.timeline.progress(3, scrollY),
            capY: app.product.applicator.position.y,
            capRotation: app.product.applicator.rotation.y,
          };
        }),
      );
    }
    assert.equal(poses[4].capY, 0);
    assert(Math.abs(poses[5].capRotation - Math.PI * 0.26) < 0.0001);
    assert.equal(poses[6].capY, 1);
    await page.locator('.scroll-dot[data-section="product"]').click();
    await page.waitForFunction(
      () => window.taxaDebug.app.timeline.progress(3, scrollY) > 0.999,
    );
    await page.locator("#podGreen").click();
    await page.waitForFunction(
      () => window.taxaDebug.app.podSelector.currentPod === "green",
    );
    assert.equal(await page.locator("#showingLabel").textContent(), "Mosquito");
    assert(
      await page
        .locator(".product-card-section.module")
        .evaluate((e) => e.classList.contains("green")),
    );
    assert.equal(
      await page
        .locator(".scroll-dot.active")
        .evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    if (mobile) {
      assert.equal(await page.locator(".taxa-legal-footer").isVisible(), false);
      await page.locator(".nav-btn").click();
      await page.waitForFunction(() => window.taxaDebug.app.overlayActive);
      await page.locator(".nav-btn").click();
      await page.waitForFunction(() => !window.taxaDebug.app.overlayActive);
    }
    assert.deepEqual(errors, []);
    await mkdir("test-results/webflow", { recursive: true });
    await page.screenshot({
      path: `test-results/webflow/${engine.name()}-${mobile ? "mobile" : "desktop"}.png`,
    });
    results.push({ viewport, sections: before, colors, poses, assets, errors });
    await page.close();
  }
  await writeFile(
    `test-results/webflow/${engine.name()}.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(
    `${engine.name()}: Webflow desktop/mobile integration passed; section geometry preserved; cross-origin assets verified.`,
  );
} finally {
  await browser.close();
}
