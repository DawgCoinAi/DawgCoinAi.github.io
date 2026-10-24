// Drift Dawgs: deterministic kart racing on a seeded neon circuit. Karts live in track space:
// p is distance along the centerline (laps included; negative on the starting grid), d is the
// sideways offset (positive to the left), a is heading relative to the track. Renderers map
// track space to the world with trackPoint() and only read this state.
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
import {seededRandom} from './mobile-core.js';

export const KART={laps:3,width:11,wall:7.6,samples:512,step:1/120,top:30,boost:42,offroad:13,accel:17,rivals:5,radius:.75};
const PLACE_BONUS=[3000,2000,1400,900,500,250],ITEMS=['boost','bone','rocket'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// Seeded circuit: a star-shaped polar curve (so it never crosses itself), resampled to even
// spacing. Amplitudes shrink until no corner is tighter than the road can take.
const tracks=new Map();
export function kartTrack(seed){
 if(tracks.has(seed))return tracks.get(seed);
 const rnd=seededRandom((seed^0x5eed)>>>0),ph=[0,0,1,2,3,4,5].map(()=>rnd()*Math.PI*2),amp=[0,0,.2+rnd()*.08,.1+rnd()*.06,.03+rnd()*.04],sx=1.25+rnd()*.25,sy=.9+rnd()*.15;
 let pts,scale=1;
 for(let tries=0;tries<12;tries++,scale*=.82){
  const raw=[];for(let i=0;i<2400;i++){const t=i/2400*Math.PI*2;let r=1;for(let k=2;k<=4;k++)r+=amp[k]*scale*Math.sin(k*t+ph[k]);raw.push([Math.cos(t)*r*100*sx,Math.sin(t)*r*100*sy]);}
  pts=resample(raw,KART.samples);if(minRadius(pts)>26)break;}
 const n=pts.length,len=pts.reduce((sum,p,i)=>sum+Math.hypot(pts[(i+1)%n][0]-p[0],pts[(i+1)%n][1]-p[1]),0),ds=len/n;
 const ang=pts.map((p,i)=>{const q=pts[(i+1)%n],o=pts[(i-1+n)%n];return Math.atan2(q[1]-o[1],q[0]-o[0]);});
 const curve=ang.map((a,i)=>wrap(ang[(i+1)%n]-ang[(i-1+n)%n])/(2*ds));
 const smooth=curve.map((_,i)=>{let s=0;for(let k=-3;k<=3;k++)s+=curve[(i+k+n)%n];return s/7;});
 // Item rows sit on the four straightest stretches; boost pads on two of them; coins line the rest.
 const straight=[...smooth.keys()].map(i=>[i,Math.abs(smooth[i])]).sort((a,b)=>a[1]-b[1]),spaced=[];
 for(const [i]of straight){if(i*ds<40||i*ds>len-30)continue;if(spaced.every(j=>Math.min(Math.abs(i-j),n-Math.abs(i-j))*ds>len/6))spaced.push(i);if(spaced.length===4)break;}
 const boxes=[],pads=[],coins=[];spaced.forEach((i,k)=>{for(const d of [-3.6,-1.2,1.2,3.6])boxes.push({s:i*ds,d});if(k<2)pads.push({s:(i*ds+25)%len,d:k?-2.5:2.5});});
 for(let k=0;k<12;k++){const s=(len*(k+.5)/12+17)%len,d=(rnd()-.5)*6;for(let j=0;j<3;j++)coins.push({s:(s+j*3)%len,d});}
 const track={seed,len,ds,pts,ang,curve:smooth,boxes,pads,coins};tracks.set(seed,track);if(tracks.size>8)tracks.delete(tracks.keys().next().value);return track;
}
function resample(raw,n){const seg=raw.map((p,i)=>Math.hypot(raw[(i+1)%raw.length][0]-p[0],raw[(i+1)%raw.length][1]-p[1])),total=seg.reduce((a,b)=>a+b,0),out=[];let i=0,acc=0;
 for(let k=0;k<n;k++){const want=k/n*total;while(acc+seg[i]<want){acc+=seg[i];i++;}const f=(want-acc)/seg[i],a=raw[i],b=raw[(i+1)%raw.length];out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}return out;}
function minRadius(pts){const n=pts.length;let min=Infinity;for(let i=0;i<n;i+=2){const a=pts[(i-4+n)%n],b=pts[i],c=pts[(i+4)%n],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ca=Math.hypot(a[0]-c[0],a[1]-c[1]),area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;if(area>1e-6)min=Math.min(min,ab*bc*ca/(4*area));}return min;}
// Track sample at distance s (any value; wraps): position, heading and curvature, interpolated.
export function trackAt(t,s){const u=((s%t.len)+t.len)%t.len/t.ds,i=Math.floor(u)%t.pts.length,j=(i+1)%t.pts.length,f=u-Math.floor(u),a=t.pts[i],b=t.pts[j];
 return {x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,ang:t.ang[i]+wrap(t.ang[j]-t.ang[i])*f,curve:t.curve[i]+(t.curve[j]-t.curve[i])*f};}
export function trackPoint(t,s,d){const q=trackAt(t,s);return {x:q.x-Math.sin(q.ang)*d,y:q.y+Math.cos(q.ang)*d,ang:q.ang};}
const gap=(t,a,b)=>{const g=((a-b)%t.len+t.len)%t.len;return g>t.len/2?g-t.len:g;};

const NAMES=['Blaze','Mochi','Turbo Tank','Pixel','Duchess'],COLORS=['#ff5f6d','#ffb547','#5ee7ff','#c18cff','#5cff9b'];
function kart(i,rnd){const row=Math.floor(i/2),col=i%2;return {id:i,name:i?NAMES[i-1]:'YOU',color:i?COLORS[i-1]:'#b9ff5e',p:-4-row*5,d:col?-2.4:2.4,a:0,v:0,steer:0,drift:0,charge:0,boost:0,spin:0,item:null,coins:0,finished:false,time:0,skill:i?.93+rnd()*.06+(i===1?.03:0):1,line:0,think:0};}

export class KartGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.track=kartTrack(worldSeed);this.status='ready';this.time=0;this.score=0;this.events=[];this.reason='';
  this.karts=Array.from({length:KART.rivals+1},(_,i)=>kart(i,random));this.input={left:false,right:false,down:false};this.place=KART.rivals+1;this.lap=0;this.bones=[];this.rockets=[];this.taken=[];this.coinTaken=[];this.acc=0;this.distance=0;this.hits=0;this.turbos=0;this.held=0;this.autoDrift=false;this.bonus=0;}
 get you(){return this.karts[0];}
 // Music tempo follows the player's speed (the Dash soundtrack reads 25–40).
 get speed(){return 25+this.you.v/KART.boost*15;}
 get heat(){return heatOf(Math.max(0,this.you.p)/this.track.len,FULL_HEAT.kart);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';this.input={left:false,right:false,down:false};}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 // Held controls: ← / → steer, ↓ drifts; ↑ (a press) fires the item.
 press(dir,down){if(this.status!=='playing')return false;if(dir==='up'){if(down)return this.useItem(this.you);return false;}if(!(dir in this.input))return false;this.input[dir]=down;return true;}
 move(dir){return this.press(dir,true);}
 useItem(k){const it=k.item;if(!it||k.finished)return false;k.item=null;
  if(it==='boost'){k.boost=Math.max(k.boost,1.4);this.events.push({type:'boost',kart:k.id});}
  else if(it==='bone'){this.bones.push({p:k.p-2.5,d:k.d,life:30});this.events.push({type:'drop',kart:k.id});}
  else{const ahead=this.karts.filter(o=>o!==k&&!o.finished&&o.p>k.p).sort((a,b)=>a.p-b.p)[0];this.rockets.push({from:k.id,to:ahead?.id??-1,t:.9,p:k.p,d:k.d});this.events.push({type:'rocket',kart:k.id});}
  return true;}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;this.acc+=dt;while(this.acc>=KART.step&&this.status==='playing'){this.acc-=KART.step;this.step(KART.step);}trackHeat(this,this.heat);}
 step(h){const t=this.track,heat=this.heat;
  for(const k of this.karts){if(k.id)this.drive(k,h,heat);else this.player(k,h);this.physics(k,h,t);}
  // Kart-to-kart bumps push both sideways.
  for(let i=0;i<this.karts.length;i++)for(let j=i+1;j<this.karts.length;j++){const a=this.karts[i],b=this.karts[j],dp=gap(t,a.p,b.p),dd=a.d-b.d;if(Math.abs(dp)<1.7&&Math.abs(dd)<1.4){const push=(1.4-Math.abs(dd))/2*(dd>=0?1:-1);a.d+=push;b.d-=push;if(!i&&Math.abs(dd)<1.2)this.events.push({type:'bump'});}}
  this.pickups(h,t);this.projectiles(h,t);this.rank();
  // Everyone else is home: the player gets a few seconds, then the race is called.
  const rivals=this.karts.slice(1);if(!this.you.finished&&rivals.every(k=>k.finished)&&this.time-Math.max(...rivals.map(k=>k.time))>8){this.you.finished=true;this.you.time=this.time;this.finish();}
 }
 player(k,h){const i=this.input,st=(i.left?1:0)-(i.right?1:0);k.steer=st;
  this.held=st?this.held+h:0;const want=(i.down||this.autoDrift&&this.held>.45)&&st!==0&&k.v>12&&!k.spin;
  if(want&&!k.drift){k.drift=st;k.charge=0;this.events.push({type:'hop'});}
  if(k.drift&&!(i.down||this.autoDrift&&st===k.drift)){this.releaseDrift(k);}}
 releaseDrift(k){const lvl=k.charge>=1.8?2:k.charge>=.9?1:0;k.drift=0;k.charge=0;if(lvl&&!k.spin){k.boost=Math.max(k.boost,lvl===2?1.3:.7);if(!k.id){this.turbos++;this.bonus+=lvl*100;this.events.push({type:'miniturbo',level:lvl});}}}
 drive(k,h,heat){const t=this.track,look=trackAt(t,k.p+14+k.v*.4);
  // Racing line: hug the inside of the next corner; dodge bones just ahead.
  if((k.think-=h)<=0){k.think=.4+this.random()*.3;k.line=clamp(look.curve*260,-3.6,3.6)+(this.random()-.5)*1.5;
   const bone=this.bones.find(b=>{const g=gap(t,b.p,k.p);return g>0&&g<18&&Math.abs(b.d-k.d)<1.6;});if(bone)k.line=bone.d>0?bone.d-2.6:bone.d+2.6;
   if(k.item&&this.random()<(k.item==='bone'?.35:.25))this.useItem(k);}
  const err=clamp((k.line-k.d)*.35,-.45,.45);k.steer=clamp((err-k.a)*3.2,-1,1);
  const lead=this.you.p-k.p,rubber=lead>25?1.13:lead>8?1.05:lead<-40?.93:1;k.cap=KART.top*ramp(.92,1.02,heat)*k.skill*rubber;}
 physics(k,h,t){const q=trackAt(t,k.p),off=Math.abs(k.d)>KART.width/2;
  if(k.spin>0){k.spin=Math.max(0,k.spin-h);k.v=Math.max(0,k.v-26*h);}
  const top=k.boost>0?KART.boost:(off?KART.offroad:(k.cap??KART.top)+Math.min(10,k.coins)*.25);k.boost=Math.max(0,k.boost-h);
  if(k.finished)k.v=Math.max(0,k.v-8*h);else if(!k.spin)k.v+=(k.v<top?KART.accel*(k.boost>0?2.2:1):-(off?30:12))*h;k.v=clamp(k.v,0,KART.boost);
  let rate=k.spin?0:k.steer*1.85*Math.min(1,k.v/9);
  if(k.drift){rate=k.drift*.6+k.steer*.7;const before=k.charge;k.charge+=h*(k.steer===k.drift?1.5:.9);if(!k.id&&(before<.9&&k.charge>=.9||before<1.8&&k.charge>=1.8))this.events.push({type:'charge',level:k.charge>=1.8?2:1});}
  if(k.id&&k.drift)k.drift=0;
  k.a=clamp(k.a+(rate-q.curve*k.v*Math.cos(k.a))*h,-1.1,1.1);if(!k.steer&&!k.drift)k.a*=1-1.2*h;
  const along=k.v*Math.cos(k.a)*h;k.p+=along;k.d+=k.v*Math.sin(k.a)*h*(k.drift?.8:1);if(!k.id&&along>0)this.distance+=along;
  if(Math.abs(k.d)>KART.wall-KART.radius){k.d=Math.sign(k.d)*(KART.wall-KART.radius);if(!k.touch){if(!k.id&&k.v>6)this.events.push({type:'wall'});k.v*=.75;}else k.v*=1-1.2*h;k.touch=true;k.a*=-.25;if(k.drift&&!k.id)this.releaseDrift(k);}else k.touch=false;
  const lap=Math.floor(k.p/t.len);if(!k.finished&&k.p>=0){if(!k.id&&lap>this.lap&&lap<KART.laps){this.lap=lap;this.events.push({type:'lap',lap:lap+1,final:lap===KART.laps-1});}
   if(lap>=KART.laps){k.finished=true;k.time=this.time;if(!k.id)this.finish();}}}
 pickups(h,t){
  this.taken=this.taken.map(x=>({...x,t:x.t-h})).filter(x=>x.t>0);
  for(const k of this.karts){if(k.finished)continue;const s=((k.p%t.len)+t.len)%t.len;
   t.boxes.forEach((b,i)=>{if(k.item||this.taken.some(x=>x.i===i))return;if(Math.abs(gap(t,s,b.s))<1.3&&Math.abs(k.d-b.d)<1.3){this.taken.push({i,t:2.5});k.item=this.roll(k);if(!k.id)this.events.push({type:'item',item:k.item});}});
   for(const pad of t.pads)if(Math.abs(gap(t,s,pad.s))<1.4&&Math.abs(k.d-pad.d)<1.8&&k.boost<.6){k.boost=.9;if(!k.id)this.events.push({type:'pad'});}
   if(!k.id)t.coins.forEach((c,i)=>{const lapKey=Math.floor(k.p/t.len)*1000+i;if(this.coinTaken.includes(lapKey))return;if(Math.abs(gap(t,s,c.s))<1.1&&Math.abs(k.d-c.d)<1.2){this.coinTaken.push(lapKey);if(this.coinTaken.length>200)this.coinTaken.shift();if(k.coins<10)k.coins++;this.bonus+=50;this.events.push({type:'coin'});}});}
 }
 // Items favour whoever is behind: last place sees far more rockets and boosts than the leader.
 roll(k){const back=(this.order?.indexOf(k)??0)/KART.rivals,r=this.random();return r<.25+back*.35?'boost':r<.6+back*.1?'rocket':'bone';}
 projectiles(h,t){
  for(const b of this.bones){b.life-=h;for(const k of this.karts){if(k.spin>0||k.finished)continue;if(Math.abs(gap(t,k.p,b.p))<1.1&&Math.abs(k.d-b.d)<1.1){b.life=0;this.spinOut(k,'bone');}}}
  this.bones=this.bones.filter(b=>b.life>0);
  for(const r of this.rockets){r.t-=h;const target=this.karts[r.to];if(target){r.p=target.p-r.t*12;r.d=target.d;}if(r.t<=0&&target&&!target.finished){this.spinOut(target,'rocket');if(r.from===0){this.hits++;this.bonus+=200;this.events.push({type:'hit',kart:target.id});}}}
  this.rockets=this.rockets.filter(r=>r.t>0);
 }
 spinOut(k,cause){if(k.spin>0)return;k.spin=1.1;k.drift=0;k.charge=0;k.boost=0;k.coins=Math.max(0,k.coins-3);if(!k.id)this.events.push({type:'spin',cause});}
 rank(){const prev=this.place;this.order=[...this.karts].sort((a,b)=>a.finished&&b.finished?a.time-b.time:b.p-a.p);this.place=this.order.indexOf(this.you)+1;if(this.place<prev&&this.time>1)this.events.push({type:'pass',place:this.place});
  this.score=Math.floor(this.distance/2)+this.bonus;}
 finish(){this.rank();const bonus=PLACE_BONUS[this.place-1]??0,par=KART.laps*this.track.len/24,fast=Math.max(0,Math.round((par-this.time)*30));this.bonus+=bonus+fast;this.rank();
  this.events.push({type:'finish',place:this.place,bonus,fast});this.end(`You finished ${ordinal(this.place)} of ${this.karts.length} in ${this.time.toFixed(1)} s.`);}
}
export const ordinal=n=>n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th');

