// Prepare a local Pages tree. This script never pushes or changes hosting.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { bundleOptions } from "./bundle-options.mjs";

const baseline = process.argv[2];
assert.match(
  baseline ?? "",
  /^[a-f0-9]{40}$/,
  "Pass the verified deployed commit's full SHA",
);
const git = (...args) =>
  execFileSync("git", args, { maxBuffer: 128 * 1024 * 1024 });
assert.equal(
  git("status", "--porcelain").toString().trim(),
  "",
  "Commit source changes before staging a reproducible release",
);
git("cat-file", "-e", `${baseline}^{commit}`);
const source = git("rev-parse", "HEAD").toString().trim();
for (const script of ["build", "check-models"])
  execFileSync(process.execPath, [`scripts/${script}.mjs`], {
    stdio: "inherit",
  });

const root = "test-results/release";
await rm(root, { recursive: true, force: true });
await mkdir(`${root}/site`, { recursive: true });
const rollback = git("archive", "--format=tar", baseline);
await writeFile(`${root}/rollback.tar`, rollback);
await writeFile(`${root}/source.tar`, git("archive", "--format=tar", source));
execFileSync("tar", ["-xf", "-", "-C", `${root}/site`], { input: rollback });

async function files(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      result.push(...(await files(`${directory}/${entry.name}`, `${path}/`)));
    else {
      assert(entry.isFile(), `Unexpected non-file: ${path}`);
      result.push(path);
    }
  }
  return result.sort();
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assets = [];
for (const directory of ["cell", "product", "draco"])
  for (const path of await files(`dist/assets/${directory}`)) {
    if (path.endsWith(".DS_Store") || path === "draco_encoder.js") continue;
    const name = `${directory}/${path}`;
    assets.push({
      path: name,
      sha256: hash(await readFile(`dist/assets/${name}`)),
    });
  }
for (const variant of ["desktop", "mobile"]) {
  const path = `site/product-preview-${variant}.webp`;
  assets.push({ path, sha256: hash(await readFile(`dist/assets/${path}`)) });
}
const assetDirectory = `assets/releases/${hash(JSON.stringify(assets)).slice(0, 20)}`;
// Script-only releases reuse immutable assets. Check every existing byte and
// path before reusing a content-addressed directory; never overwrite it.
const existingAssets = (await files(`${root}/site`)).filter((path) =>
  path.startsWith(`${assetDirectory}/`),
);
if (existingAssets.length)
  assert.deepEqual(
    existingAssets,
    assets.map(({ path }) => `${assetDirectory}/${path}`).sort(),
    "Existing release asset inventory differs",
  );
for (const { path, sha256 } of assets) {
  const destination = `${root}/site/${assetDirectory}/${path}`;
  if (existingAssets.length) {
    assert.equal(
      hash(await readFile(destination)),
      sha256,
      `Existing asset changed: ${path}`,
    );
    continue;
  }
  await mkdir(dirname(destination), { recursive: true });
  await cp(`dist/assets/${path}`, destination);
}

await build({
  ...bundleOptions,
  entryPoints: ["js/core/anim.js"],
  outfile: `${root}/site/js/core/anim.js`,
  define: { __TAXA_ASSET_PATH__: JSON.stringify(`../../${assetDirectory}/`) },
});
await writeFile(`${root}/site/.nojekyll`, "");

const inventory = [];
for (const path of await files(`${root}/site`)) {
  const bytes = await readFile(`${root}/site/${path}`);
  inventory.push({ path, bytes: bytes.length, sha256: hash(bytes) });
}
await writeFile(
  `${root}/manifest.json`,
  JSON.stringify(
    {
      source,
      baseline,
      entry: "js/core/anim.js",
      assetDirectory,
      publicEntry: "https://whole-earth.github.io/taxa/js/core/anim.js",
      archives: {
        rollback: hash(rollback),
        source: hash(await readFile(`${root}/source.tar`)),
      },
      files: inventory,
    },
    null,
    2,
  ) + "\n",
);
execFileSync(process.execPath, ["scripts/check-release.mjs"], {
  stdio: "inherit",
});
console.log(`Local release: ${root}/site (not deployed)`);
