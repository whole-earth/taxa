import * as THREE from "three";
import { Tween, Easing } from "tween";
import { state } from "./state.js";
import {
  MOBILIZE_GREEN,
  DESKTOP_BLUE,
  MOBILE_BLUE,
} from "../utils/materials.js";

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const quadratic = (value) => {
  const t = clamp(value);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
};

export class StoryTimeline {
  constructor(app) {
    this.app = app;
    this.mobile = app.mobile;
    this.ease = this.mobile ? quadratic : smooth;
    this.sections = ["splash", "zoom", "pitch", "product"].map((id) =>
      document.getElementById(id),
    );
    this.children = this.sections.map((section) =>
      section.querySelector(".child"),
    );
    this.zoomChildren = [...document.querySelectorAll(".zoom-child")];
    this.dots = [...document.querySelectorAll(".scroll-dot")];
    this.chapter = -1;
    this.topic = -1;
    this.phase = -1;
    this.rotationBoost = 0;
    this.lastY = window.scrollY;
    this.ribbons = app.ribbons.getObject();
    this.inner = app.blobInner.getObject();
    this.outer = app.blobOuter.getObject();
    this.innerMaterial = this.firstMaterial(this.inner);
    this.outerMaterial = this.firstMaterial(this.outer);
    this.ribbonMaterial = this.firstMaterial(this.ribbons);
    this.originalInner = this.innerMaterial.color.clone();
    this.originalOuter = this.outerMaterial.clone();
    this.materialTweens = new Map();
    this.measure();
    this.dots.forEach((dot, index) =>
      dot.addEventListener("click", () => this.goTo(index), {
        signal: app.events.signal,
      }),
    );
  }

  firstMaterial(root) {
    let result;
    root.traverse((node) => {
      if (!result && node.isMesh) result = node.material;
    });
    return result;
  }

  setMobile(mobile) {
    this.mobile = mobile;
    this.ease = mobile ? quadratic : smooth;
  }

  measure() {
    // Layout is read only on resize/font readiness, never interleaved with
    // per-frame style writes. The source section lengths match Webflow.
    this.bounds = this.sections.map((section) => ({
      top: section.offsetTop,
      height: section.offsetHeight,
    }));
    this.viewport = window.innerHeight;
    this.app.invalidate(true);
  }

  mix(start, end, progress) {
    return start + (end - start) * this.ease(progress);
  }
  progress(index, y) {
    const { top, height } = this.bounds[index];
    return clamp(
      (y - top) / Math.max(1, height - (index === 3 ? this.viewport : 0)),
    );
  }

  goTo(index, immediate = this.app.reducedMotion) {
    const { top, height } = this.bounds[index];
    const target =
      index === 3 ? top + height - this.viewport : top + (index ? 1 : 0);
    state.lenis.scrollTo(target, {
      duration: this.app.reducedMotion
        ? 0
        : Math.min(3.6, 1.2 + Math.abs(index - this.chapter) * 0.6),
      immediate,
    });
    this.app.invalidate(true);
  }

  setText(index) {
    this.children.forEach((child, i) => {
      const active = i === index;
      child.classList.toggle("active", active);
      child.inert = !active;
    });
  }

  tween(key, target, values, duration = 400) {
    const previous = this.materialTweens.get(key);
    if (previous) {
      previous.stop();
      state.tweens.remove(previous);
    }
    const tween = new Tween(target, state.tweens)
      .to(values, this.app.reducedMotion ? 0 : duration)
      .easing(Easing.Quadratic.InOut)
      .onComplete(() => this.materialTweens.delete(key));
    this.materialTweens.set(key, tween);
    tween.start();
  }

