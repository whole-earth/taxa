// Prove the build changes storage only: original vertex bits, triangle order,
// hierarchy and retained image bytes must survive preparation unchanged.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { BufferGeometry, Uint32BufferAttribute } from "three";
import { compactIndices } from "../js/models/geometry.js";

function unpack(bytes) {
  const length = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + length).toString());
  const binary = bytes.subarray(28 + length);
  const view = (index) => {
    const v = model.bufferViews[index];
    return binary.subarray(
      v.byteOffset ?? 0,
      (v.byteOffset ?? 0) + v.byteLength,
    );
  };
  const accessor = (index) => view(model.accessors[index].bufferView);
  return { model, view, accessor };
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function materialSignature(asset, index) {
  const material = structuredClone(asset.model.materials[index]);
  const resolve = (object) => {
    for (const [key, value] of Object.entries(object)) {
      if (!value || typeof value !== "object") continue;
      if (key.endsWith("Texture") && Number.isInteger(value.index)) {
        const texture = asset.model.textures[value.index];
        const image = asset.model.images[texture.source];
        value.index = {
          image: hash(asset.view(image.bufferView)),
          sampler: asset.model.samplers[texture.sampler],
        };
      } else resolve(value);
    }
  };
  resolve(material);
  return material;
}
for (const path of ["product/swap.glb", "cell/ribbons.glb"]) {
  const before = unpack(await readFile(`assets/${path}`));
  const after = unpack(await readFile(`dist/assets/${path}`));
  assert.deepEqual(after.model.nodes, before.model.nodes);
  assert.deepEqual(after.model.scenes, before.model.scenes);
  assert.equal(after.model.meshes.length, before.model.meshes.length);
  for (const [i, mesh] of after.model.meshes.entries()) {
    const original = before.model.meshes[i];
    assert.equal(mesh.primitives.length, original.primitives.length);
    for (const [j, primitive] of mesh.primitives.entries()) {
      const source = original.primitives[j];
      if (primitive.material !== undefined)
        assert.deepEqual(
          materialSignature(after, primitive.material),
          materialSignature(before, source.material),
          "Material settings or texture bindings changed",
        );
      const name = before.model.nodes.find((node) => node.mesh === i)?.name;
      const removable = path.startsWith("cell")
        ? ["NORMAL"]
        : ({
            bottom_dial: ["TEXCOORD_0"],
            "top-ring": ["TEXCOORD_0"],
            "applicator-color": ["TEXCOORD_0"],
            "taxa-name": ["NORMAL"],
          }[name] ?? []);
      for (const attribute of Object.keys(source.attributes))
        assert(
          attribute in primitive.attributes || removable.includes(attribute),
          `Removed a required attribute: ${name}.${attribute}`,
        );
      const draco = primitive.extensions?.KHR_draco_mesh_compression;
      if (draco) {
        assert.deepEqual(
          after.view(draco.bufferView),
          before.view(source.extensions.KHR_draco_mesh_compression.bufferView),
        );
        assert.equal(primitive.attributes.NORMAL, undefined);
        assert.equal(draco.attributes.NORMAL, undefined);
        continue;
      }
      for (const [name, index] of Object.entries(primitive.attributes)) {
        assert.deepEqual(
          after.accessor(index),
          before.accessor(source.attributes[name]),
          `${path}: changed ${name}`,
        );
        assert.equal(
          after.model.accessors[index].count,
          before.model.accessors[source.attributes[name]].count,
        );
      }
      const a = after.model.accessors[primitive.indices],
        b = before.model.accessors[source.indices];
      assert.equal(a.count, b.count);
      assert.equal(a.componentType, 5123);
      const av = after.accessor(primitive.indices),
        bv = before.accessor(source.indices);
      for (let k = 0; k < a.count; k++)
        assert.equal(
          av.readUInt16LE(k * 2),
          b.componentType === 5125
            ? bv.readUInt32LE(k * 4)
            : bv.readUInt16LE(k * 2),
        );
    }
  }
  const originalImages = new Set(
    (before.model.images ?? []).map((image) =>
      hash(before.view(image.bufferView)),
    ),
  );
  for (const image of after.model.images ?? [])
    assert(originalImages.has(hash(after.view(image.bufferView))));
  if (path.startsWith("product")) assert.equal(after.model.images.length, 4);
  console.log(
    `${path}: hierarchy, vertex bytes, triangle order and retained images preserved`,
  );
}
// The 65535 sentinel is excluded for WebGL primitive restart, even though it
// fits numerically in Uint16. Larger meshes must retain their original type.
for (const [indices, compact] of [
  [[0, 3, 65534], true],
  [[0, 65535, 1], false],
  [[0, 65536, 1], false],
]) {
  const geometry = new BufferGeometry();
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  compactIndices(geometry);
  assert.equal(geometry.index.array instanceof Uint16Array, compact);
  assert.deepEqual([...geometry.index.array], indices);
  geometry.dispose();
}
console.log(
  "Index compaction preserves values and handles the Uint16 boundary",
);
