// Build-only cleanup for this story's static models. Source GLBs remain
// untouched. Never decode/re-encode Draco or alter floating-point attributes.
import assert from "node:assert/strict";

function prune(model, collection, references) {
  const used = new Set(references.map(([object, key]) => object[key]));
  const mapping = new Map();
  model[collection] = (model[collection] ?? []).filter((_, index) => {
    if (!used.has(index)) return false;
    mapping.set(index, mapping.size);
    return true;
  });
  for (const [object, key] of references) {
    assert(mapping.has(object[key]), `Invalid ${collection} reference`);
    object[key] = mapping.get(object[key]);
  }
  if (!model[collection].length) delete model[collection];
}

function textureReferences(value, references = []) {
  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== "object") continue;
    if (key.endsWith("Texture") && Number.isInteger(child.index))
      references.push([child, "index"]);
    else textureReferences(child, references);
  }
  return references;
}

export function prepareModel(source, kind) {
  assert(["ribbons", "product"].includes(kind));
  assert.equal(source.readUInt32LE(0), 0x46546c67);
  assert.equal(source.readUInt32LE(4), 2);
  const jsonLength = source.readUInt32LE(12);
  const model = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
  const binary = source.subarray(28 + jsonLength);
  assert(
    !model.animations && !model.skins,
    "Cleanup supports static models only",
  );
  assert.equal(model.buffers.length, 1);
  const primitives = model.meshes.flatMap((mesh) => mesh.primitives);
  assert(primitives.every((primitive) => !primitive.targets));
  const replacements = new Map();

  if (kind === "ribbons") {
    assert.equal(primitives.length, 1);
    const primitive = primitives[0];
    assert(primitive.extensions?.KHR_draco_mesh_compression);
    // Ribbons use the unlit runtime material. Keep the Draco payload intact;
    // omit normal extraction and its worker-to-main buffer transfer.
    delete primitive.attributes.NORMAL;
    delete primitive.extensions.KHR_draco_mesh_compression.attributes.NORMAL;
  } else {
    const primitiveFor = (name) => {
      const node = model.nodes.find((node) => node.name === name);
      assert(node && Number.isInteger(node.mesh), `Missing ${name}`);
      const mesh = model.meshes[node.mesh];
      assert.equal(mesh.primitives.length, 1);
      return mesh.primitives[0];
    };
    // ProductModel replaces both of these materials with the animated pod
    // material before any render. Their exported normal map is never used.
    for (const name of ["top-ring", "applicator-color"]) {
      const primitive = primitiveFor(name);
      delete primitive.material;
      delete primitive.attributes.TEXCOORD_0;
    }
    const dial = primitiveFor("bottom_dial");
    assert.equal(
      textureReferences(model.materials[dial.material]).length,
      0,
      "Keep dial UVs if its material gains a texture",
    );
    delete dial.attributes.TEXCOORD_0;
    const wordmark = primitiveFor("taxa-name");
    assert(model.materials[wordmark.material].extensions.KHR_materials_unlit);
    delete wordmark.attributes.NORMAL;

    for (const primitive of primitives) {
      const accessor = model.accessors[primitive.indices];
      if (accessor.componentType !== 5125) continue;
      assert.equal(accessor.type, "SCALAR");
      assert(!accessor.sparse && !accessor.byteOffset);
      const view = model.bufferViews[accessor.bufferView];
      assert(!view.byteStride);
      assert.equal(view.byteLength, accessor.count * 4);
      const bytes = Buffer.alloc(accessor.count * 2);
      for (let i = 0; i < accessor.count; i++) {
        const index = binary.readUInt32LE((view.byteOffset ?? 0) + i * 4);
        assert(index < 65535, "Index exceeds Uint16 range");
        bytes.writeUInt16LE(index, i * 2);
      }
      accessor.componentType = 5123;
      replacements.set(view, bytes);
    }
  }

  prune(
    model,
    "materials",
    primitives
      .filter((p) => p.material !== undefined)
      .map((p) => [p, "material"]),
  );
  prune(model, "textures", textureReferences(model.materials ?? []));
  prune(
    model,
    "images",
    (model.textures ?? []).map((texture) => [texture, "source"]),
  );
  prune(
    model,
    "samplers",
    (model.textures ?? [])
      .filter((texture) => texture.sampler !== undefined)
      .map((texture) => [texture, "sampler"]),
  );
  prune(
    model,
    "accessors",
    primitives.flatMap((p) => [
      [p, "indices"],
      ...Object.keys(p.attributes).map((key) => [p.attributes, key]),
    ]),
  );
  const views = [
    ...model.accessors
      .filter((a) => a.bufferView !== undefined)
      .map((a) => [a, "bufferView"]),
    ...(model.images ?? []).map((image) => [image, "bufferView"]),
    ...primitives
      .filter((p) => p.extensions?.KHR_draco_mesh_compression)
      .map((p) => [p.extensions.KHR_draco_mesh_compression, "bufferView"]),
  ];
  // Save original view slices before rewriting their offsets.
  const data = new Map(
    model.bufferViews.map((view) => [
      view,
      replacements.get(view) ??
        binary.subarray(
          view.byteOffset ?? 0,
          (view.byteOffset ?? 0) + view.byteLength,
        ),
    ]),
  );
  prune(model, "bufferViews", views);
  const chunks = [];
  let offset = 0;
  for (const view of model.bufferViews) {
    const bytes = data.get(view);
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    const padding = (4 - (bytes.length % 4)) % 4;
    chunks.push(bytes, Buffer.alloc(padding));
    offset += bytes.length + padding;
  }
  model.buffers[0].byteLength = offset;
  const json = Buffer.from(JSON.stringify(model));
  const jsonChunk = Buffer.concat([
    json,
    Buffer.alloc((4 - (json.length % 4)) % 4, 32),
  ]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonChunk.length + offset, 8);
  header.writeUInt32LE(jsonChunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(offset, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, binHeader, ...chunks]);
}
