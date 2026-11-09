import { test, expect } from "@playwright/test";
import { ready, seek } from "./helpers.js";

function gateRequest(page, pattern) {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  return page
    .route(pattern, async (route) => {
      await gate;
      await route.continue();
    })
    .then(() => release);
}

test("failed cell loading releases attached and late sibling models", async ({
  page,
}) => {
  const releaseOuter = await gateRequest(page, "**/blob-outer.glb");
  let failRibbons;
  const failure = new Promise((resolve) => (failRibbons = resolve));
  await page.route("**/ribbons.glb", async (route) => {
    await failure;
    await route.abort();
  });
  await page.goto("/?perf", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.taxaDebug?.app.cellGroup.children.length === 1,
  );
  await page.evaluate(() => {
    const root = window.taxaDebug.app.cellGroup.children[0];
    let geometry;
    root.traverse((node) => {
      if (node.geometry) geometry = node.geometry;
    });
    window.disposedGeometries = 0;
    const proto = Object.getPrototypeOf(geometry);
    const original = proto.dispose;
    proto.dispose = function () {
      window.disposedGeometries++;
      return original.call(this);
    };
  });
  failRibbons();
  await expect(page.locator("body")).toHaveClass(/scene-failed/);
  const disposedBeforeLateLoad = await page.evaluate(
    () => window.disposedGeometries,
  );
  expect(disposedBeforeLateLoad).toBeGreaterThan(0);
  releaseOuter();
  await expect
    .poll(() => page.evaluate(() => window.disposedGeometries))
    .toBeGreaterThan(disposedBeforeLateLoad);
  expect(
    await page.evaluate(() => window.taxaDebug.app.cellGroup.children.length),
  ).toBe(1);
  await expect(page.locator("#splash-title")).toBeVisible();
});

test("page teardown during initial loading prevents late initialization", async ({
  page,
}) => {
  const release = await gateRequest(page, "**/blob-inner.glb");
  await page.goto("/?perf", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.taxaDebug?.app.cellGroup.children.length === 2,
  );
  await page.evaluate(() =>
    dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })),
  );
  release();
  await page.waitForResponse("**/blob-inner.glb");
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => ({
      disposed: window.taxaDebug.app.disposed,
      initialized: !!window.taxaDebug.app.isInitialized,
      canvases: document.querySelectorAll("canvas").length,
    })),
  ).toEqual({ disposed: true, initialized: false, canvases: 0 });
});

test("failed product preparation releases resources and can retry", async ({
  page,
}) => {
  const release = await gateRequest(page, "**/swap.glb*");
  await ready(page);
  await page.evaluate(() => {
    const manager = window.taxaDebug.app.sceneManager;
    window.warmProduct = manager.warmProduct;
    window.productDisposals = { geometry: 0, material: 0, texture: 0 };
    manager.warmProduct = async (product) => {
      const seen = new Set();
      const track = (resource, kind) => {
        if (!resource || seen.has(resource)) return;
        seen.add(resource);
        resource.addEventListener(
          "dispose",
          () => window.productDisposals[kind]++,
        );
      };
      product.root.traverse((node) => {
        track(node.geometry, "geometry");
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          track(material, "material");
          for (const value of Object.values(material ?? {}))
            if (value?.isTexture) track(value, "texture");
        }
      });
      throw new Error("Test preparation failure");
    };
  });
  release();
  await expect(page.locator("#retry-load")).toBeVisible();
  const disposed = await page.evaluate(() => window.productDisposals);
  expect(disposed.geometry).toBeGreaterThan(0);
  expect(disposed.material).toBeGreaterThan(0);
  expect(disposed.texture).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.taxaDebug.app.sceneManager.warmProduct = window.warmProduct;
  });
  await page.locator("#retry-load").click();
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await seek(page, "product", 0.99);
  await expect(page.locator("#product .story-panel")).toHaveClass(/active/);
});

