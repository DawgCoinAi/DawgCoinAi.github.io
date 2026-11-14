// Neon Pinball: the Dawg City Nights table. Physics checks run a few hundred fixed steps each;
// rule checks call the rule handlers directly, so nothing here needs a long simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PinballGame,validPinballSnapshot,PINBALL_FIELDS,TABLE,FLIPPERS,FLIP,SEGS,RAMPS,MODES,FEATS,STAGES,SCORE,WIZARD,COMBO,BALL_SAVE,DAILY_TWIST,PLUNGER,flipperAngle,pinballAutopilot,clonePinball} from '../dist/pinball-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

const H=1/480;
const live=(seed=7)=>{const g=new PinballGame(seededRandom(seed),seed);g.start();g.balls=[];g.phase='live';g.saveArmed=false;g.skill.live=false;return g;};
const put=(g,x,y,vx=0,vy=0)=>{const b={x,y,z:0,vx,vy,state:'play',auto:0,wait:0,ramp:-1,d:0,v:0,hold:0,cool:0,orb:0,still:0,ax:x,ay:y,why:''};g.balls.push(b);return b;};
const run=(g,steps)=>{const seen=[];for(let i=0;i<steps&&g.status==='playing';i++){g.tick(H);for(const e of g.events)seen.push(e);g.events.length=0;}return seen;};
const types=ev=>ev.map(e=>e.type);
// A ball resting on the lowered left flipper, a fraction u of the way from pivot to tip.
function onFlipper(g,u){const f=FLIPPERS[0],w=flipperAngle(f,f.rest),r=f.rb+(f.rt-f.rb)*u+TABLE.ball;return put(g,f.px+Math.cos(w)*f.len*u-Math.sin(w)*r,f.py+Math.sin(w)*f.len*u+Math.cos(w)*r);}
function strike(u){const g=live(),b=onFlipper(g,u);g.press('left',true);run(g,60);return {angle:Math.atan2(b.vx,b.vy)*180/Math.PI,speed:Math.hypot(b.vx,b.vy)};}

test('the same seed and inputs give the same game',()=>{
 const play=()=>{const g=createQuickGame('pinball',4242);g.start();const mem={};for(let i=0;i<900;i++){pinballAutopilot(g,mem,1/60);g.tick(1/120);g.tick(1/120);g.events.length=0;}return JSON.stringify([g.score,g.balls,g.flips,g.stats,g.lanes,g.time]);};
 assert.equal(play(),play());
 const other=createQuickGame('pinball',99);assert.notEqual(createQuickGame('pinball',4242).skill.lane+':'+createQuickGame('pinball',4243).random(),other.skill.lane+':'+other.random());
});

test('nothing tunnels: balls fired at walls, posts and flippers at top speed stay inside',()=>{
 const shots=[[4.5,8,60,0],[4.5,8,-60,0],[4.5,10,0,60],[.5,12,-40,40],[8.6,12,40,40],[4.5,16,30,50],[3,5,-50,-30],[6,5,50,-30],[2,8,-45,45],[9.55,3,0,60]];
 for(const [x,y,vx,vy] of shots){const g=live(),b=put(g,x,y,vx,vy);g.save=30;
  for(let i=0;i<360;i++){g.tick(H);g.events.length=0;const c=g.balls[0];if(!c||c.state!=='play')break;
   assert.ok(c.x>=TABLE.ball-.02&&c.x<=10-TABLE.ball+.02,`left the table sideways from ${x},${y}: x=${c.x}`);
   assert.ok(Math.hypot(c.x-5,c.y-15)<=5-TABLE.ball+.02||c.y<=15,`went through the arch from ${x},${y}`);
   assert.ok(Math.hypot(c.vx,c.vy)<=TABLE.maxSpeed*1.5,'speed stays bounded');
   // Never inside a wall: the centre keeps a ball radius from every solid capsule.
   for(const s of SEGS){if(s.kind==='oneway'||s.kind==='drop')continue;const dx=s.bx-s.ax,dy=s.by-s.ay,t=Math.max(0,Math.min(1,((c.x-s.ax)*dx+(c.y-s.ay)*dy)/(dx*dx+dy*dy)));assert.ok(Math.hypot(c.x-s.ax-dx*t,c.y-s.ay-dy*t)>=TABLE.ball+s.r-.03,'ball overlaps a wall');}}}
 // The step is small enough that the fastest ball cannot cross the thinnest wall in one go.
 assert.ok(TABLE.maxSpeed*TABLE.step<TABLE.ball,'travel per step is under a ball radius');
 // Straight down onto a raised and a moving flipper at top speed: the ball ends up above it.
 for(const held of [true,false]){const g=live(),b=put(g,3.3,4.2,0,-46);g.flips[0].held=held;if(held)g.flips[0].angle=FLIPPERS[0].up;g.press('left',true);run(g,40);assert.ok(b.y>1.9,'the ball did not pass through the flipper');}
});

