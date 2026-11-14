// Street Hustle's open city: pure, seeded rules with no DOM or Three.js. A compact coastal grid of
// avenues and streets (plus alleys, a tunnel and the beach) that you drive through freely; traffic
// keeps its lanes, patrols roam, and your street heat decides how hard the cruisers come for you.
// The sim steps at a fixed 60 Hz from player input (throttle, brake, steer, handbrake). What it
// hands the trade engine is small: a trip outcome when you pull up at another district's dealer,
// a bust, or a respray. The renderer (hustle-world-3d.js) only reads it.
import {seededRandom} from './world.js';
import {wantedStars,DRIVE_CASH_CAP} from './hustle-drive.js';

export const STEP=1/60;
export const XS=[-280,-140,0,140,280],ZS=[-280,-140,0,140,280];   // avenues (x) and streets (z), metres
export const ROAD_HALF=7,WALK=3.5,ALLEY_HALF=3.4,NODE_R=11;        // tarmac half-width, sidewalk, alley half-width
export const TOP_SPEED=40,SAND_SPEED=22,REVERSE_SPEED=9;           // m/s
export const LANES=[1.75,5.25];                                    // metres right of the centreline
export const CAR_R=1.25;                                           // collision radius against walls
export const EXPRESS_BONUS=100;                                    // beating the par time on a delivery run
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
const dist=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);

// ── The map ────────────────────────────────────────────────────────────────────────────────
export const NODES=[];for(let j=0;j<5;j++)for(let i=0;i<5;i++)NODES.push({id:j*5+i,i,j,x:XS[i],z:ZS[j],links:[]});
// A full grid minus a few blocks' worth of street, so there are T-junctions and long ways round.
export const CUTS=[[1,2],[8,13],[16,17],[18,23],[6,11]];
const CUT=new Set(CUTS.map(c=>c.join('-')));
export const EDGES=[];
for(const n of NODES){for(const m of [n.i<4?NODES[n.id+1]:null,n.j<4?NODES[n.id+5]:null]){if(!m||CUT.has(n.id+'-'+m.id))continue;
 EDGES.push({a:n.id,b:m.id,horizontal:m.j===n.j,tunnel:n.id===21&&m.id===22,name:''});n.links.push(m.id);m.links.push(n.id);}}
