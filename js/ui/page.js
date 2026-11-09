// Page controls stay usable while the 3D assets load, and in the fallback view.
export class PageUI {
  constructor() {
    this.events = new AbortController();
    const signal = this.events.signal;
    document.getElementById("motion-toggle").addEventListener(
      "click",
      (event) => {
        if (!this.app) return;
        this.app.motionPaused = !this.app.motionPaused;
        event.currentTarget.textContent = this.app.motionPaused
          ? "Resume motion"
          : "Pause motion";
        event.currentTarget.setAttribute(
          "aria-pressed",
          String(this.app.motionPaused),
        );
        this.app.invalidate();
      },
      { signal },
    );
    this.menu = document.getElementById("nav-links");
    this.toggle = document.querySelector(".menu-toggle");
    this.dialog = document.getElementById("contact-dialog");
    this.toggle.addEventListener(
      "click",
      () => this.setMenu(!this.menu.classList.contains("open")),
      { signal },
    );
    document.querySelectorAll("[data-contact]").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          this.contactTrigger = button;
          this.setMenu(false);
          this.dialog.showModal();
          this.syncOverlay();
        },
        { signal },
      );
    });
    document
      .querySelector(".dialog-close")
      .addEventListener("click", () => this.dialog.close(), { signal });
    this.dialog.addEventListener(
      "click",
      (event) => {
        // Only an actual backdrop click closes the dialog, not its padding.
        if (event.target !== this.dialog) return;
        const box = this.dialog.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          this.dialog.close();
      },
      { signal },
    );
    this.dialog.addEventListener(
      "close",
      () => {
        this.syncOverlay();
        // Safari does not focus buttons on pointer click, so native dialog
        // restoration can return focus to the body instead of the opener.
        const trigger = this.contactTrigger?.getClientRects().length
          ? this.contactTrigger
          : this.toggle;
        trigger.focus({ preventScroll: true });
      },
      { signal },
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && this.menu.classList.contains("open")) {
          this.setMenu(false);
          this.toggle.focus();
        }
      },
      { signal },
    );
    document.addEventListener(
      "click",
      (event) => {
        if (
          this.menu.classList.contains("open") &&
          !event.target.closest(".nav")
        )
          this.setMenu(false);
      },
      { signal },
    );
    this.menu.addEventListener(
      "click",
      (event) => {
        if (event.target.closest("a")) this.setMenu(false);
      },
      { signal },
    );
    matchMedia("(min-width: 768px)").addEventListener(
      "change",
      (event) => {
        if (event.matches) this.setMenu(false);
      },
      { signal },
    );
    document.querySelector(".brand").addEventListener(
      "click",
      (event) => {
        this.setMenu(false);
        if (!this.app?.isInitialized) return;
        event.preventDefault();
        this.app.timeline.goTo(0);
      },
      { signal },
    );
    document.querySelector(".skip-link").addEventListener(
      "click",
      (event) => {
        if (!this.app?.isInitialized) return;
        event.preventDefault();
        this.app.timeline.goTo(3, true);
        const title = document.getElementById("product-title");
        title.setAttribute("tabindex", "-1");
        requestAnimationFrame(() => title.focus({ preventScroll: true }));
      },
      { signal },
    );
  }

  reveal() {
    document.body.classList.add("scene-ready");
  }

  connect(app) {
    this.app = app;
    this.syncOverlay();
  }

  setMenu(open) {
    this.menu.classList.toggle("open", open);
    this.toggle.setAttribute("aria-expanded", String(open));
    this.toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    this.syncOverlay();
  }

  syncOverlay() {
    if (!this.app) return;
    this.app.overlayActive =
      this.dialog.open || this.menu.classList.contains("open");
    this.app.lastActivity = performance.now();
    this.app.invalidate();
  }

  dispose() {
    this.events.abort();
    this.app = null;
  }
}
