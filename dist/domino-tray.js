// Domino Dynasty's hands: the tray of pieces along the bottom of the room, drag and drop, the
// room picker, the attempts and star rules, the win card and the feat toasts.
// Drag a piece out of the tray into the room and it clicks into the nearest peg hole that fits;
// drag a placed piece to move it, drag it back onto the tray (or tap its chip) to take it out, tap
// an empty spot to peg the next piece there, and press GO. On touch the piece floats above your
// finger and the room leans in around it so you can see exactly where it will land.
// The engine owns every rule (grab / carry / release / go / jump / skip); this only turns pointers
// into those calls, and keeps the furthest room and best stars in the player's profile.
import {DOMINO,LEVELS,WORLDS,FEATS,pieceOf} from './domino-engine.js';
const LIFT=58;
const NAME={domino:'DOMINO',ball:'BALL',plank:'RAMP',spring:'SPRING',fan:'FAN',glove:'GLOVE'};
const svg=body=>`<svg viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`,flip=d=>d<0?'translate(40 0) scale(-1 1)':'';
const ICON={
 domino:()=>svg('<rect x="13" y="4" width="14" height="32" rx="3" fill="currentColor"/><circle cx="20" cy="12" r="2.2" fill="#0b0a14"/><circle cx="17" cy="27" r="2" fill="#0b0a14"/><circle cx="23" cy="31" r="2" fill="#0b0a14"/><rect x="15" y="19" width="10" height="1.8" fill="#0b0a14"/>'),
 ball:()=>svg('<circle cx="20" cy="20" r="13" fill="currentColor"/><circle cx="15" cy="15" r="4" fill="#fff" opacity=".75"/>'),
 plank:d=>svg(`<g transform="${flip(d)}"><path d="M5 12 L35 27" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="11" cy="7" r="4.4" fill="currentColor" opacity=".6"/></g>`),
 spring:d=>svg(`<g transform="${flip(d)} rotate(${d?14:0} 20 30)"><rect x="7" y="8" width="26" height="6" rx="3" fill="currentColor"/><path d="M12 14 L28 19 L12 24 L28 29 L12 34" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/></g>${d?`<g transform="${flip(d)}"><path d="M29 9 L37 3 M37 3 L31 3 M37 3 L37 9" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`:''}`),
 fan:d=>svg(`<g transform="${flip(d)}"><circle cx="12" cy="20" r="9" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 12 V28 M4 20 H20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M25 13 H34 M25 20 H37 M25 27 H34" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" opacity=".75"/></g>`),
 glove:d=>svg(`<g transform="${flip(d)}"><rect x="3" y="13" width="13" height="16" rx="2" fill="currentColor" opacity=".6"/><path d="M16 21 H22" stroke="currentColor" stroke-width="4"/><circle cx="29" cy="21" r="9" fill="currentColor"/><circle cx="27" cy="12" r="4" fill="currentColor"/></g>`)};
const stars=(n,of=3)=>'★'.repeat(Math.max(0,n))+'☆'.repeat(Math.max(0,of-Math.max(0,n)));

