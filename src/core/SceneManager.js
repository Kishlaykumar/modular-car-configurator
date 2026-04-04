import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import Stats from "stats-gl";

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;

    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initControls();
    this.initLighting();
    this.initFloor();
    this.initHelpers();
    this.initStats();

    // Loaders
    this.gltfLoader = new GLTFLoader();
    this.rgbeLoader = new RGBELoader();
    this.textureLoader = new THREE.TextureLoader();

    // Responsive
    window.addEventListener("resize", this.onResize.bind(this));

    // Start render loop
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  // ── Renderer ──────────────────────────────────────────────

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // ── Scene ─────────────────────────────────────────────────

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
  }

  // ── Camera ────────────────────────────────────────────────

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(4, 1.6, 5);
  }

  // ── Controls ──────────────────────────────────────────────

  initControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 8;
    this.controls.maxPolarAngle = Math.PI / 2; // prevent going below ground
    this.controls.target.set(0, 0.6, 0);
    this.controls.update();
  }

  // ── Lighting ──────────────────────────────────────────────

  initLighting() {
    // Key light – directional from above, matching garage ceiling lights
    this.keyLight = new THREE.DirectionalLight(0xffffff, 4);
    this.keyLight.position.set(5, 10, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 40;
    this.keyLight.shadow.camera.left = -10;
    this.keyLight.shadow.camera.right = 10;
    this.keyLight.shadow.camera.top = 10;
    this.keyLight.shadow.camera.bottom = -10;
    this.keyLight.shadow.bias = -0.001;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // Fill light – soft ambient
    this.fillLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.fillLight);

    // Rim lights – edge highlights from each side
    const rimLeft = new THREE.DirectionalLight(0xffffff, 1);
    rimLeft.position.set(-6, 4, -2);
    this.scene.add(rimLeft);

    const rimRight = new THREE.DirectionalLight(0xffffff, 1);
    rimRight.position.set(6, 4, -2);
    this.scene.add(rimRight);
  }

  // ── Floor ─────────────────────────────────────────────────

  initFloor() {
    // Ground plane – shadow catcher at y = 0
    const shadowGeo = new THREE.PlaneGeometry(50, 50);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.6 });
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = 0;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);
  }

  // ── Helpers ───────────────────────────────────────────────

  initHelpers() {
    this.axesHelper = new THREE.AxesHelper(5);
    this.scene.add(this.axesHelper);
  }

  // ── Stats ─────────────────────────────────────────────────

  initStats() {
    this.stats = new Stats({
      trackGPU: true,
      trackCPU: true,
    });
    document.body.appendChild(this.stats.dom);
  }

  // ── Environment (HDRI) ───────────────────────────────────

  loadHDRI(path) {
    return new Promise((resolve, reject) => {
      this.rgbeLoader.load(
        path,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          this.scene.environment = texture;
          this.scene.background = texture;
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  // ── Background image ─────────────────────────────────────

  loadBackground(path) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          this.scene.background = texture;
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  // ── Model loading ────────────────────────────────────────

  loadModel(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;

          // Ground alignment — move model so its bottom touches y = 0
          const box = new THREE.Box3().setFromObject(model);
          model.position.y -= box.min.y;

          // Enable shadow casting on every mesh in the model
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.scene.add(model);
          resolve(model);
        },
        undefined,
        reject
      );
    });
  }

  // ── Responsive ───────────────────────────────────────────

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  // ── Render loop ──────────────────────────────────────────

  animate() {
    this.stats.update();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
