import { test, expect } from "@playwright/test";

import { ready, seek } from "./helpers.js";

test("cell stays hidden during loading and fades in after its first frame", async ({
  page,
}) => {
  let releaseCell;
  const cellGate = new Promise((resolve) => {
    releaseCell = resolve;
  });
  await page.route("**/blob-inner.glb", async (route) => {
    await cellGate;
    await route.continue();
  });
  await page.goto("/?perf", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".three")).toHaveCSS("opacity", "0");
  releaseCell();
  await page.waitForFunction(() => window.taxaDebug?.app.sceneRevealed);
  await page.waitForFunction(() => {
    const opacity = Number(
      getComputedStyle(document.querySelector(".three")).opacity,
    );
    return opacity > 0 && opacity < 1;
  });
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBeGreaterThan(0);
  await expect(page.locator(".three")).toHaveCSS("opacity", "1");
});

for (const mobile of [false, true]) {
  test(`dots fade out before changing color and position, then fade in (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    await seek(page, "zoom", 0.1);
    await page.waitForFunction(() =>
      window.taxaDebug.app.speckles.materials.every((m) => m.opacity === 1),
    );
    await page.evaluate(() => {
      const system = window.taxaDebug.app.speckles;
      window.dotChanges = [];
      const original = system.randomizePositions.bind(system);
      system.randomizePositions = () => {
        window.dotChanges.push(system.materials.map((m) => m.opacity));
        original();
      };
      window.dotFrames = [];
      window.recordDots = true;
      function sample() {
        const mesh = system.meshes[0];
        window.dotFrames.push({
          color: mesh.material.color.getHexString(),
          opacity: mesh.material.opacity,
          version: mesh.instanceMatrix.version,
        });
        if (window.recordDots) requestAnimationFrame(sample);
      }
      sample();
    });
    for (const [progress, color] of [
      [0.45, "f1ff00"],
      [0.8, "92cb86"],
      [0.1, "ffbb65"],
    ]) {
      await seek(page, "zoom", progress);
      await page.waitForFunction((color) => {
        const m = window.taxaDebug.app.speckles.materials[0];
        return m.color.getHexString() === color && m.opacity === 1;
      }, color);
    }
    const trace = await page.evaluate(() => {
      window.recordDots = false;
      return { frames: window.dotFrames, changes: window.dotChanges };
    });
    expect(trace.changes).toHaveLength(3);
    expect(trace.changes.flat().every((opacity) => opacity === 0)).toBe(true);
    for (const color of ["ffbb65", "f1ff00", "92cb86"]) {
      expect(
        trace.frames.some(
          (frame) =>
            frame.color === color &&
            frame.opacity > 0.05 &&
            frame.opacity < 0.95,
        ),
      ).toBe(true);
    }
    // Position buffers change just once per topic, never during the fade.
    expect(new Set(trace.frames.map((frame) => frame.version)).size).toBe(4);
    await page.evaluate(async () => {
      const app = window.taxaDebug.app;
      const { top, height } = app.timeline.bounds[1];
      scrollTo(0, top + height * 0.45);
      app.invalidate(true);
      await new Promise((resolve) => setTimeout(resolve, 80));
      scrollTo(0, top + height * 0.8);
      app.invalidate(true);
      await new Promise((resolve) => setTimeout(resolve, 80));
      scrollTo(0, 0);
      app.invalidate(true);
    });
    await page.waitForTimeout(700);
    expect(
      await page.evaluate(() =>
        window.taxaDebug.app.speckles.materials.every((m) => m.opacity === 0),
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seek(page, "zoom", 0.8);
    expect(
      await page.evaluate(() => {
        const system = window.taxaDebug.app.speckles;
        return (
          system.materials.every(
            (m) => m.opacity === 1 && m.color.getHexString() === "92cb86",
          ) && system.activeTweens.size === 0
        );
      }),
    ).toBe(true);
  });
}

test("story seeks forward and backward, loads one product, and preserves GPU resources", async ({
  page,
}) => {
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await ready(page);
  await expect(page.locator("#splash .story-panel")).toHaveClass(/active/);
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
    [0.1, "topic-odor"],
    [0.45, "topic-uv"],
    [0.8, "topic-mosquitoes"],
  ]) {
    await seek(page, "zoom", p);
    await expect(page.locator(`#${label}`)).toHaveClass(/active/);
  }
  await seek(page, "pitch", 0.5);
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await expect(page.locator("#product .story-panel")).toHaveClass(/active/);
  const productState = await page.evaluate(() => {
    const a = window.taxaDebug.app,
      p = a.product.root;
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
  await expect(page.locator("#topic-odor")).toHaveClass(/active/);
  await seek(page, "splash", 0.1);
  await expect(page.locator("#splash .story-panel")).toHaveClass(/active/);
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
  await expect(page.locator("#product .story-panel")).toHaveClass(/active/);
  const box = await page.locator(".product-card").boundingBox();
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
  await expect(page.locator("#product .story-panel")).toHaveClass(/active/);
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
  await page.waitForFunction(() => window.taxaDebug.app.timeline.isMobile);
  await seek(page, "product", 0.99);
  expect(
    await page.evaluate(() => window.taxaDebug.app.product.root.scale.x),
  ).toBeCloseTo(5.2);
  expect(
    await page.evaluate(() => window.taxaDebug.app.sceneManager.camera.fov),
  ).toBe(90);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => !window.taxaDebug.app.timeline.isMobile);
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
  await expect(page.locator("#product .story-panel")).toHaveClass(/active/, {
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
  await expect(page.locator("#splash .story-panel")).toHaveClass(/active/, {
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
    a.lastRenderSlot = null;
    a.sceneManager.controls.update = () => false;
    let draws = 0;
    a.sceneManager.render = () => draws++;
    const start = performance.now();
    for (let i = 0; i < 14; i++) {
      a.needsRender = true;
      a.frame(start + (i * 1000) / 120);
    }
    const pending = a.needsRender;
    const pacedDraws = draws;
    a.frame(start + (14 * 1000) / 120);
    return { pending, pacedDraws, finalDraws: draws, dirty: a.needsRender };
  });
  expect(result).toEqual({
    pending: true,
    pacedDraws: 7,
    finalDraws: 8,
    dirty: false,
  });
});

test("cap fades continuously through half opacity in both scroll directions", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const app = window.taxaDebug.app;
    app.preloadProduct();
    await app.productPromise;
  });
  await seek(page, "pitch", 0.1);
  const changes = await page.evaluate(() => {
    const app = window.taxaDebug.app;
    app.motionPaused = true;
    cancelAnimationFrame(app.animationFrameId);
    app.isInitialized = false;
    const { camera, renderer } = app.sceneManager;
    camera.position.set(0, 0, 60);
    camera.lookAt(0, 0, 0);
    const canvas = document.createElement("canvas");
    canvas.width = renderer.domElement.width;
    canvas.height = renderer.domElement.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { top, height } = app.timeline.bounds[3];
    const frames = [0.4999, 0.5001, 0.4999].map((progress) => {
      app.timeline.update(top + (height - innerHeight) * progress);
      app.ribbons.root.visible = false;
      app.speckles.meshes.forEach((mesh) => (mesh.visible = false));
      app.productAnchor.lookAt(camera.position);
      app.sceneManager.render();
      ctx.fillStyle = "#fffbf4";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(renderer.domElement, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    });
    return frames.slice(1).map((frame, index) => {
      let difference = 0;
      for (let i = 0; i < frame.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          difference += Math.abs(
            frame[i + channel] - frames[index][i + channel],
          );
        }
      }
      return difference / (canvas.width * canvas.height * 3);
    });
  });
  // A tiny scroll step must not reveal a screen-sized patch of background.
  // The exported cap's 50% alpha cutoff produced a >16/255 average jump.
  for (const difference of changes) expect(difference).toBeLessThan(2);
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
