# Modular Car Configurator

Browser-based 3D car configurator. Click parts to animate them, change the body paint color, blow the whole thing apart with explode/assemble, orbit around with camera presets. Three.js + GSAP, no framework.

## What It Does

You get a car in a WebGL viewport with HDRI lighting. You can:

- **Click parts** — doors swing open, bonnet pops up, wheels kick outward. Each part has its own animation type defined in a JSON registry, not hardcoded in the animation logic.
- **Change body color** — picks up only the painted body panels and recolors them, leaving headlights, taillights, trim, and underbelly alone. This was harder than it sounds (more on that below).
- **Explode / assemble** — every part flies out along its offset vector with staggered timing, then reassembles in reverse order.
- **Camera presets** — front, rear, side, top. GSAP tweens the camera and orbit target simultaneously while temporarily disabling OrbitControls so they don't fight each other.
- **Hover glow** — emissive channel fades in on hover via GSAP. I had to clone materials per-mesh to prevent the glow from bleeding across parts that share the same Three.js material instance.
- **Tooltips** — plain DOM div that follows the cursor. Shows the part label from the registry.

---

## Tech Stack

| | |
|---|---|
| Three.js 0.172 | Rendering, PBR materials, GLTF loader, OrbitControls |
| GSAP 3.12 | Every animation in the project — popups, explode, camera moves, emissive tweens |
| Vite 6.3 | Dev server + builds |
| Tailwind 4.1 | Mostly just the reset. The panel CSS is hand-written. |
| stats-gl | Performance overlay, hidden by default |

No React, no Vue. The UI is ~50 DOM elements built once in `ConfiguratorUI.js` and mutated directly. A virtual DOM would be overhead for zero benefit here.

---

## Architecture

### The Central Problem

I initially had each system managing its own little piece of state. `InteractionSystem` tracked which part was hovered, `AnimationSystem` tracked whether it was mid-animation, `HighlightSystem` stored its own "active part" reference. This fell apart fast — clicking a part during an explode animation would trigger a popup and a highlight simultaneously, and the systems had no way to know they should back off.

So I pulled everything into `ConfiguratorManager`. It's a simple event emitter that holds:

- `activePart` / `hoveredPart` — what's selected and what's under the cursor
- `interactionLocked` — a flag that every public method checks before doing anything. Set to `true` while an animation timeline is running.
- `activeColor` — last applied paint color
- `registry` — the parsed `partRegistry.json`, with `meshes[]` and `groupNode` references attached at runtime during model traversal

Every system subscribes to events. No system calls another system.

```
Click on canvas
  → InteractionSystem raycasts, finds mesh, looks up part ID
    → configurator.selectPart(id)
      → emits PART_SELECTED
        → AnimationSystem plays popup
        → HighlightSystem applies glow
        → (any future system can hook in here)
```

This made it trivial to add the `MaterialSystem` and `CameraSystem` later — they just subscribe to `COLOR_CHANGED` and `CAMERA_PRESET` respectively. Didn't touch a single line in the existing systems.

### Mesh Mapping

The GLB model has deeply nested nodes with auto-generated names like `node_Door Left_-220884_26`. I needed to map these to logical part IDs.

`InteractionSystem.mapModel()` walks every mesh in the scene, then walks *up* the parent chain until it finds a node whose name contains a `meshName` from the registry (with underscores normalized to spaces). This also captures the `groupNode` — the parent node that contains both the door mesh and the door glass mesh, so rotating the group moves both together.

This was a pain to figure out. At first I was only matching leaf meshes, and the door glass wouldn't move with the door during animations. Walking up to find the group node fixed it, but it means the registry `meshName` must match something in the parent chain, not just the leaf.

---

## How Specific Things Work

### Color System (the complicated one)

The car uses a single shared atlas texture — one big 4096×4096 image with the body paint, headlight lenses, taillight glass, chrome trim, interior fabric, underbody geometry, everything, all packed in. I can't just set `material.color` because it multiplies across the entire texture. Red body + white headlight lens = red headlight.

I tried three approaches:

1. **Just set `material.color`** — everything turns the same tint. Headlights, taillights, all of it. Terrible.
2. **Grayscale the texture, then tint with `material.color`** — same problem, just slightly less saturated. Still tints non-body areas.
3. **Per-pixel HSL masking** — this is what actually works.

