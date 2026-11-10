// Keep the card and footer stationary on mobile; only the footer opacity follows
// the extra scroll after the story. Layout is measured only when sizes change.
export function installMobileFooter(productCard) {
  const footer = document.querySelector(".taxa-legal-footer");
  if (!footer || !productCard) return { refresh() {}, dispose() {} };
  const wasInert = footer.inert;
  const space = document.createElement("div");
  space.className = "taxa-footer-space";
  space.setAttribute("aria-hidden", "true");
  footer.before(space);
  const style = document.createElement("style");
  style.textContent = `
    .taxa-footer-space { display:none; }
    @media(max-width:767px) {
      .taxa-footer-space { display:block; height:var(--taxa-footer-space, 0px); }
      html.taxa-footer-enabled body .taxa-legal-footer {
        position:fixed; left:0; right:0; bottom:0; margin:0;
        padding-block:max(16px, env(safe-area-inset-bottom, 0px));
        opacity:var(--taxa-footer-opacity, 0);
      }
    }
  `;
  document.head.append(style);
  document.documentElement.classList.add("taxa-footer-enabled");
  let clearance = 0;
  let frame = null;
  let fadeStart = 0;
  let fadeDistance = 1;
  let opacity = -1;
  const sync = () => {
    const next =
      innerWidth < 768
        ? Math.max(0, Math.min(1, (scrollY - fadeStart) / fadeDistance))
        : 1;
    if (next === opacity) return;
    opacity = next;
    footer.style.setProperty("--taxa-footer-opacity", `${opacity}`);
    footer.inert = wasInert || opacity === 0;
  };
  const refresh = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const height = footer.getBoundingClientRect().height;
      const next =
        innerWidth < 768
          ? productCard.getBoundingClientRect().bottom +
            clearance +
            height -
            innerHeight
          : 0;
      if (next !== clearance) {
        clearance = next;
        productCard.style.setProperty(
          "--taxa-footer-clearance",
          `${clearance}px`,
        );
      }
      space.style.setProperty("--taxa-footer-space", `${height + 24}px`);
      fadeStart = Math.round(
        space.getBoundingClientRect().top + scrollY - innerHeight,
      );
      fadeDistance = Math.max(
        1,
        document.documentElement.scrollHeight - innerHeight - fadeStart,
      );
      sync();
    });
  };
  const observer = new ResizeObserver(refresh);
  observer.observe(productCard);
  observer.observe(footer);
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("scroll", sync, { passive: true });
  footer.inert = wasInert || innerWidth < 768;
  refresh();
  return {
    refresh,
    dispose() {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", sync);
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("taxa-footer-enabled");
      productCard.style.removeProperty("--taxa-footer-clearance");
      footer.style.removeProperty("--taxa-footer-opacity");
      footer.inert = wasInert;
      space.remove();
      style.remove();
    },
  };
}
