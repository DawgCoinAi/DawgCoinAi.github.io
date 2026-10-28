// Don't Look Down: a DAWG climbs a 500-meter tower on a grappling leash. Hold to grab the nearest
// hook in reach and reel in, release to let go and fly, ← / → pump the swing. There are no
// checkpoints: fall, and you drop until something catches you. Hit the street again and the run is
// over. The tower is the same for everyone (so it can be learned); the seed only moves the wind.
// Units are meters, y is up, the shaft runs from x = −CLIMB.half to +CLIMB.half.
import {seededRandom} from './mobile-core.js';
export const CLIMB={gravity:24,reach:7.5,near:1.4,reel:3.4,minRope:1.6,pump:15,air:5,walk:6.5,jump:10,half:9,top:500,radius:.45,maxFall:42,rusty:.85,slick:1.7,spring:19,cooldown:.22,regrab:.18};
export const FLOORS=['The Alley','Laundry Lines','Fire Escapes','Billboard Row','Crane Yard','Glass Spine','Wind Tunnel','Antenna Farm','Storm Deck','The Penthouse'];
export const floorOf=y=>Math.max(0,Math.min(FLOORS.length-1,Math.floor(y/50)));
// What the tower says after a fall, by how far you dropped. All original lines.
export const TAUNTS=[
 [10,['Minor setback. Major ego damage.','The leash was fine. The DAWG was not.','Gravity says hi.']],
 [30,['That was a whole floor. You were on it.','Somewhere, a pigeon is laughing.','Do that again, but up.']],
 [80,['Those meters are gone. They had families.','Gravity: 1. You: 0.','Bold of you to climb that twice.']],
 [160,['A tragedy in one act.','The penthouse just unfollowed you.','Your DAWG would like a word.']],
 [1e9,['Legendary. Legendarily bad.','Whole floors. Plural. Gone.','Speedrunning the way down.']]];
export function taunt(meters,i=0){const set=TAUNTS.find(([m])=>meters<m)[1];return set[Math.abs(i)%set.length];}
const OVER=['Back on the street.','The pavement remembers you.','Ground floor. Again.','The street was waiting.'];

// The one tower. Hooks zigzag up the shaft, getting further apart and nastier with height; each
// floor starts with a narrow ledge to rest on, and gold bones sit on the risky side of the drops.
let TOWER=null;
export function tower(){if(TOWER)return TOWER;const r=seededRandom(0x7e11a5),hooks=[],ledges=[{id:0,x0:-CLIMB.half,x1:CLIMB.half,y:0}],bones=[],winds=[];
 let x=0,y=2.6,last='hook';
 while(y<CLIMB.top-2){const f=floorOf(y),d=f/(FLOORS.length-1);
  const roll=r();let type='hook';if(last==='hook'&&y>8){if(roll<.04+.22*d)type='rusty';else if(roll<.07+.36*d)type='slick';else if(roll<.12+.42*d)type='swing';else if(roll<.17+.44*d&&f>0)type='spring';}
  const h={id:hooks.length,x,y,type};if(type==='swing'){h.amp=Math.min(CLIMB.half-1-Math.abs(x),1.6+r()*2.2*d+.6);h.speed=.7+r()*.9;h.phase=r()*6.28;}hooks.push(h);last=type;
  if(r()<.12+.18*d)bones.push({id:bones.length,x:Math.max(-CLIMB.half+1,Math.min(CLIMB.half-1,x+(r()<.5?-1:1)*(3.5+r()*2.5))),y:y+1+r()*2});
  const step=type==='spring'?7+r()*2:3+d*2.1+r()*1.3;const nextY=y+step;
  // Rest ledge at the start of every floor (under the first hook of that floor).
  if(floorOf(nextY)>f){const ly=(f+1)*50-1.2,lx=Math.max(-CLIMB.half+2,Math.min(CLIMB.half-2,x+(r()-.5)*4)),w=4.2-d*1.6;ledges.push({id:ledges.length,x0:lx-w/2,x1:lx+w/2,y:ly});y=ly+3;x=Math.max(-CLIMB.half+1.4,Math.min(CLIMB.half-1.4,lx+(r()<.5?-1:1)*(1.5+r()*1.5)));continue;}
  let dx=(r()<.5?-1:1)*(2.2+r()*(2+d*2.2));if(Math.abs(x+dx)>CLIMB.half-1.4)dx=-dx;x=Math.max(-CLIMB.half+1.4,Math.min(CLIMB.half-1.4,x+dx));y=nextY;
  if(r()<.07&&f<FLOORS.length-1)ledges.push({id:ledges.length,x0:x-1.1,x1:x+1.1,y:y-2.4});}
 // The wind tunnel and everything above it gusts sideways.
 for(let f=6;f<FLOORS.length;f++)winds.push({y0:f*50,y1:f*50+50,force:5+(f-6)*1.6,phase:f*1.7});
 TOWER={hooks,ledges,bones,winds};return TOWER;}
