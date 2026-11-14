// Neon Pinball: one table, "Dawg City Nights". Deterministic fixed-step physics and the full rule
// set live here; renderers only read this state and the events it emits.
//
// Physics. The table is 10 × 20 units, y up toward the backglass (the playfield is x 0–9.1, the
// shooter lane x 9.1–10). One unit is about 5 cm, so the ball (radius 0.25) is a real 27 mm ball
// and gravity is the slope of a 6.5° table. Every step is 1/480 s and speed is capped so a ball
// never travels further in a step than the thinnest thing it can hit: tunnelling is impossible by
// construction. Flippers are rotating bodies with their own angular velocity; the ball takes the
// speed of the point of the bat that strikes it, so tip shots are hard, shots near the pivot are
// soft, and a moving bat can catch, cradle, drop-catch or pass the ball.
//
// Rules. Six shots: two orbits, two ramps, the drop-target bank and the Dawg House scoop.
// The scoop starts five timed modes, locks balls for multiball and, once every mode is beaten,
// starts the Top Dawg wizard mode. `lights()` says what every insert on the playfield is showing.

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const TABLE={width:10,height:20,field:9.1,ball:.25,step:1/480,gravity:20,maxSpeed:46,zCost:2.6,drain:.5};
const R=TABLE.ball,FW=TABLE.field,mir=x=>FW-x;
export const ARC={x:5,y:15,r:5};
export const FLIPPERS=[
 {side:'left',px:2.45,py:2.3,len:1.75,rest:-.52,up:.47,rb:.24,rt:.11},
 {side:'right',px:6.65,py:2.3,len:1.75,rest:-.52,up:.47,rb:.24,rt:.11}
];
// Flipper motor: angular acceleration and top speed on the stroke, and the spring on the way back.
// AIM turns the strike toward the tip side the further out the ball is hit (the rubber gives and the
// ball rolls off the end), which is what makes late flips cross the table and early ones backhand.
export const FLIP={accel:1200,max:20,back:16,backAccel:700,aim:.8,pivot:.8};
export const flipperAngle=(f,a)=>f.side==='left'?a:Math.PI-a;
export function flipperTip(f,a){const w=flipperAngle(f,a);return {x:f.px+Math.cos(w)*f.len,y:f.py+Math.sin(w)*f.len};}

export const SHOTS=['LEFT ORBIT','LEFT RAMP','DROP TARGETS','DAWG HOUSE','RIGHT RAMP','RIGHT ORBIT'];
// Where each shot's arrow insert sits on the playfield, and which way it points.
export const SHOT_AT=[{x:.48,y:9.9,a:0},{x:1.9,y:9.6,a:0},{x:4.0,y:10.3,a:0},{x:5.2,y:10.0,a:0},{x:7.2,y:9.6,a:0},{x:8.62,y:9.9,a:0}];
export const LANES=[{x:3.05,label:'D'},{x:4.05,label:'A'},{x:5.05,label:'W'},{x:6.05,label:'G'}];
export const LANE_Y=17.7;
export const BUMPERS=[{x:3.5,y:15.5,r:.45},{x:5.6,y:15.5,r:.45},{x:4.55,y:14.1,r:.45}];
export const DROPS=[{x:3.6,y:11.3,w:.2,label:'D'},{x:4.05,y:11.3,w:.2,label:'I'},{x:4.5,y:11.3,w:.2,label:'G'}];
export const STANDUPS=[{x:1.15,y:10.4,w:.2},{x:7.95,y:10.4,w:.2}];
export const SCOOP={x:5.2,y:11.3,r:.4,out:{x:5.2,y:10.6,vx:-2.9,vy:-3}};
export const SPINNER={x:.48,y:13};
export const PLUNGER={x:9.55,y:.95,min:27.9,max:32,auto:34,charge:.9};
export const KICKBACK={x:.31,top:3.2,bottom:1.9,speed:37};
export const SLINGS=[{a:[1.8,6.4],b:[1.8,3.95],c:[2.75,3.65]},{a:[mir(1.8),6.4],b:[mir(1.8),3.95],c:[mir(2.75),3.65]}];
export const ROLLOVERS=[{x:.45,y:5.2,kind:'out'},{x:1.35,y:5.2,kind:'in'},{x:mir(1.35),y:5.2,kind:'in'},{x:mir(.45),y:5.2,kind:'out'}];

// Static geometry: capsules [ax, ay, bx, by] with a radius, a restitution and a kind.
// 'oneway' capsules are solid only from the left of a→b (wire gates); 'sling' faces kick.
export const SEGS=[];
const seg=(ax,ay,bx,by,o={})=>SEGS.push({ax,ay,bx,by,r:o.r??.06,e:o.e??.32,kind:o.kind||'wall',id:o.id??-1});
const pair=(ax,ay,bx,by,o={})=>{seg(ax,ay,bx,by,o);seg(mir(bx),by,mir(ax),ay,{...o,id:o.id===undefined?-1:o.id+1});};
seg(0,0,0,15);seg(10,0,10,15);seg(FW,0,FW,14.6);                       // outer walls and the shooter lane
seg(FW,14.6,9.84,16.3,{kind:'oneway',r:.05});                          // shooter gate
pair(0,9.8,.7,7.55,{kind:'oneway',r:.05});                             // orbit returns feed the inlanes
pair(.9,6.3,.9,4.4);pair(.9,4.4,1.15,3.6);pair(1.15,3.6,2.22,2.6);     // lane divider and inlane guide
pair(1.8,6.4,1.8,3.95,{e:.5});pair(1.8,3.95,2.75,3.65,{e:.5});         // slingshot backs
pair(1.8,6.4,2.75,3.65,{kind:'sling',e:.45,id:0});                     // slingshot faces
pair(.95,10.4,.95,16.2);pair(.95,10.4,1.35,10.4,{kind:'standup',e:.5,id:0}); // orbit lane, standup on the divider
pair(1.35,10.4,1.35,11.7);pair(2.45,10.4,2.45,15.7);pair(.95,16.2,2.45,15.7); // ramp mouth and the block behind it
seg(3.3,11.3,3.3,12);seg(3.3,12,4.5,12.7);seg(4.5,12.7,5.65,12);seg(5.65,12,5.65,10.9); // centre island with a pitched roof
seg(3.3,11.75,5.65,11.75,{e:.45});seg(4.75,10.9,4.75,11.75);
DROPS.forEach((d,i)=>seg(d.x-d.w,d.y,d.x+d.w,d.y,{kind:'drop',id:i,e:.4,r:.07}));
for(const x of [2.55,3.55,4.55,5.55,6.55])seg(x,17.2,x,18.2,{r:.08,e:.5,kind:'post'});
export const POSTS=[[.9,6.3],[mir(.9),6.3],[1.8,6.4],[mir(1.8),6.4],[2.75,3.65],[mir(2.75),3.65],[1.8,3.95],[mir(1.8),3.95],[1.35,10.4],[mir(1.35),10.4],[2.45,10.4],[mir(2.45),10.4],[3.3,11.3],[4.75,10.9],[5.65,10.9]] .map(([x,y])=>({x,y,r:.12}));