test('where the ball meets the flipper decides where it goes',()=>{
 const mid=strike(.5),late=strike(.7),tip=strike(.85);
 assert.ok(mid.angle<late.angle-5&&late.angle<tip.angle-3,`angles must fan across the table: ${mid.angle.toFixed(1)}, ${late.angle.toFixed(1)}, ${tip.angle.toFixed(1)}`);
 assert.ok(mid.angle>-12&&mid.angle<14,'a mid-flipper shot goes up the middle');assert.ok(tip.angle>24&&tip.angle<50,'a tip shot crosses the table');
 for(const s of [mid,late,tip])assert.ok(s.speed>26&&s.speed<=TABLE.maxSpeed,'a full stroke is a strong shot: '+s.speed.toFixed(1));
 // The flipper is a body with its own speed: it takes time to swing, and a lowered flipper is dead.
 const g=live();g.press('left',true);g.tick(H*4);assert.ok(g.flips[0].angle<FLIPPERS[0].up&&g.flips[0].omega>0,'mid-stroke after a few steps');run(g,80);assert.equal(g.flips[0].angle,FLIPPERS[0].up);assert.equal(g.flips[0].omega,0);
 g.press('left',false);run(g,200);assert.equal(g.flips[0].angle,FLIPPERS[0].rest);
 // A held flipper cradles a ball that rolls onto it.
 const c=live(),b=put(c,1.35,5.6,0,-3);c.press('left',true);run(c,1500);assert.equal(b.state,'play');assert.ok(b.y>2.3&&b.y<3.4&&Math.hypot(b.vx,b.vy)<.5,'the ball came to rest in the cradle');
});

test('ramps need speed, score at the crest and return to the inlane; orbits ride the arch',()=>{
 const slow=live(),a=put(slow,1.9,10.6,0,14),ev1=types(run(slow,500));assert.ok(ev1.includes('rampenter')&&ev1.includes('rollback')&&!ev1.includes('ramp'),'a weak shot rolls back');
 const fast=live(),b=put(fast,1.9,10.6,0,26),ev2=run(fast,600);assert.ok(types(ev2).includes('ramp')&&types(ev2).includes('rampexit'));assert.equal(fast.stats.ramps,1);
 const exit=ev2.find(e=>e.type==='rampexit');assert.ok(Math.abs(exit.x-RAMPS[0].exit.x)<.01&&exit.x>.9&&exit.x<1.8,'the wireform drops the ball in the left inlane');
 const orbit=live(),o=put(orbit,.5,10.2,0,28),ev3=[];let round=false;for(let i=0;i<1200;i++){orbit.tick(H);ev3.push(...types(orbit.events));orbit.events.length=0;if(o.x>8.15&&o.x<9.1&&o.y<13&&o.vy<0)round=true;}
 assert.ok(ev3.includes('orbit')&&ev3.includes('spin'),'orbit and spinner score');assert.ok(round,'the ball rode the arch and came down the right orbit lane');
});

