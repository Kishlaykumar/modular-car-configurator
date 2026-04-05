import "./style.css";
import { SceneManager } from "./core/SceneManager.js";
import { ConfiguratorManager, Events } from "./core/ConfiguratorManager.js";
import { InteractionSystem } from "./systems/InteractionSystem.js";
import { HighlightSystem } from "./systems/HighlightSystem.js";
import { AnimationSystem } from "./systems/AnimationSystem.js";
import { CameraSystem } from "./systems/CameraSystem.js";
import { MaterialSystem } from "./systems/MaterialSystem.js";
import { PulseIndicatorSystem } from "./systems/PulseIndicatorSystem.js";
import { Tooltip } from "./components/UI/Tooltip.js";
import { ConfiguratorUI } from "./components/UI/ConfiguratorUI.js";

const canvas = document.getElementById("canvas");
const sceneManager = new SceneManager(canvas);
const configurator = new ConfiguratorManager();

const interaction = new InteractionSystem(sceneManager, configurator);
const highlight = new HighlightSystem(configurator);
const animation = new AnimationSystem(configurator);
const cameraSystem = new CameraSystem(sceneManager, configurator);
const materialSystem = new MaterialSystem(configurator);
const pulseIndicators = new PulseIndicatorSystem(sceneManager, configurator);
const tooltip = new Tooltip(configurator);
const ui = new ConfiguratorUI(configurator);

sceneManager.onTick(() => animation.update());

sceneManager
  .loadModel("/src/assets/models/textured.glb", (e) => ui.onLoadProgress(e))
  .then((gltf) => {
    gltf.scene.traverse((node) => {
      const part = configurator.getPartByMeshName(node.name);
      if (!part) return;

      if (part.initialPosition) {
        const [x, y, z] = part.initialPosition;
        node.position.x += x;
        node.position.y += y;
        node.position.z += z;
      }
      if (part.initialRotation) {
        const [x, y, z] = part.initialRotation;
        node.rotation.x += x;
        node.rotation.y += y;
        node.rotation.z += z;
      }
    });

    interaction.mapModel(gltf.scene);
    animation.init(gltf);
    materialSystem.init(gltf.scene);
    pulseIndicators.init();
    ui.onLoadComplete();
  });

sceneManager.loadHDRI("/src/assets/hdri/autoshop_01_2k.hdr");
window.configurator = configurator;
