// Production's inactivity treatment, shared by the demo and Webflow entry.
export class InactivityOverlay {
  constructor(onResume, signal) {
    this.style = document.createElement("style");
    this.style.textContent = `
      .inactivity-overlay {
        position:fixed; inset:0; z-index:1000000;
        background:rgba(255,251,244,0); opacity:0; pointer-events:none;
        -webkit-backdrop-filter:blur(0px); backdrop-filter:blur(0px);
        transition:opacity 500ms ease-out, backdrop-filter 500ms ease-out,
          -webkit-backdrop-filter 500ms ease-out, background-color 500ms ease-out;
      }
      .inactivity-overlay.active {
        background:rgba(255,251,244,.3); opacity:1; pointer-events:auto;
        -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px);
      }
      .inactivity-play-button {
        position:absolute; left:50%; top:50%; width:80px; height:80px;
        padding:0; border:0; background:transparent; cursor:pointer;
        transform:translate(-50%,-50%) scale(.8); opacity:0;
        filter:drop-shadow(0 0 60px #fffbf4) drop-shadow(0 0 16px #fffbf4);
        transition:opacity 400ms ease-out 100ms, transform 400ms ease-out 100ms;
      }
      .inactivity-play-button svg { display:block; width:100%; height:100%; }
      .inactivity-play-button:focus-visible { outline:2px solid #849ed0; outline-offset:8px; }
      .inactivity-overlay.active .inactivity-play-button {
        opacity:1; transform:translate(-50%,-50%) scale(1);
      }
      @media(max-width:768px) {
        .inactivity-play-button { width:50px; height:50px; }
      }
      @media(prefers-reduced-motion:reduce) {
        .inactivity-overlay, .inactivity-play-button { transition:none; }
      }
    `;
    this.element = document.createElement("div");
    this.element.className = "inactivity-overlay";
    this.element.inert = true;
    this.element.setAttribute("aria-hidden", "true");
    this.element.innerHTML = `<button class="inactivity-play-button" type="button" aria-label="Resume animation">
      <svg viewBox="0 0 330 330" aria-hidden="true"><path fill="#849ed0" d="M37.728 328.12c2.266 1.256 4.77 1.88 7.272 1.88 2.763 0 5.522-.763 7.95-2.28l240-149.999c4.386-2.741 7.05-7.548 7.05-12.72s-2.664-9.979-7.05-12.72L52.95 2.28c-4.625-2.891-10.453-3.043-15.222-.4C32.959 4.524 30 9.547 30 15v300c0 5.453 2.959 10.476 7.728 13.12z"/></svg>
    </button>`;
    this.element.addEventListener("click", onResume, { signal });
    document.head.append(this.style);
    document.body.append(this.element);
    this.visible = false;
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    this.element.classList.toggle("active", visible);
    this.element.inert = !visible;
    this.element.setAttribute("aria-hidden", String(!visible));
  }

  dispose() {
    this.element.remove();
    this.style.remove();
  }
}
