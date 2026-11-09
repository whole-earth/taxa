// Only style UI supplied by the animation. Existing Webflow elements retain
// their production styles, classes and event handlers.
export function installWebflowUI() {
  const style = document.createElement("style");
  style.textContent = `
    #three > .product-fallback { position:absolute; inset:0; overflow:hidden;
      background:#fffbf4; opacity:0; transition:opacity 200ms ease-out; pointer-events:none; }
    #three > .product-fallback.visible { opacity:1; }
    #three > .product-fallback img { position:absolute; top:0; left:50%; height:100%;
      width:auto; max-width:none; transform:translateX(-50%); }
    @media(prefers-reduced-motion:reduce) {
      #three > .product-fallback { transition:none; }
    }
  `;
  document.head.append(style);
  let app;
  const overlays = [
    ...document.querySelectorAll(".contact, .science-password, .nav-body"),
  ];
  const sync = () => {
    if (!app) return;
    app.overlayActive = overlays.some((element) => {
      if (element.matches(".nav-body") && innerWidth >= 768) return false;
      const css = getComputedStyle(element);
      return (
        css.display !== "none" &&
        css.visibility !== "hidden" &&
        Number(css.opacity) > 0 &&
        element.getClientRects().length > 0
      );
    });
    app.lastActivity = performance.now();
    app.invalidate();
  };
  const observer = new MutationObserver(sync);
  for (const element of overlays)
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  window.addEventListener("resize", sync);
  return {
    reveal() {
      document.body.classList.add("scene-ready", "completing");
      document.body.classList.remove("loading");
    },
    connect(value) {
      app = value;
      sync();
    },
    dispose() {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      style.remove();
      app = null;
    },
  };
}