const NONE={down(){},move(){},up(){},cancel(){}};
export function mountDominoTray(shell,board){try{return mount(shell,board);}catch{return NONE;}}
function mount(shell,board){
 const stage=board?.parentElement;if(!stage?.append||typeof requestAnimationFrame!=='function')return NONE;const root=document.createElement('div');root.className='dm-dock';root.hidden=true;
 root.innerHTML='<div class="dm-bar"><button class="dm-step dm-prev" type="button" aria-label="Previous room">‹</button><button class="dm-roombtn" type="button" aria-haspopup="true"></button><button class="dm-step dm-next" type="button" aria-label="Next room">›</button><span class="dm-tries"></span><button class="dm-skip" type="button" hidden>SKIP ›</button></div>'
  +'<div class="dm-rules" aria-live="polite"></div><div class="dm-row"><div class="dm-dock-pieces" role="group" aria-label="Pieces"></div><button class="dm-dock-reset" type="button" aria-label="Take every piece back">↺</button><button class="dm-dock-go" type="button">GO <b>▶</b></button></div>';
 const map=document.createElement('div');map.className='dm-map';map.hidden=true;const card=document.createElement('div');card.className='dm-card';card.hidden=true;const toast=document.createElement('div');toast.className='dm-feat';toast.hidden=true;
 stage.append(root,map,card,toast);const q=s=>root.querySelector(s),pieces=q('.dm-dock-pieces'),goBtn=q('.dm-dock-go'),resetBtn=q('.dm-dock-reset'),roomBtn=q('.dm-roombtn'),prev=q('.dm-prev'),next=q('.dm-next'),tries=q('.dm-tries'),skip=q('.dm-skip'),rules=q('.dm-rules');
 let drag=null,key='',seen=null,saved='',featN=0,cardKey='',toastT=0;
 const game=()=>shell.kind==='domino'?shell.game:null,live=g=>!!g&&g.status==='playing'&&g.phase==='place'&&!shell.countdown;
 const pick=(x,y)=>shell.renderer.pickDomino?.(x,y)||null;
 const overDock=y=>y>=root.getBoundingClientRect().top-4;
 // Moves the carried piece to the pointer; over the tray it is marked as on its way back.
 const carry=e=>{const g=game();if(!g?.held||!drag)return;const out=overDock(e.clientY);g.held.out=out;g.held.touch=drag.touch;if(out)return;const at=pick(e.clientX,e.clientY),p=pick(e.clientX,e.clientY-(drag.touch&&drag.moved?LIFT:0));if(!p)return;if(at){g.held.fx=at.x;g.held.fy=at.y;}g.carry(p.x+drag.ox,p.y+drag.oy);};
 const drop=()=>{const g=game(),d=drag;drag=null;if(!g||!d||!g.held)return;if(d.chip&&!d.moved){g.release(false);return;}g.release(!g.held.out);};
 // Tray: press a chip to pick that piece up (out of the room too, if it's already placed).
 pieces.addEventListener('pointerdown',e=>{const chip=e.target.closest('[data-piece]'),g=game();if(!chip||!live(g))return;e.preventDefault();e.stopPropagation();if(g.held)g.release(false);if(!g.grab(+chip.dataset.piece))return;g.held.out=true;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,chip:true,touch:e.pointerType!=='mouse',ox:0,oy:0};try{pieces.setPointerCapture(e.pointerId);}catch{}});
 pieces.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId||!drag.chip)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;drag.moved=true;carry(e);});
 for(const t of ['pointerup','pointercancel'])pieces.addEventListener(t,e=>{if(drag?.id===e.pointerId&&drag.chip){if(t==='pointercancel'&&game()?.held)game().held.out=true;drop();}});
 goBtn.addEventListener('click',()=>{const g=game();if(live(g))g.go();});
 resetBtn.addEventListener('click',()=>{const g=game();if(live(g))g.clearPlaced();});
 skip.addEventListener('click',()=>{const g=game();if(live(g))g.skip();});
 const step=d=>{const g=game();if(live(g))g.jump(g.level+d);};prev.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));
 // The room picker: every room reached so far, by shop, with the best stars earned in each.
 const openMap=()=>{const g=game();if(!live(g)||g.daily)return;map.innerHTML='<div class="dm-map-in">'+WORLDS.map((w,wi)=>`<section><h4>${w.name.toUpperCase()}<small>${w.tag}</small></h4><div>${LEVELS.map((l,i)=>l.world!==wi?'':`<button type="button" data-room="${i}" class="${i===g.level?'dm-here':''}" ${i>Math.min(g.unlocked,LEVELS.length-1)?'disabled':''}><b>${i+1}</b><span>${l.name}</span><i>${i>g.unlocked?'LOCKED':stars(Math.max(g.best[i],g.stars[i]))}</i></button>`).join('')}</div></section>`).join('')+'<button type="button" class="dm-map-close">BACK TO THE ROOM</button></div>';map.hidden=false;};
 roomBtn.addEventListener('click',()=>map.hidden?openMap():(map.hidden=true));
 map.addEventListener('click',e=>{const b=e.target.closest('[data-room]'),g=game();if(b&&live(g))g.jump(+b.dataset.room);map.hidden=true;});
 for(const el of [root,map,card])el.addEventListener('pointerdown',e=>e.stopPropagation());
 window.addEventListener('keydown',e=>{const g=game();if(!live(g)||!shell.session||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]'))return;if(/^[1-4]$/.test(e.key))g.select(+e.key-1);else if(e.key==='Backspace'||e.key==='Delete')g.clearPlaced();else if(e.key==='['||e.key==='PageUp')g.jump(g.level-1);else if(e.key===']'||e.key==='PageDown')g.jump(g.level+1);else if(e.key==='Escape')map.hidden=true;});
 // The tray mirrors the game every frame, but only touches the DOM when something changed.
 const frame=()=>{requestAnimationFrame(frame);const g=game(),show=!!g&&!!shell.session&&g.status==='playing'&&!shell.countdown;
  // A new run picks up where the player got to; progress goes back to the profile as it is made.
  if(g&&g!==seen){seen=g;featN=g.feats.length;cardKey='';try{g.loadProgress(shell.io.read?.('domino',null));}catch{}saved=JSON.stringify(g.exportProgress());}
  if(g){const p=JSON.stringify(g.exportProgress());if(p!==saved){saved=p;try{shell.io.write?.('domino',g.exportProgress());}catch{}}}
  if(root.hidden===show)root.hidden=!show;if(!show){key='';map.hidden=true;card.hidden=true;return;}
  if(g.feats.length>featN){const f=FEATS.find(x=>x.id===g.feats[featN]);featN++;if(f){toast.innerHTML=`<b>FEAT · ${f.name.toUpperCase()}</b><span>${f.text}</span>`;toast.hidden=false;toast.classList.remove('dm-in');void toast.offsetWidth;toast.classList.add('dm-in');toastT=performance.now()+3200;}}else if(g.feats.length<featN)featN=g.feats.length;
  if(toastT&&performance.now()>toastT){toast.hidden=true;toastT=0;}
  // The win card: stars, what they were for, the share code, and what comes next.
  const w=g.phase==='won'?g.lastWin:null,ck=w?g.level+':'+g.attempts+':'+w.code:'';if(ck!==cardKey){cardKey=ck;card.hidden=!w;if(w){card.innerHTML=`<div class="dm-stars">${[1,2,3].map(i=>`<i class="${i<=w.stars?'on':''}" style="--d:${i*.28}s">★</i>`).join('')}</div><b>${w.name.toUpperCase()}</b><p>${w.pieces} PIECE${w.pieces===1?'':'S'} (PAR ${w.parPieces}) · ${w.attempts===1?'FIRST TRY':'TRY '+w.attempts} · ${w.time.toFixed(1)} S${w.points?` · +${w.points.toLocaleString()}`:''}</p><p class="dm-code">SHARE CODE <u>${w.code}</u></p>${w.tease?`<p class="dm-tease">${w.tease.toUpperCase()}</p>`:''}`;card.classList.remove('dm-in');void card.offsetWidth;card.classList.add('dm-in');}}
  const used=new Set(g.placed.map(p=>p.i)),nx=g.nextIndex(),held=g.held?g.held.i:-1,lv=g.lv,k=[g.level,g.phase,[...used].join(''),nx,held,g.attempts,g.unlocked,g.stars[g.level],g.daily,g.canSkip()].join('|');if(k===key)return;key=k;
  pieces.innerHTML=lv.palette.map((n,i)=>{const p=pieceOf(n),t=p.type,state=held===i?'dm-held':used.has(i)?'dm-used':i===nx?'dm-next':'';return `<button type="button" class="dm-chip ${state}" data-piece="${i}" aria-label="${NAME[t]}${used.has(i)?', placed':''}">${ICON[t](p.dir||0)}<span>${NAME[t]}</span><kbd>${i+1}</kbd></button>`;}).join('');
  const running=g.phase!=='place';goBtn.disabled=running;goBtn.innerHTML=g.phase==='run'?'RUNNING…':g.phase==='won'?'IN THE BIN ✓':g.phase==='failed'?'RESET…':'GO <b>▶</b>';goBtn.classList.toggle('dm-ready',!running);resetBtn.disabled=running||!g.placed.length;
  roomBtn.innerHTML=g.daily?`ROOM OF THE DAY <i>${stars(g.stars[g.level])}</i>`:`ROOM ${g.level+1}<small>/${LEVELS.length}</small> <i>${stars(Math.max(g.best[g.level],g.stars[g.level]))}</i>`;prev.disabled=running||g.daily||g.level<=0;next.disabled=running||g.daily||g.level>=Math.min(g.unlocked,LEVELS.length-1);prev.hidden=next.hidden=!!g.daily;
  tries.textContent=g.attempts?`${g.attempts} ${g.attempts===1?'TRY':'TRIES'}`:'FREE TRIES';skip.hidden=!g.canSkip();
  const first=g.attempts===0||running&&g.attempts===1;rules.innerHTML=(g.daily?`<span class="dm-twist">${g.twist.name.toUpperCase()}</span>`:'')+`<span class="on">★ BIN THE BONE</span><span class="${used.size<=lv.par?'on':''}">★ ${lv.par} PIECE${lv.par===1?'':'S'} OR FEWER</span><span class="${first?'on':''}">★ FIRST TRY</span>`;};
 requestAnimationFrame(frame);
 // Room: grab the piece under the pointer, or carry the next free piece to wherever you press.
 return {
  down(e){const g=game();if(!live(g))return;map.hidden=true;if(g.held)g.release(false);const at=pick(e.clientX,e.clientY);if(!at)return;let i=g.pieceNear(at.x,at.y),ox=0,oy=0;const moving=i>=0;if(i<0)i=g.nextIndex();if(i<0||!g.grab(i))return;const touch=e.pointerType!=='mouse';
   if(moving){ox=g.cursor.gx*DOMINO.grid-at.x;oy=g.cursor.gy*DOMINO.grid-at.y;}else g.carry(at.x,at.y);g.held.touch=touch;g.held.fx=at.x;g.held.fy=at.y;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,chip:false,touch,ox,oy};},
  move(e){if(drag?.id!==e.pointerId||drag.chip)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<10)return;if(!drag.moved&&drag.touch){drag.ox=0;drag.oy=0;}drag.moved=true;carry(e);},
  up(e){if(drag?.id===e.pointerId&&!drag.chip)drop();},
  cancel(e){if(drag?.id===e.pointerId&&!drag.chip){const g=game();if(g?.held)g.held.out=!g.held.from;drop();}}};
}