test('plunger: hold for power, release to fire, and the lit lane is a skill shot',()=>{
 const g=new PinballGame(seededRandom(3),3);g.start();assert.equal(g.phase,'plunge');assert.ok(g.waiting);
 g.press('down',true);for(let i=0;i<30;i++)g.tick(1/120);const power=g.plunge;assert.ok(power>.2&&power<.35,'power builds while held: '+power);g.press('down',false);assert.equal(g.phase,'live');assert.ok(Math.abs(g.balls[0].vy-(PLUNGER.min+(PLUNGER.max-PLUNGER.min)*power))<1);
 // With a ball on the plunger ↑ pulls it too; with none it nudges.
 const u=new PinballGame(seededRandom(3),3);u.start();u.press('up',true);u.tick(.2);u.press('up',false);assert.equal(u.phase,'live');
 const s=live();s.skill={lane:2,live:true};s.ball=2;put(s,5,17,0,1);s.hitLane(2);assert.equal(s.score,SCORE.skill*2+SCORE.lane);assert.equal(s.bonusX,2);assert.ok(s.feats.includes('pinball.skill'));
 const miss=live();miss.skill={lane:2,live:true};miss.hitLane(0);assert.equal(miss.score,SCORE.lane);assert.equal(miss.skill.live,false);
});

test('lanes, drop bank, standups, kickback and combos',()=>{
 const g=live();for(const i of [0,1,2])g.hitLane(i);g.rotateLanes(1);assert.deepEqual(g.lanes,[false,true,true,true],'flippers walk the lit lanes');g.hitLane(0);assert.equal(g.bonusX,2);assert.deepEqual(g.lanes,[false,false,false,false]);
 for(const i of [0,1,2])g.hitDrop(i);assert.ok(g.lock.lit,'the bank lights lock');assert.ok(g.dropReset>0);g.tick(1.2);assert.deepEqual(g.drops,[false,false,false],'the bank resets');
 g.kickback=false;g.hitStandup(0);g.hitStandup(1);assert.ok(g.kickback,'both standups relight the kickback');
 const k=live(),b=put(k,.45,3.4,0,-4),ev=types(run(k,400));assert.ok(ev.includes('kickback')&&ev.includes('kickfire'));assert.equal(k.kickback,false);assert.ok(b.vy>0||b.y>6,'fired back up the lane');
 const c=live();c.shot(1);c.shot(4);c.shot(0);assert.equal(c.combo.n,3);assert.equal(c.score,SCORE.ramp+SCORE.ramp*2+SCORE.orbit*3);assert.ok(c.feats.includes('pinball.combo3'));c.tick(COMBO.time+.1);assert.equal(c.combo.n,0,'the combo times out');
});

test('each mode starts at the scoop, shows a goal and a clock, and can be won or timed out',()=>{
 const win={ramps:g=>{for(let i=0;i<4;i++)g.shot(i%2?4:1);},orbits:g=>{for(let i=0;i<3;i++)g.shot(i%2?5:0);},bumpers:g=>{for(let i=0;i<20;i++)g.hitBumper(i%3);},
  fetch:g=>{for(let i=0;i<3;i++){const at=g.mode.at;assert.ok(g.lights().shots[at].mode,'the moving arrow is lit');if(at===2){for(const d of [0,1,2])g.hitDrop(d);g.tick(1.2);}else g.shot(at);}},
  drops:g=>{for(let r=0;r<2;r++){for(const d of [0,1,2])g.hitDrop(d);g.tick(1.2);}}};
 MODES.forEach((m,id)=>{
  const g=live();g.next=id;const b=put(g,5.2,10.4,0,12);run(g,40);assert.equal(b.state,'scoop');assert.equal(g.mode.id,id,m.name+' started');assert.equal(g.mode.t,m.time);
  const goal=g.goal();assert.equal(goal.title,m.name);assert.equal(goal.of,m.goal);assert.ok(goal.t>0);
  if(m.shots.length)assert.ok(m.shots.every(s=>g.lights().shots[s].mode),'its shots are lit');
  const before=g.score;win[m.id](g);assert.equal(g.mode.id,-1);assert.ok(g.modesDone[id],m.name+' beaten');assert.ok(g.score>=before+SCORE.modeDone);
  // Timing out: the clock stops while the ball is in the scoop, then runs.
  const t=live();t.next=id;put(t,5.2,10.4,0,12);run(t,40);const held=t.mode.t;run(t,100);assert.equal(t.mode.t,held,'clock waits for the eject');
  t.balls=[];put(t,4.5,12,0,0).state='kick';t.balls[0].hold=99;const ev=[];for(let i=0;i<(m.time+1)*10;i++){t.tick(.1);ev.push(...types(t.events));t.events.length=0;}assert.ok(ev.includes('modefail'));assert.equal(t.mode.id,-1);assert.equal(t.modesDone[id],false);
 });
});

