export function setupGUI(glass) {
  const gui = new dat.GUI();
  gui.add(glass, "opacity", 0, 1);
  gui.add(glass, "clearcoat", 0, 1);
  gui.add(glass, "clearcoatRoughness", 0, 1);
  gui.add(glass, "transmission", 0, 2);
  gui.add(glass, "chromaticAberration", 0, 30);
  gui.add(glass, "anisotrophicBlur", 0, 2);
  gui.add(glass, "roughness", 0, 1);
  gui.add(glass, "thickness", 0, 50);
  gui.add(glass, "ior", 0, 10);
  gui.add(glass, "distortion", 0, 9);
  gui.add(glass, "distortionScale", 0, 10);
  gui.add(glass, "temporalDistortion", 0, 1);
  gui.add(glass, "transparent");
}
