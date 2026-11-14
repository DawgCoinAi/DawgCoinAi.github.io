// The game sheet: a product page for one game. A live demo of the game playing itself, the hook,
// how to play in three lines, your best and medals, the feats you have collected, the top of this
// week’s board, and Play / Challenge a friend, or exactly what it takes to unlock.
import {gameById} from './games.js';
import {BLURBS,HOOKS,BADGES,genresOf,posterOf,fmt} from './shell.js';
import {medalState} from './results.js';

const $=id=>document.getElementById(id);
export const HOW={
 classic:['Steer with arrows, WASD, a swipe or the D-pad; turn early and the DAWG takes the corner with a burst','Eat every treat without a gap to build a chain; power treats turn the rivals blue','Dash (Shift or E) straight through a rival to tackle it; each stage adds a new twist'],
 rush:['Sixty seconds on the clock: keep moving to build a ×5 multiplier','Every 30-treat chain and every catch adds time; a hit costs 150 and the multiplier','The last ten seconds pay double'],
 daily:['One maze and one twist for everyone today','Your first run is the one that scores; clear the maze inside 90 seconds for a time bonus','Later runs are practice, and a new twist arrives tomorrow'],
 trade:['Buy low in one district, sell high in another','Every trip is a night: 30 nights to cash out','Talk to your contact and handle whoever stops you'],
 flappy:['Tap or Space to burn the jet; swipe down or ↓ to dive','Dive through a gate for a bonus, ride thermals, pull the gold lines','Three gold rings in a row earn a shield; a new sky every 8 gates'],
 cross:['Tap or swipe to hop; arrows work too','Dodge traffic, ride the floating decks','Stay ahead of the blackout; gold and close calls pay extra'],
 snake:['Swipe or use arrows to turn; hold Space or BOOST for speed','Every 5 gold opens a new arena: warping edges, rival riders, closing walls','Trap rivals for 100+, grab power-ups, chain direct lines to smash a crystal'],
 runner:['← → change lanes','↑ jump crates, ↓ slide under arches','Grab gold and power-ups as the city speeds up'],
 turbo:['← → or swipe to change lane; tap or ↑ to jump, ↑ again in the air to flip','↓ rolls under bars and through bots; hold Space (or the screen) to burn turbo','The clock refills only at checkpoints: stay fast, chain tricks, take the high road'],
 pinball:['Hold ← → (or each side of the screen) to flip; hold ↓ or the right side and let go to plunge','Shoot the Dawg House scoop to start a mode, then follow the flashing arrows','Chain ramps and orbits for combos, lock 3 balls for multiball, beat all 5 modes for Top Dawg'],
 kart:['Hold ← → to steer, ↓ to drift','Hit a control as the lights go green','Drift for mini-turbos, ↑ fires your item'],
 fight:['Keys: WASD move · J light · K heavy · L special · I guard. On a phone: stick on the left, four buttons on the right','Chain LIGHT, LIGHT, LIGHT, cancel into a special (a direction + SPECIAL), launch with ↓ + HEAVY and juggle','Win the last round and the announcer says SEND ’EM HOME: hold a direction and press SPECIAL for a finishing move','Finishers are collected in your gallery and can be posted to DAWG Chat'],
 nemesis:['One step a beat (swipe or arrows), or stay put. Get off the glowing tiles before the beat lands','It learns what you do in each situation. When the eye turns red it is firing an unmarked shot where it expects you: don’t do the usual','Dodging a guess is an OUTSMART (multiplier up). Gold bones are bait, and some are rigged'],
 bark:['Drag anywhere (or arrows / WASD) to move around the roof','Hold BARK (or Space) to charge, let go to blast everyone in front of you; a full charge is a MEGA bark','Grab the golden bone for an instant MEGA bark. The roof shrinks for 90 seconds; last one standing wins'],
 paint:['Your DAWG never stops; steer with arrows, WASD or a swipe, and dash with Space or a tap','Leave your paint to lay a wet trail, loop back and everything inside floods: circle a building or a landmark and it is yours','Cross an open trail to cut its owner; grab paint bombs and shields; the last 30 seconds pay double'],
 domino:['Drag a piece from the tray into the room: it clicks into the nearest spot that fits and a dotted line shows what it will do. Drag it again to move it, or back to the tray to take it out','Press GO (or G) to run the chain. Test runs are free: the golden bone has to end up in the bin','Three stars a room: bin the bone, use par pieces or fewer, and do it first try. Tap the room number to jump to any room you have reached; share codes replay a solution'],
 heist:['Each 30-second loop you play one more crew member; earlier loops replay exactly','Stand on plates to hold doors open and on switches to kill lasers; guards see what’s in front of them','Get every prize to the van. In position? END LOOP. Bad take? RETAKE, or UNDO the last crew member'],
 climb:['Hold anywhere (or ↑ / Space) to grab the nearest hook and reel in','Let go to fly; hold ← / → (or slide your thumb sideways) to pump the swing. The white ring marks the hook you’ll grab','Rusty hooks snap, slick ones slide, green springs launch you. Don’t look down'],
 chess:['Tap a piece, then tap where it goes','Every capture is a fight scene: tap to skip, or set battles to quick or off','Beat a rival to unlock the next; each has its own opening','Daily puzzle: one forced mate, the same for everyone'],
 story:['Pick a verb, then tap a glowing spot','Or type commands like “use comb on mirror”','Six endings to find before sunrise']
};

