import { expect } from "@playwright/test";

export async function ready(page) {
  await page.goto("/?perf");
  await page.waitForFunction(() => window.taxaDebug?.app.isInitialized);
}
export async function seek(page, section, progress = 0) {
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
    () => window.taxaDebug.app.timeline.lastScrollY === scrollY,
  );
  await expect(page.locator("body")).toHaveAttribute("data-chapter", section);
}
