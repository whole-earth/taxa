import * as THREE from "three";
import { Tween, Easing } from "tween";

import { POD_COLORS, POD_LABELS } from "../core/productConfig.js";

export class PodSelector {
  constructor(app) {
    this.app = app;
    this.currentPod = "orange";
    this.isAnimating = false;
    this.buttons = [...document.querySelectorAll(".pod-indicator")];
    this.labels = [
      "productType",
      "productTypeSubtitle",
      "waitlistLabel",
      "showingLabel",
    ].map((id) => document.getElementById(id));
    this.buttons.forEach((button) =>
      button.addEventListener(
        "click",
        () => this.select(button.id.slice(3).toLowerCase()),
        { signal: app.events.signal },
      ),
    );
  }

  select(podId) {
    const applicator = this.app.product?.applicator;
    if (this.isAnimating || podId === this.currentPod || !applicator) return;
    this.isAnimating = true;
    this.app.scroller.stop();
    this.buttons.forEach((button) => {
      button.disabled = true;
    });
    const selectedButton = document.getElementById(
      `pod${podId[0].toUpperCase()}${podId.slice(1)}`,
    );
    selectedButton.classList.add("progress-loading");
    const initialY = applicator.position.y;
    const initialRotation = applicator.rotation.y;
    const materials = new Set();
    this.app.product.root.getObjectByName("inner-cap")?.traverse((node) => {
      if (node.material) materials.add(node.material);
    });
    const first = [...materials][0];
    const currentColor =
      first?.color.clone() ?? new THREE.Color(POD_COLORS[this.currentPod]);
    const targetColor = new THREE.Color(POD_COLORS[podId]);
    const duration = this.app.reducedMotion ? 0 : 500;
    const tween = (target, values, time = duration) =>
      new Tween(target, this.app.tweens)
        .to(values, time)
        .easing(Easing.Cubic.InOut);
    const rotateOut = tween(applicator.rotation, { y: -Math.PI * 0.26 });
    const raise = tween(applicator.position, { y: initialY + 1 });
    const recolor = tween(
      currentColor,
      { r: targetColor.r, g: targetColor.g, b: targetColor.b },
      this.app.reducedMotion ? 0 : 700,
    )
      .onStart(() => this.updateLabels(podId))
      .onUpdate(() =>
        materials.forEach((material) => {
          material.color.copy(currentColor);
          material.emissive?.copy(currentColor);
        }),
      );
    const lower = tween(applicator.position, { y: initialY });
    const rotateBack = tween(applicator.rotation, {
      y: initialRotation,
    }).onComplete(() => {
      this.currentPod = podId;
      this.isAnimating = false;
      selectedButton.classList.remove("progress-loading");
      this.buttons.forEach((button) => {
        button.disabled = false;
        button.classList.toggle("current", button === selectedButton);
        button.setAttribute("aria-pressed", String(button === selectedButton));
      });
      this.app.scroller.start();
      this.app.invalidate(true);
    });
    rotateOut.chain(raise);
    raise.chain(recolor);
    recolor.chain(lower);
    lower.chain(rotateBack);
    rotateOut.start();
    this.app.invalidate();
  }

  updateLabels(podId) {
    const [type, label] = POD_LABELS[podId];
    this.labels.forEach((element) => {
      element.textContent = element.id === "showingLabel" ? label : type;
      if (!this.app.reducedMotion)
        element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    });
    const link = document.getElementById("waitlist-link");
    link.classList.remove("orange", "green", "yellow");
    link.classList.add(podId);
  }
}