  mobilize(active) {
    const color = active ? MOBILIZE_GREEN : this.originalInner;
    this.tween(
      "inner-color",
      this.innerMaterial.color,
      { r: color.r, g: color.g, b: color.b },
      1120,
    );
    this.tween(
      "inner-scale",
      this.inner.scale,
      { x: active ? 1.1 : 1, y: active ? 1.1 : 1, z: active ? 1.1 : 1 },
      1120,
    );
    const blue = active
      ? this.mobile
        ? MOBILE_BLUE
        : DESKTOP_BLUE
      : this.originalOuter.color;
    this.tween(
      "outer-color",
      this.outerMaterial.color,
      { r: blue.r, g: blue.g, b: blue.b },
      1120,
    );
    const values = active
      ? { roughness: 0.4, metalness: 0, envMapIntensity: 0.6, opacity: 1 }
      : {
          roughness: this.originalOuter.roughness,
          metalness: this.originalOuter.metalness,
          envMapIntensity: this.originalOuter.envMapIntensity,
          opacity: this.originalOuter.opacity,
        };
    if (this.outerMaterial.isMeshPhysicalMaterial) {
      values.transmission = active ? 0.6 : this.originalOuter.transmission;
      values.reflectivity = active ? 0.4 : this.originalOuter.reflectivity;
    }
    this.tween("outer-surface", this.outerMaterial, values, 1120);
  }