// Ramps: a ball crossing the mouth heading up the table leaves the playfield and rides the path
// (x, y, height). It must carry enough speed to crest the top or it rolls back out of the mouth.
// Each returns on a wireform to the inlane on its own side.
function spline(p,per=10){const out=[],at=i=>p[clamp(i,0,p.length-1)];for(let i=0;i<p.length-1;i++)for(let k=0;k<per;k++){const t=k/per,a=at(i-1),b=at(i),c=at(i+1),d=at(i+2);
  out.push([0,1,2].map(j=>.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t)));}
 out.push(p.at(-1).slice());for(const q of out)q[2]=Math.max(0,q[2]);return out;}
const LEFT_PATH=[[1.9,11.2,0],[1.9,12.6,.5],[1.9,14.1,.95],[1.78,15.2,1.15],[1.35,15.9,1.2],[.75,15.9,1.2],[.42,15.2,1.2],[.4,13.5,1.15],[.42,11.5,1.05],[.5,9.7,.9],[.72,8.3,.7],[1.08,7.3,.42],[1.35,6.55,.12]];
function ramp(id,label,path,shot){const pts=spline(path),s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]));
 // The plastic ramp ends where the path stops climbing; the rest is wire.
 let top=0;for(let i=1;i<pts.length;i++)if(pts[i][2]>pts[top][2]+1e-4)top=i;
 return {id,label,shot,pts,s,length:s.at(-1),crest:s[top],mouth:{y:path[0][1],x1:path[0][0]-.55,x2:path[0][0]+.55},exit:{x:path.at(-1)[0],y:path.at(-1)[1]-.2}};}
export const RAMPS=[ramp('left','LEFT RAMP',LEFT_PATH,1),ramp('right','RIGHT RAMP',LEFT_PATH.map(([x,y,z])=>[mir(x),y,z]),4)];
export function rampPoint(r,d){const s=r.s;d=clamp(d,0,r.length);let lo=1,hi=s.length-1;while(lo<hi){const m=(lo+hi)>>1;if(s[m]<d)lo=m+1;else hi=m;}
 const a=r.pts[lo-1],b=r.pts[lo],L=Math.max(1e-6,s[lo]-s[lo-1]),u=(d-s[lo-1])/L;return {x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,z:a[2]+(b[2]-a[2])*u,dy:(b[1]-a[1])/L,dz:(b[2]-a[2])/L,dx:(b[0]-a[0])/L};}

// The five modes, in the order the Dawg House hands them out. `shots` are the lit arrows.
export const MODES=[
 {id:'ramps',name:'RAMP RAGE',goal:4,time:40,shots:[1,4],each:3000,text:'SHOOT 4 RAMPS'},
 {id:'orbits',name:'NIGHT DRIVE',goal:3,time:40,shots:[0,5],each:4000,text:'LAP 3 ORBITS'},
 {id:'bumpers',name:'BARK PARTY',goal:20,time:35,shots:[],each:300,text:'20 BUMPER HITS'},
 {id:'fetch',name:'FETCH',goal:3,time:45,shots:[],each:5000,text:'HIT THE MOVING ARROW 3 TIMES'},
 {id:'drops',name:'BONE YARD',goal:6,time:40,shots:[2],each:1500,text:'DIG UP 6 DROP TARGETS'}
];
export const WIZARD={name:'TOP DAWG',balls:4,jackpot:15000,super:100000,save:15};
export const SCORE={sling:10,bumper:100,spin:100,lane:250,lanes:2500,rollover:100,standup:500,standups:2000,drop:500,bank:3000,ramp:1500,orbit:1500,scoop:1000,lock:3000,skill:5000,modeStart:2500,modeDone:20000,jackpot:10000,jackpotStep:1000,super:50000,kickback:500,extra:5000};
export const COMBO={time:5,max:5},BALL_SAVE=12,MAX_BONUS_X=6,BALLS=3,MB_SAVE=10;
const FETCH_SHOTS=[0,1,4,5,2],FETCH_HOP=6;
// The ladder: every mode beaten is a rank, and Top Dawg is the top of it.
export const STAGES=['STRAY','ALLEY PUP','STREET DAWG','BLOCK BOSS','ALPHA','PACK LEADER','TOP DAWG'];
// Feats: specific things to pull off in one game. Each is awarded once per run by the event named in `on`.
export const FEATS=[
 {id:'pinball.skill',name:'DEAD EYE',text:'Plunge the ball into the flashing lane',on:'skill'},
 {id:'pinball.combo3',name:'FLOW',text:'Chain a 3× combo of ramps and orbits',on:'combo',test:e=>e.combo>=3},
 {id:'pinball.combo5',name:'ON A LEASH',text:'Chain a 5× combo',on:'combo',test:e=>e.combo>=5},
 {id:'pinball.mode',name:'HOUSE TRAINED',text:'Beat a Dawg House mode',on:'modedone'},
 {id:'pinball.modes3',name:'BLOCK BOSS',text:'Beat three modes in one game',on:'modedone',test:e=>e.done>=3},
 {id:'pinball.multiball',name:'PACK ATTACK',text:'Lock three balls and start multiball',on:'multiball'},
 {id:'pinball.jackpot',name:'JACKPOT',text:'Collect a jackpot',on:'jackpot'},
 {id:'pinball.super',name:'SUPER JACKPOT',text:'Collect all four jackpots, then the super jackpot',on:'super'},
 {id:'pinball.bonusx',name:'SPELL IT OUT',text:'Raise the bonus multiplier to 3× with the D-A-W-G lanes',on:'lanes',test:e=>e.bonusX>=3},
 {id:'pinball.bonus',name:'BIG BONUS',text:'Bank an end-of-ball bonus of 20,000 or more',on:'bonus',test:e=>e.points>=20000},
 {id:'pinball.extra',name:'ONE MORE',text:'Collect the extra ball',on:'extraball'},
 {id:'pinball.wizard',name:'TOP DAWG',text:'Beat all five modes and start Top Dawg',on:'wizard'}
];
// Daily tables: one scoring twist picked by the seed, applied when game.daily is true.
const TWISTS=[
 {id:'bumpers',name:'BARK ALL NIGHT',text:'Bumpers score triple',mult:{bumper:3}},
 {id:'ramps',name:'RAMP HAPPY HOUR',text:'Ramps score double',mult:{ramp:2}},
 {id:'orbits',name:'OPEN ROAD',text:'Orbits and the spinner score double',mult:{orbit:2,spin:2}},
 {id:'jackpots',name:'HIGH ROLLERS',text:'Jackpots score double',mult:{jackpot:2,super:2}},
 {id:'skill',name:'SHARP SHOOTER',text:'Skill shots and combos score triple',mult:{skill:3,combo:1}}
];
export function DAILY_TWIST(seed=0){return TWISTS[((seed>>>0)%TWISTS.length)];}

