// One difficulty curve for every game. "Heat" climbs from 0 to 1 with in-run progress along
// the same straight ramp DAWG Dash has always used, and crosses a new tier at 25/50/75/100%.
// Each game decides what its progress is (meters, gates, food, rows, pellets) and how hot
// it gets at full heat. Heat derives from saved progress, so checkpoints need no new fields.
export const HEAT_TIERS=4;
export const heatOf=(progress,full)=>Math.min(1,Math.max(0,(Number(progress)||0)/full));
export const tierOf=heat=>Math.min(HEAT_TIERS,Math.floor(heat*HEAT_TIERS+1e-9));
export const ramp=(easy,hard,heat)=>easy+(hard-easy)*heat;
// Emits a {type:'heat', tier} event whenever a game crosses into a hotter tier. The last
// tier lives on an unsaved field, so a restored run resumes silently at its current tier.
export function trackHeat(game,heat){const tier=tierOf(heat);if(game._heatTier===undefined)game._heatTier=tier;else if(tier>game._heatTier){game._heatTier=tier;game.events.push({type:'heat',tier});}return tier;}
// Per-game progress needed to reach full heat; tuned so a good run maxes out in ~80–90 s.
export const heatLabel=tier=>['','HEAT 1 · PICKING UP','HEAT 2 · GETTING SPICY','HEAT 3 · RED HOT','MAX HEAT · GOOD LUCK'][Math.min(HEAT_TIERS,Math.max(0,tier))];
export const FULL_HEAT={runner:2400,turbo:2400,flappy:36,snake:32,cross:120,maze:3};
