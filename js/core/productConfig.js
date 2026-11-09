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

// Absolute product-section progress, except turn (relative to the tilt).
// Durations remain explicit to preserve the original interpolation arithmetic.
export const PRODUCT_TIMING = {
  zoom: { start: 0.3, end: 0.7, duration: 0.4 },
  tilt: { start: 0.7, duration: 0.2 },
  turn: { start: 0.5, duration: 0.5 },
  capDescent: { start: 0.9, duration: 0.05 },
  capLock: { start: 0.95, duration: 0.05 },
  mobileLighting: { start: 0.85, duration: 0.05 },
  interactionEnd: 0.22,
  textExit: 0.4,
  textEnter: 0.95,
};

// Fractions of the cell-to-product zoom, independent of section height.
// Keep the refractive cap present while solid surfaces resolve later.
export const PRODUCT_REVEAL = {
  body: { start: 0.2, end: 0.85 },
  // Both viewport paths have cleared the seal before its color appears.
  seal: { start: 0.7, end: 0.98 },
  lighting: { start: 0.35, end: 1 },
};
