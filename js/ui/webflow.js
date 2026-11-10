import { installMobileFooter } from "./mobileFooter.js";

// Adapt the animation to Webflow's existing UI. The mobile-footer exception
// restores legal links without changing the story's section heights.
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
    html[data-wf-page="6799d21f9d3e7d527d28c511"].taxa-footer-enabled .taxa-legal-footer {
      justify-content:center;
    }
    @media(max-width:767px) {
      html[data-wf-page="6799d21f9d3e7d527d28c511"].taxa-footer-enabled .taxa-legal-footer {
        display:flex;
      }
      html[data-wf-page="6799d21f9d3e7d527d28c511"].taxa-footer-enabled .main > .product > .child .cell-child_right {
        translate:0 calc(-1 * var(--taxa-footer-clearance, 0px));
      }
    }
  `;
  document.head.append(style);
  let app;
  const footer = installMobileFooter(
    document.querySelector(".main > .product > .child .cell-child_right"),
  );
  const overlays = [
    ...document.querySelectorAll(".contact, .science-password, .nav-body"),
  ];
  const sync = () => {
    if (!app) return;
    const active = overlays.some((element) => {
      if (element.matches(".nav-body") && innerWidth >= 768) return false;
      // Pause throughout CSS fades, including their initial zero-opacity frame.
      // Webflow hides closed overlays with display:none.
      const css = getComputedStyle(element);
      return (
        css.display !== "none" &&
        css.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    });
    if (app.overlayActive === active) return;
    app.overlayActive = active;
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
      footer.refresh();
    },
    connect(value) {
      app = value;
      sync();
    },
    dispose() {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      footer.dispose();
      style.remove();
      app = null;
    },
  };
}