test("live reduced motion settles scrolling, dot fades and the complete pod chain", async ({
  page,
}) => {
  await ready(page);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await seek(page, "zoom", 0.1);
  await page.waitForFunction(() =>
    window.taxaDebug.app.speckles.materials.every((m) => m.opacity === 1),
  );
  await seek(page, "zoom", 0.45);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => window.taxaDebug.app.reducedMotion);
  const dots = await page.evaluate(() =>
    window.taxaDebug.app.speckles.materials.map((m) => ({
      opacity: m.opacity,
      color: m.color.getHexString(),
    })),
  );
  expect(
    dots.every((m) => m.opacity === 1 && m.color === "f1ff00"),
    JSON.stringify(dots),
  ).toBe(true);
  await seek(page, "pitch", 0.2);
  expect(
    await page.evaluate(() => window.taxaDebug.app.speckles.activeTweens.size),
  ).toBe(0);
  await seek(page, "product", 0.99);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => !window.taxaDebug.app.reducedMotion);
  await page.locator("#podGreen").click();
  await page.waitForFunction(
    () => window.taxaDebug.app.podSelector.isAnimating,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#podGreen")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 1000 },
  );
  await expect(page.locator("#podYellow")).toBeEnabled();
  expect(
    await page.evaluate(() => ({
      stopped: window.taxaDebug.app.scroller.isStopped,
      smooth: window.taxaDebug.app.scroller.options.smoothWheel,
      tweening: !window.taxaDebug.app.tweens.allStopped(),
      labelAnimations: window.taxaDebug.app.podSelector.labels.flatMap(
        (label) => label.getAnimations(),
      ).length,
    })),
  ).toEqual({
    stopped: false,
    smooth: false,
    tweening: false,
    labelAnimations: 0,
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    () => window.taxaDebug.app.scroller.options.smoothWheel,
  );
  await page.evaluate(() => window.taxaDebug.app.timeline.goTo(0));
  await page.waitForFunction(() => !!window.taxaDebug.app.scroller.isScrolling);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  // Assert stopped motion rather than Lenis's native-event bookkeeping:
  // its "native" flag can survive a duplicate, zero-distance scroll event.
  expect(
    await page.evaluate(() => window.taxaDebug.app.scroller.isScrolling),
  ).not.toBe("smooth");
  await page.waitForFunction(
    () => window.taxaDebug.app.animationFrameId === null,
    null,
    { timeout: 10000 },
  );
  const frames = await page.evaluate(
    () => window.taxaDebug.performanceMonitor.frames,
  );
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBe(frames);
});

test("intentional sleep is excluded from frame samples", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.waitForFunction(
    () => window.taxaDebug.app.animationFrameId === null,
  );
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.lastTime),
  ).toBe(0);
  await page.evaluate(() => {
    window.taxaDebug.performanceMonitor.samples = [];
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.taxaDebug.app.invalidate());
  await page.waitForFunction(
    () => window.taxaDebug.app.animationFrameId === null,
  );
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.samples),
  ).toEqual([]);
});

