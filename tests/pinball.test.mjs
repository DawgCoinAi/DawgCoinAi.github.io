import test from 'node:test';
import assert from 'node:assert/strict';
import {PinballGame,FLIPPERS,BUMPERS,TABLE,flipperTip,tableFor} from '../dist/pinball-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

// A decent player: taps a flipper when a ball drops into its strike zone, and misses some on purpose.
function play(g,seconds,skill=.85,miss=seededRandom(9)){const hold=[0,0],cool=[0,0];
 for(let t=0;t<seconds&&g.status==='playing';t+=1/60){['left','right'].forEach((side,i)=>{hold[i]-=1/60;cool[i]-=1/60;
   const near=g.balls.some(b=>b.state==='play'&&b.y<3.4&&b.y>1.6&&b.vy<0&&(i?b.x>4.5:b.x<4.5));
   if(near&&cool[i]<=0&&hold[i]<=0){cool[i]=.5;if(miss()<skill)hold[i]=.2;}g.press(side,hold[i]>0);});g.tick(1/60);}}
const types=g=>new Set(g.events.map(e=>e.type));

test('Launching, scoring and draining: every game ends, and a good player outscores an idle one',()=>{
 let good=0,idle=0,seen=new Set();
 for(let seed=1;seed<=6;seed++){
  const g=new PinballGame(seededRandom(seed),seed);g.start();const all=[];const keep=g.events;
  for(let t=0;t<600&&g.status==='playing';t+=10){play(g,10);for(const e of g.events)seen.add(e.type);g.events=[];}
  assert.equal(g.status,'over',`seed ${seed} never ended`);assert.equal(g.ballsLeft,0);good+=g.score;
  for(const b of g.balls)assert.ok(Number.isFinite(b.x+b.y+b.vx+b.vy));
  const lazy=new PinballGame(seededRandom(seed),seed);lazy.start();for(let t=0;t<600&&lazy.status==='playing';t+=1/60)lazy.tick(1/60);assert.equal(lazy.status,'over');idle+=lazy.score;}
 assert.ok(good>idle*2,`good ${good} vs idle ${idle}`);
 for(const type of ['launch','bumper','sling','lane','target','drain','nextball','over'])assert.ok(seen.has(type),type);
});
test('Balls never escape the cabinet or stall for good',()=>{
 const g=new PinballGame(seededRandom(4),4);g.start();
 for(let t=0;t<300&&g.status==='playing';t+=1/60){play(g,1/60);for(const b of g.balls){assert.ok(b.x>-.5&&b.x<10.5&&b.y<20.5,`ball at ${b.x},${b.y}`);}}
});
test('Flippers swing up while held, fall back on release, and launch a waiting ball',()=>{
 const g=new PinballGame(seededRandom(1),1);g.start();assert.equal(g.balls[0].state,'lane');
 assert.ok(g.press('left',true));assert.equal(g.balls[0].state,'play','any flipper press launches');assert.ok(types(g).has('flip')&&types(g).has('launch'));
 g.tick(.1);assert.equal(g.flips[0].angle,FLIPPERS[0].up);assert.equal(g.flips[1].angle,FLIPPERS[1].rest);
 g.press('left',false);g.tick(.1);assert.equal(g.flips[0].angle,FLIPPERS[0].rest);
 const tip=flipperTip(FLIPPERS[1],FLIPPERS[1].up);assert.ok(tip.x<FLIPPERS[1].px&&tip.y>FLIPPERS[1].py,'right flipper mirrors the left');
 const auto=new PinballGame(seededRandom(2),2);auto.start();auto.tick(3.2);assert.equal(auto.balls[0].state,'play','the plunger fires by itself after 3 s');
});
test('A held flipper hits the ball up the table',()=>{
 const g=new PinballGame(seededRandom(3),3);g.start();g.launch();const f=FLIPPERS[0];
 g.balls[0]={x:f.px+1.2,y:f.py+.1,vx:0,vy:-2,state:'play',wait:0};g.press('left',true);for(let i=0;i<20;i++)g.tick(1/120);
 assert.ok(g.balls[0].vy>8,`vy ${g.balls[0].vy}`);
});
test('Bumpers kick and score; drop targets light the DAWG House; lanes raise the multiplier',()=>{
 const g=new PinballGame(seededRandom(5),5);g.start();g.launch();const m=BUMPERS[0];
 g.balls[0]={x:m.x,y:m.y+m.r+TABLE.ball+.05,vx:0,vy:-4,state:'play',wait:0};g.tick(1/60);
 assert.ok(types(g).has('bumper'));assert.ok(Math.hypot(g.balls[0].vx,g.balls[0].vy)>10);
 g.targets=[true,true,false];g.balls[0]={x:.5,y:10.6,vx:-6,vy:0,state:'play',wait:0};g.events=[];g.tick(1/60);
 assert.ok(types(g).has('targets'));assert.ok(g.holeLit);g.tick(2.1);assert.deepEqual(g.targets,[false,false,false],'targets reset after a beat');
 g.lanes=[true,true,true,false];g.balls[0]={x:6.3,y:18.25,vx:0,vy:-3,state:'play',wait:0};g.events=[];const before=g.mult;g.tick(1/30);
 assert.equal(g.mult,before+1);assert.deepEqual(g.lanes,[false,false,false,false]);
});
test('The lit DAWG House starts multiball; the unlit one just pays',()=>{
 const g=new PinballGame(seededRandom(6),6);g.start();g.launch();g.save=0;
 g.balls[0]={x:4.5,y:10.4,vx:0,vy:-1,state:'play',wait:0};g.tick(1/120);assert.equal(g.balls[0].state,'held');assert.ok(types(g).has('hole'));
 g.tick(1.3);assert.equal(g.balls[0].state,'play','kicked back out');
 g.holeLit=true;g.events=[];g.balls=[{x:4.5,y:10.4,vx:0,vy:-1,state:'play',wait:0}];g.tick(1/120);assert.ok(types(g).has('multiball'));assert.equal(g.balls.length,3);
});
test('Ball save returns one drained ball, once per ball',()=>{
 const g=new PinballGame(seededRandom(7),7);g.start();g.launch();assert.equal(g.save,8);
 g.balls[0]={x:4.5,y:-.7,vx:0,vy:-5,state:'play',wait:0};g.tick(1/60);assert.ok(types(g).has('ballsave'));assert.equal(g.ballsLeft,3);
 g.launch();assert.ok(g.save<8,'a saved ball does not re-arm the save');g.save=0;
 g.balls[0]={x:4.5,y:-.7,vx:0,vy:-5,state:'play',wait:0};g.events=[];g.tick(1/60);assert.ok(types(g).has('drain'));assert.equal(g.ballsLeft,2);assert.ok(g.armed);
});
test('Nudge shoves the balls and cools down; the score feeds the heat',()=>{
 const g=new PinballGame(seededRandom(8),8);g.start();g.launch();g.balls[0].vy=0;assert.ok(g.nudge());assert.equal(g.balls[0].vy,3.5);assert.equal(g.nudge(),false);
 assert.equal(g.heat,0);g.score=20000;assert.ok(g.heat>.4&&g.heat<.6);assert.ok(g.gravity>16);
});
test('Same seed and inputs play out identically, and a checkpoint resumes exactly',()=>{
 const a=createQuickGame('pinball',77),b=createQuickGame('pinball',77);a.start();b.start();play(a,30,.85,seededRandom(1));play(b,30,.85,seededRandom(1));
 assert.equal(a.score,b.score);assert.deepEqual(a.balls,b.balls);
 a.pause();const snap=JSON.parse(JSON.stringify(snapshotQuick(a,'pinball'))),c=restoreQuick(snap);assert.ok(c,'snapshot restores');assert.equal(c.status,'paused');
 a.start();c.start();for(let i=0;i<300;i++){a.tick(1/60);c.tick(1/60);}assert.equal(c.score,a.score);assert.deepEqual(c.balls,a.balls);
 assert.equal(restoreQuick({...snap,mult:9}),null);assert.equal(restoreQuick({...snap,balls:[]}),null);
 assert.equal(restoreQuick({...snap,balls:[{...snap.balls[0],x:NaN}]}),null);assert.equal(restoreQuick({...snap,flips:[snap.flips[0]]}),null);
});
test('Ramps lift a fast ball off the playfield, carry it over the table and drop it back in',()=>{
 const g=new PinballGame(seededRandom(11),11);g.start();g.launch();g.save=0;const r=g.table.ramps[0],e=r.entry;
 g.balls[0]={x:(e[0]+e[2])/2,y:e[1]-.08,z:0,vx:0,vy:16,vz:0,state:'play',wait:0,ramp:-1,t:0,sp:0};g.events=[];g.tick(1/60);
 assert.equal(g.balls[0].state,'ramp');assert.ok(types(g).has('ramp'));assert.equal(g.progress.ramps,1);const start=g.score;
 let peak=0,exited=false,landed=false;for(let t=0;t<6&&!landed;t+=1/60){g.tick(1/60);const b=g.balls[0];if(!b)break;peak=Math.max(peak,b.z);if(types(g).has('rampexit'))exited=true;if(types(g).has('land'))landed=true;assert.ok(b.x>-.5&&b.x<10.5&&b.y>-1&&b.y<20.5&&b.z>=0&&b.z<4,`ball at ${b.x},${b.y},${b.z}`);}
 assert.ok(peak>1.5,'it rode up over the table');assert.ok(exited&&landed,'it came off the end and landed');assert.equal(g.balls[0].state,'play');assert.equal(g.balls[0].z,0);assert.ok(start>0,'the ramp paid out');
 // Too slow: the ball rolls back out of the entry.
 const s=new PinballGame(seededRandom(12),12);s.start();s.launch();s.balls[0]={x:(e[0]+e[2])/2,y:e[1]-.08,z:0,vx:0,vy:6,vz:0,state:'play',wait:0,ramp:-1,t:0,sp:0};s.tick(1/60);assert.equal(s.balls[0].state,'play');assert.ok(s.balls[0].vy<=0);assert.equal(s.progress.ramps,0);
});
test('Finishing the mission moves the table up a level, with a bonus and a ball back',()=>{
 const g=new PinballGame(seededRandom(13),13);g.start();g.launch();assert.equal(g.level,1);assert.equal(g.table.name,'THE RUSTY COLLAR');assert.equal(g.table.bumpers.length,3);
 g.ballsLeft=2;g.progress={bumps:g.table.goal.bumps,ramps:g.table.goal.ramps,targets:true,lanes:false};g.lanes=[true,true,true,false];g.balls[0]={x:6.3,y:18.25,vx:0,vy:-3,z:0,vz:0,state:'play',wait:0,ramp:-1,t:0,sp:0};g.events=[];const before=g.score;g.tick(1/30);
 assert.ok(types(g).has('levelup'));assert.equal(g.level,2);assert.equal(g.table.name,'LUCKY PAWS');assert.equal(g.table.bumpers.length,5);assert.equal(g.targets.length,5);assert.equal(g.ballsLeft,3);assert.ok(g.score>=before+10000);assert.deepEqual(g.progress,{bumps:0,ramps:0,targets:false,lanes:false});
 assert.equal(tableFor(4).name,'THE RUSTY COLLAR');assert.ok(tableFor(4).goal.bumps>tableFor(1).goal.bumps,'the mission grows each lap');assert.equal(tableFor(6).ramps.length,4);
 // A checkpoint on level 2 restores level 2's table and a ball mid-ramp.
 const r=g.table.ramps[2],e=r.entry;g.balls[0]={x:(e[0]+e[2])/2,y:e[1]-.08,z:0,vx:0,vy:16,vz:0,state:'play',wait:0,ramp:-1,t:0,sp:0};g.tick(1/60);assert.equal(g.balls[0].state,'ramp');g.tick(.3);g.pause();
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'pinball'))),c=restoreQuick(snap);assert.ok(c);assert.equal(c.level,2);assert.equal(c.balls[0].state,'ramp');c.start();c.tick(1/60);assert.ok(c.balls[0].t>g.balls[0].t,'it keeps riding the right ramp');
 assert.equal(restoreQuick({...snap,level:0}),null);assert.equal(restoreQuick({...snap,balls:[{...snap.balls[0],ramp:9}]}),null);
});
