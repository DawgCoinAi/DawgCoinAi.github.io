// Single list of the arcade's games. Tabs, pack modes, XP disciplines, passport stamps and
// backup records are checked against it, so a new game starts here.
// kind: 'maze' (app.js maze loop), 'pack' (arcade-pack.js quick games), 'trade' (Street Hustle).
// views: camera modes the game supports, the first being the default; '2d' is the classic flat
// top-down or side-scrolling board, drawn without 3D.
export const GAMES=[
 {id:'classic',title:'Maze Munch',kind:'maze',views:['first','third','2d']},
 {id:'rush',title:'60-Second Rush',kind:'maze',views:['first','third','2d']},
 {id:'daily',title:'Daily Run',kind:'maze',views:['first','third','2d']},
 {id:'trade',title:'Street Hustle',kind:'trade',views:[]},
 {id:'flappy',title:'Flappy DAWG',kind:'pack',views:['first','third','2d']},
 {id:'cross',title:'DAWG Cross',kind:'pack',views:['third','2d']},
 {id:'snake',title:'Neon Snake',kind:'pack',views:['first','third','2d']},
 {id:'runner',title:'DAWG Dash',kind:'pack',views:['first','third','2d']},
 {id:'turbo',title:'Turbo Pup',kind:'pack',views:['first','third','2d']},
 {id:'pinball',title:'Neon Pinball',kind:'pack',views:['third','first','2d']},
 {id:'kart',title:'Drift Dawgs',kind:'pack',views:['third','first','2d']},
 {id:'story',title:'After Hours',kind:'pack',views:[]},
 {id:'chess',title:'DAWG Chess',kind:'pack',views:[]},
 {id:'climb',title:'Don’t Look Down',kind:'pack',views:['third','2d']},
 {id:'heist',title:'Echo Heist',kind:'pack',views:['third','2d']},
 {id:'domino',title:'Domino Dynasty',kind:'pack',views:['third','2d']},
 {id:'paint',title:'Paint the Town',kind:'pack',views:['third','2d']},
 {id:'bark',title:'Last Bark Standing',kind:'pack',views:['third','2d']}
];
export const GAME_IDS=GAMES.map(g=>g.id);
export const PACK_IDS=GAMES.filter(g=>g.kind==='pack').map(g=>g.id);
export const gameById=id=>GAMES.find(g=>g.id===id)||null;
export const VIEWS=['third','first','2d'];
export const VIEW_LABEL={first:'1P',third:'3P','2d':'2D'};
const VIEW_NAME={first:'first-person',third:'third-person','2d':'2D'};
// The next camera in a game's list, for the view button and the V key.
export function nextView(id,saved){const views=gameById(id)?.views||[],now=viewFor(id,saved);return views[(views.indexOf(now)+1)%views.length]||now;}
export const viewAria=(id,saved)=>`View: ${VIEW_NAME[viewFor(id,saved)]}. Switch to ${VIEW_NAME[nextView(id,saved)]}`;
// The camera a player chose for a game, falling back to that game's default.
export function viewFor(id,saved){const views=gameById(id)?.views||[];return views.includes(saved?.[id])?saved[id]:views[0]||'third';}
// First-person grid games steer relative to where the player faces: ← / → turn, ↑ forward, ↓ about-face.
const TURN_LEFT={up:'left',left:'down',down:'right',right:'up'},TURN_RIGHT={up:'right',right:'down',down:'left',left:'up'},TURN_BACK={up:'down',down:'up',left:'right',right:'left'};
export function relativeTurn(facing,input){const f=TURN_BACK[facing]?facing:'up';return input==='left'?TURN_LEFT[f]:input==='right'?TURN_RIGHT[f]:input==='down'?TURN_BACK[f]:input==='up'?f:input;}
export const canSwitchView=id=>(gameById(id)?.views.length||0)>1;
