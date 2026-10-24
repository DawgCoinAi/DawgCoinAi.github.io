# DAWG Atelier — fashion and 3D asset contract

This release makes appearance a playable progression path and delivers a real, portable 3D asset foundation. The nine arcade games remain 2D. The same equipped wardrobe drives both their 2D art and the 3D model, rather than storing an unrelated showroom picture.

## What players can do now

- Open **My DAWG → Fashion / 3D** to inspect and rotate a DAWG from any angle. Use drag, keyboard arrows, view buttons, zoom, optional auto-rotation, or the Idle / Walk / Run preview.
- Edit 14 categories: coat, markings, outfit, headwear, eyewear, neckwear, footwear, back accessory, aura, material finish, build, ears, tail and showroom pose. Their catalogues contain 88 choices. Three independent hue controls dye clothing, accents and shoes.
- Preview advanced pieces while locked. Train **Appearance**, the sixth attribute, to equip/export them. All basic items and dyes are immediately available; no purchase or wallet is involved.
- Equip a look across the 2D games, keep three named outfits per character, reset a preview, restore the birth look, or request a new SHA-256-derived style roll.
- Export a skinned 3D GLB, a transparent eight-view turntable, a twelve-frame run atlas, a studio photo, and a public look/seed receipt. The existing collectible card export also shows the equipped fit.
- Compare actual characters in the browser's kennel by **Flex**, career level or Circuit Points. This is a local league, not a live global fashion vote.

Clothing, body edits and dyes never reroll identity, XP or gameplay abilities. A paused run keeps its starting gameplay-stat snapshot, while cosmetic styling can change immediately. The permanent DNA crest continues to identify the birth genome. Appearance is a fashion attribute; it does not alter Daily Run rules or multiply arcade scores.

## Fashion progression

Appearance begins at 1 for new and legacy characters. It uses the existing training budget: 3 starter points and 2 earned per career level. The five original gameplay stats and their affinity remain unchanged. All six attributes cap at 25. No old training points or career progress are removed.

| Required Appearance | Advanced fashion examples |
| --- | --- |
| 5 | Holo trench, holo shield, platinum pendant, chunky runners, royal cape, orbit aura |
| 10 | Royal cape coat, orbit halo, cyber monocle, DAWG medallion, combat boots, jetpack, stardust aura |
| 15 | Circuit racer, cyber horns, chrome kicks, chrome material, ember aura |
| 20 | Armored bomber, legend frames, nebula collar, neon wings |
| 25 | Shock crown, hover boots, holo array, royal energy aura |

Existing career evolution cosmetics at level 10 and level 25 remain. Fashion auras and accessories add more choices alongside those earned career signatures.

Flex is clamped to 0–1,000 and calculated from `Appearance × 10 + sum(equipped item requirements) × 3 + palette harmony × 1.5 + mastery badges × 5 + saved outfit slots × 10`. The palette measure recognizes matching, analogous and complementary clothing/accent hues; it is a published game rule, not a claim to objectively judge fashion. Birth rarity is not part of the formula. A new character's base wardrobe is free regardless of its birth rarity.

Saved outfit names have 1–24 characters, and there are three slots per character. Saving over a slot explicitly replaces that slot; wearing it restores the complete look. A cosmetic preview is separate from the equipped look until **Equip** or **Wear** is selected. Locked previews cannot be equipped or exported through the studio controls. User-editable source files remain a sandbox, not an anti-cheat boundary.

## Permanent identity, versioned cryptographic seeds

New identities use `crypto.getRandomValues` for a 16-byte (128-bit) random nonce, stored as lowercase hexadecimal DNA. SHA-256 then produces a reproducible 256-bit public genome root. The hash does not create extra entropy beyond the original random identity.

The exact UTF-8 inputs are:

```text
root = SHA256("DAWG/GENOME/v2/" + DNA_HEX)
trait_bytes = SHA256("DAWG/DERIVE/v2/traits/0/" + ROOT_HEX)
wardrobe_bytes = SHA256("DAWG/DERIVE/v2/fashion/" + ROLL_NUMBER + "/" + ROOT_HEX)
```

The trait mapping is versioned. The first 16 derived trait bytes select the birth phenotype, affinity and cosmetic rarity. The wardrobe stream uses a saved, incrementing roll counter and samples only currently wearable items. It never consumes the game's physics/world RNG. Reloading or exporting a character retains the counter and reproduces the next roll.

A look has its own canonical hash:

```text
look_hash = SHA256("DAWG/LOOK/v1/" + DNA_HEX + "/" + CANONICAL_LOOK)
```

Canonical fields are serialized in `LOOK_RANGES` order as `key=value`, separated by semicolons. This distinguishes the immutable character identity from its changeable outfit. Receipts include both the root and the look hash, the complete look, the derivation version and the atlas layout.

Legacy v8 characters have no `genome` field. They keep the original v1 trait mapping exactly; this release does not migrate them by rerolling. A SHA-256 root can still be derived from their existing identity for new wardrobe rolls and look receipts. The receipt explicitly labels their legacy phenotype mapping. Five-stat saves and unfinished sessions remain valid; Appearance defaults to 1 when absent.

