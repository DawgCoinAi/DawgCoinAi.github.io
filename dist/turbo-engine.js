// DAWG Turbo Pup: a seeded 3D momentum runner. The pup tears down a three-lane ribbon of track that
// banks, climbs, loops and corkscrews through the sky. The player steers between lanes (← →), jumps
// (↑, and ↑ again in the air to flip), rolls or stomps (↓) and holds turbo (Space) from a meter that
// gold and tricks refill. Speed is the game: clean running builds flow, hits cost speed and gold, and
// the clock only refills at checkpoints, so a slow run is a short run.
// The course is a pure function of the world seed, built chunk by chunk from hand-authored pieces, so
// a checkpoint only needs the pup's own state. Units are meters and seconds. `s` is distance along the
// track, `x` the sideways offset (right is positive) and `h` the height above the main deck.
import {hash} from './world.js';
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';

export const TURBO={lane:2.6,half:4.7,wallX:8.3,pipeHalf:10.2,pipeR:4.2,gravity:36,jump:12.5,flipTime:.44,stomp:-32,rollTime:.7,coyote:.12,buffer:.16,minSpeed:8,maxSpeed:62,loopLen:57,loopShift:11,twistR:2.6,deckH:5.2,deckUp:30,railH:1.25,checkpoint:700,clock:35,clockMax:60,comboWindow:3.5,maxCombo:10,ignite:.12,drain:.3,invuln:1.5,steer:24,body:.8};
// Points for each trick before the combo multiplier, and the turbo each one pays back.
export const TRICKS={flip:100,ring:80,smash:120,grind:60,loop:300,twist:300,wall:150,near:50,limbo:80,overtake:150,perfect:150,clean:50,air:40,slam:60};
const FUEL={flip:.1,ring:.08,smash:.12,grind:.05,loop:.25,twist:.25,wall:.12,near:.05,limbo:.06,overtake:.15,perfect:.15,clean:.04,air:.04,slam:.05};
// The ladder: four named zones, one per checkpoint, then round again a lap harder.
export const STAGES=['SUNSET BOARDWALK','NEON DOWNTOWN','STORM SKYWAY','AURORA REACH'];
export const stageName=i=>STAGES[((i%STAGES.length)+STAGES.length)%STAGES.length]+(i>=STAGES.length?' · LAP '+(Math.floor(i/STAGES.length)+1):'');
// The three rivals: names and a pace of their own, so passing one is personal.
export const RIVALS=[{name:'BLITZ',pace:1.02},{name:'COMET',pace:1.07},{name:'DYNAMO',pace:1.12}];
// Feats: specific things to pull off in a run. The engine emits {type:'feat', id} the first time each lands.
export const FEATS=[
 {id:'turbo.flip3',name:'Triple Dog Dare',text:'Land three flips from one jump.'},
 {id:'turbo.perfect3',name:'Stuck It',text:'Three perfect landings in one run.'},
 {id:'turbo.combo10',name:'Maxed Out',text:'Build the combo to ×10.'},
 {id:'turbo.clean',name:'Untouchable',text:'Run a whole zone, checkpoint to checkpoint, without a hit.'},
 {id:'turbo.highroad',name:'High Roller',text:'Ride a high road from its on-ramp to the launch at its end.'},
 {id:'turbo.rail',name:'Rail Rider',text:'Grind 40 m of rail without stepping off.'},
 {id:'turbo.wall',name:'Wall Crawler',text:'Ride a half-pipe wall for 60 m.'},
 {id:'turbo.pack',name:'Leader of the Pack',text:'Pass ten rivals in one run.'},
 {id:'turbo.mach',name:'Mach Pup',text:'Hit 300 km/h: full flow, turbo and a boost pad, deep into a run.'},
 {id:'turbo.bots',name:'Bot Breaker',text:'Smash five patrol bots in one run.'},
 {id:'turbo.tour',name:'World Tour',text:'Reach Aurora Reach, the fourth zone.'},
 {id:'turbo.lap',name:'Round Again',text:'Lap all four zones and reach the Boardwalk a second time.'}];
export const FEAT_IDS=FEATS.map(f=>f.id);
// Today's twist: one rule bent for a seeded daily course. Applied only when game.daily is true.
const TWISTS=[
 {id:'feather',name:'FEATHERWEIGHT',text:'Light gravity: every jump hangs longer.'},
 {id:'goldrush',name:'GOLD RUSH',text:'Gold fills the turbo twice as fast.'},
 {id:'tailwind',name:'TAILWIND',text:'Everything is faster, and checkpoints give 2 s less.'},
 {id:'rivalry',name:'GRUDGE MATCH',text:'Rivals run hotter and passing one pays triple.'}];
export const DAILY_TWIST=seed=>TWISTS[Math.floor(hash(seed>>>0,7717)*TWISTS.length)];
export const kmh=v=>Math.round(v*5.2);
const LW=TURBO.lane,TAU=Math.PI*2,BANK=.62;
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x),ease=u=>u<=0?0:u>=1?1:u-Math.sin(TAU*u)/TAU,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const KINDS=[['sweep',4],['rows',3],['hill',3],['jump',3],['rail',3],['split',3],['pipe',2.2],['spring',2],['twist',.6],['loop',.6]];
const WEIGHT=KINDS.reduce((n,[,w])=>n+w,0);
const LENGTH={start:80,rows:110,sweep:110,hill:110,jump:140,rail:130,pipe:150,split:200,spring:100,twist:120,loop:120};
const OPENERS=['start','rows','jump','loop','sweep','rail','split'];

