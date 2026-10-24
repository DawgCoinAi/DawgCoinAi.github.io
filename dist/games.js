// Single list of the arcade's games. Tabs, pack modes, XP disciplines, passport stamps and
// backup records are checked against it, so a new game starts here.
// kind: 'maze' (app.js maze loop), 'pack' (arcade-pack.js quick games), 'trade' (Street Hustle).
// views: camera modes the game's 3D renderer supports; the first one is the default.
export const GAMES=[
 {id:'classic',title:'Maze Munch',kind:'maze',views:['third']},
 {id:'rush',title:'60-Second Rush',kind:'maze',views:['third']},
 {id:'daily',title:'Daily Run',kind:'maze',views:['third']},
 {id:'trade',title:'Street Hustle',kind:'trade',views:[]},
 {id:'flappy',title:'Flappy DAWG',kind:'pack',views:['third']},
 {id:'cross',title:'DAWG Cross',kind:'pack',views:['third']},
 {id:'snake',title:'Neon Snake',kind:'pack',views:['third']},
 {id:'runner',title:'DAWG Dash',kind:'pack',views:['first','third']},
 {id:'story',title:'After Hours',kind:'pack',views:[]}
];
export const GAME_IDS=GAMES.map(g=>g.id);
export const PACK_IDS=GAMES.filter(g=>g.kind==='pack').map(g=>g.id);
export const gameById=id=>GAMES.find(g=>g.id===id)||null;
export const VIEWS=['third','first'];
// The camera a player chose for a game, falling back to that game's default.
export function viewFor(id,saved){const views=gameById(id)?.views||[];return views.includes(saved?.[id])?saved[id]:views[0]||'third';}
export const canSwitchView=id=>(gameById(id)?.views.length||0)>1;
