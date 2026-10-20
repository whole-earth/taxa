import { test, expect } from "@playwright/test";
import { ready, seek } from "./helpers.js";

test("frame pacing maintains 60 submissions across common display refresh rates", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await seek(page, "product", 0.99);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  const counts = await page.evaluate(() => {
    const app = window.taxaDebug.app;
    cancelAnimationFrame(app.animationFrameId);
    app.isInitialized = false;
    app.sceneManager.controls.update = () => false;
    let draws = 0;
    app.sceneManager.render = () => draws++;
    const counts = {};
    for (const hz of [60, 72, 75, 90, 120, 144, 165, 240]) {
      draws = 0;
      app.lastRenderSlot = null;
      app.lastFrameTime = null;
      const start = performance.now();
      for (let i = 0; i < hz; i++) {
        app.needsRender = true;
        app.frame(start + (i * 1000) / hz);
      }
      counts[hz] = draws;
      // A long task skips missed slots instead of drawing a catch-up burst.
      app.needsRender = true;
      app.frame(start + 3000);
      counts[`${hz}-after-stall`] = draws;
    }
    return counts;
  });
  for (const hz of [60, 72, 75, 90, 120, 144, 165, 240]) {
    expect(counts[hz]).toBe(60);
    expect(counts[`${hz}-after-stall`]).toBe(61);
  }
});

test("scrolling within a product phase makes no redundant DOM mutations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await seek(page, "product", 0.5);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  const mutations = await page.evaluate(() => {
    const app = window.taxaDebug.app;
    const { top, height } = app.timeline.bounds[3];
    const y = (p) => top + (height - innerHeight) * p;
    app.timeline.update(y(0.5));
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    for (let i = 0; i < 120; i++) app.timeline.update(y(0.5 + i * 0.0001));
    const count = observer.takeRecords().length;
    observer.disconnect();
    return count;
  });
  expect(mutations).toBe(0);
});

test("contact overlay suspends ambient renders and closing it resumes motion", async ({
  page,
}) => {
  await ready(page);
  await page.waitForFunction(() => !!window.taxaDebug.app.product);
  await page.locator(".contact-desktop").click();
  await expect(page.locator("#contact-dialog")).toBeVisible();
  await page.waitForTimeout(2000);
  const frames = await page.evaluate(
    () => window.taxaDebug.performanceMonitor.frames,
  );
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => window.taxaDebug.performanceMonitor.frames),
  ).toBe(frames);
  await page.keyboard.press("Escape");
  await expect(page.locator(".contact-desktop")).toBeFocused();
  await page.waitForFunction(
    (frames) => window.taxaDebug.performanceMonitor.frames > frames,
    frames,
  );
});

test("mobile menu restores focus on Escape and clears its overlay after resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator(".menu-toggle").click();
  expect(await page.evaluate(() => window.taxaDebug.app.overlayActive)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu-toggle")).toBeFocused();
  expect(await page.evaluate(() => window.taxaDebug.app.overlayActive)).toBe(
    false,
  );
  await page.locator(".menu-toggle").click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction(() => !window.taxaDebug.app.overlayActive);
});

for (const [width, height] of [
  [1280, 720],
  [844, 390],
  [667, 375],
  [375, 500],
]) {
  test(`product card and waitlist stay reachable at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    await seek(page, "product", 0.99);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    const card = page.locator(".product-card");
    const box = await card.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(65);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.locator("#waitlist-link").scrollIntoViewIfNeeded();
    const link = await page.locator("#waitlist-link").boundingBox();
    expect(link.y).toBeGreaterThanOrEqual(box.y);
    expect(link.y + link.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("body")).toHaveAttribute(
      "data-chapter",
      "product",
    );
  });
}