const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b),bool=v=>typeof v==='boolean';
export const KART_FIELDS=['karts','input','place','lap','bones','rockets','taken','coinTaken','acc','distance','hits','turbos','held','autoDrift','bonus'];
export function validKartSnapshot(s){const cap=KART.laps*2000;
 return Array.isArray(s.karts)&&s.karts.length===KART.rivals+1&&s.karts.every((k,i)=>k&&k.id===i&&num(k.p,-40,cap)&&num(k.d,-KART.wall,KART.wall)&&num(k.a,-1.1,1.1)&&num(k.v,0,KART.boost)&&num(k.steer,-1,1)&&[-1,0,1].includes(k.drift)&&num(k.charge,0,30)&&num(k.boost,0,2)&&num(k.spin,0,1.1)&&(k.item===null||ITEMS.includes(k.item))&&int(k.coins,0,10)&&bool(k.finished)&&num(k.time,0,1e6)&&num(k.skill,.5,1.1)&&num(k.line,-8,8)&&num(k.think,-.1,1)&&(k.touch===undefined||bool(k.touch))&&(k.cap===undefined||num(k.cap,0,KART.boost))&&typeof k.name==='string'&&k.name.length<20&&/^#[0-9a-f]{6}$/.test(k.color))
  &&s.input&&['left','right','down'].every(d=>bool(s.input[d]))&&int(s.place,1,KART.rivals+1)&&int(s.lap,0,KART.laps)&&Array.isArray(s.bones)&&s.bones.length<=60&&s.bones.every(b=>b&&num(b.p,-60,cap)&&num(b.d,-KART.wall,KART.wall)&&num(b.life,-1,30))
  &&Array.isArray(s.rockets)&&s.rockets.length<=20&&s.rockets.every(r=>r&&int(r.from,0,KART.rivals)&&int(r.to,-1,KART.rivals)&&num(r.t,-1,1)&&num(r.p,-60,cap)&&num(r.d,-KART.wall,KART.wall))
  &&Array.isArray(s.taken)&&s.taken.length<=40&&s.taken.every(x=>x&&int(x.i,0,40)&&num(x.t,-1,2.5))&&Array.isArray(s.coinTaken)&&s.coinTaken.length<=200&&s.coinTaken.every(x=>int(x,-1000,1e6))
  &&num(s.acc,0,KART.step)&&num(s.distance,0,cap*2)&&int(s.hits,0,1e4)&&int(s.turbos,0,1e5)&&num(s.held,0,1e6)&&bool(s.autoDrift)&&int(s.bonus,0,1e7);
}
