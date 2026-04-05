import gsap from "gsap";
import { Events } from "../core/ConfiguratorManager.js";

const PRESETS = {
  front: { position: [0, 1, -6], target: [0, 1.8, 0] },
  rear: { position: [0, 1, 6], target: [0, 1.8, 0] },
  top: { position: [0, 7, 0.01], target: [0, 1.8, 0] },
  right: { position: [-6, 1, 0], target: [0, 1.8, 0] },
  left: { position: [6, 1, 0], target: [0, 1.8, 0] },
};

export class CameraSystem {
  constructor(sceneManager, configurator) {
    this.camera = sceneManager.camera;
    this.controls = sceneManager.controls;
    this._tl = null;

    configurator.on(Events.CAMERA_PRESET, ({ name }) => {
      this.goTo(name);
    });
  }

  goTo(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    if (this._tl) this._tl.kill();

    const [px, py, pz] = preset.position;
    const [tx, ty, tz] = preset.target;

    this.controls.enabled = false;

    this._tl = gsap.timeline({
      onUpdate: () => {
        this.controls.update();
      },
      onComplete: () => {
        this.controls.enabled = true;
        this._tl = null;
      },
    });

    this._tl.to(
      this.camera.position,
      { x: px, y: py, z: pz, duration: 1, ease: "power2.inOut" },
      0
    );
    this._tl.to(
      this.controls.target,
      { x: tx, y: ty, z: tz, duration: 1, ease: "power2.inOut" },
      0
    );
  }
}
