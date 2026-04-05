import * as THREE from "three";
import gsap from "gsap";
import { Events } from "../core/ConfiguratorManager.js";

export class AnimationSystem {
  constructor(configurator) {
    this.configurator = configurator;
    this.state = "idle";
    this.isExploded = false;
    this.mixer = null;
    this._clipActions = new Map();
    this._clock = new THREE.Clock();
    this._restPositions = new Map();
    this._activeTimeline = null;

    configurator.on(Events.PART_SELECTED, ({ part }) => {
      if (part?.type === "popup") this._playPopup(part);
    });
    configurator.on(Events.EXPLODE, () => this.explode());
    configurator.on(Events.ASSEMBLE, () => this.assemble());
  }

  init(gltf) {
    const model = gltf.scene ?? gltf;
    for (const part of this.configurator.registry.parts) {
      if (!part.meshes?.length) continue;
      const entries = part.meshes.map((mesh) => ({
        mesh,
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
      }));
      this._restPositions.set(part.id, entries);
    }

    if (gltf.animations?.length) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        const action = this.mixer.clipAction(clip);
        action.clampWhenFinished = true;
        action.loop = THREE.LoopOnce;
        this._clipActions.set(clip.name, action);
      }
    }

    console.log(
      `[AnimationSystem] Initialised — ${this._restPositions.size} parts, ` +
        `${this._clipActions.size} embedded clips`
    );
  }

  update() {
    if (this.mixer) {
      this.mixer.update(this._clock.getDelta());
    }
  }

  _playPopup(part) {
    if (this.state !== "idle" || this.isExploded) return;
    if (!part.meshes?.length) return;

    this.state = "animating";
    const tl = gsap.timeline({
      onComplete: () => {
        this.state = "idle";
      },
    });

    const partsToAnimate = [part];
    if (part.triggers?.length) {
      for (const triggeredId of part.triggers) {
        const linked = this.configurator.registry.parts.find((p) => p.id === triggeredId);
        if (linked?.meshes?.length) partsToAnimate.push(linked);
      }
    }

    for (const p of partsToAnimate) {
      if (p.rotateOffset) {
        const target = p.groupNode || p.meshes[0];
        const restRot = {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z,
        };
        tl.to(
          target.rotation,
          {
            x: restRot.x + (p.rotateOffset[0] || 0),
            y: restRot.y + (p.rotateOffset[1] || 0),
            z: restRot.z + (p.rotateOffset[2] || 0),
            duration: 0.3,
            ease: "power2.out",
          },
          0
        );
        tl.to(
          target.rotation,
          {
            x: restRot.x,
            y: restRot.y,
            z: restRot.z,
            duration: 0.3,
            ease: "power2.inOut",
            onComplete: () => {
              target.rotation.set(restRot.x, restRot.y, restRot.z);
            },
          },
          0.7
        );
      } else {
        const [ox, oy, oz] = p.explodeOffset;
        const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
        const popDist = 0.4;
        const dx = (ox / len) * popDist;
        const dy = (oy / len) * popDist;
        const dz = (oz / len) * popDist;
        for (const mesh of p.meshes) {
          const rest = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
          tl.to(
            mesh.position,
            {
              x: rest.x + dx,
              y: rest.y + dy,
              z: rest.z + dz,
              duration: 0.3,
              ease: "power2.out",
            },
            0
          );
          tl.to(
            mesh.position,
            {
              x: rest.x,
              y: rest.y,
              z: rest.z,
              duration: 0.3,
              ease: "power2.inOut",
              onComplete: () => {
                mesh.position.set(rest.x, rest.y, rest.z);
              },
            },
            0.7
          );
        }
      }
    }

    this._activeTimeline = tl;
  }

  explode() {
    if (this.state !== "idle" || this.isExploded) return;

    this.state = "animating";
    this.configurator.interactionLocked = true;

    const tl = gsap.timeline({
      onComplete: () => {
        this.state = "idle";
        this.isExploded = true;
        this.configurator.interactionLocked = false;
      },
    });

    const parts = this.configurator.registry.parts.filter(
      (p) => p.meshes?.length && (p.explodeOffset[0] || p.explodeOffset[1] || p.explodeOffset[2])
    );

    parts.forEach((part, index) => {
      const [ox, oy, oz] = part.explodeOffset;
      const stagger = index * 0.08;

      for (const mesh of part.meshes) {
        const rest = this._getRestPos(part.id, mesh);
        tl.to(
          mesh.position,
          {
            x: rest.x + ox,
            y: rest.y + oy,
            z: rest.z + oz,
            duration: 0.6,
            ease: "power2.out",
          },
          stagger
        );
      }
    });

    this._activeTimeline = tl;
  }

  assemble() {
    if (this.state !== "idle" || !this.isExploded) return;

    this.state = "animating";
    this.configurator.interactionLocked = true;

    const tl = gsap.timeline({
      onComplete: () => {
        this.state = "idle";
        this.isExploded = false;
        this.configurator.interactionLocked = false;
        this._snapAllToRest();
      },
    });

    const parts = this.configurator.registry.parts.filter(
      (p) => p.meshes?.length && (p.explodeOffset[0] || p.explodeOffset[1] || p.explodeOffset[2])
    );

    parts
      .slice()
      .reverse()
      .forEach((part, index) => {
        const stagger = index * 0.08;

        for (const mesh of part.meshes) {
          const rest = this._getRestPos(part.id, mesh);
          tl.to(
            mesh.position,
            {
              x: rest.x,
              y: rest.y,
              z: rest.z,
              duration: 0.6,
              ease: "power2.inOut",
            },
            stagger
          );
        }
      });

    this._activeTimeline = tl;
  }

  playClip(clipName) {
    const action = this._clipActions.get(clipName);
    if (!action) return;
    action.reset();
    action.play();
  }

  _getRestPos(partId, mesh) {
    const entries = this._restPositions.get(partId);
    if (!entries) return { x: 0, y: 0, z: 0 };
    const entry = entries.find((e) => e.mesh === mesh);
    return entry ?? { x: 0, y: 0, z: 0 };
  }

  _snapAllToRest() {
    for (const [partId, entries] of this._restPositions) {
      for (const { mesh, x, y, z } of entries) {
        mesh.position.set(x, y, z);
      }
    }
  }
}
