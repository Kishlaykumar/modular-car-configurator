import "./style.css";
import { SceneManager } from "./core/SceneManager.js";

const canvas = document.getElementById("canvas");
const sceneManager = new SceneManager(canvas);

// Load car model
sceneManager.loadModel("/src/assets/models/textured.glb").then((model) => {
  console.log("Model loaded", model);
});

// HDRI for background and reflections
sceneManager.loadHDRI("/src/assets/hdri/autoshop_01_2k.hdr");
