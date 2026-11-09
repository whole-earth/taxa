import { previewUrl } from "./preview.mjs";
// Regenerate the optional late-loading previews from the actual final 3D pose.
// Run against npm run dev after changing product geometry, materials or framing.
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
let browser;
for (let i = 0; i < 2; i++) {
  try {
    browser = await chromium.launch({ channel: "chrome", timeout: 12000 });
    break;
  } catch (e) {
    if (i) throw e;
  }
}
for (const mobile of [false, true]) {
  const page = await browser.newPage({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(previewUrl());
  await page.waitForFunction(() => !!window.taxaDebug?.app.product);
  const data = await page.evaluate(() => {
    const app = window.taxaDebug.app;
    app.motionPaused = true;
    cancelAnimationFrame(app.animationFrameId);
    app.isInitialized = false;
    const manager = app.sceneManager;
    manager.camera.position.set(0, 0, 60);
    manager.camera.lookAt(0, 0, 0);
    const { top, height } = app.timeline.bounds[3];
    app.timeline.update(top + height - innerHeight);
    app.productAnchor.lookAt(manager.camera.position);
    manager.render();
    return manager.renderer.domElement
      .toDataURL("image/webp", 0.92)
      .split(",")[1];
  });
  const path = `assets/site/product-preview-${mobile ? "mobile" : "desktop"}.webp`;
  const bytes = Buffer.from(data, "base64");
  await writeFile(path, bytes);
  console.log(path, bytes.length);
  await page.close();
}
await browser.close();
