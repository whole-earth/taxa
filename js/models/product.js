import * as THREE from "three";
import { POD_COLORS, PRODUCT_PHASE } from "../core/productConfig.js";
import { loadModel } from "./loader.js";
import { createOverflowMask } from "./overflowMask.js";

export async function loadProductModel(
  filename,
  { assetBase = new URL("assets/", document.baseURI), ...options } = {},
) {
  return new ProductModel(
    await loadModel(new URL(`product/${filename}`, assetBase).href, {
      ...options,
      decoderPath: new URL("draco/", assetBase).href,
    }),
  );
}

// Owns model parts and materials. The timeline owns scroll poses; the pod
// selector owns the applicator's temporary color-change animation.
export class ProductModel {
  constructor(root) {
    this.root = root;
    root.visible = false;
    root.rotation.x = Math.PI / 2;
    this.applicator = root.getObjectByName("applicator");
    this.cap = root.getObjectByName("outer-cap");
    this.seal = root.getObjectByName("film-cover");
    this.rim = root.getObjectByName("top-ring");
    this.wordmark = root.getObjectByName("taxa-name");
    if (this.applicator) {
      this.applicator.position.y = 0;
      this.overflowMask = createOverflowMask();
      this.applicator.add(this.overflowMask);
    }
    if (this.seal) {
      // Draw the optical interior first, then resolve the seal's nearest
      // surface before blending its color and the rim. This prevents both
      // the rim showing through the tab and an abrupt interior cutoff.
      // Geometry is shared; the depth/color pair replaces two-sided color.
      this.sealDepth = new THREE.Mesh(
        this.seal.geometry,
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          transparent: true,
          side: THREE.DoubleSide,
          forceSinglePass: true,
          precision: "lowp",
        }),
      );
      this.sealDepth.name = "seal-depth";
      this.sealDepth.renderOrder = 1;
      this.seal.add(this.sealDepth);
    }
    this.prepareMeshes();
  }

  prepareMeshes() {
    const podMeshes = new Set();
    this.root.getObjectByName("inner-cap")?.traverse((node) => {
      if (node.isMesh) podMeshes.add(node);
    });
    const replaced = new Set();
    this.nodes = [];
    this.meshMaterials = new Map();
    this.materials = new Set();
    this.podMaterials = new Set();
    this.root.traverse((node) => {
      if (node !== this.root && !node.isLight) this.nodes.push(node);
      if (!node.isMesh || node === this.sealDepth) return;
      if (podMeshes.has(node)) {
        for (const material of [node.material].flat())
          if (material) replaced.add(material);
        node.material = new THREE.MeshStandardMaterial({
          color: POD_COLORS.orange,
          emissive: POD_COLORS.orange,
          metalness: 0.5,
          roughness: 0.2,
        });
        this.podMaterials.add(node.material);
      }
      node.material ??= new THREE.MeshStandardMaterial();
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      this.meshMaterials.set(node, materials);
      node.visible = false;
      for (const material of materials) {
        material.transparent = true;
        material.opacity = 0;
        // Preserve the product's original precision regardless of which
        // particle material Three encountered before it.
        if (material.precision === null) material.precision = "lowp";
        // This exported alpha cutoff has no cutout texture. Leaving it in
        // place makes the cap disappear abruptly halfway through its fade.
        if (node === this.cap) material.alphaTest = 0;
        this.materials.add(material);
      }
    });
    for (const material of this.materials) material.needsUpdate = true;
    for (const material of replaced)
      if (!this.materials.has(material)) material.dispose();
  }

  setMaterialPhase(phase) {
    if (phase === this.materialPhase) return this.materials;
    this.materialPhase = phase;
    const transitioning = phase === PRODUCT_PHASE.TRANSITION;
    for (const node of this.nodes) node.visible = true;
    if (this.overflowMask) this.overflowMask.visible = transitioning;
    if (this.sealDepth) this.sealDepth.visible = transitioning;
    // Keep the optical interior, depth, seal, rim and branding in stable
    // order during the zoom. Restore normal sorting for the final pose.
    if (this.seal) {
      this.seal.renderOrder = transitioning ? 2 : 0;
      this.seal.material.forceSinglePass = transitioning;
    }
    if (this.rim) this.rim.renderOrder = transitioning ? 3 : 0;
    if (this.wordmark) this.wordmark.renderOrder = transitioning ? 4 : 0;
    for (const [mesh, materials] of this.meshMaterials) {
      const transparent =
        transitioning || mesh === this.seal || mesh === this.wordmark;
      for (const material of materials) {
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.visible = true;
        material.opacity = 1;
        if (mesh === this.cap) material.ior = transitioning ? 200 : 1.5;
      }
    }
    return this.materials;
  }

  setRevealOpacity({ body, cap, seal }) {
    for (const material of this.materials) material.opacity = body;
    // Branding resolves with the seal; the separate depth draw still blocks
    // the rim beneath the pull tab throughout the reveal.
    if (this.cap) this.cap.material.opacity = cap;
    if (this.seal) this.seal.material.opacity = seal;
    if (this.wordmark) this.wordmark.material.opacity = seal;
  }
}
