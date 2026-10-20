// Offline repair of the original seal's cut-through SWAP lettering. Rebuild
// only its center; preserve the rim, pull tab, side text and all other meshes.
// Usage: node scripts/repair-product-seal.mjs original.glb repaired.glb
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [input, output] = process.argv.slice(2);
assert(
  input && output && input !== output,
  "Provide separate input/output GLBs",
);
const source = await readFile(input);
assert.equal(
  createHash("sha256").update(source).digest("hex"),
  "6ad08dc43803e7c134fb4a8c710f5f64a45c96ab99a0d12e7263ad703e71bfb8",
  "The measured repair profile applies only to the original product asset",
);
assert.equal(source.readUInt32LE(0), 0x46546c67);
const jsonLength = source.readUInt32LE(12);
const model = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const binary = source.subarray(28 + jsonLength);
const mesh = model.nodes.find((node) => node.name === "film-cover").mesh;
const primitive = model.meshes[mesh].primitives[0];

function readAccessor(index) {
  const accessor = model.accessors[index];
  const view = model.bufferViews[accessor.bufferView];
  const size = accessor.type === "VEC3" ? 3 : 1;
  assert([5125, 5126].includes(accessor.componentType));
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? size * 4;
  return Array.from({ length: accessor.count }, (_, i) =>
    Array.from({ length: size }, (_, k) =>
      accessor.componentType === 5126
        ? binary.readFloatLE(offset + i * stride + k * 4)
        : binary.readUInt32LE(offset + i * stride + k * 4),
    ),
  );
}

const positions = readAccessor(primitive.attributes.POSITION);
const normals = readAccessor(primitive.attributes.NORMAL);
const indices = readAccessor(primitive.indices).flat();
assert.equal(positions.length, 11016, "Expected the original, unrepaired seal");
const radius = ([x, , z]) => Math.hypot(x, z);
const vertexKeys = new Map();
const welded = positions.map((position, i) => {
  const key = position.join(",");
  if (!vertexKeys.has(key)) vertexKeys.set(key, i);
  return vertexKeys.get(key);
});
const kept = [];
const edges = new Map();
for (let i = 0; i < indices.length; i += 3) {
  const triangle = indices.slice(i, i + 3);
  if (
    triangle.every((v) => positions[v][1] > 100) &&
    triangle.some((v) => radius(positions[v]) < 6)
  )
    continue;
  kept.push(...triangle);
  for (let edge = 0; edge < 3; edge++) {
    const a = welded[triangle[edge]],
      b = welded[triangle[(edge + 1) % 3]];
    const key = [a, b].sort((x, y) => x - y).join(",");
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
}

const neighbors = new Map();
for (const [key, count] of edges) {
  const [a, b] = key.split(",").map(Number);
  if (count !== 1 || positions[a][1] < 100 || positions[b][1] < 100) continue;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    if (!neighbors.has(from)) neighbors.set(from, []);
    neighbors.get(from).push(to);
  }
}
const loops = [];
while (neighbors.size) {
  const loop = [];
  let current = neighbors.keys().next().value,
    previous;
  while (!loop.includes(current)) {
    loop.push(current);
    const adjacent = neighbors.get(current);
    assert.equal(adjacent.length, 2, "Repair boundary must be a closed loop");
    const next = adjacent.find((v) => v !== previous);
    previous = current;
    current = next;
  }
  for (const vertex of loop) neighbors.delete(vertex);
  loops.push(loop);
}
assert.equal(loops.length, 2, "Expected the seal's upper and lower surfaces");
loops.sort(
  (a, b) =>
    Math.max(...b.map((i) => positions[i][1])) -
    Math.max(...a.map((i) => positions[i][1])),
);

