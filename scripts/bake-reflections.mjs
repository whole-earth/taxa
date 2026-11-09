// Bake the production reflection treatment once instead of filtering HDRs on
// every visit. Re-run after changing aloe.hdr or upgrading Three.js.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const source = await readFile("assets/cell/aloe.hdr");
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
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  await page.route("https://reflection-bake.invalid/**", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith(".hdr")
        ? "application/octet-stream"
        : "text/html",
      body: route.request().url().endsWith(".hdr") ? source : "<!doctype html>",
    }),
  );
  await page.goto("https://reflection-bake.invalid/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const T = window.reflectionTools;
    const renderer = new T.WebGLRenderer({ precision: "mediump" });
    const hdr = await new T.RGBELoader().loadAsync("/aloe.hdr");
    const first = new T.PMREMGenerator(renderer);
    const atlas = first.fromEquirectangular(hdr);
    first.dispose();
    // Preserve production's distinctive rippled highlights: its first CubeUV
    // atlas was interpreted as equirectangular and filtered a second time.
    atlas.texture.mapping = T.EquirectangularReflectionMapping;
    const second = new T.PMREMGenerator(renderer);
    const reflections = second.fromEquirectangular(atlas.texture);
    const pixels = new Uint16Array(reflections.width * reflections.height * 4);
    renderer.readRenderTargetPixels(
      reflections,
      0,
      0,
      reflections.width,
      reflections.height,
      pixels,
    );
    const result = {
      revision: Number(T.REVISION),
      width: reflections.width,
      height: reflections.height,
      pixels: Array.from(pixels),
    };
    reflections.dispose();
    second.dispose();
    atlas.dispose();
    hdr.dispose();
    renderer.dispose();
    return result;
  });
  const buffer = Buffer.alloc(16 + result.pixels.length * 2);
  buffer.write("TXRF", 0, "ascii");
  buffer.writeUInt16LE(1, 4);
  buffer.writeUInt16LE(result.revision, 6);
  buffer.writeUInt32LE(result.width, 8);
  buffer.writeUInt32LE(result.height, 12);
  result.pixels.forEach((pixel, index) =>
    buffer.writeUInt16LE(pixel, 16 + index * 2),
  );
  const output = "assets/cell/reflections.bin";
  await writeFile(output, buffer);
  console.log(
    JSON.stringify(
      {
        output,
        width: result.width,
        height: result.height,
        revision: result.revision,
        bytes: buffer.length,
        sourceSha256: createHash("sha256").update(source).digest("hex"),
        outputSha256: createHash("sha256").update(buffer).digest("hex"),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
