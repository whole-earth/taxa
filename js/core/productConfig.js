export const POD_COLORS = {
  orange: "#bf541e",
  green: "#00a86b",
  yellow: "#ffd700",
};
export const POD_LABELS = {
  orange: ["deodorant", "Body odor"],
  yellow: ["sunscreen", "Sunscreen"],
  green: ["anti-attractant", "Mosquito"],
};

export const PRODUCT_PHASE = {
  TRANSITION: "transition",
  DISPLAY: "display",
};

// Fractions of the cell-to-product zoom, independent of section height.
// Keep the refractive cap present while solid surfaces resolve later.
export const PRODUCT_REVEAL = {
  // Close behind the resolving seal while the view is still straight-on.
  // Wait until the camera has cleared the interior to avoid clipping jumps.
  assembly: { start: 0.75, end: 0.98 },
  body: { start: 0.2, end: 0.85 },
  // Both viewport paths have cleared the seal before its color appears.
  seal: { start: 0.7, end: 0.98 },
  lighting: { start: 0.35, end: 1 },
};
