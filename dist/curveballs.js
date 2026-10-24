// Curveball modes: short, wild twists that hit mid-run, always announced a few seconds ahead.
// They change only presentation, input routing and how fast the game clock runs; rules,
// scores and saves never see them. Calm modes avoid sway, spin and color cycling, and are the
// only ones used when the player prefers reduced motion.
export const CURVEBALLS=[
 {id:'tipsy',name:'TIPSY MODE',hint:'The street sways and your paws lag a beat.',delay:.17},
 {id:'trippy',name:'TRIPPY MODE',hint:'Colors melt and the world mirrors. Left is right now.',mirror:true},
 {id:'zoomies',name:'ZOOMIES',hint:'Everything runs 1.4× faster. Hold on.',time:1.4,calm:true},
 {id:'upside',name:'UPSIDE DOWN',hint:'The camera flipped. Your controls did not.'},
 {id:'shrink',name:'SHRINK RAY',hint:'The whole night just got tiny.',calm:true},
 {id:'bullet',name:'BULLET TIME',hint:'Slow motion. Enjoy it while it lasts.',time:.6,calm:true}
];
export const WARN_SECONDS=3,ACTIVE_SECONDS=12,FIRST_AFTER=25,GAP=[30,50];
export const mirrorDir=dir=>dir==='left'?'right':dir==='right'?'left':dir;
export function pickCurveball(random,lastId,reduced){const pool=CURVEBALLS.filter(c=>c.id!==lastId&&(!reduced||c.calm));return pool[Math.floor(random()*pool.length)%pool.length];}

export class Curveballs {
 // target(): the element the effect styles; enabled()/reduced(): live settings; cue(kind, mode): sounds.
 constructor({target=()=>null,enabled=()=>true,reduced=()=>false,cue=()=>{},random=Math.random}={}){Object.assign(this,{target,enabled,reduced,cue,random});this.reset();}
 reset(){this.clear();this.clock=0;this.nextAt=FIRST_AFTER+this.random()*10;this.lastId=null;}
 get active(){return this.phase==='active'?this.mode:null;}
 get timeScale(){return this.active?.time||1;}
 // Counts only live playing time, so pausing never lets a twist ambush the player.
 tick(dt,playing){
  if(!this.enabled()){if(this.phase!=='idle')this.clear();return;}
  if(!playing||!(dt>0))return;this.clock+=Math.min(dt,.25);
  if(this.phase==='idle'&&this.clock>=this.nextAt){this.mode=pickCurveball(this.random,this.lastId,this.reduced());this.phase='warn';this.phaseAt=this.clock;this.cue('warn',this.mode);this.show(`⚠ CURVEBALL INCOMING · ${this.mode.name}`,this.mode.hint,'warn');}
  else if(this.phase==='warn'){const left=Math.ceil(WARN_SECONDS-(this.clock-this.phaseAt));if(left<=0){this.phase='active';this.phaseAt=this.clock;this.apply(true);this.cue('start',this.mode);this.show(this.mode.name+'!',this.mode.hint,'start');}else this.show(`⚠ CURVEBALL IN ${left} · ${this.mode.name}`,this.mode.hint,'warn');}
  else if(this.phase==='active'&&this.clock-this.phaseAt>=ACTIVE_SECONDS){this.lastId=this.mode.id;this.apply(false);this.cue('end',this.mode);this.show('BACK TO NORMAL','You survived '+this.mode.name.toLowerCase()+'.','end');this.phase='idle';this.mode=null;this.nextAt=this.clock+GAP[0]+this.random()*(GAP[1]-GAP[0]);}
 }
 // Mirrors and delays input while a mode calls for it; otherwise passes it straight through.
 route(dir,send){const m=this.active;const d=m?.mirror?mirrorDir(dir):dir;if(m?.delay)setTimeout(()=>send(d),m.delay*1000);else send(d);}
 clear(){if(this.phase==='active')this.apply(false);this.phase='idle';this.mode=null;this.hide();}
 apply(on){const el=this.target();if(!el)return;el.classList.add('cb-target');for(const c of CURVEBALLS)el.classList.remove('cb-'+c.id);if(on&&this.mode)el.classList.add('cb-'+this.mode.id);}
 banner(){if(typeof document==='undefined')return null;let el=document.getElementById('curveball');if(!el){el=document.createElement('div');el.id='curveball';el.setAttribute('role','status');el.innerHTML='<strong></strong><small></small>';document.body.append(el);}return el;}
 show(title,hint,kind){const el=this.banner();if(!el)return;el.querySelector('strong').textContent=title;el.querySelector('small').textContent=hint;el.dataset.kind=kind;el.hidden=false;clearTimeout(this.hideTimer);if(kind!=='warn')this.hideTimer=setTimeout(()=>this.hide(),kind==='start'?2200:1800);}
 hide(){clearTimeout(this.hideTimer);const el=typeof document==='undefined'?null:document.getElementById('curveball');if(el)el.hidden=true;}
}
