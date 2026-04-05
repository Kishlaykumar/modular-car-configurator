import { Events } from "../../core/ConfiguratorManager.js";
import logoSvg from "../../assets/logo.svg";

const PRESET_COLORS = [
  { hex: "#cc0000", label: "Racing Red" },
  { hex: "#1a1a1a", label: "Midnight Black" },
  { hex: "#2e7d32", label: "British Green" },
  { hex: "#ff8f00", label: "Sunset Orange" },
  { hex: "#4a148c", label: "Royal Purple" },
  { hex: "#607d8b", label: "Gunmetal Grey" },
];

const CAMERA_PRESETS = [
  { name: "front", label: "Front" },
  { name: "rear", label: "Rear" },
  { name: "right", label: "Right" },
  { name: "left", label: "Left" },
  { name: "top", label: "Top" },
];

export class ConfiguratorUI {
  constructor(configurator) {
    this.configurator = configurator;
    this._activeColorEl = null;
    this._isExploded = false;
    this._header = this._buildHeader();
    this._colorPanel = this._buildColorPanel();
    this._explodeWrap = this._buildExplodeBtn();
    this._loader = this._buildLoader();

    document.body.append(this._header, this._colorPanel, this._explodeWrap, this._loader);

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
    if (text) text.textContent = `Loading… ${pct}%`;
  }

  onLoadComplete() {
    this._loader.classList.add("cfg-loader--done");
    setTimeout(() => this._loader.remove(), 600);

    this._header.classList.add("cfg-header--visible");
    this._colorPanel.classList.add("cfg-colors--visible");
    this._explodeWrap.classList.add("cfg-explode--visible");
  }

  _buildHeader() {
    const header = document.createElement("header");
    header.className = "cfg-header glass";

    const logo = document.createElement("div");
    logo.className = "cfg-logo";
    const logoImg = document.createElement("img");
    logoImg.src = logoSvg;
    logoImg.alt = "CTRuh";
    logoImg.className = "cfg-logo-svg";
    logo.appendChild(logoImg);

    const nav = document.createElement("nav");
    nav.className = "cfg-nav";

    for (const { name, label } of CAMERA_PRESETS) {
      const btn = document.createElement("button");
      btn.className = "cfg-nav-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => this.configurator.setCameraPreset(name));
      nav.appendChild(btn);
    }

    header.append(logo, nav);
    return header;
  }

  _buildColorPanel() {
    const panel = document.createElement("div");
    panel.className = "cfg-colors glass";

    const title = document.createElement("div");
    title.className = "cfg-colors__title";
    title.textContent = "Color";

    const swatches = document.createElement("div");
    swatches.className = "cfg-swatches";

    for (const { hex, label } of PRESET_COLORS) {
      const btn = document.createElement("button");
      btn.className = "cfg-swatch";
      btn.style.setProperty("--swatch-color", hex);
      btn.title = label;
      btn.addEventListener("click", () => this._selectColor(hex, btn));
      swatches.appendChild(btn);
    }

    const hexRow = document.createElement("div");
    hexRow.className = "cfg-hex-row";

    const hexInput = document.createElement("input");
    hexInput.className = "cfg-hex-input";
    hexInput.type = "text";
    hexInput.maxLength = 7;
    hexInput.placeholder = "#RRGGBB";
    hexInput.spellcheck = false;

    const applyBtn = document.createElement("button");
    applyBtn.className = "cfg-hex-apply";
    applyBtn.textContent = "Apply";

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

    hexRow.append(hexInput, applyBtn);
    panel.append(title, swatches, hexRow);
    return panel;
  }

  _buildExplodeBtn() {
    const wrap = document.createElement("div");
    wrap.className = "cfg-explode";

    this._toggleBtn = document.createElement("button");
    this._toggleBtn.className = "cfg-explode__btn";
    this._toggleBtn.innerHTML = `Explode <span class="arrow">→</span>`;
    this._toggleBtn.addEventListener("click", () => {
      if (this._isExploded) {
        this.configurator.assemble();
      } else {
        this.configurator.explode();
      }
    });

    wrap.appendChild(this._toggleBtn);
    return wrap;
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
      this._toggleBtn.innerHTML = this._isExploded
        ? `Assemble <span class="arrow">←</span>`
        : `Explode <span class="arrow">→</span>`;
    }
  }
}
