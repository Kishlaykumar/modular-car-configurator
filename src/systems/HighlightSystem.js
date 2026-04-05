import * as THREE from "three";
import gsap from "gsap";
import { Events } from "../core/ConfiguratorManager.js";

export class HighlightSystem {
  constructor(configurator) {
    this.configurator = configurator;

    this._originals = new Map();
    this._tweens = new Map();

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

    configurator.on(Events.COLOR_CHANGED, () => {
      this._refreshStoredOriginals();
    });
  }

  _applyHighlight(part) {
    if (!part?.meshes) return;
    for (const mesh of part.meshes) {
      this._storeOriginal(mesh);
      this._tweenEmissive(mesh, 0x333333, 0.4);
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
      this._tweenEmissive(mesh, 0x444444, 0.5);
    }
  }

  _tweenEmissive(mesh, colorHex, intensity) {
    if (!mesh.material.emissive) return;

    const key = mesh.uuid;
    const prev = this._tweens.get(key);
    if (prev) prev.kill();

    const target = new THREE.Color(colorHex);
    const proxy = {
      r: mesh.material.emissive.r,
      g: mesh.material.emissive.g,
      b: mesh.material.emissive.b,
      i: mesh.material.emissiveIntensity,
    };

    const tw = gsap.to(proxy, {
      r: target.r,
      g: target.g,
      b: target.b,
      i: intensity,
      duration: 0.25,
      ease: "power2.out",
      onUpdate: () => {
        mesh.material.emissive.setRGB(proxy.r, proxy.g, proxy.b);
        mesh.material.emissiveIntensity = proxy.i;
      },
      onComplete: () => this._tweens.delete(key),
    });
    this._tweens.set(key, tw);
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
        this._tweenEmissive(mesh, orig.emissive.getHex(), orig.emissiveIntensity);
      }
    }
  }

  _refreshStoredOriginals() {
    for (const [uuid, orig] of this._originals) {
      const tw = this._tweens.get(uuid);
      if (tw) {
        tw.kill();
        this._tweens.delete(uuid);
      }
      let mesh = null;
      for (const part of this.configurator.registry.parts) {
        if (!part.meshes) continue;
        mesh = part.meshes.find((m) => m.uuid === uuid);
        if (mesh) break;
      }
      if (!mesh) continue;
      orig.emissive = mesh.material.emissive
        ? mesh.material.emissive.clone()
        : new THREE.Color(0x000000);
      orig.emissiveIntensity = mesh.material.emissiveIntensity ?? 0;
      if (mesh.material.emissive) {
        mesh.material.emissive.copy(orig.emissive);
        mesh.material.emissiveIntensity = orig.emissiveIntensity;
      }
    }
  }
}
