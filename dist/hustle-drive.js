// Street Hustle's drive between districts: pure, seeded rules with no DOM or Three.js. A plan is
// built from the trade state (city seed, night, from → to, heat, weather); the sim steps at a fixed
// 60 Hz from player input (throttle, brake, steer) and ends as clean, escaped, tailed or busted.
// The renderer (hustle-drive-3d.js) only reads it; the trade engine takes the small outcome object.
import {seededRandom,hash} from './world.js';

export const STEP=1/60;
export const LANES=[-5.25,-1.75,1.75,5.25];          // two oncoming lanes on the left, two ours on the right
export const ROAD_HALF=7,CURB=8.6;                    // tarmac edge, then the sidewalk curb
export const TOP_SPEED=42,OFFROAD_SPEED=17;           // m/s (about 94 mph flat out)
export const DRIVE_CASH_CAP=400;                      // most a single drive can add to your cash
export const RESULTS=['clean','escaped','tailed','busted'];
// Where each district sits on the city map (for route length, the minimap and the compass).
export const DISTRICT_MAP=[[0,0],[1.1,-.9],[-1.2,-1.1],[.9,1],[-1,.9]];
// The look of each destination: the sky the drive heads into.
export const LOOKS=['sunset','neon','harbor','golden','midnight'];
export const RADIO=[
 {id:'palm',name:'Palm Static 104.2',tag:'sunset synth',track:'hustle'},
 {id:'kennel',name:'Kennel Club FM 88.7',tag:'late-night house',track:'cruise'},
 {id:'bark',name:'Bark Wave 97.1',tag:'outrun anthems',track:'turbo'},
 {id:'off',name:'Radio off',tag:'just the engine',track:null}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const int=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;

// Wanted stars from street heat (0–100).
export function wantedStars(heat){heat=Number(heat)||0;return heat>=80?5:heat>=60?4:heat>=40?3:heat>=22?2:heat>=10?1:0;}
// A drive's seed from the campaign: the same night and route always plays the same streets.
export function driveSeed(worldSeed,day,from,to){return Math.floor(hash((worldSeed>>>0)||1,day*25+from*5+to)*4294967295)>>>0||1;}

export function planDrive({seed=1,from=0,to=1,heat=0,day=1,weather=0}={}){
 const r=seededRandom(seed>>>0||1),a=DISTRICT_MAP[from]||DISTRICT_MAP[0],b=DISTRICT_MAP[to]||DISTRICT_MAP[1],stars=wantedStars(heat);
 const length=Math.round(620+Math.hypot(a[0]-b[0],a[1]-b[1])*300+r()*120);
 // Gentle boulevard bends: curvature bumps (radians per metre) that the road follows.
 const bends=[];for(let s=90+r()*60;s<length-60;s+=110+r()*140){bends.push({at:Math.round(s),len:Math.round(70+r()*90),k:+((r()<.5?-1:1)*(.0035+r()*.0075)).toFixed(5)});}
 // Traffic: ours drifts forward in the right lanes, oncoming fills the left; denser later in the month.
 const traffic=[],density=.019+Math.min(30,day)*.0006;
 for(let s=70;s<length+250;s+=1/density*(.6+r()*.8))traffic.push({lane:2+Math.floor(r()*2),s:Math.round(s),v:+(13+r()*10).toFixed(2),dir:1,kind:Math.floor(r()*6)});
 for(let s=160;s<length+1100;s+=1/density*(.8+r()*.9))traffic.push({lane:Math.floor(r()*2),s:Math.round(s),v:+(12+r()*9).toFixed(2),dir:-1,kind:Math.floor(r()*6)});
 // Cash drops along the way, spaced out; total well under the cap so near misses matter too.
 const pickups=[];for(let s=140+r()*80;s<length-40;s+=120+r()*110)pickups.push({s:Math.round(s),d:LANES[Math.floor(r()*4)],value:15+Math.floor(r()*5)*5});
 // With wanted stars, cruisers roll in behind you. With none, a parked patrol watches for speeders.
 const police=stars?Array.from({length:Math.min(3,Math.ceil(stars/2))},(_,i)=>({delay:+(1.5+i*2.2).toFixed(2),gap:120+i*35,d:LANES[2+(i%2)]})):[];
 const patrol=stars?null:{s:Math.round(length*(.35+r()*.35)),d:CURB+1.4};
 return {v:1,seed:seed>>>0||1,from,to,day,heat:Math.round(heat),stars,length,weather,look:LOOKS[to]||'sunset',bends,traffic,pickups,police,patrol,chaseSpeed:32+stars*1.8};
}
export function curvature(plan,s){let k=0;for(const b of plan.bends)if(s>b.at&&s<b.at+b.len)k+=b.k*Math.sin(Math.PI*(s-b.at)/b.len);return k;}
// The road's centreline in world space, sampled every `step` metres (heading h: 0 faces −z, + turns right).
const paths=new WeakMap();
export function roadPath(plan,step=2){if(paths.has(plan))return paths.get(plan);const pts=[],n=Math.ceil((plan.length+400)/step)+1;let x=0,z=0,h=0;
 for(let i=-Math.ceil(120/step);i<n;i++){const s=i*step;pts.push({s,x,z,h});}
 // Integrate forward from s = 0; the run-up before the start is straight.
 const start=pts.findIndex(p=>p.s===0);for(let i=start-1;i>=0;i--){pts[i].z=pts[i+1].z+step;pts[i].x=0;pts[i].h=0;}
 for(let i=start+1;i<pts.length;i++){const p=pts[i-1],k=curvature(plan,p.s+step/2);h=p.h+k*step;x=p.x+Math.sin((p.h+h)/2)*step;z=p.z-Math.cos((p.h+h)/2)*step;pts[i].x=x;pts[i].z=z;pts[i].h=h;}
 const out={step,first:pts[0].s,pts};paths.set(plan,out);return out;}
// World position and heading of road coordinates (s along, d to the right).
export function roadPoint(path,s,d=0){const f=(s-path.first)/path.step,i=clamp(Math.floor(f),0,path.pts.length-2),t=clamp(f-i,0,1),a=path.pts[i],b=path.pts[i+1],h=a.h+(b.h-a.h)*t;
 return {x:a.x+(b.x-a.x)*t+Math.cos(h)*d,z:a.z+(b.z-a.z)*t+Math.sin(h)*d,h};}

export class DriveSim {
 constructor(plan){this.plan=plan;this.t=0;this.acc=0;this.s=0;this.d=LANES[2];this.v=14;this.lat=0;this.cash=0;this.nearMisses=0;this.crashes=0;this.topSpeed=0;
  this.bust=0;this.lose=0;this.chased=false;this.escaped=false;this.done=false;this.result=null;this.events=[];this.auto=false;
  this.cars=plan.traffic.map(c=>({s:c.s,d:LANES[c.lane],v:c.v,dir:c.dir,kind:c.kind,cool:0,side:0,rel:Math.sign(c.s-0)||1}));
  this.pickups=plan.pickups.map(p=>({...p,taken:false}));
  this.cops=plan.police.map(p=>({s:-p.gap,gap:p.gap,d:p.d,v:0,active:false,delay:p.delay,cool:0,lost:false}));
  this.patrol=plan.patrol?{...plan.patrol,woke:false}:null;}
 get stars(){return this.escaped?0:this.cops.some(c=>c.active)?Math.max(1,this.plan.stars):0;}
 get progress(){return clamp(this.s/this.plan.length,0,1);}
 get chasing(){return this.cops.some(c=>c.active&&!c.lost);}
 // Feed real elapsed time; the sim runs whole fixed steps so the rules never depend on frame rate.
 advance(elapsed,input){this.acc=Math.min(this.acc+Math.max(0,elapsed),.25);let n=0;while(this.acc>=STEP&&!this.done){this.acc-=STEP;this.step(input);n++;}return n;}
 emit(type,extra={}){this.events.push({type,t:this.t,...extra});if(this.events.length>64)this.events.shift();}
 step(input={}){if(this.done)return;const dt=STEP,p=this.plan;this.t+=dt;
  const throttle=clamp(+input.throttle||0,0,1),brake=clamp(+input.brake||0,0,1),steer=clamp(+input.steer||0,-1,1);
  const off=Math.abs(this.d)>ROAD_HALF,limit=off?OFFROAD_SPEED:TOP_SPEED;
  let a=throttle*(this.v<20?13:this.v<32?9:5.5)-brake*28-this.v*.012-(throttle?0:2.2);if(this.v>limit)a=Math.min(a,-(this.v-limit)*2.5);
  this.v=clamp(this.v+a*dt,0,TOP_SPEED);this.topSpeed=Math.max(this.topSpeed,this.v);
  // Steering moves you across lanes; curves push you to the outside, faster means more push.
  const latRate=Math.min(9.5,2.2+this.v*.24),k=curvature(p,this.s);this.lat+=(steer*latRate-this.lat)*Math.min(1,dt*9);
  this.d+=(this.lat-k*this.v*this.v*.32)*dt;if(Math.abs(this.d)>CURB){this.d=Math.sign(this.d)*CURB;this.lat*=-.2;this.v*=.985;}
  this.s+=this.v*dt;
  // Traffic: cars hold their lane at their own speed, nudged aside after a bump.
  for(const c of this.cars){const gap=(c.s-this.s)*c.dir,inLane=Math.abs(c.d-this.d)<2.3;let v=c.v;
   // Drivers aren't suicidal: they ease off behind you, and dodge you if you're crawling in their lane.
   if(c.dir>0&&gap<0&&gap>-16&&inLane)v=Math.min(v,this.v*.95);if(c.dir<0&&gap<0&&gap>-40&&inLane&&this.v<16&&!c.side){c.side=c.d>-3.5?-1.3:1.3;}if(c.dir<0&&c.side)v*=.5;
   c.s+=v*c.dir*dt;if(c.side){c.d+=c.side*dt*3;c.side*=.97;if(Math.abs(c.side)<.05)c.side=0;}c.cool=Math.max(0,c.cool-dt);
   const ds=c.s-this.s,dd=c.d-this.d;
   if(Math.abs(ds)<4.3&&Math.abs(dd)<2.05&&!c.cool){c.cool=1.4;c.side=dd>=0?1.2:-1.2;this.crashes++;
    if(c.dir<0){this.v=Math.min(this.v,5);this.emit('crash',{hard:true});}else{this.v=Math.min(this.v,c.v*.7);this.emit('crash',{hard:false});}}
   const rel=Math.sign(ds)||c.rel;if(rel!==c.rel){if(rel<0&&!c.cool&&Math.abs(dd)<3&&this.v>18){this.nearMisses++;const bonus=c.dir<0?20:10;this.addCash(bonus);this.emit('near',{bonus,oncoming:c.dir<0});}c.rel=rel;}}
  for(const q of this.pickups)if(!q.taken&&Math.abs(q.s-this.s)<2.6&&Math.abs(q.d-this.d)<1.9){q.taken=true;this.addCash(q.value);this.emit('cash',{value:q.value});}
  // A parked patrol wakes up if you blow past it flat out or hit it.
  const pt=this.patrol;if(pt&&!pt.woke&&this.s>pt.s-3&&this.s<pt.s+3){const hit=Math.abs(pt.d-this.d)<2.2;if(this.v>36||hit){pt.woke=true;if(hit){this.crashes++;this.v=Math.min(this.v,6);this.emit('crash',{hard:true});}
   this.cops.push({s:pt.s-6,d:pt.d-1,v:this.v*.6,active:true,delay:0,cool:0,lost:false});this.chased=true;this.emit('spotted',{patrol:true});}}
  this.police(dt);
  if(this.s>=p.length&&!this.done)this.finish(this.chasing?'tailed':this.escaped?'escaped':'clean');}
 police(dt){const p=this.plan,speed=p.chaseSpeed;let close=false,any=false,far=true;
  for(const c of this.cops){if(c.lost)continue;
   if(!c.active){if(this.t>=c.delay){c.active=true;c.s=this.s-c.gap;c.v=this.v+4;if(!this.chased)this.emit('spotted',{});this.chased=true;}else continue;}
   any=true;c.cool=Math.max(0,c.cool-dt);
   // Aim at your lane, but swing out around traffic in the way.
   let target=this.d;for(const t of this.cars){const ahead=t.s-c.s;if(ahead>0&&ahead<26&&Math.abs(t.d-c.d)<2.3){target=c.d+(c.d>t.d?1:-1)*3.6;break;}}
   target=clamp(target,-ROAD_HALF+1,ROAD_HALF-1);c.d+=clamp(target-c.d,-6*dt,6*dt);
   const gap=this.s-c.s,goal=gap<12?Math.max(this.v-1.5,speed*.6):speed;c.v+=clamp(goal-c.v,-24*dt,10*dt);c.s+=c.v*dt;
   for(const t of this.cars)if(!c.cool&&Math.abs(t.s-c.s)<4.3&&Math.abs(t.d-c.d)<2){c.cool=1.2;c.v*=.4;t.side=t.d>c.d?1.2:-1.2;t.cool=1.4;this.emit('copcrash',{});}
   if(gap<11&&Math.abs(c.d-this.d)<3.4)close=true;if(gap<185)far=false;}
  if(!any)return;
  // Busted when they box you in at low speed; it drains again once you're moving.
  if(close&&this.v<11)this.bust+=dt;else this.bust=Math.max(0,this.bust-dt*.6);
  if(this.bust>=3){this.finish('busted');return;}
  // Lost them: stay well clear for a few seconds and they give up.
  if(far){this.lose+=dt;if(this.lose>=3.5){for(const c of this.cops)if(c.active)c.lost=true;this.escaped=true;this.lose=0;this.emit('lost',{});}}else this.lose=Math.max(0,this.lose-dt*2);}
 addCash(n){const room=DRIVE_CASH_CAP-this.cash;this.cash+=Math.max(0,Math.min(room,n));}
 finish(result){this.done=true;this.result=result;this.emit('finish',{result});}
 outcome(){return this.done?{v:1,result:this.result,cash:Math.round(this.cash),nearMisses:this.nearMisses,crashes:this.crashes,stars:this.chased?Math.max(1,this.plan.stars):this.plan.stars,seconds:Math.round(this.t)}:null;}
}

// A careful driver for auto-drive (accessibility) and tests: picks the clearest lane, grabs
// cash that's on the way, eases off behind slow cars and holds its line through bends.
export function autopilot(sim){const lanes=LANES.map((d,i)=>{let clear=200;for(const c of sim.cars){const ahead=c.s-sim.s;if(Math.abs(c.d-d)>2.4)continue;const closing=c.dir<0?ahead*.45:ahead;if(ahead>-6&&closing<clear)clear=Math.max(-6,closing);}return {d,clear:clear+(i>=2?30:0)-Math.abs(d-sim.d)*1.2};});
 let best=lanes.reduce((a,b)=>b.clear>a.clear?b:a);const here=lanes.reduce((a,b)=>Math.abs(b.d-sim.d)<Math.abs(a.d-sim.d)?b:a);if(here.clear>best.clear-10)best=here;
 let target=best.d;const cash=sim.pickups.find(q=>!q.taken&&q.s-sim.s>8&&q.s-sim.s<70);if(cash){const lane=lanes.find(l=>l.d===cash.d);if(lane&&lane.clear>(cash.s-sim.s)+8)target=cash.d;}
 const k=curvature(sim.plan,sim.s),comp=k*sim.v*sim.v*.32,latRate=Math.min(9.5,2.2+sim.v*.24),steer=clamp(((target-sim.d)*1.6+comp)/latRate,-1,1);
 let block=200;for(const c of sim.cars){const ahead=c.s-sim.s;if(ahead>0&&Math.abs(c.d-sim.d)<2.3)block=Math.min(block,c.dir<0?ahead*.5:ahead);}
 const trap=sim.patrol&&!sim.patrol.woke&&sim.patrol.s-sim.s<140&&sim.patrol.s-sim.s>-4,slowFor=block<14+sim.v*.55||trap&&sim.v>33;return {throttle:slowFor?0:1,brake:slowFor&&block<8+sim.v*.3?1:0,steer};}
// Runs a whole drive with a driver function (autopilot by default); returns the outcome.
export function simulateDrive(plan,driver=autopilot,maxSeconds=150){const sim=new DriveSim(plan);while(!sim.done&&sim.t<maxSeconds)sim.step(driver(sim));if(!sim.done)sim.finish(sim.chasing?'tailed':sim.escaped?'escaped':'clean');return sim.outcome();}
export function validDriveOutcome(o){return !!o&&typeof o==='object'&&RESULTS.includes(o.result)&&int(o.cash,0,DRIVE_CASH_CAP)&&int(o.nearMisses,0,999)&&(o.crashes===undefined||int(o.crashes,0,999))&&(o.stars===undefined||int(o.stars,0,5))&&(o.seconds===undefined||int(o.seconds,0,3600));}