export class PinballGame {
 constructor(random=Math.random,worldSeed=0){
  this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.events=[];this.reason='';this.acc=0;
  this.ball=1;this.phase='plunge';this.balls=[];this.queue=0;this.serve=0;
  this.flips=FLIPPERS.map(f=>({angle:f.rest,omega:0,held:false}));this.input={plunge:false};this.plunge=0;
  this.lanes=[false,false,false,false];this.bonusX=1;this.drops=[false,false,false];this.dropReset=0;this.stand=[false,false];
  this.kickback=true;this.lock={lit:false,count:0};this.mode={id:-1,t:0,n:0,at:0,hop:0};this.modesDone=MODES.map(()=>false);this.next=0;
  this.mb={on:false,wizard:false,lit:[false,false,false,false,false,false],super:false,n:0};this.wizardLit=false;
  this.combo={n:0,t:0,last:-1};this.skill={lane:0,live:false};this.save=0;this.saveArmed=true;
  this.tilt={heat:0,warn:0,on:false};this.extra={lit:false,balls:0,given:false};
  this.tally={bumps:0,ramps:0,orbits:0,drops:0};this.count={i:0,t:0,total:0};
  this.stats={ramps:0,orbits:0,bumps:0,jackpots:0,modes:0,combo:0,multiballs:0,skill:0,wizards:0};
  this.spin={v:0,a:0,n:0};this.nudgeCool=0;this.feats=[];this.daily=false;
  this.newBall(false);
 }
 get ballsLeft(){return Math.max(0,BALLS-this.ball+1);}
 get live(){return this.balls.filter(b=>b.state!=='lane').length;}
 get waiting(){return this.balls.find(b=>b.state==='lane'&&!(b.auto>0));}
 get multiball(){return this.mb.on;}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 emit(type,extra){const e=extra?{type,...extra}:{type};this.events.push(e);this.note(e);}
 add(points,type,extra){if(this.daily)points*=DAILY_TWIST(this.worldSeed).mult[type]||1;this.score+=points;const e={type,points,...extra};this.events.push(e);this.note(e);}
 // Feats land the first time their event happens in a run; a new rank is announced as it is reached.
 note(e){for(const f of FEATS)if(f.on===e.type&&!this.feats.includes(f.id)&&(!f.test||f.test(e,this))){this.feats.push(f.id);this.events.push({type:'feat',id:f.id,name:f.name,text:f.text});}
  if(e.type==='modedone'||e.type==='wizard')this.events.push({type:'rank',stage:this.stage,name:STAGES[this.stage],next:STAGES[this.stage+1]||''});}
 get stage(){return Math.min(STAGES.length-1,this.stats.wizards?STAGES.length-1:Math.min(MODES.length,this.stats.modes));}
 get twist(){return this.daily?DAILY_TWIST(this.worldSeed):null;}
 // The result line: how far up the ladder, the best moment, and what is next.
 summary(){const st=this.stats,brag=st.jackpots?st.jackpots+' jackpot'+(st.jackpots===1?'':'s'):st.combo>1?'a '+st.combo+'× combo':st.ramps+st.orbits+' ramps and orbits';
  return 'Rank: '+STAGES[this.stage]+' with '+brag+'. '+(this.stage>=STAGES.length-1?'You ran Dawg City.':this.stage>=MODES.length?'Top Dawg is lit: shoot the Dawg House.':'Beat '+MODES[this.nextMode()].name+' to make '+STAGES[this.stage+1]+'.');}

 // ── Balls in and out ───────────────────────────────────────────────────────────────────────
 spawn(auto=0){this.balls.push({x:PLUNGER.x,y:PLUNGER.y,z:0,vx:0,vy:0,state:'lane',auto,wait:0,ramp:-1,d:0,v:0,hold:0,cool:0,orb:0,still:0,ax:PLUNGER.x,ay:PLUNGER.y,why:''});}
 newBall(announce=true){this.phase='plunge';this.bonusX=1;this.tally={bumps:0,ramps:0,orbits:0,drops:0};this.tilt={heat:0,warn:0,on:false};this.saveArmed=true;this.save=0;this.kickback=true;this.lanes=[false,false,false,false];
  this.combo={n:0,t:0,last:-1};this.skill={lane:Math.floor(this.random()*4),live:true};this.plunge=0;this.input.plunge=false;this.spawn(0);if(announce)this.emit('nextball',{ball:this.ball});}
 // ← / → hold the flippers. ↓ (or ↑, Space, or the right flipper) pulls the plunger while a ball
 // waits on it: hold for power, let go to fire. With no ball waiting, ↑ nudges the table.
 press(side,down){
  if(this.status!=='playing')return false;down=!!down;
  if(side==='left'||side==='right'){const i=side==='left'?0:1,f=this.flips[i];
   if(down&&!f.held){if(this.phase==='bonus')this.count.fast=true;else if(!this.tilt.on){this.emit('flip',{side});this.rotateLanes(i?1:-1);}}
   f.held=down;if(i===1)this.pull(down);return true;}
  if(side==='down'){this.pull(down);return true;}
  if(side==='up'){if(this.waiting||this.input.plunge)this.pull(down);else if(down)this.nudge();return true;}
  return false;
 }
 // Taps (the demo, on-screen buttons): a firm plunge, a flipper press or a nudge.
 move(dir){if(this.status!=='playing')return false;if(dir==='left'||dir==='right')return this.press(dir,true);
  if(dir==='down'||dir==='up'){if(this.waiting)return this.launch(.8);if(dir==='up')return this.nudge();}return false;}
 pull(down){if(down){if(this.waiting)this.input.plunge=true;}else if(this.input.plunge){this.input.plunge=false;this.launch(this.plunge);}}
 launch(power=.8){const b=this.waiting;this.plunge=0;if(!b||this.phase==='bonus')return false;this.fire(b,PLUNGER.min+(PLUNGER.max-PLUNGER.min)*clamp(power,0,1),clamp(power,0,1));return true;}
 fire(b,speed,power=1){b.state='play';b.vx=0;b.vy=speed;b.auto=0;b.wait=0;b.cool=0;if(this.phase==='plunge')this.phase='live';this.emit('launch',{power});}
 nudge(){if(this.nudgeCool>0||this.tilt.on||this.phase==='bonus')return false;this.nudgeCool=.35;
  for(const b of this.balls)if(b.state==='play'){b.vy+=3.2;b.vx+=b.x<FW/2?1.6:-1.6;}
  this.tilt.heat+=1;this.emit('nudge');if(this.tilt.heat>=1.6){this.tilt.heat=1;this.tilt.warn++;if(this.tilt.warn>=3)this.tiltOut();else this.emit('tiltwarn',{warn:this.tilt.warn});}return true;}
 tiltOut(){this.tilt.on=true;this.save=0;this.queue=0;this.endMode(false);this.mb.on=false;this.mb.wizard=false;for(const f of this.flips)f.held=false;
  for(const b of this.balls){if(b.state==='lane')b.state='gone';else if(b.state==='scoop'||b.state==='kick'){b.state='play';b.vx=0;b.vy=-2;}}this.balls=this.balls.filter(b=>b.state!=='gone');this.emit('tilt');if(!this.balls.length)this.endBall();}
 // Flipper presses walk the lit D-A-W-G lanes sideways, so a lit lane can be steered out of the way.
 rotateLanes(dir){const l=this.lanes;if(dir>0)l.unshift(l.pop());else l.push(l.shift());}

