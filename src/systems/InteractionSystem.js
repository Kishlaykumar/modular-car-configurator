import * as THREE from "three";

/**
 * Raycasting + input detection layer.
 * Traverses GLB to build mesh → part mapping,
 * then delegates state changes to ConfiguratorManager.
 * No DOM, no visuals — those live in HighlightSystem / Tooltip.
 */
export class InteractionSystem {
  constructor(sceneManager, configurator) {
    this.sceneManager = sceneManager;
    this.configurator = configurator;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.model = null;

    // mesh.uuid → part.id (built during mapModel)
    this._meshToPartId = new Map();

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onClick = this._onClick.bind(this);

    const canvas = this.sceneManager.canvas;
    canvas.addEventListener("pointermove", this._onPointerMove);
    canvas.addEventListener("click", this._onClick);
  }

  // ── GLB mesh mapping ──────────────────────────────────────

  /**
   * Traverse loaded model, match each mesh to registry via ancestor names.
   * Stores mesh reference on the part config: part.meshes = [mesh, ...]
   */
  mapModel(model) {
    this.model = model;

    model.traverse((child) => {
      if (!child.isMesh) return;

      // Walk up parent chain — GLB meshes have generic names,
      // descriptive names are on ancestor group nodes
      let node = child;
      while (node) {
        const part = this.configurator.getPartByMeshName(node.name);
        if (part) {
          if (!part.meshes) part.meshes = [];
          part.meshes.push(child);
          this._meshToPartId.set(child.uuid, part.id);
          break;
        }
        node = node.parent;
      }
    });

    const uniqueParts = new Set(this._meshToPartId.values()).size;
    console.log(
      `[InteractionSystem] Mapped ${this._meshToPartId.size} meshes → ${uniqueParts} parts`
    );
  }

  // ── Pointer events ─────────────────────────────────────────

  _onPointerMove(event) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const partId = this._getHitPartId();
    this.configurator.setHoveredPart(partId);
  }

  _onClick() {
    if (this.configurator.interactionLocked) return;

    const partId = this._getHitPartId();
    if (partId) {
      // Toggle off if clicking the already-active part
      const isToggle = this.configurator.activePart?.id === partId;
      this.configurator.selectPart(isToggle ? null : partId);
    } else {
      this.configurator.selectPart(null);
    }
  }

  // ── Raycasting ─────────────────────────────────────────────

  _getHitPartId() {
    if (!this.model) return null;
    this.raycaster.setFromCamera(this.pointer, this.sceneManager.camera);
    const hits = this.raycaster.intersectObject(this.model, true);
    if (hits.length === 0) return null;
    return this._meshToPartId.get(hits[0].object.uuid) ?? null;
  }

  // ── Cleanup ────────────────────────────────────────────────

  dispose() {
    const canvas = this.sceneManager.canvas;
    canvas.removeEventListener("pointermove", this._onPointerMove);
    canvas.removeEventListener("click", this._onClick);
  }
}