# v10 — The GPU Edition

The Atelier now uses bundled Three.js for a lit 3D studio with shadows, textile normal maps, metallic hardware, three lighting presets and a battery mode. The shared DAWG asset has a 12-bone skeleton, five weighted garments, and looping Idle / Walk / Run animations. Export GLB, turntable or run atlases, a studio photo and a seed receipt.

DAWG Dash now uses bundled PixiJS 8 for layered city scenery, wet-road reflections, seeded rain, pooled effects and animated DAWG sprites generated from the same 3D outfit. A Canvas compatibility path keeps the arcade usable when GPU rendering is unavailable. All nine games, cryptographic identities, career growth and saves remain compatible.

Extract the ZIP and run `node start.mjs` or `python3 start.py`. **Playing requires no npm installation, CDN, wallet or API key.** Developer rebuilds use `npm ci` and `npm run build:graphics`. See **README_LOCAL.md**, **FASHION_AND_3D.md** and **GRAPHICS_PIPELINE.md**.

Verification: 122 JavaScript tests and 2 Python tests pass. Twelve generated outfit variants pass the Khronos glTF Validator with zero errors and zero warnings. Native Canvas geometry/presentation checks are included in the release review; actual browser GPU appearance, device performance and touch feel still need device testing.

---

Earlier release notes follow.

# v9 — DAWG Atelier

Appearance is now a sixth career attribute. The portable game includes an editable fashion studio with 88 choices across 14 categories, dyes, three saved outfits per DAWG, earned fashion unlocks, and a local Flex ranking. New DAWGs use versioned, domain-separated SHA-256 genomes; v8 identities and appearances are preserved.

The studio renders actual 3D meshes, supports drag rotation and Idle/Walk previews, and exports GLB models, transparent eight-view PNG atlases, and seed receipts. All nine games keep 2D gameplay and use the equipped wardrobe. No external model service, wallet, package installation, or runtime API key is needed.

Start with **README_LOCAL.md**. See **FASHION_AND_3D.md** for asset and seed contracts. The GLB is a stylized modular low-poly foundation with rigid joint animations; no skinned production rig is claimed.

---

# v8 — Origin Collection

Procedural full-body DAWGs now play across all nine modes. Permanent 128-bit DNA, a 24-slot kennel, five trainable attributes, 50 career levels, evolution cosmetics, character transfer JSON and portrait PNG exports, and a cross-game local Circuit League are included. Active runs retain their original character and training snapshot; character results credit once. Daily Run keeps standard rules.

See **README_LOCAL.md** to launch the complete offline package and **CHARACTER_SYSTEM.md** for the career/ranking model, limitations, and online phase. Existing arcade saves remain compatible. No external service or npm install is needed.

---

# V7 Night Runner — October 19, 2026

See [README_LOCAL.md](README_LOCAL.md) for the complete local setup, controls, save compatibility, and new mechanics.

The arcade now has nine modes. DAWG Dash adds a three-lane runner with procedural obstacles, a clear route through every row, jump/slide controls, shield and magnet pickups, medals, and saved runs. A nine-stamp passport rewards exploring every game, credits old records, and awards each rep bonus once.

Street Hustle gains a five-district price/stock board and three campaign upgrades for travel risk, trading heat, and courier rewards. Purchases require carried game cash, cannot repeat, and are blocked during encounters. Older campaigns migrate without losing balances or random state.

After Hours has a casebook derived from found clues and story flags, plus navigation to the next lead without completing the puzzle for the player. Quick-game controls have appropriate labels and refreshed world codes.

Validation: 83 JavaScript and 2 Python tests pass. These include 100 Dash seeds played for 90 seconds using lane inputs, touch/controller wiring, exact saves, upgrade accounting, passport reward deduplication, and the previous world/story/economy coverage. Three actual Canvas runner states were rendered and inspected. Browser CSS/device touch testing and Windows/Mac launcher wrapper execution remain unverified in this Linux environment.

---

# V6 Living City — October 18, 2026

See [README_LOCAL.md](README_LOCAL.md) for installation, controls, save migration, new mechanics, and source documentation.

Street Hustle now has five linked markets, finite stock, player supply pressure, rival traders, weather and multi-night market events, delivery contracts, reputation, and choice-based encounters. Reloading preserves random state and pending decisions. The animated trading scene reflects the current district and weather.

Maze Munch and Rush generate connected mazes. Cross varies its traffic and rivers, Snake generates connected obstacle gardens, and Flappy changes skyline colors and gate patterns with bounded moving gaps. Daily Run stays deterministic for its local date.

After Hours builds episodes from four premises and shuffled cast, locations, clues, passwords, soundchecks, moods, optional favor, and epilogues. The three ending categories remain. Authored pieces may recur; this is seeded offline content, not a promise of infinitely unique plots.

Existing saved runs and the original adventure chapter remain compatible; new runs use the new generation. Portable backups include world seeds and simulation state. The mobile banner remains fully visible.

