import * as THREE from "three";
import { Events } from "../core/ConfiguratorManager.js";

/**
 * Applies color changes to the car body shell.
 */
const TARGET_PARTS = ["chassis", "bonnet", "door_left", "door_right"];
const SKIP_MATERIALS = /glass|mirror/i;

export class MaterialSystem {
  constructor(configurator) {
    this.configurator = configurator;
    this._bodyMeshes = [];
    this._originals = new Map();

    configurator.on(Events.COLOR_CHANGED, ({ hex }) => {
      this._applyColor(hex);
    });
  }

  init(model) {
    for (const id of TARGET_PARTS) {
      const part = this.configurator.getPartById(id);
      if (!part?.meshes?.length) continue;

      for (const mesh of part.meshes) {
        if (SKIP_MATERIALS.test(mesh.material?.name)) continue;

        mesh.material = mesh.material.clone();
        this._bodyMeshes.push(mesh);

        this._originals.set(mesh.uuid, {
          color: mesh.material.color.clone(),
          map: mesh.material.map,
          emissiveMap: mesh.material.emissiveMap,
          emissive: mesh.material.emissive.clone(),
          emissiveIntensity: mesh.material.emissiveIntensity,
        });
      }
    }

    console.log(`[MaterialSystem] Found ${this._bodyMeshes.length} body meshes`);
  }

  _applyColor(hex) {
    const color = new THREE.Color(hex);
    for (const mesh of this._bodyMeshes) {
      mesh.material.map = null;
      mesh.material.emissiveMap = null;
      mesh.material.emissive.set(0x000000);
      mesh.material.emissiveIntensity = 0;
      mesh.material.color.copy(color);
      mesh.material.needsUpdate = true;
    }
  }

  resetColor() {
    for (const mesh of this._bodyMeshes) {
      const orig = this._originals.get(mesh.uuid);
      if (!orig) continue;
      mesh.material.map = orig.map;
      mesh.material.emissiveMap = orig.emissiveMap;
      mesh.material.emissive.copy(orig.emissive);
      mesh.material.emissiveIntensity = orig.emissiveIntensity;
      mesh.material.color.copy(orig.color);
      mesh.material.needsUpdate = true;
    }
  }
}