SHA-256 here is a public deterministic hash, not encryption, an ownership signature, a blockchain mint, or a global uniqueness registry. Duplicate IDs are rejected within a kennel. Copies retain the same identity. An online ownership and verified competition layer would need authenticated, server-backed records.

The dependency-free hash implementation is checked against the standard empty/`abc` vectors and Node's crypto implementation over varied byte, UTF-8 and multi-block inputs. References: [NIST FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final), [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

## The reusable 3D asset

`dawg-model.js` remains the wardrobe-to-parts description and software compatibility mesh. `dawg-graphics-model.js` converts it into the shared Three.js asset: smoother indexed geometry, physical materials, explicit tangent attributes and one skeleton. It includes five normalized skinned meshes (torso, sleeves and trousers) and twelve bones. Shoes, paws, head and accessories follow the appropriate rigid joints. Idle, Walk and Run clips loop, including their first/last keyframes.

GLB exports include the identity/genome/look receipt as scene metadata, embedded geometry, inverse-bind matrices, skin weights, PBR materials, transparent lenses, emissive accents and an embedded textile normal-map PNG. No external texture or buffer is required. Units are meters, up is **+Y**, front is **+Z**. Skinned meshes are exported at scene roots with identity transforms; the skeleton carries their motion. Clothing normals use explicit tangents and a standard texture transform.

This is an original procedural stylized character, not an artist-sculpted production model. There are no facial blendshapes, cloth simulation, engine-specific controller or production collision rig. `scripts/blender-import-dawg.py` prepares an exported GLB as an editable Blender project on a machine with Blender installed. This environment did not have Blender, so a `.blend` master and Blender import round trip were not created or tested.

The GPU studio uses Three.js 0.186.1, ACES tone mapping, a studio reflection environment, key/fill/rim lights, a shadow-receiving plinth and three lighting presets. Full mode caps device pixel ratio at 1.5; Light uses 1 and disables shadows. Motion updates cap near 30 fps and stop while hidden. If WebGL2 is unavailable or fails, the original Canvas studio remains available. Software rendering has simpler materials and motion.

Included examples:

| File | Use |
| --- | --- |
| `dist/assets/atelier/DAWG-Atelier-Example.glb` | Modern skinned example with embedded texture and three animation clips |
| `dist/assets/atelier/DAWG-Atelier-Character.json` | Matching transferable demonstration character |
| `dist/assets/atelier/DAWG-Atelier-Turntable.png` | Eight software-rendered reference views of the smooth geometry; browser exports use GPU when available |
| `dist/assets/atelier/DAWG-Atelier-Receipt.json` | Matching demonstration seed, look and atlas layout |

Export your own character JSON from **My kennel → Export character**, then run:

```sh
node scripts/export-dawg.mjs your-character.json Your-DAWG.glb
```

No npm install is required for this CLI. It uses the bundled exporter and standard Node APIs. Add `--legacy` to generate the earlier rigid low-poly format. The CLI accepts a character transfer, not a look receipt. Browser exports use the current unlocked preview; character transfers use the equipped wardrobe.

## 3D-to-2D pipeline

The Atelier and Dash use `createDawgAsset`. On first use of an equipped look, the browser renders twelve back-facing Run frames into a transparent atlas. Pixi uploads one texture with twelve frame rectangles and reuses it for subsequent frames. No 3D scene runs during each Dash gameplay frame. Rendering jobs are serialized so atlas creation uses at most one temporary WebGL renderer. Temporary geometry, textures and contexts are released after the job.

The gameplay atlas uses 128 × 160 cells. Exported Run atlases use 256 × 320 cells in a 4-column, 3-row grid, twelve frames at 25 fps. The eight-view turntable uses 256 × 320 cells in a 4-column, 2-row grid with yaw 0°, 45°, 90°, 135°, 180°, 225°, 270° and 315°. The seed receipt describes both export layouts. Run-atlas export requires WebGL2; turntables have a software fallback. A matching vector character is visible while the GPU atlas is prepared.

Dash caches at most four outfit atlases. Keys include graphics version, DNA, genome version, equipped look hash and career evolution stage. Fashion or evolution changes invalidate the right asset; ordinary XP updates do not regenerate it. Other games retain their matching lightweight vector art and all existing game rules.

## Next fashion layers

A useful next phase is authored fashion collections: coordinated item sets, themed lookbook challenges, earned mastery patches, and designer-created pieces. Once authenticated accounts, cloud ownership and moderated content exist, creator collections and verified fashion competitions could become shared experiences. A cosmetic shop would need explicit purchase/ownership rules and a recoverable server record; gameplay stat boosts should stay separate from paid fashion. None of those shared or paid services is implemented or implied by this local release.

## Verification boundary

122 JavaScript tests and two Python tests pass. New checks cover skin weights and deformed geometry, looping clips, PNG checksums and decoded pixels, embedded GLB resources, resource disposal, Canvas recovery and bounded Pixi pooling while preserving engine snapshots. Twelve generated outfit variants passed the official Khronos glTF Validator with **zero errors and zero warnings**. This is a validation result, not a certification or proof of compatibility with every engine.

Native Canvas geometry views and presentation assets were inspected. Browser automation was unavailable, so the actual browser GPU output, physical phone touch/performance, CSS layout, context loss on a real device, Blender/engine imports and Windows/Mac launcher execution remain unverified. Use the live Site or LAN launcher to test those paths.
