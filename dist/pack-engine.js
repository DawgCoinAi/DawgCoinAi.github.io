import {hash as worldHash} from './world.js';
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
// Browser-independent rules for the quick-play games. Coordinates are logical pixels.
export const PACK_WIDTH=420, PACK_HEIGHT=560;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Flappy DAWG is a jetpack flight down a skyline. Tap to burn the jet, dive to drop fast with a
// speed burst, ride thermals, and pull gold lines off the safe path. Every eight gates the sky
// changes: golden hour, neon night, a storm with downdrafts, then a gold-rush fireworks show.
export const FLAPPY={zoneGates:8,zones:['GOLDEN HOUR','NEON NIGHT','STORM FRONT','FIREWORKS'],boost:.8,diveCooldown:1.4,boostSpeed:1.4,firstPerson:1.25};
// Feats: specific things to pull off in one run. Each is awarded once per run as {type:'feat', id}.
export const FLAPPY_FEATS=[
 {id:'flappy.needle',name:'Needle',text:'Thread 5 gold rings in a row',test:g=>g.streak>=5},
 {id:'flappy.threader',name:'Threader',text:'Dive through 3 gates in one run',test:g=>g.threads>=3},
 {id:'flappy.bullseye',name:'Bullseye Burn',text:'Dive through a gate dead on its gold ring',test:g=>g.perfectThreads>=1},
 {id:'flappy.lines',name:'Clean Sweep',text:'Collect 5 complete gold lines',test:g=>g.lines>=5},
 {id:'flappy.gold50',name:'Pocketful',text:'Collect 50 gold in one run',test:g=>g.gold>=50},
 {id:'flappy.rush',name:'Showtime',text:'Collect 12 gold during the Fireworks',test:g=>g.rushGold>=12},
 {id:'flappy.saved',name:'Second Wind',text:'Lose your shield and still clear the next gate',test:g=>g.saved>=1},
 {id:'flappy.storm',name:'Storm Chaser',text:'Fly out the far side of the Storm Front',test:g=>g.stage>=3},
 {id:'flappy.fullday',name:'Dawn to Dark',text:'Fly through all four skies in one run',test:g=>g.stage>=4},
 {id:'flappy.helmet',name:'Helmet Cam Hero',text:'Clear 10 gates in first person',test:g=>g.fpGates>=10}
];
const FLAPPY_TWISTS=[{id:'tailwind',name:'TAILWIND',text:'Everything is 10% faster and every gate pays 12',speed:1.1,gate:12},{id:'goldrush',name:'GOLD RUSH',text:'Gold pays double all day',gold:2},{id:'thermals',name:'THERMAL DAY',text:'Twice as many thermals to ride',wind:2},{id:'nightshift',name:'NIGHT SHIFT',text:'The run starts at Neon Night',shift:1}];
// The modifier a daily run on this seed plays with (applied only when game.daily is true).
export const FLAPPY_DAILY_TWIST=seed=>FLAPPY_TWISTS[(seed>>>0)%FLAPPY_TWISTS.length];
export class FlappyGame {
 constructor(random=Math.random,worldSeed=0){this.worldSeed=worldSeed;this.random=random;this.status='ready';this.time=0;this.y=260;this.vy=0;this.x=108;this.radius=14;this.score=0;this.gates=0;this.perfect=0;this.streak=0;this.bestStreak=0;this.shield=false;this.ghost=0;this.obstacles=[];this.coins=[];this.winds=[];this.gold=0;this.lines=0;this.lineSeq=0;this.boost=0;this.diveCd=0;this.threads=0;this.lift=0;this.fp=false;this.daily=false;this.feats=[];this.perfectThreads=0;this.rushGold=0;this.saved=0;this.hurt=false;this.fpGates=0;this.events=[];this.reason='';this.spawn(480);}
 get heat(){return heatOf(this.gates,FULL_HEAT.flappy);}
 get twist(){return this.daily?FLAPPY_DAILY_TWIST(this.worldSeed):null;}
 // The ladder: a new sky every eight gates. stage counts skies cleared; zone is the sky you are in.
 get stage(){return Math.floor(this.gates/FLAPPY.zoneGates);}
 get zone(){return (this.stage+(this.twist?.shift||0))%FLAPPY.zones.length;}
 get stageName(){const lap=Math.floor(this.stage/FLAPPY.zones.length);return FLAPPY.zones[this.zone]+(lap?' '+'I'.repeat(Math.min(3,lap+1)):'');}
 get toNext(){return FLAPPY.zoneGates-this.gates%FLAPPY.zoneGates;}
 get speed(){return ramp(132,204,this.heat)*(this.boost>0?FLAPPY.boostSpeed:1)*(this.twist?.speed||1);}
 checkFeats(){for(const f of FLAPPY_FEATS)if(!this.feats.includes(f.id)&&f.test(this)){this.feats.push(f.id);this.events.push({type:'feat',id:f.id,name:f.name});}}
 // First person pays a quarter more for everything.
 award(n){const p=this.fp?Math.round(n*FLAPPY.firstPerson):n;this.score+=p;return p;}
 spawn(x){const gap=ramp(202,154,this.heat),last=this.obstacles.at(-1);let center=150+this.random()*245;if(this.worldSeed&&last)center=clamp(center,last.center-105,last.center+105);const o={x,center,gap,width:66,passed:false};if(this.worldSeed){o.baseCenter=center;o.amplitude=this.gates>=4?this.random()*ramp(12,32,this.heat):0;o.phase=this.random()*6.28;}this.obstacles.push(o);
  // Between two gates of a generated world: a thermal to ride, a downdraft in the storm, or a line of gold bent off the direct path.
  if(!this.worldSeed||!last)return;const from=last.x+last.width,stretch=x-from,zone=(Math.floor((this.gates+this.obstacles.length-1)/FLAPPY.zoneGates)+(this.twist?.shift||0))%FLAPPY.zones.length,r=this.random()/(this.twist?.wind||1),side=this.random()<.5?-1:1,line=++this.lineSeq,at=(t,dy)=>({x:from+stretch*t,y:clamp(last.center+(center-last.center)*t+dy,46,480),line,size:0,got:false}),coins=[];
  if(stretch>=200&&this.gates>=2&&r<(zone===2?.75:.4)){const down=zone===2&&side>0,w={x:from+12,w:70,f:down?1:-1};this.winds.push(w);if(!down)for(let i=0;i<3;i++)coins.push({...at(0,0),x:w.x+w.w*(.35+i*.4),y:clamp(last.center-34-i*30,46,480)});}
  else if(r<.9){const amp=(52+this.random()*30)*side;for(const t of [.2,.4,.6,.8])coins.push(at(t,amp*Math.sin(Math.PI*t)));}
  for(const c of coins){c.size=coins.length;this.coins.push(c);}}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 flap(){if(this.status!=='playing')return false;this.vy=-304;this.events.push({type:'flap',x:this.x,y:this.y});return true;}
 // Dive: drop hard and burn forward. Thread a gate before the burst fades for a bonus.
 dive(){if(this.status!=='playing'||this.diveCd>0)return false;this.vy=Math.max(this.vy,0)+330;this.boost=FLAPPY.boost;this.diveCd=FLAPPY.diveCooldown;this.events.push({type:'dive',x:this.x,y:this.y});return true;}
 // The result line carries the brag: how far up the ladder the run got.
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason+(this.gates?' You reached '+this.stageName+', gate '+this.gates+(this.threads?', and dived through '+this.threads:'')+'.':'');this.events.push({type:'over'});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;const speed=this.speed,hit=this.radius-2;this.boost=Math.max(0,this.boost-dt);this.diveCd=Math.max(0,this.diveCd-dt);
  // Winds: a thermal cancels most of gravity and carries DAWG up at a gentle, capped rate; a downdraft adds weight.
  let lift=0;for(const w of this.winds){w.x-=speed*dt;if(this.x>w.x&&this.x<w.x+w.w)lift=w.f;}this.lift=lift;
  this.vy+=(lift<0?130:lift>0?1100:880)*dt;if(lift<0)this.vy=Math.max(this.vy,-140);this.y+=this.vy*dt;
  // The sky is a soft ceiling: bump it and keep flying. Only towers and the street end a run.
  if(this.y-this.radius<10){this.y=10+this.radius;if(this.vy<0)this.vy=0;}this.ghost=Math.max(0,this.ghost-dt);
  for(const c of this.coins){c.x-=speed*dt;if(!c.got&&Math.hypot(c.x-this.x,c.y-this.y)<this.radius+13){c.got=true;this.gold++;const rush=this.zone===3,points=this.award((rush?10:5)*(this.twist?.gold||1));if(rush)this.rushGold++;let line=0;if(this.coins.filter(k=>k.line===c.line&&k.got).length===c.size){this.lines++;line=this.award(20);}this.events.push({type:'gold',points,line,rush,x:c.x,y:c.y});this.checkFeats();}}
  for(const o of this.obstacles){o.x-=speed*dt;if(o.baseCenter!==undefined)o.center=clamp(o.baseCenter+Math.sin(this.time*1.3+o.phase)*o.amplitude,150,395);
   if(this.ghost<=0&&this.x+hit>o.x&&this.x-hit<o.x+o.width&&(this.y-hit<o.center-o.gap/2||this.y+hit>o.center+o.gap/2)){
    // A shield (earned with three perfect rings in a row) breaks instead of the run, and DAWG phases through for a moment.
    if(this.shield){this.shield=false;this.hurt=true;this.ghost=.9;this.streak=0;this.events.push({type:'shield',got:false,x:this.x,y:this.y});}else{this.end(this.boost>0?'Dived straight into a tower. Line the gap up before you burn.':'Clipped a neon tower. Find your rhythm.');return;}}
   if(!o.passed&&o.x+o.width<this.x-this.radius){o.passed=true;const zone=this.zone;this.gates++;if(this.fp)this.fpGates++;if(this.hurt){this.hurt=false;this.saved++;}let points=this.award(this.twist?.gate||10);const perfect=Math.abs(this.y-o.center)<27+(this.career?.perfect||0),threaded=this.boost>0;let bonus=0;if(perfect){this.streak++;this.bestStreak=Math.max(this.bestStreak,this.streak);bonus=5*Math.min(this.streak,5);points+=this.award(bonus);this.perfect++;if(this.streak>=3&&!this.shield){this.shield=true;this.events.push({type:'shield',got:true,x:this.x,y:this.y});}}else this.streak=0;
    if(threaded){this.threads++;if(perfect)this.perfectThreads++;points+=this.award(perfect?25:15);}if(this.zone!==zone)this.events.push({type:'zone',zone:this.zone});this.events.push({type:'score',perfect,threaded,streak:this.streak,bonus,points,x:this.x,y:this.y});this.checkFeats();}
  }
  this.obstacles=this.obstacles.filter(o=>o.x+o.width>-20);this.coins=this.coins.filter(c=>c.x>-90);this.winds=this.winds.filter(w=>w.x+w.w>-20);const last=this.obstacles.at(-1);if(!last||last.x<420-260)this.spawn(last?last.x+(this.worldSeed?ramp(240,205,this.heat)+this.random()*60:260):480);trackHeat(this,this.heat);
  if(this.y+this.radius>520)this.end('The street came up fast. Tap sooner to stay above it.');
 }
}
function hash(n){let x=Math.imul(n^0x9e3779b9,0x85ebca6b);x^=x>>>13;return (Math.imul(x,0xc2b2ae35)>>>0)/4294967296;}
export function crossLane(row,seed=0){
 if(seed){const h=i=>worldHash(seed,row*31+i);if(row<=0||row%5===0||h(0)<.1)return {type:'park',row,coin:row>0&&row%5===0?Math.floor(h(1)*9):null};const river=h(2)<.3;const heat=heatOf(row,FULL_HEAT.cross);return {type:river?'river':'road',row,direction:h(3)>.5?1:-1,speed:(.68+h(4)*.55)*ramp(1,1.55,heat),length:river?ramp(2.9,2.2,heat):1.3+h(5)*.8,period:river?4.45:4.9+h(6)*1.5,phase:h(7)*6,color:Math.floor(h(8)*4)};}
 if(row<=0||row%5===0)return {type:'park',row,coin:row>0?Math.floor(hash(row+71)*9):null};
 const river=row%10===7||row%10===8,heat=heatOf(row,FULL_HEAT.cross);return {type:river?'river':'road',row,direction:row%2?1:-1,speed:(.72+hash(row+3)*.5)*ramp(1,1.55,heat),length:river?ramp(2.9,2.2,heat):1.3+hash(row+2)*.8,period:river?4.45:4.6+hash(row+1)*1.8,phase:hash(row+9)*6,color:Math.floor(hash(row+8)*4)};
}
export function laneObjects(lane,time){if(lane.type==='park')return [];const offset=((lane.phase+time*lane.speed*lane.direction)%lane.period+lane.period)%lane.period;const result=[];for(let x=offset-lane.period*2;x<12;x+=lane.period)result.push({x,width:lane.length});return result;}
export class CrossGame {
 constructor(worldSeed=0){this.worldSeed=worldSeed;this.status='ready';this.x=4;this.row=0;this.furthest=0;this.score=0;this.coins=0;this.time=0;this.idle=0;this.hop=0;this.from={x:4,row:0};this.collected=new Set();this.events=[];this.reason='';this.cause='';this.buffer=null;this.close=0;this.landed=false;this.warned=false;this.facing='up';this.sweep=-6;}
 get heat(){return heatOf(this.furthest,FULL_HEAT.cross);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 // A press during a hop is remembered and played the moment the hop lands, so fast taps never drop.
 move(dir){if(this.status!=='playing')return false;const d={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]}[dir];if(!d)return false;if(this.hop>0){this.buffer=dir;return true;}
  // Stepping off a floating deck onto solid ground lands on the nearest whole cell.
  const base=d[1]&&crossLane(this.row,this.worldSeed).type==='river'&&crossLane(this.row+d[1],this.worldSeed).type!=='river'?clamp(Math.round(this.x),0,8):this.x;
  const nx=base+d[0],nr=this.row+d[1];if(nx<0||nx>8||nr<0||nr<this.furthest-7)return false;this.from={x:this.x,row:this.row};this.x=nx;this.row=nr;this.hop=.13;this.idle=0;this.warned=false;this.landed=false;this.facing=dir;
  if(this.row>this.furthest){this.score+=(this.row-this.furthest)*10;this.furthest=this.row;this.landed=true;this.events.push({type:'step'});trackHeat(this,this.heat);}else this.events.push({type:'hop'});return true;}
 end(reason,cause=''){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.cause=cause;this.buffer=null;this.events.push({type:'over',cause});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;this.idle+=dt;this.hop=Math.max(0,this.hop-dt);const lane=crossLane(this.row,this.worldSeed),objects=laneObjects(lane,this.time);
  if(this.hop<=0){
   if(lane.type==='road'){if(objects.some(o=>this.x+.24>o.x&&this.x-.24<o.x+o.width)){this.end('That taxi had places to be. Watch the gaps.','car');return;}
    // Landing on a new row right beside a moving car is a close call: a small bonus for nerve.
    if(this.landed&&objects.some(o=>this.x+.24>o.x-.75&&this.x-.24<o.x+o.width+.75)){this.close++;this.score+=5;this.events.push({type:'close'});}}
   this.landed=false;
   if(lane.type==='river'){const log=objects.find(o=>this.x>o.x-.08&&this.x<o.x+o.width+.08);if(!log){this.end('The canal wins this round. Land on a floating deck.','water');return;}this.x+=lane.speed*lane.direction*dt;if(this.x<-.4||this.x>8.4){this.end('Your ride drifted off the block. Hop before the edge.','drift');return;}}
   if(lane.type==='park'&&lane.coin!==null&&Math.abs(this.x-lane.coin)<.45&&!this.collected.has(this.row)){this.collected.add(this.row);this.score+=25;this.coins++;this.events.push({type:'coin'});}
   if(this.buffer){const b=this.buffer;this.buffer=null;this.move(b);}
  }
  // The blackout: once you set off, the street shuts down behind you, faster as the heat rises, and never more than four rows back.
  if(this.furthest>0){this.sweep=Math.max(this.sweep+ramp(.45,1.1,this.heat)*dt,this.furthest-4);if(this.hop<=0&&this.sweep>=this.row){this.end('The blackout caught up. Keep ahead of the dark.','sweep');return;}}
  const limit=15+(this.career?.idle||0);if(!this.warned&&this.idle>=limit-5){this.warned=true;this.events.push({type:'hurry'});}
  if(this.idle>=limit)this.end('The night moved on. Keep hopping to stay in the game.','idle');
 }
}
export function stepPack(game,elapsed){if(!Number.isFinite(elapsed)||elapsed<=0)return;if(elapsed>.35){game.pause();return;}while(elapsed>0&&game.status==='playing'){const dt=Math.min(elapsed,1/120);game.tick(dt);elapsed-=dt;}}
export function packLayout(width,height,safe={}){const top=safe.top||0,bottom=safe.bottom||0,left=safe.left||0,right=safe.right||0;const landscape=width>height*1.18;const w=width-left-right-24,h=height-top-bottom-24;const availableW=w-(landscape?168:0),availableH=h-56-(landscape?0:92)-16;const stageWidth=Math.max(1,Math.floor(Math.min(480,availableW,availableH*.75)));return {landscape,stageWidth,stageHeight:stageWidth/.75};}