// Where each game's FEATS list lives. Static import() calls so the deploy bundle can follow them;
// a game without an entry simply shows no feats row.
const FEAT_SOURCES={
 classic:()=>import('./engine.js'),rush:()=>import('./engine.js'),daily:()=>import('./engine.js'),
 bark:()=>import('./bark-engine.js'),climb:()=>import('./climb-engine.js'),domino:()=>import('./domino-engine.js'),heist:()=>import('./heist-engine.js'),
 kart:()=>import('./kart-engine.js'),nemesis:()=>import('./nemesis-engine.js'),fight:()=>import('./fight-engine.js'),paint:()=>import('./paint-engine.js'),pinball:()=>import('./pinball-engine.js'),
 snake:()=>import('./snake-engine.js'),turbo:()=>import('./turbo-engine.js')
};
// A game's feats: [{id,name,text}], or [] when its engine has none.
export async function featsOf(id){try{const m=await FEAT_SOURCES[id]?.();return (m?.FEATS||[]).filter(f=>f&&typeof f.id==='string'&&f.id.startsWith(id+'.')).map(f=>({id:f.id,name:f.name||f.id,text:f.text||''}));}catch{return [];}}
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const MEDAL_NAMES=['BRONZE','SILVER','GOLD'];

export class GameSheet {
 // io: {best(id), wall(id), play(id), board(id), demo(host,id) → {dispose}} and, optionally,
 // challenge(id), medals(id) → [bronze,silver,gold], feats() → collected ids, social(id) → {rank,friend},
 // top(id) → {rows,mine}, avatar(dawg,size) → canvas.
 constructor(io){this.io=io;this.demo=null;this.id=null;
  $('sheetPlay').onclick=()=>{const id=this.id;this.close();if(this.io.wall(id).open)this.io.play(id);};
  $('sheetBoard').onclick=()=>{const id=this.id;this.close();this.io.board(id);};
  $('sheetChallenge').onclick=()=>{const id=this.id;this.close();this.io.challenge?.(id);};
  // The close event arrives a tick late; a sheet reopened in that tick keeps its new demo.
  $('gameSheet').addEventListener('close',()=>{if(!$('gameSheet').open)this.stopDemo();});}
 open(id){const g=gameById(id);if(!g)return;this.id=id;const wall=this.io.wall(id),best=this.io.best(id),locked=!wall.open,sheet=$('gameSheet');
  $('sheetTitle').textContent=g.title;$('sheetDesc').textContent=BLURBS[id]||'';$('sheetHook').textContent=HOOKS[id]||'';
  $('sheetTag').textContent=[locked?'LOCKED':BADGES[id],...genresOf(id).map(x=>x.toUpperCase())].filter(Boolean).join(' · ');
  $('sheetHow').replaceChildren(...(HOW[id]||[]).map(t=>el('li','',t)));
  $('sheetBest').textContent=best?(id==='trade'?'$':'')+fmt(best):'—';$('sheetRank').textContent='—';$('sheetStatus').textContent=locked?'LOCKED':'UNLOCKED';
  sheet.classList.toggle('locked',locked);
  $('sheetWall').hidden=!locked;$('sheetWall').replaceChildren(...(locked?[el('h3','','Unlock it: any one of these opens it'),...(wall.routes||[]).map(r=>{const row=el('div','sheet-route'+(r.done?' done':''));const bar=el('i');bar.style.setProperty?.('--p',String(Math.min(1,r.have/Math.max(1,r.need))));row.append(el('span','',r.label),bar,el('small','',r.done?'Done':r.left));return row;})]:[]));
  $('sheetPlay').disabled=locked;$('sheetPlay').textContent=locked?'LOCKED':id==='trade'||id==='story'||id==='chess'?'CONTINUE':'PLAY NOW';
  $('sheetChallenge').hidden=locked||id==='story'||!this.io.challenge;
  $('sheetDemo').style.setProperty?.('--poster',`url(${posterOf(id)})`);
  this.medals(id,best);this.feats(id);this.social(id);
  if(!sheet.open)sheet.showModal?.();sheet.scrollTop=0;this.startDemo(id);}
 // Medal progress against the game's three targets.
 medals(id,best){const host=$('sheetMedals'),next=$('sheetNext');let targets=[];try{targets=this.io.medals?.(id)||[];}catch{}const m=medalState(best||0,targets),story=id==='story'||id==='trade'||id==='chess';
  host.hidden=next.hidden=story||!m.targets.length;if(host.hidden)return;
  host.replaceChildren(...m.targets.map((t,i)=>{const d=el('div','medal '+MEDAL_NAMES[i].toLowerCase()+(i<m.earned?' earned':''));d.append(el('i'),el('b','',MEDAL_NAMES[i]),el('small','',fmt(t)));return d;}));
  next.textContent=m.next?`${fmt(m.toNext)} more for ${MEDAL_NAMES[m.earned].toLowerCase()}`:'Every medal earned. Now chase the board.';}
 // Feats collected for this game, when its engine lists them.
 async feats(id){const host=$('sheetFeats');host.hidden=true;host.replaceChildren?.();const all=await featsOf(id);if(this.id!==id||!all.length)return;let got=[];try{got=this.io.feats?.()||[];}catch{}const have=all.filter(f=>got.includes(f.id)).length;
  const head=el('h3','','Feats ');head.append(el('small','',have+' / '+all.length));const list=el('ul','feat-list');
  list.append(...all.map(f=>{const li=el('li',got.includes(f.id)?'got':'');li.title=f.text;li.append(el('b','',f.name),el('span','',f.text));return li;}));host.replaceChildren(head,list);host.hidden=false;}
 // This week's top three and where you and your friends stand. Quietly absent when offline.
 async social(id){const list=$('sheetTop'),friend=$('sheetFriend');friend.textContent='';list.replaceChildren(el('li','skeleton'),el('li','skeleton'),el('li','skeleton'));
  const [top,mine]=await Promise.all([Promise.resolve(this.io.top?.(id)).catch(()=>null),Promise.resolve(this.io.social?.(id)).catch(()=>null)]);if(this.id!==id)return;
  if(mine){$('sheetRank').textContent=mine.rank||'—';friend.textContent=mine.friend&&mine.friend!=='Add friends'?'Top friend: '+mine.friend:'Add a friend to see their best here.';}
  if(!top){list.replaceChildren(el('li','sheet-empty','The boards are out of reach right now. Your runs still count on this device.'));return;}
  if(!top.rows.length){list.replaceChildren(el('li','sheet-empty','No runs this week yet. The top spot is yours for the taking.'));return;}
  list.replaceChildren(...top.rows.map((r,i)=>{const li=el('li','sheet-rank'+(r.is_me?' me':''));const face=this.io.avatar?.(r.avatar,32);li.append(el('span','place','#'+(r.place||i+1)));if(face)li.append(face);li.append(el('span','who',r.player+(r.is_me?' (you)':'')),el('b','',fmt(r.score)));return li;}));}
 startDemo(id){this.stopDemo();const host=$('sheetDemo'),still=id==='story'||id==='trade'||id==='chess';host.classList.toggle('is-poster',still);$('gameSheet').classList.toggle('no-demo',still);if(still)return;
  this.demo=this.io.demo(host,id);}
 stopDemo(){try{this.demo?.dispose();}catch{}this.demo=null;}
 close(){this.stopDemo();if($('gameSheet').open)$('gameSheet').close();}
}
