// Loading UI changes only when its state changes, never on every scroll tick.
export class LoadingStatus {
  constructor() {
    this.element = document.querySelector(".load-progress");
    this.label = document.getElementById("loadProgressCount");
    this.retry = document.getElementById("retry-load");
    if (!this.retry) {
      this.retry = document.createElement("button");
      this.retry.id = "retry-load";
      this.retry.textContent = "Try again";
      this.retry.hidden = true;
      this.element.append(this.retry);
    }
  }

  show(message, retry = false) {
    if (this.label.textContent !== message) this.label.textContent = message;
    if (this.retry.hidden === retry) this.retry.hidden = !retry;
    if (this.element.hidden) this.element.hidden = false;
    if (this.element.style.display === "none")
      this.element.style.removeProperty("display");
  }

  hide() {
    if (!this.element.hidden) this.element.hidden = true;
    if (this.element.style.display !== "none")
      this.element.style.display = "none";
  }
}
