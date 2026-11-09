import { Uint16BufferAttribute } from "three";

// Draco emits Uint32 indices regardless of mesh size. Compact once, before
// GPU upload, retaining every vertex and triangle in its original order.
export function compactIndices(geometry) {
  const index = geometry.index;
  if (!(index?.array instanceof Uint32Array)) return;
  for (const value of index.array) if (value >= 65535) return;
  geometry.setIndex(new Uint16BufferAttribute(index.array, 1));
}