// These radial samples come from intact portions of the exported dome,
// outside the lettering. Keep both surfaces and their original thin spacing.
const profiles = [
  [
    [5.28, 109.78085],
    [4.398, 109.88057],
    [3.491, 109.96367],
    [2.56, 110.02808],
    [1.608, 110.0717],
  ],
  [
    [5.269, 109.68114],
    [4.389, 109.78085],
    [3.484, 109.86395],
    [2.556, 109.92628],
    [1.606, 109.97198],
  ],
];
for (const [surface, loop] of loops.entries()) {
  const sign = surface === 0 ? 1 : -1;
  loop.sort(
    (a, b) =>
      Math.atan2(positions[a][2], positions[a][0]) -
      Math.atan2(positions[b][2], positions[b][0]),
  );
  const angles = loop.map((i) => Math.atan2(positions[i][2], positions[i][0]));
  let outer = loop;
  const addTriangle = (a, b, c) =>
    kept.push(...(sign > 0 ? [a, c, b] : [a, b, c]));
  for (const [sample, [r, y]] of profiles[surface].entries()) {
    const next = profiles[surface][sample + 1] ?? [0, y];
    const previous = profiles[surface][sample - 1] ?? [6.13, y - 0.1163];
    const slope = (next[1] - previous[1]) / (previous[0] - next[0]);
    const length = Math.hypot(slope, 1);
    const inner = angles.map((angle) => {
      const index = positions.length;
      positions.push([r * Math.cos(angle), y, r * Math.sin(angle)]);
      normals.push([
        (sign * slope * Math.cos(angle)) / length,
        sign / length,
        (sign * slope * Math.sin(angle)) / length,
      ]);
      return index;
    });
    for (let i = 0; i < outer.length; i++) {
      const next = (i + 1) % outer.length;
      addTriangle(outer[i], outer[next], inner[i]);
      addTriangle(outer[next], inner[next], inner[i]);
    }
    outer = inner;
  }
  const center = positions.length;
  positions.push([0, profiles[surface].at(-1)[1], 0]);
  normals.push([0, sign, 0]);
  for (let i = 0; i < outer.length; i++)
    addTriangle(outer[i], outer[(i + 1) % outer.length], center);
}

// Compact the repaired mesh, then replace only its three binary views.
const used = [...new Set(kept)];
const remap = new Map(used.map((v, i) => [v, i]));
const replacements = new Map();
for (const [index, data] of [
  [primitive.attributes.POSITION, used.map((i) => positions[i])],
  [primitive.attributes.NORMAL, used.map((i) => normals[i])],
  [primitive.indices, kept.map((i) => [remap.get(i)])],
]) {
  const accessor = model.accessors[index];
  const values = data.flat();
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) =>
    accessor.componentType === 5126
      ? bytes.writeFloatLE(value, i * 4)
      : bytes.writeUInt32LE(value, i * 4),
  );
  accessor.count = data.length;
  accessor.min = data[0].map((_, k) => Math.min(...data.map((v) => v[k])));
  accessor.max = data[0].map((_, k) => Math.max(...data.map((v) => v[k])));
  replacements.set(accessor.bufferView, bytes);
}
const chunks = [];
let offset = 0;
for (const [index, view] of model.bufferViews.entries()) {
  const bytes =
    replacements.get(index) ??
    binary.subarray(
      view.byteOffset ?? 0,
      (view.byteOffset ?? 0) + view.byteLength,
    );
  view.byteOffset = offset;
  view.byteLength = bytes.length;
  chunks.push(bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4));
  offset += bytes.length + ((4 - (bytes.length % 4)) % 4);
}
model.buffers[0].byteLength = offset;
const json = Buffer.from(JSON.stringify(model));
const jsonChunk = Buffer.concat([
  json,
  Buffer.alloc((4 - (json.length % 4)) % 4, 32),
]);
const binChunk = Buffer.concat(chunks);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonChunk.length + binChunk.length, 8);
header.writeUInt32LE(jsonChunk.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
await writeFile(
  output,
  Buffer.concat([header, jsonChunk, binHeader, binChunk]),
);
console.log(
  `Seal: ${indices.length / 3} → ${kept.length / 3} triangles; ${source.length} → ${header.readUInt32LE(8)} bytes`,
);