// ── Geometry. Heading (psi), pitch (theta) and roll (rho) are closed-form in s, so the track frame at
// any point needs only the chunk; positions are integrated once per chunk at one-meter steps.
export function anglesIn(c,s){
 const u=clamp((s-c.s0)/c.len,0,1);let psi=c.psi0+c.yaw*smooth(u),th=c.pitchA*Math.sin(TAU*u)+c.climbA*Math.sin(Math.PI*u)**2,rho=-BANK*c.yaw*Math.sin(Math.PI*u)**2;
 if(c.loop)th+=TAU*clamp((s-c.loop[0])/(c.loop[1]-c.loop[0]),0,1);
 if(c.twist)rho+=TAU*ease((s-c.twist[0])/(c.twist[1]-c.twist[0]));
 return [psi,th,rho];
}
function basis(psi,th,rho){
 const sp=Math.sin(psi),cp=Math.cos(psi),st=Math.sin(th),ct=Math.cos(th),sr=Math.sin(rho),cr=Math.cos(rho);
 const t=[sp*ct,st,cp*ct],u0=[-sp*st,ct,-cp*st],r0=[-cp,0,sp];
 return {t,u:[cr*u0[0]+sr*r0[0],cr*u0[1]+sr*r0[1],cr*u0[2]+sr*r0[2]],r:[cr*r0[0]-sr*u0[0],cr*r0[1]-sr*u0[1],cr*r0[2]-sr*u0[2]],u0};
}
function integrate(c,p0){
 const P=new Float64Array((c.len+1)*3);P.set(p0,0);let [x,y,z]=p0;
 for(let i=0;i<c.len;i++){const s=c.s0+i+.5,[psi,th]=anglesIn(c,s),ct=Math.cos(th);x+=Math.sin(psi)*ct;y+=Math.sin(th);z+=Math.cos(psi)*ct;
  // A loop drifts sideways as it goes round, so the way out clears the way in.
  if(c.loop&&s>c.loop[0]&&s<c.loop[1]){const k=TURBO.loopShift/(c.loop[1]-c.loop[0]);x+=-Math.cos(psi)*k;z+=Math.sin(psi)*k;}
  P[i*3+3]=x;P[i*3+4]=y;P[i*3+5]=z;}
 return P;
}
/** Position and orientation of the track at s: p (centre of the deck), t (forward), u (up), r (right). */
export function frameIn(c,s){
 const ls=s-c.s0,i=clamp(Math.floor(ls),0,c.len-1),f=ls-i,P=c.P,a=i*3,[psi,th,rho]=anglesIn(c,s),b=basis(psi,th,rho);
 const p=[P[a]+(P[a+3]-P[a])*f,P[a+1]+(P[a+4]-P[a+1])*f,P[a+2]+(P[a+5]-P[a+2])*f];
 // A corkscrew rolls around an axis above the deck, so the ribbon winds like a helix.
 if(c.twist&&s>c.twist[0]&&s<c.twist[1]){const R=TURBO.twistR;for(let k=0;k<3;k++)p[k]+=R*(b.u0[k]-b.u[k]);}
 return {p,t:b.t,u:b.u,r:b.r,psi,th,rho};
}
export const courseFrame=(seed,s)=>frameIn(chunkAt(seed,s),s);
// The deck's cross-section inside a half-pipe: flat across the three lanes, curling up into a wall beyond them.
export function crossSection(x){const F=TURBO.half,a=Math.abs(x);if(a<=F)return [x,0,0];const R=TURBO.pipeR,t=(a-F)/R,sg=Math.sign(x);return [sg*(F+R*Math.sin(t)),R*(1-Math.cos(t)),sg*t];}
// Half-width of the deck at s: wider inside a half-pipe, where the walls can be ridden.
export function halfWidthIn(c,s){if(!c.pipe)return TURBO.half;const [a,b]=c.pipe;return TURBO.half+(TURBO.pipeHalf-TURBO.half)*smooth(Math.min((s-a)/14,(b-s)/14));}
// Sideways position of lane l: lanes ±2 are the half-pipe walls; a high deck counts lanes outward.
export const laneX=(c,l)=>c.pipe&&Math.abs(l)===2?Math.sign(l)*TURBO.wallX:l*LW;
export function deckHeight(d,s){if(s<d.s0||s>d.s1)return null;for(const [a,b]of d.gaps)if(s>a&&s<b)return null;return TURBO.deckH*smooth((s-d.s0)/TURBO.deckUp);}
export function railHeight(r,s){if(s<r.s0||s>r.s1)return null;return TURBO.railH*Math.min(1,(s-r.s0)/6,(r.s1-s)/6);}
export const pitchAt=(seed,s)=>anglesIn(chunkAt(seed,s),s)[1];

