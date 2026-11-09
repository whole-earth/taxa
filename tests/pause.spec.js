import { test, expect } from "@playwright/test";
import { ready, seek } from "./helpers.js";

test("inactivity stops rendering and pointer, touch and keyboard wake it", async ({
  page,
}) => {
  await ready(page);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  for (const type of ["pointermove", "touchstart", "keydown"]) {
    await page.evaluate(() => {
      const app = window.taxaDebug.app;
      app.lastActivity = performance.now() - 41000;
      app.invalidate();
    });
    await page.waitForFunction(
      () => window.taxaDebug.app.animationFrameId === null,
    );
    await expect(page.locator(".inactivity-overlay")).toHaveClass(/active/);
    const before = await page.evaluate(
      () => window.taxaDebug.performanceMonitor.frames,
    );
    await page.waitForTimeout(200);
    expect(
      await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
    ).toBe(before);
    await page.evaluate((type) => window.dispatchEvent(new Event(type)), type);
    await expect(page.locator(".inactivity-overlay")).not.toHaveClass(/active/);
    await page.waitForFunction(
      (before) => window.taxaDebug.performanceMonitor.frames > before,
      before,
    );
  }
});

test("background visibility stops the loop and returning resumes it", async ({
  page,
}) => {
  await ready(page);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  // Exercise the browser's visibility handler without relying on headless
  // window focus, which does not consistently background tabs across engines.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = await page.evaluate(
    () => window.taxaDebug.performanceMonitor.frames,
  );
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBe(before);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    (before) => window.taxaDebug.performanceMonitor.frames > before,
    before,
  );
});

test("enabling reduced motion completes an in-flight chapter jump immediately", async ({
  page,
}) => {
  await ready(page);
  await seek(page, "product", 0.99);
  await page.evaluate(() => {
    const app = window.taxaDebug.app;
    app.timeline.goTo(0);
    const now = performance.now();
    app.scroller.raf(now);
    app.scroller.raf(now + 250);
  });
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => window.taxaDebug.app.reducedMotion);
  expect(
    await page.evaluate(() => window.taxaDebug.app.scroller.isScrolling),
  ).not.toBe("smooth");
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          y: scrollY,
          scrolling: window.taxaDebug.app.scroller.isScrolling === "smooth",
        })),
      { timeout: 1000 },
    )
    .toEqual({ y: 0, scrolling: false });
});

test("reduced motion retains native scroll position when Lenis has an older cached target", async ({
  page,
}) => {
  await ready(page);
  await seek(page, "zoom", 0.45);
  const result = await page.evaluate(() => {
    const app = window.taxaDebug.app;
    const before = scrollY;
    app.scroller.isScrolling = false;
    app.scroller.targetScroll = app.timeline.bounds[1].top;
    app.motionQuery = { matches: true };
    app.updateMotionPreference();
    return {
      before,
      target: app.scroller.animatedScroll,
      topic: app.timeline.topic,
      colors: app.speckles.materials.map((m) => m.color.getHexString()),
      opacity: app.speckles.materials.map((m) => m.opacity),
    };
  });
  expect(result.target).toBe(result.before);
  expect(result.topic).toBe(1);
  expect(result.colors.every((c) => c === "f1ff00")).toBe(true);
  expect(result.opacity.every((o) => o === 1)).toBe(true);
});

test("a zero-distance native scroll event cannot keep a static product rendering", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.waitForFunction(
    () => window.taxaDebug.app.animationFrameId === null,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
  await page.waitForFunction(
    () => window.taxaDebug.app.animationFrameId === null,
  );
  const before = await page.evaluate(
    () => window.taxaDebug.performanceMonitor.frames,
  );
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBe(before);
});

test("reduced motion completes fades at fractional timestamps without losing callbacks", async ({
  page,
}) => {
  await ready(page);
  await seek(page, "zoom", 0.1);
  const result = await page.evaluate(() => {
    const app = window.taxaDebug.app;
    const yellow = app.speckles.materials[0].color.clone().set("#f1ff00");
    app.speckles.show(yellow, 0);
    app.speckles.show(yellow);
    // Tween.end() at 76.4 + 180 rounds the elapsed duration below 180,
    // so it leaves the fade playing without calling its reveal callback.
    for (const tween of app.speckles.activeTweens) tween.stop().start(76.4);
    app.motionQuery = { matches: true };
    app.updateMotionPreference();
    return {
      opacity: app.speckles.materials.map((material) => material.opacity),
      active: app.speckles.activeTweens.size,
      stopped: app.tweens.allStopped(),
    };
  });
  expect(result.opacity.every((opacity) => opacity === 1)).toBe(true);
  expect(result.active).toBe(0);
  expect(result.stopped).toBe(true);
});

test("idle overlay wakes a static scene, supports play, and leaves the footer clear", async ({
  page,
}) => {
  await ready(page);
  await seek(page, "product", 0.8);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.waitForFunction(
    () => window.taxaDebug.app.animationFrameId === null,
  );
  await page.evaluate(() => {
    const app = window.taxaDebug.app;
    app.lastActivity = performance.now() - 39900;
    clearTimeout(app.idleTimer);
    app.idleTimer = null;
    app.scheduleIdleCheck();
  });
  const overlay = page.locator(".inactivity-overlay");
  await expect(overlay).toHaveClass(/active/);
  await expect(overlay).toHaveAttribute("aria-hidden", "false");
  await page
    .getByRole("button", { name: "Resume animation", exact: true })
    .dispatchEvent("click");
  await expect(overlay).not.toHaveClass(/active/);
  // The demo footer follows the product section; chapter end is not page end.
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForFunction(
    () => document.documentElement.scrollHeight - scrollY - innerHeight <= 1,
  );
  await page.evaluate(() => {
    const app = window.taxaDebug.app;
    app.lastActivity = performance.now() - 41000;
    app.invalidate();
  });
  await page.waitForFunction(
    () => window.taxaDebug.app.animationFrameId === null,
  );
  await expect(overlay).not.toHaveClass(/active/);
  await page.evaluate(() => window.taxaDebug.app.dispose());
  await expect(overlay).toHaveCount(0);
});
