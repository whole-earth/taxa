// Webflow entry point. Bundle to js/core/anim.js and host with ../../assets/.
// Webflow keeps ownership of its styles, navigation, forms and section heights.
import { StoryApp } from "./app.js";
import { performanceMonitor } from "../utils/performance.js";
import { installWebflowUI } from "../ui/webflow.js";

if (document.readyState === "loading") {
  await new Promise((resolve) =>
    document.addEventListener("DOMContentLoaded", resolve, { once: true }),
  );
}

const ui = installWebflowUI();
let app;
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    ui.dispose();
    app?.dispose();
  }
});
try {
  app = new StoryApp({
    webflow: true,
    onFirstFrame: () => ui.reveal(),
    assetBase: new URL("../../assets/", import.meta.url),
  });
  ui.connect(app);
  if (performanceMonitor.enabled)
    window.taxaDebug = { app, performanceMonitor };
  await app.init();
} catch (error) {
  console.error("Unable to initialize the story:", error);
  document.body.classList.remove("loading");
  app?.loadingStatus.show(
    "The 3D story could not load. Please reload to try again.",
  );
  app?.dispose();
  ui.dispose();
}
