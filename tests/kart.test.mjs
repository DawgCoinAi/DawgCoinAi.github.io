import test from 'node:test';
import assert from 'node:assert/strict';
import {KartGame,KART,kartTrack,trackAt,trackPoint,ordinal} from '../dist/kart-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

// A tidy driver: follows the inside line through corners and fires items as soon as they land.
function drive(g,seconds,{items=true}={}){const t=g.track;for(let s=0;s<seconds&&g.status==='playing';s+=1/60){const k=g.you,look=trackAt(t,k.p+14+k.v*.4),line=Math.max(-3.5,Math.min(3.5,look.curve*260)),err=Math.max(-.45,Math.min(.45,(line-k.d)*.35)),st=(err-k.a)*3.2;
 g.press('left',st>.25);g.press('right',st<-.25);if(items&&k.item)g.press('up',true);g.tick(1/60);}}

test('Circuits are pure functions of the seed, closed, evenly sampled and never too tight',()=>{
 for(const seed of [1,42,9001,123456]){const t=kartTrack(seed);assert.equal(t,kartTrack(seed));assert.equal(t.pts.length,KART.samples);assert.ok(t.len>500&&t.len<1200,`length ${t.len}`);
  const steps=t.pts.map((p,i)=>Math.hypot(t.pts[(i+1)%t.pts.length][0]-p[0],t.pts[(i+1)%t.pts.length][1]-p[1]));assert.ok(Math.max(...steps)-Math.min(...steps)<.05*t.ds);
  assert.ok(Math.max(...t.curve.map(Math.abs))<1/20,'no corner tighter than a 20 m radius');assert.equal(t.boxes.length,16);assert.equal(t.pads.length,2);
  const a=trackAt(t,10),b=trackAt(t,10+t.len);assert.ok(Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9,'wraps every lap');
  const left=trackPoint(t,50,3),c=trackAt(t,50);assert.ok(Math.abs(Math.hypot(left.x-c.x,left.y-c.y)-3)<1e-9);assert.ok(-Math.sin(c.ang)*(left.x-c.x)+Math.cos(c.ang)*(left.y-c.y)>0,'positive d is to the left');}
});
test('A clean racer finishes three laps near the front; an idle one is called last',()=>{
 let wins=0,podiums=0;for(let seed=1;seed<=6;seed++){const g=new KartGame(seededRandom(seed),seed*7919);g.start();drive(g,200);
  assert.equal(g.status,'over',`seed ${seed}`);assert.ok(g.you.finished);assert.ok(g.time>50&&g.time<120,`race took ${g.time}`);if(g.place===1)wins++;if(g.place<=3)podiums++;
  assert.ok(g.score>=Math.floor(g.distance/2)+[3000,2000,1400,900,500,250][g.place-1]);for(const k of g.karts)assert.ok(Number.isFinite(k.p+k.d+k.v+k.a));}
 assert.ok(wins>=3&&podiums>=5,`wins ${wins} podiums ${podiums}`);
 const idle=new KartGame(seededRandom(3),3);idle.start();for(let s=0;s<200&&idle.status==='playing';s+=1/60)idle.tick(1/60);
 assert.equal(idle.status,'over');assert.equal(idle.place,KART.rivals+1);assert.match(idle.reason,/6th of 6/);
});
test('Steering, drifting into a mini-turbo, and walls',()=>{
 const g=new KartGame(seededRandom(5),5);g.start();g.tick(1.8);assert.ok(g.you.v>20,'auto-gas');const d=g.you.d;
 const ref=new KartGame(seededRandom(5),5);ref.start();ref.tick(1.8);ref.tick(.3);g.press('left',true);g.tick(.3);assert.ok(g.you.d>ref.you.d+.2,'left steers toward +d');g.press('left',false);
 g.you.d=0;g.you.a=0;const into=trackAt(g.track,g.you.p).curve>0?'left':'right',out=into==='left'?'right':'left',sign=into==='left'?1:-1;g.press('down',true);g.press(into,true);g.tick(1/60);assert.equal(g.you.drift,sign);assert.ok(g.events.some(e=>e.type==='hop'));
 g.tick(.5);g.press(into,false);g.press(out,true);g.tick(.6);assert.equal(g.you.drift,sign,'counter-steering holds the slide');assert.ok(g.events.some(e=>e.type==='charge'));g.press(out,false);g.press('down',false);g.tick(1/60);
 assert.ok(g.events.some(e=>e.type==='miniturbo'),'releasing a charged drift fires a mini-turbo');assert.ok(g.you.boost>0);
 const w=new KartGame(seededRandom(6),6);w.start();w.press('left',true);w.tick(6);assert.ok(Math.abs(w.you.d)<=KART.wall);assert.ok(w.events.some(e=>e.type==='wall'));
 const a=new KartGame(seededRandom(7),7);a.start();a.autoDrift=true;a.tick(3);a.press('left',true);a.tick(.6);assert.equal(a.you.drift,1,'touch players drift by holding a turn');
});
test('Items: boost, bones that spin karts out, and rockets that find the kart ahead',()=>{
 const g=new KartGame(seededRandom(8),8);g.start();g.tick(3);const you=g.you;
 you.item='boost';assert.ok(g.press('up',true));assert.ok(you.boost>1);assert.equal(you.item,null);assert.equal(g.press('up',true),false,'nothing left to fire');
 you.item='bone';g.press('up',true);assert.equal(g.bones.length,1);const victim=g.karts[1];g.bones[0].p=victim.p+.2;g.bones[0].d=victim.d;g.tick(1/60);assert.ok(victim.spin>0);assert.equal(g.bones.length,0);
 const r=new KartGame(seededRandom(9),9);r.start();r.tick(3);r.you.p=Math.min(...r.karts.slice(1).map(k=>k.p))-6;r.you.d=0;const ahead=r.karts.filter(k=>k.id&&k.p>r.you.p).sort((a,b)=>a.p-b.p)[0];r.you.item='rocket';r.press('up',true);r.tick(1);
 assert.ok(r.events.some(e=>e.type==='hit'&&e.kart===ahead.id),'the rocket spun out the kart ahead');assert.equal(r.hits,1);
 const s=new KartGame(seededRandom(10),10);s.start();s.you.coins=5;s.spinOut(s.you,'bone');assert.equal(s.you.coins,2);assert.ok(s.events.some(e=>e.type==='spin'));
});
test('Item boxes, coins and boost pads along the track',()=>{
 const g=new KartGame(seededRandom(11),11);g.start();g.tick(1);const t=g.track,box=t.boxes[0];
 g.you.p=box.s-.2;g.you.d=box.d;g.tick(1/120);assert.ok(g.you.item);assert.ok(g.events.some(e=>e.type==='item'));
 const c=t.coins[5];g.you.p=c.s-.1+t.len;g.you.d=c.d;const coins=g.you.coins;g.tick(1/120);assert.equal(g.you.coins,coins+1);
 const pad=t.pads[0];g.you.p=pad.s-.2;g.you.d=pad.d;g.you.boost=0;g.tick(1/120);assert.ok(g.you.boost>.5);
 assert.deepEqual([1,2,3,4,11,12,13,21,22,23].map(ordinal),['1st','2nd','3rd','4th','11th','12th','13th','21st','22nd','23rd']);
});
test('The race heats up lap by lap and announces laps and passes',()=>{
 const g=new KartGame(seededRandom(12),12);g.start();assert.equal(g.heat,0);const seen=new Set();
 for(let i=0;i<120&&g.status==='playing';i++){drive(g,1);for(const e of g.events)seen.add(e.type);g.events=[];}
 for(const type of ['lap','heat','finish','over','coin','item'])assert.ok(seen.has(type),type);
});
test('Same seed and inputs race identically, and a checkpoint resumes exactly',()=>{
 const a=createQuickGame('kart',77),b=createQuickGame('kart',77);a.start();b.start();drive(a,25);drive(b,25);assert.equal(a.score,b.score);assert.deepEqual(a.karts,b.karts);
 a.pause();const snap=JSON.parse(JSON.stringify(snapshotQuick(a,'kart'))),c=restoreQuick(snap);assert.ok(c,'snapshot restores');assert.equal(c.status,'paused');
 a.start();c.start();for(let i=0;i<300;i++){a.tick(1/60);c.tick(1/60);}assert.equal(c.score,a.score);assert.deepEqual(c.karts,a.karts);
 assert.equal(restoreQuick({...snap,karts:snap.karts.slice(1)}),null);assert.equal(restoreQuick({...snap,karts:[{...snap.karts[0],v:999},...snap.karts.slice(1)]}),null);
 assert.equal(restoreQuick({...snap,karts:[{...snap.karts[0],item:'banana'},...snap.karts.slice(1)]}),null);assert.equal(restoreQuick({...snap,lap:9}),null);
});
