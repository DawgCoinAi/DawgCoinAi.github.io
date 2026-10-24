# Graphics pipeline — v10

The upgraded vertical slice is **Atelier + DAWG Dash**. The other eight games retain the existing 2D presentation. Gameplay engines, checkpoints, character ownership and rewards remain independent of graphics.

## Components

| Component | Responsibility |
| --- | --- |
| `dawg-fashion.js` / `dawg-genome.js` | Canonical look and permanent deterministic identity |
| `dawg-model.js` | Modular part layout and software compatibility geometry |
| `dawg-graphics-model.js` | Smooth meshes, physical materials, shared skeleton, weighted garments and animation clips |
| `dawg-normal-map.js` | Deterministic textile normals, standalone PNG encoding and GLB embedding |
| `dawg-gpu.js` | Three.js studio, reflection environment, lighting presets, shadows and offscreen sprite jobs |
| `dash-presentation.js` | Pixi scene, pooled sprites, parallax, procedural scenery, effects and atlas cache |
| `dawg-showroom.js` / `pack-renderer.js` | Progressive renderer activation and Canvas recovery |
| `vendor/` | Locally bundled, pinned libraries and license notices |

Three.js 0.186.1 and PixiJS 8.22.0 are bundled by esbuild 0.28.2. Packages and transitive versions are recorded in `package-lock.json`. Runtime modules are lazy-loaded by the studio and Dash. Local play does not fetch libraries or texture services.

## Resource and timing rules

- One application loop advances gameplay. Pixi's ticker is stopped; its render method runs from the existing loop. Presentation never consumes the engine RNG or advances time.
- The studio caps motion redraws near 30 fps, stops when hidden, caps full resolution at 1.5 DPR, and offers a 1-DPR mode without shadows. Its renderer and reflection map are reused; replaced outfits dispose their meshes/materials/textures/skeleton.
- A temporary Three renderer generates an equipped character's twelve Run frames. Jobs are serialized. The renderer, environment and character resources are disposed after each completed, failed or cancelled job. Gameplay then uses a sprite sheet, rather than rendering a 3D model each frame.
- Pixi's outfit cache holds at most four atlases and protects the current entry during delayed job completion. Cache keys use graphics version, DNA, genome mapping, look hash and evolution stage. Ordinary XP changes do not rebuild artwork.
- Scene sprites are pooled and hidden/reused. Seeded rain, skyline variation and district colors are derived from world seed and simulation time. Effects stop while paused; reduced motion removes rain and extra trails/particles.
- An unavailable/lost GPU restores the existing Canvas presentation on the original input canvas. The run and saved checkpoint remain owned by the engine. A matching vector character is used while a GPU atlas is unavailable.

## Exports and artist handoff

GLB includes explicit tangents, normalized joint weights, embedded textile normals, five skinned meshes and twelve bones. Skinned nodes are scene roots with identity transforms for portable glTF skinning. Three clips include equal first/last keys. Paws, shoes, face and accessories follow rigid bones; there is no cloth or facial simulation.

Create a modern asset without installing packages:

```sh
node scripts/export-dawg.mjs dist/assets/atelier/DAWG-Atelier-Character.json My-DAWG.glb
```

On a machine with Blender 4+ installed, an optional handoff script can create an editable project:

```sh
blender --background --python scripts/blender-import-dawg.py -- My-DAWG.glb My-DAWG-Master.blend
```

The script imports geometry/skin/animations, groups the character and adds studio lights. It has not been executed here because Blender was unavailable. No `.blend` master is included. An artist can refine anatomy, fit garments, paint texture atlases, add facial shapes and optimize lower-detail variants, then export glTF from that master. Keep immutable identity and look metadata independent from the art revision.

## Rebuild and verify

```sh
npm ci
npm run build:graphics
npm test
npm run validate:assets
python3 -B tests/test_local_server.py
```

Playing and core tests use the delivered bundles; installation is for rebuilding vendors or running the development validator. The library licenses and runtime dependency notices are in `dist/vendor/`.

Release checks passed: 122 JavaScript tests, two Python tests, and twelve outfit variants checked with Khronos glTF Validator (zero errors and zero warnings). The graphics tests cover deformed vertices, joint weights, loop boundaries, texture encoding, export structure, disposal, fallback and pooled Pixi scenes without mutating checkpoints. Native Canvas checks inspect geometry and asset content.

Actual browser shader output, real device frame times, touch feel, context loss on a phone, Blender imports and platform launcher wrappers still need testing. No browser automation or GPU performance result is claimed. The next measured art pass should prioritize silhouette/face refinement, authored garment sets, atlas compression and device profiling before extending the GPU presentation to the remaining games.
