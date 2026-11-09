// Compare the shipped map against production's original HDR processing at
// several poses. No production files or material parameters are modified.
import { build } from "esbuild";
import { chromium, webkit } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const useWebkit = process.env.BROWSER === "webkit";
const name = useWebkit ? "webkit" : "chrome";
const directory = `test-results/reflections/${name}`;
await mkdir(directory, { recursive: true });
const hdr = await readFile("assets/cell/aloe.hdr");
const bundle = await build({
  stdin: {
    contents: `import * as THREE from 'three';
      import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
      window.reflectionTools = { ...THREE, RGBELoader };`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "iife",
});
const browser = await (useWebkit ? webkit : chromium).launch(
  useWebkit ? {} : { channel: "chrome" },
);
const results = [];
try {
  for (const width of [390, 729, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 989 },
      deviceScaleFactor: 2,
    });
    await page.route("**/reference.hdr", (route) =>
      route.fulfill({ contentType: "application/octet-stream", body: hdr }),
    );
    await page.goto(`http://127.0.0.1:${process.env.PORT || 4173}/?perf`);
    await page.waitForFunction(() => !!window.taxaDebug?.app.product);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const comparisons = await page.evaluate(async () => {
      const T = window.reflectionTools,
        app = window.taxaDebug.app,
        manager = app.sceneManager;
      app.motionPaused = true;
      app.reducedMotion = true; // Settle each chapter's intended palette.
      cancelAnimationFrame(app.animationFrameId);
      app.isInitialized = false;
      manager.controls.autoRotate = false;
      manager.camera.position.set(0, 0, 60);
      manager.camera.lookAt(0, 0, 0);
      const prepared = manager.scene.environment;
      const source = await new T.RGBELoader().loadAsync("/reference.hdr");
      const generator = new T.PMREMGenerator(manager.renderer);
      const target = generator.fromEquirectangular(source);
      target.texture.mapping = T.EquirectangularReflectionMapping;
      const canvas = document.createElement("canvas");
      canvas.width = manager.renderer.domElement.width;
      canvas.height = manager.renderer.domElement.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const capture = (texture) => {
        manager.scene.environment = texture;
        manager.render();
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(manager.renderer.domElement, 0, 0);
        return {
          pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
          image: canvas.toDataURL(),
        };
      };
      const poses = [
        [0, 0, 0],
        [0, 0, 0.7],
        [1, 0.5, 0],
        [2, 0.5, 0],
        [3, 0.4, 0],
        [3, 0.6, 0],
        [3, 0.99, 0],
      ];
      const results = [];
      for (const [section, progress, angle] of poses) {
        const { top, height } = app.timeline.bounds[section];
        app.timeline.update(
          top + (height - (section === 3 ? innerHeight : 0)) * progress,
        );
        app.cellGroup.rotation.set(0, angle, 0);
        app.productAnchor.lookAt(manager.camera.position);
        const reference = capture(target.texture),
          actual = capture(prepared);
        let sum = 0,
          maximum = 0,
          changed = 0;
        for (let i = 0; i < actual.pixels.length; i += 4) {
          let delta = 0;
          for (let channel = 0; channel < 4; channel++) {
            const d = Math.abs(
              actual.pixels[i + channel] - reference.pixels[i + channel],
            );
            sum += d;
            delta = Math.max(delta, d);
          }
          maximum = Math.max(maximum, delta);
          if (delta > 8) changed++;
        }
        results.push({
          section,
          progress,
          angle,
          mean: sum / actual.pixels.length,
          maximum,
          changedFraction: changed / (actual.pixels.length / 4),
          reference: reference.image,
          actual: actual.image,
        });
      }
      manager.scene.environment = prepared;
      target.dispose();
      generator.dispose();
      source.dispose();
      return results;
    });
    for (const result of comparisons) {
      const prefix = `${directory}/${width}-${result.section}-${result.progress}-${result.angle}`;
      for (const key of ["reference", "actual"]) {
        await writeFile(
          `${prefix}-${key}.png`,
          Buffer.from(result[key].split(",")[1], "base64"),
        );
        delete result[key];
      }
      results.push({ width, ...result });
    }
    await page.close();
  }
  await writeFile(
    `${directory}/results.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  // Allow isolated raster/half-float rounding at edges across GPU drivers.
  for (const result of results) {
    assert.ok(
      result.mean < 0.25 && result.changedFraction < 0.001,
      `Reflection mismatch: ${JSON.stringify(result)}`,
    );
  }
} finally {
  await browser.close();
}