// Where a hook is right now (swing hooks slide back and forth on a rail).
export function hookPos(h,time){return h.type==='swing'?{x:h.x+Math.sin(time*h.speed+h.phase)*h.amp,y:h.y}:{x:h.x,y:h.y};}
export function windAt(seed,y,time){const w=tower().winds.find(w=>y>=w.y0&&y<w.y1);if(!w)return 0;const s=(seed%997)/97;return w.force*Math.sin(time*.55+w.phase+s)*(.6+.4*Math.sin(time*1.9+s));}

export class ClimbGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];
  this.x=0;this.y=0;this.vx=0;this.vy=0;this.hook=-1;this.rope=0;this.grip=0;this.grounded=true;this.ledge=0;this.peak=0;this.maxY=0;this.bonus=0;this.bones=[];this.broken=[];this.falls=0;this.fallen=0;this.cooldown=0;this.input={up:false,left:false,right:false};this.grabs=0;this.floor=0;this.last=-1;}
 get height(){return Math.max(0,this.y);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 // Held controls: up grabs and reels (release lets go), left/right pump.
 press(dir,down){if(!['up','left','right'].includes(dir))return false;this.input[dir]=!!down;if(this.status!=='playing')return false;
  if(dir==='up'){if(down)this.grab();else if(this.hook>=0)this.letGo();}return true;}
 // The best hook in reach: close, and above you if possible; never the one you just let go of
 // while another is in reach, so reel, release, grab climbs.
 target(){const t=tower();let best=null,bestScore=Infinity,nearMiss=null,nearD=Infinity;
  for(const h of t.hooks){if(Math.abs(h.y-this.y)>CLIMB.reach+CLIMB.near+3)continue;if(this.broken.includes(h.id))continue;const p=hookPos(h,this.time),dx=p.x-this.x,dy=p.y-this.y,d=Math.hypot(dx,dy);
   if(d<=CLIMB.reach&&dy>-2){const s=d-Math.max(0,dy)*.6+(h.id===this.last?100:0);if(s<bestScore){bestScore=s;best=h;}}else if(d<=CLIMB.reach+CLIMB.near&&dy>0&&d<nearD){nearD=d;nearMiss=h;}}
  return {hook:best,near:nearMiss};}
 grab(){if(this.hook>=0||this.cooldown>0)return false;const {hook,near}=this.target();
  if(!hook){if(this.grounded){this.vy=CLIMB.jump;this.grounded=false;this.ledge=-1;this.events.push({type:'jump'});return true;}this.cooldown=CLIMB.cooldown;this.events.push({type:'whiff',near:!!near,x:near?hookPos(near,this.time).x:this.x,y:near?near.y:this.y+CLIMB.reach});return false;}
  const p=hookPos(hook,this.time),fromFeet=this.grounded;this.grabs++;this.grounded=false;this.ledge=-1;if(fromFeet)this.y+=.08;
  if(hook.type==='spring'){// Springs fling you straight up past the hook and don't hold on.
   this.vy=Math.max(this.vy,CLIMB.spring);this.vx*=.4;this.cooldown=CLIMB.regrab;this.events.push({type:'spring',x:p.x,y:p.y});return true;}
  // Off your feet, the leash starts a little short so it lifts you instead of dragging you back down.
  this.hook=hook.id;this.rope=Math.max(CLIMB.minRope,Math.hypot(p.x-this.x,p.y-this.y)-(fromFeet?.35:0));this.grip=0;this.events.push({type:'grab',hook:hook.id,kind:hook.type,x:p.x,y:p.y});return true;}
 letGo(reason){if(this.hook<0)return;const id=this.hook;this.hook=-1;this.last=id;this.cooldown=CLIMB.regrab;this.events.push({type:reason||'release',hook:id,x:this.x,y:this.y});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);const t=tower(),I=this.input,lr=(I.right?1:0)-(I.left?1:0);
  let ax=windAt(this.worldSeed,this.y,this.time),ay=-CLIMB.gravity;
  if(this.hook>=0){const h=t.hooks[this.hook],p=hookPos(h,this.time);this.grip+=dt;
   if(h.type==='rusty'&&this.grip>=CLIMB.rusty){this.broken.push(h.id);this.letGo('snap');}
   else if(h.type==='slick'&&this.grip>=CLIMB.slick)this.letGo('slip');
   else{if(I.up)this.rope=Math.max(CLIMB.minRope,this.rope-CLIMB.reel*dt);
    // Pump along the swing: push in the held direction, tangent to the leash.
    const rx=this.x-p.x,ry=this.y-p.y,len=Math.hypot(rx,ry)||1;let tx=-ry/len,ty=rx/len;if(tx*lr<0){tx=-tx;ty=-ty;}if(lr){ax+=tx*CLIMB.pump;ay+=ty*CLIMB.pump;}}}
  else if(this.grounded){const l=t.ledges[this.ledge];this.vx=lr*CLIMB.walk;ay=0;this.vy=0;if(l&&(this.x<l.x0-.2||this.x>l.x1+.2)){this.grounded=false;this.ledge=-1;}}
  else ax+=lr*CLIMB.air;
  const px=this.x,py=this.y;this.vx+=ax*dt;this.vy+=ay*dt;this.vx*=1-.12*dt;this.vy=Math.max(-CLIMB.maxFall,this.vy);this.x+=this.vx*dt;this.y+=this.vy*dt;
  // The leash: never longer than its length; outward speed is cancelled, the swing is kept.
  if(this.hook>=0){const p=hookPos(t.hooks[this.hook],this.time),rx=this.x-p.x,ry=this.y-p.y,len=Math.hypot(rx,ry);
   if(len>this.rope){const nx=rx/len,ny=ry/len;this.x=p.x+nx*this.rope;this.y=p.y+ny*this.rope;const out=this.vx*nx+this.vy*ny;if(out>0){this.vx-=out*nx;this.vy-=out*ny;}}}
  // Shaft walls.
  if(this.x<-CLIMB.half+CLIMB.radius){this.x=-CLIMB.half+CLIMB.radius;if(this.vx<0){if(this.vx<-9)this.events.push({type:'wall',x:this.x,y:this.y});this.vx*=-.35;}}
  if(this.x>CLIMB.half-CLIMB.radius){this.x=CLIMB.half-CLIMB.radius;if(this.vx>0){if(this.vx>9)this.events.push({type:'wall',x:this.x,y:this.y});this.vx*=-.35;}}
  // Ledges catch you from above only.
  if(!this.grounded&&this.vy<=0)for(const l of t.ledges){if(py>=l.y-.001&&this.y<=l.y&&this.x>=l.x0-.15&&this.x<=l.x1+.15){this.land(l);break;}}
  if(this.status!=='playing')return;
  if(this.hook<0&&!this.grounded&&this.y>this.peak)this.peak=this.y;
  if(this.y>this.maxY){this.maxY=this.y;const f=floorOf(this.maxY);if(f>this.floor){this.floor=f;this.events.push({type:'floor',floor:f,name:FLOORS[f]});}}
  if(this.hook>=0||this.grounded)this.peak=this.y;
  for(const b of t.bones)if(!this.bones.includes(b.id)&&Math.abs(b.y-this.y)<1&&Math.abs(b.x-this.x)<1){this.bones.push(b.id);this.bonus+=50;this.events.push({type:'bone',x:b.x,y:b.y});}
  this.score=Math.floor(this.maxY)*10+this.bonus;
  if(this.y>=CLIMB.top){this.bonus+=5000;this.score=Math.floor(this.maxY)*10+this.bonus;this.events.push({type:'summit'});this.end('You reached the Penthouse. Nobody believed you could. Including us.');}}
 land(l){const drop=this.peak-l.y;this.last=-1;this.y=l.y;this.vy=0;this.vx*=.2;this.grounded=true;this.ledge=l.id;this.hook=-1;
  if(drop>=8){this.falls++;this.fallen+=Math.floor(drop);this.events.push({type:'fall',meters:Math.floor(drop),line:taunt(drop,this.falls),x:this.x,y:this.y,ground:l.id===0});}else this.events.push({type:'land',x:this.x,y:this.y});
  this.peak=l.y;
  if(l.id===0&&this.maxY>=12)this.end(`${OVER[this.falls%OVER.length]} You were ${Math.floor(this.maxY)} m up${drop>=8?' and fell '+Math.floor(drop)+' m':''}. ${taunt(drop,this.falls+1)}`);}
}
export const CLIMB_FIELDS=['x','y','vx','vy','hook','rope','grip','grounded','ledge','peak','maxY','bonus','bones','broken','falls','fallen','cooldown','input','grabs','floor','last'];
const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b),ids=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(i=>int(i,0,max))&&new Set(a).size===a.length;
export function validClimbSnapshot(s){const t=tower();
 return num(s.x,-CLIMB.half,CLIMB.half)&&num(s.y,-1,CLIMB.top+5)&&num(s.vx,-80,80)&&num(s.vy,-CLIMB.maxFall,60)&&int(s.hook,-1,t.hooks.length-1)&&num(s.rope,0,CLIMB.reach+.01)&&num(s.grip,0,1e6)&&typeof s.grounded==='boolean'&&int(s.ledge,-1,t.ledges.length-1)
  &&num(s.peak,-1,CLIMB.top+60)&&num(s.maxY,0,CLIMB.top+60)&&int(s.bonus,0,1e7)&&ids(s.bones,t.bones.length)&&s.bones.every(i=>i<t.bones.length)&&ids(s.broken,t.hooks.length)&&int(s.falls,0,1e6)&&int(s.fallen,0,1e8)&&num(s.cooldown,0,1)
  &&s.input&&['up','left','right'].every(k=>typeof s.input[k]==='boolean')&&int(s.grabs,0,1e7)&&int(s.floor,0,FLOORS.length-1)&&int(s.last,-1,t.hooks.length-1)&&s.score===Math.floor(s.maxY)*10+s.bonus;}
