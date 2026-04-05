# Design Document

The architectural decisions, tradeoffs, and things I'd do differently with more time.

---

## 1. Why the Architecture Looks Like This

### The State Problem

Early on I had state scattered across systems. `InteractionSystem` knew which part was hovered. `AnimationSystem` tracked whether it was mid-animation. `HighlightSystem` kept its own baseline emissive values. It worked until I added the explode feature — suddenly I needed to lock all interaction while the timeline played, but `InteractionSystem` had no idea `AnimationSystem` was busy. I was passing flags between systems and it was getting tangled fast.

The fix was `ConfiguratorManager`. Everything that matters lives there:

```
activePart          → what the user clicked
hoveredPart         → what's under the cursor
activeColor         → body paint hex
interactionLocked   → blocks all input during animations
registry            → part definitions with runtime mesh refs bolted on
```

Every mutation goes through a public method, which updates state and emits an event. Systems react to events. They never talk to each other.

### The Event Bus

```
InteractionSystem  ──→  ConfiguratorManager  ←── ConfiguratorUI
                              │
                    ┌─────────┼─────────┬──────────┬───────────┐
                    ▼         ▼         ▼          ▼           ▼
              Animation   Highlight   Material   Camera     Tooltip
              System      System      System     System
```

This turned out to be the right call. When I added `MaterialSystem` for color changes and `CameraSystem` for presets, I didn't touch any existing system. They just subscribe to the events they care about. If I ripped out `Tooltip` tomorrow, nothing would break.

The event emitter itself is ~30 lines — just an object mapping event names to arrays of callbacks. I considered using a library for this but it's so trivially small that a dependency would be silly.

### Why No Framework

The entire UI is a side panel with 6 color swatches, 4 camera buttons, a hex input, and an explode toggle. About 50 DOM elements, created once, mutated with `classList` and `.textContent`. React's reconciliation loop would add latency for zero value. The canvas and Three.js render loop are where all the real work happens.

---

## 2. Scaling to Multiple Models

Right now there's one car. But the system is set up so adding another model doesn't require code changes — just a GLB file and a matching `partRegistry.json`.

### How the Registry Works

Every part-specific value is in the JSON:

```json
{
  "id": "door_left",
  "meshName": "Door Left",
  "label": "Left Door",
  "type": "popup",
  "explodeOffset": [-0.6, 0, 0],
  "rotateOffset": [0, -1.2, 0],
  "initialRotation": [0, 1.14, 0],
  "triggers": ["door_right"]
}
```

No system contains the string `"Door Left"` or the offset `-0.6`. The `AnimationSystem` reads `rotateOffset` and builds a GSAP timeline without knowing it's a door. If you had a trunk that rotates on a different axis, you'd just write a different `rotateOffset` in the registry.

### Mesh Mapping is Fuzzy by Design

GLB exporters generate node names like `node_Door Left_-220884_26`. The matching logic normalizes underscores to spaces and does substring matching — so `"Door Left"` matches any node that contains those words. This was intentional. Different Blender exports of the same model produce different suffixes, and I didn't want to deal with brittle exact-match lookups.

The risk: a part named `"Glass"` would match `"Glass Front"`, `"Glass Back"`, `"Glass Left"`, etc. I got around this by using specific enough names in the registry, but it's not bulletproof. A model with parts named `"Left"` and `"Left Door"` would have ambiguity.

### What Breaks With a New Model

Almost everything in the codebase is model-agnostic except `MaterialSystem`. The HSL thresholds (hue 320°–30°, saturation 0.20–0.60, lightness 0.08–0.28) are calibrated to this car's dark maroon paint by sampling actual pixel values from the atlas texture. A different car with blue paint, or a lighter brown, would need different thresholds.

Two options:
1. Put threshold configs in the registry per model. Quick but fragile.
2. Include a mask texture in each GLB where body-paint pixels are marked in a separate channel. Proper solution but needs artist buy-in.

I'd go with option 2 if this were production.

### Multi-Model Runtime Swap

Not implemented, but architecturally possible. `ConfiguratorManager._loadRegistry()` already takes any object. The model path is parameterized. You'd need to clear the scene, dispose textures and geometries, and re-init every system. The plumbing is there, the cleanup logic isn't.

---

## 3. Performance

### What I Actually Did

| Thing | Why |
|---|---|
| Pixel ratio capped at 2 | 3x Retina displays are a waste of fill rate for this kind of scene. You can't see the difference at normal viewing distance. |
| Single shadow-casting light | Multiple shadow maps get expensive fast. One directional light with 2048×2048 PCF shadow map is the sweet spot. |
| Debounced resize (150ms) | Without this, dragging the browser edge fires dozens of resize events that each trigger `setSize()` + projection matrix update. 150ms catches the end of the drag. |
| Rest positions cached at init | Querying mesh positions during an active tween gives you the mid-animation value, not the rest value. I cache them once and reference the cache during explode/assemble. |

### The Texture Recoloring Cost

This is the biggest performance concern. Each color change:

1. Copies the full 4096×4096 RGBA atlas (~67MB `Uint8ClampedArray`)
2. Loops through ~600K pre-computed mask indices (out of ~16.7M total pixels)
3. Writes new RGB values using an HSL→RGB conversion
4. Builds a `CanvasTexture` and `putImageData`

On my machine this takes ~50-80ms. For clicking a swatch every few seconds, you don't notice. For a continuous color slider firing on every `input` event, it would hitch badly.

