# DAWG Pocket Arcade — v10 · The GPU Edition

The complete editable game, graphics, local fonts, and tests. Nine modes, no paid services, no API keys, no npm installation, and no build step. Once Python or Node is installed, local play needs no internet connection.

## Start playing

1. Extract the **entire ZIP** into a folder. Do not launch from inside the ZIP.
2. Install **Python 3.9 or newer**, or **Node.js 18 or newer**, if neither is on your computer.
3. Launch the game:

| Computer | Launcher |
| --- | --- |
| Windows | Double-click `START_WINDOWS.bat` |
| Mac | Double-click `START_MAC.command`; if needed, open Terminal in this folder and run `sh START_MAC.command` |
| Linux | Open a terminal in this folder and run `sh START_LINUX.sh` |

The launcher opens **http://localhost:8787/**. If a browser does not open automatically, paste that address into it. Keep the terminal window open while playing; press Ctrl+C to stop the server.

You can also start it directly from this folder:

```sh
python3 start.py
```

On Windows use `py -3 start.py` or `python start.py`. The Node alternative is:

```sh
node start.mjs
```

`npm start` runs the same Node launcher. No `npm install` is needed.

Do not double-click `dist/index.html`: browsers restrict JavaScript modules opened as local files. Use a launcher so the game runs through localhost.

## Play on your phone

Connect your phone and computer to the same Wi-Fi. Start with LAN access:

```sh
python3 start.py --lan
# Or: node start.mjs --lan
```

Open the printed **Phone/tablet** address on your phone. Keep the computer running. A firewall may ask you to allow the launcher on your private network. `--lan` exposes only the game folder to your local network; the default launcher accepts connections from your computer only. No public hosting is required. Touch controls, swipe input, portrait/landscape layouts, safe-area sizing, and interruption pauses are included.

## Nine ways to play

| Mode | Goal / controls |
| --- | --- |
| Maze Munch | Collect every coin, evade rivals, use power treats and dash. Arrow keys / WASD, Shift / E to dash; thumbstick or D-pad on phones. |
| 60-Second Rush | Score as much as possible in one active minute. Same maze controls. |
| Daily Run | A seeded maze challenge changes with your device's local date. Earn three medal tiers. |
| Street Hustle | A fictional Drug Wars-inspired trading game. Buy low, travel, sell, manage heat, repay debt, use the bank, and cash out by night 30. |
| Flappy DAWG | Tap the sky / FLAP, Space, or Up. Clear towers and earn perfect-center bonuses. |
| DAWG Cross | Tap to hop forward, swipe, use the D-pad, or arrow keys / WASD. Avoid traffic and ride floating decks. |
| DAWG Dash — new | Three-lane runner. Left/right changes lanes, Up / Space jumps, Down slides. Swipe and direction buttons work on phones. Collect gold, shields, and magnets. |
| Neon Snake | Swipe, use the D-pad, or arrow keys / WASD. Collect gold, grow your tail, and plan an escape route. |
| After Hours | An original point-and-click comedy adventure: five locations, inventory puzzles, hints, and three endings. |

Press **P** or the pause button during arcade play. Quick games use a countdown on start/resume. Sound is optional and generated locally. The locker contains earned cosmetic palettes; there are no purchases or real-money mechanics.

## Saves and moving progress

Progress is saved in your browser on this device. Maze checkpoints, unfinished Street Hustle campaigns, and adventure progress resume. Flappy, Cross, Snake, and Dash save every two active seconds and when paused or leaving the page. Interrupted runs resume paused. An abrupt device crash can lose the last few seconds. Completed runs keep their records. Daily maze checkpoints expire when the local date changes.

Use **? Help → CONTROLS & SAVE BACKUPS → EXPORT / IMPORT PROGRESS** (or open game settings) to export a JSON save. Open the same controls in the other copy of the game and import it. Review the replacement prompt before restoring. Export your current progress first if you want to keep both. Imports are validated and include records, cosmetics, preferences, campaigns, and unfinished runs.

Your hosted game and localhost have separate browser storage. Different browsers, devices, ports, `localhost` versus `127.0.0.1`, and LAN addresses also have separate saves. Use export/import to transfer progress. Clearing browser data removes local saves, so keep a backup file.

