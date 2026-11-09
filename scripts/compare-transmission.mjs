import { previewUrl } from "./preview.mjs";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const mobile = process.env.MOBILE === "1";
const output = `test-results/transition/visual${mobile ? "-mobile" : ""}`;
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 3 : 2,
  hasTouch: mobile,
});
await page.goto(previewUrl());
await page.waitForFunction(() => window.taxaDebug?.app.isInitialized);
await page.addStyleTag({
  content:
    "*, *::before, *::after { transition: none !important; animation: none !important; }",
});
await page.evaluate(async () => {
  const a = window.taxaDebug.app;
  a.prepareProduct();
  await a.productPromise;
  window.scrollTo(0, a.timeline.bounds[2].top + 1);
  a.invalidate(true);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  a.motionPaused = true;
  cancelAnimationFrame(a.animationFrameId);
  a.isInitialized = false;
  a.sceneManager.camera.position.set(0, 0, 60);
  a.sceneManager.camera.lookAt(0, 0, 0);
});
await mkdir(output, { recursive: true });
const results = [];
for (const progress of [0.2, 0.32, 0.45, 0.55, 0.62, 0.7, 0.75, 0.99]) {
  const result = await page.evaluate((p) => {
    const a = window.taxaDebug.app,
      r = a.sceneManager.renderer;
    const { top, height } = a.timeline.bounds[3];
    a.timeline.update(top + (height - innerHeight) * p);
    a.ribbons.root.visible = false;
    a.speckles.meshes.forEach((m) => (m.visible = false));
    a.productAnchor.lookAt(a.sceneManager.camera.position);
    const scale = r.transmissionResolutionScale;
    const canvas = document.createElement("canvas");
    canvas.width = r.domElement.width;
    canvas.height = r.domElement.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const capture = (value) => {
      r.transmissionResolutionScale = value;
      a.sceneManager.render();
      ctx.fillStyle = "#fffbf4";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(r.domElement, 0, 0);
      return {
        pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        image: canvas.toDataURL("image/png").split(",")[1],
      };
    };
    const full = capture(1),
      optimized = capture(scale);
    let sum = 0,
      max = 0,
      changedPixels = 0;
    for (let i = 0; i < full.pixels.length; i += 4) {
      let changed = false;
      for (let j = 0; j < 3; j++) {
        const d = Math.abs(full.pixels[i + j] - optimized.pixels[i + j]);
        sum += d;
        max = Math.max(max, d);
        changed ||= d > 8;
      }
      changedPixels += Number(changed);
    }
    return {
      progress: p,
      scale,
      meanAbsoluteChannelDifference: sum / (canvas.width * canvas.height * 3),
      maxChannelDifference: max,
      percentPixelsOver8:
        (changedPixels / (canvas.width * canvas.height)) * 100,
      full: full.image,
      optimized: optimized.image,
    };
  }, progress);
  for (const name of ["full", "optimized"]) {
    await writeFile(
      `${output}/${progress}-${name}.png`,
      Buffer.from(result[name], "base64"),
    );
    delete result[name];
  }
  results.push(result);
}
await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
