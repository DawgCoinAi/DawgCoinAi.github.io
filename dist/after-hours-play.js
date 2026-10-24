// The After Hours play screen: a 3D set with clickable hotspots, a verb bar, your pockets, a
// narrator, multiple-choice conversations, a typed command line, the taxi, and death and ending
// cards. It drives the Adventure engine with the After Hours story and saves after every action.
import {Adventure,validState,clock} from './adventure.js';
import {CONTENT,ENDINGS,DEATHS,MAX_SCORE} from './after-hours.js';

const $=id=>document.getElementById(id);
export const AH_VERBS=[['look','LOOK'],['talk','TALK'],['take','TAKE'],['use','USE'],['give','GIVE'],['buy','BUY'],['open','OPEN'],['push','PUSH'],['eat','EAT'],['drink','DRINK'],['wear','WEAR']];
const EXITS={alley:'The Alley',rooftop:'The Rooftop',penthouse:'Suite 1201'};
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
 constructor(io){this.io=io;this.verb='look';this.item=null;this.fresh=new Set();this.mood=null;this.speaker=null;
  this.game=new Adventure(CONTENT,io.read('afterHours',null),{seed:Date.now()});if(!this.game.state.log.length)this.game.start();
  const ends=io.read('storyEndings',[]);this.endings=validEndings(ends)?[...ends]:[];this.recorded=!!this.game.state.ending;
  this.draw3d=setFor($('ahScene'));this.wire();}
 wire(){
  $('ahVerbs').onclick=e=>{const b=e.target.closest('[data-verb]');if(!b)return;this.verb=b.dataset.verb;if(!['use','give'].includes(this.verb))this.item=null;this.render();};
  $('ahHotspots').onclick=e=>{const b=e.target.closest('[data-hotspot]');if(b)this.click(b.dataset.hotspot);};
  $('ahInventory').onclick=e=>{const b=e.target.closest('[data-item]');if(b)this.pocket(b.dataset.item);};
  $('ahChoices').onclick=e=>{const b=e.target.closest('[data-option]');if(b)this.after(this.game.answer(b.dataset.option));};
  $('ahTaxi').onclick=e=>{const b=e.target.closest('[data-place]');if(b)this.after(this.game.act('go',b.dataset.place));};
  $('ahForm').onsubmit=e=>{e.preventDefault?.();const text=String($('ahInput').value||'').trim();if(!text)return;$('ahInput').value='';this.type(text);};
  $('ahHint').onclick=()=>this.type('hint');
  $('ahRetry').onclick=()=>{if(this.game.retry()){this.fresh=new Set(this.game.lines.map(l=>l.text));this.save();this.render();}};
  $('ahAgain').onclick=()=>this.newNight();$('ahReset').onclick=()=>this.io.confirm?.('Start a new night?','Your DAWG wakes up at 10 PM at the Rusty Collar with $40 and a comb. Endings you have found stay found.','NEW NIGHT ↗',()=>this.newNight());
  $('ahOverShare').onclick=()=>this.share();$('storyShare').onclick=()=>this.share();}
 get state(){return this.game.state;}
 type(text){this.after(this.game.command(text));}
 click(id){const g=this.game,h=g.hotspots().find(x=>x.id===id);if(!h)return;if(this.item){const verb=this.verb==='give'?'give':'use';this.after(g.act(verb,id,this.item));this.item=null;this.verb='look';return;}
  this.after(g.act(this.verb,id));}
 pocket(id){const g=this.game;if(['use','give'].includes(this.verb)){if(this.item===id){this.after(g.act('use','item:'+id));this.item=null;return;}this.item=id;this.render();return;}
  if(this.verb==='take'){this.item=id;this.verb='use';this.render();return;}this.after(g.act(this.verb,'item:'+id));}
 after(lines){const s=this.state;this.fresh=new Set(lines.map(l=>l.text));const who=[...lines].reverse().find(l=>l.who&&!'>›*+☠?↺☀'.includes(l.who));this.speaker=who?.who||null;
  if(lines.some(l=>l.who==='+'))this.io.sound?.(880,.12,'triangle',.03);else if(lines.some(l=>l.who==='*'))this.io.sound?.(660,.08,'square',.02);else this.io.sound?.(420,.04,'sine',.015);
  if(s.dead){this.mood='death';this.io.sound?.(110,.6,'sawtooth',.04);}
  if(s.ending&&!this.recorded){this.recorded=true;this.mood='ending';const first=!this.endings.includes(s.ending);if(first){this.endings.push(s.ending);this.io.write('storyEndings',this.endings);}this.io.record?.('story',s.score*10,first?200:0);[523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.io.sound?.(f,.18,'triangle',.03),i*120));}
  this.save();this.render();}
 save(){this.io.write('afterHours',this.game.save());}
 newNight(){this.game=new Adventure(CONTENT,null,{seed:(Date.now()^Math.floor(Math.random()*2**30))>>>0});this.fresh=new Set(this.game.start().map(l=>l.text));this.recorded=false;this.item=null;this.verb='look';this.speaker=null;this.save();if(this.onNight)this.onNight();else this.render();}
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
 place(anchors){const g=this.game,box=$('ahHotspots'),list=g.hotspots(),key=[g.state.loc,list.map(h=>h.id),this.verb,this.item,this.speaker,g.over,g.state.choice].join('|');
  if(key!==this.spotKey){this.spotKey=key;this.spots=new Map();box.replaceChildren();for(const h of list){const b=document.createElement('button');b.type='button';b.dataset.hotspot=h.id;b.className='ah-spot'+(h.npc?' ah-npc':'')+(this.speaker===h.name?' speaking':'');
    const i=document.createElement('i');i.setAttribute('aria-hidden','true');const span=document.createElement('span');span.textContent=h.name;b.append(i,span);b.setAttribute('aria-label',`${this.actionLabel()} ${h.name}`);b.disabled=g.over||!!g.state.choice;box.append(b);this.spots.set(h.id,{b,h});}}
  for(const {b,h} of this.spots.values()){const a=anchors?.[h.id]||fallback(h.at);b.hidden=a.visible===false;b.style.left=Math.max(4,Math.min(96,a.x)).toFixed(1)+'%';b.style.top=Math.max(6,Math.min(92,a.y)).toFixed(1)+'%';}}
 actionLabel(){const it=this.item&&CONTENT.items[this.item];return it?`${this.verb==='give'?'Give':'Use'} ${it.name} ${this.verb==='give'?'to':'on'}`:AH_VERBS.find(v=>v[0]===this.verb)[1][0]+AH_VERBS.find(v=>v[0]===this.verb)[1].slice(1).toLowerCase();}
 render(){const g=this.game,s=g.state,l=g.location,over=g.over,opts=g.options();
  $('ahTime').textContent=clock(s.minute);$('ahMoney').textContent='$'+s.money;$('ahScore').textContent=s.score+' / '+MAX_SCORE;$('ahEndings').textContent=this.found()+' / '+Object.keys(ENDINGS).length+' ENDINGS';
  $('ahPlace').textContent=l.name;$('ahLabel').textContent=l.label||'';$('ahSunrise').style.setProperty?.('--night',String(Math.min(1,s.minute/CONTENT.sunrise)));
  $('ahVerbs').replaceChildren(...AH_VERBS.map(([id,label])=>{const b=document.createElement('button');b.type='button';b.dataset.verb=id;b.textContent=label;b.setAttribute('aria-pressed',String(this.verb===id));b.disabled=over||!!opts;return b;}));
  $('ahAction').textContent=over?'':opts?'Pick what to say.':this.item?`${this.actionLabel()}… tap something in the scene (or the item again to use it on its own).`:`${this.actionLabel()}: tap something in the scene, or type a command.`;
  const log=s.log.slice(-28);$('ahLog').replaceChildren(...log.map(line=>{const p=document.createElement('p');p.className='ah-line'+(this.fresh.has(line.text)?' fresh':'')+(line.who&&line.who.length===1?' ah-'+({'>':'you','›':'narration','*':'got','+':'points','☠':'death','?':'hint','↺':'retry','☀':'sun'}[line.who]||'note'):line.who?' ah-talk':'');
   if(line.who&&line.who.length>1){const b=document.createElement('b');b.textContent=line.who;p.append(b);}const t=document.createElement('span');t.textContent=line.text;p.append(t);return p;}));
  $('ahLog').scrollTop=1e6;
  $('ahChoices').hidden=!opts;$('ahChoices').replaceChildren();if(opts){const head=document.createElement('p');head.className='ah-prompt';head.textContent=(opts.who?opts.who+': ':'')+opts.prompt;$('ahChoices').append(head);for(const o of opts.options){const b=document.createElement('button');b.type='button';b.dataset.option=o.id;b.textContent=o.label;$('ahChoices').append(b);}}
  $('ahInventory').replaceChildren(...g.items().map(it=>{const b=document.createElement('button');b.type='button';b.dataset.item=it.id;b.title=it.description;b.setAttribute('aria-pressed',String(this.item===it.id));b.disabled=over||!!opts;const i=document.createElement('b');i.textContent=it.icon||'•';const n=document.createElement('span');n.textContent=it.name;b.append(i,n);return b;}));
  $('ahTaxi').replaceChildren(...[...Object.entries(CONTENT.places),...Object.entries(EXITS)].map(([id,name])=>{const b=document.createElement('button');b.type='button';b.dataset.place=id;b.textContent=name;b.setAttribute('aria-current',String(id===s.loc));b.disabled=over||!!opts||id===s.loc;if(EXITS[id])b.className='ah-exit';return b;}));
  $('ahInput').disabled=over;$('ahHint').disabled=over;
  $('ahOver').hidden=!over;if(over){const d=s.dead&&DEATHS[s.dead],e=s.ending&&ENDINGS[s.ending];$('ahOver').className='ah-over '+(d?'is-death':'is-ending');$('ahOverKicker').textContent=d?'YOU DIED. SORT OF.':'THE END · '+s.score+' / '+MAX_SCORE+' POINTS';$('ahOverTitle').textContent=(d||e).title;$('ahOverText').textContent=(d||e).text;$('ahRetry').hidden=!d;$('ahOverShare').hidden=!e;$('ahAgain').textContent=d?'NEW NIGHT':'PLAY ANOTHER NIGHT ↗';}
  $('storyShare').hidden=!s.ending;
  $('ahJournal').replaceChildren(...Object.entries(ENDINGS).map(([id,e])=>{const span=document.createElement('span');const got=this.endings.includes(id);span.className=got?'found':'';span.textContent=got?'✦ '+e.title:'◇ UNDISCOVERED ENDING';return span;}));
  this.place(this.anchors||null);}
}
const fallback=([x,z])=>({x:50+x/7*44,y:58+(z+1)/4.5*30});
