import test from 'node:test';
import assert from 'node:assert/strict';
import {SnakeGame,SNAKE,FEATS,DAILY_TWIST,SNAKE_COLS,SNAKE_ROWS} from '../dist/snake-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';

// A seeded game with the crystals cleared away and the snake laid along a row, heading right.
const laid=(seed=12345,x=5,y=9)=>{const g=new SnakeGame(()=>.5,seed);g.start();g.rocks=[];g.garden=[];g.body=[{x,y},{x:x-1,y},{x:x-2,y}];g.dir='right';g.food={x:0,y:0};return g;};
const step=g=>{g.elapsed=0;g.tick(g.interval);};
const eat=g=>{const h=g.body[0];g.food=g.next(h,g.dir);g.par=1;g.steps=0;step(g);};

test('Snake ladder: every five gold opens the next named arena and pays 50',()=>{
 const g=laid();assert.equal(g.stageName,'THE STADIUM');assert.equal(g.toNext,5);g.coins=4;const s=g.score;eat(g);assert.equal(g.stage,1);assert.equal(g.stageName,'WARP RING');assert.equal(g.score,s+30+50);assert.deepEqual(g.events.find(e=>e.type==='stage'),{type:'stage',stage:1,name:'WARP RING'});
 g.coins=21;assert.equal(g.stageName,'THE STADIUM II');const plain=new SnakeGame(()=>.5);plain.coins=12;assert.equal(plain.stage,0,'the classic unseeded board has no ladder');
});
test('Snake Warp Ring: the edges carry you across instead of ending the run',()=>{
 const g=laid(12345,14,9);g.coins=5;assert.equal(g.wrap,true);step(g);assert.equal(g.status,'playing');assert.deepEqual(g.body[0],{x:0,y:9});assert.equal(g.warps,1);assert.ok(g.events.some(e=>e.type==='warp'));
 const back=restoreQuick(JSON.parse(JSON.stringify(snapshotQuick(g,'snake'))));assert.ok(back,'a body that spans the warp still loads');
 const wall=laid(12345,14,9);step(wall);assert.equal(wall.status,'over');assert.match(wall.reason,/edge of the block/);
});
test('Snake rivals: they arrive in Rival Run, hunt the gold, and a boxed-in rival pays out',()=>{
 const g=laid();g.coins=10;assert.equal(g.rivalGoal,1);for(let i=0;i<4&&!g.rivals.length;i++){g.body=[{x:5,y:9},{x:4,y:9},{x:3,y:9}];step(g);}assert.equal(g.rivals.length,1);assert.ok(g.events.some(e=>e.type==='rival'&&e.name==='VIPER'));
 const v=g.rivals[0];assert.equal(v.body.length,4);assert.ok(v.body.every(p=>Math.abs(p.x-5)+Math.abs(p.y-9)>6),'never dropped on top of you');
 // Chases the gold.
 g.food={x:v.body[0].x,y:9};const d0=Math.abs(v.body[0].y-9);for(let i=0;i<6;i++){g.body=[{x:5,y:3},{x:4,y:3},{x:3,y:3}];step(g);}assert.ok(Math.abs(g.rivals[0].body[0].y-9)<d0);
 // Boxed in: a rival in the corner with a crystal on its only exit has nowhere to go.
 const t=laid();t.coins=10;t.stepN=1;t.rivals=[{kind:1,dir:'up',body:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3}],roam:null}];t.rocks=[{x:1,y:0}];const s=t.score;step(t);
 assert.equal(t.rivals.length,0);assert.equal(t.traps,1);assert.equal(t.score,s+SNAKE.trap+20);const e=t.events.find(e=>e.type==='trap');assert.equal(e.name,'COIL');assert.equal(e.cells.length,4);assert.ok(t.feats.includes('snake.trap'));
 // Riding into a rival ends the run and names it.
 const hit=laid();hit.coins=10;hit.rivals=[{kind:0,dir:'down',body:[{x:6,y:10},{x:6,y:9},{x:6,y:8},{x:6,y:7}],roam:null}];hit.stepN=0;step(hit);assert.equal(hit.status,'over');assert.match(hit.reason,/VIPER cut you off/);
 // A rival that reaches the gold first steals it and breaks your line streak.
 const st=laid();st.coins=10;st.streak=2;st.stepN=1;st.rivals=[{kind:0,dir:'right',body:[{x:3,y:3},{x:2,y:3},{x:1,y:3},{x:0,y:3}],roam:null}];st.food={x:4,y:3};step(st);assert.ok(st.events.some(e=>e.type==='steal'));assert.equal(st.streak,0);assert.equal(st.rivals[0].body.length,5);
});
test('Snake power-ups: phase through a body once, slow time, pull gold in',()=>{
 const g=laid();g.power={x:6,y:9,kind:'phase',ttl:60};step(g);assert.equal(g.phase,true);assert.equal(g.power,null);assert.ok(g.events.some(e=>e.type==='power'&&e.kind==='phase'));
 g.body=[{x:1,y:1},{x:1,y:2},{x:2,y:2},{x:2,y:1},{x:3,y:1}];g.dir='right';step(g);assert.equal(g.status,'playing','ghosted through its own body');assert.equal(g.phase,false);assert.equal(g.phased,1);
 g.body=[{x:1,y:1},{x:1,y:2},{x:2,y:2},{x:2,y:1},{x:3,y:1}];g.dir='right';step(g);assert.equal(g.status,'over','only once');
 const s=laid(),base=s.interval;s.power={x:6,y:9,kind:'slow',ttl:60};step(s);assert.ok(s.slow>0);assert.ok(Math.abs(s.interval-base*SNAKE.slow)<1e-9);s.tick(7);assert.equal(s.slow,0);
 const m=laid();m.power={x:6,y:9,kind:'magnet',ttl:60};m.food={x:8,y:10};step(m);assert.ok(m.magnet>0);assert.equal(m.coins,0);step(m);assert.equal(m.coins,1,'gold two cells away is pulled in');
 const p=laid();p.power={x:0,y:17,kind:'slow',ttl:2};step(p);assert.equal(p.power.ttl,1);step(p);assert.equal(p.power,null,'power-ups expire');
 const seeded=laid();seeded.coins=2;eat(seeded);assert.ok(seeded.power&&SNAKE.powers.includes(seeded.power.kind),'one appears after every third gold');
});
test('Snake boost: held for speed, and gold eaten at speed pays more',()=>{
 const g=laid(),base=g.interval;g.press('boost',true);assert.ok(Math.abs(g.interval-base*SNAKE.boost)<1e-9);const s=g.score;eat(g);assert.equal(g.score,s+25+5+10);assert.equal(g.hot,1);assert.equal(g.events.find(e=>e.type==='coin').hot,true);
 const fast=g.interval;g.press('boost',false);assert.ok(Math.abs(g.interval*SNAKE.boost-fast)<1e-9);g.press('boost',true);g.pause();assert.equal(g.boosting,false);
});
test('Snake Crush: the outer ring flashes, then closes, and opens again in the next arena',()=>{
 const g=laid(12345,6,9);g.coins=15;assert.equal(g.arena,3);let warned=false;for(let i=0;i<12&&g.ring===0;i++){g.body=[{x:6,y:9},{x:5,y:9},{x:4,y:9}];step(g);warned||=g.events.some(e=>e.type==='closing');if(g.ring===0)assert.ok(i<10);}
 assert.ok(warned);assert.equal(g.ring,1);assert.ok(g.events.some(e=>e.type==='shrink'));assert.equal(g.inside({x:0,y:5}),false);assert.equal(g.wrap,false);assert.ok(g.inside(g.food));
 const edge=laid(12345,13,9);edge.coins=15;edge.ring=1;step(edge);assert.equal(edge.status,'over');assert.match(edge.reason,/closing wall/);
 g.coins=19;g.body=[{x:6,y:9},{x:5,y:9},{x:4,y:9}];eat(g);assert.equal(g.arena,0);g.body=[{x:6,y:9},{x:5,y:9},{x:4,y:9}];step(g);assert.equal(g.ring,0);
});
test('Snake first person: a little slower, a quarter more score',()=>{const g=laid(),base=g.interval;g.fp=true;assert.ok(Math.abs(g.interval-base*SNAKE.firstPersonPace)<1e-9);eat(g);assert.equal(g.score,Math.round(30*1.25));assert.equal(g.fpGold,1);});
test('Snake feats: every feat can be earned, once per run, and is saved',()=>{
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEATS.map(f=>f.id)).size,FEATS.length);for(const f of FEATS)assert.match(f.id,/^snake\.[a-z0-9]+$/);
 const set={'snake.long20':g=>{g.body=Array.from({length:20},(_,i)=>({x:i%15,y:1}));},'snake.direct5':g=>g.streak=5,'snake.smash':g=>g.smashed=[0],'snake.trap':g=>g.traps=1,'snake.trap3':g=>g.traps=3,'snake.phase':g=>g.phased=1,'snake.hot5':g=>g.hot=5,'snake.warp':g=>g.warps=8,'snake.crush':g=>g.coins=20,'snake.helmet':g=>g.fpGold=8};
 for(const f of FEATS){const g=laid();g.checkFeats();assert.ok(!g.feats.includes(f.id),f.id);set[f.id](g);g.checkFeats();g.checkFeats();assert.ok(g.feats.includes(f.id),f.id);assert.equal(g.events.filter(e=>e.type==='feat'&&e.id===f.id).length,1);}
 const g=laid();g.press('boost',true);for(let i=0;i<5;i++){g.body=[{x:5,y:9},{x:4,y:9},{x:3,y:9}];g.dir='right';eat(g);}assert.ok(g.feats.includes('snake.hot5'));assert.ok(g.feats.includes('snake.direct5'));
 g.body=[{x:5,y:9},{x:4,y:9},{x:3,y:9}];g.food={x:0,y:0};const snap=snapshotQuick(g,'snake'),back=restoreQuick(JSON.parse(JSON.stringify(snap)));assert.ok(back);assert.deepEqual(back.feats,g.feats);assert.equal(restoreQuick({...snap,feats:['snake.nope']}),null);assert.equal(restoreQuick({...snap,feats:[g.feats[0],g.feats[0]]}),null);
});
test('Snake saves: rivals, power-ups and the ring round-trip exactly; bad values are rejected',()=>{
 const g=createQuickGame('snake',31);g.start();g.rocks=[];g.garden=[];g.smashed=[];g.coins=16;g.body=[{x:6,y:9},{x:5,y:9},{x:4,y:9}];g.food={x:9,y:12};for(let i=0;i<14;i++){g.body=[{x:6,y:9},{x:5,y:9},{x:4,y:9}];step(g);}assert.equal(g.ring,1);assert.ok(g.rivals.length>=1);g.power={x:8,y:8,kind:'magnet',ttl:30};g.phase=true;
 const snap=snapshotQuick(g,'snake');assert.equal(snap.rivals.length,g.rivals.length);
 for(const bad of [{ring:5},{power:{x:1,y:1,kind:'wings',ttl:5}},{rivals:[{kind:9,dir:'up',body:[]}]},{slow:99},{phase:1},{closing:40},{traps:-1}])assert.equal(restoreQuick({...snap,...bad}),null,JSON.stringify(bad));
 const seedTrue=seed=>{const a=createQuickGame('snake',seed);a.start();for(let i=0;i<400;i++){if(i%37===0)a.move(['up','right','down','left'][(i/37)%4]);a.tick(1/60);}return snapshotQuick(a,'snake')||{over:a.reason,score:a.score};};
 assert.deepEqual(seedTrue(9),seedTrue(9),'the same seed and the same inputs give the same run');
});
test('Snake daily twists change a rule by seed, only on a daily run',()=>{
 const ids=new Set();for(let s=0;s<8;s++){const t=DAILY_TWIST(s);ids.add(t.id);assert.ok(t.name&&t.text);}assert.equal(ids.size,4);
 const g=laid(4);assert.equal(g.twist,null);assert.equal(g.wrap,false);g.daily=true;assert.equal(g.twist.id,'warp');assert.equal(g.wrap,true);
 const pack=laid(5);pack.daily=true;pack.coins=10;assert.equal(pack.rivalGoal,2);const hot=laid(7);hot.daily=true;hot.press('boost',true);const s=hot.score;eat(hot);assert.equal(hot.score,s+25+5+30);
 const pow=laid(6);pow.daily=true;pow.coins=1;eat(pow);assert.ok(pow.power,'a power-up after every second gold');
 assert.equal(SNAKE_COLS,15);assert.equal(SNAKE_ROWS,18);
});