function makeChunk(seed,k,prev){
 const s0=prev?prev.s0+prev.len:0,H=i=>hash(seed,k*131+i+17),heat=heatOf(s0,FULL_HEAT.turbo),psi0=prev?prev.psi1:0,y0=prev?prev.P[prev.len*3+1]:0;
 let kind=OPENERS[k];
 if(!kind){let r=H(1)*WEIGHT;for(const [name,w]of KINDS){if((r-=w)<0){kind=name;break;}}
  // Never the same piece twice running, and a loop or corkscrew at least every eight chunks.
  if(k%8===3)kind=(k%16===3)===(prev.kind!=='loop')?'loop':'twist';
  else if(kind===prev.kind)kind=KINDS[(KINDS.findIndex(([n])=>n===kind)+1)%KINDS.length][0];}
 const len=LENGTH[kind],a=s0,c={k,s0,len,kind,psi0,yaw:0,pitchA:0,climbA:0,loop:null,twist:null,pipe:null,gaps:[],decks:[],rails:[],ramps:[],springs:[],pads:[],coins:[],hazards:[],rings:[],signs:[]};
 let n=0;const lanes=[-1,0,1];
 const coin=(s,l,h=.9)=>c.coins.push({id:k+':'+n++,s,l,h});
 const line=(s,l,count,gap=3,h=.9)=>{for(let i=0;i<count;i++)coin(s+i*gap,l,h);};
 const hz=(type,s,lane,extra={})=>c.hazards.push({id:k+':h'+c.hazards.length,type,s,lane,...extra});
 const ring=(s,l,h)=>c.rings.push({id:k+':r'+c.rings.length,s,l,h});
 // Coins along the flight from a launch at s with speed v and lift vy.
 const arc=(s,l,vy,v,count,base=0)=>{const T=2*vy/TURBO.gravity;for(let i=1;i<=count;i++){const t=T*i/(count+1);coin(s+v*t,l,base+vy*t-TURBO.gravity*t*t/2+.9);}};
 // Hazard rows: every row leaves a way through (a free lane, a jump or a roll) and the gold marks it.
 const rows=(from,to,{easy=false,only=lanes}={})=>{const gap=ramp(38,25,heat);let i=0;for(let s=from;s<=to;s+=gap,i++){
  const r=H(40+i*5),lane=only[Math.floor(H(41+i*5)*only.length)],rest=only.filter(l=>l!==lane),other=rest[Math.floor(H(42+i*5)*rest.length)]??lane;
  const pool=easy||k<5?['block','spikes','block']:heat<.4?['block','spikes','bar','bot','hurdle','block2']:['block2','spikes2','bar','bot','hurdle','block2','bot','bar'],type=pool[Math.floor(r*pool.length)];
  if(type==='block'){hz('block',s,lane);line(s-9,other,6,3);}
  else if(type==='block2'){for(const l of rest)hz('block',s,l);line(s-9,lane,6,3);}
  else if(type==='spikes'){hz('spikes',s,lane,{len:7});for(let j=0;j<3;j++)coin(s+1.5+j*2,lane,2);}
  else if(type==='spikes2'){for(const l of rest)hz('spikes',s,l,{len:7});line(s-6,lane,6,3);}
  else if(type==='bar'){hz('bar',s,null);line(s-9,other,6,3);}
  else if(type==='hurdle'){hz('hurdle',s,null);for(let j=-1;j<=1;j++)coin(s+j*3,other,1.9);}
  else hz('bot',s,0,{amp:LW,sp:1.4+H(43+i*5)*1.2,ph:H(44+i*5)*TAU});}};
 // Sweeps steer back toward the course's overall heading so the ribbon never doubles back on itself.
 const turn=mag=>(Math.abs(psi0)>.45?-Math.sign(psi0):H(2)<.5?-1:1)*mag;
 // Climbs and dives keep the ribbon inside a band of sky.
 const lift=mag=>(y0>18?-1:y0<-10?1:H(3)<.5?-1:1)*mag;
 if(kind==='start'){line(a+24,0,9,3);c.pads.push({s:a+60,lane:null});line(a+64,0,4,3);}
 else if(kind==='rows'){c.yaw=turn(.22);c.climbA=lift(.06);rows(a+20,a+len-22,{easy:k<3});c.pads.push({s:a+len-12,lane:Math.floor(H(5)*3)-1});}
 else if(kind==='sweep'){c.yaw=turn(ramp(.65,1,H(4)));const inside=c.yaw>0?-1:1;c.climbA=lift(.05);line(a+12,inside,8,3.2);rows(a+48,a+len-24);c.pads.push({s:a+len-10,lane:inside});}
 else if(kind==='hill'){c.pitchA=lift(ramp(.16,.22,H(4)));c.yaw=turn(.2);rows(a+18,a+len-30);c.pads.push({s:a+len*(c.pitchA>0?.56:.5),lane:null});line(a+len*.58,Math.floor(H(6)*3)-1,6,3);}
 else if(kind==='jump'){
  // The set piece: boost pads into a full-width kicker on the climb, a gap in the sky with hoops in
  // it, and a long clear landing. The kicker always throws the pup far enough.
  c.pitchA=.24;c.yaw=turn(.18);c.pads.push({s:a+12,lane:null});line(a+16,0,8,3.4);const R=a+52;c.ramps.push({s:R,lane:null,vy:16.5,vmin:40,big:true});c.gaps.push([R+3,R+29]);
  arc(R,0,16.5,40,7);ring(R+18,0,4.6);ring(R+10,-1,3.6);ring(R+26,1,3.6);line(R+44,0,6,3);rows(R+68,a+len-12);}
 else if(kind==='rail'){
  c.yaw=turn(.25);const l1=Math.floor(H(4)*3)-1,l2=lanes.filter(l=>l!==l1)[Math.floor(H(5)*2)],rail=(s,e,lane)=>{c.rails.push({id:k+':g'+c.rails.length,s0:s,s1:e,lane});hz('spikes',s+9,lane,{len:e-s-18});for(let x=s+8;x<e-6;x+=4)coin(x,lane,TURBO.railH+.9);};
  rail(a+22,a+70,l1);rail(a+62,a+len-18,l2);hz('block',a+58,lanes.find(l=>l!==l1&&l!==l2));c.pads.push({s:a+len-8,lane:l2});}
 else if(kind==='pipe'){
  // A half-pipe: the floor is a mess of barriers, the walls are the clean, fast, golden line.
  c.pipe=[a+12,a+len-12];c.climbA=lift(.05);for(let s=a+34,i=0;s<a+len-36;s+=ramp(26,20,heat),i++){const free=Math.floor(H(60+i)*3)-1;if(H(80+i)<.4)for(const l of lanes)hz('spikes',s,l,{len:6});else for(const l of lanes)if(l!==free)hz('block',s,l);}
  for(const side of [-2,2]){for(let s=a+36;s<a+len-36;s+=4)coin(s,side,1);c.pads.push({s:a+30,lane:side},{s:a+len*.55,lane:side});}line(a+len-26,0,5,3);}
 else if(kind==='split'){
  // High road or low road. The outer lane peels up into a deck in the sky: more gold, boost pads and
  // gaps to jump, ending in a launch. Miss a gap and you drop back to the low road unharmed.
  const side=H(4)<.5?-1:1,D={id:k+':d0',s0:a+26,s1:a+len-52,side,gaps:[]},g1=a+82+H(5)*8;D.gaps.push([g1,g1+7]);if(heat>.3){const g2=g1+26;D.gaps.push([g2,g2+ramp(7,9,heat)]);}c.decks.push(D);c.yaw=turn(.2);
  c.signs.push({s:a+8,side,text:'HIGH ROAD'});for(const l of [1,3]){const top=TURBO.deckH+.9;for(let s=D.s0+TURBO.deckUp+4;s<D.s1-6;s+=3.2)if(!D.gaps.some(([p,q])=>s>p-2&&s<q+2))coin(s,side*l,top);}
  for(const [p,q]of D.gaps)ring((p+q)/2,side*2,TURBO.deckH+2.6);c.pads.push({s:D.s0+TURBO.deckUp+10,lane:side*2,d:1},{s:D.s0+TURBO.deckUp+34,lane:side*2,d:1});
  c.ramps.push({s:D.s1-3,lane:null,d:1,vy:14,vmin:42,big:true});ring(D.s1+16,side,TURBO.deckH+3);ring(D.s1+30,0,TURBO.deckH+1.5);line(a+12,side,4,3);
  rows(a+44,D.s1-10,{only:[0,-side]});line(a+len-26,0,6,3);}
 else if(kind==='spring'){const l=Math.floor(H(4)*3)-1;c.yaw=turn(.2);c.springs.push({s:a+26,lane:l});line(a+12,l,4,3);arc(a+26,l,22,34,8);ring(a+26+20,l,7.2);for(const o of lanes)if(o!==l)hz('block',a+44,o);rows(a+72,a+len-12);}
 else if(kind==='twist'){c.twist=[a+24,a+len-24];c.pads.push({s:a+8,lane:null});for(let s=a+26,i=0;s<a+len-26;s+=3.5,i++)coin(s,[-1,0,1,0][Math.floor(i/4)%4],.9);}
 else if(kind==='loop'){c.loop=[a+26,a+26+TURBO.loopLen];c.pads.push({s:a+8,lane:null});for(let s=a+12;s<a+len-8;s+=3.6)coin(s,0,.9);}
 c.psi1=psi0+c.yaw;c.P=integrate(c,prev?[prev.P[prev.len*3],prev.P[prev.len*3+1],prev.P[prev.len*3+2]]:[0,0,0]);
 return c;
}
// Chunks are cached per seed and built in order, so their start positions are stable.
const cache=new Map();
function chunks(seed){let list=cache.get(seed);if(!list){list=[];cache.set(seed,list);if(cache.size>6)cache.delete(cache.keys().next().value);}return list;}
export function turboChunk(seed,k){const list=chunks(seed);while(list.length<=k){const i=list.length;list.push(makeChunk(seed,i,list[i-1]));}return list[k];}
export function chunkAt(seed,s){
 if(s<0)return turboChunk(seed,0);const list=chunks(seed);if(!list.length)turboChunk(seed,0);
 while(list[list.length-1].s0+list[list.length-1].len<=s)turboChunk(seed,list.length);
 let lo=0,hi=list.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(list[mid].s0<=s)lo=mid;else hi=mid-1;}return list[lo];
}
const locked=(c,s)=>!!(c.loop&&s>=c.loop[0]&&s<c.loop[1]||c.twist&&s>=c.twist[0]&&s<c.twist[1]);
const onDeckLanes=(d,x)=>{const v=x*d.side;return v>LW-1.5&&v<LW*3+1.5;};
/** The surface under a pup at (s, x) that is at height h: the main deck, a high deck or a rail; null over a gap. */
export function floorIn(c,s,x,h){
 let f=c.gaps.some(([a,b])=>s>a&&s<b)?null:0;
 for(const d of c.decks){const y=deckHeight(d,s);if(y!==null&&onDeckLanes(d,x)&&h>=y-.7&&(f===null||y>f))f=y;}
 for(const r of c.rails){const y=railHeight(r,s);if(y!==null&&Math.abs(x-r.lane*LW)<1.2&&h>=y-.55&&(f===null||y>f))f=y;}
 return f;
}