export const AVENUES=['Ocean Drive','Biscuit Avenue','Main Bark','Collar Avenue','Hilltop Avenue'],STREETS=['Pier Street','Neon Row','Center Street','Velvet Street','Low Road'];
for(const e of EDGES)e.name=e.horizontal?STREETS[NODES[e.a].j]:AVENUES[NODES[e.a].i];
// Alleys: too narrow for a cruiser. Each joins two streets mid-block.
export const ALLEYS=[{x0:-70,z0:-140,x1:-70,z1:0},{x0:0,z0:70,x1:140,z1:70},{x0:210,z0:-280,x1:210,z1:-140},{x0:-280,z0:210,x1:-140,z1:210}];
export const BEACH={x0:-324,z0:-300,x1:-290,z1:300};
// Everything you can drive on, as axis-aligned boxes: roads with their sidewalks, alleys, the beach.
export const RECTS=[];
for(const e of EDGES){const a=NODES[e.a],b=NODES[e.b],w=ROAD_HALF+WALK;RECTS.push({kind:e.tunnel?'tunnel':'road',cop:true,edge:e,x0:a.x-w,z0:a.z-w,x1:b.x+w,z1:b.z+w});}
for(const a of ALLEYS)RECTS.push({kind:'alley',cop:false,edge:null,x0:Math.min(a.x0,a.x1)-ALLEY_HALF,z0:Math.min(a.z0,a.z1)-ALLEY_HALF,x1:Math.max(a.x0,a.x1)+ALLEY_HALF,z1:Math.max(a.z0,a.z1)+ALLEY_HALF});
RECTS.push({kind:'beach',cop:false,edge:null,...BEACH});
// Districts by where you are: The Block in the middle, the other four in the corners.
export function districtAt(x,z){if(Math.abs(x)<=70&&Math.abs(z)<=70)return 0;return z<0?(x>=0?1:2):(x>=0?3:4);}
// Marked spots at the curb: each district's dealer, and two spray shops. h is the way you face
// when parked (the curb is on your right).
export const STOPS=[
 {id:0,kind:'market',district:0,name:'The Block',x:56,z:8,h:Math.PI/2,r:7.5},
 {id:1,kind:'market',district:1,name:'Neon Strip',x:184,z:-148,h:-Math.PI/2,r:7.5},
 {id:2,kind:'market',district:2,name:'The Docks',x:-196,z:-272,h:Math.PI/2,r:7.5},
 {id:3,kind:'market',district:3,name:'Uptown',x:212,z:148,h:Math.PI/2,r:7.5},
 {id:4,kind:'market',district:4,name:'Underground',x:-148,z:238,h:Math.PI,r:7.5},
 {id:5,kind:'garage',district:1,name:'Paw & Spray',x:8,z:-210,h:0,r:7.5},
 {id:6,kind:'garage',district:3,name:'Paw & Spray',x:272,z:214,h:Math.PI,r:7.5}
];
// Shortest street routes between intersections (hops are all 140 m).
export const HOPS=NODES.map(s=>{const d=NODES.map(()=>99),q=[s.id];d[s.id]=0;for(let k=0;k<q.length;k++){const n=NODES[q[k]];for(const m of n.links)if(d[m]===99){d[m]=d[n.id]+1;q.push(m);}}return d;});
export function nextHop(from,to){if(from===to)return to;let best=from,bd=99;for(const m of NODES[from].links)if(HOPS[m][to]<bd){bd=HOPS[m][to];best=m;}return best;}
export function nearestNode(x,z){let best=0,bd=1e9;for(const n of NODES){const d=dist(x,z,n.x,n.z);if(d<bd){bd=d;best=n.id;}}return best;}
export function rectAt(x,z,m=0,cop=false){for(const r of RECTS){if(cop&&!r.cop)continue;if(x>=r.x0+m&&x<=r.x1-m&&z>=r.z0+m&&z<=r.z1-m)return r;}return null;}
// The closest point you may stand on (inside a box shrunk by a margin).
function clampInto(x,z,m,cop){let bx=x,bz=z,bd=1e18;for(const r of RECTS){if(cop&&!r.cop)continue;const cx=clamp(x,r.x0+m,r.x1-m),cz=clamp(z,r.z0+m,r.z1-m),d=(cx-x)*(cx-x)+(cz-z)*(cz-z);if(d<bd){bd=d;bx=cx;bz=cz;}}return [bx,bz];}
export function clampPoint(x,z,m=0){return rectAt(x,z,m)?[x,z]:clampInto(x,z,m,false);}
// A point in a lane of the street from node a to node b, u metres past a's centre.
export function lanePoint(a,b,u,lane){const A=NODES[a],B=NODES[b],dx=Math.sign(B.x-A.x),dz=Math.sign(B.z-A.z);return {x:A.x+dx*u-dz*lane,z:A.z+dz*u+dx*lane,h:Math.atan2(dx,-dz)};}
// Is the straight line between two points clear of buildings (cruisers can't see down alleys)?
export function lineOfSight(ax,az,bx,bz,max=120){const d=dist(ax,az,bx,bz);if(d>max)return false;const n=Math.ceil(d/6);for(let i=1;i<n;i++){const t=i/n;if(!rectAt(ax+(bx-ax)*t,az+(bz-az)*t,-.5,true))return false;}return true;}
// The street route from a point to a stop: the points to drive through, ending at the stop.
export function routeTo(x,z,stop){const end={x:stop.x,z:stop.z},here=rectAt(x,z,-1),there=rectAt(stop.x,stop.z,-1);
 if(here&&here===there||dist(x,z,stop.x,stop.z)<30)return [{x,z},end];
 const ends=r=>r&&r.edge?[r.edge.a,r.edge.b]:[nearestNode(x,z)],from=ends(here),to=there&&there.edge?[there.edge.a,there.edge.b]:[nearestNode(stop.x,stop.z)];
 let best=null,bd=1e9;for(const a of from)for(const b of to){const d=dist(x,z,NODES[a].x,NODES[a].z)+HOPS[a][b]*140+dist(stop.x,stop.z,NODES[b].x,NODES[b].z);if(d<bd){bd=d;best=[a,b];}}
 const pts=[{x,z}];let n=best[0];pts.push({x:NODES[n].x,z:NODES[n].z,node:n});for(let guard=0;n!==best[1]&&guard<30;guard++){n=nextHop(n,best[1]);pts.push({x:NODES[n].x,z:NODES[n].z,node:n});}pts.push(end);return pts;}
export function routeLength(pts){let d=0;for(let i=1;i<pts.length;i++)d+=dist(pts[i].x,pts[i].z,pts[i-1].x,pts[i-1].z);return d;}
// How many cruisers come for you at each wanted level, and how long you must stay out of sight.
export const PURSUERS=[0,1,2,3,4,4];
export const evadeTime=stars=>4.5+stars*.9;

