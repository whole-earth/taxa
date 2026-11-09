import * as THREE from "three";
import {
  PRODUCT_PHASE,
  PRODUCT_REVEAL,
  PRODUCT_TIMING,
} from "./productConfig.js";
import { Tween, Easing } from "tween";
import {
  MOBILIZED_GREEN,
  MOBILIZED_BLUE,
  MOBILIZED_BLUE_MOBILE,
} from "./cellMaterials.js";

const { zoom, tilt, turn, baseReveal, capDescent, capLock, mobileLighting } =
  PRODUCT_TIMING;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const revealStage = (progress, { start, end }) =>
  smoothstep((progress - start) / (end - start));
const easeInOutQuad = (value) => {
  const t = clamp01(value);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
};

export class StoryTimeline {
  constructor(app) {
    this.app = app;
    this.isMobile = app.isMobile;
    this.ease = this.isMobile ? easeInOutQuad : smoothstep;
    this.sectionNames = ["splash", "zoom", "pitch", "product"];
    this.sections = this.sectionNames.map((id) =>
      app.webflow
        ? document.querySelector(`.main > .${id}`)
        : document.getElementById(id),
    );
    this.chapterPanels = this.sections.map((section) =>
      section.querySelector(app.webflow ? ":scope > .child" : ".story-panel"),
    );
    this.topicPanels = [
      ...document.querySelectorAll(
        app.webflow ? ".zoom-child" : ".topic-panel",
      ),
    ];
    this.chapterButtons = [...document.querySelectorAll(".scroll-dot")];
    this.nav = document.querySelector(".nav");
    this.chapter = -1;
    this.topic = -1;
    this.productPhase = null;
    this.rotationBoost = 0;
    this.lastScrollY = window.scrollY;
    this.ribbons = app.ribbons.root;
    this.innerCell = app.innerCell.root;
    this.cellShell = app.cellShell.root;
    this.innerMaterial = this.firstMaterial(this.innerCell);
    this.outerMaterial = this.firstMaterial(this.cellShell);
    this.ribbonMaterial = this.firstMaterial(this.ribbons);
    this.originalInnerColor = this.innerMaterial.color.clone();
    // Only these values change during mobilization; retain their originals
    // without cloning a renderer material and its unrelated properties.
    const shell = this.outerMaterial;
    this.originalShell = {
      color: shell.color.clone(),
      roughness: shell.roughness,
      metalness: shell.metalness,
      envMapIntensity: shell.envMapIntensity,
      opacity: shell.opacity,
      transmission: shell.transmission,
      reflectivity: shell.reflectivity,
    };
    this.materialTweens = new Map();
    this.measure();
    this.chapterButtons.forEach((dot, index) =>
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
    this.isMobile = mobile;
    this.ease = mobile ? easeInOutQuad : smoothstep;
  }

  measure() {
    // Layout is read only on resize/font readiness, never interleaved with
    // per-frame style writes. The source section lengths match Webflow.
    this.bounds = this.sections.map((section) => ({
      top: section.offsetTop,
      height: section.offsetHeight,
    }));
    this.viewportHeight = window.innerHeight;
    this.app.invalidate(true);
  }

  mix(start, end, progress) {
    return start + (end - start) * this.ease(progress);
  }
  progress(index, y) {
    const { top, height } = this.bounds[index];
    return clamp01(
      (y - top) / Math.max(1, height - (index === 3 ? this.viewportHeight : 0)),
    );
  }

  goTo(index, immediate = this.app.reducedMotion) {
    const { top, height } = this.bounds[index];
    const target =
      index === 3 ? top + height - this.viewportHeight : top + (index ? 1 : 0);
    this.app.scroller.scrollTo(target, {
      duration: this.app.reducedMotion
        ? 0
        : Math.min(3.6, 1.2 + Math.abs(index - this.chapter) * 0.6),
      immediate,
    });
    this.app.invalidate(true);
  }

  setText(index) {
    if (index === this.textIndex) return;
    this.textIndex = index;
    this.chapterPanels.forEach((child, i) => {
      const active = i === index;
      child.classList.toggle("active", active);
      child.inert = !active;
    });
  }

  tween(key, target, values, duration = 400) {
    const previous = this.materialTweens.get(key);
    if (previous) {
      previous.stop();
      this.app.tweens.remove(previous);
    }
    if (this.app.reducedMotion) {
      this.materialTweens.delete(key);
      Object.assign(target, values);
      return;
    }
    const tween = new Tween(target, this.app.tweens)
      .to(values, duration)
      .easing(Easing.Quadratic.InOut)
      .onComplete(() => this.materialTweens.delete(key));
    this.materialTweens.set(key, tween);
    tween.start();
  }

  mobilize(active) {
    const color = active ? MOBILIZED_GREEN : this.originalInnerColor;
    this.tween(
      "inner-color",
      this.innerMaterial.color,
      { r: color.r, g: color.g, b: color.b },
      1120,
    );
    this.tween(
      "inner-scale",
      this.innerCell.scale,
      { x: active ? 1.1 : 1, y: active ? 1.1 : 1, z: active ? 1.1 : 1 },
      1120,
    );
    const blue = active
      ? this.isMobile
        ? MOBILIZED_BLUE_MOBILE
        : MOBILIZED_BLUE
      : this.originalShell.color;
    this.tween(
      "outer-color",
      this.outerMaterial.color,
      { r: blue.r, g: blue.g, b: blue.b },
      1120,
    );
    const values = active
      ? { roughness: 0.4, metalness: 0, envMapIntensity: 0.6, opacity: 1 }
      : {
          roughness: this.originalShell.roughness,
          metalness: this.originalShell.metalness,
          envMapIntensity: this.originalShell.envMapIntensity,
          opacity: this.originalShell.opacity,
        };
    if (this.outerMaterial.isMeshPhysicalMaterial) {
      values.transmission = active ? 0.6 : this.originalShell.transmission;
      values.reflectivity = active ? 0.4 : this.originalShell.reflectivity;
    }
    this.tween("outer-surface", this.outerMaterial, values, 1120);
  }

  update(y) {
    const {
      sceneManager: manager,
      cellGroup,
      speckles,
      zoomStreaks,
    } = this.app;
    const index =
      y < this.bounds[1].top
        ? 0
        : y < this.bounds[2].top
          ? 1
          : y < this.bounds[3].top
            ? 2
            : 3;
    const progress = this.progress(index, y);
    const delta = y - this.lastScrollY;
    this.lastScrollY = y;
    if (delta)
      this.rotationBoost +=
        (delta *
          (delta > 0
            ? this.isMobile
              ? 0.1
              : 0.2
            : this.isMobile
              ? 0.06
              : 0.12) -
          this.rotationBoost) *
        (this.isMobile ? 0.05 : 0.2);
    this.rotationBoost = Math.max(-12, Math.min(12, this.rotationBoost));

    if (index !== this.chapter) {
      const previous = this.chapter;
      this.chapter = index;
      document.body.dataset.chapter = this.sectionNames[index];
      this.chapterButtons.forEach((dot, i) => {
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
      this.productPhase = null;
    }

    const waitingForProduct = index === 3 && !this.app.product;
    const visualProgress = waitingForProduct
      ? Math.min(progress, zoom.start)
      : progress;
    this.app.productFallback.update(waitingForProduct, progress, this.isMobile);
    cellGroup.visible = index !== 3 || visualProgress <= zoom.end;
    zoomStreaks.visible = index === 3 && visualProgress <= zoom.end;
    if (zoomStreaks.visible) zoomStreaks.updateProgress(visualProgress * 1.66);
    manager.controls.autoRotate =
      !this.app.motionPaused &&
      !this.app.reducedMotion &&
      (index < 3 || progress <= PRODUCT_TIMING.interactionEnd);
    manager.controls.enableRotate = index < 3 && !this.isMobile;
    manager.productLight.visible = index === 3 && visualProgress > zoom.end;
    // The frosted transition samples a blurred background. Rendering that
    // intermediate buffer at CSS-pixel resolution avoids a Retina-sized
    // multisample resolve/mipmap chain. Silhouettes, labels and the canvas
    // retain native DPR; the hero and final product use full-resolution
    // transmission. No geometry, texture, or material values are reduced.
    manager.renderer.transmissionResolutionScale =
      index === 3 && visualProgress > zoom.start && visualProgress <= zoom.end
        ? Math.min(1, 1 / manager.renderer.getPixelRatio())
        : 1;
    const clearNav = index === 3 && progress > PRODUCT_TIMING.interactionEnd;
    if (clearNav !== this.clearNav) {
      this.clearNav = clearNav;
      this.nav.classList.toggle("clear", clearNav);
    }
    manager.renderer.toneMappingExposure = 1;
    this.app.ambientLight.intensity = 4;

    if (index === 0) cellGroup.scale.setScalar(this.mix(1, 1.6, progress));
    else if (index < 3) cellGroup.scale.setScalar(1.6);

    if (index === 1) {
      const topic = Math.min(2, Math.floor(progress * 3));
      if (topic !== this.topic) {
        this.topic = topic;
        const color = new THREE.Color(["#ffbb65", "#f1ff00", "#92cb86"][topic]);
        this.topicPanels.forEach((child, i) => {
          child.classList.toggle("active", i === topic);
          child.inert = i !== topic;
        });
        speckles.show(color, this.app.reducedMotion ? 0 : 400);
        if (!this.isMobile)
          this.tween("sheen", this.innerMaterial.sheenColor, {
            r: color.r,
            g: color.g,
            b: color.b,
          });
      }
    }
    if (index === 0 && this.topic === -1 && !this.isMobile) {
      const color = this.originalInnerColor;
      if (!this.materialTweens.has("sheen"))
        this.innerMaterial.sheenColor.copy(color);
    }

    const product = this.app.product?.root;
    if (product) product.visible = index === 3 && progress > zoom.start;
    if (index === 3) {
      cellGroup.scale.setScalar(
        this.mix(1.6, this.isMobile ? 0.05 : 0.016, visualProgress / zoom.end),
      );
      this.setText(
        progress > PRODUCT_TIMING.textEnter
          ? 3
          : progress > PRODUCT_TIMING.textExit
            ? -1
            : 2,
      );
      if (product) this.updateProduct(product, progress);
      else if (!this.app.productError) {
        this.app.loadingStatus.show("Preparing the product…");
      }
    }
    if (index < 3 && !this.app.productError) this.app.loadingStatus.hide();
    // Initialization already starts preparation after the cell downloads.
    // This idempotent call also covers direct seeks into later chapters.
    if (index >= 1) this.app.prepareProduct();
  }

  updateProduct(product, progress) {
    const { sceneManager: manager, ambientLight } = this.app;
    const applicator = this.app.product?.applicator;
    const phase =
      progress <= zoom.end
        ? PRODUCT_PHASE.TRANSITION
        : progress < baseReveal.end
          ? PRODUCT_PHASE.TURN
          : PRODUCT_PHASE.DISPLAY;
    if (phase !== this.productPhase || this.productObject !== product) {
      this.productPhase = phase;
      this.productObject = product;
      this.app.product.setMaterialPhase(phase);
    }
    // Evaluate every transform from absolute progress. Seeking, resizing and
    // reverse scrolling never depend on visiting an earlier phase first.
    const tiltProgress = clamp01((progress - tilt.start) / tilt.duration);
    const turnProgress = clamp01((tiltProgress - turn.start) / turn.duration);
    if (progress <= zoom.end) {
      const reveal = clamp01((progress - zoom.start) / zoom.duration);
      const scale = this.mix(
        this.isMobile ? 26 : 20,
        this.isMobile ? 4.8 : 4,
        reveal,
      );
      product.position.set(0, 0, 0);
      product.rotation.set(Math.PI / 2, 0, 0);
      product.scale.setScalar(scale);
      this.app.product.setRevealOpacity({
        cap: reveal,
        body: revealStage(reveal, PRODUCT_REVEAL.body),
        seal: revealStage(reveal, PRODUCT_REVEAL.seal),
      });
      manager.renderer.toneMappingExposure =
        1 - 0.4 * revealStage(reveal, PRODUCT_REVEAL.lighting);
    } else if (this.isMobile) {
      product.rotation.set(
        this.mix(Math.PI / 2, Math.PI / 7, tiltProgress),
        this.mix(0, Math.PI / 5, tiltProgress),
        this.mix(0, -Math.PI / 6, tiltProgress),
      );
      product.position.set(
        this.mix(0, -3, tiltProgress),
        this.mix(0, 5.4, tiltProgress),
        0,
      );
      product.scale.setScalar(this.mix(4.8, 5.2, tiltProgress));
    } else {
      product.rotation.set(
        this.mix(Math.PI / 2, Math.PI / 12, tiltProgress),
        this.mix(0, Math.PI / 3.6, turnProgress),
        this.mix(0, -Math.PI / 8, turnProgress),
      );
      product.position.set(
        this.mix(0, -20, turnProgress),
        this.mix(0, -16, turnProgress),
        0,
      );
      product.scale.setScalar(this.mix(4, 5.5, turnProgress));
    }
    this.app.product.setBaseOpacity(revealStage(progress, baseReveal));
    if (progress > zoom.end)
      manager.renderer.toneMappingExposure = this.mix(0.6, 0.36, tiltProgress);
    const lightProgress = this.isMobile
      ? clamp01((progress - mobileLighting.start) / mobileLighting.duration)
      : turnProgress;
    manager.productLight.intensity = this.mix(0, 8, lightProgress);
    ambientLight.intensity = this.mix(4.6, 3.2, lightProgress);
    if (applicator && !this.app.podSelector?.isAnimating) {
      applicator.position.y = this.mix(
        1,
        0,
        (progress - capDescent.start) / capDescent.duration,
      );
      applicator.rotation.y = this.mix(
        0,
        Math.PI * 0.26,
        (progress - capLock.start) / capLock.duration,
      );
    }
  }

  tick(delta) {
    this.rotationBoost *= Math.exp(-delta * (this.isMobile ? 3 : 12));
    if (Math.abs(this.rotationBoost) < 0.001) this.rotationBoost = 0;
    this.app.sceneManager.controls.autoRotateSpeed = 0.4 + this.rotationBoost;
  }
}