## New in v10 — The GPU Edition

- **Three.js Atelier:** open **MY DAWG → Fashion / 3D**. Drag to rotate, zoom, choose Neon nights / Gallery softbox / Golden hour, or preview Idle, Walk and Run. Full mode enables shadows; Light / battery lowers resolution and disables shadows. The 3D canvas falls back to the original software studio if WebGL2 cannot start or its context is lost.
- **Shared animated DAWG:** smoother geometry, PBR metals and satin, woven textile normals, a 12-bone skeleton and five skinned meshes (torso, two sleeves, two trouser legs). Accessories follow rigid joints. The asset is generated in code; no artist-authored Blender master or facial/cloth simulation is included.
- **PixiJS 8 Dash:** GPU sprites, layered parallax buildings, neon signs, reflections, seeded rain and pooled gold/power effects. The equipped 3D DAWG is rendered to a reusable 12-frame back-view run atlas. While it loads, the renderer uses the matching 2D character. If the GPU path fails, Dash resumes Canvas presentation with its same run state.
- **Portable fashion exports:** download the modern skinned GLB with embedded normal texture and three looping animation clips, an 8-view turntable (4 × 2), a 12-frame run atlas (4 × 3, 25 fps), a studio PNG and a seed receipt. Export atlas frames are 256 × 320 pixels each. The 3D run-atlas export needs WebGL2; the turntable retains a software fallback.
- **Offline libraries:** pinned Three.js 0.186.1 and PixiJS 8.22.0 are bundled in `dist/vendor/`, with licenses. Local play does not fetch a CDN. They are loaded on demand by the upgraded experiences. Game time, collisions, RNG, save state and rewards continue to use the existing engines.

## Retained from v9 — Appearance and fashion

Appearance is the sixth attribute, with unlocks at 5 / 10 / 15 / 20 / 25 and a cap of 25. The wardrobe has 88 choices across 14 categories and three independent dyes. Keep three named outfit slots, restore the birth look, or use a deterministic SHA-256 style shuffle. Preview locked pieces; train Appearance to equip/export them. The local league sorts by Flex, Circuit Points or level. Cosmetic changes preserve identity and game abilities; paused runs retain their original stat snapshot.

New DAWGs use cryptographically random 128-bit identities with versioned SHA-256-derived genomes. The public hash does not add entropy or prove ownership. Legacy DAWGs keep their original traits, DNA, XP and training. The other eight games retain their matching vector 2D artwork.

See `FASHION_AND_3D.md` for seed and asset contracts and `GRAPHICS_PIPELINE.md` for the rendering architecture, Blender handoff and verification limits. Sample GLB, character JSON, reference turntable and seed receipt are in `dist/assets/atelier/`.

## Retained from v8 — Origin Collection

Open **MY DAWG** below the banner. Your first procedural DAWG is created automatically. Use **Discover** to browse more, name a favorite, and adopt it. The active DAWG plays your next fresh run; unfinished runs stay with the DAWG that started them.

- **Permanent DNA and full-body art:** each character has a cryptographically random 128-bit identity. Deterministic coat, marking, outfit, hat, eyewear, accessory, body shape, color, and crest layers render from that DNA. The complete DNA also determines sixteen colored crest stitches. Character appearance does not reroll on reload or level-up. A signature aura unlocks at level 10; crest stars unlock at level 25.
- **Trainable careers:** 3 starter training points, 2 more per level, and a level-50 cap. Train Agility, Focus, Nerve, Hustle, Charm, and Appearance to a maximum of 25 each. Traits and rarity are cosmetic; every DAWG starts with seven total base attribute points, including a one-point affinity. You choose where training goes.
- **Real game benefits:** Agility improves maze dash recharge and Flappy perfect-center scoring; Focus extends maze beast mode and Dash magnets; Nerve extends Cross idle time and Snake thinking time; Hustle adds cash at the start of a new campaign; Charm improves new trading orders and story XP. Benefits are modest and capped. Daily Run always uses its standard rules. Existing campaigns get benefits when the character first binds, but starting cash is only added to a fresh campaign.
- **Frozen run ownership:** character identity and training snapshot are locked to a run. Changing your active DAWG or training another build does not redirect a paused run’s XP or alter its abilities. Resuming restores the same benefits. Each completed session credits its character once.
- **Circuit league:** a leaderboard of the DAWGs in this browser’s kennel, with per-game normalized bests and career levels. Nine games can contribute 1,000 circuit points each. Repeated plays improve bests rather than stacking leaderboard points. Rank progression is New Blood → Street Regular → Circuit Pro → Night Legend → Hall of Fame. This is a local league, not a global online leaderboard.
- **Collectible portraits and transfers:** save a PNG card, export/import a single character JSON file, or use full progress backups to move your entire kennel plus unfinished games. Duplicate character imports are rejected; importing does not overwrite an existing identity. A portrait is only a picture; use JSON for progress. Keep extra files safely if you reach the 24-character kennel limit.

