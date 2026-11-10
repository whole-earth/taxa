import { StoryApp } from "./core/app.js";
import { PageUI } from "./ui/page.js";
import { performanceMonitor } from "./utils/performance.js";

const page = new PageUI();
let app;
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    page.dispose();
    app?.dispose();
  }
});

try {
  app = new StoryApp({ onFirstFrame: () => page.reveal() });
  page.connect(app);
  if (performanceMonitor.enabled)
    window.taxaDebug = { app, performanceMonitor };
  await app.init();
} catch (error) {
  console.error("Unable to initialize the story:", error);
  document.body.classList.add("scene-failed");
  document.getElementById("loadProgressCount").textContent =
    "The 3D story could not load. You can still explore the page.";
  app?.dispose();
  page.connect(null);
}