The right solution is doing this in a fragment shader with a mask texture — zero CPU cost, runs at 60fps. I didn't do it because I didn't have a mask texture and generating one at build time seemed like scope creep for a demo.

One thing I did get right: the recolored texture is shared. All body meshes (chassis, bonnet, both doors) reference the same atlas texture UUID, so only one copy is created and assigned to all four materials.

### Memory Budget

Rough numbers:

| | |
|---|---|
| Atlas on GPU | ~64MB |
| Original pixel snapshot (CPU-side) | ~67MB |
| Recolored atlas on GPU | ~64MB |
| Mask indices + luminance arrays | ~7MB |

About 200MB peak. Desktop is fine. Mobile would struggle — the atlas alone is half the GPU memory budget on a lot of phones. If this were shipping to mobile, I'd serve a 2048×2048 atlas and reduce the shadow map.

### UI Layout

Tried to avoid forced reflows. All UI elements are created once at startup. Visibility changes use `classList`. The loading overlay removes itself from the DOM after its fade-out transition instead of hiding — no point keeping dead elements around. The tooltip is `position: fixed; pointer-events: none` so the browser doesn't recalculate layout when it moves.

---

## 4. Animation Decisions

### Why GSAP and Not Something Else

I looked at three alternatives before settling:

**Three.js AnimationMixer** — only plays pre-baked clips from Blender. The model ships with a few clips but nothing for explode/assemble, which needs to be computed from registry offsets at runtime.

**Manual lerp in the render loop** — I actually started here. Got a basic popup working, then realized I needed staggered timelines, easing, completion callbacks, and the ability to kill an active animation when a new one starts. I was halfway to reimplementing GSAP, so I just used GSAP.

**CSS/Web Animations** — doesn't apply. Three.js mesh transforms aren't DOM properties.

GSAP's timeline API was the main draw. The explode sequence is: iterate parts, stagger by `index * 0.08`, each part's meshes tween along their offset vector. That's about 15 lines of code. Doing that with manual lerping would've been 80+ lines and harder to cancel.

### How Popup Animations Work

Parts with `rotateOffset` in the registry (doors, bonnet) do a rotation animation on the `groupNode`. Parts without it do a translation based on a normalized version of their `explodeOffset`.

The door thing was tricky. At first I was rotating the door mesh directly, but the door glass (a separate child mesh inside the same group node) stayed put. Looked ridiculous. Switching to rotate the `groupNode` — which contains both the door geometry and the glass — fixed it, but it means the registry `meshName` needs to match a node in the parent chain, not just the leaf mesh.

### The Open-Pause-Close Timing

Popup timelines: open tween at t=0 (0.3s), close tween at t=0.7 (0.3s). That 0.4s gap is intentional — I wanted the part to hold its open position for a beat so you actually see it. Without the pause it felt like a nervous twitch.

### Explode Staggering

Parts animate in registry array order with 80ms gaps. Assemble reverses the array first, so the last part to fly out is the first to come back. This gives it a satisfying "cascade out, cascade in" feel.

The `_snapAllToRest()` at the end of assemble is a hack. After a staggered timeline with 20 parts, some end up at floating-point positions like `0.00000003` instead of `0` due to GSAP interpolation. Over multiple explode/assemble cycles this drifts. The snap hard-resets everyone to their cached rest positions. It works, but ideally I'd use `gsap.set()` on complete for each individual part tween instead of a blanket reset.

---

## 5. What I'd Do Different / Next

### Shader-Based Paint

The obvious one. Move recoloring into a fragment shader:

```glsl
uniform sampler2D bodyMask;
uniform vec3 targetColor;

void main() {
  vec4 texel = texture2D(map, vUv);
  float mask = texture2D(bodyMask, vUv).r;
  float lum = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 tinted = targetColor * lum;
  gl_FragColor.rgb = mix(texel.rgb, tinted, mask);
}
```

Zero CPU cost, supports continuous color picking, no 67MB buffer copies. The blocker is getting a mask texture authored — either per-model from the artist pipeline, or auto-generated from the HSL scan at build time.

### LOD

Not worth it for a single model on desktop, but for a gallery with 10+ cars or mobile targets, Three.js `LOD` groups would let the renderer swap between detail levels based on camera distance. Probably 3 tiers: full, 30%, 10%.

### State in the URL

`#color=cc0000&view=front&exploded=1` — shareable links with zero backend. The event system already supports this; it would just be a hashchange listener that calls the existing `setColor`, `setCameraPreset`, `explode` methods. Didn't get to it.

### Physics

Right now doors don't collide, wheels don't spin, parts don't fall. It's all canned GSAP timelines. Integrating Rapier (wasm physics) would let doors swing on actual hinge constraints and parts drop with gravity during explode. Way out of scope for this iteration but it would make a huge difference in feel.

### Mobile

The 4096×4096 atlas needs to be 2048 on mobile. The glassmorphism `backdrop-filter: blur()` is expensive on mobile compositing. Touch targets are too small. I'd also cap the pixel ratio at 1.5 instead of 2 and reduce the shadow map to 1024.

### Material Variants

Right now you can only change the paint color. Supporting matte vs. metallic vs. pearlescent finishes would mean adjusting roughness and metalness alongside the color. Two-tone paint (different roof color) would need a second mask region. The registry already supports arbitrary key-value data per part, so the data model is ready — the `MaterialSystem` just doesn't read those fields yet.

### Draco / Meshopt Compression

The GLB ships uncompressed. Draco or meshopt could reduce it by 60-80%. For a single-model demo with a loading bar it's not urgent, but for a gallery with multiple models loading on demand it would matter a lot.
