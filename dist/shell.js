// App shell: the four views (Play, Rankings, Friends, Me), the Play hero and game cards, and
// the Me page. It only renders; app.js owns game state and rankings.js owns the social data.
import {gameById,GAMES} from './games.js';
import {shortRule} from './unlocks.js';

const $=id=>document.getElementById(id);
export const VIEWS=['play','rankings','friends','me'];
const POSTER={classic:'maze',rush:'maze',daily:'maze'};
export const posterOf=id=>`assets/posters/${POSTER[id]||id}.jpg`;
// One line of copy per game for the hero.
export const BLURBS={
 classic:'A hungry DAWG, a maze full of loot and four rivals who really don’t want you to win. Play it in first person.',
 rush:'Sixty seconds. Every coin counts, every hit costs. Chase the score, not the exit.',
 daily:'One seeded maze for everyone, every day. Same twist, same rivals: who runs it best?',
 trade:'Buy low, sell high, dodge the debt collector. Build a street empire in thirty nights.',
 flappy:'Thread the neon gates from the cockpit. One tap to climb, gravity does the rest.',
 cross:'Hop the traffic, ride the logs, grab the gold. How far can one DAWG get?',
 snake:'Ride the light trail through a neon arena. Grow your pack and don’t bite your tail.',
 runner:'Three lanes, one night, no brakes. Jump, slide and stack gold through the city.',
 turbo:'Loops, springs and pure speed. Roll into bots and launch off kickers.',
 pinball:'Three tables, endless levels. Fly the ball over the playfield on ramps and wireforms, pound the bumpers and finish each mission to change the table.',
 kart:'Three laps against five rival DAWGs. Drift for mini-turbos and bonk the leader.',
 bark:'Twenty DAWGs on a shrinking rooftop and one move: a charged bark that sends whoever is in front of you flying. Last one on the roof wins.',
 paint:'Three minutes, one neon city, five crews with paint. Loop out and back to claim blocks, cut open trails, and own the most of the town when the whistle goes.',
 domino:'Nine rooms, one push. Place a few pieces among the shelves and dominoes, hold GO, and get the golden bone into the bin. Every solution has a code.',
 heist:'Plan a heist 30 seconds at a time. Every loop adds one more of you, replaying your last loops exactly. Your past selves are your crew.',
 climb:'A 500-meter glass tower, one grappling leash and no checkpoints. Every fall is measured. Every meter is earned twice.',
 chess:'Five rival DAWGs, one crown. Every capture is a battle: pieces become warriors and fight it out on the square in slow motion.',
 story:'One velvet suit, one night, ten places to make bad decisions. Win over Nova, steal the rooftop show, and find all six endings before sunrise.'
};
const HOT={domino:'NEW',paint:'NEW',bark:'NEW',heist:'NEW',climb:'NEW',chess:'NEW',kart:'NEW',pinball:'NEW',turbo:'HOT'};
export const fmt=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
export function timeAgo(when,now=Date.now()){const s=Math.max(0,(now-new Date(when).getTime())/1000);return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':Math.floor(s/86400)+' d ago';}
// Rank movement between two places (lower is better): '▲ 3', '▼ 1' or ''.
export function movement(place,prev){if(!place||!prev||place===prev)return {text:'',dir:''};return place<prev?{text:'▲ '+(prev-place),dir:'up'}:{text:'▼ '+(place-prev),dir:'down'};}
// The closest route to unlocking a game, as a 0–100 progress figure for the card ring.
export function unlockProgress(wall){if(!wall||wall.open)return 100;return Math.round(Math.max(0,...(wall.routes||[]).map(r=>Math.min(1,r.have/Math.max(1,r.need))))*100);}

export class Shell {
 constructor({onView}={}){this.onView=onView;this.view='play';this.preview=null;
  document.querySelector('.app-nav')?.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)this.show(b.dataset.view);});
  for(const b of document.querySelectorAll('.game-card'))if(HOT[b.dataset.mode])b.dataset.hot=HOT[b.dataset.mode];
  window.addEventListener('popstate',()=>{const v=(location.hash||'').slice(1);if(VIEWS.includes(v)&&v!==this.view)this.show(v,{push:false});});
 }
 initial(){const v=(globalThis.location?.hash||'').slice(1);if(VIEWS.includes(v)&&v!=='play')this.show(v,{push:false});}
 show(view,{push=true,scroll=true}={}){if(!VIEWS.includes(view))return;const changed=view!==this.view;this.view=view;
  for(const v of VIEWS){const el=$('view'+v[0].toUpperCase()+v.slice(1));if(el)el.hidden=v!==view;}
  for(const b of document.querySelectorAll('.app-nav [data-view]')){if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  if(push&&changed&&globalThis.history){try{history.pushState(null,'',view==='play'?location.pathname+location.search:'#'+view);}catch{}}
  if(scroll&&changed)window.scrollTo({top:0,behavior:'auto'});this.title();this.onView?.(view);}
 // Tab title follows the view, and the selected game on Play.
 title(){const names={rankings:'Rankings',friends:'Friends',me:'Me'};document.title=(this.view==='play'?this.gameTitle||'Play':names[this.view])+' · DAWG Arcade';}
 // Hero for the selected game, or a preview of a locked one with its unlock routes.
 hero(id,{best=0,wall=null,bestLabel=null}={}){const g=gameById(id);if(!g)return;const locked=wall&&!wall.open;this.preview=locked?id:null;
  $('heroArt').style.setProperty('--hero-poster',`url(${posterOf(id)})`);$('heroTitle').textContent=g.title;this.gameTitle=g.title;this.title();
  $('heroTag').textContent=document.querySelector(`#tab-${id} .card-body small`)?.textContent||'';$('heroDesc').textContent=BLURBS[id]||'';
  $('heroBest').textContent=bestLabel??fmt(best);$('heroLock').hidden=!locked;
  const play=$('heroPlay');play.disabled=!!locked;$('heroPlayLabel').textContent=locked?'LOCKED':id==='trade'||id==='story'||id==='chess'?'CONTINUE':'PLAY NOW';
  if(locked){$('heroLockTitle').textContent='Unlock '+g.title+' — any one of these opens it:';$('heroRoutes').replaceChildren(...wall.routes.map(r=>{const row=document.createElement('div');row.className='hero-route'+(r.done?' done':'');const head=document.createElement('header'),label=document.createElement('span'),left=document.createElement('small'),bar=document.createElement('div'),fill=document.createElement('i');label.textContent=r.label;left.textContent=r.done?'DONE':r.left;bar.className='meter';fill.style.setProperty('--p',Math.min(100,Math.round(r.have/Math.max(1,r.need)*100))+'%');bar.append(fill);head.append(label,left);row.append(head,bar);return row;}));}
  for(const b of document.querySelectorAll('.game-card'))b.classList.toggle('previewing',b.dataset.mode===id&&locked);}
 // Pass 'loading' while the weekly rank and top friend are being fetched.
 heroSocial(s){const loading=s==='loading',{rank='—',rankDir='',friend='—'}=loading?{}:s||{},r=$('heroRank'),f=$('heroFriend');r.textContent=loading?'':rank;r.className=loading?'loading':rankDir;f.textContent=loading?'':friend;f.className=loading?'loading':'';}
 // Lock rings and states on every game card.
 cards(walls){let open=0;for(const b of document.querySelectorAll('.game-card')){const w=walls(b.dataset.mode),small=b.querySelector('.card-body small');b.classList.toggle('locked',!w.open);if(w.open)open++;b.style.setProperty('--unlock',unlockProgress(w));b.title=w.open?'':'Locked: '+(w.routes?.[0]?.label||'keep playing to open');
   // Locked cards say what opens them instead of their tagline.
   if(small){small.dataset.tag??=small.textContent;small.textContent=w.open?small.dataset.tag:'🔓 '+shortRule(b.dataset.mode);}}
  $('gamesMeta').textContent=open+' / '+GAMES.length+' UNLOCKED';}
 // Today rail: short cards for the daily run, streak, next unlock and anything waiting.
 // items: [{id, icon, title, sub, pct?, tone?}]; onTap(id) handles the action.
 today(items,onTap){const rail=$('todayRail');if(!rail)return;rail.replaceChildren(...items.map(it=>{const b=document.createElement('button');b.type='button';b.className='today-card'+(it.tone?' '+it.tone:'');b.dataset.today=it.id;const i=document.createElement('span');i.className='today-icon';i.textContent=it.icon;const t=document.createElement('span');t.className='today-text';const s=document.createElement('strong');s.textContent=it.title;const m=document.createElement('small');m.textContent=it.sub;t.append(s,m);if(it.pct!==undefined){const bar=document.createElement('span');bar.className='meter';const f=document.createElement('i');f.style.setProperty('--p',Math.round(it.pct)+'%');bar.append(f);t.append(bar);}b.append(i,t);b.onclick=()=>onTap?.(it.id);return b;}));rail.hidden=!items.length;}
 // Me page: stats, bests and the level bar. Profile name and code come from rankings.js.
 me({level,xp,next,prev,minutes,streak,runs,records,stamps,rank}){
  $('meXpFill').style.setProperty('--p',Math.min(100,Math.round((xp-prev)/Math.max(1,next-prev)*100))+'%');$('meXpText').textContent=fmt(xp)+' / '+fmt(next)+' XP TO LEVEL '+(level+1);
  const tiles=[['LEVEL',level],['DAY STREAK',streak,streak>=3],['MINUTES PLAYED',fmt(minutes)],['RUNS',fmt(runs)],['STAMPS',stamps],['ARCADE RANK',rank||'—']];
  $('meStats').replaceChildren(...tiles.map(([k,v,hot])=>{const d=document.createElement('div');d.className='stat-tile'+(hot?' hot':'');const b=document.createElement('b'),s=document.createElement('small');b.textContent=String(v);s.textContent=k;d.append(b,s);return d;}));
  $('meBests').replaceChildren(...GAMES.map(g=>{const li=document.createElement('li'),img=document.createElement('img'),span=document.createElement('span'),small=document.createElement('small'),b=document.createElement('b');const v=records[g.id];li.dataset.game=g.id;li.className=v>0?'':'none';img.src=posterOf(g.id);img.alt='';img.loading='lazy';span.textContent=g.title;small.textContent=g.id==='trade'?'NET WORTH':'BEST SCORE';span.append(small);b.textContent=v>0?(g.id==='trade'?'$'+fmt(v):fmt(v)):'—';li.append(img,span,b);return li;}));}
}
