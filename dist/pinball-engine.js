// Neon Pinball: deterministic fixed-step table physics. The table is 10 × 20 units with y up
// (toward the backglass); gravity pulls balls toward the flippers. Walls and flippers are
// capsules, bumpers are circles. Renderers only read this state.
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';

export const TABLE={width:10,height:20,ball:.25,step:1/240,maxSpeed:38};
export const FLIPPERS=[{side:'left',px:2.4,py:2.4,len:1.85,rest:-.55,up:.45},{side:'right',px:6.6,py:2.4,len:1.85,rest:-.55,up:.45}];
export const BUMPERS=[{x:3.2,y:13.2,r:.6},{x:5.8,y:13.2,r:.6},{x:4.5,y:15.2,r:.6}];
export const TARGETS=[{x:.12,y:8.6},{x:.12,y:9.6},{x:.12,y:10.6}];
export const LANES=[{x:2.7,label:'D'},{x:3.9,label:'A'},{x:5.1,label:'W'},{x:6.3,label:'G'}];
export const LANE_Y=18.2,HOLE={x:4.5,y:10.2,r:.45},PLUNGER={x:9.5,y:.9};
const arc=[[0,17],[.45,18.5],[1.5,19.45],[3.2,20],[6.8,20],[8.5,19.45],[9.55,18.5],[10,17]];
// Static walls as [x1, y1, x2, y2, kind]; 'sling' edges kick, 'gate' only blocks balls falling back.
// The playfield is x 0–9; the plunger lane is x 9–10. Each lower side is one slope (slingshot, then
// inlane) that feeds its flipper; outside each slingshot an outlane runs straight down to the drain.
export const WALLS=[
 [0,-1,0,17,'wall'],...arc.slice(1).map((p,i)=>[arc[i][0],arc[i][1],p[0],p[1],'wall']),[10,17,10,0,'wall'],
 [9,-1,9,15.4,'wall'],[9,15.4,10,16.3,'gate'],
 [.8,7,1.55,4,'sling'],[1.55,4,2.25,2.62,'wall'],[2.25,2.62,.8,3.4,'wall'],[.8,3.4,.8,7,'wall'],
 [8.2,7,7.45,4,'sling'],[7.45,4,6.75,2.62,'wall'],[6.75,2.62,8.2,3.4,'wall'],[8.2,3.4,8.2,7,'wall'],
 ...[2.1,3.3,4.5,5.7,6.9].map(x=>[x,LANE_Y-.5,x,LANE_Y+.5,'post'])
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const flipperAngle=(f,a)=>f.side==='left'?a:Math.PI-a;
export function flipperTip(f,a){const ang=flipperAngle(f,a);return {x:f.px+Math.cos(ang)*f.len,y:f.py+Math.sin(ang)*f.len};}

export class PinballGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.events=[];this.reason='';
  this.ballsLeft=3;this.balls=[];this.flips=FLIPPERS.map(f=>({angle:f.rest,omega:0,held:false}));this.targets=[false,false,false];this.lanes=[false,false,false,false];this.mult=1;this.holeLit=false;this.reset=0;this.save=0;this.nudgeCool=0;this.acc=0;this.bumps=0;this.multiballs=0;this.armed=true;this.spawnBall();}
 get heat(){return heatOf(this.score,FULL_HEAT.pinball);}
 get gravity(){return ramp(16,22,this.heat);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 spawnBall(){this.balls.push({x:PLUNGER.x,y:PLUNGER.y,vx:0,vy:0,state:'lane',wait:0});}
 // ← / → hold the flippers; any press while a ball waits on the plunger launches it. ↑ nudges.
 press(side,down){const i=side==='left'?0:side==='right'?1:-1;if(i<0||this.status!=='playing')return false;const f=this.flips[i];if(down&&!f.held)this.events.push({type:'flip',side});f.held=down;if(down)this.launch();return true;}
 move(dir){if(this.status!=='playing')return false;if(dir==='left'||dir==='right')return this.press(dir,true);if(dir==='down'||dir==='up'){if(this.launch())return true;if(dir==='up')return this.nudge();}return false;}
 launch(){const b=this.balls.find(b=>b.state==='lane');if(!b)return false;b.state='play';b.vy=29+this.random()*3;b.vx=0;if(this.armed){this.armed=false;this.save=8;}this.events.push({type:'launch'});return true;}
 nudge(){if(this.nudgeCool>0)return false;this.nudgeCool=1.2;for(const b of this.balls)if(b.state==='play'){b.vy+=3.5;b.vx+=(this.random()-.5)*2;}this.events.push({type:'nudge'});return true;}
 add(points,type,extra={}){const p=points*this.mult;this.score+=p;this.events.push({type,points:p,...extra});}
 tick(dt){
  if(this.status!=='playing')return;this.time+=dt;this.save=Math.max(0,this.save-dt);this.nudgeCool=Math.max(0,this.nudgeCool-dt);if(this.reset>0&&(this.reset-=dt)<=0){this.reset=0;this.targets=[false,false,false];}
  for(const b of this.balls)if(b.state==='lane'&&(b.wait+=dt)>3)this.launch();
  this.acc+=dt;while(this.acc>=TABLE.step&&this.status==='playing'){this.acc-=TABLE.step;this.step(TABLE.step);}
  trackHeat(this,this.heat);
 }
 step(h){
  FLIPPERS.forEach((f,i)=>{const s=this.flips[i],target=s.held?f.up:f.rest,speed=s.held?22:16,before=s.angle;s.angle=s.angle<target?Math.min(target,s.angle+speed*h):Math.max(target,s.angle-speed*h);s.omega=(s.angle-before)/h;});
  for(const b of this.balls){
   if(b.state==='held'){b.hold-=h;if(b.hold<=0){b.state='play';b.cool=1;b.vx=(this.random()<.5?-1:1)*(3+this.random()*3);b.vy=9;this.events.push({type:'eject'});}continue;}
   if(b.state!=='play')continue;b.cool=Math.max(0,(b.cool||0)-h);
   b.vy-=this.gravity*h;const sp=Math.hypot(b.vx,b.vy);if(sp>TABLE.maxSpeed){b.vx*=TABLE.maxSpeed/sp;b.vy*=TABLE.maxSpeed/sp;}
   const px=b.x,py=b.y;b.x+=b.vx*h;b.y+=b.vy*h;this.collide(b,px,py);
   // A ball that somehow comes to rest gets a little shove instead of stalling the game.
   // Measured as distance moved, so a ball wedged and jittering counts too; a held cradle does not.
   const cradle=b.y<3.6&&this.flips.some(f=>f.held);if(b.ax===undefined||Math.hypot(b.x-b.ax,b.y-b.ay)>.35||cradle){b.ax=b.x;b.ay=b.y;b.still=0;}else if((b.still=(b.still||0)+h)>2.5){b.still=0;if(b.y<3.6){b.vy=-5;b.vx=b.x<4.5?2:-2;}else{b.vy+=6;b.vx+=b.x<4.5?3:-3;}this.events.push({type:'nudge'});}
  }
  // Drained balls: the ball save returns one free; otherwise the next ball, or game over.
  for(const b of this.balls)if(b.state==='play'&&b.y<-.6){b.state='gone';if(this.save>0){this.events.push({type:'ballsave'});this.spawnBall();}else this.events.push({type:'drain'});}
  this.balls=this.balls.filter(b=>b.state!=='gone');
  if(!this.balls.length){this.ballsLeft--;if(this.ballsLeft<=0){this.end('The last ball slipped down the middle. Hold a flipper to catch it next time.');return;}this.armed=true;this.spawnBall();this.events.push({type:'nextball',left:this.ballsLeft});}
 }
 hitCapsule(b,ax,ay,bx,by,radius,surface,restitution){
  const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy||1e-9,t=clamp(((b.x-ax)*dx+(b.y-ay)*dy)/len2,0,1),cx=ax+dx*t,cy=ay+dy*t;let nx=b.x-cx,ny=b.y-cy;const d=Math.hypot(nx,ny),min=TABLE.ball+radius;if(d>=min||d<1e-6)return false;nx/=d;ny/=d;
  b.x=cx+nx*min;b.y=cy+ny*min;const sv=surface?surface(cx,cy):{x:0,y:0},rx=b.vx-sv.x,ry=b.vy-sv.y,vn=rx*nx+ry*ny;if(vn>=0)return false;
  const tx=-ny,ty=nx,vt=rx*tx+ry*ty;b.vx=sv.x+(-vn*restitution)*nx+vt*.98*tx;b.vy=sv.y+(-vn*restitution)*ny+vt*.98*ty;return {nx,ny,impact:-vn};
 }
 collide(b,px,py){
  for(let i=0;i<WALLS.length;i++){const w=WALLS[i],kind=w[4];if(kind==='gate'&&b.vy>0)continue;const hit=this.hitCapsule(b,w[0],w[1],w[2],w[3],kind==='post'?.09:.06,null,kind==='sling'?.4:.5);
   if(hit&&kind==='sling'&&hit.impact>2){b.vx+=hit.nx*11;b.vy+=hit.ny*11;this.add(10,'sling');}}
  FLIPPERS.forEach((f,i)=>{const s=this.flips[i],tip=flipperTip(f,s.angle),w=f.side==='left'?s.omega:-s.omega;
   this.hitCapsule(b,f.px,f.py,tip.x,tip.y,.14,(cx,cy)=>({x:-w*(cy-f.py),y:w*(cx-f.px)}),.35);});
  for(let i=0;i<BUMPERS.length;i++){const m=BUMPERS[i];const dx=b.x-m.x,dy=b.y-m.y,d=Math.hypot(dx,dy),min=m.r+TABLE.ball;if(d<min&&d>1e-6){const nx=dx/d,ny=dy/d;b.x=m.x+nx*min;b.y=m.y+ny*min;const vn=b.vx*nx+b.vy*ny;if(vn<0){b.vx-=vn*nx;b.vy-=vn*ny;}const kick=ramp(13,16,this.heat);b.vx+=nx*kick;b.vy+=ny*kick;this.bumps++;this.add(100,'bumper',{index:i});}}
  TARGETS.forEach((t,i)=>{if(this.targets[i]||this.reset>0)return;if(this.hitCapsule(b,t.x,t.y-.38,t.x,t.y+.38,.08,null,.5)){this.targets[i]=true;this.add(250,'target',{index:i});if(this.targets.every(Boolean)){this.add(1000,'targets');this.reset=2;this.holeLit=true;}}});
  // Rollover lanes light as a ball crosses their line; lighting all four raises the multiplier.
  if((py-LANE_Y)*(b.y-LANE_Y)<=0&&py!==b.y)LANES.forEach((l,i)=>{if(Math.abs(b.x-l.x)<.5&&!this.lanes[i]){this.lanes[i]=true;this.add(50,'lane',{index:i});if(this.lanes.every(Boolean)){this.lanes=[false,false,false,false];this.mult=Math.min(5,this.mult+1);this.add(2000,'laneset',{mult:this.mult});}}});
  if(!(b.cool>0)&&Math.hypot(b.x-HOLE.x,b.y-HOLE.y)<HOLE.r&&Math.hypot(b.vx,b.vy)<14){b.state='held';b.hold=1.2;b.x=HOLE.x;b.y=HOLE.y;b.vx=b.vy=0;
   if(this.holeLit){this.holeLit=false;this.multiballs++;this.add(5000,'multiball');this.spawnBall();this.spawnBall();for(const nb of this.balls)if(nb.state==='lane')nb.wait=2.6;}else this.add(1000,'hole');}
 }
}

