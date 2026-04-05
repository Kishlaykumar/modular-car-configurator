import * as THREE from "three";
import { Events } from "../core/ConfiguratorManager.js";

const TARGET_PARTS = ["chassis", "bonnet", "door_left", "door_right"];
const SKIP_MATERIALS = /glass|mirror/i;
const HUE_MIN = 320;
const HUE_MAX = 30;
const SAT_MIN = 0.20;
const SAT_MAX = 0.60;
const LUM_MIN = 0.08;
const LUM_MAX = 0.28;

export class MaterialSystem {
  constructor(configurator) {
    this.configurator = configurator;
    this._bodyMeshes = [];
    this._originals = new Map();
    this._texCache = new Map(); 
    this._ready = false;

    configurator.on(Events.COLOR_CHANGED, ({ hex }) => {
      if (this._ready) this._applyColor(hex);
    });
  }

  init(model) {
    const texturesToProcess = new Map();

    for (const id of TARGET_PARTS) {
      const part = this.configurator.getPartById(id);
      if (!part?.meshes?.length) continue;

      for (const mesh of part.meshes) {
        if (SKIP_MATERIALS.test(mesh.material?.name)) continue;

        mesh.material = mesh.material.clone();
        this._bodyMeshes.push(mesh);

        const mat = mesh.material;
        this._originals.set(mesh.uuid, {
          color: mat.color.clone(),
          map: mat.map,
          emissiveMap: mat.emissiveMap,
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity,
          metalness: mat.metalness,
          roughness: mat.roughness,
          metalnessMap: mat.metalnessMap,
          roughnessMap: mat.roughnessMap,
        });

        if (mat.map?.image && !texturesToProcess.has(mat.map.uuid)) {
          texturesToProcess.set(mat.map.uuid, mat.map);
        }
      }
    }

    for (const [uuid, tex] of texturesToProcess) {
      this._snapshotAndMask(uuid, tex);
    }

    this._ready = true;

    const masked = [...this._texCache.values()].reduce(
      (n, t) => n + t.indices.length,
      0
    );
    console.log(
      `[Material] ${this._bodyMeshes.length} meshes, ${masked} paint pixels masked`
    );
  }

  resetColor() {
    for (const mesh of this._bodyMeshes) {
      const orig = this._originals.get(mesh.uuid);
      if (!orig) continue;
      mesh.material.map = orig.map;
      mesh.material.emissiveMap = orig.emissiveMap;
      mesh.material.emissive.copy(orig.emissive);
      mesh.material.emissiveIntensity = orig.emissiveIntensity;
      mesh.material.metalness = orig.metalness;
      mesh.material.roughness = orig.roughness;
      mesh.material.metalnessMap = orig.metalnessMap;
      mesh.material.roughnessMap = orig.roughnessMap;
      mesh.material.color.copy(orig.color);
      mesh.material.needsUpdate = true;
    }
  }

  _snapshotAndMask(uuid, tex) {
    const img = tex.image;
    if (!img) return;

    const w = img.width;
    const h = img.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    try {
      ctx.drawImage(img, 0, 0, w, h);
    } catch {
      return;
    }

    const imageData = ctx.getImageData(0, 0, w, h);
    const px = imageData.data;
    const indices = [];
    const lumValues = [];

    for (let pi = 0; pi < w * h; pi++) {
      const i = pi * 4;
      const r = px[i] / 255,
        g = px[i + 1] / 255,
        b = px[i + 2] / 255;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      if (d === 0) continue;

      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (s < SAT_MIN || s > SAT_MAX) continue;
      if (l < LUM_MIN || l > LUM_MAX) continue;

      let hh;
      if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) hh = ((b - r) / d + 2) / 6;
      else hh = ((r - g) / d + 4) / 6;
      const hDeg = hh * 360;

      if (hDeg >= HUE_MIN || hDeg <= HUE_MAX) {
        indices.push(i);
        lumValues.push(l);
      }
    }

    this._texCache.set(uuid, {
      srcPixels: new Uint8ClampedArray(px),
      indices,
      lumValues,
      w,
      h,
      flipY: tex.flipY,
      wrapS: tex.wrapS,
      wrapT: tex.wrapT,
    });
  }

  _applyColor(hex) {
    const color = new THREE.Color(hex);
    const tHSL = {};
    color.getHSL(tHSL);
    const recoloured = new Map();

    for (const [texUuid, td] of this._texCache) {
      const { srcPixels, indices, lumValues, w, h, flipY, wrapS, wrapT } = td;
      const out = new Uint8ClampedArray(srcPixels);

      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        const rgb = hslToRGB(tHSL.h, tHSL.s, lumValues[j]);
        out[i] = Math.round(rgb[0] * 255);
        out[i + 1] = Math.round(rgb[1] * 255);
        out[i + 2] = Math.round(rgb[2] * 255);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);

      const newTex = new THREE.CanvasTexture(canvas);
      newTex.flipY = flipY;
      newTex.wrapS = wrapS;
      newTex.wrapT = wrapT;
      newTex.colorSpace = THREE.SRGBColorSpace;
      newTex.needsUpdate = true;

      recoloured.set(texUuid, newTex);
    }

    for (const mesh of this._bodyMeshes) {
      const orig = this._originals.get(mesh.uuid);
      if (!orig) continue;

      const newTex = recoloured.get(orig.map?.uuid);
      if (newTex) mesh.material.map = newTex;

      mesh.material.emissiveMap = null;
      mesh.material.emissive.set(0x000000);
      mesh.material.emissiveIntensity = 0;
      mesh.material.color.set(0xffffff);
      mesh.material.metalness = 0.4;
      mesh.material.roughness = 0.3;
      mesh.material.metalnessMap = null;
      mesh.material.roughnessMap = null;
      mesh.material.needsUpdate = true;
    }
  }
}

function hslToRGB(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