This is a collectible game system, not a blockchain NFT. It does not claim exclusive digital ownership or resale value. 128-bit IDs make accidental collisions extraordinarily unlikely, and local duplicates are rejected, but finite procedural traits cannot promise literally infinite appearances. Copies of a character file keep the same identity; local files are editable and are not verified competition results. A shared online collection/leaderboard is a future server-backed phase, described in `CHARACTER_SYSTEM.md`.

Your previous arcade records, rep, and cosmetics remain. Character-specific careers start with new completed runs after this update; earlier records are not silently attributed to a new character.

## Retained from v7 — Night Runner

- **DAWG Dash:** a ninth game with a perspective city course, crates to jump, arches to slide under, roadblocks to dodge, shields, and 10-second magnets. Generated rows always leave a clear lane. The run, power timers, obstacle patterns, and random state save with your other games.
- **Arcade passport:** nine permanent stamps for completing each game’s score target. Each stamp earns 100 street rep once; collecting all nine earns 300 more. Existing records count. There is no daily streak or expiry. Expand the passport below your rank to see targets and open a game.
- **City price board:** compare current price, stock, and gain/loss against your purchase cost across all five districts. Choose a good from the dropdown. Travel changes the market before you arrive; quotes are not guaranteed arrival prices.
- **Campaign upgrades:** Route Scout costs $900 and cuts encounter risk by 6 percentage points (minimum 4%); the Low-profile Kit costs $1,200 and reduces buy/sell heat by 40%; Trusted Courier costs $1,400 and raises the current open order and future order rewards by 15%. Each can be bought once per campaign, using carried game cash. Existing campaigns can buy them without restarting.
- **Adventure casebook:** copies collected clues, records important progress, and shows a next location. Follow a lead to travel there, or review it without resetting an active puzzle. Original saved chapters also get the notebook.
- Direction buttons now use the selected game’s labels, and new quick runs display their own world code.

### Included from v6 — Living City

- **Street Hustle:** five connected markets with limited stock, player-driven supply pressure, three traveling rival traders, multi-night market events, weather, local reputation, timed delivery orders, and once-per-night price tips. Street encounters offer explicit choices, costs, and risks. Resolve an encounter before buying, banking, traveling, or cashing out.
- **After Hours:** four modular story setups, shuffled cast members and venues, changing token locations, passwords and soundcheck puzzles, different social moods, an optional lost-badge favor, and varied ending details. The three ending categories remain headliner, connection, and comic flop. There is always a free hint and a recoverable route after a wrong answer.
- **Maze Munch / Rush:** connected procedural mazes, different power-treat placements and district colors. Each next level generates another layout.
- **DAWG Cross:** new roads, rivers, traffic directions, speeds, gaps, and coin positions for each new run. A safe park remains available every five rows.
- **Flappy DAWG:** varying skyline colors, gate spacing, bounded height changes, and gently moving gaps after the opening gates.
- **Neon Snake:** new stone gardens with connected open space, safe starting positions, and food placed outside obstacles.
- **Living scenes:** animated city traffic and pedestrians, rain, fog, drifting lights, scene palettes, and matching adventure props. Low effects and reduced-motion settings stop decorative animation.

### Fresh worlds, consistent saves

Choose **Play again / Restart run**, **Start new hustle**, or **New episode** for fresh content. Visiting another mode or resuming a saved game keeps the same world. Seeds and random state travel with exported backups, so a reload does not reroll a pending market encounter or change an unfinished puzzle.

