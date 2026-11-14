// BITE NIGHT play screen: menus, fighter select, the fight HUD, keyboard and touch controls, the
// finisher window, the results card (with POST TO DAWG CHAT and SHARE), the move list and the
// finisher gallery. The match itself is the pure engine stepped at a fixed 60 Hz; the 3D scene
// loads lazily and only draws.
import {createMatch,stepAuto,K,FEATS,DAILY_TWIST,daySeed,freshSave,validFightSave,trialDone} from './fight-engine.js';
import {TITLE,TAGLINE,CALL,IN,SLOTS,FIGHTERS,fighter,STARTERS,STAGES,stageOf,FINISHERS,finisher,finishersFor,easyInput,seqText,RANGE_TEXT,TOWER,DIFFICULTY,MODS,trialsFor,BTN_NAME} from './fight-roster.js';
import {momentFor,momentText} from './fight-replay.js';

export {validFightSave};
const $=id=>document.getElementById(id);
const h=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e;};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const {U,D,L,R,A,B,S,G}=IN;
const KEYS1={KeyW:U,ArrowUp:U,KeyS:D,ArrowDown:D,KeyA:L,ArrowLeft:L,KeyD:R,ArrowRight:R,KeyJ:A,KeyK:B,KeyL:S,KeyI:G,Space:G,KeyU:A|B,KeyO:B|S,KeyP:A|S,KeyH:G|S};
const KEYS2=[{KeyW:U,KeyS:D,KeyA:L,KeyD:R,KeyF:A,KeyG:B,KeyH:S,KeyT:G,KeyR:A|B,KeyY:B|S},{ArrowUp:U,ArrowDown:D,ArrowLeft:L,ArrowRight:R,KeyJ:A,KeyK:B,KeyL:S,KeyI:G,KeyU:A|B,KeyO:B|S}];
const MODES=[{id:'tower',name:'THE TOWER',text:'Seven rivals, then the House. Clear it to unlock King Kibble.'},{id:'versus',name:'VERSUS',text:'Any fighter, any rival, any stage, five difficulty levels.'},{id:'daily',name:'TONIGHT’S MAIN EVENT',text:'One fighter, one rival, one twist. The same for everyone today.'},{id:'training',name:'TRAINING',text:'Free practice with input display and combo trials.'},{id:'two',name:'2 PLAYERS',text:'One keyboard, two DAWGs.'},{id:'moves',name:'MOVES & GALLERY',text:'Every special, every Curtain Call, and the ones you have performed.'}];
const shuffle=(list,seed)=>{let a=seed>>>0;const r=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};const o=[...list];for(let i=o.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[o[i],o[j]]=[o[j],o[i]];}return o;};
const hashId=s=>{let x=7;for(const c of s)x=Math.imul(x,31)+c.charCodeAt(0)>>>0;return x;};
/** The tower's rivals for a fighter: a fixed order per fighter, ending with the House. */
export function towerFor(fid){const pool=shuffle(STARTERS.filter(id=>id!==fid&&id!=='you'),hashId(fid)).slice(0,7),stages=shuffle(STAGES.map(s=>s.id),hashId(fid)+9);return TOWER.map((t,i)=>({rival:t.boss||pool[i%pool.length],lvl:t.lvl,stage:t.stage||stages[i%stages.length]}));}