export class TurboGame {
 constructor(random=Math.random,worldSeed=0){
  Object.assign(this,{random,worldSeed,status:'ready',time:0,s:0,x:0,lane:0,h:0,vy:0,v:20,grounded:true,coyote:0,jumpBuffer:0,rolling:0,stomping:false,flip:0,flips:0,flipDone:9,air:0,grind:false,grindDist:0,wall:0,
   fuel:.35,boostHeld:false,boostMin:0,combo:0,comboTime:0,bestCombo:0,flow:0,invuln:0,clock:TURBO.clock,cp:1,gold:0,bonus:0,distance:0,hits:0,smashes:0,loops:0,passed:0,tricks:0,collected:[],smashed:[],
   rivals:[0,1,2].map(i=>({id:i,s:34+i*26,lane:i-1,x:(i-1)*LW,gen:0})),feats:[],topSpeed:0,zoneHits:0,perfects:0,wallDist:0,railDist:0,deckRide:false,daily:false,events:[],reason:'',score:0});
 }
 get twist(){return this.daily?DAILY_TWIST(this.worldSeed).id:'';}
 get gravity(){return TURBO.gravity*(this.twist==='feather'?.74:1);}
 feat(id){if(this.feats.includes(id))return;this.feats.push(id);this.events.push({type:'feat',id});}
 // What the run came to, for the result screen: how far up the ladder and the best moments.
 summary(){return 'ZONE '+(this.zone+1)+' · '+stageName(this.zone)+' · '+Math.floor(this.distance)+' m · top speed '+kmh(this.topSpeed)+' km/h · best combo ×'+Math.min(TURBO.maxCombo,this.bestCombo);}
 get chunk(){return chunkAt(this.worldSeed,this.s);}
 get heat(){return heatOf(this.distance,FULL_HEAT.turbo);}
 get pace(){return ramp(24,31,this.heat)+(this.twist==='tailwind'?4:0);}
 get cruise(){return this.pace+this.flow*6;}
 get boosting(){return (this.boostHeld||this.boostMin>0)&&this.fuel>0&&this.status==='playing';}
 get zone(){return Math.floor(this.distance/TURBO.checkpoint);}
 // Music intensity and the shell's stat line read these.
 get speed(){return 25+(this.v-26)*.55;}
 get locked(){return locked(this.chunk,this.s);}
 get onDeck(){return this.h>2.5&&this.chunk.decks.length>0;}
 // Lanes the pup may steer into right now: three on the deck, the walls in a half-pipe, the high deck's own three.
 laneRange(){const c=this.chunk;if(c.pipe&&halfWidthIn(c,this.s)>TURBO.wallX+.9)return [-2,2];
  for(const d of c.decks){const y=deckHeight(d,this.s);if(y!==null&&this.h>=y-.7&&this.s>d.s0+4)return d.side>0?[-1,3]:[-3,1];}
  return [-1,1];}
 fuelUp(n){this.fuel=Math.min(1,this.fuel+n);}
 // A trick scores its points times the combo, tops up the turbo and keeps the combo alive.
 trick(name,points=TRICKS[name],extra={}){this.combo=this.comboTime>0?this.combo+1:1;this.comboTime=TURBO.comboWindow;this.bestCombo=Math.max(this.bestCombo,this.combo);if(this.combo>=TURBO.maxCombo)this.feat('turbo.combo10');const mult=Math.min(TURBO.maxCombo,this.combo),total=points*mult;this.bonus+=total;this.tricks++;this.fuelUp(FUEL[name]||0);this.events.push({type:name,points:total,combo:this.combo,...extra});}
 breakCombo(){if(this.combo>=3)this.events.push({type:'combobreak',n:this.combo});this.combo=0;this.comboTime=0;}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing'){this.status='paused';this.boostHeld=false;}}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.boostHeld=false;this.events.push({type:'over'});}
 // Turbo is held: it burns the meter for as long as the button is down.
 press(dir,down){if(dir!=='boost')return down?this.move(dir):false;if(!down){this.boostHeld=false;return true;}if(this.status!=='playing')return false;this.boostHeld=true;if(this.fuel<TURBO.ignite){this.events.push({type:'empty'});return false;}if(this.boostMin<=0)this.events.push({type:'boost'});this.boostMin=.45;return true;}
 move(dir){
  if(this.status!=='playing')return false;
  if(dir==='boost'){const ok=this.press('boost',true);this.boostHeld=false;return ok;}
  if(dir==='left'||dir==='right'){const [lo,hi]=this.laneRange(),next=clamp(this.lane+(dir==='left'?-1:1),lo,hi);if(next===this.lane){this.events.push({type:'edge'});return false;}this.lane=next;this.events.push({type:'lane',dir});return true;}
  if(dir==='up'){
   if(this.locked)return false;
   if(this.grounded||this.coyote>0){this.jumpBuffer=0;this.launch(this.grind?TURBO.jump*1.08:TURBO.jump);this.events.push({type:'jump'});return true;}
   // In the air ↑ flips. A flip has to finish before the pup lands.
   if(this.flip===0&&!this.stomping&&this.h>.6){this.flip=.001;this.events.push({type:'flipstart'});return true;}
   // Pressed a moment before landing: remembered, and the pup jumps as it touches down.
   this.jumpBuffer=TURBO.buffer;return false;}
  if(dir==='down'){if(this.locked)return false;if(this.grounded){this.rolling=TURBO.rollTime;this.v=Math.min(TURBO.maxSpeed,this.v+3);this.events.push({type:'roll'});}else{this.vy=Math.min(this.vy,TURBO.stomp);this.stomping=true;this.flip=0;this.events.push({type:'stomp'});}return true;}
  return false;
 }
 launch(vy){this.vy=vy;this.grounded=false;this.coyote=0;this.rolling=0;this.grind=false;this.wall=0;this.flips=0;this.flip=0;this.air=0;this.stomping=false;}
 // A hit never ends the run: it scatters gold, kills the speed and the flow. With no gold it costs time.
 hurt(why){
  if(this.invuln>0||this.status!=='playing')return false;
  const lost=Math.min(this.gold,12+Math.floor(this.gold/4)),time=lost?0:3;this.gold-=lost;this.clock=Math.max(0,this.clock-time);this.v=Math.max(TURBO.minSpeed,this.v*.45);this.invuln=TURBO.invuln;this.flow=0;this.hits++;this.zoneHits++;this.flip=0;this.rolling=0;this.stomping=false;this.boostMin=0;
  this.breakCombo();this.events.push({type:'hurt',lost,time,why});return true;
 }
 land(floor){
  const air=this.air;this.h=floor;this.vy=0;this.grounded=true;
  if(this.stomping){this.stomping=false;this.trick('slam');for(const c of this.near())for(const b of c.hazards)if(b.type==='bot'&&Math.abs(b.s-this.s)<9&&!this.smashed.includes(b.id))this.smash(b);}
  else if(this.flip>0&&this.flip<.8){this.flip=0;this.v=Math.max(TURBO.minSpeed,this.v*.72);this.flow*=.5;this.breakCombo();this.events.push({type:'stumble'});}
  else{if(this.flip>0){this.flip=0;this.flips++;this.trick('flip',TRICKS.flip*this.flips,{n:this.flips});this.flipDone=0;}
   // Touching down the instant a flip comes round is a perfect landing; any flipped landing is a clean one.
   if(this.flips>=3)this.feat('turbo.flip3');
   if(this.flips>0&&this.flipDone<.16){this.trick('perfect');if(++this.perfects>=3)this.feat('turbo.perfect3');this.v=Math.min(TURBO.maxSpeed,this.v+6);}
   else if(this.flips>0){this.trick('clean',TRICKS.clean*this.flips);this.v=Math.min(TURBO.maxSpeed,this.v+2);}
   else this.events.push({type:'land',hard:air>.8});}
  this.flips=0;this.air=0;
 }
 smash(b){this.smashed.push(b.id);this.smashes++;if(this.smashes>=5)this.feat('turbo.bots');this.trick('smash',TRICKS.smash,{id:b.id});}
 near(){const seed=this.worldSeed,c=chunkAt(seed,this.s);return c.k&&this.s-c.s0<12?[turboChunk(seed,c.k-1),c]:[c];}
 tick(dt){
  if(this.status!=='playing')return;const seed=this.worldSeed,prev=this.s;this.time+=dt;
  this.coyote=Math.max(0,this.coyote-dt);this.rolling=Math.max(0,this.rolling-dt);this.invuln=Math.max(0,this.invuln-dt);this.boostMin=Math.max(0,this.boostMin-dt);this.flipDone=Math.min(9,this.flipDone+dt);
  if(this.comboTime>0&&(this.comboTime-=dt)<=0)this.breakCombo();
  let c=chunkAt(seed,this.s);const lock=locked(c,this.s),boosting=this.boosting;
  // Speed: pulled toward cruise (which flow raises), pushed by slopes, rails, walls and the turbo.
  this.flow=Math.min(1,this.flow+dt/14);
  if(boosting){this.fuel=Math.max(0,this.fuel-TURBO.drain*dt);if(this.fuel<=0){this.boostMin=0;this.events.push({type:'empty'});}}
  const cruise=this.cruise;let acc;
  if(boosting)acc=this.v<cruise+17?30:-2;else if(this.v<cruise)acc=this.invuln>0?16:11;else acc=this.rolling>0?-1.5:-4;
  // In the air the pup keeps the speed it left the ground with.
  if(!this.grounded&&!boosting&&this.v>=cruise)acc=0;
  if(this.grind&&this.v<cruise+10)acc=Math.max(acc,6);if(this.wall&&this.v<cruise+8)acc=Math.max(acc,5);
  if(this.grounded&&!lock)acc-=TURBO.gravity*Math.sin(anglesIn(c,this.s)[1])*(this.rolling>0?.7:.4);
  this.v=clamp(this.v+acc*dt,TURBO.minSpeed,TURBO.maxSpeed);this.s+=this.v*dt;c=chunkAt(seed,this.s);
  // Sideways: ease toward the lane; a lane that no longer exists (a wall or deck left behind) folds back in.
  const [lo,hi]=this.laneRange();this.lane=clamp(this.lane,lo,hi);const tx=laneX(c,this.lane),dx=tx-this.x,step=TURBO.steer*dt*(Math.abs(this.lane)===2&&c.pipe?1.6:1);this.x=Math.abs(dx)<=step?tx:this.x+Math.sign(dx)*step;
  // Up and down. Loops and corkscrews hold the pup to the deck.
  const floor=floorIn(c,this.s,this.x,this.h);
  if(locked(c,this.s)){if(!this.grounded||this.h!==0){this.h=0;this.vy=0;this.grounded=true;this.flip=0;this.flips=0;this.stomping=false;this.air=0;}this.grind=false;}
  else if(this.grounded){if(floor===null||floor<this.h-.3){this.grounded=false;this.coyote=TURBO.coyote;this.vy=0;this.grind=false;this.flips=0;this.air=0;}else this.h=floor;}
  else{this.air+=dt;this.vy-=this.gravity*dt;this.h+=this.vy*dt;
   if(this.flip>0&&(this.flip+=dt/TURBO.flipTime)>=1){this.flip=0;this.flips++;this.flipDone=0;this.trick('flip',TRICKS.flip*this.flips,{n:this.flips});}
   if(floor!==null&&this.h<=floor&&this.vy<=0)this.land(floor);
   else if(this.h<-7){// Fell through a gap: back on the far side, shaken.
    const gap=c.gaps.find(([a,b])=>this.s>a-2&&this.s<b+30);this.s=Math.max(this.s,(gap?gap[1]:this.s)+4);this.h=0;this.vy=0;this.grounded=true;this.flip=0;this.flips=0;this.stomping=false;this.invuln=0;this.events.push({type:'fall'});this.hurt('fall');c=chunkAt(seed,this.s);}}
  if(this.grounded&&this.jumpBuffer>0&&!locked(c,this.s)){this.move('up');}this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
  // Rails and walls.
  const onRail=this.grounded&&c.rails.some(r=>{const y=railHeight(r,this.s);return y!==null&&Math.abs(y-this.h)<.05&&Math.abs(this.x-r.lane*LW)<1.2&&this.s>r.s0+3;});
  if(onRail&&!this.grind){this.grind=true;this.grindDist=0;this.rolling=0;this.events.push({type:'grindstart'});}else if(!onRail)this.grind=false;
  if(this.grind){this.railDist+=this.v*dt;if(this.railDist>=40)this.feat('turbo.rail');if((this.grindDist+=this.v*dt)>=14){this.grindDist-=14;this.trick('grind');}}else this.railDist=0;
  const onWall=this.grounded&&c.pipe&&Math.abs(this.lane)===2&&Math.abs(this.x)>TURBO.wallX-1?Math.sign(this.lane):0;
  if(onWall&&this.wall!==onWall)this.trick('wall',TRICKS.wall,{side:onWall});this.wall=onWall;if(onWall){this.fuelUp(.05*dt);if((this.wallDist+=this.v*dt)>=60)this.feat('turbo.wall');}else this.wallDist=0;
  this.interact(prev,dt);if(this.status!=='playing')return;
  this.runRivals(prev,dt);
  // Leaving a loop or corkscrew pays out.
  const was=chunkAt(seed,prev);for(const key of ['loop','twist'])if(was[key]&&prev<was[key][1]&&this.s>=was[key][1]){if(key==='loop')this.loops++;this.trick(key);}
  this.distance=Math.max(this.distance,this.s);if(this.v>this.topSpeed)this.topSpeed=this.v;if(this.v>=300/5.2)this.feat('turbo.mach');
  // The high road counts only if it was ridden from the on-ramp.
  const deck=c.decks[0];if(deck){if(this.grounded&&this.s<deck.s0+TURBO.deckUp&&this.h>.3)this.deckRide=true;else if(this.grounded&&this.h<1&&this.s>deck.s0+TURBO.deckUp)this.deckRide=false;}else this.deckRide=false;
  // Checkpoints refill the clock, a little less each time.
  while(this.distance>=this.cp*TURBO.checkpoint){const add=Math.max(10,Math.round(23.2-this.cp*1.2))-(this.twist==='tailwind'?2:0),pts=500*this.cp;if(this.zoneHits===0)this.feat('turbo.clean');this.zoneHits=0;if(this.cp>=3)this.feat('turbo.tour');if(this.cp>=4)this.feat('turbo.lap');this.clock=Math.min(TURBO.clockMax,this.clock+add);this.bonus+=pts;this.events.push({type:'checkpoint',n:this.cp,add,points:pts,stage:stageName(this.cp)});this.cp++;}
  this.clock-=dt;this.score=Math.floor(this.distance)+this.bonus;trackHeat(this,this.heat);
  if(this.clock<=0){this.clock=0;const left=Math.ceil(this.cp*TURBO.checkpoint-this.distance);this.end('Out of time '+left+' m short of '+stageName(this.cp)+'. You reached '+this.summary()+'.');return;}
  // Only nearby chunks' ids are kept, so saves stay small on long runs.
  const keep=id=>parseInt(id,10)>=c.k-1;if(this.collected.length>160)this.collected=this.collected.filter(keep);if(this.smashed.length>40)this.smashed=this.smashed.filter(keep);
 }
 interact(prev,dt){
  const lo=prev,hi=this.s,body=this.h+TURBO.body,deckY=c=>c.decks.length?deckHeight(c.decks[0],this.s):null;
  for(const c of this.near()){
   const lx=l=>laneX(c,l),inLane=(l,w=1.25)=>l===null||Math.abs(this.x-lx(l))<w,surface=o=>o.d?(deckY(c)!==null&&Math.abs(this.h-deckY(c))<.4):this.h<.4;
   if(this.grounded){
    for(const p of c.pads)if(lo<p.s&&p.s<=hi&&(p.d?onDeckLanes(c.decks[0],this.x):inLane(p.lane,1.4))&&surface(p)){this.v=Math.min(TURBO.maxSpeed,Math.max(this.v+6,this.cruise+10));this.fuelUp(.08);this.events.push({type:'pad'});}
    for(const r of c.ramps)if(lo<r.s&&r.s<=hi&&(r.d?onDeckLanes(c.decks[0],this.x):inLane(r.lane,1.4))&&surface(r)){if(r.d&&this.deckRide)this.feat('turbo.highroad');this.launch(r.vy);this.v=Math.max(this.v,r.vmin);this.trick('air',TRICKS.air,{big:!!r.big});}
    for(const sp of c.springs)if(lo<sp.s&&sp.s<=hi&&inLane(sp.lane,1.4)&&this.h<.4){this.launch(22);this.events.push({type:'spring'});}
   }
   for(const coin of c.coins)if(coin.s>lo-.9&&coin.s<=hi+.9&&Math.abs(this.x-lx(coin.l))<1.4&&Math.abs(body-coin.h)<1.5&&!this.collected.includes(coin.id)){this.collected.push(coin.id);this.gold++;this.bonus+=10;this.fuelUp(this.twist==='goldrush'?.044:.022);this.events.push({type:'coin'});}
   for(const r of c.rings)if(lo<r.s&&r.s<=hi&&Math.abs(this.x-lx(r.l))<1.6&&Math.abs(body-r.h)<1.8&&!this.collected.includes(r.id)){this.collected.push(r.id);this.trick('ring',TRICKS.ring,{id:r.id});}
   for(const b of c.hazards){
    if(b.type==='spikes'){if(this.s>b.s&&prev<b.s+b.len&&this.h<.3&&inLane(b.lane,1.15))this.hurt('spikes');continue;}
    if(!(lo<b.s&&b.s<=hi)||this.h>3.2)continue;
    if(b.type==='bot'){if(this.smashed.includes(b.id))continue;const bx=lx(b.lane)+Math.sin(this.time*b.sp+b.ph)*b.amp,d=Math.abs(this.x-bx);
     if(d<1.5&&this.h<1.5){if(this.rolling>0||this.stomping||this.boosting||!this.grounded&&this.vy<-2){this.smash(b);if(!this.grounded){this.vy=Math.max(this.vy,10);this.stomping=false;}}else this.hurt('bot');}else if(d<2.6&&this.h<1.5)this.trick('near');continue;}
    const top=b.type==='block'?1.2:b.type==='hurdle'?.75:2;
    if(b.type==='bar'){if(this.h>=top)this.trick('near');else if(this.rolling>0)this.trick('limbo');else this.hurt('bar');continue;}
    if(inLane(b.lane)){if(this.h<top)this.hurt(b.type);else if(this.h<top+.7)this.trick('near');}
    else if(this.h<top&&inLane(b.lane,2.05))this.trick('near');
   }
  }
 }
 // Rival pups hold a steady pace and dodge what is in their lane. Catch one for a slipstream, pass it for style.
 runRivals(prev,dt){
  const seed=this.worldSeed;
  for(const r of this.rivals){
   const before=r.s-prev,gap=r.s-this.s,v=this.pace*RIVALS[r.id].pace*(this.twist==='rivalry'?1.08:1)*(gap>90?.75:1);r.s+=v*dt;const c=chunkAt(seed,r.s);
   if(!locked(c,r.s)){const blocked=l=>c.hazards.some(b=>b.lane!==null&&b.type!=='bot'&&b.s>r.s-2&&b.s<r.s+34&&b.lane===l)||c.rails.some(g=>g.lane===l&&g.s0<r.s+30&&g.s1>r.s);if(blocked(r.lane)){const free=[r.lane-1,r.lane+1,r.lane-2,r.lane+2].find(l=>l>=-1&&l<=1&&!blocked(l));if(free!==undefined)r.lane=free;}}
   const tx=r.lane*LW,dx=tx-r.x,step=10*dt;r.x=Math.abs(dx)<=step?tx:r.x+Math.sign(dx)*step;
   if(before>0&&r.s-this.s<=0){this.passed++;if(this.passed>=10)this.feat('turbo.pack');this.trick('overtake',TRICKS.overtake*(this.twist==='rivalry'?3:1),{id:r.id,name:RIVALS[r.id].name});}
   // Tucked in close behind a rival: the slipstream pulls the pup along.
   else if(gap>0&&gap<14&&Math.abs(this.x-r.x)<1.3&&this.grounded&&this.v<this.cruise+9){this.v+=9*dt;if(!this.draft)this.events.push({type:'draft'});this.draft=.6;}
   if(this.s-r.s>45){r.gen++;r.s=this.s+130+r.id*35;r.lane=Math.floor(hash(seed,9000+r.id*31+r.gen)*3)-1;r.x=r.lane*LW;}
  }
  this.draft=Math.max(0,(this.draft||0)-dt);
 }
}