Validation: 70 JavaScript tests and 2 Python server tests passed, including 300 mazes, 300 story completions, 100 trading campaigns, and input-driven Flappy simulation. Representative Canvas scenes were inspected. Browser layout, physical touch feel, and platform-specific Windows/Mac wrappers need device testing; this environment is Linux.

---

# V5 portable release — October 17, 2026

Start with [README_LOCAL.md](README_LOCAL.md) for local installation, controls, backups, source map, and troubleshooting.

This release adds Neon Snake (eight game modes total), validated Flappy/Cross/Snake checkpoints across refresh, progress export/import with transactional rollback and reload protection, bundled offline fonts, and Python/Node local launchers. The full mobile banner is retained without cropping. Street Hustle bookkeeping and all three adventure endings remain covered.

Validation: 56 JavaScript tests and 2 Python HTTP tests passed. The extracted source ZIP was checked independently. The Snake renderer was visually inspected using Canvas 2D. Real browser layout, device touch behavior, and Windows/Mac wrappers were not tested in this Linux environment.

The sections below describe earlier releases; the current quick games now persist across refreshes.

---

# $DAWG After Hours

A browser arcade built around the user's original DAWG artwork. Three complete modes: Maze Munch, 60-Second Rush, and Street Hustle. Responsive layout, keyboard and swipe controls, generated audio effects, device-local personal records, and autosaved Street Hustle progress.

## Run locally

Serve `dist/` with any static HTTP server (ES modules require HTTP). No build step or installed dependencies are needed. Google Fonts are optional; local fallback fonts are supplied in CSS.

## Verification

Run `npm test` or `node --test tests/*.test.mjs`. Tests cover maze reachability, legal traversal to completion, collisions, power-ups, the rush clock, market accounting, capacity and debt, day-30 settlement, save restoration, and DOM/asset references.

The original source image is at `dist/assets/dawg.jpg`. Game rules are in `dist/engine.js`; UI, controls, audio and persistence are in `dist/app.js`. Saved data uses `dawg-v1-` localStorage keys. All trade goods and prices are fictional game mechanics. No real money, wallet, accounts, or backend is required.

## Neon Nights / Volume 02

The second release adds bespoke neon-city key art and a transparent DAWG head sprite; an accelerated canvas renderer with cached glowing wall geometry and character art; animated rivals, character trails, coin particles, floating scores and power rings; a shielded dash (Shift/E, 0.68 seconds, six-second recharge); two timed gold-bag drops per maze; three cycling district layouts; street-rep progression, four cosmetic palettes and six persistent badges; focused play view; and a refreshed Street Hustle district navigation scene. Existing v1 records and trading saves remain compatible.

Reduced-motion preferences suppress screen shake, bright flash effects and decorative animation. Sound remains opt-in and now includes a quiet original synthesized game loop. No real-money or wallet features are used.

Validation: 19 automated behavioral/structure tests pass. Normal and powered-up frames were rendered with the actual renderer through a native canvas implementation and visually inspected. A full browser/device playthrough was unavailable in the build environment.

### Artwork

Both new assets were created with the built-in image-generation tool from the user's original DAWG reference. The original artwork remains at `dist/assets/dawg.jpg`.

- Final city key art: `/workspace/sites/dawg-after-hours/dist/assets/neon-city-v2.png`
- Final transparent character sprite: `/workspace/sites/dawg-after-hours/dist/assets/dawg-head-v2.png`

City prompt: “Use case: stylized-concept. Asset type: cinematic widescreen hero key art for the existing DAWG After Hours arcade game. Reference image 1 is the exact DAWG character identity: tan-and-black pug, wildly bulging huge eyes behind thick black glasses, backwards black cap, tongue hanging out to one side, chunky gold chain. Preserve this identity closely. Create a premium stylized 3D / painted game key-art scene in a rainy neon city at midnight. The DAWG head and upper chest dominates the RIGHT HALF, looking eagerly toward camera, beautifully lit by acid lime rim light on one side and violet/magenta rim light on the other. Behind him, rich dense futuristic urban arcade alleys with abstract signs, layered deep blue buildings, wet reflective asphalt, gold coins floating with subtle motion trails. LEFT HALF is mostly atmospheric dark navy-purple city silhouettes and usable negative space for HTML title text, no character there. Camera slightly low and close, dynamic, tactile fur and glossy glasses, full silhouette of cap visible. Wide landscape composition about 3:1; vivid high contrast premium indie game promotional quality. NO text, NO words, NO watermarks, no UI or frames. Make unmistakably the same funny DAWG from reference.”

Sprite prompt: “Use case: identity-preserve / stylized-concept. Asset type: transparent player head sprite and mascot for DAWG After Hours arcade. Reference image is identity: tan-and-black pug, very large bulging eyes behind thick black nerd glasses, black backwards snapback baseball cap, tongue hanging to one side, goofy energetic face. Preserve exactly these recognizable features. Produce ONE centered isolated head only, from top of backwards cap to chin, with both ears visible, no torso, no necklace, no body. High end polished 3D toon rendering with detailed but clean readable shapes, glossy glasses, exaggerated eyes, strongly legible silhouette at 48px. Slight acid-lime edge light on left and purple edge light on right, rich natural tan fur. Face looking straight at viewer, mischievous happy energy. Head occupies 88% of square frame with equal safe padding. Genuine transparent alpha background, no scenery, no circle badge, no text, no floor shadow.”