test('multiball, jackpots, the super jackpot and the wizard mode',()=>{
 const g=live(),park=put(g,4.5,6,0,0);park.state='kick';park.hold=99;for(let n=1;n<=3;n++){for(const d of [0,1,2])g.hitDrop(d);g.tick(1.2);assert.ok(g.lock.lit);g.mode.id=0;g.mode.t=30;const b=put(g,5.2,10.4,0,12);run(g,30);assert.equal(b.state,'scoop');g.mode.id=-1;if(n<3){assert.equal(g.lock.count,n);g.balls.pop();}}
 assert.ok(g.multiball,'three locks start multiball');assert.equal(g.live+g.queue,3,'three balls');assert.ok(g.save>9.5,'multiball comes with a ball save');assert.ok(g.feats.includes('pinball.multiball'));
 assert.deepEqual(g.lights().shots.map(s=>s.jackpot),[true,true,false,false,true,true]);
 let s0=g.score;g.shot(1);assert.equal(g.score-s0,SCORE.ramp+SCORE.jackpot);s0=g.score;g.combo.t=0;g.shot(1);assert.equal(g.score-s0,SCORE.ramp,'a jackpot is collected once');
 g.combo.t=0;s0=g.score;g.shot(0);assert.equal(g.score-s0,SCORE.orbit+SCORE.jackpot+SCORE.jackpotStep);g.shot(4);g.shot(5);assert.ok(g.mb.super&&g.lights().shots[3].super,'all four light the super jackpot');
 const sc=put(g,5.2,10.4,0,12);s0=g.score;run(g,30);assert.equal(sc.state,'scoop');assert.equal(g.score-s0,SCORE.scoop+SCORE.super);assert.ok(g.mb.lit[1]&&!g.mb.super,'jackpots relight');assert.ok(g.feats.includes('pinball.super'));
 // Down to one ball: multiball ends.
 g.save=0;g.queue=0;g.balls=[g.balls[0],put(g,4.5,.6,0,-5)];g.balls[0].state='play';g.balls[0].x=4.5;g.balls[0].y=12;run(g,20);assert.equal(g.multiball,false);
 // Beating every mode lights Top Dawg; the scoop starts it with four balls and every shot a jackpot.
 const w=live();put(w,4.5,12,0,0);MODES.forEach((m,id)=>{w.mode={id,t:10,n:0,at:-1,hop:9};w.endMode(true);});assert.ok(w.wizardLit&&w.lights().shots[3].wizard);assert.equal(w.stage,5);
 const b=put(w,5.2,10.4,0,12);run(w,30);assert.equal(b.state,'scoop');assert.ok(w.mb.on&&w.mb.wizard);assert.equal(w.live+w.queue,WIZARD.balls);assert.equal(STAGES[w.stage],'TOP DAWG');assert.ok(w.feats.includes('pinball.wizard'));
 s0=w.score;w.shot(2);assert.equal(w.score-s0,WIZARD.jackpot);
});