**Daily Run intentionally repeats within the same local date** so daily scores remain comparable. Generated combinations make repeat play more varied, but finite scenery pieces, plot structures, and dialogue can recur; this is not unlimited AI-generated content and requires no AI service.

Existing saves remain supported. Old trading campaigns keep their balances and inventory while gaining the living economy. Old maze and quick-game saves finish on their original layouts; new runs generate fresh worlds. An old adventure chapter stays intact until you choose **New episode**. Your records and unlocked cosmetics stay saved.

Orders pay the displayed total reward and consume the requested goods. Check the destination, deadline, travel time, purchase cost, and risk before accepting the opportunity. Rival moves and prices change only when you travel, so you can plan without a real-time countdown. Inventory charts show prices at your last visited markets, not a forecast.

## Editing the code

The delivered runtime is already built. If you change library versions, run `npm ci` followed by `npm run build:graphics` to regenerate the committed vendor bundles and notices. This developer step needs network access; playing does not. Run `npm run validate:assets` after `npm ci` to check twelve wardrobe variants with the official Khronos validator. `npm test` itself uses only Node and the included bundles.


Application source remains readable native JavaScript modules. The third-party libraries are minified offline vendor bundles. Edit an application file and refresh your browser. Servers send `Cache-Control: no-store` during local use.

| File | Purpose |
| --- | --- |
| `dist/index.html` | Game hub, panels, dialogs |
| `dist/app.js` | UI, sound, records, progression, shared game loop |
| `dist/dawg-genome.js` / `dawg-fashion*.js` | SHA-256 seeds, editable looks, fashion tiers and Flex |
| `dist/dawg-model.js` / `dawg-showroom.js` | Procedural 3D meshes, GLB export, showroom and transparent atlas |
| `dist/dawg-atelier.js` / `dawg-atelier.css` | Wardrobe controls, presets and asset downloads |
| `scripts/export-dawg.mjs` | Offline CLI export of a character JSON file to GLB |
| `FASHION_AND_3D.md` | Fashion rules, crypto derivation and 3D asset contract |
| `dist/dawg-career.js` | DNA, validated character saves, training, run ownership, XP and rankings |
| `dist/dawg-art.js` | Procedural full-body artwork, cached game sprites, collectible PNG cards |
| `dist/dawg-kennel.js` / `dawg-kennel.css` | Creator, roster, training, league and transfer UI |
| `CHARACTER_SYSTEM.md` | Career rules, rating targets, architectural scope and future online phase |
| `dist/engine.js` / `renderer.js` | Maze and trading rules / maze graphics |
| `dist/pack-engine.js` / `snake-engine.js` / `runner-engine.js` | Flappy, Cross, Snake, and Dash rules |
| `dist/unlocks.js` / `arcade-account.css` | Play walls: XP, levels, play time, streaks, challenges, unlock rules and the wall/account dialogs |
| `dist/cloud.js` / `cloud-config.js` | Guest-first Supabase cloud saves and run uploads (see SUPABASE_SETUP.md) |
| `dist/games.js` | Game registry: ids, kinds and supported camera views |
| `dist/three-kit.js` | Shared 3D toolkit used by the 3D games |
| `dist/turbo-engine.js` / `turbo-3d.js` | Turbo Pup: seeded momentum platformer (loops, kickers, springs, bots) and its 3D track with side and chase cameras |
| `dist/rankings.js` | Rankings, global stats, friends and challenge links |
| `dist/curveballs.js` / `difficulty.js` | Announced curveball modes; the shared heat difficulty curve |
| `dist/dash-3d.js` / `dash-3d.css` / `dash-audio.js` | Full-screen 3D Dash city, HUD and synthesized soundtrack |
| `dist/runner-renderer.js` / `dash-presentation.js` | Canvas compatibility / PixiJS Dash fallback |
| `dist/dawg-graphics-model.js` / `dawg-gpu.js` / `dawg-normal-map.js` | Shared skinned asset / Three.js studio and atlases / embedded textile PNG |
| `scripts/build-graphics.mjs` / `dist/vendor/` | Reproducible library bundling and licenses |
| `dist/passport.js` / `story-journal.js` | Passport rewards / adventure casebook |
| `dist/arcade-pack.js` / `pack-renderer.js` | Quick-game controller and artwork |
| `dist/story-engine.js` / `living-story.js` | Original chapter compatibility / generated adventure episodes |
| `dist/living-trade.js` | Supply, rivals, orders, encounters, market events, save validation |
| `dist/world.js` / `living-renderer.js` | Seeded world generation / animated story and trading scenery |
| `dist/checkpoint.js` / `pack-checkpoint.js` | Validated run saves |
| `dist/progress-backup.js` | Portable progress import/export |
| `dist/mobile*.js` / `dist/*.css` | Touch input, layout, visual styles |
| `dist/assets/` | Included DAWG art, city art, and local fonts |
| `start.py` / `start.mjs` | Standard-library local servers |
| `tests/` | Automated rules, UI wiring, save, and server checks |

