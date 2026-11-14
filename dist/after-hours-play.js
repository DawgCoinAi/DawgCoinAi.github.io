// The After Hours play screen: a 3D set with clickable hotspots, a verb bar, your pockets, a
// narrator, multiple-choice conversations, a typed command line, the taxi, and death and ending
// cards. It drives the Adventure engine with the After Hours story and saves after every action.
import {Adventure,validState,clock} from './adventure.js';
import {CONTENT,ENDINGS,DEATHS,MAX_SCORE} from './after-hours.js';

const $=id=>document.getElementById(id);
export const AH_VERBS=[['look','LOOK'],['talk','TALK'],['take','TAKE'],['use','USE'],['give','GIVE'],['buy','BUY'],['open','OPEN'],['push','PUSH'],['eat','EAT'],['drink','DRINK'],['wear','WEAR']];
const EXITS={alley:'The Alley',rooftop:'The Rooftop',penthouse:'Suite 1201'};
const ICON={look:'👁',talk:'💬',take:'✋',use:'⚙',buy:'💵',open:'🚪',push:'👉',eat:'🍴',drink:'🥃',wear:'🕶'};
// The scene is the interface: every hotspot is named, and tapping one opens a short menu of the
// things you can actually do with it (plus whatever is in your pockets).
const CSS=`.ah-panel .ah-spot span,.ah-panel .ah-spot:not(.ah-npc) span{opacity:.92;font-size:9px;padding:3px 7px}
.ah-panel .ah-spot.picked i{border-color:#b9ff5e;background:#b9ff5e88;box-shadow:0 0 0 6px #b9ff5e33,0 0 18px #b9ff5e}.ah-panel .ah-spot.picked span{background:#b9ff5e;color:#0b0816;border-color:#b9ff5e}
.ah-menu{position:absolute;left:8px;right:8px;bottom:8px;z-index:6;padding:10px 12px 12px;border-radius:14px;background:#0b0816e0;backdrop-filter:blur(6px);border:1px solid #b9ff5e88;box-shadow:0 10px 40px #000c,0 0 24px #b9ff5e22;pointer-events:auto;animation:ah-menu .16s ease-out}
@keyframes ah-menu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ah-menu header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.ah-menu header b{font:900 15px var(--ui-display,var(--display));letter-spacing:.5px;color:#fff}
.ah-menu header button{background:none;border:0;color:#fff;font-size:18px;min-width:36px;min-height:32px;cursor:pointer;opacity:.7}
.ah-menu div{display:flex;flex-wrap:wrap;gap:6px}.ah-menu small{display:block;margin:9px 0 6px;font:700 9px var(--ui-mono,var(--mono));letter-spacing:1.5px;color:#ffe45e}
.ah-menu div button{font:800 12px var(--ui-mono,var(--mono));letter-spacing:.8px;min-height:40px;padding:8px 13px;border-radius:10px;border:1px solid #ffffff38;background:#1c1630;color:#fff;cursor:pointer}
.ah-menu div button[data-mv]{border-color:#b9ff5e99;background:#1d3212}.ah-menu div button:hover,.ah-menu div button:focus-visible{background:#b9ff5e;color:#0b0816;outline:0}
.ah-panel .ah-verbs button[data-quick],.ah-panel .ah-verbs button[data-itemverb]{min-height:42px}
.ah-panel .ah-verbs button[data-quick=hint]{border-color:#ffe45e88;color:#ffe45e}

.ah-panel .ah-spot.edge-l{align-items:flex-start;transform:translate(-13px,-50%)}.ah-panel .ah-spot.edge-r{align-items:flex-end;transform:translate(calc(-100% + 13px),-50%)}.ah-panel .ah-spot.up{flex-direction:column-reverse;transform:translate(-50%,calc(-100% + 13px))}.ah-panel .ah-spot.up.edge-l{transform:translate(-13px,calc(-100% + 13px))}.ah-panel .ah-spot.up.edge-r{transform:translate(calc(-100% + 13px),calc(-100% + 13px))}
.ah-panel .ah-scene{overflow:hidden}.ah-panel .ah-spot.ah-npc{z-index:2}
@media (max-width:420px){.ah-panel .ah-spot span,.ah-panel .ah-spot:not(.ah-npc) span{font-size:7.5px;padding:2px 5px;letter-spacing:.2px}.ah-menu div button{padding:7px 10px;font-size:11px}}
@media (prefers-reduced-motion:reduce){.ah-menu{animation:none}}`;
function styles(){try{if(document.getElementById('ah-play-css'))return;}catch{return;}try{const el=document.createElement('style');el.id='ah-play-css';el.textContent=CSS;document.head.append(el);}catch{}}
// Endings from the original chapter are kept and still count; new ones join them.
const LEGACY=['flop','headliner','legend'];
export const validEndings=v=>Array.isArray(v)&&v.length<=12&&new Set(v).size===v.length&&v.every(id=>Object.hasOwn(ENDINGS,id)||LEGACY.includes(id));
export const validAfterHours=v=>v===null||validState(CONTENT,v);