test('ball save, drains, tilt, bonus count and the end of the game',()=>{
 const g=live();g.saveArmed=true;put(g,4.55,.9,0,-6);g.hitBumper(0);assert.equal(g.save,BALL_SAVE,'the clock starts on the first switch');const ev=types(run(g,60));assert.ok(ev.includes('ballsave'));assert.equal(g.ball,1);
 run(g,500);assert.ok(g.balls.some(b=>b.state!=='lane'||b.auto>0)||g.balls.length===1,'a new ball is served and plunged');
 // No save: the ball ends, the bonus counts line by line and is multiplied.
 const d=live();d.tally={bumps:20,ramps:3,orbits:2,drops:4};d.bonusX=3;put(d,4.55,.9,0,-6);const seen=[];for(let i=0;i<60&&d.ball===1;i++){d.tick(.1);seen.push(...d.events);d.events.length=0;}
 assert.ok(seen.some(e=>e.type==='ballend'));assert.deepEqual(seen.filter(e=>e.type==='bonusline').map(e=>e.label),['BUMPERS','RAMPS','ORBITS','TARGETS']);
 const bonus=seen.find(e=>e.type==='bonus');assert.equal(bonus.base,20*50+3000+2000+4*250);assert.equal(bonus.points,bonus.base*3);assert.equal(d.score,bonus.points);assert.equal(d.ball,2);assert.equal(d.phase,'plunge');assert.equal(d.bonusX,1);assert.ok(d.feats.includes('pinball.bonus'));
 // Tilt: two warnings, then the flippers die and the bonus is lost.
 const t=live();t.tally.ramps=5;put(t,4.5,9,0,0);t.nudge();t.tick(.4);t.nudge();assert.equal(t.tilt.warn,1);t.tick(.4);t.nudge();t.tick(.4);t.nudge();assert.equal(t.tilt.warn,3);assert.ok(t.tilt.on);
 t.press('left',true);run(t,30);assert.equal(t.flips[0].angle,FLIPPERS[0].rest,'flippers are dead');const s0=t.score;for(let i=0;i<80&&t.ball===1;i++){t.tick(.1);t.events.length=0;}assert.equal(t.ball,2);assert.equal(t.score,s0,'no bonus after a tilt');assert.equal(t.tilt.on,false);
 // A gentle nudge now and then is free.
 const n=live();put(n,4.5,9,0,0);n.nudge();n.tick(2.5);n.nudge();assert.equal(n.tilt.warn,0);
 // Extra ball: same ball number again. Third ball lost: game over with a result line.
 const x=live();x.extra.balls=1;put(x,4.55,.9,0,-6);for(let i=0;i<60&&x.phase!=='plunge';i++){x.tick(.1);x.events.length=0;}assert.equal(x.ball,1);assert.equal(x.extra.balls,0);
 const o=live();o.ball=3;o.stats.modes=2;o.stats.combo=4;put(o,4.55,.9,0,-6);for(let i=0;i<60&&o.status==='playing';i++){o.tick(.1);o.events.length=0;}assert.equal(o.status,'over');assert.match(o.reason,/Rank: STREET DAWG with a 4× combo/);
});

test('every feat can be earned, once, and the daily twist follows the seed',()=>{
 const sample={skill:{},combo:{combo:5},modedone:{done:3},multiball:{},jackpot:{},super:{},lanes:{bonusX:3},bonus:{points:20000},extraball:{},wizard:{}};
 const g=live();for(const f of FEATS){assert.match(f.id,/^pinball\.[a-z0-9]+$/);assert.ok(sample[f.on],'no sample for '+f.on);g.emit(f.on,sample[f.on]);assert.ok(g.feats.includes(f.id),f.id);}
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEATS.map(f=>f.id)).size,FEATS.length);assert.equal(g.feats.length,FEATS.length);
 const feats=g.events.filter(e=>e.type==='feat').length;for(const f of FEATS)g.emit(f.on,sample[f.on]);assert.equal(g.events.filter(e=>e.type==='feat').length,feats,'a feat lands once per run');
 const a=DAILY_TWIST(10),b=DAILY_TWIST(10),c=DAILY_TWIST(11);assert.deepEqual(a,b);assert.notEqual(a.id,c.id);
 const plain=live(10),daily=live(10);daily.daily=true;const type=Object.keys(DAILY_TWIST(10).mult)[0];plain.add(100,type);daily.add(100,type);assert.equal(plain.score,100);assert.equal(daily.score,100*DAILY_TWIST(10).mult[type]);assert.equal(daily.twist.id,a.id);assert.equal(plain.twist,null);
});

