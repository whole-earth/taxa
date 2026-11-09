// Compare source and prepared geometry in the same renderer. Separate WebGL
// contexts can differ at triangle edges even when loading the identical build.
// First save the pre-change dist at test-results/geometry-baseline/site.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, webkit } from "@playwright/test";

const engine = process.env.BROWSER === "webkit" ? webkit : chromium;
const directory = `test-results/geometry/${engine.name()}`;
await mkdir(directory, { recursive: true });
const browser = await engine.launch(
  engine === chromium ? { channel: "chrome" } : {},
);
const results = [];
const poses = [
  ...[0, 0.5, 0.99].map((progress) => ({ section: 0, progress })),
  ...[0, 0.1, 0.3, 0.45, 0.7, 0.95].map((progress) => ({
    section: 1,
    progress,
  })),
  ...[0, 0.25, 0.5, 0.99].map((progress) => ({ section: 2, progress })),
  ...Array.from({ length: 101 }, (_, i) => ({ section: 3, progress: i / 100 })),
  ...["green", "yellow", "orange"].map((pod) => ({
    section: 3,
    progress: 1,
    pod,
  })),
  ...Array.from({ length: 51 }, (_, i) => ({
    section: 3,
    progress: 1 - i / 50,
  })),
  ...[2, 1, 0].map((section) => ({ section, progress: 0.5 })),
].slice(0, Number(process.env.POSE_LIMIT) || Infinity);
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/geometry-reference/**", async (route) => {
      const path =
        new URL(route.request().url()).pathname.split(
          "/geometry-reference/",
        )[1] || "index.html";
      const contentType = path.endsWith(".html")
        ? "text/html"
        : path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : "application/octet-stream";
      await route.fulfill({
        contentType,
        body: await readFile(
          `${process.env.BASELINE_DIR || "test-results/geometry-baseline/site"}/${path}`,
        ),
      });
    });
    await page.goto(
      `${process.env.PREVIEW_URL || "http://127.0.0.1:4175"}/?perf`,
    );
    await page.waitForFunction(() => !!window.taxaDebug?.app.product);
    await page.evaluate(() => {
      const iframe = document.createElement("iframe");
      iframe.id = "geometry-reference";
      iframe.style.cssText =
        "position:fixed;left:-10000px;top:0;width:100vw;height:100vh;border:0;visibility:hidden";
      iframe.src = "/geometry-reference/?perf";
      document.body.appendChild(iframe);
    });
    await page.waitForFunction(
      () =>
        !!document.getElementById("geometry-reference").contentWindow.taxaDebug
          ?.app.product,
    );
    const resources = await page.evaluate(async () => {
      const referenceWindow =
        document.getElementById("geometry-reference").contentWindow;
      const apps = [referenceWindow.taxaDebug.app, window.taxaDebug.app];
      const meshes = [],
        summaries = [];
      const hash = async (data) =>
        Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
      for (const [i, app] of apps.entries()) {
        app.motionPaused = true;
        (i === 0 ? referenceWindow : window).cancelAnimationFrame(
          app.animationFrameId,
        );
        app.isInitialized = false;
        app.sceneManager.controls.autoRotate = false;
        const seen = new Set(),
          list = [],
          signatures = [];
        let bytes = 0;
        for (const root of [app.cellGroup, app.product.root])
          root.traverse((node) => {
            if (!node.isMesh || node.isInstancedMesh) return;
            list.push(node);
            if (seen.has(node.geometry)) return;
            seen.add(node.geometry);
            bytes +=
              (node.geometry.index?.array.byteLength ?? 0) +
              Object.values(node.geometry.attributes).reduce(
                (sum, a) => sum + a.array.byteLength,
                0,
              );
          });
        for (const node of list) {
          const g = node.geometry,
            m = node.material;
          signatures.push({
            name: node.name,
            vertices: g.attributes.position.count,
            triangles: g.index.count / 3,
            positions: await hash(g.attributes.position.array),
            indices: await hash(new Uint32Array(g.index.array)),
            material: Object.fromEntries(
              [
                "type",
                "precision",
                "transparent",
                "opacity",
                "roughness",
                "metalness",
                "transmission",
                "side",
                "alphaTest",
                "ior",
                "envMapIntensity",
              ].map((key) => [key, m[key]]),
            ),
          });
        }
        summaries.push({ bytes, signatures });
        meshes.push(list);
      }
      window.geometryPairs = meshes[1].map((node, i) => {
        // Allocate IDs from the current Three instance; independent bundles
        // otherwise reuse geometry IDs and can collide in renderer caches.
        const original = node.geometry.clone();
        const copyAttribute = (source) => {
          const attribute = node.geometry.attributes.position.clone();
          attribute.array = new window[source.array.constructor.name](
            source.array,
          );
          attribute.itemSize = source.itemSize;
          attribute.count = source.count;
          attribute.normalized = source.normalized;
          return attribute;
        };
        original.index = copyAttribute(meshes[0][i].geometry.index);
        original.attributes = Object.fromEntries(
          Object.entries(meshes[0][i].geometry.attributes).map(
            ([name, attribute]) => [name, copyAttribute(attribute)],
          ),
        );
        return { node, prepared: node.geometry, original };
      });
      // The reference has served its purpose; release its GPU allocations
      // before the dense sweep, especially on WebKit's GPU process.
      referenceWindow.taxaDebug.app.dispose();
      referenceWindow.taxaDebug.app.sceneManager.renderer.forceContextLoss();
      document.getElementById("geometry-reference").remove();
      return summaries;
    });
    assert.deepEqual(
      resources[0].signatures,
      resources[1].signatures,
      "Decoded geometry or effective materials changed",
    );
    const captures = [];
    for (const [index, pose] of poses.entries()) {
      const result = await page.evaluate(
        async ({ section, progress, pod, saveImages }) => {
          const app = window.taxaDebug.app,
            manager = app.sceneManager;
          let seed = 12345;
          const random = Math.random;
          Math.random = () =>
            (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
          try {
            const { top, height } = app.timeline.bounds[section];
            app.timeline.update(
              top + (height - (section === 3 ? innerHeight : 0)) * progress,
            );
            app.speckles.randomizePositions();
          } finally {
            Math.random = random;
          }
          if (pod) {
            app.podSelector.select(pod);
            for (let i = 0; i < 6; i++)
              app.tweens.update(performance.now() + 10000 + i);
          }
          manager.camera.position.set(0, 0, 60);
          manager.camera.lookAt(0, 0, 0);
          app.cellGroup.rotation.set(0, section === 0 ? progress : 0, 0);
          app.productAnchor.lookAt(manager.camera.position);
          const canvas = document.createElement("canvas");
          canvas.width = manager.renderer.domElement.width;
          canvas.height = manager.renderer.domElement.height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          const frames = [];
          for (const variant of ["original", "prepared"]) {
            for (const pair of window.geometryPairs)
              pair.node.geometry = pair[variant];
            manager.render();
            manager.render();
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(manager.renderer.domElement, 0, 0);
            const pixels = new Uint8Array(canvas.width * canvas.height * 4);
            const gl = manager.renderer.getContext();
            gl.readPixels(
              0,
              0,
              canvas.width,
              canvas.height,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            frames.push({
              pixels,
              calls: manager.renderer.info.render.calls,
              triangles: manager.renderer.info.render.triangles,
              image: saveImages ? canvas.toDataURL() : null,
            });
          }
          let changed = 0,
            max = 0,
            sum = 0,
            changedPixels = 0;
          for (let i = 0; i < frames[0].pixels.length; i += 4) {
            let pixelMax = 0;
            for (let c = 0; c < 4; c++) {
              const difference = Math.abs(
                frames[0].pixels[i + c] - frames[1].pixels[i + c],
              );
              if (difference) changed++;
              pixelMax = Math.max(pixelMax, difference);
              sum += difference;
            }
            max = Math.max(max, pixelMax);
            if (pixelMax > 8) changedPixels++;
          }
          return {
            changed,
            max,
            changedFraction: changedPixels / (frames[0].pixels.length / 4),
            mean: sum / frames[0].pixels.length,
            calls: frames.map((f) => f.calls),
            triangles: frames.map((f) => f.triangles),
            images: frames.map((f) => f.image),
            pod: app.podSelector.currentPod,
          };
        },
        pose,
      );
      const matched = result.mean < 0.05 && result.changedFraction < 0.001;
      if (!matched || [0, 6, 12, 63, 83, 113].includes(index)) {
        for (const [i, image] of result.images.entries())
          if (image)
            await writeFile(
              `${directory}/${viewport.width}-${index}-${i === 0 ? "before" : "after"}.png`,
              Buffer.from(image.split(",")[1], "base64"),
            );
      }
      delete result.images;
      captures.push({ ...pose, ...result });
      if (!matched)
        console.log(
          `Visual difference at ${viewport.width}, ${JSON.stringify(pose)}: ${JSON.stringify(result)}`,
        );
      assert.equal(result.calls[0], result.calls[1]);
      assert.equal(result.triangles[0], result.triangles[1]);
      if (pose.pod) assert.equal(result.pod, pose.pod);
      if (index % 40 === 0)
        console.log(
          `${engine.name()} ${viewport.width}: compared ${index + 1}/${poses.length}`,
        );
    }
    results.push({ viewport, resources, captures, errors });
    await writeFile(
      `${directory}/results.json`,
      JSON.stringify(results, null, 2),
    );
    await page.close();
    assert.deepEqual(errors, []);
    assert(
      captures.every((c) => c.mean < 0.05 && c.changedFraction < 0.001),
      "Unexpected visual difference",
    );
  }
} finally {
  await browser.close();
}
console.log(
  `${engine.name()}: all ${poses.length * 2} visual comparisons passed; geometry values and draw counts unchanged`,
);
