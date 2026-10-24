// DAWG Turbo Pup: a seeded momentum platformer. The pup runs right on its own; the player
// jumps (↑), rolls or stomps (↓), boosts (→) and brakes (←). The course is a pure function of
// the world seed, built from chunks, so a checkpoint only needs the pup's own state.
// Units are meters and seconds; y points up and the base ground level is 0.
import {hash} from './world.js';
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';

export const TURBO={gravity:32,jump:13.5,stomp:-28,spring:24,boost:26,minSpeed:3,maxSpeed:34,loopRadius:6,loopMin:16,loopGravity:.35,body:.9};
const KINDS=[['hills',3],['dip',3],['loop',2],['spring',2],['pit',3],['kicker',2],['spikes',3],['bots',3],['flat',1]];
const WEIGHT=KINDS.reduce((n,[,w])=>n+w,0);
const LENGTH={flat:28,hills:40,dip:40,loop:34,spring:34,pit:28,kicker:38,spikes:26,bots:32};

function makeChunk(seed,k,x0){
 const h=i=>hash(seed,k*97+i+11),heat=heatOf(x0,FULL_HEAT.turbo);let kind='flat';
 if(k>=2){let r=h(1)*WEIGHT;for(const [name,w]of KINDS){if((r-=w)<0){kind=name;break;}}}
 if(k%9===8)kind='loop';
 const len=LENGTH[kind],c={k,x0,len,kind,amp:0,ramp:null,loop:null,pits:[],spikes:[],coins:[],bots:[],springs:[],boosts:[]};let n=0;
 const coin=(x,y)=>c.coins.push({id:k+':'+n++,x,y});
 // Coins along a jump arc from (x,1) at speed vx with launch vy, sampled every `step` meters.
 const arc=(x,vy,vx,count,step=2,base=1)=>{for(let i=1;i<=count;i++){const t=i*step/vx;coin(x+i*step,base+Math.max(.2,vy*t-TURBO.gravity*t*t/2));}};
 const bot=(x,i)=>c.bots.push({id:k+':b'+i,x,range:1.5+h(20+i)*1.5,speed:1.2+h(30+i)*1.4,phase:h(40+i)*6.28});
 if(kind==='flat'){for(let i=0;i<6;i++)coin(x0+8+i*2,1.1);if(k>=2&&h(2)<.3+heat*.5)bot(x0+20,0);}
 else if(kind==='hills'){c.amp=ramp(2.5,4.5,h(3));for(let i=0;i<5;i++){const x=x0+len*(.4+i*.05);coin(x,c.amp*(1-Math.cos(2*Math.PI*(x-x0)/len))/2+1.3);}}
 else if(kind==='dip'){c.amp=-ramp(3,5,h(3));c.boosts.push(x0+len*.5);for(let i=0;i<5;i++){const x=x0+len*(.4+i*.05);coin(x,c.amp*(1-Math.cos(2*Math.PI*(x-x0)/len))/2+1.1);}}
 else if(kind==='loop'){c.boosts.push(x0+5);c.loop={cx:x0+17};const R=TURBO.loopRadius;for(let i=1;i<10;i++){const p=i/10*Math.PI*2,r=R-TURBO.body;coin(c.loop.cx+r*Math.sin(p),R-r*Math.cos(p));}}
 else if(kind==='spring'){c.springs.push(x0+7);c.spikes.push([x0+11,x0+11+ramp(8,12,heat)]);arc(x0+7,TURBO.spring,15,8,2.5);}
 else if(kind==='pit'){const w=ramp(4.5,8,heat)+h(4)*1.5;c.pits.push([x0+10,x0+10+w]);arc(x0+8,TURBO.jump,14,5,2);}
 else if(kind==='kicker'){c.boosts.push(x0+3);c.ramp={x0:x0+6,x1:x0+11,h:2.5};const w=ramp(6,10,heat)+h(4)*1.5;c.pits.push([x0+11,x0+11+w]);arc(x0+11,9,18,6,2.4,3.4);}
 else if(kind==='spikes'){const L=ramp(1.5,3.5,heat);c.spikes.push([x0+12,x0+12+L]);arc(x0+10,TURBO.jump,14,4,1.8);}
 else if(kind==='bots'){const count=1+Math.floor(h(5)*ramp(1.5,3.2,heat));for(let i=0;i<count;i++)bot(x0+8+i*7,i);}
 return c;
}
// Chunks are cached per seed and built in order, so their start positions are stable.
const cache=new Map();
function chunks(seed){let list=cache.get(seed);if(!list){list=[];cache.set(seed,list);if(cache.size>6)cache.delete(cache.keys().next().value);}return list;}
export function turboChunk(seed,k){const list=chunks(seed);while(list.length<=k){const i=list.length,last=list[i-1];list.push(makeChunk(seed,i,last?last.x0+last.len:0));}return list[k];}
export function chunkAt(seed,x){
 if(x<0)return turboChunk(seed,0);const list=chunks(seed);if(!list.length)turboChunk(seed,0);
 while(list[list.length-1].x0+list[list.length-1].len<=x)turboChunk(seed,list.length);
 let lo=0,hi=list.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(list[mid].x0<=x)lo=mid;else hi=mid-1;}return list[lo];
}
export function groundIn(c,x){
 for(const [a,b]of c.pits)if(x>=a&&x<b)return null;
 if(c.ramp&&x>=c.ramp.x0&&x<c.ramp.x1)return c.ramp.h*(x-c.ramp.x0)/(c.ramp.x1-c.ramp.x0);
 return c.amp?c.amp*(1-Math.cos(2*Math.PI*(x-c.x0)/c.len))/2:0;
}
export const groundAt=(seed,x)=>groundIn(chunkAt(seed,x),x);
export function slopeAt(seed,x){const a=groundAt(seed,x-.05),b=groundAt(seed,x+.05);return a===null||b===null?0:(b-a)/.1;}

