import * as THREE from "three";

// Applicator-local coordinates, shared by the sleeve and the cell's pullback.
export const TUBE_INTERIOR = {
  radius: 1.5,
  top: 5.65,
  bottom: -5,
  cellDepth: -3.5,
  cellScale: 0.05,
};

export function createTubeInterior(tube) {
  const { radius, top, bottom } = TUBE_INTERIOR;
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    top - bottom,
    96,
    24,
    true,
  );
  geometry.translate(0, (top + bottom) / 2, 0);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const deep = new THREE.Color("#78848a");
  const opening = new THREE.Color("#e2e7e8");
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const depth = (positions.getY(i) - bottom) / (top - bottom);
    const angle = Math.atan2(positions.getZ(i), positions.getX(i));
    // Baked broad highlights give the wall depth without extra lights,
    // transmission buffers, textures, or dynamic lighting calculations.
    color.copy(deep).lerp(opening, depth * depth);
    color.multiplyScalar(0.9 + 0.1 * Math.cos(angle - 0.7));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const wall = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
  );
  wall.name = "tube-interior";
  wall.renderOrder = 2;

  const floorGeometry = new THREE.CircleGeometry(radius, 96);
  const floorColors = new Float32Array(
    floorGeometry.attributes.position.count * 3,
  );
  new THREE.Color("#b9c5c9").toArray(floorColors, 0);
  for (let i = 1; i < floorGeometry.attributes.position.count; i++) {
    const angle = Math.atan2(
      -floorGeometry.attributes.position.getY(i),
      floorGeometry.attributes.position.getX(i),
    );
    color.copy(deep).multiplyScalar(0.9 + 0.1 * Math.cos(angle - 0.7));
    color.toArray(floorColors, i * 3);
  }
  floorGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(floorColors, 3),
  );
  const floor = new THREE.Mesh(floorGeometry, wall.material);
  floor.name = "tube-floor";
  floor.renderOrder = 1;
  floor.rotation.x = Math.PI / 2;
  floor.position.y = bottom;

  // Reuse the authored locking track, ribs and stepped bore. Keep its
  // seated pose attached to the applicator throughout the optical zoom;
  // the exterior tube can still separate later for the assembly sequence.
  // Shared geometry adds no buffers or downloads. A separate matte material
  // exposes the inner surfaces without refracting stacked product shells.
  const details = new THREE.Mesh(
    tube.geometry,
    new THREE.MeshStandardMaterial({
      color: "#cbd0d2",
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      transparent: true,
      opacity: 0,
    }),
  );
  details.name = "tube-details";
  details.position.copy(tube.position);
  details.quaternion.copy(tube.quaternion);
  details.scale.copy(tube.scale);
  details.renderOrder = 3;

  // Once the camera exits, the opening clips the optical background to the
  // tube. While inside, this plane sits behind the camera and covers nothing.
  const shape = new THREE.Shape();
  shape.moveTo(-100, -100);
  shape.lineTo(100, -100);
  shape.lineTo(100, 100);
  shape.lineTo(-100, 100);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const aperture = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 96),
    new THREE.MeshBasicMaterial({
      color: "#fffbf4",
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      forceSinglePass: true,
    }),
  );
  aperture.name = "tube-aperture";
  // This is a background, not an occluder: it must never cut off the rim
  // or the pull tab when the camera clears the opening.
  aperture.renderOrder = -1;
  aperture.rotation.x = Math.PI / 2;
  aperture.position.y = top;
  // Draw the interior background before the translucent cell. Product
  // surfaces remain in their later group, so the seal can close over both.
  const root = new THREE.Group();
  root.name = "tube-interior-rig";
  root.renderOrder = 0;
  root.add(wall, floor, aperture, details);
  return { root, wall, floor, aperture, details };
}
