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

for (const mobile of [false, true]) {
  test(`pull tab occludes the rim during the reveal (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(async () => {
      const app = window.taxaDebug.app;
      app.preloadProduct();
      await app.productPromise;
    });
    const samples = await page.evaluate((mobile) => {
      const app = window.taxaDebug.app;
      app.motionPaused = true;
      cancelAnimationFrame(app.animationFrameId);
      app.isInitialized = false;
      const { camera, renderer } = app.sceneManager;
      camera.position.set(0, 0, 60);
      camera.lookAt(0, 0, 0);
      const seal = app.product.root.getObjectByName("film-cover");
      const rim = app.product.root.getObjectByName("top-ring");
      const canvas = document.createElement("canvas");
      canvas.width = renderer.domElement.width;
      canvas.height = renderer.domElement.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const { top, height } = app.timeline.bounds[3];
      const capture = (visible) => {
        rim.visible = visible;
        app.sceneManager.render();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(renderer.domElement, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const samples = [];
      const progress = mobile ? 0.64 : 0.6;
      // Revisit the overlap after the opaque product phase to catch stale state.
      for (const p of [progress, 0.99, progress]) {
        app.timeline.update(top + (height - innerHeight) * p);
        app.productAnchor.lookAt(camera.position);
        const visible = capture(true);
        if (p === 0.99) continue;
        const hidden = capture(false);
        const differences = [-14, 14].map((z) => {
          const point = seal.position.clone().set(0, 107.5, z);
          seal.localToWorld(point).project(camera);
          const x = Math.round(((point.x + 1) / 2) * canvas.width);
          const y = Math.round(((1 - point.y) / 2) * canvas.height);
          if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2)
            throw new Error("Occlusion sample fell outside the viewport");
          let difference = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const i = ((y + dy) * canvas.width + x + dx) * 4;
              for (let c = 0; c < 3; c++)
                difference += Math.abs(visible[i + c] - hidden[i + c]);
            }
          }
          return difference / 75;
        });
        samples.push(differences);
      }
      return samples;
    }, mobile);
    for (const [covered, exposed] of samples) {
      // Hiding the rim cannot change pixels covered by the tab. An exposed
      // rim sample must change, proving the test isn't inspecting empty space.
      expect(covered).toBeLessThan(1);
      expect(exposed).toBeGreaterThan(10);
    }
  });
}

for (const mobile of [false, true]) {
  test(`tube interior resolves before the seal and exterior (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    const samples = await page.evaluate(async () => {
      const app = window.taxaDebug.app;
      app.preloadProduct();
      await app.productPromise;
      app.motionPaused = true;
      cancelAnimationFrame(app.animationFrameId);
      app.isInitialized = false;
      const { top, height } = app.timeline.bounds[3];
      const sample = (progress) => {
        app.timeline.update(top + (height - innerHeight) * progress);
        return {
          cap: app.product.cap.material.opacity,
          interior: app.product.interior.wall.material.opacity,
          detailedPartsVisible: app.product.exteriorParts.some(
            (node) => node.visible,
          ),
          seal: app.product.seal.material.opacity,
          wordmark: app.product.wordmark.material.opacity,
          exposure: app.sceneManager.renderer.toneMappingExposure,
          rotation: app.product.root.rotation.x,
        };
      };
      const progress = [0.45, 0.575, 0.62, 0.696];
      const forward = progress.map(sample);
      sample(0.99);
      const reverse = [...progress].reverse().map(sample).reverse();
      return { forward, reverse };
    });
    expect(samples.reverse).toEqual(samples.forward);
    const [optical, cameraCrossing, branding, resolved] = samples.forward;
    expect(optical.interior).toBeGreaterThan(0.9);
    expect(optical.cap).toBe(0);
    expect(optical.detailedPartsVisible).toBe(false);
    expect(optical.seal).toBe(0);
    expect(optical.wordmark).toBe(0);
    expect(optical.exposure).toBeGreaterThan(0.9);
    expect(cameraCrossing.seal).toBe(0);
    expect(cameraCrossing.wordmark).toBe(0);
    expect(branding.detailedPartsVisible).toBe(false);
    expect(branding.wordmark).toBeGreaterThan(0);
    expect(branding.wordmark).toBe(branding.seal);
    expect(branding.seal).toBeLessThan(0.6);
    expect(resolved.cap).toBeGreaterThan(0.9);
    expect(resolved.detailedPartsVisible).toBe(true);
    expect(resolved.seal).toBe(1);
    expect(resolved.wordmark).toBe(1);
    expect(resolved.rotation).toBeCloseTo(Math.PI / 2);
    expect(resolved.exposure).toBeCloseTo(0.6, 2);
  });
}