const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b),bool=v=>typeof v==='boolean';
export const PINBALL_FIELDS=['ballsLeft','balls','flips','targets','lanes','mult','holeLit','reset','save','armed','nudgeCool','acc','bumps','multiballs'];
export function validPinballSnapshot(s){
 return int(s.ballsLeft,1,3)&&Array.isArray(s.balls)&&s.balls.length>=1&&s.balls.length<=6&&s.balls.every(b=>b&&num(b.x,-1,11)&&num(b.y,-1,21)&&num(b.vx,-60,60)&&num(b.vy,-60,60)&&['lane','play','held'].includes(b.state)&&num(b.wait??0,0,4)&&num(b.hold??0,-.1,1.2)&&num(b.cool??0,0,1)&&num(b.still??0,0,3)&&num(b.ax??0,-1,11)&&num(b.ay??0,-1,21))
  &&Array.isArray(s.flips)&&s.flips.length===2&&s.flips.every(f=>f&&num(f.angle,-.6,.5)&&num(f.omega,-30,30)&&bool(f.held))&&Array.isArray(s.targets)&&s.targets.length===3&&s.targets.every(bool)&&Array.isArray(s.lanes)&&s.lanes.length===4&&s.lanes.every(bool)
  &&int(s.mult,1,5)&&bool(s.holeLit)&&num(s.reset,0,2)&&num(s.save,0,8)&&bool(s.armed)&&num(s.nudgeCool,0,1.2)&&num(s.acc,0,TABLE.step)&&int(s.bumps,0,1e7)&&int(s.multiballs,0,1e5);
}
