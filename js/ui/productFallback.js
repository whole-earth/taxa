// A late-loading product never leaves an empty scene. Images are requested
// only if the reader reaches the final product view before the model is ready.
export class ProductFallback {
  constructor(app) {
    this.app = app;
    this.images = new Map();
    this.element = document.createElement("div");
    this.element.className = "product-fallback";
    this.element.setAttribute("aria-hidden", "true");
    document.getElementById("three").append(this.element);
  }

  update(waiting, progress, mobile) {
    this.wanted = waiting && progress > 0.95;
    if (!this.wanted) return;
    const variant = mobile ? "mobile" : "desktop";
    let entry = this.images.get(variant);
    if (!entry) {
      const image = new Image();
      image.alt = "";
      image.decoding = "async";
      entry = { image, ready: false };
      this.images.set(variant, entry);
      image.src = `assets/site/product-preview-${variant}.webp`;
      image
        .decode()
        .then(() => {
          if (this.app.disposed) return;
          entry.ready = true;
          this.app.invalidate(true);
        })
        .catch(() => {
          // Keep the cell visible if this optional preview also fails to load.
        });
    }
    this.ready = entry.ready;
    if (entry.ready && this.image !== entry.image) {
      this.image = entry.image;
      this.element.replaceChildren(entry.image);
    }
  }

  onFrame() {
    // Fade only after the real scene has drawn its current scroll pose.
    const visible = this.wanted && this.ready;
    if (visible === this.visible) return;
    this.visible = visible;
    this.element.classList.toggle("visible", !!visible);
  }

  dispose() {
    this.element.remove();
    for (const { image } of this.images.values()) image.removeAttribute("src");
    this.images.clear();
  }
}
