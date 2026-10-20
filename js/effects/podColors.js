import * as THREE from "three";
import { Tween, Easing } from "tween";
import { state } from "../core/state.js";

export const PRODUCT_COLORS = {
  orange: "#bf541e",
  green: "#00a86b",
  yellow: "#ffd700",
};
const TYPES = {
  orange: ["deodorant", "Body odor"],
  yellow: ["sunscreen", "Sunscreen"],
  green: ["anti-attractant", "Mosquito"],
};

export class ColorChangeAnimationSequence {
  constructor(app) {
    this.app = app;
    this.current = "orange";
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
        () => this.start(button.id.slice(3).toLowerCase()),
        { signal: app.events.signal },
      ),
    );
  }

  start(color) {
    if (
      this.isAnimating ||
      color === this.current ||
      !state.applicatorObject ||
      !this.app.product
    )
      return;
    this.isAnimating = true;
    state.lenis.stop();
    this.buttons.forEach((button) => {
      button.disabled = true;
    });
    const selected = document.getElementById(
      `pod${color[0].toUpperCase()}${color.slice(1)}`,
    );
    selected.classList.add("progress-loading");
    const applicator = state.applicatorObject;
    const initialY = applicator.position.y;
    const initialRotation = applicator.rotation.y;
    const materials = new Set();
    this.app.product
      .getObject()
      .getObjectByName("inner-cap")
      ?.traverse((node) => {
        if (node.material) materials.add(node.material);
      });
    const first = [...materials][0];
    const currentColor =
      first?.color.clone() ?? new THREE.Color(PRODUCT_COLORS[this.current]);
    const targetColor = new THREE.Color(PRODUCT_COLORS[color]);
    const duration = this.app.reducedMotion ? 0 : 500;
    const tween = (target, values, time = duration) =>
      new Tween(target, state.tweens)
        .to(values, time)
        .easing(Easing.Cubic.InOut);
    const down = tween(applicator.rotation, { y: -Math.PI * 0.26 });
    const up = tween(applicator.position, { y: initialY + 1 });
    const recolor = tween(
      currentColor,
      { r: targetColor.r, g: targetColor.g, b: targetColor.b },
      this.app.reducedMotion ? 0 : 700,
    )
      .onStart(() => this.updateLabels(color))
      .onUpdate(() =>
        materials.forEach((material) => {
          material.color.copy(currentColor);
          material.emissive?.copy(currentColor);
        }),
      );
    const lower = tween(applicator.position, { y: initialY });
    const rotate = tween(applicator.rotation, {
      y: initialRotation,
    }).onComplete(() => {
      this.current = color;
      this.isAnimating = false;
      selected.classList.remove("progress-loading");
      this.buttons.forEach((button) => {
        button.disabled = false;
        button.classList.toggle("current", button === selected);
        button.setAttribute("aria-pressed", String(button === selected));
      });
      state.lenis.start();
      this.app.invalidate(true);
    });
    down.chain(up);
    up.chain(recolor);
    recolor.chain(lower);
    lower.chain(rotate);
    down.start();
    this.app.invalidate();
  }

  updateLabels(color) {
    const [type, label] = TYPES[color];
    this.labels.forEach((element) => {
      element.textContent = element.id === "showingLabel" ? label : type;
      if (!this.app.reducedMotion)
        element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    });
    const link = document.getElementById("waitlist-link");
    link.classList.remove("orange", "green", "yellow");
    link.classList.add(color);
  }
}
