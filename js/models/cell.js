import * as THREE from "three";
import { loadModel } from "./loader.js";

export async function loadCellModel(
  filename,
  {
    material,
    renderOrder,
    onProgress,
    assetBase = new URL("assets/", document.baseURI),
  },
) {
  const root = await loadModel(new URL(`cell/${filename}`, assetBase).href, {
    decoderPath: new URL("draco/", assetBase).href,
    renderOrder,
    onProgress,
  });
  const replacedMaterials = new Set();
  root.traverse((node) => {
    if (!node.isMesh) return;
    for (const original of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      replacedMaterials.add(original);
    }
    node.material = material;
  });
  replacedMaterials.forEach((original) => original.dispose());
  material.needsUpdate = true;
  return { root, bounds: new THREE.Box3().setFromObject(root) };
}
