// Use after loader setup changes shader features. Color, opacity and other
// uniform-only animation changes do not require shader invalidation.
export function markMaterialsForUpdate(materials) {
  for (const material of new Set(materials)) {
    if (material) material.needsUpdate = true;
  }
}
