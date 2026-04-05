import * as THREE from "three";
import gsap from "gsap";
import { Events } from "../core/ConfiguratorManager.js";

export class PulseIndicatorSystem {
  constructor(sceneManager, configurator) {
    this.scene = sceneManager.scene;
    this.configurator = configurator;
    this._indicators = [];
    this._visible = true;

    configurator.on(Events.EXPLODE, () => this._setVisible(false));
    configurator.on(Events.ASSEMBLE, () => this._setVisible(true));
  }

  init() {
    const ringTex = this._createRingTexture();

    for (const part of this.configurator.registry.parts) {
      if (part.type !== "popup") continue;
      if (!part.meshes?.length) continue;

      const targetMesh = part.meshes[0];
      targetMesh.geometry.computeBoundingBox();
      const localCenter = new THREE.Vector3();
      targetMesh.geometry.boundingBox.getCenter(localCenter);
      const bboxSize = new THREE.Vector3();
      targetMesh.geometry.boundingBox.getSize(bboxSize);
      const axes = [
        { axis: "x", size: bboxSize.x },
        { axis: "y", size: bboxSize.y },
        { axis: "z", size: bboxSize.z },
      ];
      axes.sort((a, b) => a.size - b.size);
      localCenter[axes[0].axis] += axes[0].size * 0.5 + 0.03;

      const spriteMat = new THREE.SpriteMaterial({
        map: ringTex,
        transparent: true,
        depthTest: true,
        opacity: 0.8,
        color: 0xffffff,
      });

      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(localCenter);
      sprite.scale.set(0.15, 0.15, 1);
      sprite.renderOrder = 999;
      targetMesh.add(sprite);

      const proxy = { s: 0.15, o: 0.8 };
      const tween = gsap.to(proxy, {
        s: 0.25,
        o: 0.2,
        duration: 1.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        onUpdate: () => {
          sprite.scale.set(proxy.s, proxy.s, 1);
          sprite.material.opacity = proxy.o;
        },
      });

      this._indicators.push({ sprite, tween, part });
    }
  }

  _setVisible(visible) {
    this._visible = visible;
    for (const { sprite, tween } of this._indicators) {
      sprite.visible = visible;
      if (visible) {
        tween.resume();
      } else {
        tween.pause();
      }
    }
  }

  _createRingTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.45;
    const innerR = size * 0.30;

    const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.0)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.globalCompositeOperation = "destination-out";
    const innerGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    innerGradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    innerGradient.addColorStop(0.7, "rgba(0, 0, 0, 1)");
    innerGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = innerGradient;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  dispose() {
    for (const { sprite, tween } of this._indicators) {
      tween.kill();
      sprite.material.map?.dispose();
      sprite.material.dispose();
      this.scene.remove(sprite);
    }
    this._indicators = [];
  }
}
