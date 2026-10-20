import { test, expect } from "@playwright/test";

async function ready(page) {
  await page.goto("/?perf");
  await page.waitForFunction(() => window.taxaDebug?.app.isInitialized);
}
async function seek(page, section, progress = 0) {
  await page.evaluate(
    ({ section, progress }) => {
      const app = window.taxaDebug.app;
      const i = ["splash", "zoom", "pitch", "product"].indexOf(section);
      const { top, height } = app.timeline.bounds[i];
      window.scrollTo(
        0,
        top + (height - (i === 3 ? innerHeight : 0)) * progress + 1,
      );
      app.invalidate(true);
    },
    { section, progress },
  );
  await page.waitForFunction(
    () => window.taxaDebug.app.timeline.lastY === scrollY,
  );
  await expect(page.locator("body")).toHaveAttribute("data-chapter", section);
}

test("story seeks forward and backward, loads one product, and preserves GPU resources", async ({
  page,
}) => {
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await ready(page);
  await expect(page.locator("#splash .child")).toHaveClass(/active/);
  await expect(page.locator(".three canvas")).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.taxaDebug.app.timeline.innerMaterial.color.getHexString(),
    ),
  ).toBe("6175aa");
  expect(
    requests.filter((url) => url.includes("swap.glb")).length,
  ).toBeLessThanOrEqual(1);
  for (const [p, label] of [
    [0.1, "zoomFirst"],
    [0.45, "zoomSecond"],
    [0.8, "zoomThird"],
  ]) {
    await seek(page, "zoom", p);
    await expect(page.locator(`#${label}`)).toHaveClass(/active/);
  }
  await seek(page, "pitch", 0.5);
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await expect(page.locator("#product .child")).toHaveClass(/active/);
  const productState = await page.evaluate(() => {
    const a = window.taxaDebug.app,
      p = a.product.getObject();
    return {
      visible: p.visible,
      scale: p.scale.x,
      x: p.position.x,
      meshes: [],
    };
  });
  expect(productState.visible).toBe(true);
  expect(productState.scale).toBeCloseTo(5.5);
  expect(productState.x).toBeCloseTo(-20);
  await page.locator("#podYellow").click();
  await expect(page.locator("#podYellow")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 6000 },
  );
  await expect(page.locator("#productType")).toHaveText("sunscreen");
  await expect(page.locator("#podGreen")).toBeEnabled();
  await page.locator("#podGreen").click();
  await expect(page.locator("#podGreen")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 6000 },
  );
  await seek(page, "product", 0.5);
  await seek(page, "zoom", 0.1);
  await expect(page.locator("#zoomFirst")).toHaveClass(/active/);
  await seek(page, "splash", 0.1);
  await expect(page.locator("#splash .child")).toHaveClass(/active/);
  await seek(page, "product", 0.99);
  await page.waitForTimeout(1800);
  expect(requests.filter((url) => url.endsWith("/swap.glb"))).toHaveLength(1);
  expect(
    requests
      .filter((url) => /^https?:/.test(url))
      .every((url) => url.startsWith("http://127.0.0.1:4173/")),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("static product and paused hero stop rendering; scroll invalidates them", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#motion-toggle").click();
  await page.waitForTimeout(2000);
  const before = await page.evaluate(
    () => window.taxaDebug.performanceMonitor.frames,
  );
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBe(before);
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.waitForTimeout(2500);
  const productFrames = await page.evaluate(
    () => window.taxaDebug.performanceMonitor.frames,
  );
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBe(productFrames);
  await seek(page, "zoom", 0.5);
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBeGreaterThan(productFrames);
});

