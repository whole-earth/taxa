// Verify the deployable tree against Git's production blobs and its manifest.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const root = process.env.RELEASE_DIR || "test-results/release";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [name, expected] of Object.entries(manifest.archives))
  assert.equal(
    hash(await readFile(`${root}/${name}.tar`)),
    expected,
    `${name} archive changed`,
  );
const inventory = new Map(manifest.files.map((file) => [file.path, file]));
for (const file of manifest.files) {
  const bytes = await readFile(`${root}/site/${file.path}`);
  assert.equal(bytes.length, file.bytes, `${file.path}: size changed`);
  assert.equal(hash(bytes), file.sha256, `${file.path}: content changed`);
}
async function walk(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      result.push(...(await walk(`${directory}/${entry.name}`, `${path}/`)));
    else {
      assert(entry.isFile());
      result.push(path);
    }
  }
  return result.sort();
}
assert.deepEqual(
  await walk(`${root}/site`),
  [...inventory.keys()].sort(),
  "Unmanifested release files",
);
const tree = execFileSync("git", ["ls-tree", "-rz", manifest.baseline], {
  maxBuffer: 8 * 1024 * 1024,
})
  .toString()
  .split("\0")
  .filter(Boolean);
const oldPaths = new Set();
let retained = 0;
for (const record of tree) {
  const [metadata, path] = record.split("\t");
  const [mode, type, sha] = metadata.split(" ");
  assert.equal(type, "blob");
  assert.match(mode, /^100/);
  oldPaths.add(path);
  if (path === manifest.entry) continue;
  const bytes = await readFile(`${root}/site/${path}`);
  const actual = createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
  assert.equal(actual, sha, `Legacy file changed: ${path}`);
  retained++;
}
for (const path of inventory.keys())
  assert(
    oldPaths.has(path) ||
      path === ".nojekyll" ||
      path.startsWith(`${manifest.assetDirectory}/`),
    `Unexpected published file: ${path}`,
  );
for (const variant of ["desktop", "mobile"])
  assert(
    inventory.has(
      `${manifest.assetDirectory}/site/product-preview-${variant}.webp`,
    ),
    "Missing late-product preview",
  );
const bundle = await readFile(`${root}/site/${manifest.entry}`, "utf8");
assert(
  bundle.includes(`../../${manifest.assetDirectory}/`),
  "Bundle does not target the versioned assets",
);
assert(
  !bundle.includes('"../../assets/"'),
  "Bundle retains the unversioned asset base",
);
assert(
  !inventory.has("webflow.html"),
  "Captured Webflow page must never be published",
);
console.log(
  `Release verified: ${retained} legacy files unchanged; ${inventory.size} files hashed; source/rollback archives intact.`,
);
