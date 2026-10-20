import * as THREE from "three";
import { POD_COLORS, PRODUCT_PHASE } from "../core/productConfig.js";
import { loadModel } from "./loader.js";
import { markMaterialsForUpdate } from "./materials.js";
import { createOverflowMask } from "./overflowMask.js";

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
    if (this.applicator) this.prepareApplicator(this.applicator);
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
    this.materials = new Set();
    this.root.traverse((node) => {
      if (node !== this.root && !node.isLight) node.visible = true;
      if (node.name === "overflowMask")
        node.visible = phase === PRODUCT_PHASE.TRANSITION;
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
        if (node.name === "outer-cap")
          material.ior = phase === PRODUCT_PHASE.TRANSITION ? 200 : 1.5;
        this.materials.add(material);
      }
    });
    return this.materials;
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

  prepareApplicator(applicator) {
    applicator.position.y = 0;
    applicator.add(createOverflowMask());
    const materialsToUpdate = [];
    applicator.traverse((child) => {
      if (child.isMesh) {
        child.visible = false;
        child.material.transparent = true;
        child.material.opacity = 0;
        materialsToUpdate.push(child.material);
      }
    });

    // Batch update all materials at once
    markMaterialsForUpdate(materialsToUpdate);
  }
}