At init, `MaterialSystem` reads the atlas texture into a canvas, scans every pixel, and builds a mask of byte offsets where the pixel's HSL values match the body paint range (hue 320°–30°, saturation 0.20–0.60, lightness 0.08–0.28). Those thresholds came from sampling the actual texture with sharp — the body paint is a dark reddish-maroon, and everything else (lights, chrome, black trim) falls outside that range.

On color change, it copies the original pixel buffer, rewrites only the masked pixels with the target hue/saturation (keeping original luminance for surface detail), and creates a new `CanvasTexture`. One texture is created and shared across all body meshes since they reference the same atlas.

The obvious problem: those HSL thresholds are tuned to this specific car model. A blue car or a lighter paint would need different thresholds. The right fix is a dedicated mask texture from the artist, but I didn't have that.

### Animations

Everything goes through GSAP timelines. Three types:

**Popup** — Parts with `rotateOffset` (doors, bonnet) rotate their `groupNode`. Parts without it translate along a normalized version of their `explodeOffset`. The open tween runs at t=0, there's a deliberate 0.4s pause, then the close tween at t=0.7. I wanted it to feel like the part "shows itself" before snapping back.

**Explode** — Iterates all parts with non-zero offsets, staggers them by 80ms (`index * 0.08`). Sets `interactionLocked = true` for the duration so you can't click parts mid-flight.

**Assemble** — Same thing but reversed array order so parts come back in the opposite sequence. There's a `_snapAllToRest()` call at the end because GSAP float precision drift means after 20+ parts tweening simultaneously, some end up at like `0.0000003` instead of `0`. Tiny, but it compounds if you explode/assemble repeatedly.

### Highlight System

Tweens `material.emissive` and `emissiveIntensity` for a soft glow effect. I had a dumb bug early on where hovering one part would glow multiple other parts — turned out Three.js shares material instances across meshes using the same material. Cloning the material in `_storeOriginal()` fixed it, but it means we're creating more material objects than strictly necessary.

Another gotcha: after a color change, the `MaterialSystem` nulls the emissive map and zeroes the emissive channel. If the `HighlightSystem` still has the old emissive values stored, un-hovering would try to restore to the pre-color-change state and flash white. So `HighlightSystem` listens to `COLOR_CHANGED` and re-snapshots all stored baselines.

---

## State Flow Reference

### Part Click
`InteractionSystem._onClick` → raycast → lookup part → `configurator.selectPart(id)` → emits `PART_SELECTED { part, previousPart }` → `HighlightSystem` restores previous, glows new → `AnimationSystem` plays popup if type is `"popup"`

### Hover
`InteractionSystem._onPointerMove` → raycast → `configurator.setHoveredPart(id)` → early-returns if same part → emits `PART_UNHOVERED` then `PART_HOVERED` → `HighlightSystem` tweens emissive (0.25s) → `Tooltip` shows label

### Explode
UI button → `configurator.explode()` → checks `interactionLocked` → emits `EXPLODE` → `AnimationSystem` locks interaction, builds staggered timeline, unlocks on complete → UI updates button text to "Assemble"

### Color
Swatch click → `configurator.setColor(hex)` → emits `COLOR_CHANGED` → `MaterialSystem` rewrites masked pixels, creates texture → `HighlightSystem` refreshes stored emissive baselines

---

## Folder Structure

```
src/
  main.js                       Wires everything together, loads model
  style.css                     Panel styles, loader, tooltips (mostly not Tailwind)
  core/
    ConfiguratorManager.js      State + events. ~100 lines.
    SceneManager.js             Three.js setup, render loop, loaders
  systems/
    AnimationSystem.js          Popup / explode / assemble via GSAP
    CameraSystem.js             Camera presets with GSAP transitions
    HighlightSystem.js          Emissive hover/selection glow
    InteractionSystem.js        Raycasting + mesh-to-part mapping
    MaterialSystem.js           Body paint recoloring (the HSL mask thing)
  components/UI/
    ConfiguratorUI.js           Side panel — swatches, camera buttons, explode toggle
    Tooltip.js                  Cursor-following label
  data/
    partRegistry.json           Every part definition, offset, trigger, label
  assets/
    hdri/autoshop_01_2k.hdr     Environment map
    models/textured.glb         The car
```

---

## Running It

```bash
pnpm install
pnpm dev          # dev server at localhost:5173
pnpm build        # production build
pnpm preview      # preview the build
```

Needs Node 18+ and pnpm. Model goes in `src/assets/models/textured.glb`.

---