 // ── Time ───────────────────────────────────────────────────────────────────────────────────
 tick(dt){
  if(this.status!=='playing')return;this.time+=dt;
  if(this.phase==='bonus'){this.countBonus(dt);this.acc+=dt;while(this.acc>=TABLE.step){this.acc-=TABLE.step;for(let i=0;i<2;i++)this.stepFlipper(i,TABLE.step);}return;}
  this.nudgeCool=Math.max(0,this.nudgeCool-dt);this.tilt.heat=Math.max(0,this.tilt.heat-dt*.5);
  if(this.combo.t>0&&(this.combo.t-=dt)<=0){this.combo.t=0;this.combo.n=0;this.combo.last=-1;}
  if(this.dropReset>0&&(this.dropReset-=dt)<=0){this.dropReset=0;this.drops=[false,false,false];this.emit('dropreset');}
  if(this.phase==='live'&&this.save>0)this.save=Math.max(0,this.save-dt);
  this.plunge=this.input.plunge&&this.waiting?Math.min(1,this.plunge+dt/PLUNGER.charge):0;
  // The mode clock stops while a ball sits in the scoop.
  if(this.mode.id>=0&&!this.balls.some(b=>b.state==='scoop')){this.mode.t-=dt;if(MODES[this.mode.id].id==='fetch'&&(this.mode.hop-=dt)<=0)this.hopFetch();if(this.mode.t<=0)this.endMode(false);}
  // The spinner coasts down, scoring every half turn.
  if(this.spin.v>0){this.spin.a+=this.spin.v*dt;this.spin.v=Math.max(0,this.spin.v-(6+this.spin.v*.9)*dt);while(this.spin.a>=Math.PI){this.spin.a-=Math.PI;this.spin.n++;const night=this.mode.id>=0&&MODES[this.mode.id].id==='orbits';this.add(SCORE.spin*(night?4:1),'spin');}if(this.spin.v<1.5)this.spin.v=0;}
  // Balls owed to the table (ball save, multiball) are served one at a time and plunged for you.
  if(this.queue>0&&!this.balls.some(b=>b.state==='lane'||b.state==='play'&&b.x>FW&&b.y<14)){if((this.serve-=dt)<=0){this.queue--;this.spawn(.45);this.serve=.5;}}
  for(const b of this.balls)if(b.state==='lane'){if(b.auto>0){if((b.auto-=dt)<=0)this.fire(b,PLUNGER.auto);}else if(!this.input.plunge&&(b.wait+=dt)>20)this.launch(.85);}
  this.acc+=dt;while(this.acc>=TABLE.step&&this.status==='playing'&&this.phase!=='bonus'){this.acc-=TABLE.step;this.step(TABLE.step);}
 }
 stepFlipper(i,h){const f=FLIPPERS[i],s=this.flips[i];
  if(s.held&&!this.tilt.on&&this.phase!=='bonus'){if(s.angle>=f.up){s.angle=f.up;s.omega=0;}else{s.omega=Math.min(FLIP.max,Math.max(0,s.omega)+FLIP.accel*h);s.angle=Math.min(f.up,s.angle+s.omega*h);}}
  else if(s.angle<=f.rest){s.angle=f.rest;s.omega=0;}else{s.omega=Math.max(-FLIP.back,Math.min(0,s.omega)-FLIP.backAccel*h);s.angle=Math.max(f.rest,s.angle+s.omega*h);}}
 step(h){
  for(let i=0;i<2;i++)this.stepFlipper(i,h);
  const balls=this.balls;
  for(const b of balls){
   if(b.state==='scoop'){if((b.hold-=h)<=0)this.eject(b);continue;}
   if(b.state==='kick'){if((b.hold-=h)<=0){b.state='play';b.x=KICKBACK.x;b.y=2.6;b.vx=0;b.vy=KICKBACK.speed;b.orb=2.5;this.emit('kickfire');}continue;}
   if(b.state==='ramp'){this.ride(b,h);continue;}
   if(b.state!=='play')continue;
   b.cool=Math.max(0,b.cool-h);b.orb=Math.max(0,b.orb-h);
   b.vy-=TABLE.gravity*h;const k=1-.04*h;b.vx*=k;b.vy*=k;
   const sp=Math.hypot(b.vx,b.vy);if(sp>TABLE.maxSpeed){b.vx*=TABLE.maxSpeed/sp;b.vy*=TABLE.maxSpeed/sp;}
   const px=b.x,py=b.y;b.x+=b.vx*h;b.y+=b.vy*h;this.collide(b);if(b.state==='play')this.sense(b,px,py);
   // A ball that settles anywhere but a raised flipper or the plunger gets a shove (ball search).
   if(b.state==='play'){const cradle=b.y<3.6&&this.flips.some(f=>f.held);if(cradle&&!this.tipped&&b.y>2.4&&Math.hypot(b.vx,b.vy)<.6){this.tipped=true;this.emit('tip',{text:'CRADLED. LET GO, THEN FLIP LATE TO SHOOT ACROSS'});}
    if(Math.hypot(b.x-b.ax,b.y-b.ay)>.3||cradle){b.ax=b.x;b.ay=b.y;b.still=0;}else if((b.still+=h)>3){b.still=0;b.vy+=7;b.vx+=b.x<FW/2?3:-3;this.emit('search');}}
  }
  // Balls knock each other about in multiball.
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){const a=balls[i],b=balls[j];if(a.state!=='play'||b.state!=='play')continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=2*R||d<1e-6)continue;
   const nx=dx/d,ny=dy/d,push=(2*R-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn<0){const j2=-(1+.9)*vn/2;a.vx-=j2*nx;a.vy-=j2*ny;b.vx+=j2*nx;b.vy+=j2*ny;if(vn<-3)this.emit('clack',{x:a.x+nx*R,y:a.y+ny*R});}}
  // Drains: the ball save hands the ball back, otherwise it is gone.
  let lost=false;for(const b of balls)if(b.state==='play'&&b.y<TABLE.drain&&b.x<FW){b.state='gone';lost=true;
   if(this.save>0&&!this.tilt.on){this.queue++;this.serve=.6;this.emit('ballsave');}else this.emit('drain',{x:b.x});}
  if(lost){this.balls=balls.filter(b=>b.state!=='gone');const left=this.balls.length+this.queue;
   if(this.mb.on&&left<=1)this.endMultiball();
   if(left===0)this.endBall();}
 }

 // ── Collisions ─────────────────────────────────────────────────────────────────────────────
 // Bounce a ball off a surface with normal (nx, ny) that moves at (sx, sy). Slow contacts do not
 // bounce at all, so a ball can roll along a guide or settle in a cradle. Returns the impact speed.
 bounce(b,nx,ny,sx,sy,e,grip=.03){const rx=b.vx-sx,ry=b.vy-sy,vn=rx*nx+ry*ny;if(vn>=0)return 0;const rest=-vn<1.3?0:e,tx=-ny,ty=nx,vt=(rx*tx+ry*ty)*(1-grip);
  b.vx=sx-vn*rest*nx+vt*tx;b.vy=sy-vn*rest*ny+vt*ty;return -vn;}
 collide(b){
  // The top arch is a true arc, so an orbit shot rides it without rattling.
  if(b.y>ARC.y){const dx=b.x-ARC.x,dy=b.y-ARC.y,d=Math.hypot(dx,dy),lim=ARC.r-R;if(d>lim){const nx=-dx/d,ny=-dy/d;b.x=ARC.x-nx*lim;b.y=ARC.y-ny*lim;this.bounce(b,nx,ny,0,0,.25,.004);}}
  for(let i=0;i<SEGS.length;i++){const s=SEGS[i];
   if(s.kind==='drop'&&this.drops[s.id])continue;
   const dx=s.bx-s.ax,dy=s.by-s.ay;
   if(s.kind==='oneway'&&dx*(b.y-s.ay)-dy*(b.x-s.ax)<=0)continue;
   const t=clamp(((b.x-s.ax)*dx+(b.y-s.ay)*dy)/(dx*dx+dy*dy),0,1),cx=s.ax+dx*t,cy=s.ay+dy*t;let nx=b.x-cx,ny=b.y-cy;const d=Math.hypot(nx,ny),min=R+s.r;if(d>=min||d<1e-9)continue;
   nx/=d;ny/=d;b.x=cx+nx*min;b.y=cy+ny*min;const hit=this.bounce(b,nx,ny,0,0,s.e,s.kind==='wall'?.02:.05);if(!hit)continue;
   if(s.kind==='sling'){if(hit>1.6&&t>.08&&t<.92&&!(b.cool>0)){b.vx+=nx*11;b.vy+=ny*11;b.cool=.06;this.add(SCORE.sling,'sling',{index:s.id,x:cx,y:cy});}}
   else if(s.kind==='drop'){if(hit>1.5)this.hitDrop(s.id);}
   else if(s.kind==='standup'){if(hit>1.5)this.hitStandup(s.id);}
   else if(hit>9)this.emit('knock',{x:cx,y:cy,power:hit});
  }
  for(const p of POSTS){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),min=R+p.r;if(d<min&&d>1e-9){const nx=dx/d,ny=dy/d;b.x=p.x+nx*min;b.y=p.y+ny*min;this.bounce(b,nx,ny,0,0,.6,.05);}}
  for(let i=0;i<BUMPERS.length;i++){const m=BUMPERS[i],dx=b.x-m.x,dy=b.y-m.y,d=Math.hypot(dx,dy),min=R+m.r;if(d>=min||d<1e-9)continue;const nx=dx/d,ny=dy/d;b.x=m.x+nx*min;b.y=m.y+ny*min;
   if(this.bounce(b,nx,ny,0,0,.5,.02)>.8){const out=b.vx*nx+b.vy*ny,kick=Math.max(0,15-out)+(this.random()-.5);b.vx+=nx*kick;b.vy+=ny*kick;this.hitBumper(i);}}
  for(let i=0;i<2;i++)this.hitFlipper(b,i);
 }
 hitFlipper(b,i){
  const f=FLIPPERS[i],s=this.flips[i],w=flipperAngle(f,s.angle),ux=Math.cos(w),uy=Math.sin(w),u=clamp(((b.x-f.px)*ux+(b.y-f.py)*uy)/f.len,0,1),cx=f.px+ux*f.len*u,cy=f.py+uy*f.len*u;
  let nx=b.x-cx,ny=b.y-cy;const d=Math.hypot(nx,ny),min=R+f.rb+(f.rt-f.rb)*u;if(d>=min||d<1e-9)return;nx/=d;ny/=d;b.x=cx+nx*min;b.y=cy+ny*min;
  const ww=f.side==='left'?s.omega:-s.omega,sx=-ww*(cy-f.py),sy=ww*(cx-f.px),vn=(b.vx-sx)*nx+(b.vy-sy)*ny;if(vn>=0)return;
  if(s.omega>0&&ny>0){// A live stroke: the bat drives the ball, turned toward the tip the further out it strikes.
   const turn=(u-FLIP.pivot)*FLIP.aim*(f.side==='left'?-1:1),c=Math.cos(turn),sn=Math.sin(turn),ax=nx*c-ny*sn,ay=nx*sn+ny*c,e=-vn>7?.4:0,j=-(1+e)*vn;b.vx+=ax*j;b.vy+=ay*j;
   if(!(b.cool>0)){b.cool=.05;this.emit('shot',{side:f.side,u,x:b.x,y:b.y});}}
  else this.bounce(b,nx,ny,sx,sy,.3,.012);
 }
 // Lines a ball rolls over: lanes, the spinner, orbit and lane switches, the ramp mouths, the scoop.
 sense(b,px,py){
  const x=b.x,y=b.y,up=y>py,cross=line=>(py-line)*(y-line)<=0&&py!==y;
  if(cross(LANE_Y))for(let i=0;i<4;i++)if(Math.abs(x-LANES[i].x)<.44){this.hitLane(i);break;}
  if(cross(SPINNER.y)&&x<.95){this.spin.v=Math.min(60,Math.abs(b.vy)*1.5+this.spin.v*.3);this.emit('spinner');}
  if(up&&cross(14.8)&&!(b.orb>0)){if(x<.95){b.orb=2.5;this.shot(0);}else if(x>mir(.95)&&x<FW){b.orb=2.5;this.shot(5);}}
  if(!up&&cross(5.2))for(const r of ROLLOVERS)if(Math.abs(x-r.x)<.45){this.add(r.kind==='out'?SCORE.rollover*5:SCORE.rollover,'rollover',{kind:r.kind,x:r.x,y:r.y});break;}
  if(up)for(let i=0;i<2;i++){const m=RAMPS[i].mouth;if(cross(m.y)&&x>m.x1&&x<m.x2){b.state='ramp';b.ramp=i;b.d=0;b.v=Math.hypot(b.vx,b.vy);b.made=false;this.emit('rampenter',{index:i});return;}}
  if(!(b.cool>0)&&Math.abs(x-SCOOP.x)<.36&&y>SCOOP.y-.32&&y<SCOOP.y+.4)this.enterScoop(b);
  else if(!up&&this.kickback&&x<.9&&y<KICKBACK.top&&y>KICKBACK.bottom&&!this.tilt.on){this.kickback=false;b.state='kick';b.hold=.3;b.x=KICKBACK.x;b.vx=b.vy=0;this.add(SCORE.kickback,'kickback');}
  // A plunge too soft to leave the lane rolls back onto the plunger.
  else if(x>FW&&y<PLUNGER.y&&b.vy<=0){b.state='lane';b.x=PLUNGER.x;b.y=PLUNGER.y;b.vx=b.vy=0;b.wait=0;b.auto=this.phase==='live'&&(this.live>0||this.save>0)?.5:0;}
 }
 // On a ramp the ball is a bead on a wire: gravity along the slope (height costs more than
 // distance up the table), a little drag, and a brake at the end of the wireform.
 ride(b,h){const r=RAMPS[b.ramp],p=rampPoint(r,b.d);b.v-=(TABLE.gravity*(p.dy+TABLE.zCost*p.dz)+.25*b.v)*h;b.d+=b.v*h;
  if(!b.made&&b.d>=r.crest){b.made=true;this.shot(r.shot);}
  if(b.d<=0){b.state='play';b.ramp=-1;b.x=p.x;b.y=r.mouth.y-.02;b.z=0;b.vx=0;b.vy=Math.min(-1,b.v);b.cool=.2;this.emit('rollback',{index:r.id==='left'?0:1});return;}
  if(b.d>=r.length){b.state='play';b.ramp=-1;b.x=r.exit.x;b.y=r.exit.y;b.z=0;b.vx=0;b.vy=-Math.min(9,Math.max(3,b.v));b.cool=.2;b.d=0;this.emit('rampexit',{index:r.id==='left'?0:1,x:b.x,y:b.y});return;}
  const q=rampPoint(r,b.d);b.x=q.x;b.y=q.y;b.z=q.z;b.vx=q.dx*b.v;b.vy=q.dy*b.v;}

 // ── Rules ──────────────────────────────────────────────────────────────────────────────────
 hitBumper(i){this.tally.bumps++;this.stats.bumps++;const party=this.mode.id>=0&&MODES[this.mode.id].id==='bumpers';this.add(party?MODES[this.mode.id].each:SCORE.bumper,'bumper',{index:i,x:BUMPERS[i].x,y:BUMPERS[i].y});if(party)this.advanceMode();this.liveBall();}
 hitLane(i){const skill=this.skill.live;this.liveBall();
  if(skill){if(i===this.skill.lane){this.stats.skill++;this.bonusX=Math.min(MAX_BONUS_X,this.bonusX+1);this.add(SCORE.skill*this.ball,'skill',{index:i,bonusX:this.bonusX});}}
  if(this.lanes[i]){this.add(SCORE.lane/5,'lane',{index:i,lit:false});return;}
  this.lanes[i]=true;this.add(SCORE.lane,'lane',{index:i,lit:true});
  if(this.lanes.every(Boolean)){this.lanes=[false,false,false,false];this.bonusX=Math.min(MAX_BONUS_X,this.bonusX+1);this.add(SCORE.lanes,'lanes',{bonusX:this.bonusX});}}
 hitDrop(i){if(this.drops[i]||this.dropReset>0)return;this.drops[i]=true;this.tally.drops++;this.liveBall();this.add(SCORE.drop,'drop',{index:i,x:DROPS[i].x,y:DROPS[i].y});
  if(this.mode.id>=0&&MODES[this.mode.id].id==='drops'){this.score+=MODES[this.mode.id].each;this.advanceMode();}
  if(this.drops.every(Boolean)){this.dropReset=1.1;this.add(SCORE.bank,'bank');this.shot(2);if(!this.lock.lit&&!this.mb.on&&this.lock.count<3){this.lock.lit=true;this.emit('locklit');}}}
 hitStandup(i){this.liveBall();if(this.stand[i]){this.add(SCORE.standup/5,'standup',{index:i,lit:false,x:STANDUPS[i].x,y:STANDUPS[i].y});return;}
  this.stand[i]=true;this.add(SCORE.standup,'standup',{index:i,lit:true,x:STANDUPS[i].x,y:STANDUPS[i].y});
  if(this.stand.every(Boolean)){this.stand=[false,false];this.add(SCORE.standups,'standups');if(!this.kickback){this.kickback=true;this.emit('kicklit');}}}
 // The ball save clock starts with the first thing the ball touches.
 liveBall(){if(this.saveArmed&&this.phase==='live'){this.saveArmed=false;this.save=BALL_SAVE;}this.skill.live=false;}
 // A made shot: 0 left orbit, 1 left ramp, 2 drop bank, 3 scoop, 4 right ramp, 5 right orbit.
 shot(i){
  this.liveBall();const flow=i===0||i===1||i===4||i===5;let base=0;
  if(i===1||i===4){base=SCORE.ramp;this.tally.ramps++;this.stats.ramps++;}else if(i===0||i===5){base=SCORE.orbit;this.tally.orbits++;this.stats.orbits++;}
  if(flow){const c=this.combo;c.n=c.t>0?Math.min(COMBO.max,c.n+1):1;c.t=COMBO.time;c.last=i;this.stats.combo=Math.max(this.stats.combo,c.n);
   this.add(base*c.n,i===1||i===4?'ramp':'orbit',{index:i,label:SHOTS[i],combo:c.n,x:SHOT_AT[i].x,y:SHOT_AT[i].y});if(c.n>1)this.emit('combo',{combo:c.n,points:base*c.n});}
  // Mode shots.
  const m=this.mode.id>=0?MODES[this.mode.id]:null;
  if(m&&(m.id==='fetch'?i===this.mode.at:m.shots.includes(i)&&m.id!=='drops')){this.score+=m.each;this.emit('modeshot',{index:i,points:m.each});if(m.id==='fetch')this.hopFetch(true);this.advanceMode();}
  // Jackpots.
  if(this.mb.on&&this.mb.lit[i]){this.mb.lit[i]=false;this.mb.n++;this.stats.jackpots++;const pts=this.mb.wizard?WIZARD.jackpot:SCORE.jackpot+SCORE.jackpotStep*(this.mb.n-1);this.add(pts,'jackpot',{index:i,n:this.mb.n});
   if(!this.mb.lit.some(Boolean)){this.mb.super=true;this.emit('superlit');}}
 }
 enterScoop(b){b.state='scoop';b.x=SCOOP.x;b.y=SCOOP.y;b.vx=b.vy=0;b.hold=.9;b.why='';this.liveBall();this.add(SCORE.scoop,'scoop');this.shot(3);
  if(this.extra.lit){this.extra.lit=false;this.extra.balls++;this.add(SCORE.extra,'extraball');b.hold=1.6;}
  if(this.mb.on){if(this.mb.super){this.mb.super=false;this.stats.jackpots++;this.add(this.mb.wizard?WIZARD.super:SCORE.super,'super');this.mb.lit=this.jackpotShots();b.hold=1.8;}return;}
  if(this.wizardLit&&this.mode.id<0){this.startMultiball(true);b.hold=2.2;return;}
  if(this.mode.id<0&&this.modesDone.some(d=>!d)){this.startMode();b.hold=2;return;}
  if(this.lock.lit){this.lock.lit=false;this.lock.count++;if(this.lock.count>=3){this.lock.count=0;this.startMultiball(false);b.hold=2.2;}else{this.add(SCORE.lock,'lock',{count:this.lock.count});b.hold=1.4;}}}
 eject(b){b.state='play';b.x=SCOOP.out.x;b.y=SCOOP.out.y;b.vx=SCOOP.out.vx;b.vy=SCOOP.out.vy;b.cool=.5;this.emit('eject',{x:b.x,y:b.y});}
 startMode(){let id=this.next;while(this.modesDone[id])id=(id+1)%MODES.length;const m=MODES[id];this.mode={id,t:m.time,n:0,at:-1,hop:0};this.next=(id+1)%MODES.length;
  if(m.id==='fetch')this.hopFetch();if(m.id==='drops'&&this.drops.some(Boolean)){this.drops=[false,false,false];this.dropReset=0;}this.add(SCORE.modeStart,'modestart',{id,name:m.name,text:m.text});}
 hopFetch(hit=false){const m=this.mode,opts=FETCH_SHOTS.filter(s=>s!==m.at);m.at=opts[Math.floor(this.random()*opts.length)];m.hop=FETCH_HOP;if(!hit)this.emit('fetch',{index:m.at});}
 advanceMode(){const m=MODES[this.mode.id];this.mode.n++;this.emit('modestep',{id:this.mode.id,n:this.mode.n,goal:m.goal});if(this.mode.n>=m.goal)this.endMode(true);}
 endMode(won){const id=this.mode.id;if(id<0)return;this.mode={id:-1,t:0,n:0,at:-1,hop:0};
  if(!won){this.emit('modefail',{id,name:MODES[id].name});return;}
  this.modesDone[id]=true;this.stats.modes=Math.min(MODES.length,this.stats.modes+1);const done=this.modesDone.filter(Boolean).length;this.add(SCORE.modeDone+5000*(done-1),'modedone',{id,name:MODES[id].name,done});
  if(done>=2&&!this.extra.given){this.extra.given=true;this.extra.lit=true;this.emit('extralit');}
  if(done===MODES.length){this.wizardLit=true;this.emit('wizardlit');}}
 jackpotShots(){return this.mb.wizard?[true,true,true,false,true,true]:[true,true,false,false,true,true];}
 startMultiball(wizard){this.mb={on:true,wizard,lit:[],super:false,n:0};this.mb.lit=this.jackpotShots();this.stats.multiballs++;this.lock.lit=false;
  if(wizard){this.wizardLit=false;this.stats.wizards++;}const extra=(wizard?WIZARD.balls:3)-(this.live+this.queue);this.queue+=Math.max(0,extra);this.serve=.9;this.save=Math.max(this.save,wizard?WIZARD.save:MB_SAVE);this.saveArmed=false;
  this.add(wizard?25000:5000,wizard?'wizard':'multiball',{balls:wizard?WIZARD.balls:3});}
 endMultiball(){const wizard=this.mb.wizard;this.mb={on:false,wizard:false,lit:[false,false,false,false,false,false],super:false,n:0};
  if(wizard){this.modesDone=MODES.map(()=>false);this.next=0;}this.emit('multiballend',{wizard});}
 endBall(){this.endMode(false);this.mb.on=false;this.input.plunge=false;this.plunge=0;
  if(this.tilt.on){this.count={i:99,t:1.2,total:0};this.phase='bonus';return;}
  this.phase='bonus';this.count={i:0,t:.7,total:0};this.emit('ballend',{ball:this.ball});}
 // End-of-ball bonus, counted line by line and multiplied by the bonus multiplier.
 bonusLines(){const t=this.tally;return [['BUMPERS',t.bumps*50],['RAMPS',t.ramps*1000],['ORBITS',t.orbits*1000],['TARGETS',t.drops*250],['MODES',this.modesDone.filter(Boolean).length*4000]];}
 countBonus(dt){const c=this.count;c.t-=dt*(c.fast?4:1);if(c.t>0)return;const lines=this.bonusLines();
  if(c.i<lines.length){const [label,value]=lines[c.i++];c.total+=value;c.t=value?.42:.02;if(value)this.emit('bonusline',{label,value,total:c.total});return;}
  if(c.i===lines.length){c.i++;const total=c.total*this.bonusX;c.t=1.3;this.add(total,'bonus',{base:c.total,mult:this.bonusX});return;}
  this.count={i:0,t:0,total:0};
  if(this.extra.balls>0){this.extra.balls--;this.newBall(false);this.emit('shootagain',{ball:this.ball});return;}
  this.ball++;if(this.ball>BALLS){this.ball=BALLS;this.phase='live';this.end((this.tilt.on?'Tilted on the last ball. ':'')+this.summary());return;}
  this.newBall(true);}

 // ── What the playfield is showing ──────────────────────────────────────────────────────────
 // Per shot: which lamps are lit and why. Renderers colour the arrow inserts from this.
 lights(){const m=this.mode.id>=0?MODES[this.mode.id]:null,idle=this.mode.id<0&&!this.mb.on;
  const shots=SHOTS.map((label,i)=>({label,mode:!!m&&(m.id==='fetch'?this.mode.at===i:m.shots.includes(i)),jackpot:this.mb.on&&!!this.mb.lit[i],
   combo:this.combo.t>0&&(i===0||i===1||i===4||i===5),
   start:i===3&&!this.mb.on&&this.mode.id<0&&(this.wizardLit||this.modesDone.some(d=>!d)),wizard:i===3&&this.wizardLit&&idle,
   lock:i===3&&this.lock.lit&&!this.mb.on,super:i===3&&this.mb.on&&this.mb.super,extra:i===3&&this.extra.lit,
   lightLock:i===2&&!this.lock.lit&&!this.mb.on}));
  return {shots,lanes:this.lanes,skill:this.skill.live?this.skill.lane:-1,kickback:this.kickback,save:this.save>0||this.saveArmed&&this.phase!=='bonus',bonusX:this.bonusX,
   modes:MODES.map((d,i)=>this.modesDone[i]?'done':this.mode.id===i?'live':'off'),wizard:this.wizardLit||this.mb.wizard,locks:this.lock.count,lockLit:this.lock.lit,
   drops:this.drops,stand:this.stand,bumpers:!!m&&m.id==='bumpers',extraBalls:this.extra.balls};}
 // One line for the display: what to do right now.
 goal(){if(this.tilt.on)return {title:'TILT',text:'BALL LOST',t:0,n:0,of:0};
  if(this.phase==='bonus')return {title:'BONUS',text:'×'+this.bonusX,t:0,n:0,of:0};
  if(this.mb.on)return {title:this.mb.wizard?WIZARD.name:'MULTIBALL',text:this.mb.super?'SUPER JACKPOT AT THE DAWG HOUSE':'SHOOT THE LIT JACKPOTS',t:0,n:this.mb.n,of:0};
  if(this.mode.id>=0){const m=MODES[this.mode.id];return {title:m.name,text:m.text,t:this.mode.t,n:this.mode.n,of:m.goal};}
  if(this.waiting)return {title:'BALL '+this.ball,text:this.skill.live?'SKILL SHOT: PLUNGE INTO LANE '+LANES[this.skill.lane].label:'PULL THE PLUNGER',t:0,n:0,of:0};
  if(this.wizardLit)return {title:WIZARD.name+' IS LIT',text:'SHOOT THE DAWG HOUSE',t:0,n:0,of:0};
  return {title:'DAWG HOUSE',text:'SHOOT THE SCOOP TO START '+MODES[this.nextMode()].name,t:0,n:0,of:0};}
 nextMode(){let id=this.next,k=0;while(this.modesDone[id]&&k++<MODES.length)id=(id+1)%MODES.length;return id;}
}