for (const mobile of [false, true]) {
  test(`cell stays anchored inside the tube during pullback (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    const result = await page.evaluate(async () => {
      const app = window.taxaDebug.app;
      app.preloadProduct();
      await app.productPromise;
      app.motionPaused = true;
      cancelAnimationFrame(app.animationFrameId);
      app.isInitialized = false;
      const { top, height } = app.timeline.bounds[3];
      const sample = (progress) => {
        app.timeline.update(top + (height - innerHeight) * progress);
        const cell = app.cellGroup;
        const product = app.product;
        const local = product.applicator.worldToLocal(cell.position.clone());
        return {
          local: local.toArray(),
          relativeScale: cell.scale.x / product.root.scale.x,
          apparentScale:
            cell.scale.x /
            cell.position.distanceTo(app.sceneManager.camera.position),
          details: product.exteriorParts.some((node) => node.visible),
          cellVisible: cell.visible,
          interiorVisible: product.interior.root.visible,
        };
      };
      const progress = [0.31, 0.4, 0.5, 0.58, 0.64];
      const forward = progress.map(sample);
      const covered = sample(0.67);
      sample(0.99);
      const reverse = [...progress].reverse().map(sample).reverse();
      app.sceneManager.camera.position.set(20, 0, Math.sqrt(60 * 60 - 20 * 20));
      app.sceneManager.camera.lookAt(0, 0, 0);
      app.timeline.updateCellPose(progress[0]);
      const afterCameraMove = app.product.applicator
        .worldToLocal(app.cellGroup.position.clone())
        .toArray();
      app.timeline.update(app.timeline.bounds[2].top + 1);
      return {
        forward,
        reverse,
        covered,
        afterCameraMove,
        resetPosition: app.cellGroup.position.toArray(),
      };
    });
    expect(result.reverse).toEqual(result.forward);
    for (const [i, sample] of result.forward.entries()) {
      sample.local.forEach((coordinate, axis) =>
        expect(coordinate).toBeCloseTo(result.forward[0].local[axis], 8),
      );
      expect(sample.relativeScale).toBeCloseTo(
        result.forward[0].relativeScale,
        8,
      );
      expect(sample.details).toBe(false);
      expect(sample.cellVisible).toBe(true);
      expect(sample.interiorVisible).toBe(true);
      if (i)
        expect(sample.apparentScale).toBeLessThan(
          result.forward[i - 1].apparentScale,
        );
    }
    result.afterCameraMove.forEach((coordinate, axis) =>
      expect(coordinate).toBeCloseTo(result.forward[0].local[axis], 8),
    );
    expect(result.covered.cellVisible).toBe(false);
    expect(result.covered.interiorVisible).toBe(false);
    expect(result.resetPosition).toEqual([0, 0, 0]);
  });
}

for (const mobile of [false, true]) {
  test(`product stays closed during zoom, then separates, seats and locks (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    const result = await page.evaluate(async () => {
      const app = window.taxaDebug.app;
      app.preloadProduct();
      await app.productPromise;
      app.motionPaused = true;
      cancelAnimationFrame(app.animationFrameId);
      app.isInitialized = false;
      const { top, height } = app.timeline.bounds[3];
      const product = app.product;
      const parts = ["tube", "bottom_dial", "dark-adapter"].map((name) =>
        product.root.getObjectByName(name),
      );
      const sample = (p) => {
        app.timeline.update(top + (height - innerHeight) * p);
        product.root.updateMatrixWorld(true);
        const parentInverse = product.applicator.parent.matrixWorld
          .clone()
          .invert();
        const bounds = (node) =>
          node.geometry.boundingBox
            .clone()
            .applyMatrix4(parentInverse.clone().multiply(node.matrixWorld));
        return {
          physicalGap: bounds(product.cap).min.y - bounds(parts[0]).max.y,
          capY: product.applicator.position.y,
          twist: product.applicator.rotation.y,
          baseY: parts.map((part) => part.position.y),
          spacing: parts.map(
            (part) => part.position.y - product.applicator.position.y,
          ),
          progress: p,
          baseOpacity: parts[0].material.opacity,
        };
      };
      const final = sample(1);
      const progress = Array.from({ length: 71 }, (_, i) => 0.3 + i / 100);
      const forward = progress.map(sample);
      const reverse = [...progress].reverse().map(sample).reverse();
      const poses = [0.7, 0.73, 0.82, 0.925, 0.95, 1].map(sample);
      return { final, forward, reverse, poses };
    });
    expect(result.reverse).toEqual(result.forward);
    for (const sample of result.forward) {
      if (sample.progress <= 0.7 || sample.progress >= 0.95) {
        expect(sample.physicalGap).toBeLessThanOrEqual(0);
        sample.spacing.forEach((spacing, i) =>
          expect(spacing).toBeCloseTo(result.final.spacing[i], 8),
        );
      }
      // Crossing the seated base happens before its color fade starts.
      if (sample.progress <= 0.5) expect(sample.baseOpacity).toBe(0);
    }
    const [closed, opening, apart, descending, seated, locked] = result.poses;
    expect(closed.capY).toBe(1);
    expect(opening.capY).toBe(1);
    expect(opening.baseY[0]).toBeLessThan(closed.baseY[0]);
    expect(opening.baseY[0]).toBeGreaterThan(apart.baseY[0]);
    expect(apart.baseY).toEqual(result.final.baseY);
    expect(apart.physicalGap).toBeGreaterThan(0);
    expect(descending.capY).toBeGreaterThan(0);
    expect(descending.capY).toBeLessThan(apart.capY);
    expect(seated.capY).toBeCloseTo(0);
    expect(seated.twist).toBeCloseTo(0);
    expect(locked.capY).toBe(0);
    expect(locked.twist).toBeGreaterThan(0.8);
  });
}

