// Neon Pinball: deterministic fixed-step table physics. The table is 10 × 20 units with y up
// (toward the backglass); gravity pulls balls toward the flippers. Walls and flippers are
// capsules, bumpers are circles. Ramps and wireforms lift the ball off the playfield: a ball
// that enters one fast enough rides its 3D path (z is height) over everything below, then
// drops back in. The table changes with the level: each level is its own layout with a mission
// (bumper hits, ramp shots, the target bank and the lane set); finish it to move up a level.
// Renderers only read this state.
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';

export const TABLE={width:10,height:20,ball:.25,step:1/240,maxSpeed:38,airGravity:22};
export const FLIPPERS=[{side:'left',px:2.4,py:2.4,len:1.85,rest:-.55,up:.45},{side:'right',px:6.6,py:2.4,len:1.85,rest:-.55,up:.45}];
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
// Ramps and wireforms. entry: a short line the ball must cross heading up the table at minSpeed or
// more (slower balls roll back); path: [x, y, z] points it then rides; exit: where and how it
// comes off, dropping from that height onto whatever is below.
const LEFT_RAMP={id:'left',kind:'ramp',label:'LEFT RAMP',entry:[1.0,11.5,1.75,11.5],minSpeed:13,points:500,
 path:[[1.35,11.5,0],[1.25,13.8,.9],[1.6,16.6,1.6],[3,19,1.9],[5.5,19.1,1.9],[7.6,17.6,1.7],[8.4,14.5,1.2],[8.3,11,.6],[8.0,8.4,.2]],exit:{x:7.9,y:7.9,z:.2,vx:-1,vy:-5}};
const RIGHT_RAMP={id:'right',kind:'ramp',label:'RIGHT RAMP',entry:[7.25,11.5,8.0,11.5],minSpeed:13,points:500,
 path:[[7.65,11.5,0],[7.75,13.8,.9],[7.4,16.6,1.6],[6,19,1.9],[3.5,19.1,1.9],[1.4,17.6,1.7],[.6,14.5,1.2],[.7,11,.6],[1.0,8.4,.2]],exit:{x:1.1,y:7.9,z:.2,vx:1,vy:-5}};
const RIGHT_ORBIT={id:'orbit',kind:'wire',label:'WIRE ORBIT',entry:[7.25,11.5,8.0,11.5],minSpeed:12,points:400,
 path:[[7.65,11.5,0],[7.9,14,.8],[7.4,17.2,1.4],[4.5,19.3,2],[2,17.6,1.6],[1.4,14.6,1],[1.3,12.4,.5]],exit:{x:1.3,y:12,z:.5,vx:.5,vy:-4}};
const SPIRAL={id:'spiral',kind:'wire',label:'WIRE SPIRAL',entry:[4.1,17.0,4.9,17.0],minSpeed:12,points:750,
 path:[[4.5,17,0],[4.6,17.6,.5],[6,18.3,1.2],[6.6,16.6,1.8],[4.5,15.7,2.3],[2.4,16.6,2.6],[2.9,18.3,2.8],[4.5,18.6,2.7],[4.6,17.4,2.6]],exit:{x:4.5,y:16.8,z:2.6,vx:0,vy:-6}};
const CROSS_WIRE={id:'cross',kind:'wire',label:'CROSSOVER',entry:[8.0,9.0,8.85,9.0],minSpeed:11,points:600,
 path:[[8.45,9,0],[8.6,10.6,.6],[7,12.6,1.5],[4.5,13.6,2.4],[2,12.6,1.5],[.9,10.6,.6],[1.0,9.3,.2]],exit:{x:1.0,y:9,z:.2,vx:.4,vy:-5}};
