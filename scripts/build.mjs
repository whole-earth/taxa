import { build, context } from "esbuild";
import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { watch } from "node:fs";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { prepareModel } from "./prepare-model.mjs";
import { bundleOptions } from "./bundle-options.mjs";

const serve = process.argv.includes("--serve");
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const directory of ["cell", "product", "site"]) {
  await cp(`assets/${directory}`, `dist/assets/${directory}`, {
    recursive: true,
    filter: (path) => !path.endsWith(".hdr") && !path.endsWith(".ttf"),
  });
}
await cp(
  "node_modules/three/examples/jsm/libs/draco/gltf",
  "dist/assets/draco",
  { recursive: true },
);
async function prepareProduct() {
  const product = prepareModel(
    await readFile("assets/product/swap.glb"),
    "product",
  );
  await writeFile("dist/assets/product/swap.glb", product);
  await writeFile(
    "dist/assets/product/swap.glb.gz",
    gzipSync(product, { level: 9 }),
  );
}
async function prepareRibbons() {
  await writeFile(
    "dist/assets/cell/ribbons.glb",
    prepareModel(await readFile("assets/cell/ribbons.glb"), "ribbons"),
  );
}
await prepareProduct();
await prepareRibbons();
async function compressReflections() {
  await writeFile(
    "dist/assets/cell/reflections.bin.gz",
    gzipSync(await readFile("assets/cell/reflections.bin"), { level: 9 }),
  );
}
await compressReflections();
const options = {
  ...bundleOptions,
  entryPoints: {
    "js/main": "js/main.js",
    "js/core/anim": "js/core/anim.js",
    style: "style.css",
  },
  outdir: "dist",
  define: { __TAXA_ASSET_PATH__: JSON.stringify("../../assets/") },
};
async function copyHtml() {
  let html = await readFile("index.html", "utf8");
  html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, "");
  await writeFile("dist/index.html", html);
}
await copyHtml();
if (serve) {
  const ctx = await context(options);
  await ctx.watch();
  const server = await ctx.serve({
    servedir: "dist",
    host: "127.0.0.1",
    port: Number(process.env.PORT || 4173),
  });
  watch(".", (_, filename) => {
    if (filename === "index.html") copyHtml().catch(console.error);
  });
  watch("assets", { recursive: true }, async (_, filename) => {
    if (!filename || filename.endsWith(".ttf") || filename.endsWith(".hdr"))
      return;
    try {
      await cp(`assets/${filename}`, `dist/assets/${filename}`, {
        recursive: true,
      });
      if (filename === "product/swap.glb") await prepareProduct();
      if (filename === "cell/ribbons.glb") await prepareRibbons();
      if (filename === "cell/reflections.bin") await compressReflections();
    } catch (error) {
      if (error.code !== "ENOENT") console.error(error);
    }
  });
  console.log(`Taxa branch demo: http://127.0.0.1:${server.port}`);
} else {
  const result = await build(options);
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/build-meta.json",
    JSON.stringify(result.metafile),
  );
  for (const path of Object.keys(result.metafile.outputs)) {
    if (!/\.(js|css)$/.test(path)) continue;
    const bytes = await readFile(path);
    console.log(
      `${path}: ${bytes.length} bytes; gzip ${gzipSync(bytes).length}; brotli ${brotliCompressSync(bytes).length}`,
    );
  }
}