test("delayed product loading keeps navigation usable and finishes at the current pose", async ({
  page,
}) => {
  const release = await gateRequest(page, "**/swap.glb*");
  const requests = [];
  page.on("request", (request) => {
    if (/\/swap\.glb(?:\.gz)?$/.test(request.url()))
      requests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await seek(page, "product", 0.99);
  await expect(page.locator("#loadProgressCount")).toContainText("Preparing");
  await page.locator("[data-contact]:visible").first().click();
  await expect(page.locator("#contact-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await seek(page, "zoom", 0.8);
  await seek(page, "product", 0.99);
  release();
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await expect(page.locator("#product .story-panel")).toHaveClass(/active/);
  expect(requests).toHaveLength(1);
  expect(
    await page.evaluate(() => window.taxaDebug.app.product.root.position.x),
  ).toBeCloseTo(-20);
});

for (const duringLoad of [false, true]) {
  test(`GPU context recovery ${duringLoad ? "during loading" : "at the product"} preserves the story`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    let release;
    if (duringLoad) {
      release = await gateRequest(page, "**/blob-inner.glb");
      await page.goto("/?perf", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => !!window.taxaDebug?.app.sceneManager.environmentTexture,
      );
    } else {
      await ready(page);
      await page.waitForFunction(() => !!window.taxaDebug.app.product);
      await seek(page, "product", 0.99);
      await page.locator("#podGreen").click();
      await expect(page.locator("#podGreen")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    const supported = await page.evaluate(
      () =>
        !!window.taxaDebug.app.sceneManager.renderer
          .getContext()
          .getExtension("WEBGL_lose_context"),
    );
    test.skip(!supported, "Browser does not expose simulated context loss");
    if (!duringLoad) {
      await page.waitForFunction(
        () => window.taxaDebug.app.animationFrameId === null,
      );
      await page
        .locator(".three canvas")
        .screenshot({ path: testInfo.outputPath("before-recovery.png") });
    }
    const before = await page.evaluate(() => ({
      frames: window.taxaDebug.performanceMonitor.frames,
      y: scrollY,
      texture: window.taxaDebug.app.sceneManager.environmentTexture.uuid,
      version: window.taxaDebug.app.sceneManager.environmentTexture.version,
    }));
    await page.evaluate(() =>
      window.taxaDebug.app.sceneManager.renderer.forceContextLoss(),
    );
    await page.waitForFunction(
      () => window.taxaDebug.app.sceneManager.contextLost,
    );
    await expect(page.locator("#loadProgressCount")).toContainText("Restoring");
    release?.();
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(() => window.taxaDebug.app.animationFrameId),
    ).toBeNull();
    await page.evaluate(() =>
      window.taxaDebug.app.sceneManager.renderer.forceContextRestore(),
    );
    await page.waitForFunction(
      () =>
        !window.taxaDebug.app.sceneManager.contextLost &&
        window.taxaDebug.app.sceneRevealed,
    );
    expect(
      await page.evaluate(
        () => window.taxaDebug.app.sceneManager.environmentTexture.uuid,
      ),
    ).toBe(before.texture);
    expect(
      await page.evaluate(
        () => window.taxaDebug.app.sceneManager.environmentTexture.version,
      ),
    ).toBeGreaterThan(before.version);
    expect(await page.evaluate(() => scrollY)).toBe(before.y);
    await page.waitForFunction(
      (frames) => window.taxaDebug.performanceMonitor.frames > frames,
      before.frames,
    );
    if (!duringLoad) {
      await page.waitForFunction(
        () => window.taxaDebug.app.animationFrameId === null,
      );
      await page
        .locator(".three canvas")
        .screenshot({ path: testInfo.outputPath("after-recovery.png") });
    }
    if (!duringLoad)
      await expect(page.locator("#podGreen")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    await seek(page, "zoom", 0.45);
    await seek(page, "product", 0.99);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    await expect(page.locator(".three canvas")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const interrupt of ["dispose", "context"]) {
  test(`shader preparation tolerates ${interrupt}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const release = await gateRequest(page, "**/swap.glb*");
    await ready(page);
    await page.evaluate((interrupt) => {
      const app = window.taxaDebug.app;
      const manager = app.sceneManager;
      const compile = manager.renderer.compileAsync.bind(manager.renderer);
      let first = true;
      manager.renderer.compileAsync = (...args) => {
        const ready = compile(...args);
        if (first) {
          first = false;
          queueMicrotask(() => {
            if (interrupt === "dispose") app.dispose();
            else manager.renderer.forceContextLoss();
          });
        }
        return ready;
      };
    }, interrupt);
    release();
    if (interrupt === "context") {
      await page.waitForFunction(
        () => window.taxaDebug.app.sceneManager.contextLost,
      );
      await page.waitForTimeout(100);
      await page.evaluate(() =>
        window.taxaDebug.app.sceneManager.renderer.forceContextRestore(),
      );
      await page.waitForFunction(() => !!window.taxaDebug.app.product);
      await seek(page, "product", 0.99);
    } else {
      await page.waitForFunction(() => window.taxaDebug.app.disposed);
      await page.evaluate(() => window.taxaDebug.app.productPromise);
      await expect(page.locator("canvas")).toHaveCount(0);
    }
    expect(
      await page.evaluate(
        () => window.taxaDebug.app.sceneManager.compilations.size,
      ),
    ).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("product downloads after cell assets without waiting for the hero GPU or idle time", async ({
  page,
}) => {
  const releaseCell = await gateRequest(page, "**/blob-inner.glb");
  const products = [];
  page.on("request", (request) => {
    if (/\/swap\.glb(?:\.gz)?$/.test(request.url()))
      products.push(request.url());
  });
  await page.goto("/?perf", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.taxaDebug?.app.cellGroup.children.length === 2,
  );
  expect(products).toHaveLength(0);
  await page.evaluate(() => {
    const app = window.taxaDebug.app;
    const manager = app.sceneManager;
    const warm = manager.warmMaterials.bind(manager);
    const gate = new Promise((resolve) => (window.releaseHeroWarm = resolve));
    manager.warmMaterials = async (...args) => {
      await gate;
      return warm(...args);
    };
    const productWarm = manager.warmProduct.bind(manager);
    window.productWarmStates = [];
    manager.warmProduct = (...args) => {
      window.productWarmStates.push(!!app.sceneRevealed);
      return productWarm(...args);
    };
  });
  const download = page.waitForResponse("**/swap.glb.gz");
  releaseCell();
  await (await download).finished();
  expect(
    await page.evaluate(() => ({
      hero: !!window.taxaDebug.app.sceneRevealed,
      product: !!window.taxaDebug.app.product,
      warmed: window.productWarmStates,
    })),
  ).toEqual({ hero: false, product: false, warmed: [] });
  await page.evaluate(() => window.releaseHeroWarm());
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  expect(await page.evaluate(() => window.productWarmStates)).toEqual([true]);
  expect(products).toHaveLength(1);
  expect(products[0]).toMatch(/swap\.glb\.gz$/);
});

test("product uses the original GLB when native gzip decompression is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.DecompressionStream = undefined;
  });
  const products = [];
  page.on("request", (request) => {
    if (/\/swap\.glb(?:\.gz)?$/.test(request.url()))
      products.push(request.url());
  });
  await ready(page);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await seek(page, "product", 0.99);
  expect(
    await page.evaluate(() => window.taxaDebug.app.product.root.visible),
  ).toBe(true);
  expect(products).toHaveLength(1);
  expect(products[0]).toMatch(/swap\.glb$/);
});

for (const mobile of [false, true]) {
  test(`late product keeps the cell, previews the final pose, and hands off without scrolling (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const release = await gateRequest(page, "**/swap.glb*");
    const previews = [];
    page.on("request", (request) => {
      if (request.url().includes("product-preview-"))
        previews.push(request.url());
    });
    await ready(page);
    await seek(page, "product", 0.6);
    expect(
      await page.evaluate(() => window.taxaDebug.app.cellGroup.visible),
    ).toBe(true);
    expect(previews).toHaveLength(0);
    await expect(page.locator(".product-fallback")).not.toHaveClass(/visible/);
    await seek(page, "product", 1);
    await expect(page.locator(".product-fallback")).toHaveCSS("opacity", "1");
    expect(previews).toHaveLength(1);
    expect(previews[0]).toContain(mobile ? "mobile.webp" : "desktop.webp");
    await page.screenshot({ path: testInfo.outputPath("preview.png") });
    const y = await page.evaluate(() => scrollY);
    release();
    await page.waitForFunction(
      () => !!window.taxaDebug.app.product?.root.visible,
    );
    await expect(page.locator(".product-fallback")).toHaveCSS("opacity", "0");
    expect(await page.evaluate(() => scrollY)).toBe(y);
    await page.screenshot({ path: testInfo.outputPath("ready.png") });
    expect(
      await page.evaluate(() => window.taxaDebug.app.cellGroup.visible),
    ).toBe(false);
    await seek(page, "zoom", 0.5);
    await seek(page, "product", 1);
    expect(previews).toHaveLength(1);
    await expect(page.locator(".product-fallback")).not.toHaveClass(/visible/);
  });
}

test("ready product never downloads a preview; missing preview retains the cell", async ({
  page,
}) => {
  const previews = [];
  page.on("request", (request) => {
    if (request.url().includes("product-preview-"))
      previews.push(request.url());
  });
  await ready(page);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await seek(page, "product", 1);
  expect(previews).toHaveLength(0);
  const release = await gateRequest(page, "**/swap.glb*");
  await page.route("**/product-preview-*.webp", (route) => route.abort());
  await ready(page);
  await seek(page, "product", 1);
  await expect.poll(() => previews.length).toBe(1);
  expect(
    await page.evaluate(() => window.taxaDebug.app.cellGroup.visible),
  ).toBe(true);
  await expect(page.locator(".product-fallback")).not.toHaveClass(/visible/);
  await seek(page, "zoom", 0.5);
  release();
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await expect(page.locator(".product-fallback")).not.toHaveClass(/visible/);
});