// Lazy, failure-safe 3D set; until it loads (or without WebGL) the 2D fallback draws instead.
function setFor(host){let state='idle',set=null;
 return view=>{if(state==='idle'){if(typeof WebGL2RenderingContext==='undefined'){state='failed';return null;}state='loading';
   import('./after-hours-3d.js').then(({ThreeAfterHours})=>{const s=new ThreeAfterHours(host,{onFailure:()=>{state='failed';set=null;}});return s.init().then(()=>{if(state==='loading'&&s.ready){set=s;state='ready';}else if(state==='loading')state='failed';});}).catch(()=>{state='failed';});}
  if(state!=='ready'||!set)return null;try{return set.draw(view)?set.anchors:null;}catch{state='failed';set.dispose();set=null;return null;}};}

export class AfterHoursPlay {
 constructor(io){styles();this.io=io;this.verb='auto';this.classic=false;this.menu=null;this.item=null;this.fresh=new Set();this.mood=null;this.speaker=null;this.beats=[];this.beat=null;
  this.game=new Adventure(CONTENT,io.read('afterHours',null),{seed:Date.now()});let opening;if(!this.game.state.log.length)opening=this.game.start();else{this.game.lines=[];this.game.describe();opening=this.game.lines;}
  const ends=io.read('storyEndings',[]);this.endings=validEndings(ends)?[...ends]:[];this.recorded=!!this.game.state.ending;
  this.draw3d=setFor($('ahScene'));this.wire();if(!this.game.over)this.queue(opening);}
 wire(){
  $('ahVerbs').onclick=e=>{const b=e.target.closest('[data-verb]')||e.target.closest('[data-quick]')||e.target.closest('[data-itemverb]');if(!b)return;const d=b.dataset;this.closeMenu();
   if(d.quick==='look'){this.type('look');return;}if(d.quick==='hint'){this.type('hint');return;}if(d.quick==='verbs'){this.classic=true;this.verb='look';this.render();return;}if(d.quick==='simple'){this.classic=false;this.verb='auto';this.item=null;this.render();return;}
   if(d.quick==='away'){this.item=null;this.render();return;}if(d.itemverb){const it=this.item;this.item=null;if(it)this.after(this.game.act(d.itemverb,'item:'+it));return;}
   if(!d.verb)return;this.verb=d.verb;if(!['use','give'].includes(this.verb))this.item=null;this.render();};
  $('ahScene').addEventListener?.('click',e=>{if(this.menu&&!e.target.closest?.('.ah-menu,.ah-spot'))this.closeMenu();});
  $('ahHotspots').onclick=e=>{const b=e.target.closest('[data-hotspot]');if(b)this.click(b.dataset.hotspot);};
  $('ahInventory').onclick=e=>{const b=e.target.closest('[data-item]');if(b)this.pocket(b.dataset.item);};
  $('ahChoices').onclick=e=>{const b=e.target.closest('[data-option]');if(b)this.after(this.game.answer(b.dataset.option));};
  $('ahTaxi').onclick=e=>{const b=e.target.closest('[data-place]');if(b)this.after(this.game.act('go',b.dataset.place));};
  $('ahForm').onsubmit=e=>{e.preventDefault?.();const text=String($('ahInput').value||'').trim();if(!text)return;$('ahInput').value='';this.type(text);};
  $('ahHint').onclick=()=>this.type('hint');
  $('ahRetry').onclick=()=>{if(this.game.retry()){this.fresh=new Set(this.game.lines.map(l=>l.text));this.save();this.queue(this.game.lines);this.render();}};
  $('ahAgain').onclick=()=>this.newNight();$('ahReset').onclick=()=>this.io.confirm?.('Start a new night?','Your DAWG wakes up at 10 PM at the Rusty Collar with $40 and a comb. Endings you have found stay found.','NEW NIGHT ↗',()=>this.newNight());
  $('ahOverShare').onclick=()=>this.share();$('storyShare').onclick=()=>this.share();
  $('ahBubbles').onclick=e=>{if(e.target.closest('[data-beat]'))this.nextBeat();};}
 get state(){return this.game.state;}
 type(text){this.after(this.game.command(text));}
 click(id){const g=this.game,h=g.hotspots().find(x=>x.id===id);if(!h)return;if(this.item){const verb=this.verb==='give'||this.verb==='auto'&&h.npc?'give':'use',item=this.item;this.item=null;this.verb=this.classic||this.verb!=='auto'?'look':'auto';this.after(g.act(verb,id,item));return;}
  if(this.verb==='auto'){if(this.menu?.id===id)this.closeMenu();else this.openMenu(h);return;}this.after(g.act(this.verb,id));}
 // The menu for one thing in the scene: the verbs it answers to, then your pockets.
 openMenu(h){const g=this.game,verbs=g.verbsFor(h.id),items=g.items();this.closeMenu();if(verbs.length<=1&&!items.length){this.after(g.act('look',h.id));return;}
  const el=document.createElement('div');el.className='ah-menu';el.setAttribute('role','menu');const head=document.createElement('header'),name=document.createElement('b'),x=document.createElement('button');name.textContent=h.name;x.type='button';x.textContent='✕';x.setAttribute('aria-label','Close');x.dataset.mx='1';head.append(name,x);
  const row=document.createElement('div');for(const v of verbs){const b=document.createElement('button');b.type='button';b.dataset.mv=v;b.textContent=(ICON[v]||'')+' '+v.toUpperCase();row.append(b);}el.append(head,row);
  if(items.length){const lab=document.createElement('small');lab.textContent=h.npc?'OR GIVE / SHOW THEM':'OR USE ON IT';const pockets=document.createElement('div');for(const it of items){const b=document.createElement('button');b.type='button';b.dataset.mi=it.id;b.textContent=(it.icon||'•')+' '+it.name;pockets.append(b);}el.append(lab,pockets);}
  el.onclick=e=>{const b=e.target.closest?.('button');if(!b)return;e.stopPropagation?.();const d=b.dataset;this.closeMenu();if(d.mv)this.after(g.act(d.mv,h.id));else if(d.mi)this.after(g.act(h.npc?'give':'use',h.id,d.mi));else this.render();};
  $('ahScene').append(el);this.menu={id:h.id,el};this.io.sound?.(520,.04,'triangle',.015);this.spotKey='';this.place(this.anchors||null);}
 closeMenu(){if(!this.menu)return;this.menu.el.remove?.();this.menu=null;this.spotKey='';}
 pocket(id){const g=this.game;this.closeMenu();if(this.verb==='auto'){this.item=this.item===id?null:id;this.io.sound?.(this.item?520:300,.04,'triangle',.015);this.render();return;}if(['use','give'].includes(this.verb)){if(this.item===id){this.after(g.act('use','item:'+id));this.item=null;return;}this.item=id;this.render();return;}
  if(this.verb==='take'){this.item=id;this.verb='use';this.render();return;}this.after(g.act(this.verb,'item:'+id));}
 after(lines){const s=this.state;this.closeMenu();this.fresh=new Set(lines.map(l=>l.text));const who=[...lines].reverse().find(l=>l.who&&!'>›*+☠?↺☀'.includes(l.who));this.speaker=who?.who||null;
  if(lines.some(l=>l.who==='+'))this.io.sound?.(880,.12,'triangle',.03);else if(lines.some(l=>l.who==='*'))this.io.sound?.(660,.08,'square',.02);else this.io.sound?.(420,.04,'sine',.015);
  if(s.dead){this.mood='death';this.io.sound?.(110,.6,'sawtooth',.04);}
  if(s.ending&&!this.recorded){this.recorded=true;this.mood='ending';const first=!this.endings.includes(s.ending);if(first){this.endings.push(s.ending);this.io.write('storyEndings',this.endings);}this.io.record?.('story',s.score*10,first?200:0);[523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.io.sound?.(f,.18,'triangle',.03),i*120));}
  this.save();this.queue(lines);this.render();}
 // ── Speech bubbles ─────────────────────────────────────────────────────────────────────────
 // Each action's lines play as beats over the scene: narration in a caption box, characters in
 // speech bubbles above their heads, items and points as quick toasts. Tap a bubble to skip on.
 queue(lines){const beats=[];let narr=[];const flush=()=>{if(narr.length){beats.push({kind:'narration',text:narr.join(' ')});narr=[];}};
  for(const l of lines){if(['>','☠','☀','↺'].includes(l.who))continue;if(l.who==='*'||l.who==='+'){this.toast(l);continue;}
   if(l.who&&l.who.length>1){flush();beats.push({kind:'speech',who:l.who,text:l.text});}else if(l.who==='?'){flush();beats.push({kind:'hint',text:l.text});}else narr.push(l.text);}
  flush();this.beats=beats;this.nextBeat();}
 nextBeat(){clearTimeout(this.beatTimer);this.beat=this.beats.shift()||null;this.speaker=this.beat?.kind==='speech'?this.beat.who:null;this.drawBeat();
  if(this.beat){const ms=Math.min(10000,Math.max(2800,1500+this.beat.text.length*40));this.beatTimer=setTimeout(()=>this.nextBeat(),ms);this.beatTimer?.unref?.();}else this.render();}
 drawBeat(){const box=$('ahBubbles'),b=this.beat;box.replaceChildren();this.bubble=null;if(!b)return;
  const el=document.createElement('div');el.dataset.beat='1';el.className=b.kind==='speech'?'ah-bubble':b.kind==='hint'?'ah-narrator ah-hintbox':'ah-narrator';el.setAttribute('role','status');
  if(b.kind==='speech'){const n=document.createElement('b');n.textContent=b.who;el.append(n);}else if(b.kind==='hint'){const n=document.createElement('b');n.textContent='HINT';el.append(n);}
  const t=document.createElement('span');t.textContent=b.text;el.append(t);if(this.beats.length){const m=document.createElement('i');m.textContent='▸ '+this.beats.length;m.setAttribute('aria-label',this.beats.length+' more');el.append(m);}
  box.append(el);if(b.kind==='speech'){const h=this.game.hotspots().find(x=>x.npc&&x.name===b.who);this.bubble={el,anchor:b.who==='You'?'player':h?.id||null,at:h?.at};}this.place(this.anchors||null);}
 toast(line){const box=$('ahToasts');if(!box)return;const el=document.createElement('div');el.className='ah-toast'+(line.who==='+'?' is-points':'');el.textContent=line.text;box.append(el);const t=setTimeout(()=>el.remove?.(),3400);t?.unref?.();}
 save(){this.io.write('afterHours',this.game.save());}
 newNight(){this.game=new Adventure(CONTENT,null,{seed:(Date.now()^Math.floor(Math.random()*2**30))>>>0});const opening=this.game.start();this.fresh=new Set(opening.map(l=>l.text));this.queue(opening);this.recorded=false;this.item=null;this.verb=this.classic?'look':'auto';this.closeMenu();this.speaker=null;this.save();if(this.onNight)this.onNight();else this.render();}
 share(){const s=this.state;if(!s.ending||!this.io.share)return;const e=ENDINGS[s.ending];this.io.share('story',s.score*10,{detail:'ending: '+e.title,text:`I got the “${e.title}” ending in After Hours on the DAWG Arcade 🐶 ${s.score}/${MAX_SCORE} points, ${this.found()}/${Object.keys(ENDINGS).length} endings found.`});}
 found(){return this.endings.filter(id=>Object.hasOwn(ENDINGS,id)).length;}
 // ── Drawing ─────────────────────────────────────────────────────────────────────────────────
 frame(now,{dawg,reduced}={}){const g=this.game,l=g.location,hotspots=g.hotspots();this.dawg=dawg;
  const anchors=this.draw3d({loc:g.state.loc,location:l,hotspots,speaker:this.speaker,dawg,reduced,mood:this.mood});this.mood=null;
  if(!anchors)this.draw2d(now,reduced);this.anchors=anchors;this.place(anchors);}
 draw2d(now,reduced){const c=$('storyCanvas'),x=c?.getContext?.('2d');if(!x)return;const l=this.game.location,set=l.set,w=c.width,h=c.height;
  const sky=x.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#05040c');sky.addColorStop(1,set.wall||'#1a1424');x.fillStyle=sky;x.fillRect(0,0,w,h);
  x.fillStyle=set.floor||'#221a26';x.fillRect(0,h*.62,w,h*.38);x.strokeStyle=set.neonColor||'#ff5fc8';x.lineWidth=4;x.shadowColor=x.strokeStyle;x.shadowBlur=reduced?0:16+Math.sin(now/400)*4;x.strokeRect(w*.18,h*.12,w*.64,h*.18);
  x.fillStyle=x.strokeStyle;x.font='900 40px Impact, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(set.neon||l.name.toUpperCase(),w/2,h*.21);x.shadowBlur=0;}
 // Buttons are rebuilt only when what they say changes, then just move with the camera, so a
 // tap never lands on a button that was replaced mid-press.
 place(anchors){const g=this.game,box=$('ahHotspots'),list=g.hotspots(),key=[g.state.loc,list.map(h=>h.id),this.verb,this.item,this.speaker,g.over,g.state.choice,this.menu?.id].join('|');if(this.menu&&!list.some(h=>h.id===this.menu.id))this.closeMenu();
  if(key!==this.spotKey){this.spotKey=key;this.spots=new Map();box.replaceChildren();for(const h of list){const b=document.createElement('button');b.type='button';b.dataset.hotspot=h.id;b.className='ah-spot'+(h.npc?' ah-npc':'')+(this.speaker===h.name?' speaking':'')+(this.menu?.id===h.id?' picked':'');
    const i=document.createElement('i');i.setAttribute('aria-hidden','true');const span=document.createElement('span');span.textContent=h.name;b.append(i,span);b.setAttribute('aria-label',`${this.actionLabel()} ${h.name}`);b.disabled=g.over||!!g.state.choice;box.append(b);this.spots.set(h.id,{b,h});}}
  // Labels lean inward at the edges of the frame, and flip above the dot when two things crowd each other.
  const seen=[];for(const {b,h} of this.spots.values()){const a=anchors?.[h.id]||fallback(h.at),x=Math.max(4,Math.min(96,a.x)),y=Math.max(6,Math.min(92,a.y));b.hidden=a.visible===false;b.style.left=x.toFixed(1)+'%';b.style.top=y.toFixed(1)+'%';
   const up=seen.some(p=>Math.abs(p.x-x)<17&&Math.abs(p.y-y)<8&&!p.up);b.classList?.toggle('edge-l',x<13);b.classList?.toggle('edge-r',x>87);b.classList?.toggle('up',up);if(!b.hidden)seen.push({x,y,up});}
  // The speaker's bubble rides above their head (or below it, near the top of the frame).
  const bub=this.bubble;if(bub){const a=bub.anchor&&anchors?.[bub.anchor]||(bub.anchor==='player'?fallback(PLAYER_AT):bub.at?fallback(bub.at):{x:50,y:40});const below=a.y<34,x=Math.max(24,Math.min(76,a.x));bub.el.classList.toggle('below',below);bub.el.style.left=x.toFixed(1)+'%';bub.el.style.top=(below?Math.min(80,a.y+7):Math.max(8,a.y-5)).toFixed(1)+'%';bub.el.style.setProperty?.('--tail',(a.x-x).toFixed(1)+'%');}}
 actionLabel(){const it=this.item&&CONTENT.items[this.item];if(this.verb==='auto')return it?`Use ${it.name} on`:'See what you can do with';return it?`${this.verb==='give'?'Give':'Use'} ${it.name} ${this.verb==='give'?'to':'on'}`:AH_VERBS.find(v=>v[0]===this.verb)[1][0]+AH_VERBS.find(v=>v[0]===this.verb)[1].slice(1).toLowerCase();}
 render(){const g=this.game,s=g.state,l=g.location,over=g.over,opts=g.options();
  $('ahTime').textContent=clock(s.minute);$('ahMoney').textContent='$'+s.money;$('ahScore').textContent=s.score+' / '+MAX_SCORE;$('ahEndings').textContent=this.found()+' / '+Object.keys(ENDINGS).length+' ENDINGS';
  $('ahPlace').textContent=l.name;$('ahLabel').textContent=l.label||'';$('ahSunrise').style.setProperty?.('--night',String(Math.min(1,s.minute/CONTENT.sunrise)));
  const quick=(key,value,label)=>{const b=document.createElement('button');b.type='button';b.dataset[key]=value;b.textContent=label;b.disabled=over||!!opts;return b;},armed=this.item&&CONTENT.items[this.item];
  $('ahVerbs').replaceChildren(...(this.classic||this.verb!=='auto'?[...AH_VERBS.map(([id,label])=>{const b=quick('verb',id,label);b.setAttribute('aria-pressed',String(this.verb===id));return b;}),quick('quick','simple','✕ SIMPLE')]
   :armed?[...g.itemVerbs(this.item).map(v=>quick('itemverb',v,(ICON[v]||'')+' '+(v==='look'?'LOOK AT IT':v.toUpperCase()+' IT'))),quick('quick','away','✕ PUT AWAY')]
   :[quick('quick','look','👁 LOOK AROUND'),quick('quick','hint','💡 HINT'),quick('quick','verbs','ALL VERBS')]));
  $('ahAction').textContent=over?'':opts?'Pick what to say.':this.verb==='auto'?(armed?`${armed.name}: tap who or what to use it on, or pick an action above.`:'Tap anyone or anything in the scene to see what you can do. Tap a pocket item to use it.'):this.item?`${this.actionLabel()}… tap something in the scene (or the item again to use it on its own).`:`${this.actionLabel()}: tap something in the scene, or type a command.`;
  const log=s.log.slice(-28);$('ahLog').replaceChildren(...log.map(line=>{const p=document.createElement('p');p.className='ah-line'+(this.fresh.has(line.text)?' fresh':'')+(line.who&&line.who.length===1?' ah-'+({'>':'you','›':'narration','*':'got','+':'points','☠':'death','?':'hint','↺':'retry','☀':'sun'}[line.who]||'note'):line.who?' ah-talk':'');
   if(line.who&&line.who.length>1){const b=document.createElement('b');b.textContent=line.who;p.append(b);}const t=document.createElement('span');t.textContent=line.text;p.append(t);return p;}));
  $('ahLog').scrollTop=1e6;
  $('ahChoices').hidden=!opts||!!this.beat;$('ahChoices').replaceChildren();if(opts){const head=document.createElement('p');head.className='ah-prompt';head.textContent=(opts.who?opts.who+': ':'')+opts.prompt;$('ahChoices').append(head);for(const o of opts.options){const b=document.createElement('button');b.type='button';b.dataset.option=o.id;b.textContent=o.label;$('ahChoices').append(b);}}
  $('ahInventory').replaceChildren(...g.items().map(it=>{const b=document.createElement('button');b.type='button';b.dataset.item=it.id;b.title=it.description;b.setAttribute('aria-pressed',String(this.item===it.id));b.disabled=over||!!opts;const i=document.createElement('b');i.textContent=it.icon||'•';const n=document.createElement('span');n.textContent=it.name;b.append(i,n);return b;}));
  $('ahTaxi').replaceChildren(...[...Object.entries(CONTENT.places),...Object.entries(EXITS)].map(([id,name])=>{const b=document.createElement('button');b.type='button';b.dataset.place=id;b.textContent=name;b.setAttribute('aria-current',String(id===s.loc));b.disabled=over||!!opts||id===s.loc;if(EXITS[id])b.className='ah-exit';return b;}));
  $('ahInput').disabled=over;$('ahHint').disabled=over;
  $('ahOver').hidden=!over;if(over){const d=s.dead&&DEATHS[s.dead],e=s.ending&&ENDINGS[s.ending];$('ahOver').className='ah-over '+(d?'is-death':'is-ending');$('ahOverKicker').textContent=d?'YOU DIED. SORT OF.':'THE END · '+s.score+' / '+MAX_SCORE+' POINTS';$('ahOverTitle').textContent=(d||e).title;$('ahOverText').textContent=(d||e).text;$('ahRetry').hidden=!d;$('ahOverShare').hidden=!e;$('ahAgain').textContent=d?'NEW NIGHT':'PLAY ANOTHER NIGHT ↗';}
  $('storyShare').hidden=!s.ending;
  $('ahJournal').replaceChildren(...Object.entries(ENDINGS).map(([id,e])=>{const span=document.createElement('span');const got=this.endings.includes(id);span.className=got?'found':'';span.textContent=got?'✦ '+e.title:'◇ UNDISCOVERED ENDING';return span;}));
  this.place(this.anchors||null);}
}
const fallback=([x,z])=>({x:50+x/7*44,y:58+(z+1)/4.5*30}),PLAYER_AT=[-1.2,1.2];
