import { App } from "./core/anim.js";
import { PageUI } from "./ui/page.js";
import { performanceMonitor } from "./utils/performance.js";

const page = new PageUI();
let app;
try {
  app = new App();
  page.connect(app);
  await app.init();
  if (performanceMonitor.enabled)
    window.taxaDebug = { app, performanceMonitor };
} catch (error) {
  console.error("Unable to initialize the story:", error);
  document.body.classList.add("scene-failed");
  document.getElementById("loadProgressCount").textContent =
    "The 3D story could not load. You can still explore the page.";
  document.getElementById("motion-toggle").hidden = true;
  app?.dispose();
  page.connect(null);
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    page.dispose();
    app?.dispose();
  }
});