export class WorldSim {
 constructor({seed=1,day=1,heat=0,district=0,weather=0,spot=null}={}){this.seed=seed>>>0||1;this.random=seededRandom(this.seed^0x5f3759df);this.t=0;this.acc=0;this.events=[];
  const s=STOPS[district]||STOPS[0],ok=spot&&Number.isFinite(spot.x)&&Number.isFinite(spot.z)&&rectAt(spot.x,spot.z,CAR_R);
  this.x=ok?spot.x:s.x;this.z=ok?spot.z:s.z;this.h=ok&&Number.isFinite(spot.h)?spot.h:s.h;this.vx=0;this.vz=0;this.vf=0;this.steer=0;this.slip=0;this.speed=0;this.yaw=0;this.drifting=false;this.topSpeed=0;this.surface='road';
  this.parked=null;this.parking=null;this.leaving=ok?null:s.id;this.gps=null;this.run=null;this.chase=null;this.calm=0;this.blocks=[];this.busted=false;
  this.district=districtAt(this.x,this.z);this.home=district;this.day=0;this.heat=0;this.stars=0;this.weather=weather;
  this.trip={cash:0,nearMisses:0,crashes:0,chased:false,escaped:false,t:0,stars:0};this.nodeLock=NODES.map(()=>-1);
  this.cars=[];this.cops=[];this.pickups=[];this.spawnTraffic();this.setNight({day,heat,weather,district});}
 // The trade state changed (a new night, more heat): refresh what the street knows about you.
 setNight({day=this.day,heat=this.heat,weather=this.weather,district=this.home}={}){this.heat=heat;this.stars=wantedStars(heat);this.weather=weather;this.home=district;
  if(day!==this.day){this.day=day;this.spawnPickups();}const want=Math.max(1,Math.ceil(this.stars/2)+(this.stars>=4?1:0));
  while(this.cops.filter(c=>c.mode!=='off').length<want&&!this.chase)this.spawnCop('patrol');}
 get wanted(){return this.chase?this.chase.stars:0;}
 get seen(){return !!this.chase&&this.chase.seen;}
 emit(type,extra={}){this.events.push({type,t:this.t,...extra});if(this.events.length>80)this.events.shift();}
 spawnTraffic(count=26){const r=this.random;for(let i=0;i<count;i++){for(let tries=0;tries<20;tries++){const e=EDGES[Math.floor(r()*EDGES.length)],flip=r()<.5,a=flip?e.b:e.a,b=flip?e.a:e.b,u=NODE_R+4+r()*(140-NODE_R*2-8),lane=LANES[Math.floor(r()*2)],p=lanePoint(a,b,u,lane);
   if(dist(p.x,p.z,this.x,this.z)<45||this.cars.some(c=>dist(c.x,c.z,p.x,p.z)<14))continue;this.cars.push({a,b,c:-1,u,lane,v:8+r()*4,vmax:10+r()*5,kind:Math.floor(r()*6),mode:'edge',w:0,p0:null,p1:null,p2:null,len:0,x:p.x,z:p.z,h:p.h,stun:0,close:false,cool:0,held:0});break;}}}
 spawnPickups(){const r=seededRandom((this.seed+this.day*7919)>>>0||1);this.pickups=[];for(let i=0;i<16;i++){const e=EDGES[Math.floor(r()*EDGES.length)],flip=r()<.5,p=lanePoint(flip?e.b:e.a,flip?e.a:e.b,NODE_R+10+r()*(140-NODE_R*2-20),LANES[Math.floor(r()*2)]);this.pickups.push({x:p.x,z:p.z,value:15+Math.floor(r()*5)*5,taken:false});}}
 spawnCop(mode,far=110){const r=this.random,options=NODES.filter(n=>{const d=dist(n.x,n.z,this.x,this.z);return d>far&&d<far+260&&!lineOfSight(n.x,n.z,this.x,this.z,400)&&!this.cops.some(c=>c.mode!=='off'&&dist(c.x,c.z,n.x,n.z)<30);});
  const pool=options.length?options:NODES.filter(n=>dist(n.x,n.z,this.x,this.z)>far),n=pool[Math.floor(r()*pool.length)]||NODES[24],goal=n.links[Math.floor(r()*n.links.length)],g=NODES[goal];
  const cop={x:n.x,z:n.z,h:Math.atan2(g.x-n.x,-(g.z-n.z)),v:0,mode,goal,prev:n.id,sees:false,cool:0,stuck:0};const free=this.cops.findIndex(c=>c.mode==='off');if(free>=0)this.cops[free]=cop;else if(this.cops.length<8)this.cops.push(cop);return cop;}
 // Feed real elapsed time; the sim runs whole fixed steps so the rules never depend on frame rate.
 advance(elapsed,input){this.acc=Math.min(this.acc+Math.max(0,elapsed),.2);let n=0;while(this.acc>=STEP){this.acc-=STEP;this.step(input);n++;}return n;}
 step(input={}){if(this.parked!==null||this.busted)return;const dt=STEP;this.t+=dt;this.trip.t+=dt;this.calm=Math.max(0,this.calm-dt);
  this.drive(input,dt);this.traffic(dt);this.police(dt);this.world(dt);}
 // ── The car: weighty arcade handling. Grip pulls the car's motion back in line with its nose;
 // the handbrake lets go of the rear so it slides, and sand is slow and loose.
 drive(input,dt){let throttle=clamp(+input.throttle||0,0,1),brake=clamp(+input.brake||0,0,1),steerIn=clamp(+input.steer||0,-1,1),hand=!!input.handbrake;
  const stop=this.stopHere();
  // Rolling into a marked spot under 30 mph pulls you up to the curb.
  if(this.parking!==null&&(!stop||stop.id!==this.parking))this.parking=null;
  if(stop&&this.leaving!==stop.id&&this.parking===null&&this.speed<13.5&&this.canPark(stop))this.parking=stop.id;
  if(this.leaving!==null&&(!stop||stop.id!==this.leaving)){const s=STOPS[this.leaving];if(dist(this.x,this.z,s.x,s.z)>s.r+3)this.leaving=null;}
  if(this.parking!==null){throttle=0;brake=1;hand=false;steerIn*=.3;}
  const rect=rectAt(this.x,this.z,0),sand=rect?.kind==='beach',grip=sand?.5:this.weather===1?.85:1,top=sand?SAND_SPEED:TOP_SPEED;
  // Steering eases in and centres itself, so a tap is a nudge and a hold is a turn.
  const rate=(steerIn===0||Math.sign(steerIn)!==Math.sign(this.steer)?7.5:4.2)*dt;this.steer+=clamp(steerIn-this.steer,-rate,rate);
  let fx=Math.sin(this.h),fz=-Math.cos(this.h),vf=this.vx*fx+this.vz*fz;
  // Yaw from the front wheels: tight at walking pace, long and stable at speed.
  const lock=.6/(1+Math.pow(Math.abs(vf)/11,1.5)),yaw=clamp(vf/2.7*Math.tan(this.steer*lock)*(hand?1.5:1),-2.7,2.7);this.h=wrap(this.h+yaw*dt);this.yaw=yaw;
  fx=Math.sin(this.h);fz=-Math.cos(this.h);const rx=Math.cos(this.h),rz=Math.sin(this.h);vf=this.vx*fx+this.vz*fz;let vl=this.vx*rx+this.vz*rz;
  // Engine, brakes (which become reverse at a standstill) and drag.
  if(throttle>0&&vf>-.5)vf+=throttle*(vf<12?10.5:vf<26?7.5:4.2)*(sand?.6:1)*dt;else if(throttle>0)vf+=20*dt;
  if(brake>0){if(vf>.4)vf=Math.max(0,vf-brake*27*grip*dt);else if(this.parking===null)vf=Math.max(-REVERSE_SPEED,vf-brake*7*dt);else vf=0;}
  if(hand)vf-=Math.sign(vf)*Math.min(Math.abs(vf),9*dt);
  vf-=vf*(throttle>0?.03:.32)*dt+Math.sign(vf)*Math.min(Math.abs(vf),(throttle>0?0:1.1)*dt);if(vf>top)vf=Math.max(top,vf-(sand?26:12)*dt);
  // Sideways grip: strong until the tyres let go, then it takes a moment to hook up again.
  const sliding=hand||Math.abs(vl)>(this.drifting?2.2:5.2),k=(hand?1.5:sliding?4.2:9.5)*grip;vl*=Math.exp(-k*dt);this.drifting=sliding&&Math.abs(vf)>7&&Math.abs(vl)>1.6;this.slip=vl;
  this.vx=fx*vf+rx*vl;this.vz=fz*vf+rz*vl;let nx=this.x+this.vx*dt,nz=this.z+this.vz*dt;
  // Buildings: slide along the wall, losing speed with how square you hit it.
  if(!rectAt(nx,nz,CAR_R)){const [cx,cz]=clampInto(nx,nz,CAR_R,false),ox=nx-cx,oz=nz-cz,len=Math.hypot(ox,oz)||1,wx=ox/len,wz=oz/len,vn=this.vx*wx+this.vz*wz;nx=cx;nz=cz;
   if(vn>0){this.vx-=wx*vn*1.15;this.vz-=wz*vn*1.15;const keep=1-Math.min(.55,vn/36);this.vx*=keep;this.vz*=keep;if(vn>7){this.trip.crashes++;this.emit('crash',{hard:vn>16,wall:true});}}}
  this.x=nx;this.z=nz;this.speed=Math.hypot(this.vx,this.vz);this.vf=this.vx*fx+this.vz*fz;this.topSpeed=Math.max(this.topSpeed,this.speed);this.surface=sand?'sand':rect?.kind||'road';
  if(this.parking!==null&&this.speed<.5){this.vx=this.vz=0;this.speed=0;this.vf=0;this.parked=this.parking;this.parking=null;this.emit('parked',{stop:this.parked});}}
 stopHere(){for(const s of STOPS)if(dist(this.x,this.z,s.x,s.z)<s.r)return s;return null;}
 // Dealers won't talk with cruisers on you; a spray shop will, if nobody saw you roll in.
 canPark(stop){return !this.chase||stop.kind==='garage'&&!this.chase.seen;}
 // Push the player off another car and take speed off both; returns how hard it was.
 bump(ox,oz,r,ovx=0,ovz=0){const dx=this.x-ox,dz=this.z-oz,d=Math.hypot(dx,dz);if(d>=r||d<1e-6)return 0;const nx=dx/d,nz=dz/d,rel=(this.vx-ovx)*nx+(this.vz-ovz)*nz;
  const [px,pz]=clampPoint(this.x+nx*(r-d),this.z+nz*(r-d),CAR_R);this.x=px;this.z=pz;if(rel<0){this.vx-=nx*rel*1.3;this.vz-=nz*rel*1.3;const keep=1-Math.min(.5,-rel/40);this.vx*=keep;this.vz*=keep;}return Math.max(0,-rel);}
 // ── Traffic keeps its lane, queues behind whatever is in front and takes turns at junctions.
 traffic(dt){const cars=this.cars;for(let i=0;i<cars.length;i++){const c=cars[i];c.cool=Math.max(0,c.cool-dt);if(c.stun>0){c.stun-=dt;c.v=0;}
   else if(c.mode==='edge'){const end=140-NODE_R;let gap=end-c.u+6,A=NODES[c.a],B=NODES[c.b],dx=Math.sign(B.x-A.x),dz=Math.sign(B.z-A.z);
    for(let j=0;j<cars.length;j++){const o=cars[j];if(j===i||o.mode!=='edge'||o.a!==c.a||o.b!==c.b||o.lane!==c.lane||o.u<=c.u)continue;gap=Math.min(gap,o.u-c.u-6.5);}
    // Whatever else is in the lane ahead: you, a cruiser, a roadblock.
    const ahead=(x,z,r)=>{const along=(x-A.x)*dx+(z-A.z)*dz-c.u,side=-(x-A.x)*dz+(z-A.z)*dx-c.lane;if(along>0&&Math.abs(side)<r)gap=Math.min(gap,along-6);};
    ahead(this.x,this.z,2.4);for(const k of this.cops)if(k.mode!=='off')ahead(k.x,k.z,2.2);for(const b of this.blocks)for(const q of b.cars)ahead(q.x,q.z,3);
    const goal=clamp(gap*1.1,0,c.vmax);c.v+=clamp(goal-c.v,-18*dt,5*dt);c.u+=c.v*dt;
    if(c.u>=end){c.u=end;if(c.c<0){const links=NODES[c.b].links.filter(n=>n!==c.a);c.c=links.length?links[Math.floor(this.random()*links.length)]:c.a;}
     const lock=this.nodeLock[c.b],exitBusy=cars.some((o,j)=>j!==i&&o.mode==='edge'&&o.a===c.b&&o.b===c.c&&o.lane===c.lane&&o.u<NODE_R+9);
     if((lock<0||lock===i)&&!exitBusy){this.nodeLock[c.b]=i;c.p0=lanePoint(c.a,c.b,end,c.lane);c.p2=lanePoint(c.b,c.c,NODE_R,c.lane);const turn=c.c!==c.a&&NODES[c.a].i!==NODES[c.c].i&&NODES[c.a].j!==NODES[c.c].j;
      c.p1=c.c===c.a?{x:(c.p0.x+c.p2.x)/2+dx*9,z:(c.p0.z+c.p2.z)/2+dz*9}:turn?(dx?{x:c.p2.x,z:c.p0.z}:{x:c.p0.x,z:c.p2.z}):{x:(c.p0.x+c.p2.x)/2,z:(c.p0.z+c.p2.z)/2};
      c.len=Math.max(6,dist(c.p0.x,c.p0.z,c.p1.x,c.p1.z)+dist(c.p1.x,c.p1.z,c.p2.x,c.p2.z));c.w=0;c.mode='turn';c.held=0;}
     else{c.v=0;c.held+=dt;if(c.held>6&&lock>=0&&lock!==i&&cars[lock].mode!=='turn')this.nodeLock[c.b]=-1;}}
    const p=lanePoint(c.a,c.b,c.u,c.lane);c.x=p.x;c.z=p.z;c.h=p.h;}
   else{const near=dist(c.x,c.z,this.x,this.z)<6.5&&(this.x-c.x)*Math.sin(c.h)-(this.z-c.z)*Math.cos(c.h)>0,wait=near&&c.held<1.6,goal=wait?0:Math.min(c.vmax,near?3:8);c.held=near?c.held+dt:0;c.v+=clamp(goal-c.v,-18*dt,5*dt);c.w=Math.min(1,c.w+c.v*dt/c.len);
    const w=c.w,u=1-w;c.x=u*u*c.p0.x+2*u*w*c.p1.x+w*w*c.p2.x;c.z=u*u*c.p0.z+2*u*w*c.p1.z+w*w*c.p2.z;const tx=2*u*(c.p1.x-c.p0.x)+2*w*(c.p2.x-c.p1.x),tz=2*u*(c.p1.z-c.p0.z)+2*w*(c.p2.z-c.p1.z);if(Math.abs(tx)+Math.abs(tz)>1e-6)c.h=Math.atan2(tx,-tz);
    if(c.w>=1){if(this.nodeLock[c.b]===i)this.nodeLock[c.b]=-1;c.a=c.b;c.b=c.c;c.c=-1;c.u=NODE_R;c.mode='edge';}}
   // You and this car: a bump costs speed and stops them for a moment; a clean pass at speed pays.
   const d=dist(c.x,c.z,this.x,this.z);if(d<3){const hit=this.bump(c.x,c.z,3,Math.sin(c.h)*c.v,-Math.cos(c.h)*c.v);c.close=false;if(hit>3&&!c.cool){c.cool=1.2;c.stun=1.4;this.trip.crashes++;this.emit('crash',{hard:hit>14});}}
   else if(d<4.6&&this.speed>16&&!c.cool)c.close=true;else if(d>7&&c.close){c.close=false;c.cool=3;this.trip.nearMisses++;const oncoming=Math.cos(c.h-this.h)<-.3,bonus=oncoming?20:10;this.addCash(bonus);this.emit('near',{bonus,oncoming,count:this.trip.nearMisses});}}}
 // ── Cruisers. Patrols roam the grid; once one spots you they all come, heading for where you
 // were last seen. Stay out of every cruiser's sight long enough and they give up.
 police(dt){const ch=this.chase,stars=this.stars;let anySees=false,close=false;
  for(const c of this.cops){if(c.mode==='off')continue;c.cool=Math.max(0,c.cool-dt);const d=dist(c.x,c.z,this.x,this.z),sees=d<(ch?110:16+stars*9)&&lineOfSight(c.x,c.z,this.x,this.z);c.sees=sees;
   if(!ch){ // Patrol: follow the streets; notice a wanted car, a speeder, or whoever just hit them.
    if(sees&&!this.calm&&(stars>0||this.speed>32&&d<26)){this.startChase(c,stars>0?'wanted':'speeding');return;}
    this.cruise(c,dt,9);}
   else{if(sees)anySees=true;if(d<8.5)close=true;
    if(sees){c.goal=-1;this.moveAgent(c,this.x+this.vx*.35,this.z+this.vz*.35,31+ch.stars*1.3,dt,d<14?Math.max(this.speed-2,8):99);}
    else{const known=nearestNode(ch.lastX,ch.lastZ);if(c.goal<0){const r=rectAt(c.x,c.z,-2,true),near=nearestNode(c.x,c.z);
      if(dist(c.x,c.z,NODES[near].x,NODES[near].z)<NODE_R||!r?.edge)c.goal=near;else{const {a,b}=r.edge,da=dist(c.x,c.z,NODES[a].x,NODES[a].z)+HOPS[a][known]*140,db=dist(c.x,c.z,NODES[b].x,NODES[b].z)+HOPS[b][known]*140;c.goal=da<db?a:b;}}
     const g=NODES[c.goal];if(dist(c.x,c.z,g.x,g.z)<9){const from=c.goal;c.goal=from===known?(g.links.filter(n=>n!==c.prev)[Math.floor(this.random()*Math.max(1,g.links.length-1))]??g.links[0]):nextHop(from,known);c.prev=from;}
     const t=NODES[c.goal];this.moveAgent(c,t.x,t.z,26+ch.stars,dt);}}
   // Cruisers shove through traffic and each other rather than stack up.
   for(const o of this.cars){const dd=dist(o.x,o.z,c.x,c.z);if(dd<3&&dd>1e-6){c.x+=(c.x-o.x)/dd*(3-dd);c.z+=(c.z-o.z)/dd*(3-dd);c.v*=.96;if(ch&&!o.cool&&c.v>10){o.cool=1.5;o.stun=1.5;this.emit('copcrash',{});}}}
   for(const o of this.cops){if(o===c||o.mode==='off')continue;const dd=dist(o.x,o.z,c.x,c.z);if(dd<3.2&&dd>1e-6){c.x+=(c.x-o.x)/dd*(3.2-dd)*.5;c.z+=(c.z-o.z)/dd*(3.2-dd)*.5;}}
   const [px,pz]=rectAt(c.x,c.z,CAR_R,true)?[c.x,c.z]:clampInto(c.x,c.z,CAR_R,true);c.x=px;c.z=pz;
   if(d<3.1){const hit=this.bump(c.x,c.z,3.1,Math.sin(c.h)*c.v,-Math.cos(c.h)*c.v);if(hit>2&&!c.cool){c.cool=1;c.v*=.5;this.trip.crashes++;this.emit('rammed',{hard:hit>12});if(!this.chase&&!this.calm&&hit>6&&this.speed>8){this.startChase(c,'hit');return;}}}}
  for(const b of this.blocks){b.life-=dt;for(const q of b.cars){const hit=this.bump(q.x,q.z,3.2);if(hit>3&&!b.cool){b.cool=1;this.trip.crashes++;this.emit('crash',{hard:true,block:true});}}b.cool=Math.max(0,(b.cool||0)-dt);}
  this.blocks=this.blocks.filter(b=>b.life>0);
  if(!this.chase)return;const c=this.chase;c.t+=dt;c.seen=anySees;if(anySees){c.lastX=this.x;c.lastZ=this.z;c.evade=Math.max(0,c.evade-dt*2.5);}
  else{const cover=this.surface==='alley'||this.surface==='tunnel';c.evade+=dt*(cover?1.8:1);}
  // Boxed in: a cruiser on your bumper while you crawl fills the bust meter.
  if(close&&this.speed<6)c.bust+=dt;else c.bust=Math.max(0,c.bust-dt*.7);
  if(c.bust>=2.4){this.bustNow();return;}
  if(c.evade>=evadeTime(c.stars)){this.endChase(true);return;}
  // More cruisers roll in from out of sight, and at three stars they start blocking the road ahead.
  c.spawn-=dt;if(c.spawn<=0){c.spawn=6;if(this.cops.filter(k=>k.mode==='chase').length<PURSUERS[c.stars]){const k=this.spawnCop('chase',120);k.goal=-1;}}
  c.block-=dt;if(c.stars>=3&&c.block<=0&&this.speed>14&&this.blocks.length<(c.stars>=5?2:1)){c.block=c.stars>=5?9:14;this.roadblock();}}
 // Patrol driving: lane to lane between intersections, turning at random (or toward you, once you're hot).
 cruise(c,dt,top){let g=NODES[c.goal],p=NODES[c.prev];const dx=Math.sign(g.x-p.x),dz=Math.sign(g.z-p.z),tx=g.x-dx*NODE_R*.8-dz*LANES[0],tz=g.z-dz*NODE_R*.8+dx*LANES[0];
  if(dist(c.x,c.z,tx,tz)<5){const links=g.links.filter(n=>n!==c.prev),hunt=this.stars>=3&&!this.calm&&this.random()<.6?nextHop(c.goal,nearestNode(this.x,this.z)):-1,next=hunt>=0&&hunt!==c.goal?hunt:links.length?links[Math.floor(this.random()*links.length)]:c.prev;c.prev=c.goal;c.goal=next;}
  // A patrol on its rounds queues like anyone else.
  let gap=99;const fx=Math.sin(c.h),fz=-Math.cos(c.h),see=(x,z)=>{const ox=x-c.x,oz=z-c.z,ahead=ox*fx+oz*fz;if(ahead>0&&ahead<gap&&Math.abs(-ox*fz+oz*fx)<2.3)gap=ahead;};see(this.x,this.z);for(const o of this.cars)see(o.x,o.z);for(const o of this.cops)if(o!==c&&o.mode!=='off')see(o.x,o.z);
  this.moveAgent(c,tx,tz,top,dt,gap<16?Math.max(0,(gap-6.5)*1.2):99);}
 moveAgent(c,tx,tz,top,dt,cap=99){const want=Math.atan2(tx-c.x,-(tz-c.z)),dh=wrap(want-c.h),turn=(c.v<4?1.6:Math.min(2.6,30/Math.max(6,c.v)))*dt;c.h=wrap(c.h+clamp(dh,-turn,turn));
  const goal=Math.min(cap,top*clamp(1-Math.abs(dh)*.7,.3,1));c.v+=clamp(goal-c.v,-24*dt,9.5*dt);c.x+=Math.sin(c.h)*c.v*dt;c.z-=Math.cos(c.h)*c.v*dt;}
 startChase(cop,why){const stars=Math.max(1,this.stars);this.chase={stars,evade:0,bust:0,t:0,seen:true,lastX:this.x,lastZ:this.z,spawn:2.5,block:8,why};this.trip.chased=true;this.trip.stars=Math.max(this.trip.stars,stars);this.run=null;
  for(const c of this.cops)if(c.mode==='patrol'){c.mode='chase';c.goal=-1;}this.emit('spotted',{why,stars});}
 endChase(escaped){const ch=this.chase;if(!ch)return;this.chase=null;this.blocks=[];this.calm=escaped?25:12;let keep=Math.max(1,Math.ceil(this.stars/2)+(this.stars>=4?1:0));
  for(const c of this.cops){if(c.mode!=='chase')continue;if(keep-->0){c.mode='patrol';const n=nearestNode(c.x,c.z);c.prev=n;c.goal=NODES[n].links[0];}else c.mode='off';}
  if(escaped){this.trip.escaped=true;this.emit('lost',{stars:ch.stars,seconds:Math.round(ch.t)});}}
 bustNow(){this.busted=true;this.vx=this.vz=0;this.speed=0;this.vf=0;this.emit('busted',{stars:this.chase?.stars||0});}
 // After the patrol stop is settled at the window: back on the road, with a head start.
 release(){if(!this.busted)return;this.busted=false;this.endChase(false);this.calm=20;this.newTrip();}
 // Three cruisers parked across the lanes a block ahead; the sidewalk on one side stays open.
 roadblock(){const fx=Math.sin(this.h),fz=-Math.cos(this.h),axisX=Math.abs(fx)>Math.abs(fz),dir=Math.sign(axisX?fx:fz)||1;
  for(const ahead of [95,120,70]){const cx=this.x+(axisX?dir*ahead:0),cz=this.z+(axisX?0:dir*ahead),r=rectAt(cx,cz,0,true);if(!r||!r.edge||r.edge.horizontal!==axisX)continue;
   const A=NODES[r.edge.a],B=NODES[r.edge.b],along=axisX?cx:cz,lo=(axisX?A.x:A.z)+NODE_R+8,hi=(axisX?B.x:B.z)-NODE_R-8;if(along<lo||along>hi)continue;
   const mid=axisX?A.z:A.x,open=this.random()<.5?-1:1,cars=[-4.6,0,4.6].map(o=>({x:axisX?cx:mid+o+open*-1.4,z:axisX?mid+o+open*-1.4:cz,h:(axisX?0:Math.PI/2)+.25*(o?Math.sign(o):0)}));
   this.blocks.push({cars,life:22,cool:0,x:cx,z:cz});this.emit('roadblock',{x:cx,z:cz});return true;}return false;}
 // The spray shop: only works if no cruiser watched you pull in.
 respray(){if(this.chase&&this.chase.seen)return false;const was=!!this.chase;if(was){this.endChase(true);}this.calm=40;this.emit('respray',{chase:was});return true;}
 // ── Cash on the street, district lines, the delivery clock.
 world(dt){for(const q of this.pickups)if(!q.taken&&dist(q.x,q.z,this.x,this.z)<2.7){q.taken=true;this.addCash(q.value);this.emit('cash',{value:q.value});}
  const d=districtAt(this.x,this.z);if(d!==this.district){this.district=d;this.emit('district',{district:d});}
  if(this.run&&!this.run.late){this.run.t+=dt;if(this.run.t>this.run.par){this.run.late=true;this.emit('late',{});}}}
 addCash(n){const room=DRIVE_CASH_CAP-this.trip.cash,got=Math.max(0,Math.min(room,n));this.trip.cash+=got;return got;}
 // A delivery run: the clock starts when you pull away with the goods on board.
 startRun(district){const stop=STOPS[district];if(!stop||this.chase)return null;const metres=routeLength(routeTo(this.x,this.z,stop));this.run={to:district,par:Math.round(14+metres/15),t:0,late:false};this.gps=stop.id;this.emit('run',{to:district,par:this.run.par});return this.run;}
 // Pulling up at a dealer in another district ends the trip: this is what the night's travel gets.
 arrive(){const stop=this.parked!==null?STOPS[this.parked]:null;if(!stop||stop.kind!=='market')return null;let express=0;if(this.run&&this.run.to===stop.district&&!this.run.late)express=this.addCash(EXPRESS_BONUS);
  const t=this.trip,out={v:1,result:t.escaped?'escaped':'clean',cash:Math.round(t.cash),nearMisses:t.nearMisses,crashes:t.crashes,stars:t.stars,seconds:Math.round(t.t),express};this.run=null;if(this.gps===stop.id)this.gps=null;this.newTrip();return out;}
 // A bust mid-trip: what you had picked up on the road is gone with it.
 bustOutcome(){const t=this.trip;return {v:1,result:'busted',cash:0,nearMisses:t.nearMisses,crashes:t.crashes,stars:Math.max(1,t.stars),seconds:Math.round(t.t)};}
 newTrip(){this.trip={cash:0,nearMisses:0,crashes:0,chased:false,escaped:false,t:0,stars:0};}
 depart(){if(this.parked===null)return;this.leaving=this.parked;this.parked=null;}
 // Skipping the drive: the car is simply at the other dealer.
 teleport(stopId){const s=STOPS[stopId];if(!s)return;this.x=s.x;this.z=s.z;this.h=s.h;this.vx=this.vz=0;this.speed=0;this.vf=0;this.parked=null;this.parking=null;this.leaving=s.id;this.run=null;this.gps=null;if(this.chase)this.endChase(false);this.busted=false;this.district=districtAt(s.x,s.z);this.newTrip();}
 spot(){return {x:Math.round(this.x),z:Math.round(this.z),h:+this.h.toFixed(2)};}
}