// Each ramp's cumulative length and slope, computed once.
for(const r of [LEFT_RAMP,RIGHT_RAMP,RIGHT_ORBIT,SPIRAL,CROSS_WIRE]){r.s=[0];for(let i=1;i<r.path.length;i++){const a=r.path[i-1],b=r.path[i];r.s.push(r.s[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]));}r.length=r.s.at(-1);}
const LEFT_TARGETS=[{x:.12,y:8.6},{x:.12,y:9.6},{x:.12,y:10.6}],RIGHT_TARGETS=[{x:8.88,y:9.6},{x:8.88,y:10.6}];
// The three table layouts; levels cycle through them with tougher missions each time round.
export const LAYOUTS=[
 {name:'THE RUSTY COLLAR',color:'#ff8a3d',bumpers:[{x:3.2,y:13.2,r:.6},{x:5.8,y:13.2,r:.6},{x:4.5,y:15.2,r:.6}],targets:LEFT_TARGETS,ramps:[LEFT_RAMP,RIGHT_ORBIT],goal:{bumps:12,ramps:2}},
 {name:'LUCKY PAWS',color:'#ffd36b',bumpers:[{x:2.4,y:13.4,r:.55},{x:6.6,y:13.4,r:.55},{x:4.5,y:12.2,r:.55},{x:3.2,y:15.6,r:.55},{x:5.8,y:15.6,r:.55}],targets:[...LEFT_TARGETS,...RIGHT_TARGETS],ramps:[LEFT_RAMP,RIGHT_RAMP,SPIRAL],goal:{bumps:25,ramps:4}},
 {name:'ABOVE THE NOISE',color:'#b9ff5e',bumpers:[{x:2.6,y:12.6,r:.55},{x:6.4,y:12.6,r:.55},{x:2.3,y:15.2,r:.55},{x:6.7,y:15.2,r:.55},{x:4.5,y:13.9,r:.55},{x:4.5,y:11.2,r:.5}],targets:[...LEFT_TARGETS,...RIGHT_TARGETS],ramps:[LEFT_RAMP,RIGHT_RAMP,CROSS_WIRE,SPIRAL],goal:{bumps:40,ramps:6}}
];
// Level n's table: the layout cycles, the mission grows each lap round.
export function tableFor(level){const lap=Math.floor((level-1)/LAYOUTS.length),l=LAYOUTS[(level-1)%LAYOUTS.length];return {...l,level,goal:{bumps:l.goal.bumps+lap*15,ramps:l.goal.ramps+lap*2,targets:true,lanes:true}};}
// Level 1's pieces, for anything that still expects fixed ones.
export const BUMPERS=LAYOUTS[0].bumpers,TARGETS=LAYOUTS[0].targets;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const flipperAngle=(f,a)=>f.side==='left'?a:Math.PI-a;
export function flipperTip(f,a){const ang=flipperAngle(f,a);return {x:f.px+Math.cos(ang)*f.len,y:f.py+Math.sin(ang)*f.len};}
// Where a ball riding a ramp is, in table units plus height.
export function rampPoint(r,t){const s=r.s;let i=1;while(i<s.length-1&&s[i]<t)i++;const a=r.path[i-1],b=r.path[i],u=clamp((t-s[i-1])/Math.max(1e-6,s[i]-s[i-1]),0,1);return {x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,z:a[2]+(b[2]-a[2])*u,slope:(b[2]-a[2])/Math.max(1e-6,s[i]-s[i-1])};}

