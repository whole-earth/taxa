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
export const PRODUCT_REVEAL = {
  interior: { start: 0, end: 0.4 },
  // The seal conceals the detailed internals before the exterior resolves.
  seal: { start: 0.7, end: 0.9 },
  exterior: { start: 0.9, end: 1 },
  lighting: { start: 0.35, end: 1 },
};