  update(y) {
    const {
      sceneManager: manager,
      cellObject,
      speckleSystem: speckles,
      starField,
    } = this.app;
    const index =
      y < this.bounds[1].top
        ? 0
        : y < this.bounds[2].top
          ? 1
          : y < this.bounds[3].top
            ? 2
            : 3;
    const p = this.progress(index, y);
    const delta = y - this.lastY;
    this.lastY = y;
    if (delta)
      this.rotationBoost +=
        (delta *
          (delta > 0 ? (this.mobile ? 0.1 : 0.2) : this.mobile ? 0.06 : 0.12) -
          this.rotationBoost) *
        (this.mobile ? 0.05 : 0.2);
    this.rotationBoost = Math.max(-12, Math.min(12, this.rotationBoost));

    if (index !== this.chapter) {
      const previous = this.chapter;
      this.chapter = index;
      document.body.dataset.chapter = this.sections[index].id;
      this.dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === index);
        if (i === index) dot.setAttribute("aria-current", "step");
        else dot.removeAttribute("aria-current");
      });
      this.setText(index === 3 ? 2 : index);
      this.tween(
        "ribbons",
        this.ribbonMaterial,
        { opacity: index === 0 ? 1 : 0 },
        560,
      );
      if (index < 2 && previous >= 2) this.mobilize(false);
      else if (index >= 2 && previous < 2) this.mobilize(true);
      if (index === 0) {
        speckles.hide();
        this.topic = -1;
      }
      if (index === 1) this.topic = -1;
      if (index >= 2 && previous < 2) speckles.explode();
      this.phase = -1;
    }

    cellObject.visible = index !== 3 || p <= 0.7;
    starField.visible = index === 3 && p <= 0.7;
    if (starField.visible) starField.updateProgress(p * 1.66);
    manager.controls.autoRotate =
      !this.app.motionPaused &&
      !this.app.reducedMotion &&
      (index < 3 || p <= 0.22);
    manager.controls.enableRotate = index < 3 && !this.mobile;
    manager.directionalLight.visible = index === 3 && p > 0.7;
    // The frosted transition samples a blurred background. Rendering that
    // intermediate buffer at CSS-pixel resolution avoids a Retina-sized
    // multisample resolve/mipmap chain. Silhouettes, labels and the canvas
    // retain native DPR; the hero and final product use full-resolution
    // transmission. No geometry, texture, or material values are reduced.
    manager.renderer.transmissionResolutionScale =
      index === 3 && p > 0.3 && p <= 0.7
        ? Math.min(1, 1 / manager.renderer.getPixelRatio())
        : 1;
    document
      .querySelector(".nav")
      .classList.toggle("clear", index === 3 && p > 0.22);
    manager.renderer.toneMappingExposure = 1;
    this.app.ambientLight.intensity = 4;

    if (index === 0) cellObject.scale.setScalar(this.mix(1, 1.6, p));
    else if (index < 3) cellObject.scale.setScalar(1.6);

    if (index === 1) {
      const topic = Math.min(2, Math.floor(p * 3));
      if (topic !== this.topic) {
        this.topic = topic;
        const color = new THREE.Color(["#ffbb65", "#f1ff00", "#92cb86"][topic]);
        this.zoomChildren.forEach((child, i) => {
          child.classList.toggle("active", i === topic);
          child.inert = i !== topic;
        });
        speckles.show(color, this.app.reducedMotion ? 0 : 400);
        if (!this.mobile)
          this.tween("sheen", this.innerMaterial.sheenColor, {
            r: color.r,
            g: color.g,
            b: color.b,
          });
      }
    }
    if (index === 0 && this.topic === -1 && !this.mobile) {
      const color = this.originalInner;
      if (!this.materialTweens.has("sheen"))
        this.innerMaterial.sheenColor.copy(color);
    }

    const product = this.app.product?.getObject();
    if (product) product.visible = index === 3 && p > 0.3;
    if (index === 3) {
      cellObject.scale.setScalar(
        this.mix(1.6, this.mobile ? 0.05 : 0.016, p / 0.7),
      );
      this.setText(p > 0.95 ? 3 : p > 0.4 ? -1 : 2);
      if (product) this.updateProduct(product, p);
      else if (!this.app.productError) {
        document.querySelector(".load-progress").hidden = false;
        document.getElementById("loadProgressCount").textContent =
          "Preparing the product…";
      }
    }
    if (index < 3 && !this.app.productError)
      document.querySelector(".load-progress").hidden = true;
    // Once the reader enters the story, prepare the later product while there
    // is still a full chapter of scrolling available for decode/compilation.
    if (index >= 1) this.app.preloadProduct();
  }

  updateProduct(product, progress) {
    const { sceneManager: manager, ambientLight } = this.app;
    const applicator = state.applicatorObject;
    const phase = progress <= 0.7 ? 0 : 1;
    if (phase !== this.phase || this.productObject !== product) {
      this.phase = phase;
      this.productObject = product;
      this.productMaterials = this.app.product.setPhase(phase);
    }
    // Evaluate every transform from absolute progress. Seeking, resizing and
    // reverse scrolling never depend on visiting an earlier phase first.
    const rotation = clamp((progress - 0.7) / 0.2);
    const secondHalf = clamp((rotation - 0.5) / 0.5);
    if (progress <= 0.7) {
      const scale = this.mix(
        this.mobile ? 26 : 20,
        this.mobile ? 4.8 : 4,
        (progress - 0.3) / 0.4,
      );
      product.position.set(0, 0, 0);
      product.rotation.set(Math.PI / 2, 0, 0);
      product.scale.setScalar(scale);
      const opacity = clamp((progress - 0.3) / 0.4);
      this.productMaterials.forEach((mat) => {
        mat.opacity = opacity;
      });
      manager.renderer.toneMappingExposure = this.mix(
        1,
        0.6,
        (progress - 0.3) / 0.4,
      );
    } else if (this.mobile) {
      product.rotation.set(
        this.mix(Math.PI / 2, Math.PI / 7, rotation),
        this.mix(0, Math.PI / 5, rotation),
        this.mix(0, -Math.PI / 6, rotation),
      );
      product.position.set(
        this.mix(0, -3, rotation),
        this.mix(0, 5.4, rotation),
        0,
      );
      product.scale.setScalar(this.mix(4.8, 5.2, rotation));
    } else {
      product.rotation.set(
        this.mix(Math.PI / 2, Math.PI / 12, rotation),
        this.mix(0, Math.PI / 3.6, secondHalf),
        this.mix(0, -Math.PI / 8, secondHalf),
      );
      product.position.set(
        this.mix(0, -20, secondHalf),
        this.mix(0, -16, secondHalf),
        0,
      );
      product.scale.setScalar(this.mix(4, 5.5, secondHalf));
    }
    if (progress > 0.7)
      manager.renderer.toneMappingExposure = this.mix(0.6, 0.36, rotation);
    const lightProgress = this.mobile
      ? clamp((progress - 0.85) / 0.05)
      : secondHalf;
    manager.directionalLight.intensity = this.mix(0, 8, lightProgress);
    ambientLight.intensity = this.mix(4.6, 3.2, lightProgress);
    if (applicator && !this.app.colorSequence?.isAnimating) {
      applicator.position.y = this.mix(1, 0, (progress - 0.9) / 0.05);
      applicator.rotation.y = this.mix(
        0,
        Math.PI * 0.26,
        (progress - 0.95) / 0.05,
      );
    }
  }

  tick(delta) {
    this.rotationBoost *= Math.exp(-delta * (this.mobile ? 3 : 12));
    if (Math.abs(this.rotationBoost) < 0.001) this.rotationBoost = 0;
    this.app.sceneManager.controls.autoRotateSpeed = 0.4 + this.rotationBoost;
  }

  dispose() {
    this.originalOuter.dispose();
  }
}
