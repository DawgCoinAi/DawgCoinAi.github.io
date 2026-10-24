# DAWG character system — v9 update

See `FASHION_AND_3D.md` for the current cryptographic genome, editable wardrobe, Appearance attribute, Flex rules and 3D export contract. V8 genomes remain supported without rerolling.

## Retained career design

## The player journey

1. **Find your DAWG.** A starter is created automatically. Discover new DNA rolls, inspect their full-body appearance, name a favorite, and adopt it into one of 24 kennel slots. You can browse unlimited candidate rolls without buying anything.
2. **Choose a build.** Every character has seven starting attribute points: one in each of six attributes and one extra in its DNA-derived affinity among the original five gameplay attributes. Three training points are immediately available. Rarity affects visuals, never a larger starting power budget.
3. **Play the circuit.** Your active character starts new runs across all nine games. A paused game retains its original character and trained attribute snapshot. Complete runs to earn XP and personal records.
4. **Grow for the long term.** Gain two training points per level, unlock the aura at level 10 and signature stars at level 25, and work toward level 50. Training is capped at 25 per attribute; the lifetime point budget encourages specialized builds.
5. **Build a complete legend.** Work across nine disciplines to reach 9,000 Circuit Points. Training level and circuit skill are separate: repeatedly farming one game cannot fill the whole circuit rating. There is no login streak, decay, paid advantage, or expiry.

## Identity and graphics

`crypto.getRandomValues` produces 16 bytes (128 bits) for each character ID. The ID is the permanent DNA. V1 characters retain their original mapping; new v2 characters derive a domain-separated SHA-256 root and trait bytes. The birth genome deterministically derives coat, marking, outfit, headwear, eyewear, accessory, hues, proportions, ears, tail, affinity, and cosmetic rarity. A sixteen-stitch crest maps each birth-trait byte to a distinct RGB color. Full-body art uses vector Canvas drawing; gameplay caches up to 32 small sprites to avoid regenerating all paths each frame. No external image/model service, token mint, or wallet is called during play. User-editable wardrobe layers are separate from birth DNA; the original DNA crest remains.

The ID space is enormous but finite. Local adoption/import rejects an ID already in the kennel. Independent devices do not consult a shared registry; this release cannot guarantee a global uniqueness registry or exclusive ownership. Similar-looking trait combinations are possible. Character file copies intentionally retain their identity.

Cosmetic rarity is derived from one DNA byte: Mythic 3/256, Rare 20/256, Standout 59/256, Streetborn 174/256. Names are editable and not unique identifiers. Rarity grants no extra XP, stats, currency, or probability advantage.

## Training effects

For a stat `s`, strength is `(s - 1) / 24`, clamped between 0 and 1. The DNA affinity starts at stat 2; all others start at 1. Benefits apply from the run’s saved attribute snapshot. Daily Run overrides all benefits to zero.

| Attribute | Effect at 25 |
| --- | --- |
| Agility | Maze/Rush dash recharge 6 → 4.8 seconds; Flappy perfect-center tolerance 27 → 39 pixels |
| Focus | Maze/Rush beast mode 7 → 9 seconds; Dash magnet 10 → 14 active seconds |
| Nerve | Cross idle deadline 15 → 20 seconds; Snake movement interval is 10% longer |
| Hustle | +$400 carried cash only at the start of a fresh trading campaign |
| Charm | New contact order rewards +10%; completed story XP +20% |
| Appearance | Advanced wardrobe tiers unlock at 5, 10, 15, 20 and 25; contributes to Flex, not game scores |

New trading campaigns also apply the order bonus to their initial contract. Existing campaigns retain their already quoted contract and starting balances; newly offered contracts use their bound character's Charm. Existing campaign upgrades remain separate and keep their documented effects.

## XP and growth

`XP(level) = 120 × (level − 1) + 30 × (level − 1)²` is the cumulative threshold, through level 50 (77,910 XP). Training points available are `3 + 2 × (level − 1) − spent`.

A positive completed result earns `20 + floor(180 × min(score / target, 1))` base XP. First reaching 25% of a game's target awards a 75-XP mastery bonus once per character per game. Story then applies its saved Charm multiplier. Trading must last at least three nights to earn XP. Zero/negative outcomes award no XP. Results are clamped at the level-50 XP cap. XP is credited only on completion, not on abandoning a run.

Existing account-wide records stay separate. They are not retroactively assigned to newly created characters. A character's eight most recent completed results remain visible in its profile.

## Circuit league

Each best completed result contributes `min(1000, floor(max(score, 0) / target × 1000))`. Nine disciplines total at most 9,000 points. Trading uses final net worth. Training benefits are allowed in the career league; the Daily discipline always uses standard rules.

| Discipline | Score for 1,000 Circuit Points |
| --- | ---: |
| Maze Munch | 5,000 |
| 60-Second Rush | 3,000 |
| Daily Run | 3,000 |
| Street Hustle | $20,000 net worth |
| Flappy DAWG | 300 |
| DAWG Cross | 600 |
| Neon Snake | 600 |
| DAWG Dash | 2,500 |
| After Hours | 1,200 |

Ranks unlock at 0 (New Blood), 1,000 (Street Regular), 3,000 (Circuit Pro), 6,000 (Night Legend), and 8,500 (Hall of Fame). Circuit ties use lifetime XP, then lexical DNA order for stable display. An alternative view sorts by career level, then XP, then DNA. Neither sort changes the underlying Circuit Points.

Only actual characters in this browser's kennel appear. There are no fabricated players, traffic, online ranks, or simulated global scores.

## Save and reward integrity

`dawg-v1-kennel` contains a versioned roster, active ID, and per-mode sessions. Each session records a random session ID, immutable character ID, world identity, starting attributes, and a claimed flag. Completing a session marks it claimed and updates that character once. Reloads and selecting another DAWG do not redirect the reward. A new Daily replay explicitly creates a fresh session even though its date-based world seed stays unchanged.

Existing maze, quick-game, trading, and adventure save formats remain supported. The character record accompanies them in full backups. Single-character JSON imports validate the DNA, point budget, levels, records, bounds, and history; they reject duplicate IDs rather than silently merging or overwriting. A full save restore replaces the old save only after its existing confirmation, with rollback on a partial storage write failure.

Local storage can be edited, copied, cleared, or restored from an older backup. Session guards prevent normal UI reward duplication; they are not an anti-cheat or ownership system. Keep exported backups. Imported characters are local, unverified records. The app and portable ZIP intentionally require no server or account.

## Next online phase — deliberately not implemented in this release

The next shared-world release should add authenticated accounts, a server-side unique character registry, recoverable ownership, and cloud saves. A verified competition should use server-issued run tickets and seeds, bounded input replay or server simulation, transactional result/XP claims, rate limits, and separate standard versus trained competition rules. Use a separate board for legacy/imported sandbox characters so editable local saves cannot enter verified rankings as trusted scores.

Public seasons can then rank verified characters by a published ruleset while preserving permanent careers and cosmetics. Trades or ownership transfers would require explicit account-bound transfer rules and audit history. None of this requires a blockchain. This package contains the portable character/rule foundation; it does not pretend these server services already exist.

## Verification boundary

The release is checked with engine tests, DOM/controller doubles, native Canvas art rendering, and real local HTTP server tests in Linux. No supported browser-control plugin is available in this environment, so CSS layout and physical phone touch behavior still need a real-device test. Use the live Site or the LAN launcher for that test.
