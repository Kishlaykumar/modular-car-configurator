import * as THREE from "three";
import { Events } from "../core/ConfiguratorManager.js";

export class HighlightSystem {
  constructor(configurator) {
    this.configurator = configurator;

    this._originals = new Map();

    configurator.on(Events.PART_HOVERED, ({ part }) =>
      this._applyHighlight(part)
    );
    configurator.on(Events.PART_UNHOVERED, ({ part }) =>
      this._removeHighlight(part)
    );
    configurator.on(Events.PART_SELECTED, ({ part, previousPart }) => {
      if (previousPart) this._restoreMaterials(previousPart);
      if (part) this._applySelection(part);
    });
  }


  _applyHighlight(part) {
    if (!part?.meshes) return;
    for (const mesh of part.meshes) {
      this._storeOriginal(mesh);
      if (mesh.material.emissive) {
        mesh.material.emissive.set(0x555555);
        mesh.material.emissiveIntensity = 0.5;
      }
    }
  }

  _removeHighlight(part) {
    if (!part?.meshes) return;
    if (this.configurator.activePart?.id === part.id) return;
    this._restoreMaterials(part);
  }

  _applySelection(part) {
    if (!part?.meshes) return;
    for (const mesh of part.meshes) {
      this._storeOriginal(mesh);
      if (mesh.material.emissive) {
        mesh.material.emissive.set(0x666666);
        mesh.material.emissiveIntensity = 0.7;
      }
    }
  }


  _storeOriginal(mesh) {
    if (this._originals.has(mesh.uuid)) return;
    mesh.material = mesh.material.clone();
    this._originals.set(mesh.uuid, {
      emissive: mesh.material.emissive
        ? mesh.material.emissive.clone()
        : new THREE.Color(0x000000),
      emissiveIntensity: mesh.material.emissiveIntensity ?? 0,
    });
  }

  _restoreMaterials(part) {
    if (!part?.meshes) return;
    for (const mesh of part.meshes) {
      const orig = this._originals.get(mesh.uuid);
      if (orig && mesh.material.emissive) {
        mesh.material.emissive.copy(orig.emissive);
        mesh.material.emissiveIntensity = orig.emissiveIntensity;
      }
    }
  }
}