export class PinballGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.events=[];this.reason='';
  this.ballsLeft=3;this.balls=[];this.flips=FLIPPERS.map(f=>({angle:f.rest,omega:0,held:false}));this.lanes=[false,false,false,false];this.mult=1;this.holeLit=false;this.reset=0;this.save=0;this.nudgeCool=0;this.acc=0;this.bumps=0;this.multiballs=0;this.armed=true;this.level=1;this.loadLevel();this.spawnBall();}
 get heat(){return heatOf(this.score,FULL_HEAT.pinball);}
 get gravity(){return ramp(16,22,this.heat);}
 get table(){return tableFor(this.level);}
 // What the mission still needs, for the HUD.
 get goal(){const t=this.table.goal,p=this.progress;return {bumps:[p.bumps,t.bumps],ramps:[p.ramps,t.ramps],targets:p.targets,lanes:p.lanes,done:p.bumps>=t.bumps&&p.ramps>=t.ramps&&p.targets&&p.lanes};}
 loadLevel(){const t=this.table;this.targets=t.targets.map(()=>false);this.lanes=[false,false,false,false];this.progress={bumps:0,ramps:0,targets:false,lanes:false};this.holeLit=false;this.reset=0;
  // Balls mid-ramp on the old table come off where they are.
  for(const b of this.balls)if(b.state==='ramp'){const p=rampPoint((this.ramps||t.ramps)[b.ramp]||t.ramps[0],b.t);Object.assign(b,{state:'play',x:clamp(p.x,.4,8.6),y:clamp(p.y,1,19),z:p.z,vz:0,vx:0,vy:-2,ramp:-1,t:0,sp:0});}
  this.ramps=t.ramps;}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 spawnBall(){this.balls.push({x:PLUNGER.x,y:PLUNGER.y,z:0,vx:0,vy:0,vz:0,state:'lane',wait:0,ramp:-1,t:0,sp:0});}
 // ← / → hold the flippers; any press while a ball waits on the plunger launches it. ↑ nudges.
 press(side,down){const i=side==='left'?0:side==='right'?1:-1;if(i<0||this.status!=='playing')return false;const f=this.flips[i];if(down&&!f.held)this.events.push({type:'flip',side});f.held=down;if(down)this.launch();return true;}
 move(dir){if(this.status!=='playing')return false;if(dir==='left'||dir==='right')return this.press(dir,true);if(dir==='down'||dir==='up'){if(this.launch())return true;if(dir==='up')return this.nudge();}return false;}
 launch(){const b=this.balls.find(b=>b.state==='lane');if(!b)return false;b.state='play';b.vy=29+this.random()*3;b.vx=0;if(this.armed){this.armed=false;this.save=8;}this.events.push({type:'launch'});return true;}
 nudge(){if(this.nudgeCool>0)return false;this.nudgeCool=1.2;for(const b of this.balls)if(b.state==='play'){b.vy+=3.5;b.vx+=(this.random()-.5)*2;}this.events.push({type:'nudge'});return true;}
 add(points,type,extra={}){const p=points*this.mult;this.score+=p;this.events.push({type,points:p,...extra});}
 // Mission bookkeeping; a finished mission moves the table up a level.
 goalCheck(){const g=this.goal;if(!g.done)return;const bonus=10000*this.level;this.score+=bonus;const from=this.level;this.level++;if(this.ballsLeft<3)this.ballsLeft++;this.loadLevel();this.events.push({type:'levelup',level:this.level,from,name:this.table.name,points:bonus,extraBall:true});}
 tick(dt){
  if(this.status!=='playing')return;this.time+=dt;this.save=Math.max(0,this.save-dt);this.nudgeCool=Math.max(0,this.nudgeCool-dt);if(this.reset>0&&(this.reset-=dt)<=0){this.reset=0;this.targets=this.targets.map(()=>false);}
  for(const b of this.balls)if(b.state==='lane'&&(b.wait+=dt)>3)this.launch();
  this.acc+=dt;while(this.acc>=TABLE.step&&this.status==='playing'){this.acc-=TABLE.step;this.step(TABLE.step);}
  trackHeat(this,this.heat);
 }
 step(h){
  FLIPPERS.forEach((f,i)=>{const s=this.flips[i],target=s.held?f.up:f.rest,speed=s.held?22:16,before=s.angle;s.angle=s.angle<target?Math.min(target,s.angle+speed*h):Math.max(target,s.angle-speed*h);s.omega=(s.angle-before)/h;});
  for(const b of this.balls){
   if(b.state==='held'){b.hold-=h;if(b.hold<=0){b.state='play';b.cool=1;b.vx=(this.random()<.5?-1:1)*(3+this.random()*3);b.vy=9;this.events.push({type:'eject'});}continue;}
   if(b.state==='ramp'){this.ride(b,h);continue;}
   if(b.state!=='play')continue;b.cool=Math.max(0,(b.cool||0)-h);
   // A ball pinned between bumpers gets thrown clear instead of rattling there forever.
   b.frenzy=Math.max(0,(b.frenzy||0)-h*4);if(b.frenzy>10){b.frenzy=0;b.vy=-16;b.vx=b.x<4.5?-4:4;this.events.push({type:'nudge'});}
   if(b.z>0){// Airborne off a ramp: it flies over the table until it lands.
    b.vz-=TABLE.airGravity*h;b.z+=b.vz*h;b.vy-=this.gravity*h*.5;b.x+=b.vx*h;b.y+=b.vy*h;b.x=clamp(b.x,.4,8.6);b.y=clamp(b.y,.5,19.4);if(b.z<=0){b.z=0;b.vz=0;this.events.push({type:'land',x:b.x,y:b.y});}continue;}
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
 // Riding a ramp: speed along the path falls on the climbs and builds on the drops.
 ride(b,h){const r=this.table.ramps[b.ramp];if(!r){b.state='play';b.ramp=-1;return;}const p=rampPoint(r,b.t);b.sp-=(this.gravity*p.slope+1.2)*h;b.t+=b.sp*h;
  if(b.sp<=0&&b.t<r.length*.6){// Too slow: rolls back out the way it came.
   const e=r.entry;Object.assign(b,{state:'play',x:(e[0]+e[2])/2,y:e[1]-.4,z:0,vz:0,vx:0,vy:-3,ramp:-1,t:0,sp:0,cool:.4});this.events.push({type:'rollback'});return;}
  if(b.t>=r.length){const x=r.exit;const dir=Math.hypot(x.vx,x.vy)||1,v=Math.max(5,b.sp*.75);Object.assign(b,{state:'play',x:x.x,y:x.y,z:x.z,vz:0,vx:x.vx/dir*v,vy:x.vy/dir*v,ramp:-1,t:0,sp:0,cool:.3});this.events.push({type:'rampexit',index:b.ramp});return;}
  const q=rampPoint(r,b.t);b.x=q.x;b.y=q.y;b.z=q.z;}
 hitCapsule(b,ax,ay,bx,by,radius,surface,restitution){
  const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy||1e-9,t=clamp(((b.x-ax)*dx+(b.y-ay)*dy)/len2,0,1),cx=ax+dx*t,cy=ay+dy*t;let nx=b.x-cx,ny=b.y-cy;const d=Math.hypot(nx,ny),min=TABLE.ball+radius;if(d>=min||d<1e-6)return false;nx/=d;ny/=d;
  b.x=cx+nx*min;b.y=cy+ny*min;const sv=surface?surface(cx,cy):{x:0,y:0},rx=b.vx-sv.x,ry=b.vy-sv.y,vn=rx*nx+ry*ny;if(vn>=0)return false;
  const tx=-ny,ty=nx,vt=rx*tx+ry*ty;b.vx=sv.x+(-vn*restitution)*nx+vt*.98*tx;b.vy=sv.y+(-vn*restitution)*ny+vt*.98*ty;return {nx,ny,impact:-vn};
 }
 collide(b,px,py){const t=this.table;
  for(let i=0;i<WALLS.length;i++){const w=WALLS[i],kind=w[4];if(kind==='gate'&&b.vy>0)continue;const hit=this.hitCapsule(b,w[0],w[1],w[2],w[3],kind==='post'?.09:.06,null,kind==='sling'?.4:.5);
   if(hit&&kind==='sling'&&hit.impact>2){b.vx+=hit.nx*11;b.vy+=hit.ny*11;this.add(10,'sling');}}
  FLIPPERS.forEach((f,i)=>{const s=this.flips[i],tip=flipperTip(f,s.angle),w=f.side==='left'?s.omega:-s.omega;
   this.hitCapsule(b,f.px,f.py,tip.x,tip.y,.14,(cx,cy)=>({x:-w*(cy-f.py),y:w*(cx-f.px)}),.35);});
  for(let i=0;i<t.bumpers.length;i++){const m=t.bumpers[i];const dx=b.x-m.x,dy=b.y-m.y,d=Math.hypot(dx,dy),min=m.r+TABLE.ball;if(d<min&&d>1e-6){const nx=dx/d,ny=dy/d;b.x=m.x+nx*min;b.y=m.y+ny*min;const vn=b.vx*nx+b.vy*ny;if(vn<0){b.vx-=vn*nx;b.vy-=vn*ny;}const kick=ramp(13,16,this.heat);b.vx+=nx*kick;b.vy+=ny*kick;this.bumps++;this.progress.bumps++;this.add(100,'bumper',{index:i});b.frenzy=(b.frenzy||0)+1;if(this.progress.bumps===t.goal.bumps)this.events.push({type:'goal',kind:'bumps'});}}
  t.targets.forEach((tg,i)=>{if(this.targets[i]||this.reset>0)return;if(this.hitCapsule(b,tg.x,tg.y-.38,tg.x,tg.y+.38,.08,null,.5)){this.targets[i]=true;this.add(250,'target',{index:i});if(this.targets.every(Boolean)){this.add(1000,'targets');this.reset=2;this.holeLit=true;if(!this.progress.targets){this.progress.targets=true;this.events.push({type:'goal',kind:'targets'});}}}});
  // Rollover lanes light as a ball crosses their line; lighting all four raises the multiplier.
  if((py-LANE_Y)*(b.y-LANE_Y)<=0&&py!==b.y)LANES.forEach((l,i)=>{if(Math.abs(b.x-l.x)<.5&&!this.lanes[i]){this.lanes[i]=true;this.add(50,'lane',{index:i});if(this.lanes.every(Boolean)){this.lanes=[false,false,false,false];this.mult=Math.min(5,this.mult+1);this.add(2000,'laneset',{mult:this.mult});if(!this.progress.lanes){this.progress.lanes=true;this.events.push({type:'goal',kind:'lanes'});}}}});
  // Ramp entries: fast enough and heading up, the ball leaves the playfield; otherwise it rolls back.
  if(!(b.cool>0))for(let i=0;i<t.ramps.length;i++){const r=t.ramps[i],e=r.entry;if(!((py-e[1])*(b.y-e[1])<=0&&b.y>py&&b.x>=e[0]&&b.x<=e[2]))continue;const sp=Math.hypot(b.vx,b.vy);
   if(sp>=r.minSpeed){Object.assign(b,{state:'ramp',ramp:i,t:0,sp,z:0,vz:0,vx:0,vy:0});this.progress.ramps++;this.add(r.points,'ramp',{index:i,label:r.label});if(this.progress.ramps===t.goal.ramps)this.events.push({type:'goal',kind:'ramps'});return;}
   b.y=e[1]-.01;b.vy=-Math.abs(b.vy)*.3;b.cool=.3;}
  if(!(b.cool>0)&&Math.hypot(b.x-HOLE.x,b.y-HOLE.y)<HOLE.r&&Math.hypot(b.vx,b.vy)<14){b.state='held';b.hold=1.2;b.x=HOLE.x;b.y=HOLE.y;b.vx=b.vy=0;
   if(this.holeLit){this.holeLit=false;this.multiballs++;this.add(5000,'multiball');this.spawnBall();this.spawnBall();for(const nb of this.balls)if(nb.state==='lane')nb.wait=2.6;}else this.add(1000,'hole');}
  this.goalCheck();
 }
}

const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b),bool=v=>typeof v==='boolean';
export const PINBALL_FIELDS=['ballsLeft','balls','flips','targets','lanes','mult','holeLit','reset','save','armed','nudgeCool','acc','bumps','multiballs','level','progress'];
export function validPinballSnapshot(s){
 if(!int(s.level,1,9999))return false;const t=tableFor(s.level);
 return int(s.ballsLeft,1,3)&&Array.isArray(s.balls)&&s.balls.length>=1&&s.balls.length<=6&&s.balls.every(b=>b&&num(b.x,-1,11)&&num(b.y,-1,21)&&num(b.vx,-60,60)&&num(b.vy,-60,60)&&['lane','play','held','ramp'].includes(b.state)&&num(b.wait??0,0,4)&&num(b.hold??0,-.1,1.2)&&num(b.cool??0,0,1)&&num(b.still??0,0,3)&&num(b.ax??0,-1,11)&&num(b.ay??0,-1,21)&&num(b.z??0,0,4)&&num(b.vz??0,-40,40)&&int(b.ramp??-1,-1,t.ramps.length-1)&&num(b.t??0,0,60)&&num(b.sp??0,-60,60)&&num(b.frenzy??0,0,20)&&(b.state!=='ramp'||b.ramp>=0))
  &&Array.isArray(s.flips)&&s.flips.length===2&&s.flips.every(f=>f&&num(f.angle,-.6,.5)&&num(f.omega,-30,30)&&bool(f.held))&&Array.isArray(s.targets)&&s.targets.length===t.targets.length&&s.targets.every(bool)&&Array.isArray(s.lanes)&&s.lanes.length===4&&s.lanes.every(bool)
  &&int(s.mult,1,5)&&bool(s.holeLit)&&num(s.reset,0,2)&&num(s.save,0,8)&&bool(s.armed)&&num(s.nudgeCool,0,1.2)&&num(s.acc,0,TABLE.step)&&int(s.bumps,0,1e7)&&int(s.multiballs,0,1e5)
  &&s.progress&&typeof s.progress==='object'&&int(s.progress.bumps,0,1e7)&&int(s.progress.ramps,0,1e7)&&bool(s.progress.targets)&&bool(s.progress.lanes);
}
