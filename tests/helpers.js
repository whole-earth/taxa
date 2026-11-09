import { expect } from "@playwright/test";

export async function ready(page) {
  await page.goto("/?perf");
  await page.waitForFunction(() => window.taxaDebug?.app.isInitialized);
}
export async function seek(page, section, progress = 0) {
  const target = await page.evaluate(
    ({ section, progress }) => {
      const app = window.taxaDebug.app;
      const i = ["splash", "zoom", "pitch", "product"].indexOf(section);
      const { top, height } = app.timeline.bounds[i];
      const target = Math.min(
        document.scrollingElement.scrollHeight - innerHeight,
        Math.max(
          0,
          top + (height - (i === 3 ? innerHeight : 0)) * progress + 1,
        ),
      );
      window.scrollTo(0, target);
      app.invalidate(true);
      return target;
    },
    { section, progress },
  );
  await page.waitForFunction(
    // WebKit may apply scrollTo asynchronously. Matching the previous scroll
    // position is not enough when seeking within the same chapter.
    (target) =>
      Math.abs(scrollY - target) <= 1 &&
      window.taxaDebug.app.timeline.lastScrollY === scrollY,
    target,
  );
  await expect(page.locator("body")).toHaveAttribute("data-chapter", section);
}