// ── Saves ─────────────────────────────────────────────────────────────────────────────────────
const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,bool=v=>typeof v==='boolean',obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const bools=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(bool);
export const PINBALL_FIELDS=['table','ball','phase','balls','queue','serve','flips','plunge','lanes','bonusX','drops','dropReset','stand','kickback','lock','mode','modesDone','next','mb','wizardLit','combo','skill','save','saveArmed','tilt','extra','tally','count','stats','spin','nudgeCool','acc','feats'];
PinballGame.prototype.table=2;
const STATES=['lane','play','ramp','scoop','kick'];
// Saves from the old three-table game carry no `table: 2` and are turned away here.
export function validPinballSnapshot(s){
 try{
  if(!obj(s)||s.table!==2||!int(s.ball,1,BALLS)||!['plunge','live','bonus'].includes(s.phase))return false;
  if(!Array.isArray(s.balls)||s.balls.length>6||!int(s.queue,0,6)||!num(s.serve,-1,2))return false;
  if(s.phase!=='bonus'&&s.balls.length+s.queue<1)return false;
  if(s.balls.filter(b=>b?.state==='lane').length>1)return false;
  for(const b of s.balls){if(!obj(b)||!STATES.includes(b.state)||!num(b.x,-.5,10.5)||!num(b.y,-.5,20.5)||!num(b.z??0,0,3)||!num(b.vx,-60,60)||!num(b.vy,-60,60)||!num(b.auto??0,0,2)||!num(b.wait??0,0,21)
    ||!int(b.ramp??-1,-1,1)||!num(b.d??0,-1,60)||!num(b.v??0,-60,60)||!num(b.hold??0,-1,3)||!num(b.cool??0,0,1)||!num(b.orb??0,0,3)||!num(b.still??0,0,4)||!num(b.ax??0,-1,11)||!num(b.ay??0,-1,21))return false;
   if(b.state==='ramp'&&b.ramp<0)return false;}
  if(!Array.isArray(s.flips)||s.flips.length!==2||!s.flips.every(f=>obj(f)&&num(f.angle,-.53,.48)&&num(f.omega,-40,40)&&bool(f.held)))return false;
  if(!num(s.plunge,0,1)||!bools(s.lanes,4)||!int(s.bonusX,1,MAX_BONUS_X)||!bools(s.drops,3)||!num(s.dropReset,0,1.2)||!bools(s.stand,2)||!bool(s.kickback))return false;
  if(!obj(s.lock)||!bool(s.lock.lit)||!int(s.lock.count,0,2))return false;
  if(!obj(s.mode)||!int(s.mode.id,-1,MODES.length-1)||!num(s.mode.t,0,60)||!int(s.mode.n,0,60)||!int(s.mode.at,-1,5)||!num(s.mode.hop,-1,FETCH_HOP))return false;
  if(!bools(s.modesDone,MODES.length)||!int(s.next,0,MODES.length-1)||!bool(s.wizardLit))return false;
  if(!obj(s.mb)||!bool(s.mb.on)||!bool(s.mb.wizard)||!bools(s.mb.lit,6)||!bool(s.mb.super)||!int(s.mb.n,0,1e6))return false;
  if(!obj(s.combo)||!int(s.combo.n,0,COMBO.max)||!num(s.combo.t,0,COMBO.time)||!int(s.combo.last,-1,5))return false;
  if(!obj(s.skill)||!int(s.skill.lane,0,3)||!bool(s.skill.live)||!num(s.save,0,30)||!bool(s.saveArmed))return false;
  if(!obj(s.tilt)||!num(s.tilt.heat,0,3)||!int(s.tilt.warn,0,3)||!bool(s.tilt.on))return false;
  if(!obj(s.extra)||!bool(s.extra.lit)||!int(s.extra.balls,0,5)||!bool(s.extra.given))return false;
  if(!obj(s.tally)||!['bumps','ramps','orbits','drops'].every(k=>int(s.tally[k],0,1e7)))return false;
  if(!obj(s.count)||!int(s.count.i,0,99)||!num(s.count.t,-1,2)||!int(s.count.total,0,1e9))return false;
  if(!obj(s.stats)||!['ramps','orbits','bumps','jackpots','modes','combo','multiballs','skill','wizards'].every(k=>int(s.stats[k],0,1e7)))return false;
  if(!Array.isArray(s.feats)||new Set(s.feats).size!==s.feats.length||!s.feats.every(id=>FEATS.some(f=>f.id===id)))return false;
  return obj(s.spin)&&num(s.spin.v,0,60)&&num(s.spin.a,0,4)&&int(s.spin.n,0,1e7)&&num(s.nudgeCool,0,.4)&&num(s.acc,0,TABLE.step*1.01);
 }catch{return false;}
}

