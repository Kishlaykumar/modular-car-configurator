import registryData from "../data/partRegistry.json";

export const Events = {
  PART_SELECTED: "PART_SELECTED",
  PART_HOVERED: "PART_HOVERED",
  PART_UNHOVERED: "PART_UNHOVERED",
  EXPLODE: "EXPLODE",
  ASSEMBLE: "ASSEMBLE",
  COLOR_CHANGED: "COLOR_CHANGED",
  CAMERA_PRESET: "CAMERA_PRESET",
};

export class ConfiguratorManager {
  constructor() {
    this.activePart = null;
    this.hoveredPart = null;
    this.interactionLocked = false;
    this.registry = null;
    this.activeColor = null;
    this._idMap = new Map();
    this._meshNameMap = new Map();

    this._listeners = {};

    this._loadRegistry(registryData);
  }

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

  _loadRegistry(data) {
    this.registry = data;
    for (const part of data.parts) {
      this._idMap.set(part.id, part);
      this._meshNameMap.set(part.meshName, part);
    }
  }

  getPartByMeshName(nodeName) {
    if (!nodeName) return null;
    const normalized = nodeName.replace(/_/g, " ");
    for (const [meshName, part] of this._meshNameMap) {
      if (normalized.includes(meshName)) return part;
    }
    return null;
  }

  getPartById(id) {
    return this._idMap.get(id) ?? null;
  }

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

  explode() {
    if (this.interactionLocked) return;
    this.emit(Events.EXPLODE);
  }

  assemble() {
    if (this.interactionLocked) return;
    this.emit(Events.ASSEMBLE);
  }

  setColor(hex) {
    this.activeColor = hex;
    this.emit(Events.COLOR_CHANGED, { hex });
  }

  setCameraPreset(name) {
    this.emit(Events.CAMERA_PRESET, { name });
  }
}