const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b),bool=v=>typeof v==='boolean',ids=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(id=>typeof id==='string'&&/^\d{1,7}:[a-z]?\d{1,3}$/.test(id));
export const TURBO_FIELDS=['s','x','lane','h','vy','v','grounded','coyote','jumpBuffer','rolling','stomping','flip','flips','flipDone','air','grind','grindDist','wall','fuel','boostMin','combo','comboTime','bestCombo','flow','invuln','clock','cp','gold','bonus','distance','hits','smashes','loops','passed','tricks','collected','smashed','rivals','feats','topSpeed','zoneHits','perfects','wallDist','railDist','deckRide','daily'];
/** Checks a saved run. Saves from the old side-scrolling Turbo Pup have none of these fields and are rejected. */
export function validTurboSnapshot(s){
 return !!s&&num(s.s,0,1e8)&&num(s.x,-TURBO.pipeHalf,TURBO.pipeHalf)&&int(s.lane,-3,3)&&num(s.h,-7,60)&&num(s.vy,-80,40)&&num(s.v,TURBO.minSpeed,TURBO.maxSpeed)&&bool(s.grounded)&&num(s.coyote,0,TURBO.coyote)&&num(s.jumpBuffer,0,TURBO.buffer)&&num(s.rolling,0,TURBO.rollTime)&&bool(s.stomping)
  &&num(s.flip,0,1)&&int(s.flips,0,40)&&num(s.flipDone,0,9)&&num(s.air,0,60)&&bool(s.grind)&&num(s.grindDist,0,14)&&int(s.wall,-1,1)&&num(s.fuel,0,1)&&num(s.boostMin,0,.45)&&int(s.combo,0,1e6)&&num(s.comboTime,0,TURBO.comboWindow)&&int(s.bestCombo,s.combo,1e6)&&num(s.flow,0,1)&&num(s.invuln,0,TURBO.invuln)
  &&num(s.clock,0,TURBO.clockMax)&&int(s.cp,1,1e6)&&int(s.gold,0,1e7)&&int(s.bonus,0,2e9)&&num(s.distance,s.s,1e8)&&s.distance<s.cp*TURBO.checkpoint&&s.distance>=(s.cp-1)*TURBO.checkpoint&&int(s.hits,0,1e6)&&int(s.smashes,0,1e6)&&int(s.loops,0,1e6)&&int(s.passed,0,1e6)&&int(s.tricks,0,1e7)
  &&ids(s.collected,400)&&ids(s.smashed,120)&&Array.isArray(s.rivals)&&s.rivals.length===3&&s.rivals.every((r,i)=>r&&r.id===i&&num(r.s,0,1e8+400)&&int(r.lane,-1,1)&&num(r.x,-LW,LW)&&int(r.gen,0,1e7))
  &&Array.isArray(s.feats)&&s.feats.length<=FEAT_IDS.length&&new Set(s.feats).size===s.feats.length&&s.feats.every(id=>FEAT_IDS.includes(id))&&num(s.topSpeed,0,TURBO.maxSpeed)&&int(s.zoneHits,0,s.hits)&&int(s.perfects,0,1e6)&&num(s.wallDist,0,1e4)&&num(s.railDist,0,1e4)&&bool(s.deckRide)&&bool(s.daily)
  &&s.score===Math.floor(s.distance)+s.bonus;
}

