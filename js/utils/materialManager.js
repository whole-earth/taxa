// Material.needsUpdate recompiles shader variants; color/opacity/roughness changes
// are uniforms and need no such flag. This helper is only for loader setup.
export const materialManager = {
  queueMaterialUpdate(materials) {
    for (const material of new Set(
      Array.isArray(materials) ? materials : [materials],
    )) {
      if (material) material.needsUpdate = true;
    }
  },
};
