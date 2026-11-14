// The game sheet: tap a game and it opens with a live demo of the game playing itself, the
// essentials of how to play, your best, and either a big Play button or what it takes to unlock.
import {gameById} from './games.js';
import {BLURBS,posterOf,fmt} from './shell.js';

const $=id=>document.getElementById(id);
export const HOW={
 classic:['Steer with arrows, WASD, a swipe or the D-pad','Eat every pellet; power-ups turn the rivals blue','Dash (Space) straight through a rival to tackle it'],
 rush:['Sixty seconds on the clock','Coins and combos score; hits cost time','Dash (Space) through tight spots'],
 daily:['One maze for everyone today','Same seed, same twist, one shot at the best run','Comes back with a new twist tomorrow'],
 trade:['Buy low in one district, sell high in another','Every trip is a night: 30 nights to cash out','Talk to your contact and handle whoever stops you'],
 flappy:['Tap or Space to burn the jet; swipe down or ↓ to dive','Dive through a gate for a bonus, ride thermals, pull the gold lines','Three gold rings in a row earn a shield; a new sky every 8 gates'],
 cross:['Tap or swipe to hop; arrows work too','Dodge traffic, ride the floating decks','Stay ahead of the blackout; gold and close calls pay extra'],
 snake:['Swipe or use arrows to turn','Eat to grow; don’t hit yourself or the crystals','Three direct lines to the gold charge you up to smash a crystal'],
 runner:['← → change lanes','↑ jump crates, ↓ slide under arches','Grab gold and power-ups as the city speeds up'],
 turbo:['← → or swipe to change lane; tap or ↑ to jump, ↑ again in the air to flip','↓ rolls under bars and through bots; hold Space (or the screen) to burn turbo','The clock refills only at checkpoints: stay fast, chain tricks, take the high road'],
 pinball:['Hold ← → (or each side of the screen) to flip; hold ↓ or the right side and let go to plunge','Shoot the Dawg House scoop to start a mode, then follow the flashing arrows','Chain ramps and orbits for combos, lock 3 balls for multiball, beat all 5 modes for Top Dawg'],
 kart:['Hold ← → to steer, ↓ to drift','Hit a control as the lights go green','Drift for mini-turbos, ↑ fires your item'],
 nemesis:['One step a beat (swipe or arrows), or stay put. Get off the glowing tiles before the beat lands','It learns what you do in each situation. When the eye turns red it is firing an unmarked shot where it expects you: don’t do the usual','Dodging a guess is an OUTSMART (multiplier up). Gold bones are bait, and some are rigged'],
 bark:['Drag anywhere (or arrows / WASD) to move around the roof','Hold BARK (or Space) to charge, let go to blast everyone in front of you; a full charge is a MEGA bark','Grab the golden bone for an instant MEGA bark. The roof shrinks for 90 seconds; last one standing wins'],
 paint:['Your DAWG never stops; steer with arrows, WASD or a swipe, and dash with Space or a tap','Leave your paint to lay a wet trail, loop back and everything inside floods: circle a building or a landmark and it is yours','Cross an open trail to cut its owner; grab paint bombs and shields; the last 30 seconds pay double'],
 domino:['Drag a piece from the tray into the room: it clicks into the nearest spot that fits and a dotted line shows what it will do. Drag it again to move it, or back to the tray to take it out','Press GO (or G) to run the chain. Test runs are free: the golden bone has to end up in the bin','Three stars a room: bin the bone, use par pieces or fewer, and do it first try. Tap the room number to jump to any room you have reached; share codes replay a solution'],
 heist:['Each 30-second loop you play one more crew member; earlier loops replay exactly','Stand on plates to hold doors open and on switches to kill lasers; guards see what’s in front of them','Get every prize to the van. In position? END LOOP. Bad take? RETAKE, or UNDO the last crew member'],
 climb:['Hold anywhere (or ↑ / Space) to grab the nearest hook and reel in','Let go to fly; hold ← / → (or slide your thumb sideways) to pump the swing. The white ring marks the hook you’ll grab','Rusty hooks snap, slick ones slide, green springs launch you. Don’t look down'],
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
