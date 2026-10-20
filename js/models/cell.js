import * as THREE from "three";
import { loadModel } from "./loader.js";

export async function loadCellModel(
  filename,
  { material, renderOrder, onProgress },
) {
  const root = await loadModel(`assets/cell/${filename}`, {
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
