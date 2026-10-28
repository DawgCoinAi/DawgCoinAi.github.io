// The game sheet: tap a game and it opens with a live demo of the game playing itself, the
// essentials of how to play, your best, and either a big Play button or what it takes to unlock.
import {gameById} from './games.js';
import {BLURBS,posterOf,fmt} from './shell.js';

const $=id=>document.getElementById(id);
export const HOW={
 classic:['Steer with arrows, WASD, a swipe or the D-pad','Eat every pellet; power-ups turn the rivals blue','Dash (Space) to slip past a rival'],
 rush:['Sixty seconds on the clock','Coins and combos score; hits cost time','Dash (Space) through tight spots'],
 daily:['One maze for everyone today','Same seed, same twist, one shot at the best run','Comes back with a new twist tomorrow'],
 trade:['Buy low in one district, sell high in another','Every trip is a night: 30 nights to cash out','Talk to your contact and handle whoever stops you'],
 flappy:['Tap, click or Space to climb','Thread the gaps between the neon towers','Dead-centre passes score a bonus'],
 cross:['Tap or swipe to hop; arrows work too','Dodge traffic, ride the floating decks','Grab gold in the parks'],
 snake:['Swipe or use arrows to turn','Eat to grow; don’t hit yourself or the stones','In first person, ← → turn relative to your head'],
 runner:['← → change lanes','↑ jump crates, ↓ slide under arches','Grab gold and power-ups as the city speeds up'],
 turbo:['Tap or ↑ to jump; hold for height','↓ rolls, or stomps in the air; → spends turbo, which gold and tricks refill','Fly through rings and chain tricks for combos up to ×5'],
 pinball:['Hold ← → (or each side of the screen) to flip','Shoot the lit arrows: ramps and wireforms carry the ball over the table','Finish the mission (bumpers, ramps, targets, D-A-W-G) to level up'],
 kart:['Hold ← → to steer, ↓ to drift','Drift through corners to charge a mini-turbo','↑ fires your item'],
 bark:['Drag anywhere (or arrows / WASD) to move around the roof','Hold BARK (or Space) to charge, let go to blast everyone in front of you; a full charge is a MEGA bark','The roof shrinks for 90 seconds. Off the edge is out. Last one standing wins'],
 paint:['Your DAWG never stops; steer with arrows, WASD or a swipe','Leave your paint to lay a wet trail, come back to claim everything the loop encloses','Cross an open trail to cut its owner; keep yours short, since anyone can cut it'],
 domino:['Move the cursor with the arrows or a tap; tap the cursor, press Enter or DROP to place the next piece (or pick one up)','Hold DROP or Enter (or press G) to start the chain. It runs once: the golden bone has to end up in the bin','Fewer pieces and a faster chain score more; a failed chain burns a fuse. Share codes replay a solution'],
 heist:['Each 30-second loop you play one more crew member; earlier loops replay exactly','Stand on plates to hold doors open and on switches to kill lasers; guards see what’s in front of them','Get every prize to the van. Caught? That take is thrown away and you try again'],
 climb:['Hold the middle of the screen (or ↑ / Space) to grab the nearest hook and reel in','Let go to fly; hold ← / → or the screen edges to pump the swing','Rusty hooks snap, slick ones slide, green springs launch you. Don’t look down'],
 chess:['Tap a piece, then tap where it goes','Every capture plays out as a battle; tap to skip, or switch battles off','Beat a rival to unlock the next one up the ladder'],
 story:['Pick a verb, then tap a glowing spot','Or type commands like “use comb on mirror”','Six endings to find before sunrise']
};

export class GameSheet {
 // io: {best(id), wall(id), play(id), board(id), demo(host,id) → {dispose}}
 constructor(io){this.io=io;this.demo=null;this.id=null;
  $('sheetPlay').onclick=()=>{const id=this.id;this.close();if(this.io.wall(id).open)this.io.play(id);};
  $('sheetBoard').onclick=()=>{const id=this.id;this.close();this.io.board(id);};
  // The close event arrives a tick late; a sheet reopened in that tick keeps its new demo.
  $('gameSheet').addEventListener('close',()=>{if(!$('gameSheet').open)this.stopDemo();});}
 open(id){const g=gameById(id);if(!g)return;this.id=id;const wall=this.io.wall(id),best=this.io.best(id);
  $('sheetTitle').textContent=g.title;$('sheetDesc').textContent=BLURBS[id]||'';$('sheetTag').textContent=wall.open?'TAP PLAY TO JUMP IN':'LOCKED · HERE’S HOW TO OPEN IT';
  $('sheetHow').replaceChildren(...(HOW[id]||[]).map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  $('sheetBest').textContent=best?fmt(best):'—';$('sheetStatus').textContent=wall.open?'UNLOCKED':'LOCKED';
  $('sheetWall').hidden=wall.open;$('sheetWall').replaceChildren(...(wall.routes||[]).map(r=>{const row=document.createElement('div');row.className='sheet-route'+(r.done?' done':'');const label=document.createElement('span');label.textContent=r.label;const bar=document.createElement('i');bar.style.setProperty?.('--p',String(Math.min(1,r.have/Math.max(1,r.need))));const left=document.createElement('small');left.textContent=r.done?'Done':r.left;row.append(label,bar,left);return row;}));
  $('sheetPlay').disabled=!wall.open;$('sheetPlay').textContent=wall.open?'PLAY NOW ▶':'LOCKED';
  $('sheetDemo').style.setProperty?.('--poster',`url(${posterOf(id)})`);
  if(!$('gameSheet').open)$('gameSheet').showModal?.();this.startDemo(id);}
 startDemo(id){this.stopDemo();const host=$('sheetDemo');host.classList.toggle('is-poster',id==='story'||id==='trade'||id==='chess');if(id==='story'||id==='trade'||id==='chess')return;
  this.demo=this.io.demo(host,id);}
 stopDemo(){try{this.demo?.dispose();}catch{}this.demo=null;}
 close(){this.stopDemo();if($('gameSheet').open)$('gameSheet').close();}
}
