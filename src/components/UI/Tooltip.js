import { Events } from "../../core/ConfiguratorManager.js";

export class Tooltip {
  constructor(configurator) {
    this.el = this._createElement();

    this._onMouseMove = this._onMouseMove.bind(this);
    window.addEventListener("mousemove", this._onMouseMove);

    configurator.on(Events.PART_HOVERED, ({ part }) => this._show(part));
    configurator.on(Events.PART_UNHOVERED, () => this._hide());
  }

  _createElement() {
    const el = document.createElement("div");
    el.className = "part-tooltip";
    el.style.display = "none";
    document.body.appendChild(el);
    return el;
  }

  _show(part) {
    if (!part) return;
    this.el.textContent = part.label;
    this.el.style.display = "block";
  }

  _hide() {
    this.el.style.display = "none";
  }

  _onMouseMove(event) {
    if (this.el.style.display === "none") return;
    this.el.style.left = `${event.clientX + 14}px`;
    this.el.style.top = `${event.clientY + 14}px`;
  }

  dispose() {
    window.removeEventListener("mousemove", this._onMouseMove);
    this.el.remove();
  }
}