export class TurboGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.x=2;this.y=0;this.vx=8;this.vy=0;this.grounded=true;this.coyote=0;this.rolling=0;this.stomping=false;this.brake=0;this.boostCooldown=0;this.invuln=0;this.loop=null;this.gold=0;this.bonus=0;this.distance=0;this.bots=0;this.loops=0;this.collected=[];this.defeated=[];this.scatter=[];this.events=[];this.reason='';this.score=0;}
 get heat(){return heatOf(this.distance,FULL_HEAT.turbo);}
 get cruise(){return ramp(12,19,this.heat);}
 // The pup's body centre: one body-height off the track, along the loop's inward normal in a loop.
 get center(){if(this.loop){const R=TURBO.loopRadius;return {x:this.x+(this.loop.cx-this.x)/R*TURBO.body,y:this.y+(R-this.y)/R*TURBO.body};}return {x:this.x,y:this.y+TURBO.body};}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 move(dir){
  if(this.status!=='playing')return false;
  if(dir==='up'){if(this.loop||!(this.grounded||this.coyote>0))return false;this.vy=TURBO.jump;this.grounded=false;this.coyote=0;this.rolling=0;this.events.push({type:'jump'});return true;}
  if(dir==='down'){if(this.loop)return false;if(this.grounded){this.rolling=1.2;this.events.push({type:'roll'});}else{this.vy=Math.min(this.vy,TURBO.stomp);this.stomping=true;this.events.push({type:'stomp'});}return true;}
  if(dir==='right'){if(this.boostCooldown>0)return false;const v=Math.min(TURBO.maxSpeed,Math.max(this.vx+9,this.cruise+8));if(this.loop)this.loop.v0=Math.max(this.loop.v0,v);else this.vx=v;this.boostCooldown=2.5;this.events.push({type:'boost'});return true;}
  if(dir==='left'){this.brake=.45;this.events.push({type:'brake'});return true;}
  return false;
 }
 hurt(reason){
  if(this.invuln>0||this.status!=='playing')return;
  if(this.gold<=0){this.end(reason);return;}
  const lost=Math.min(this.gold,16),c=this.center;this.gold=0;this.invuln=2;this.loop=null;this.vy=9;this.grounded=false;this.rolling=0;this.stomping=false;this.vx=Math.max(4,this.vx*.5);
  for(let i=0;i<lost;i++){const a=Math.PI*(.15+.7*i/Math.max(1,lost-1));this.scatter.push({x:c.x,y:c.y,vx:Math.cos(a)*7+this.vx*.4,vy:Math.sin(a)*9,age:0});}
  this.events.push({type:'hurt',lost});
 }
 tick(dt){
  if(this.status!=='playing')return;this.time+=dt;const seed=this.worldSeed,prevX=this.x;
  this.coyote=Math.max(0,this.coyote-dt);this.rolling=Math.max(0,this.rolling-dt);this.brake=Math.max(0,this.brake-dt);this.boostCooldown=Math.max(0,this.boostCooldown-dt);this.invuln=Math.max(0,this.invuln-dt);
  if(this.loop){
   // Loops keep energy: speed drops with height (softened so a boosted pup always makes it).
   const R=TURBO.loopRadius,L=this.loop,h=R-R*Math.cos(L.phi),v=Math.sqrt(Math.max(L.v0*L.v0-2*TURBO.loopGravity*TURBO.gravity*h,49));
   L.phi+=v/R*dt;if(L.phi>=Math.PI*2){this.x=L.cx+.001;this.y=0;this.vx=L.v0;this.loop=null;this.loops++;this.bonus+=250;this.events.push({type:'loop'});}
   else{this.x=L.cx+R*Math.sin(L.phi);this.y=R-R*Math.cos(L.phi);this.vx=v;}
  }else if(this.grounded){
   const s=slopeAt(seed,this.x),sin=s/Math.sqrt(1+s*s),rolling=this.rolling>0;
   let a=this.vx<this.cruise?(rolling?4:9):-(rolling?1:3);a-=TURBO.gravity*sin*(rolling?1.3:.7);if(this.brake>0)a-=26;
   this.vx=Math.min(TURBO.maxSpeed,Math.max(TURBO.minSpeed,this.vx+a*dt));this.x+=this.vx*dt;
   const gy=groundAt(seed,this.x);if(gy===null){this.grounded=false;this.coyote=.1;this.vy=this.vx*s;
    // Kicker ramps always launch: leaving the tip throws the pup high and fast over the gap.
    const rc=chunkAt(seed,prevX);if(rc.ramp&&prevX>=rc.ramp.x0&&prevX<=rc.ramp.x1){this.vy=Math.max(this.vy,12);this.vx=Math.max(this.vx,22);this.events.push({type:'kicker'});}}else this.y=gy;
   // Crossing a loop's base at speed sends the pup around it.
   const c=chunkAt(seed,this.x);if(c.loop&&prevX<c.loop.cx&&this.x>=c.loop.cx&&this.vx>=TURBO.loopMin){this.loop={cx:c.loop.cx,phi:0,v0:this.vx};this.x=c.loop.cx;this.y=0;this.rolling=0;}
  }else{
   this.vy-=TURBO.gravity*dt;if(this.brake>0)this.vx=Math.max(TURBO.minSpeed,this.vx-12*dt);
   const nx=this.x+this.vx*dt,ny=this.y+this.vy*dt,gy=groundAt(seed,nx);
   if(gy!==null&&ny<=gy&&this.vy<=0){
    // Landing needs the pup to come down onto the surface; deep inside a pit it hits the wall.
    if(ny>=gy-.9){this.x=nx;this.y=gy;this.vy=0;this.grounded=true;this.events.push({type:this.stomping?'slam':'land'});this.stomping=false;}
    else{this.y=ny;this.vx=TURBO.minSpeed*.2;}
   }else{this.x=nx;this.y=ny;}
  }
  this.interact(prevX,dt);
  if(this.status!=='playing')return;
  if(this.y<-14){this.end('Fell into the neon abyss. Jump the gaps or boost the kickers.');return;}
  this.distance=Math.max(this.distance,this.x);this.score=Math.floor(this.distance)+this.bonus;trackHeat(this,this.heat);
  // Only nearby chunks' ids are kept, so saves stay small on long runs.
  const k=chunkAt(seed,this.x).k,keep=id=>parseInt(id,10)>=k-2;if(this.collected.length>64)this.collected=this.collected.filter(keep);if(this.defeated.length>32)this.defeated=this.defeated.filter(keep);
 }
 interact(prevX,dt){
  const seed=this.worldSeed,c=this.center,here=chunkAt(seed,this.x),near=[here.k?turboChunk(seed,here.k-1):null,here,turboChunk(seed,here.k+1)].filter(Boolean),lo=Math.min(prevX,this.x),hi=Math.max(prevX,this.x);
  for(const ch of near){
   if(this.grounded&&!this.loop){for(const sx of ch.springs)if(lo<sx&&sx<=hi){this.vy=TURBO.spring;this.grounded=false;this.rolling=0;this.events.push({type:'spring'});}
    for(const bx of ch.boosts)if(lo<bx&&bx<=hi){this.vx=Math.max(this.vx,TURBO.boost);this.events.push({type:'boostpad'});}}
   for(const coin of ch.coins)if(Math.hypot(coin.x-c.x,coin.y-c.y)<1.15&&!this.collected.includes(coin.id)){this.collected.push(coin.id);this.gold++;this.bonus+=10;this.events.push({type:'coin'});}
   for(const b of ch.bots){if(this.defeated.includes(b.id))continue;const bx=b.x+Math.sin(this.time*b.speed+b.phase)*b.range,by=(groundIn(ch,bx)??0)+.6;
    if(Math.abs(c.x-bx)<1.1&&Math.abs(c.y-by)<1.2){if(this.rolling>0||this.stomping||(!this.grounded&&this.vy<0)||this.loop){this.defeated.push(b.id);this.bots++;this.bonus+=100;if(!this.grounded&&!this.loop)this.vy=Math.max(this.vy,11);this.stomping=false;this.events.push({type:'bot'});}else{this.hurt('A patrol bot bonked you. Roll, stomp or jump on them.');if(this.status!=='playing')return;}}}
   if(!this.loop)for(const [a,b]of ch.spikes)if(c.x>a-.3&&c.x<b+.3&&this.y<.8&&this.y>-1){this.hurt('Spikes! Jump the red strips or spring over them.');if(this.status!=='playing')return;}
  }
  // Scattered gold bounces for a few seconds and can be grabbed back.
  for(const s of this.scatter){s.age+=dt;s.vy-=TURBO.gravity*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;const g=groundAt(seed,s.x);if(g!==null&&s.y<g+.3&&s.vy<0){s.y=g+.3;s.vy*=-.55;s.vx*=.8;}
   if(s.age>.5&&Math.hypot(s.x-c.x,s.y-c.y)<1.2){s.age=99;this.gold++;this.events.push({type:'coin',regained:true});}}
  this.scatter=this.scatter.filter(s=>s.age<4);
 }
}

