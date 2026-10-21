import * as THREE from "three";

// Hides the incoming cell outside the applicator opening during the handoff.
export function createOverflowMask() {
  const maskMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(255 / 255, 251 / 255, 244 / 255) },
    },
    vertexShader: `
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
    fragmentShader: `
                uniform vec3 color;
                void main() {
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    transparent: true,
    opacity: 1,
    toneMapped: false,
  });

  const shape = new THREE.Shape();
  const planeSize = 10;
  shape.moveTo(-planeSize / 2, -planeSize / 2);
  shape.lineTo(planeSize / 2, -planeSize / 2);
  shape.lineTo(planeSize / 2, planeSize / 2);
  shape.lineTo(-planeSize / 2, planeSize / 2);
  shape.lineTo(-planeSize / 2, -planeSize / 2);

  // Add the circular hole
  const holePath = new THREE.Path();
  const holeRadius = 1.04;
  holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(holePath);

  const planeGeometry = new THREE.ShapeGeometry(shape);

  const planeMesh = new THREE.Mesh(planeGeometry, maskMaterial);
  planeMesh.visible = true;
  planeMesh.renderOrder = -1;
  planeMesh.rotation.x = Math.PI / 2;

  // Create cylinder geometry
  const cylinderGeometry = new THREE.CylinderGeometry(
    holeRadius * 4, // end radius
    holeRadius * 2, // start radius
    10, // height
    8, // radial segments
    1, // height segments
    true, // open ended
  );

  const cylinderMesh = new THREE.Mesh(cylinderGeometry, maskMaterial);
  cylinderMesh.position.y = 6;
  cylinderMesh.renderOrder = -1;

  // Create a parent group for the overflow mask
  const overflowMaskGroup = new THREE.Group();
  overflowMaskGroup.name = "overflowMask";
  overflowMaskGroup.position.y = 2.75;

  // Add both meshes to the group
  overflowMaskGroup.add(planeMesh);
  overflowMaskGroup.add(cylinderMesh);
  return overflowMaskGroup;
}
