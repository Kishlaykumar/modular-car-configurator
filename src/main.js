import "./style.css";
import { SceneManager } from "./core/SceneManager.js";
import { ConfiguratorManager, Events } from "./core/ConfiguratorManager.js";
import { InteractionSystem } from "./systems/InteractionSystem.js";
import { HighlightSystem } from "./systems/HighlightSystem.js";
import { Tooltip } from "./components/UI/Tooltip.js";

const canvas = document.getElementById("canvas");
const sceneManager = new SceneManager(canvas);
const configurator = new ConfiguratorManager();

const interaction = new InteractionSystem(sceneManager, configurator);
const highlight = new HighlightSystem(configurator);
const tooltip = new Tooltip(configurator);

configurator.on(Events.PART_HOVERED, ({ part }) =>
  console.log("[hover]", part.id, part.label)
);
configurator.on(Events.PART_UNHOVERED, ({ part }) =>
  console.log("[unhover]", part.id)
);
configurator.on(Events.PART_SELECTED, ({ part, previousPart }) => {
  if (previousPart) console.log("[deselect]", previousPart.id);
  if (part) console.log("[select]", part.id, part.label);
});

sceneManager.loadModel("/src/assets/models/textured.glb").then((model) => {
  interaction.mapModel(model);
});

sceneManager.loadHDRI("/src/assets/hdri/autoshop_01_2k.hdr");