const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b),ids=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(id=>typeof id==='string'&&/^\d{1,7}:b?\d{1,3}$/.test(id));
export const TURBO_FIELDS=['x','y','vx','vy','grounded','coyote','rolling','stomping','brake','boostCooldown','invuln','loop','gold','bonus','distance','bots','loops','collected','defeated'];
export function validTurboSnapshot(s){
 return num(s.x,0,1e8)&&num(s.y,-14,40)&&num(s.vx,0,TURBO.maxSpeed)&&num(s.vy,-60,60)&&typeof s.grounded==='boolean'&&num(s.coyote,0,.1)&&num(s.rolling,0,1.2)&&typeof s.stomping==='boolean'&&num(s.brake,0,.45)&&num(s.boostCooldown,0,2.5)&&num(s.invuln,0,2)
  &&(s.loop===null||s.loop&&num(s.loop.cx,0,1e8)&&num(s.loop.phi,0,Math.PI*2)&&num(s.loop.v0,0,TURBO.maxSpeed))&&int(s.gold,0,1e6)&&int(s.bonus,0,1e9)&&num(s.distance,s.x-TURBO.loopRadius-1,1e8)&&int(s.bots,0,1e6)&&int(s.loops,0,1e6)&&ids(s.collected,200)&&ids(s.defeated,100)
  &&s.score===Math.floor(s.distance)+s.bonus;
}