for (const mobile of [false, true]) {
  test(`product surfaces cross the camera without a visibility jump (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(async () => {
      const app = window.taxaDebug.app;
      app.preloadProduct();
      await app.productPromise;
    });
    await seek(page, "pitch", 0.1);
    const changes = await page.evaluate((mobile) => {
      const app = window.taxaDebug.app;
      app.motionPaused = true;
      cancelAnimationFrame(app.animationFrameId);
      app.isInitialized = false;
      const { camera, renderer } = app.sceneManager;
      camera.position.set(0, 0, 60);
      camera.lookAt(0, 0, 0);
      const canvas = document.createElement("canvas");
      canvas.width = 360;
      canvas.height = 225;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const { top, height } = app.timeline.bounds[3];
      const capture = (progress) => {
        app.timeline.update(top + (height - innerHeight) * progress);
        app.ribbons.root.visible = false;
        app.speckles.meshes.forEach((mesh) => (mesh.visible = false));
        app.productAnchor.lookAt(camera.position);
        app.sceneManager.render();
        ctx.fillStyle = "#fffbf4";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const difference = (a, b) => {
        let sum = 0;
        for (let i = 0; i < a.length; i += 4) {
          for (let c = 0; c < 3; c++) sum += Math.abs(a[i + c] - b[i + c]);
        }
        return sum / (canvas.width * canvas.height * 3);
      };
      const intervals = [
        [0.476, 0.477],
        mobile ? [0.569, 0.57] : [0.545, 0.546],
        [0.6599, 0.6601],
        [0.6999, 0.7001],
      ];
      return intervals.map((progress) => {
        const forward = progress.map(capture);
        capture(0.99);
        const reverse = [...progress].reverse().map(capture).reverse();
        const before = capture(progress[0] - 0.001);
        const after = capture(progress[1] + 0.001);
        return {
          progress,
          forward: difference(...forward),
          reverse: difference(...reverse),
          neighboringMotion:
            (difference(before, forward[0]) + difference(forward[1], after)) /
            2,
          revisit: forward.map((frame, i) => difference(frame, reverse[i])),
        };
      });
    }, mobile);
    // The old seal depth order jumped >7/255; revealing the seated base
    // before clearing the camera jumped >21/255 on mobile. Reject both an
    // absolute jump and a spike relative to the neighboring optical motion.
    for (const change of changes) {
      expect(change.forward).toBeLessThan(3);
      expect(change.reverse).toBeLessThan(3);
      // At an easing endpoint the neighboring motion approaches zero;
      // allow a quarter-channel average for browser raster differences when
      // switching the settled product into its opaque rendering phase.
      const continuityLimit = Math.max(0.25, change.neighboringMotion * 1.5);
      expect(change.forward, `Crossing ${change.progress}`).toBeLessThan(
        continuityLimit,
      );
      expect(change.reverse).toBeLessThan(continuityLimit);
      for (const difference of change.revisit)
        expect(difference).toBeLessThan(0.1);
    }
  });
}

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
    const frames = [0.6799, 0.6801, 0.6799].map((progress) => {
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