## Pocket Arcade / Volume 03

Mobile play now uses a dedicated viewport-fitted screen, rather than the page's desktop arcade layout. Play enters this view automatically on touch devices or narrow windows. The playfield and 144px control region fit together around browser chrome, notches, and bottom safe areas. Landscape puts steering and dash on opposite sides of the maze, with scores in the top bar.

Controls include a pointer-captured thumbstick with a dead zone and direction hysteresis, a 44px D-pad option, concurrent steering and dash, board swipes, left-handed layouts, optional vibration where supported, and reduced effects. Settings and screen rotation pause gameplay. A short countdown precedes each start/resume. The back control returns to the arcade and retains the paused run. A screen wake lock is requested while playing on supported mobile browsers and released on pause or exit.

Unfinished arcade runs save locally every two seconds and on pause/background/page exit. Valid snapshots restore paused, including actors, coins, power/dash state, and a daily run's random-generator state. Daily checkpoints expire when the local calendar date changes. Existing trading saves, records, badges, and rep remain compatible.

Daily Run is a fourth mode: a repeatable, date-seeded 60-second challenge with a rotating rule variant and starting district. Bronze/silver/gold targets are 800/1,600/2,800 points. Each medal grants a one-time daily rep reward (100/150/250). Results show coins, rival catches, loot bags, best-score feedback and medal progress, with replay and return controls. Scores remain personal, local records; no online leaderboard is implied.

Street Hustle now uses larger mobile market cards, 44px buy/sell and quantity controls, readable stash counts, and sticky cash/debt totals. New WebP assets reduce the two major image downloads from 5,018,008 to 3,614,346 bytes (about 28%); decoded visible pixels and alpha were checked against the retained PNG originals. The player image is prioritized for loading.

Validation: all 29 tests pass, including 15 representative portrait/landscape phone and tablet viewport calculations with safe insets, thumbstick direction handling, checkpoint restoration, daily seed/reward behavior, and consistent active-play timing at 15/30/60/120 FPS. A long stalled frame pauses instead of moving the player unseen. UI IDs and asset references were checked. Actual mobile browser/device interaction remains unverified because the supported browser-control capability is unavailable.

## V4 — The DAWG Collection

The mobile banner now uses a real, proportionally sized panorama image. The full width of the artwork remains visible; phone layouts put the headline beneath it instead of cover-cropping the character.

Three complete games join the original four modes:

- **Flappy DAWG:** tap / Space / Up to fly through neon towers. 10 points per gate, 5 for a centered pass, increasing speed, bronze/silver/gold targets, personal records, and street rep.
- **DAWG Cross:** tap, swipe, D-pad, or WASD / arrow keys to cross traffic and floating decks. Parks every five rows, one-time gold pickups, moving platforms, camera tracking, collision detection, and a 15-second idle warning/limit.
- **After Hours: A Very Important Pug:** an original point-and-click comedy chapter with five illustrated locations, named characters, contextual dialogue, usable inventory, a three-pad mixing puzzle, hints, four objectives, and three reachable endings. Wrong answers and an awkward conversation remain recoverable. Progress saves after each action; each newly discovered ending earns rep once.

Quick games use separate portrait/landscape play screens, generous controls, pause/resume countdowns, blur/visibility interruption handling, optional sound and vibration, and records in the existing device storage. In-memory quick runs survive visits to other modes, but a refresh starts a fresh Flappy/Cross run. Maze checkpoints remain saved when visiting other games; switching between different maze challenges still asks before replacing the current maze. Settings/help text describes this distinction.

### Street Hustle corrections and polish

- Night 30 rejects travel without silently ending the run; explicit cash-out performs final settlement and score recording.
- Travel risk display matches the actual post-cooling encounter probability.
- Weighted purchase-cost tracking, per-unit gain/loss, and transaction feedback make trades reviewable. Older saves retain their state and label estimated cost basis for pre-update inventory.
- Sell-all liquidates stock without ending the run and presents a confirmation. Cash-out remains a separate action.
- Strict saved-state validation, copied snapshots, non-finite quantity rejection, and idempotent final settlement protect bookkeeping.

### Verification

`node --test tests/*.test.mjs`: **49 passing tests**. Coverage includes all previous maze/daily/mobile tests; new flight/crossing rules and interruption handling; eleven quick-game viewport calculations; all three adventure endings and save restoration; controller launch/pause/back and reward-once behavior; all seven modes wired through the real app module using DOM doubles; and 2,500 randomized trade actions checking money, inventory, capacity, and settlement invariants.

The production canvas renderer was also invoked with a real Canvas 2D implementation to inspect Flappy, Cross, and adventure frames. DOM doubles do not verify CSS layout or physical touch behavior. Browser QA and real-device playtesting were unavailable in this environment, so those remain unverified. No new runtime dependencies or downloaded art are required. The new city, traffic, characters, and scene props are drawn by the game renderer, reusing the existing DAWG sprite.
