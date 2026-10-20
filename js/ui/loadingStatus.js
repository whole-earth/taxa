// Loading UI changes only when its state changes, never on every scroll tick.
export class LoadingStatus {
  constructor() {
    this.element = document.querySelector(".load-progress");
    this.label = document.getElementById("loadProgressCount");
    this.retry = document.getElementById("retry-load");
  }

  show(message, retry = false) {
    if (this.label.textContent !== message) this.label.textContent = message;
    if (this.retry.hidden === retry) this.retry.hidden = !retry;
    if (this.element.hidden) this.element.hidden = false;
  }

  hide() {
    if (!this.element.hidden) this.element.hidden = true;
  }
}
