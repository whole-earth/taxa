import { test, expect } from "@playwright/test";
import { ready, seek } from "./helpers.js";

for (const compressed of [true, false]) {
  test(`prepared reflections load ${compressed ? "compressed" : "without native decompression"} and survive context loss without another download`, async ({
    page,
  }) => {
    if (!compressed)
      await page.addInitScript(() => {
        window.DecompressionStream = undefined;
      });
    const requests = [];
    page.on("request", (request) => {
      if (/\.(?:hdr|bin(?:\.gz)?)$/.test(request.url()))
        requests.push(request.url());
    });
    await ready(page);
    await page.waitForFunction(() => !!window.taxaDebug.app.product);
    await seek(page, "product", 0.99);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(
      compressed ? /reflections\.bin\.gz$/ : /reflections\.bin$/,
    );
    await page.evaluate(() =>
      window.taxaDebug.app.sceneManager.renderer.forceContextLoss(),
    );
    await page.waitForFunction(
      () => window.taxaDebug.app.sceneManager.contextLost,
    );
    await page.waitForTimeout(150);
    await page.evaluate(() =>
      window.taxaDebug.app.sceneManager.renderer.forceContextRestore(),
    );
    await page.waitForFunction(
      () => !window.taxaDebug.app.sceneManager.contextLost,
    );
    await seek(page, "zoom", 0.5);
    await seek(page, "product", 0.99);
    expect(requests).toHaveLength(1);
    await expect(page.locator(".three canvas")).toBeVisible();
  });
}

test("damaged reflections leave readable content instead of initializing a broken scene", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.DecompressionStream = undefined;
  });
  await page.route("**/reflections.bin", (route) =>
    route.fulfill({
      contentType: "application/octet-stream",
      body: Buffer.from("TXRF"),
    }),
  );
  await page.goto("/?perf");
  await expect(page.locator("body")).toHaveClass(/scene-failed/);
  await expect(page.locator("#splash-title")).toBeVisible();
  expect(await page.evaluate(() => !!window.taxaDebug.app.isInitialized)).toBe(
    false,
  );
});