/**
 * A fair autopilot for the attract-mode demo and the tests: it only presses the player's own
 * buttons. It steers round what is in its lane, jumps or rolls what spans the deck, flips when a
 * launch gives it the air time, and burns turbo on clear track.
 */
export function turboPilot(g,{tricks=true,turbo=true}={}){
 if(g.status!=='playing'||g.locked)return;const seed=g.worldSeed,c=chunkAt(seed,g.s),cs=[c,turboChunk(seed,c.k+1)],reach=g.v*.5+6;
 const ahead=l=>{let worst=null;for(const ch of cs)for(const b of ch.hazards){const end=b.type==='spikes'?b.s+b.len:b.s;if(end<g.s||b.s-g.s>reach||g.smashed.includes(b.id))continue;if(b.type==='bot'||b.lane===null||b.lane===l){if(!worst||b.s<worst.s)worst=b;}}return worst;};
 if(!g.grounded){
  // Flip only when the pup will still be in the air when it comes round.
  if(tricks&&g.flip===0&&!g.stomping&&g.h>1.2){const left=(g.vy+Math.sqrt(Math.max(0,g.vy*g.vy+2*g.gravity*g.h)))/g.gravity;if(left>TURBO.flipTime+.12)g.move('up');}
  return;}
 const here=g.h>3||g.grind||g.wall?null:ahead(g.lane);
 if(turbo){const clear=!here&&!ahead(g.lane-1)&&!ahead(g.lane+1);if(clear&&g.fuel>.55&&!g.boostHeld)g.press('boost',true);else if(g.boostHeld&&(!clear||g.fuel<.15))g.press('boost',false);}
 if(!here)return;const d=here.s-g.s;
 if(here.type==='bar'||here.type==='bot'){if(d<g.v*.3&&g.rolling<=0)g.move('down');return;}
 if(here.type==='hurdle'){if(d<g.v*.28)g.move('up');return;}
 const [lo,hi]=g.laneRange();for(const l of [g.lane-1,g.lane+1])if(l>=Math.max(-1,lo)&&l<=Math.min(1,hi)&&!ahead(l)){g.move(l<g.lane?'left':'right');return;}
 if(d<g.v*.3)g.move('up');
}
