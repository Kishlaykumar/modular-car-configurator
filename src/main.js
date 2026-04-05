import "./style.css";
import { SceneManager } from "./core/SceneManager.js";
import { ConfiguratorManager, Events } from "./core/ConfiguratorManager.js";
import { InteractionSystem } from "./systems/InteractionSystem.js";
import { HighlightSystem } from "./systems/HighlightSystem.js";
import { AnimationSystem } from "./systems/AnimationSystem.js";
import { Tooltip } from "./components/UI/Tooltip.js";

const canvas = document.getElementById("canvas");
const sceneManager = new SceneManager(canvas);
const configurator = new ConfiguratorManager();

const interaction = new InteractionSystem(sceneManager, configurator);
const highlight = new HighlightSystem(configurator);
const animation = new AnimationSystem(configurator);
const tooltip = new Tooltip(configurator);

sceneManager.onTick(() => animation.update());

sceneManager.loadModel("/src/assets/models/textured.glb").then((gltf) => {
  gltf.scene.traverse((node) => {
    if (node.name.includes("Guard_Front")) {
      node.position.z -= -0.7;
    }
  });

  gltf.scene.traverse((node) => {
    if (node.name.includes("Guard_Upper")) {
      node.position.y -=  0.5;
    }
  });

   gltf.scene.traverse((node) => {
    if (node.name.includes("Guard_Back")) {
      node.position.z -=  1.2;
    }
  });

   gltf.scene.traverse((node) => {
    if (node.name.includes("Back_Wheel")) {
      node.position.z -=  0.3;
    }
  });

  interaction.mapModel(gltf.scene);
  animation.init(gltf);
});

sceneManager.loadHDRI("/src/assets/hdri/autoshop_01_2k.hdr");
window.configurator = configurator;