// ── Attract-mode player ───────────────────────────────────────────────────────────────────────
// Plays the table the way a person would: pulls the plunger for the skill shot, then for each
// flipper asks "if I flip right now, where does the ball go?" by running a copy of the game
// forward. It flips when the answer is a lit shot, or when waiting any longer would lose the ball.
export function clonePinball(g){const c=new PinballGame(()=>.5,g.worldSeed);for(const k of PINBALL_FIELDS)c[k]=JSON.parse(JSON.stringify(g[k]));c.score=g.score;c.time=g.time;c.daily=g.daily;c.status='playing';c.events=[];return c;}
const WORTH={ramp:90,orbit:80,jackpot:260,super:400,modestart:160,modeshot:140,modedone:300,lock:150,multiball:300,wizard:400,extraball:200,bank:60,drop:25,standup:20,skill:60,lanes:40,drain:-420,ballsave:-80,kickback:-60};
function foresee(g,side,hold,horizon){const c=clonePinball(g);let value=0;const i=side==='left'?0:1;if(side){c.flips[i].held=true;}
 const steps=Math.round(horizon*120),up=Math.round(hold*120);for(let k=0;k<steps&&c.status==='playing'&&c.phase==='live';k++){if(side&&k===up)c.flips[i].held=false;c.tick(1/120);for(const e of c.events)value+=WORTH[e.type]||0;c.events.length=0;}
 if(c.phase!=='live')value+=WORTH.drain;return value;}
export function pinballAutopilot(g,mem,dt){
 if(g.status!=='playing'||g.phase==='bonus')return;
 if(g.waiting){// Hold for the lit skill lane, then let go.
  if(!mem.pull){mem.pull=true;mem.power=[.42,.27,.15,.05][g.skill.live?g.skill.lane:0]??.8;g.press('down',true);}else if(g.plunge>=mem.power){g.press('down',false);mem.pull=false;}return;}
 mem.pull=false;mem.think=(mem.think||0)-dt;
 for(const side of ['left','right']){const i=side==='left'?0:1,f=FLIPPERS[i],key='t'+i;
  if(mem[key]>0){if((mem[key]-=dt)<=0)g.press(side,false);continue;}
  const near=g.balls.some(b=>b.state==='play'&&b.y<4.4&&b.y>1.2&&(i?b.x>4.3&&b.x<7.6:b.x<4.8&&b.x>1.5)&&b.vy<6);if(!near||mem.think>0)continue;
  const flip=foresee(g,side,.22,1.5),wait=foresee(g,null,0,.3),good=flip>=60;
  if(good||wait<=-200&&flip>wait){g.press(side,true);mem[key]=.22;}}
 if(mem.think<=0)mem.think=.03;
}