test('the playfield lights say what to shoot',()=>{
 const g=live();let L=g.lights();assert.ok(L.shots[3].start,'the scoop is lit to start a mode');assert.ok(L.shots[2].lightLock);assert.match(g.goal().text,/SHOOT THE SCOOP TO START RAMP RAGE/);
 g.startMode();L=g.lights();assert.ok(L.shots[1].mode&&L.shots[4].mode&&!L.shots[3].start);assert.equal(L.modes[0],'live');
 g.shot(1);assert.ok(g.lights().shots[5].combo,'a made shot lights the combo arrows');
 const p=new PinballGame(seededRandom(5),5);p.start();assert.equal(p.lights().skill,p.skill.lane);assert.match(p.goal().text,/SKILL SHOT/);
});

test('saves round-trip through the quick-game checkpoint; corrupt and old saves are refused',()=>{
 const g=createQuickGame('pinball',321);g.start();const mem={};for(let i=0;i<500;i++){pinballAutopilot(g,mem,1/60);g.tick(1/120);g.tick(1/120);g.events.length=0;}
 g.shot(1);g.startMode();g.hitDrop(0);g.emit('skill',{});
 const snap=snapshotQuick(g,'pinball');assert.ok(snap);assert.ok(validPinballSnapshot(snap));assert.deepEqual(snap.feats,['pinball.skill']);
 const back=restoreQuick(JSON.parse(JSON.stringify(snap)));assert.ok(back);assert.equal(back.status,'paused');for(const k of PINBALL_FIELDS)assert.deepEqual(back[k],JSON.parse(JSON.stringify(g[k])),k);assert.equal(back.score,g.score);
 // The restored game plays on exactly as the original does.
 back.start();const m1={},m2={};for(let i=0;i<300;i++){pinballAutopilot(g,m1,1/60);g.tick(1/60/2);g.tick(1/60/2);pinballAutopilot(back,m2,1/60);back.tick(1/60/2);back.tick(1/60/2);}assert.equal(back.score,g.score);assert.deepEqual(back.balls,g.balls);
 const bad=(change,why)=>{const s=JSON.parse(JSON.stringify(snap));change(s);assert.equal(validPinballSnapshot(s),false,why);assert.equal(restoreQuick(s),null,why);};
 bad(s=>{s.balls[0]??={};s.balls[0].x=NaN;},'NaN position');bad(s=>{s.balls=[{state:'flying',x:1,y:1,vx:0,vy:0}];},'unknown ball state');bad(s=>{s.flips[0].angle=3;},'flipper past its stop');bad(s=>{s.mode.id=9;},'unknown mode');
 bad(s=>{s.bonusX=40;},'bonus multiplier');bad(s=>{s.lanes=[true];},'lane count');bad(s=>{s.feats=['pinball.skill','pinball.skill'];},'duplicate feat');bad(s=>{s.feats=['pinball.nope'];},'unknown feat');bad(s=>{delete s.stats;},'missing stats');bad(s=>{s.phase='warp';},'phase');bad(s=>{s.mb.lit=[1,2];},'jackpot lamps');bad(s=>{s.queue=50;},'queue');
 // A save from the old three-table game is refused, not crashed on.
 const old={version:1,kind:'pinball',worldSeed:1,score:500,time:10,randomState:1,ballsLeft:3,balls:[{x:4,y:9,vx:0,vy:0,state:'play'}],flips:[{angle:-.55,omega:0,held:false},{angle:-.55,omega:0,held:false}],targets:[false,false,false],lanes:[false,false,false,false],mult:1,holeLit:false,reset:0,save:0,armed:false,nudgeCool:0,acc:0,bumps:0,multiballs:0,level:1,progress:{bumps:0,ramps:0,targets:false,lanes:false}};
 assert.equal(validPinballSnapshot(old),false);assert.equal(restoreQuick(old),null);for(const junk of [null,7,'x',[],{}])assert.equal(validPinballSnapshot(junk),false);
 // The look-ahead copy the attract mode uses does not disturb the game it copies.
 const before=JSON.stringify(g.balls);clonePinball(g).tick(.5);assert.equal(JSON.stringify(g.balls),before);
});