test("mobile layout, menu, contact, and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".menu-toggle").click();
  await expect(page.locator(".menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.locator(".contact-mobile").click();
  await expect(page.locator("#contact-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#contact-dialog")).not.toBeVisible();
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await expect(page.locator("#product .child")).toHaveClass(/active/);
  const box = await page.locator(".product-cta").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  expect(box.y + box.height).toBeLessThanOrEqual(845);
  await page.locator("#podGreen").click();
  await expect(page.locator("#podGreen")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("failed product request can be retried without losing scroll position", async ({
  page,
}) => {
  let first = true;
  await page.route("**/swap.glb", (route) => {
    if (first) {
      first = false;
      return route.abort();
    }
    return route.continue();
  });
  await ready(page);
  await seek(page, "product", 0.99);
  await expect(page.locator("#retry-load")).toBeVisible();
  const y = await page.evaluate(() => scrollY);
  await page.locator("#retry-load").click();
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await expect(page.locator("#product .child")).toHaveClass(/active/);
});

test("resizing a settled product recomputes its pose and preserves resource counts", async ({
  page,
}) => {
  await ready(page);
  await seek(page, "zoom", 0.5);
  await page.waitForTimeout(600);
  await seek(page, "product", 0.5);
  await page.waitForTimeout(300);
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.waitForTimeout(1800);
  const initial = await page.evaluate(
    () => window.taxaDebug.app.sceneManager.renderer.info.memory.geometries,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.taxaDebug.app.timeline.mobile);
  await seek(page, "product", 0.99);
  expect(
    await page.evaluate(() => window.taxaDebug.app.product.getObject().scale.x),
  ).toBeCloseTo(5.2);
  expect(
    await page.evaluate(() => window.taxaDebug.app.sceneManager.camera.fov),
  ).toBe(90);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => !window.taxaDebug.app.timeline.mobile);
  await seek(page, "product", 0.99);
  for (let i = 0; i < 3; i++) {
    await seek(page, "zoom", 0.5);
    await seek(page, "product", 0.99);
  }
  await page.waitForTimeout(1800);
  const final = await page.evaluate(
    () => window.taxaDebug.app.sceneManager.renderer.info.memory.geometries,
  );
  expect(final).toBe(initial);
});

test("chapter buttons seek the product and wheel input wakes a settled scene", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-section="product"]').click();
  await expect(page.locator("#product .child")).toHaveClass(/active/, {
    timeout: 10000,
  });
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, -900);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeLessThan(before - 100);
  await page.locator(".brand").click();
  await expect(page.locator("#splash .child")).toHaveClass(/active/, {
    timeout: 10000,
  });
});

test("a failed cell model leaves the story readable", async ({ page }) => {
  await page.route("**/blob-inner.glb", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/scene-failed/);
  await expect(page.locator("#splash-title")).toBeVisible();
  await expect(page.locator("#loadProgressCount")).toContainText(
    "could not load",
  );
});

test("120 Hz updates pace rendering and retain the final pending frame", async ({
  page,
}) => {
  await ready(page);
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.waitForTimeout(1800);
  const result = await page.evaluate(() => {
    const a = window.taxaDebug.app;
    cancelAnimationFrame(a.animationFrameId);
    a.isInitialized = false;
    a.motionPaused = true;
    a.reducedMotion = true;
    a.lastFrameTime = null;
    a.lastRenderTime = null;
    a.sceneManager.controls.update = () => false;
    let draws = 0;
    a.sceneManager.render = () => draws++;
    const start = performance.now();
    for (let i = 0; i < 14; i++) {
      a.dirty = true;
      a.frame(start + (i * 1000) / 120);
    }
    const pending = a.dirty;
    const pacedDraws = draws;
    a.frame(start + (14 * 1000) / 120);
    return { pending, pacedDraws, finalDraws: draws, dirty: a.dirty };
  });
  expect(result).toEqual({
    pending: true,
    pacedDraws: 7,
    finalDraws: 8,
    dirty: false,
  });
});

for (const [name, width, height, dpr] of [
  ["desktop", 1440, 900, 2],
  ["mobile", 390, 844, 3],
]) {
  test(`${name} Retina transitions reuse warmed shaders and transmission targets`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4173",
      viewport: { width, height },
      deviceScaleFactor: dpr,
      hasTouch: name === "mobile",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await ready(page);
    await seek(page, "zoom", 0.2);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    const programs = await page.evaluate(
      () => window.taxaDebug.app.sceneManager.renderer.info.programs.length,
    );
    let warmedTextures;
    for (let visit = 0; visit < 3; visit++) {
      for (const p of [0.2, 0.32, 0.55, 0.69, 0.71, 0.99, 0.55, 0.2]) {
        await seek(page, "product", p);
        const stats = await page.evaluate(() => {
          const { renderer } = window.taxaDebug.app.sceneManager;
          return {
            programs: renderer.info.programs.length,
            textures: renderer.info.memory.textures,
            scale: renderer.transmissionResolutionScale,
            width: renderer.domElement.width,
          };
        });
        expect(stats.programs).toBe(programs);
        expect(stats.width).toBe(width * dpr);
        expect(stats.scale).toBe(p > 0.3 && p <= 0.7 ? 1 / dpr : 1);
        if (visit && p === 0.2) expect(stats.textures).toBe(warmedTextures);
        if (visit === 0) warmedTextures = stats.textures;
      }
    }
    await context.close();
  });
}