## Verification

Run the JavaScript suite with Node 18+:

```sh
node --test tests/*.test.mjs
```

Run the Python server checks:

```sh
python3 -B tests/test_local_server.py
```

The release passed 122 JavaScript tests and 2 Python tests. Nine graphics checks cover normalized skinning, deformed finite vertices, looping clips, asset cache keys, PNG pixels/checksums, modern embedded GLB structure, disposal, GPU-failure fallback, and Pixi sprite pooling without changing a saved simulation. Twelve generated outfits also passed the Khronos glTF Validator with zero errors and zero warnings. The earlier checks cover SHA-256 known vectors and Node crypto agreement, preserved v8 identities and sessions, all wardrobe schema bounds, locked equipment, deterministic style rolls, saved outfits, Flex ranking, GLB headers/accessors/hierarchy/animations, outward mesh winding, and 25 deterministic model exports. The app controller test also equips a dyed look, refuses locked gear, saves a fit, and sorts the Flex board. New checks cover 10,000 generated identities, deterministic traits, balanced starting attributes, level and training limits, duplicate imports, malformed saves, one-time character XP, ownership across character switches, session snapshots, all trained gameplay effects, creator controls, story/runner reward attribution, and compatibility with old backups. Coverage also includes 100 generated Dash worlds played for 90 seconds each, jump/slide collisions, power-ups, frame-rate stability, exact Dash checkpoint restoration, one-time passport rewards, campaign upgrade accounting, casebook navigation, and 300 connected generated mazes, 100 generated Snake gardens, 100 generated Cross routes, 30 Flappy worlds cleared by timed input, 100 full trading campaigns with save/restore after every night, and all three endings across 100 adventure seeds. Accounting, finite stock, encounter blocking, reward duplication, legacy saves, backup rollback, mobile sizing calculations, and HTTP delivery of modules and fonts are covered. Native Canvas artwork and the modern geometry were rendered and inspected. Actual browser WebGL/Pixi appearance, CSS layout, physical touch feel, device performance, and the Windows/Mac launcher wrappers still need testing on their actual platforms; this package was checked in Linux.

## Troubleshooting

- **Port already in use:** close an older launcher or use `python3 start.py --port 8788` / `node start.mjs --port 8788`, then open the printed address. Different ports have separate saves.
- **Nothing happens on launch:** open a terminal in the extracted folder and run the command above to see the error. Check your Python or Node installation.
- **Phone cannot connect:** use `--lan`, the computer's LAN address rather than localhost, the same Wi-Fi, and a private-network firewall allowance.
- **Blank page:** confirm you extracted every file and opened the HTTP address, not `file://`. Use a recent Chrome, Edge, Firefox, or Safari with JavaScript enabled.
- **Save unavailable:** allow browser storage and avoid private browsing. Export a backup when storage is available.
- **Reduce visual effects:** choose Low effects in settings; reduced-motion preferences are also respected.

The launchers serve static files only. No application backend, account service, cloud save, or global leaderboard is bundled. The character league is local to this browser; use export/import between devices. `--no-browser` suppresses automatic browser opening.

## Assets and notices

DAWG and city artwork is included for this project; the original supplied DAWG image is retained. Fonts are DejaVu, distributed with their notices in `dist/assets/fonts/LICENSE-DejaVu.txt`. Game rules and art are original implementations inspired by arcade genres; no original Pac-Man, Flappy Bird, Crossy Road, Drug Wars, or Leisure Suit Larry source/assets are bundled.
