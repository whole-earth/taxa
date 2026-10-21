import * as THREE from "three";
import { POD_COLORS, PRODUCT_PHASE } from "../core/productConfig.js";
import { loadModel } from "./loader.js";
import { markMaterialsForUpdate } from "./materials.js";
import { createTubeInterior, TUBE_INTERIOR } from "./tubeInterior.js";

export async function loadProductModel(filename, options = {}) {
  return new ProductModel(
    await loadModel(`assets/product/${filename}`, options),
  );
}

// Owns the product hierarchy and its material phases. The timeline owns poses;
// the pod selector owns the applicator's temporary color-change animation.
export class ProductModel {
  constructor(root) {
    this.root = root;
    root.visible = false;
    root.rotation.x = Math.PI / 2;
    this.initializeMaterials();
    this.applicator = root.getObjectByName("applicator");
    if (this.applicator) this.applicator.position.y = 0;
    this.baseParts = ["bottom_dial", "tube", "dark-adapter"]
      .map((name) => root.getObjectByName(name))
      .filter(Boolean)
      .map((node) => ({ node, restY: node.position.y }));
    this.cap = root.getObjectByName("outer-cap");
    this.seal = root.getObjectByName("film-cover");
    this.rim = root.getObjectByName("top-ring");
    this.wordmark = root.getObjectByName("taxa-name");
    this.exteriorParts = [
      ...this.baseParts.map(({ node }) => node),
      this.cap,
      root.getObjectByName("applicator-color"),
    ].filter(Boolean);
    this.interior = createTubeInterior();
    this.applicator.add(this.interior.root);
    this.cellAnchor = new THREE.Object3D();
    this.cellAnchor.position.y = TUBE_INTERIOR.cellDepth;
    this.applicator.add(this.cellAnchor);
    if (this.seal) {
      // The seal is solid even while the story fades it in. Resolve its
      // nearest surface before blending the seal and rim, so the rim cannot
      // show through. Draw the optical interior first: otherwise this depth
      // surface cuts it off abruptly as the camera passes through the seal.
      // Share geometry; one depth draw + one color draw replaces the previous
      // two-sided color draws without increasing the transition's draw count.
      this.sealDepth = new THREE.Mesh(
        this.seal.geometry,
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          transparent: true,
          side: THREE.DoubleSide,
          forceSinglePass: true,
        }),
      );
      this.sealDepth.name = "seal-depth";
      this.sealDepth.renderOrder = 1;
      this.seal.add(this.sealDepth);
    }
    // Preserve the original product's effective precision, independently of
    // whichever particle material Three r173 encountered most recently.
    root.traverse((node) => {
      for (const material of Array.isArray(node.material)
        ? node.material
        : node.material
          ? [node.material]
          : []) {
        if (material.precision === null) material.precision = "lowp";
      }
    });
  }

  setMaterialPhase(phase) {
    if (phase === this.materialPhase) return this.materials;
    this.materialPhase = phase;
    const transitioning = phase === PRODUCT_PHASE.TRANSITION;
    // Keep the optical interior, seal depth, seal color, rim and branding in
    // stable order during the zoom. Restore normal sorting for the final pose.
    if (this.seal) this.seal.renderOrder = transitioning ? 2 : 0;
    if (this.rim) this.rim.renderOrder = transitioning ? 3 : 0;
    if (this.wordmark) this.wordmark.renderOrder = transitioning ? 4 : 0;
    this.materials = new Set();
    this.root.traverse((node) => {
      if (node !== this.root && !node.isLight) node.visible = true;
      if (
        node === this.interior.wall ||
        node === this.interior.floor ||
        node === this.interior.aperture
      ) {
        node.visible = transitioning;
        return;
      }
      if (node === this.sealDepth) {
        node.visible = phase === PRODUCT_PHASE.TRANSITION;
        return;
      }
      if (node === this.seal)
        node.material.forceSinglePass = phase === PRODUCT_PHASE.TRANSITION;
      if (!node.material) return;
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        const transparent =
          phase === PRODUCT_PHASE.TRANSITION ||
          node.name === "film-cover" ||
          node.name === "taxa-name";
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.visible = true;
        material.opacity = 1;
        if (node.name === "outer-cap") material.ior = 1.5;
        this.materials.add(material);
      }
    });
    return this.materials;
  }

  setBaseOffset(offset) {
    // These parts share the applicator's parent. Preserve their authored
    // spacing without adding a group that would alter transparent sorting.
    for (const { node, restY } of this.baseParts)
      node.position.y = restY + offset;
  }

  setRevealOpacity({ interior, exterior, seal }) {
    this.materials.forEach((material) => {
      material.opacity = exterior;
    });
    for (const node of this.exteriorParts) node.visible = exterior > 0;
    this.interior.root.visible = seal < 1;
    this.interior.wall.material.opacity = interior * (1 - seal);
    if (this.rim) this.rim.material.opacity = interior;
    // The seal and branding resolve together after the camera clears them.
    // The seal's depth draw still blocks the rim beneath the pull tab.
    if (this.seal) this.seal.material.opacity = seal;
    if (this.wordmark) this.wordmark.material.opacity = seal;
  }

  initializeMaterials() {
    // Set all meshes invisible initially
    const materialsToUpdate = [];
    const innerCapMaterials = [];

    this.root.traverse((child) => {
      if (child.isMesh) {
        child.visible = false;
        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial();
        }
        child.material.transparent = true;
        child.material.opacity = 0;
        // The GLB exports the frosted cap with a 50% alpha cutoff, despite
        // having no cutout texture. Remove it so the scroll fade cannot
        // discard the cap and expose the background halfway through.
        if (child.name === "outer-cap") child.material.alphaTest = 0;
        materialsToUpdate.push(child.material);
      }

      // Special handling for inner-cap object
      if (child.name === "inner-cap") {
        child.traverse((innerChild) => {
          if (innerChild.isMesh) {
            innerChild.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(POD_COLORS.orange),
              emissive: new THREE.Color(POD_COLORS.orange),
              transparent: true,
              opacity: 0,
              metalness: 0.5,
              roughness: 0.2,
            });
            innerCapMaterials.push(innerChild.material);
          }
        });
      }
    });

    // Batch update all materials at once
    markMaterialsForUpdate(materialsToUpdate);
    markMaterialsForUpdate(innerCapMaterials);
  }
}
