import { test, expect } from "@playwright/test";
import { ready, seek } from "./helpers.js";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 375, height: 500 },
]) {
  test(`standalone mobile footer clears the product at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    const sections = await page.evaluate(
      () => window.taxaDebug.app.timeline.bounds,
    );
    await seek(page, "product", 1);
    await page.locator("#podGreen").click();
    await page.waitForFunction(
      () => !window.taxaDebug.app.podSelector.isAnimating,
    );
    const pose = await page.evaluate(() => {
      const cap = window.taxaDebug.app.product.applicator;
      return [cap.position.y, cap.rotation.y];
    });
    const cardBottom = await page
      .locator(".product-card")
      .evaluate((card) => card.getBoundingClientRect().bottom);
    const headingTop = await page
      .locator(".product .story-heading")
      .evaluate((heading) => heading.getBoundingClientRect().top);
    const footer = page.locator(".taxa-legal-footer");
    const footerTop = await footer.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expect(
      await footer.evaluate((element) =>
        Number(getComputedStyle(element).opacity),
      ),
    ).toBeLessThan(0.03);
    await page.evaluate(() => {
      const { top, height } = window.taxaDebug.app.timeline.bounds[3];
      const end = top + height - innerHeight;
      window.scrollTo(
        0,
        (end + document.documentElement.scrollHeight - innerHeight) / 2,
      );
    });
    await expect
      .poll(() =>
        footer.evaluate((element) => Number(getComputedStyle(element).opacity)),
      )
      .toBeCloseTo(0.5, 1);
    expect(
      await footer.evaluate((element) => element.getBoundingClientRect().top),
    ).toBe(footerTop);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForFunction(
      () =>
        document.documentElement.scrollHeight - scrollY - innerHeight <= 1 &&
        window.taxaDebug.app.timeline.lastScrollY === scrollY,
    );
    await expect
      .poll(() =>
        page
          .locator(".product-card")
          .evaluate((card) => card.getBoundingClientRect().bottom),
      )
      .toBe(cardBottom);
    await expect
      .poll(() =>
        footer.evaluate((element) => Number(getComputedStyle(element).opacity)),
      )
      .toBe(1);
    expect(
      await footer.evaluate((element) => element.getBoundingClientRect().top),
    ).toBe(footerTop);
    await expect(footer).toBeInViewport({ ratio: 0.99 });
    await expect(page.locator("#motion-toggle")).toHaveCount(0);
    const spacing = await footer.evaluate((element) => {
      const text = element.querySelector("a").getBoundingClientRect();
      const card = document
        .querySelector(".product-card")
        .getBoundingClientRect();
      return {
        above: text.top - card.bottom,
        below: innerHeight - text.bottom,
      };
    });
    expect(Math.abs(spacing.above - spacing.below)).toBeLessThan(1);
    expect(spacing.below).toBe(16);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const footer = document
            .querySelector(".taxa-legal-footer")
            .getBoundingClientRect();
          const card = document
            .querySelector(".product-card")
            .getBoundingClientRect();
          return footer.top - card.bottom;
        }),
      )
      .toBeGreaterThanOrEqual(0);
    for (const link of await footer.locator("a").all()) {
      // Trial clicks verify the canvas and card cannot block the legal links.
      await link.click({ trial: true });
    }
    expect(
      await page.evaluate(() => window.taxaDebug.app.timeline.bounds),
    ).toEqual(sections);
    expect(
      await page.evaluate(() => {
        const cap = window.taxaDebug.app.product.applicator;
        return [cap.position.y, cap.rotation.y];
      }),
    ).toEqual(pose);
    expect(
      await page
        .locator(".product .story-heading")
        .evaluate((heading) => heading.getBoundingClientRect().top),
    ).toBe(headingTop);
    await page.screenshot({
      path: `test-results/demo-footer-${viewport.width}x${viewport.height}-${test.info().project.name || process.env.BROWSER || "chromium"}.png`,
    });
    await seek(page, "product", 0.95);
    await expect
      .poll(() =>
        footer.evaluate((element) => Number(getComputedStyle(element).opacity)),
      )
      .toBe(0);
    expect(await footer.evaluate((element) => element.inert)).toBe(true);
    await expect(page.locator("#motion-toggle")).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator(".product-card")
          .evaluate((card) => card.getBoundingClientRect().bottom),
      )
      .toBe(cardBottom);
  });
}
