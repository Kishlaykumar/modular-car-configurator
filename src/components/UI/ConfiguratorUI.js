import { Events } from "../../core/ConfiguratorManager.js";

const PRESET_COLORS = [
  { hex: "#cc0000", label: "Racing Red" },
  { hex: "#1a1a1a", label: "Midnight Black" },
  { hex: "#2e7d32", label: "British Green" },
  { hex: "#ff8f00", label: "Sunset Orange" },
  { hex: "#4a148c", label: "Royal Purple" },
  { hex: "#607d8b", label: "Gunmetal Grey" },
];

const CAMERA_PRESETS = [
  { name: "front", icon: "↑", label: "Front" },
  { name: "rear", icon: "↓", label: "Rear" },
  { name: "side", icon: "→", label: "Side" },
  { name: "top", icon: "⬆", label: "Top" },
];

export class ConfiguratorUI {
  constructor(configurator) {
    this.configurator = configurator;
    this._activeColorEl = null;
    this._isExploded = false;

    this.el = this._build();
    document.body.appendChild(this.el);

    this._loader = this._buildLoader();
    document.body.appendChild(this._loader);

    configurator.on(Events.EXPLODE, () => {
      this._isExploded = true;
      this._updateToggleBtn();
    });
    configurator.on(Events.ASSEMBLE, () => {
      this._isExploded = false;
      this._updateToggleBtn();
    });
  }

  _buildLoader() {
    const overlay = document.createElement("div");
    overlay.className = "cfg-loader";
    overlay.innerHTML = `
      <div class="cfg-loader__content">
        <div class="cfg-loader__spinner"></div>
        <p class="cfg-loader__text">Loading model…</p>
        <div class="cfg-loader__bar"><div class="cfg-loader__fill"></div></div>
      </div>`;
    return overlay;
  }

  onLoadProgress(event) {
    if (!event.total) return;
    const pct = Math.round((event.loaded / event.total) * 100);
    const fill = this._loader.querySelector(".cfg-loader__fill");
    const text = this._loader.querySelector(".cfg-loader__text");
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `Loading model… ${pct}%`;
  }

  onLoadComplete() {
    this._loader.classList.add("cfg-loader--done");
    setTimeout(() => this._loader.remove(), 600);
    this.el.classList.add("cfg-panel--visible");
  }

  _build() {
    const panel = document.createElement("aside");
    panel.className = "cfg-panel";

    panel.innerHTML = `
      <div class="cfg-section">
        <h3 class="cfg-heading">Color</h3>
        <div class="cfg-swatches" data-ref="swatches"></div>
        <div class="cfg-custom-color">
          <label class="cfg-label" for="cfg-hex">Custom</label>
          <input id="cfg-hex" class="cfg-hex-input" type="text"
                 maxlength="7" placeholder="#RRGGBB" spellcheck="false" />
          <button class="cfg-btn cfg-btn--small" data-action="applyHex">Apply</button>
        </div>
      </div>

      <div class="cfg-section">
        <h3 class="cfg-heading">View</h3>
        <div class="cfg-camera-row" data-ref="cameras"></div>
      </div>

      <div class="cfg-section">
        <h3 class="cfg-heading">Model</h3>
        <button class="cfg-btn cfg-btn--wide" data-action="toggleExplode">
          Explode
        </button>
      </div>
    `;

    this._populateSwatches(panel.querySelector('[data-ref="swatches"]'));
    this._populateCameras(panel.querySelector('[data-ref="cameras"]'));
    this._bindActions(panel);

    return panel;
  }

  _populateSwatches(container) {
    for (const { hex, label } of PRESET_COLORS) {
      const btn = document.createElement("button");
      btn.className = "cfg-swatch";
      btn.style.setProperty("--swatch-color", hex);
      btn.title = label;
      btn.dataset.hex = hex;
      btn.addEventListener("click", () => this._selectColor(hex, btn));
      container.appendChild(btn);
    }
  }

  _populateCameras(container) {
    for (const { name, icon, label } of CAMERA_PRESETS) {
      const btn = document.createElement("button");
      btn.className = "cfg-btn cfg-btn--cam";
      btn.textContent = icon;
      btn.title = label;
      btn.addEventListener("click", () => this.configurator.setCameraPreset(name));
      container.appendChild(btn);
    }
  }

  _bindActions(panel) {
    this._toggleBtn = panel.querySelector('[data-action="toggleExplode"]');
    this._toggleBtn.addEventListener("click", () => {
      if (this._isExploded) {
        this.configurator.assemble();
      } else {
        this.configurator.explode();
      }
    });

    const hexInput = panel.querySelector("#cfg-hex");
    const applyBtn = panel.querySelector('[data-action="applyHex"]');

    const applyCustom = () => {
      const raw = hexInput.value.trim();
      const hex = raw.startsWith("#") ? raw : `#${raw}`;
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        this.configurator.setColor(hex);
        this._clearActiveColor();
      }
    };

    applyBtn.addEventListener("click", applyCustom);
    hexInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyCustom();
    });
  }

  _selectColor(hex, el) {
    this._clearActiveColor();
    el.classList.add("cfg-swatch--active");
    this._activeColorEl = el;
    this.configurator.setColor(hex);
  }

  _clearActiveColor() {
    if (this._activeColorEl) {
      this._activeColorEl.classList.remove("cfg-swatch--active");
      this._activeColorEl = null;
    }
  }

  _updateToggleBtn() {
    if (this._toggleBtn) {
      this._toggleBtn.textContent = this._isExploded ? "Assemble" : "Explode";
    }
  }
}