export class FightPlay {
 constructor(io){this.io=io;const saved=io.read?.('fight',null);this.s=validFightSave(saved)&&saved?saved:freshSave();this.root=$('fightStage');this.state='home';this.g=null;this.keys=0;this.keys2=[0,0];this.touch=0;this.acc=0;this.last=0;this.ports=new Map();this.scene=null;this.sceneState='idle';this.pick={me:this.s.last,rival:'moxie',stage:'rooftop',lvl:this.s.diff};this.run=null;this.sel=this.s.last;this.paused=false;
  if(!this.root)return;try{this.build();this.wire();this.show('home');}catch{this.root=null;return;}
  if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('debug'))globalThis.__dawgFight=this;}
 save(){this.io.write?.('fight',this.s);}
 get simple(){return this.s.simple;}
 unlocked(id){return id!=='king'||this.s.king;}
 // ── Scene (lazy, failure-safe).
 ensureScene(){if(this.sceneState!=='idle')return this.sceneState==='ready'?this.scene:null;if(typeof WebGL2RenderingContext==='undefined'){this.sceneState='failed';this.root.classList.add('no-3d');return null;}this.sceneState='loading';
  import('./fight-3d.js').then(({FightScene})=>{const lite=this.io.prefs?.fx==='low';const sc=new FightScene(this.view,{sound:(...a)=>this.io.sound?.(...a),onFailure:()=>{this.sceneState='failed';this.root.classList.add('no-3d');},...(lite?{quality:'low'}:{})});sc.init();sc.setStage(this.pick.stage);this.scene=sc;this.sceneState='ready';this.root.classList.add('has-3d');}).catch(e=>{console.error(e);this.sceneState='failed';this.root.classList.add('no-3d');});return null;}
 dawg(){try{const d=this.io.prepare?.('fight',{worldSeed:this.g?.seed||1});return d&&d.id?d:null;}catch{return null;}}

 build(){
  const r=this.root;r.innerHTML='';this.view=h('div','fight-view');r.append(this.view);
  this.hud=h('div','fight-hud',`<div class="fh-top"><div class="fh-side fh-l"><div class="fh-port"></div><div class="fh-bars"><div class="fh-name"></div><div class="fh-hp"><i class="lag"></i><i class="fill"></i></div><div class="fh-meter"><i></i><b></b><b></b></div></div><div class="fh-pips"></div></div><div class="fh-timer">60</div><div class="fh-side fh-r"><div class="fh-pips"></div><div class="fh-bars"><div class="fh-name"></div><div class="fh-hp"><i class="lag"></i><i class="fill"></i></div><div class="fh-meter"><i></i><b></b><b></b></div></div><div class="fh-port"></div></div></div>
   <div class="fh-combo fh-cl"></div><div class="fh-combo fh-cr"></div><div class="fh-call"><b></b><span></span></div><div class="fh-tip"></div><div class="fh-finish" hidden><strong></strong><div class="fh-fbar"><i></i></div><ul></ul></div><div class="fh-toasts"></div>
   <div class="fh-train" hidden><div class="fh-inputs"></div><div class="fh-trials"></div><div class="fh-dummy"><span>DUMMY</span><button type="button" data-dummy="stand">STAND</button><button type="button" data-dummy="guard">GUARD</button><button type="button" data-dummy="low">LOW GUARD</button><button type="button" data-dummy="jump">JUMP</button><button type="button" data-dummy="cpu">FIGHTS BACK</button></div></div>
   <button type="button" class="fh-pause" aria-label="Pause">Ⅱ</button>`);
  this.menu=h('div','fight-menu');this.vs=h('div','fight-vs');this.vs.hidden=true;this.result=h('div','fight-result');this.result.hidden=true;this.pause=h('div','fight-pause',`<h3>PAUSED</h3><button type="button" class="fbtn primary" data-p="resume">RESUME</button><button type="button" class="fbtn" data-p="moves">MOVE LIST</button><button type="button" class="fbtn" data-p="simple"></button><button type="button" class="fbtn" data-p="full">FULL SCREEN ON / OFF</button><button type="button" class="fbtn danger" data-p="quit">QUIT TO MENU</button>`);this.pause.hidden=true;
  this.view.append(this.hud,this.menu,this.vs,this.result,this.pause);
  this.pad=h('div','fight-touch',`<div class="ft-stick"><i></i></div><div class="ft-btns"><button type="button" class="ft-b ft-s2" data-b="${A|S}" hidden>SUPER</button><button type="button" class="ft-b ft-u" data-b="${G|S}" hidden>UNDERDAWG</button><button type="button" class="ft-b ft-sm" data-b="${A|B}">THROW</button><button type="button" class="ft-b ft-sm" data-b="${B|S}">AMP</button>
   <button type="button" class="ft-b ft-g" data-b="${G}">GUARD</button><button type="button" class="ft-b ft-sp" data-b="${S}">SPECIAL</button><button type="button" class="ft-b ft-l" data-b="${A}">LIGHT</button><button type="button" class="ft-b ft-h" data-b="${B}">HEAVY</button></div>`);r.append(this.pad);
  this.q=s=>this.hud.querySelector(s);this.sides=[this.hud.querySelector('.fh-l'),this.hud.querySelector('.fh-r')];this.lag=[1,1];
 }
 wire(){
  this.menu.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||b.disabled)return;this.act(b.dataset.a,b.dataset.v);});
  this.result.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||b.disabled)return;this.act(b.dataset.a,b.dataset.v,b);});
  this.pause.addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;const p=b.dataset.p;if(p==='resume')this.setPause(false);else if(p==='full'){const on=document.body.classList.contains('story-focus');(on?document.getElementById('storyFocusExit'):document.querySelector('[data-focus="fightPanel"]'))?.click();}else if(p==='quit'){this.setPause(false);this.quit();}else if(p==='simple'){this.s.simple=!this.s.simple;this.save();if(this.g)this.g.simple[0]=this.s.simple;this.setPause(true);}else if(p==='moves'){this.movesFor=this.g?.f[0].id||this.sel;this.pause.classList.add('list');this.pause.querySelector('.fp-list')?.remove();const d=h('div','fp-list',this.moveListHtml(this.movesFor)+'<button type="button" class="fbtn" data-p="back">BACK</button>');this.pause.append(d);}else if(p==='back'){this.pause.classList.remove('list');this.pause.querySelector('.fp-list')?.remove();}});
  this.q('.fh-pause').onclick=()=>this.setPause(!this.paused);
  this.q('.fh-dummy').onclick=e=>{const b=e.target.closest('[data-dummy]');if(!b)return;this.dummy=b.dataset.dummy;if(this.g){this.g.cpu[1]=this.dummy==='cpu'?3:0;if(this.dummy==='cpu'&&!this.g.ai[1])import('./fight-ai.js').then(m=>{this.g.ai[1]=m.aiInit(3,this.g.seed);});}this.renderTrain();};
  const live=()=>this.state==='fight'&&!this.root.closest('[hidden]');
  window.addEventListener('keydown',e=>{if(!live()||e.repeat&&e.code!=='Escape')return;if(e.target?.closest?.('input,textarea,select'))return;if(e.code==='Escape'||e.code==='Enter'&&this.paused){e.preventDefault();this.setPause(!this.paused);return;}
   const two=this.run?.mode==='two';let hit=false;if(two){KEYS2.forEach((m,i)=>{if(m[e.code]){this.keys2[i]|=m[e.code];this.held2??=[{},{}];this.held2[i][e.code]=m[e.code];hit=true;}});}else if(KEYS1[e.code]){this.held??={};this.held[e.code]=KEYS1[e.code];hit=true;}if(hit){e.preventDefault();this.keysFromHeld();}});
  window.addEventListener('keyup',e=>{if(this.held&&e.code in this.held){delete this.held[e.code];}if(this.held2)for(const m of this.held2)delete m[e.code];this.keysFromHeld();});
  window.addEventListener('blur',()=>{this.held={};this.held2=[{},{}];this.keysFromHeld();this.touch=0;});
  // Touch: a floating stick on the left, buttons on the right.
  const stick=this.pad.querySelector('.ft-stick'),nub=stick.firstChild;let sid=null,sx=0,sy=0;
  const stickMove=e=>{const dx=e.clientX-sx,dy=e.clientY-sy,len=Math.hypot(dx,dy),max=44,k=len>max?max/len:1;nub.style.transform=`translate(${dx*k}px,${dy*k}px)`;let b=0;if(len>14){const a=Math.atan2(dy,dx),oct=Math.round(a/(Math.PI/4));b=[R,R|D,D,D|L,L,L|U,U,U|R,R][(oct+8)%8];if(oct===4||oct===-4)b=L;}this.touch=(this.touch&~(U|D|L|R))|b;};
  stick.addEventListener('pointerdown',e=>{e.preventDefault();sid=e.pointerId;const r=stick.getBoundingClientRect();sx=r.left+r.width/2;sy=r.top+r.height/2;try{stick.setPointerCapture(sid);}catch{}stickMove(e);});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===sid)stickMove(e);});
  const stickUp=e=>{if(e.pointerId!==sid)return;sid=null;nub.style.transform='';this.touch&=~(U|D|L|R);};stick.addEventListener('pointerup',stickUp);stick.addEventListener('pointercancel',stickUp);
  const down=new Map();this.pad.querySelector('.ft-btns').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-b]');if(!b)return;e.preventDefault();down.set(e.pointerId,Number(b.dataset.b));b.classList.add('on');try{b.setPointerCapture(e.pointerId);}catch{}sync();});
  const sync=()=>{let m=0;for(const v of down.values())m|=v;this.touch=(this.touch&(U|D|L|R))|m;},up=e=>{if(!down.has(e.pointerId))return;down.delete(e.pointerId);e.target.closest?.('[data-b]')?.classList.remove('on');for(const b of this.pad.querySelectorAll('.ft-b.on'))if(![...down.values()].includes(Number(b.dataset.b)))b.classList.remove('on');sync();};
  this.pad.addEventListener('pointerup',up);this.pad.addEventListener('pointercancel',up);this.pad.addEventListener('contextmenu',e=>e.preventDefault());
 }
 keysFromHeld(){let k=0;for(const v of Object.values(this.held||{}))k|=v;this.keys=k;if(this.held2)this.keys2=this.held2.map(m=>Object.values(m).reduce((a,b)=>a|b,0));}
 setPause(on){if(this.state!=='fight')return;this.paused=on;this.pause.hidden=!on;this.pause.classList.remove('list');this.pause.querySelector('.fp-list')?.remove();this.pause.querySelector('[data-p="simple"]').textContent='EASY INPUTS: '+(this.s.simple?'ON':'OFF');}
 quit(){this.g=null;this.run=null;this.scene?.stopCine();if(this.scene)this.scene.resultLoop=false;this.show('home');}

 // ── Menus.
 show(state){this.state=state;const m=this.menu;this.root.dataset.state=state;m.hidden=state==='fight'||state==='vs'||state==='result';this.hud.hidden=state!=='fight'&&state!=='result';this.result.hidden=state!=='result';this.vs.hidden=state!=='vs';this.pause.hidden=true;this.paused=false;this.pad.classList.toggle('live',state==='fight');
  if(state==='home')this.renderHome();else if(state==='select')this.renderSelect();else if(state==='setup')this.renderSetup();else if(state==='moves')this.renderMoves();}
 render(){if(this.root&&this.state==='home')this.renderHome();this.ensureScene();}
 renderHome(){const day=DAILY_TWIST(daySeed()),won=this.s.daily.day===day.seed&&this.s.daily.won,mod=MODS.find(m=>m.id===day.mod),done=this.s.fins.length,total=FIGHTERS.length*9;
  this.menu.className='fight-menu fm-home';this.menu.innerHTML=`<div class="fm-title"><span>${esc(TAGLINE)}</span><h3>${esc(TITLE)}</h3></div><div class="fm-modes">${MODES.map(m=>`<button type="button" class="fm-mode" data-a="mode" data-v="${m.id}"><b>${esc(m.name)}</b><small>${m.id==='daily'?esc(`${fighter(day.fighter).name} vs ${fighter(day.rival).name} · ${mod.name}${won?' · WON ✓':''}`):m.id==='tower'?esc(this.s.tower>=8?'Cleared! Climb again with someone new.':`Best: floor ${this.s.tower} of 8`):m.id==='moves'?esc(`${done} of ${total} finishers performed`):esc(m.text)}</small></button>`).join('')}</div>
   <div class="fm-foot"><button type="button" class="fbtn" data-a="simple">EASY INPUTS: ${this.s.simple?'ON':'OFF'}</button><span>${this.s.wins} wins · ${this.s.cleared.length} tower clears${this.s.daily.streak>1?` · ${this.s.daily.streak}-day streak`:''}</span></div>`;}
 portrait(id){if(this.ports.has(id))return this.ports.get(id);return null;}
 portHtml(id){const F=fighter(id),p=this.portrait(id);return `<span class="fport" data-port="${id}" style="--c:${F.color};${p?`background-image:url(${p})`:''}">${p?'':esc(F.name[0])}</span>`;}
 renderSelect(){const two=this.run.mode==='two',step=this.run.step||0,who=step===0?(two?'PLAYER 1':'CHOOSE YOUR FIGHTER'):(two?'PLAYER 2':'CHOOSE YOUR RIVAL'),F=fighter(this.sel),lock=!this.unlocked(this.sel);
  this.menu.className='fight-menu fm-select';this.menu.innerHTML=`<div class="fm-bar"><button type="button" class="fbtn" data-a="back">◂ BACK</button><h3>${who}</h3></div>
   <div class="fm-info"><span class="fm-arche" style="--c:${F.color}">${esc(F.arche)}</span><h4>${esc(lock?'???':F.name)}</h4><em>${esc(lock?'Clear the tower to unlock':F.title)}</em><p>${esc(lock?'The House does not take visitors.':F.bio)}</p>
    <div class="fm-stats">${['power','speed','reach','tricks'].map(k=>`<label>${k.toUpperCase()}<i style="--v:${lock?0:F.stats[k]}"></i></label>`).join('')}</div>
    <button type="button" class="fbtn primary fm-go" data-a="pick" ${lock?'disabled':''}>${step===0&&this.run.mode==='versus'?'NEXT ▸':this.run.mode==='training'&&step===0?'TRAIN ▸':'FIGHT ▸'}</button></div>
   <div class="fm-grid">${FIGHTERS.map(f=>`<button type="button" class="fm-tile${f.id===this.sel?' on':''}${this.unlocked(f.id)?'':' locked'}" data-a="sel" data-v="${f.id}" style="--c:${f.color}">${this.unlocked(f.id)?this.portHtml(f.id):'<span class="fport">?</span>'}<small>${esc(this.unlocked(f.id)?f.name:'???')}</small></button>`).join('')}</div>`;}
 renderSetup(){const p=this.pick;this.menu.className='fight-menu fm-setup';this.menu.innerHTML=`<div class="fm-bar"><button type="button" class="fbtn" data-a="back">◂ BACK</button><h3>${esc(fighter(p.me).name)} <i>vs</i> ${esc(fighter(p.rival).name)}</h3></div>
   <div class="fm-rows"><h4>STAGE</h4><div class="fm-row">${STAGES.map(s=>`<button type="button" class="fm-opt${s.id===p.stage?' on':''}" data-a="stage" data-v="${s.id}"><b>${esc(s.name)}</b><small>${esc(s.place)}</small></button>`).join('')}</div>
   ${this.run.mode==='versus'?`<h4>DIFFICULTY</h4><div class="fm-row">${DIFFICULTY.map(d=>`<button type="button" class="fm-opt${d.id===p.lvl?' on':''}" data-a="lvl" data-v="${d.id}"><b>${d.name}</b><small>${esc(d.text)}</small></button>`).join('')}</div>`:''}
   <button type="button" class="fbtn primary fm-go" data-a="start">FIGHT ▸</button></div>`;}
 moveListHtml(id){const F=fighter(id),m=F.moves,fins=finishersFor(id,this.g?.stage||this.pick.stage),row=(a,b,c)=>`<tr><th>${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`,two=this.run?.mode==='two';
  return `<div class="fm-moves"><h4>${esc(F.name)} · SPECIALS</h4><table>${F.specials.map((sid,i)=>row(m[sid].name,SLOTS[i].keys+' (+10% damage)',SLOTS[i].easy)).join('')}${row('Amped version (1 Howl bar)','motion + LIGHT+HEAVY','direction + AMP')}${row(m[F.super].name+' (2 Howl bars)','LIGHT + SPECIAL','SUPER')}</table>
   <h4>EVERYONE</h4><table>${row('Chain','LIGHT, LIGHT, LIGHT','cancel any into a special')}${row('Launcher / Sweep / Overhead','↓ + HEAVY / ← + HEAVY / → + HEAVY','juggle after the launcher')}${row('Throw (slip it with the same input)','LIGHT + HEAVY','THROW')}${row('Guard / Snap Guard','hold GUARD (↓ for low)','tap GUARD just before a hit')}${row('Dash / Backdash','→ → / ← ←','')}${row('Underdawg (once a round, under 30% health)','GUARD + SPECIAL','breaks a combo, +20% damage')}</table>
   <h4>CURTAIN CALLS · when the announcer says “${esc(CALL.finish)}”</h4><table>${fins.map(f=>row((this.has(id,f.id)?'✓ ':'')+f.name+' · '+RANGE_TEXT[f.range],seqText(f),easyInput(f))).join('')}</table>
   <p class="fm-keys">${two?'P1: WASD · F light · G heavy · H special · T guard · R throw · Y amp &nbsp;|&nbsp; P2: arrows · J K L I · U throw · O amp':'Keys: WASD / arrows · J light · K heavy · L special · I or Space guard · U throw · O amp · P super · H underdawg · Esc pause'}</p></div>`;}
 has(fid,fin){return this.s.fins.includes(fid+':'+fin);}
 renderMoves(){const id=this.movesFor||this.sel,F=fighter(id),all=finishersFor(id,'rooftop').slice(0,3).concat(FINISHERS.filter(f=>f.kind!=='curtain')),n=all.filter(f=>this.has(id,f.id)).length;
  this.menu.className='fight-menu fm-movescreen';this.menu.innerHTML=`<div class="fm-bar"><button type="button" class="fbtn" data-a="back">◂ BACK</button><h3>MOVES & GALLERY</h3></div><div class="fm-tabs">${FIGHTERS.filter(f=>this.unlocked(f.id)).map(f=>`<button type="button" class="fm-tab${f.id===id?' on':''}" data-a="movesfor" data-v="${f.id}" style="--c:${f.color}">${esc(f.name)}</button>`).join('')}</div>
   <div class="fm-scroll">${this.moveListHtml(id)}<h4>GALLERY · ${n} of ${all.length} performed as ${esc(F.name)}</h4><div class="fm-gal">${all.map(f=>{const got=this.has(id,f.id);return `<button type="button" class="fm-fin${got?' got':''}" data-a="watch" data-v="${f.id}" ${got?'':'disabled'}><b>${esc(f.name)}</b><small>${esc(got?f.blurb:f.kind==='dive'?'Stage Dive on '+stageOf(f.stage).name:f.kind==='rub'?'The friendly way out':'Not performed yet')}</small><i>${got?'▶ WATCH':'🔒'}</i></button>`;}).join('')}</div></div>`;}
 act(a,v,btn){const io=this.io;io.sound?.(520,.04,'triangle',.015);
  if(a==='simple'){this.s.simple=!this.s.simple;this.save();this.renderHome();}
  else if(a==='mode'){if(v==='moves'){this.movesFor=this.sel;this.show('moves');return;}if(v==='daily'){const d=DAILY_TWIST(daySeed());this.run={mode:'daily',day:d};this.pick={me:d.fighter,rival:d.rival,stage:d.stage,lvl:d.lvl};this.begin();return;}this.run={mode:v,step:0};this.show('select');}
  else if(a==='sel'){this.sel=v;this.renderSelect();}
  else if(a==='movesfor'){this.movesFor=v;this.sel=v;this.renderMoves();}
  else if(a==='back'){if(this.state==='select'&&this.run.step){this.run.step=0;this.sel=this.pick.me;this.renderSelect();}else if(this.state==='setup'){this.run.step=1;this.sel=this.pick.rival;this.show('select');}else{this.scene?.stopCine();if(this.scene)this.scene.resultLoop=false;this.watching=null;this.show('home');}}
  else if(a==='pick'){const r=this.run;if(!r.step){this.pick.me=this.sel;this.s.last=this.sel;this.save();
    if(r.mode==='tower'){r.ladder=towerFor(this.sel);r.i=0;this.towerNext();}else if(r.mode==='training'){this.pick.rival=this.sel==='tank'?'biscuit':'tank';this.pick.stage='arcade';this.begin();}else{r.step=1;this.sel=this.pick.rival===this.sel?STARTERS.find(x=>x!==this.sel):this.pick.rival;this.renderSelect();}}
   else{this.pick.rival=this.sel;this.show('setup');}}
  else if(a==='stage'){this.pick.stage=v;this.scene?.setStage(v);this.renderSetup();}
  else if(a==='lvl'){this.pick.lvl=Number(v);this.s.diff=this.pick.lvl;this.save();this.renderSetup();}
  else if(a==='start')this.begin();
  else if(a==='watch'){const f=finisher(v),id=this.movesFor||this.sel,sc=this.scene;if(!sc)return;const st=f.stage||'rooftop',foe=id==='moxie'?'biscuit':'moxie';sc.setStage(st);sc.setFighters(id,foe,this.dawg());sc.rigs[0].holder.position.x=-1.1;sc.rigs[1].holder.position.x=1.1;sc.playCine(v,{winner:0,seed:7,loop:true});sc.resultLoop=true;this.watching=v;this.menu.classList.add('watching');
   this.menu.innerHTML=`<div class="fm-bar"><button type="button" class="fbtn" data-a="unwatch">◂ BACK TO GALLERY</button><h3>${esc(f.name)}</h3></div>`;}
  else if(a==='unwatch'){this.scene?.stopCine();this.scene.resultLoop=false;this.watching=null;this.renderMoves();}
  else if(a==='again'){this.begin();}
  else if(a==='next'){if(this.run.mode==='tower'){this.run.i++;this.towerNext();}else this.begin();}
  else if(a==='menu')this.quit();
  else if(a==='share'){const r=this.last2;if(r&&io.share)io.share('fight',r.score,{detail:r.detail,text:r.shareText});}
  else if(a==='chat'){const r=this.last2;if(!r?.moment||!io.chat||btn.disabled)return;btn.disabled=true;btn.textContent='POSTING…';Promise.resolve(io.chat(r.moment)).then(x=>{btn.textContent=x?.ok?'POSTED TO DAWG CHAT ✓':(x?.reason||'COULDN’T POST');if(!x?.ok)btn.disabled=false;}).catch(()=>{btn.textContent='COULDN’T POST';btn.disabled=false;});}
 }
 towerNext(){const r=this.run,t=r.ladder[r.i];this.pick={me:this.pick.me,rival:t.rival,stage:t.stage,lvl:t.lvl};this.begin();}

 // ── A match.
 begin(){const r=this.run,p=this.pick,seed=(r.mode==='daily'?r.day.seed:Math.floor(Math.random()*2**31))>>>0,two=r.mode==='two',tr=r.mode==='training';
  this.scene?.stopCine();if(this.scene)this.scene.resultLoop=false;this.dummy='stand';
  this.g=createMatch({seed,p:[p.me,p.rival],stage:p.stage,cpu:[0,two||tr?0:p.lvl],simple:[this.s.simple,two?this.s.simple:true],mod:r.mode==='daily'?r.day.mod:null,training:tr,human:two?[0,1]:[0],mode:r.mode});
  this.log=[];this.acc=0;this.done=false;this.trialSeen=new Set();const d=this.dawg();if(this.scene){this.scene.setStage(p.stage);this.scene.setFighters(p.me,p.rival,d);this.scene.snapCam=true;}
  this.fillHud();this.showVs();}
 showVs(){const [a,b]=this.g.f.map(f=>fighter(f.id)),r=this.run,t=r.mode==='tower'?`FLOOR ${r.i+1} OF 8`:r.mode==='daily'?'TONIGHT’S MAIN EVENT · '+MODS.find(m=>m.id===r.day.mod).name.toUpperCase():r.mode==='training'?'TRAINING':r.mode==='two'?'2 PLAYERS':DIFFICULTY[this.pick.lvl-1].name;
  this.show('vs');this.vs.innerHTML=`<div class="fv-a" style="--c:${a.color}">${this.portHtml(a.id)}<b>${esc(a.name)}</b><em>${esc(a.title)}</em><q>${esc(a.intro)}</q></div><div class="fv-mid"><small>${esc(t)}</small><strong>VS</strong><small>${esc(stageOf(this.g.stage).name)}</small></div><div class="fv-b" style="--c:${b.color}">${this.portHtml(b.id)}<b>${esc(b.name)}</b><em>${esc(b.title)}</em><q>${esc(b.intro)}</q></div>`;
  this.vsUntil=performance.now()+(r.mode==='training'?900:2600);this.io.sound?.(196,.3,'sawtooth',.04);setTimeout(()=>this.io.sound?.(294,.5,'sawtooth',.045),260);}
 fillHud(){const g=this.g;g.f.forEach((f,i)=>{const F=fighter(f.id),s=this.sides[i];s.style.setProperty('--c',F.color);s.querySelector('.fh-name').textContent=F.name;const p=this.portrait(f.id),el=s.querySelector('.fh-port');el.style.backgroundImage=p?`url(${p})`:'';el.textContent=p?'':F.name[0];s.querySelector('.fh-pips').innerHTML='<i></i>'.repeat(g.need);});this.lag=[1,1];this.hudCache={};this.q('.fh-train').hidden=!g.training;this.q('.fh-finish').hidden=true;if(g.training)this.renderTrain();}
 call(text,sub='',cls=''){const c=this.q('.fh-call');c.querySelector('b').textContent=text;c.querySelector('span').textContent=sub;c.className='fh-call '+cls;void c.offsetWidth;c.classList.add('show');}
 toast(text,cls=''){const t=h('div','fh-toast '+cls);t.textContent=text;const box=this.q('.fh-toasts');box.append(t);setTimeout(()=>t.remove(),3200);while(box.children.length>3)box.firstChild.remove();}
 tip(text){const t=this.q('.fh-tip');t.textContent=text;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');}
 renderTrain(){const g=this.g;if(!g?.training)return;const F=fighter(g.f[0].id),tr=trialsFor(F);this.q('.fh-trials').innerHTML='<b>COMBO TRIALS</b>'+tr.map(t=>`<span class="${this.s.trials.includes(t.id)?'ok':''}">${this.s.trials.includes(t.id)?'✓':'○'} ${esc(t.name)}: ${t.moves.map(m=>esc(F.moves[m].name)).join(' › ')}</span>`).join('');
  for(const b of this.q('.fh-dummy').querySelectorAll('[data-dummy]'))b.classList.toggle('on',b.dataset.dummy===this.dummy);}
 inputGlyph(bits,face){const fw=bits&(face>0?R:L),bk=bits&(face>0?L:R),u=bits&U,d=bits&D,dir=u?(fw?'↗':bk?'↖':'↑'):d?(fw?'↘':bk?'↙':'↓'):fw?'→':bk?'←':'';return dir+(bits&A?' L':'')+(bits&B?' H':'')+(bits&S?' S':'')+(bits&G?' G':'');}
 events(ev){const g=this.g,me=0,nm=i=>fighter(g.f[i].id).name;
  for(const e of ev){switch(e.type){
   case 'round':this.call(g.round>=3||g.wins[0]+g.wins[1]===g.need*2-2&&g.round>1?CALL.final:CALL.round(g.round),'','round');break;
   case 'fight':this.call(CALL.go,'','go');break;
   case 'first':this.toast(CALL.first+' · '+nm(e.side));break;
   case 'super':this.call(e.name.toUpperCase(),nm(e.side),'super');break;
   case 'underdawg':this.call(CALL.under,nm(e.side),'under');break;
   case 'snap':if(e.side===me||this.run.mode==='two')this.toast(CALL.snap,'blue');break;
   case 'tech':this.toast(CALL.tech+' · '+nm(e.side),'blue');break;
   case 'counter':this.toast(CALL.counter+' · '+nm(e.side),'green');break;
   case 'hit':if(e.counter)this.toast('COUNTER HIT','red');break;
   case 'wall':this.toast(CALL.wall);break;
   case 'hazard':this.call(e.name.toUpperCase(),'-'+e.dmg,'hazard');break;
   case 'comboend':if(e.hits>=3)this.toast(`${e.hits} HITS · ${e.dmg} DAMAGE`,e.side===me?'gold':'');break;
   case 'ko':this.call(CALL.ko,e.perfect?CALL.perfect:e.clutch?CALL.clutch:e.super?'SHOWSTOPPER':'','ko');this.slow=50;break;
   case 'time':this.call(e.winner<0?CALL.draw:CALL.time,'','ko');break;
   case 'finishwin':this.call(CALL.finish,'','finish');this.openFinish(e.winner);break;
   case 'finhint':this.tip('Hold a direction with SPECIAL: ↓ → ← for your three, ↑ for the Stage Dive');break;
   case 'finrange':this.tip(e.need==='close'?'Get closer!':e.need==='far'?'Too close: back off!':'A few steps away!');break;
   case 'finisher':this.q('.fh-finish').hidden=true;this.root.classList.add('cine');break;
   case 'plain':this.q('.fh-finish').hidden=true;break;
   case 'feat':this.toast('★ FEAT: '+e.name,'feat');this.earn(e.id,e.name);break;
   case 'over':this.finish();break;
  }}}
 earn(id,name){this.io.feat?.(id,name);if(!this.s.feats.includes(id)){this.s.feats.push(id);this.save();}}
 openFinish(w){const g=this.g,box=this.q('.fh-finish'),cpu=g.cpu[w],F=fighter(g.f[w].id);box.hidden=false;box.querySelector('strong').textContent=cpu?F.name+' is choosing…':'FINISH IT: '+(g.simple[w]?'EASY INPUTS':'CLASSIC INPUTS');
  box.querySelector('ul').innerHTML=cpu?'':finishersFor(F.id,g.stage).map(f=>`<li class="${this.has(F.id,f.id)?'got':''}"><b>${esc(f.name)}</b><span>${esc(g.simple[w]?easyInput(f):seqText(f)+' · '+RANGE_TEXT[f.range])}</span></li>`).join('');}
 finish(){if(this.done)return;this.done=true;const g=this.g,r=g.result,run=this.run,won=r.winner===0,two=run.mode==='two',W=fighter(g.f[r.winner].id),Lz=fighter(g.f[r.loser].id),fin=r.finisher?finisher(r.finisher):null,s=this.s;
  this.root.classList.remove('cine');this.q('.fh-finish').hidden=true;
  const lvl=g.cpu[1]||3,score=won||two?Math.round(r.score*(.6+.2*lvl)):Math.round(g.stats[0].dealt/4);let extra='';
  if(!g.training){if(won||two)s.wins++;else s.losses++;s.best=Math.max(s.best,score);
   if(fin&&(won||two)){const key=W.id+':'+fin.id;if(!s.fins.includes(key)){s.fins.push(key);extra='NEW IN YOUR GALLERY · ';}}
   if(run.mode==='tower'&&won){s.tower=Math.max(s.tower,run.i+1);if(run.i>=7){if(!s.cleared.includes(W.id))s.cleared.push(W.id);if(!s.king){s.king=true;extra+='KING KIBBLE UNLOCKED · ';}this.earn('fight.tower',FEATS.find(f=>f.id==='fight.tower').name);}}
   if(run.mode==='daily'&&won){const d=s.daily;if(d.day!==run.day.seed||!d.won){d.streak=d.day&&run.day.seed-d.day===1&&d.won?d.streak+1:1;d.day=run.day.seed;d.won=true;}this.earn('fight.daily',FEATS.find(f=>f.id==='fight.daily').name);}
   this.save();try{this.io.record?.('fight',score,won?(fin?30:20):5);}catch{}}
  const rounds=g.rounds.length,perfect=g.rounds.some(x=>x.winner===r.winner&&x.perfect),stage=stageOf(g.stage),detail=`${won||two?W.name+' beat '+Lz.name:'lost to '+W.name}${fin?' with '+fin.name:''}`;
  const moment=fin?momentFor(g,this.dawg()):null;
  this.last2={score,detail:detail.toLowerCase(),shareText:fin?`${W.name} just finished ${Lz.name} with ${fin.name} in ${TITLE} on the DAWG Arcade. ${fin.blurb} Your turn.`:`${W.name} beat ${Lz.name} ${r.wins[r.winner]}–${r.wins[r.loser]} in ${TITLE} on the DAWG Arcade. Best combo: ${r.best} hits. Step up.`,moment:moment&&(won||two)?{kind:'finisher',game:'fight',...momentText(moment,{perfect,round:rounds}),data:moment}:null};
  const tower=run.mode==='tower',cleared=tower&&won&&run.i>=7,nextUp=tower&&won&&!cleared?run.ladder[run.i+1]:null;
  const show=()=>{if(this.g!==g)return;this.show('result');const sc=this.scene;if(fin&&sc){sc.setFighters(g.f[0].id,g.f[1].id,this.dawg());sc.rigs[0].holder.position.x=r.winner===0?-1.1:1.1;sc.rigs[1].holder.position.x=r.winner===0?1.1:-1.1;sc.playCine(fin.id,{winner:r.winner,seed:g.seed,loop:true});sc.resultLoop=true;}
   this.result.className='fight-result'+(fin?' with-replay':'')+(won||two?' won':' lost');
   this.result.innerHTML=`<div class="fr-card"><span class="fr-kick">${esc(extra)}${fin?esc(CALL[fin.kind==='dive'?'dive':fin.kind==='rub'?'rub':'curtain']):won||two?'WINNER':'DEFEATED'}</span><h3>${esc(two?W.name+' WINS':won?'YOU WIN':'YOU LOSE')}</h3>
    <p class="fr-line">${fin?`<b>${esc(fin.name)}</b> · ${esc(fin.blurb)}`:esc(won||two?W.win:W.taunt)}</p>${cleared?`<p class="fr-end">${esc(W.ending)}</p>`:''}
    <div class="fr-stats"><span><b>${score}</b>SCORE</span><span><b>${r.wins[0]}–${r.wins[1]}</b>ROUNDS</span><span><b>${g.stats[r.winner].best}</b>BEST COMBO</span><span><b>${esc(stage.name)}</b>STAGE</span></div>
    ${nextUp?`<p class="fr-next">NEXT: FLOOR ${run.i+2} · ${esc(fighter(nextUp.rival).name)} at ${esc(stageOf(nextUp.stage).name)}</p>`:tower&&!won?`<p class="fr-next">Floor ${run.i+1} of 8. ${esc(W.name)} is waiting.</p>`:''}
    <div class="fr-actions">${this.last2.moment&&this.io.chat?'<button type="button" class="fbtn primary" data-a="chat">POST TO DAWG CHAT</button>':''}<button type="button" class="fbtn" data-a="share">SHARE ↗</button>${nextUp?'<button type="button" class="fbtn primary" data-a="next">NEXT RIVAL ▸</button>':`<button type="button" class="fbtn${this.last2.moment&&this.io.chat?'':' primary'}" data-a="again">${tower&&!won?'TRY AGAIN':'REMATCH'}</button>`}<button type="button" class="fbtn" data-a="menu">MENU</button></div>${fin?'<small class="fr-loop">REPLAY · LOOPING</small>':''}</div>`;};
  setTimeout(show,fin?200:1400);}

 // ── Frame.
 frame(now,{reduced=false}={}){if(!this.root)return;const dt=Math.min(.05,this.last?(now-this.last)/1000:0);this.last=now;const sc=this.ensureScene();if(sc)sc.reduced=reduced;
  // Portraits are drawn one per frame while menus are up.
  if(sc&&this.state!=='fight'&&this.ports.size<FIGHTERS.length){const f=FIGHTERS.find(x=>!this.ports.has(x.id));const url=sc.portrait(f.id,f.own?this.dawg():null);this.ports.set(f.id,url);if(url)for(const el of this.root.querySelectorAll(`[data-port="${f.id}"]`)){el.style.backgroundImage=`url(${url})`;el.textContent='';}}
  if(this.state==='vs'){if(sc&&this.g)sc.frame(this.g,[],dt);if(now>=this.vsUntil){this.show('fight');this.call(CALL.round(1),'','round');}return;}
  if(this.state==='fight'||this.state==='result'){const g=this.g;if(!g)return;let ev=[];
   if(this.state==='fight'&&!this.paused){this.acc+=dt;if(this.slow>0)this.acc-=dt*.65;let n=0;
    while(this.acc>=1/60&&n<4){this.acc-=1/60;n++;if(this.slow>0)this.slow--;const two=this.run.mode==='two',i0=two?this.keys2[0]:(this.keys|this.touch),i1=two?(this.keys2[1]|this.touch):g.training?this.dummyInput():0;
     const e=stepAuto(g,i0,i1);if(this.log.length<40000)this.log.push(i0,i1);if(e.length)ev=ev.concat(e);if(g.training){const c=this.inputGlyph(i0,g.f[0].face);if(c!==this.lastGlyph){this.lastGlyph=c;if(c){const row=h('span','',esc(c));const box=this.q('.fh-inputs');box.prepend(row);while(box.children.length>9)box.lastChild.remove();}}}}
    if(this.acc>.2)this.acc=0;if(ev.length)this.events(ev);if(g.training)this.trainTick();}
   if(sc){if(this.state==='result'&&sc.resultLoop&&sc.director.active){sc.time+=dt;sc.director.update(dt);sc.common(dt,true);}else sc.frame(g,ev,dt);}
   this.drawHud(dt);return;}
  if(sc){if(this.watching){sc.time+=dt;sc.director.update(dt);sc.common(dt,true);}else sc.showcase(this.state==='select'||this.state==='moves'?(this.unlocked(this.sel)?this.sel:'biscuit'):this.state==='setup'?this.pick.me:this.s.last,dt,this.dawg(),'stand',this.state==='select'?-1:1);}}
 dummyInput(){const d=this.dummy,g=this.g,f=g.f[1];return d==='guard'?G:d==='low'?G|D:d==='jump'?(f.st==='idle'&&g.frame%50===0?U:0):0;}
 trainTick(){const g=this.g,F=fighter(g.f[0].id);for(const t of trialsFor(F))if(!this.s.trials.includes(t.id)&&trialDone(g,0,t.moves)){this.s.trials.push(t.id);this.save();this.toast('✓ TRIAL: '+t.name,'feat');this.renderTrain();}}
 drawHud(dt){const g=this.g,c=this.hudCache??={};const set=(k,v,fn)=>{if(c[k]!==v){c[k]=v;fn(v);}};
  g.f.forEach((f,i)=>{const s=this.sides[i],hp=f.hp/f.max;this.lag[i]=hp>this.lag[i]?hp:Math.max(hp,this.lag[i]-dt*(f.ch>0||f.st==='hit'||f.st==='launch'?.03:.45));
   set('hp'+i,Math.round(hp*1000),v=>{s.querySelector('.fill').style.transform=`scaleX(${v/1000})`;s.classList.toggle('low',hp<=K.UNDER);});set('lag'+i,Math.round(this.lag[i]*500),v=>{s.querySelector('.lag').style.transform=`scaleX(${v/500})`;});
   set('m'+i,Math.round(f.meter/K.METER*200),v=>{s.querySelector('.fh-meter i').style.transform=`scaleX(${v/200})`;});set('mb'+i,Math.floor(f.meter/100),v=>{s.querySelector('.fh-meter').dataset.bars=v;});
   set('w'+i,g.wins[i],v=>{[...s.querySelectorAll('.fh-pips i')].forEach((p,k)=>p.classList.toggle('on',k<v));});set('ud'+i,f.ud>0,v=>s.classList.toggle('under',v));
   const o=g.f[1-i],hits=o.ch>=2?o.ch:0,el=this.q(i?'.fh-cr':'.fh-cl');set('c'+i,hits,v=>{if(v){el.innerHTML=`<b>${v}</b> HITS`;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop','on');}else el.classList.remove('on');});});
  set('t',g.training?'∞':Math.max(0,Math.ceil(g.timer/60)),v=>{const t=this.q('.fh-timer');t.textContent=v;t.classList.toggle('low',v<=10);});
  const me=g.f[0],can=g.phase==='fight';set('sup',can&&me.meter>=K.SUPER,v=>{this.pad.querySelector('.ft-s2').hidden=!v;});set('und',can&&!me.udUsed&&me.hp>0&&me.hp<=me.max*K.UNDER,v=>{this.pad.querySelector('.ft-u').hidden=!v;if(v)this.tip('UNDERDAWG ready: GUARD + SPECIAL breaks their combo and powers you up');});
  if(g.phase==='finish')set('fb',Math.round((1-g.pt/K.FINISH)*100),v=>{this.q('.fh-fbar i').style.transform=`scaleX(${v/100})`;});}
 newGame(){if(this.run)this.begin();else this.show('home');}
}