// A careful driver for auto-drive (accessibility) and tests: follows the street route to the GPS
// stop in the right-hand lane, slows for corners and whatever is in front, and pulls up.
const axis=(ax,az,bx,bz)=>Math.abs(bx-ax)>=Math.abs(bz-az)?[Math.sign(bx-ax)||1,0]:[0,Math.sign(bz-az)||1];
const backing=new WeakMap();
export function autopilot(sim){const stop=STOPS[sim.gps??-1];if(!stop)return {throttle:0,brake:sim.speed>1?1:0,steer:0};
 const pts=routeTo(sim.x,sim.z,stop);let i=1;if(pts.length>2&&dist(sim.x,sim.z,pts[1].x,pts[1].z)<NODE_R)i=2;
 const b=pts[i],last=i===pts.length-1;let tx=b.x,tz=b.z,slow=false;
 if(!last){ // aim down the right-hand lane of the street that leads to the next junction
  const from=i===1?sim:pts[i-1],[ux,uz]=axis(from.x,from.z,b.x,b.z),toGo=(b.x-sim.x)*ux+(b.z-sim.z)*uz,look=Math.min(Math.max(toGo,0),9+sim.speed*.55);
  tx=b.x-uz*LANES[0]-ux*(toGo-look);tz=b.z+ux*LANES[0]-uz*(toGo-look);const n=pts[i+1],[vx,vz]=axis(b.x,b.z,n.x,n.z);slow=toGo<34&&(vx!==ux||vz!==uz);}
 const want=Math.atan2(tx-sim.x,-(tz-sim.z)),dh=wrap(want-sim.h),far=dist(sim.x,sim.z,stop.x,stop.z);
 let limit=Math.abs(dh)>.5?6:slow||i===2?8.5:far<45?9:20,block=99,parked=false,side=0;const fx=Math.sin(sim.h),fz=-Math.cos(sim.h);
 const see=(x,z,v)=>{const ox=x-sim.x,oz=z-sim.z,ahead=ox*fx+oz*fz,off=-ox*fz+oz*fx;if(ahead>0&&Math.abs(off)<2.4&&ahead<block){block=ahead;parked=v<1;side=off;}};
 for(const c of sim.cars)see(c.x,c.z,c.v);for(const c of sim.cops)if(c.mode!=='off')see(c.x,c.z,c.v);for(const q of sim.blocks)for(const k of q.cars)see(k.x,k.z,0);
 let steer=clamp(dh*2.2,-1,1);const v=sim.vf??sim.speed;
 // Something stopped in the way: back off if it's on the bumper, otherwise ease round it.
 const until=backing.get(sim)||0;if(sim.t<until)return {throttle:0,brake:1,steer:side>=0?1:-1,handbrake:false};
 if(parked&&block<14){if(block<4.6){backing.set(sim,sim.t+1.3);return {throttle:0,brake:1,steer:side>=0?1:-1,handbrake:false};}limit=Math.min(limit,4.5);steer=clamp(steer+(side>=0?-1:1)*.9,-1,1);}
 else if(block<8+sim.speed*.9)limit=Math.min(limit,Math.max(0,(block-7)*1.2));
 return {throttle:v<limit-.5?(v<limit-4?1:.5):0,brake:v>limit+2?1:0,steer,handbrake:false};}
// Drives the sim with a driver function until it parks (or time runs out); returns the seconds taken.
export function driveUntilParked(sim,driver=autopilot,maxSeconds=240){const start=sim.t;while(sim.parked===null&&!sim.busted&&sim.t-start<maxSeconds)sim.step(driver(sim));return sim.parked!==null?sim.t-start:-1;}
