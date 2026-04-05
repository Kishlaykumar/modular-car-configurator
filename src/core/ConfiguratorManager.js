import registryData from "../data/partRegistry.json";

// ── Event constants ─────────────────────────────────────────
export const Events = {
  PART_SELECTED: "PART_SELECTED",
  PART_HOVERED: "PART_HOVERED",
  PART_UNHOVERED: "PART_UNHOVERED",
};

/**
 * Single source of truth for configurator state.
 * Pure state — no Three.js, no DOM.
 * Uses a simple pub/sub for communication.
 */
export class ConfiguratorManager {
  constructor() {
    // ── State ──
    this.activePart = null;
    this.hoveredPart = null;
    this.interactionLocked = false;
    this.registry = null;

    // ── Lookup maps (built from registry) ──
    this._idMap = new Map();
    this._meshNameMap = new Map();

    // ── Pub/sub ──
    this._listeners = {};

    this._loadRegistry(registryData);
  }

  // ── Event system ──────────────────────────────────────────

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    const list = this._listeners[event];
    if (!list) return;
    this._listeners[event] = list.filter((cb) => cb !== callback);
  }

  emit(event, data) {
    const list = this._listeners[event];
    if (!list) return;
    for (const cb of list) cb(data);
  }

  // ── Registry ──────────────────────────────────────────────

  _loadRegistry(data) {
    this.registry = data;
    for (const part of data.parts) {
      this._idMap.set(part.id, part);
      this._meshNameMap.set(part.meshName, part);
    }
  }

  /**
   * Lookup part config by a node name from the GLB.
   * Uses substring match so "node_Bonnet_-220880_24" matches meshName "Bonnet".
   */
  getPartByMeshName(nodeName) {
    if (!nodeName) return null;
    for (const [meshName, part] of this._meshNameMap) {
      if (nodeName.includes(meshName)) return part;
    }
    return null;
  }

  getPartById(id) {
    return this._idMap.get(id) ?? null;
  }

  // ── State mutations ───────────────────────────────────────

  selectPart(id) {
    if (this.interactionLocked) return;

    const previousPart = this.activePart;
    this.activePart = id ? this._idMap.get(id) ?? null : null;

    this.emit(Events.PART_SELECTED, {
      part: this.activePart,
      previousPart,
    });
  }

  setHoveredPart(id) {
    if (this.interactionLocked) return;

    const prev = this.hoveredPart;
    const next = id ? this._idMap.get(id) ?? null : null;

    if (prev?.id === next?.id) return;

    if (prev) {
      this.hoveredPart = null;
      this.emit(Events.PART_UNHOVERED, { part: prev });
    }
    if (next) {
      this.hoveredPart = next;
      this.emit(Events.PART_HOVERED, { part: next });
    }
  }
}