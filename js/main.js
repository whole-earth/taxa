import { App } from "./core/anim.js";
import { performanceMonitor } from "./utils/performance.js";

const menu = document.getElementById("nav-links");
const toggle = document.querySelector(".menu-toggle");
const closeMenu = () => {
  menu.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
};
toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
const dialog = document.getElementById("contact-dialog");
document.querySelectorAll("[data-contact]").forEach((button) =>
  button.addEventListener("click", () => {
    closeMenu();
    dialog.showModal();
  }),
);
document
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

let app;
try {
  app = new App();
  await app.init();
  document.querySelector(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    app.timeline.goTo(0);
  });
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    app.timeline.goTo(3, true);
    document.getElementById("product-title").setAttribute("tabindex", "-1");
    requestAnimationFrame(() =>
      document.getElementById("product-title").focus({ preventScroll: true }),
    );
  });
  if (performanceMonitor.enabled)
    window.taxaDebug = { app, performanceMonitor };
} catch (error) {
  console.error("Unable to initialize the story:", error);
  document.body.classList.add("scene-failed");
  document.getElementById("loadProgressCount").textContent =
    "The 3D story could not load. You can still explore the page.";
  document.getElementById("motion-toggle").hidden = true;
  app?.dispose();
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) app?.dispose();
});
