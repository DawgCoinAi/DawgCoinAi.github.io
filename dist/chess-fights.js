// DAWG Chess fight book: which little movie plays when one piece takes another. Pure data and
// helpers (no DOM, no three.js) so it can be tested: every attacker has a fighting style with two
// variants, every victim a way to brace and a way to fall, and each of the 36 pairings adds its
// own twist (how this attacker's kind of damage finishes this victim) and its own title card.
// The renderer (chess-battle.js) has one routine per id named here.
export const TYPES='pnbrqk';
export const NAMES={p:'PAWN',n:'KNIGHT',b:'BISHOP',r:'ROOK',q:'QUEEN',k:'KING'};

// How each piece attacks: its style, the kind of damage it deals, and two choreographies.
export const ATTACKERS={
 p:{style:'Shieldbearer',damage:'pierce',variants:['spear-combo','shield-bash'],victory:'spear-salute'},
 n:{style:'War hound',damage:'trample',variants:['leap-kick','lance-pass'],victory:'rear-howl'},
 b:{style:'Oracle',damage:'arcane',variants:['sigil-beam','levitation-slam'],victory:'halo'},
 r:{style:'Siege keep',damage:'crush',variants:['cannon','ground-pound'],victory:'stomp'},
 q:{style:'Blade dancer',damage:'slash',variants:['blink-dance','blade-storm'],victory:'flourish'},
 k:{style:'Sovereign',damage:'royal',variants:['executioner','royal-decree'],victory:'sword-plant'}};

// How each piece defends and how it leaves the board.
export const VICTIMS={
 p:{brace:'shield-wall',defeat:'launched'},
 n:{brace:'rear-up',defeat:'collapse'},
 b:{brace:'ward',defeat:'shatter-light'},
 r:{brace:'portcullis',defeat:'crumble'},
 q:{brace:'riposte',defeat:'last-dance'},
 k:{brace:'guard',defeat:'crown-fall'}};

// The pairing's own flavour: what this damage does to this victim on the way out.
const TWIST={
 pierce:{p:'skewer-skid',n:'spur-stagger',b:'cracked-ward',r:'breach',q:'disarm',k:'pinned-cape'},
 trample:{p:'punt-to-the-rafters',n:'spin-out',b:'bowled-over',r:'toppled-tower',q:'swept-off',k:'run-down'},
 arcane:{p:'bubble-pop',n:'hex-drop',b:'counterspell',r:'unmortared',q:'unravel',k:'dethroning-light'},
 crush:{p:'pancake-flip',n:'flattened',b:'ground-to-glitter',r:'wall-to-wall',q:'pressed-flower',k:'buried'},
 slash:{p:'spinning-top',n:'cut-reins',b:'cut-glass',r:'sliced-stone',q:'mirror-duel',k:'severed-crest'},
 royal:{p:'dismissed',n:'bowed-low',b:'excommunicated',r:'razed-by-decree',q:'abdication',k:'usurped'}};

const TITLE={
 pp:'Scrap in the Trenches',pn:'Spear Meets Stallion',pb:'Heresy!',pr:'Storming the Keep',pq:'The Upstart',pk:'Peasant Revolt',
 np:'Trampled',nn:'The Joust',nb:'Hound of Heaven',nr:'Over the Wall',nq:'Leap of Treason',nk:'Charge the Throne',
 bp:'Smite the Small',bn:'Hex the Hound',bb:'Schism',br:'Unmake the Wall',bq:'Excommunication',bk:'Divine Right Denied',
 rp:'Flattened',rn:'Cannon Fodder',rb:'Stone Sermon',rr:'Siege of Sieges',rq:'Storm the Court',rk:'Bring Down the House',
 qp:'A Quick Lesson',qn:'Cut the Reins',qb:'Blades Before Prayers',qr:'Carved Stone',qq:'Duel of Queens',qk:'Coup de Grâce',
 kp:'By Royal Decree',kn:'Heel',kb:'Silence, Priest',kr:'Raze It',kq:'A Crown Has No Equal',kk:'Only One Crown'};

/** Normalises a roll (any number, e.g. Math.random()) to a variant index. */
export function variantIndex(roll,count=2){const r=Number(roll);if(!Number.isFinite(r))return 0;return Math.abs(Math.floor(r<1&&r>=0?r*count:r))%count;}

/** The scene for attacker type `a` taking victim type `v` (lower-case letters). */
export function matchup(a,v,roll=0){const A=ATTACKERS[a],V=VICTIMS[v];if(!A||!V)return null;const attack=A.variants[variantIndex(roll,A.variants.length)];
 return {id:a+'x'+v,title:TITLE[a+v],card:NAMES[a]+' ✕ '+NAMES[v],attacker:a,victim:v,style:A.style,damage:A.damage,attack,brace:V.brace,defeat:V.defeat,twist:TWIST[A.damage][v],victory:A.victory,
  beats:['arena','brace:'+V.brace,'attack:'+attack,'twist:'+TWIST[A.damage][v],'defeat:'+V.defeat,'victory:'+A.victory]};}

// Scenes that are not plain captures.
export const SPECIALS={
 enpassant:{id:'enpassant',title:'EN PASSANT',beats:['slip-past','backstab','defeat:launched']},
 promotion:{id:'promotion',title:'PROMOTION',beats:['ascend','chrysalis','reveal','landing']},
 castleShort:{id:'castleShort',title:'CASTLES',beats:['king-vault','rook-slide','shield-dome']},
 castleLong:{id:'castleLong',title:'CASTLES LONG',beats:['king-vault','rook-long-slide','shield-dome']},
 check:{id:'check',title:'CHECK!',beats:['threat-beam','king-flinch']},
 checkmate:{id:'checkmate',title:'CHECKMATE',beats:['threat-beams','king-cornered','execution','crown-fall-slowmo','celebration']}};

// The battles setting. Old saves stored a boolean: true is full, false is off.
export const BATTLE_MODES=['full','quick','off'];
export const battleMode=v=>v===false||v==='off'?'off':v==='quick'?'quick':'full';
export const nextBattleMode=v=>BATTLE_MODES[(BATTLE_MODES.indexOf(battleMode(v))+1)%BATTLE_MODES.length];

/** Squares where what is drawn differs from the engine's board. `shown` maps square → piece letter. */
export function boardMismatch(shown,board){const bad=[];for(let s=0;s<64;s++){const want=board[s]||null,have=(shown instanceof Map?shown.get(s):shown[s])||null;if(want!==have)bad.push(s);}return bad;}

/** Which squares hold pieces giving check to the king on `kingSq`: `pseudo` is the checking side's pseudo-legal moves. */
export function checkers(pseudo,kingSq){return [...new Set((pseudo||[]).filter(m=>m.to===kingSq).map(m=>m.from))];}
