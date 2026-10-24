import test from 'node:test';
import assert from 'node:assert/strict';
import {heatOf,tierOf,ramp,FULL_HEAT,HEAT_TIERS,heatLabel} from '../dist/difficulty.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {crossLane} from '../dist/pack-engine.js';
import {MazeGame} from '../dist/engine.js';
import {seededRandom} from '../dist/world.js';

test('Heat is a straight ramp from 0 to 1 with four tiers',()=>{
 assert.equal(heatOf(0,100),0);assert.equal(heatOf(50,100),.5);assert.equal(heatOf(500,100),1);assert.equal(heatOf(-5,100),0);
 assert.deepEqual([0,.24,.25,.5,.75,.99,1].map(tierOf),[0,0,1,2,3,3,4]);assert.equal(ramp(10,20,.5),15);
 for(let t=1;t<=HEAT_TIERS;t++)assert.ok(heatLabel(t).length>0);
});
test('DAWG Dash keeps its original speed curve',()=>{
 const g=createQuickGame('runner',7);for(const d of [0,160,800,2400,9000]){g.distance=d;assert.ok(Math.abs(g.speed-(25+Math.min(15,d/160)))<1e-9,`distance ${d}`);}
});
test('Every quick game gets harder with progress and announces each tier once',()=>{
 const drive={
  runner:g=>{g.lane=g.rows[0].safe;g.tick(.02);},
  flappy:g=>{g.gates++;g.tick(.001);},
  snake:g=>{g.coins++;g.tick(.001);},
  cross:g=>{g.hop=0;g.row=g.furthest;g.move('up');}
 };
 for(const [kind,step]of Object.entries(drive)){const g=createQuickGame(kind,11);g.start();const tiers=[];for(let i=0;i<6000&&g.status==='playing'&&g.heat<1;i++){step(g);for(const e of g.events)if(e.type==='heat')tiers.push(e.tier);g.events=[];if(kind==='flappy'||kind==='snake'||kind==='cross'){g.status='playing';}}
  assert.equal(g.heat,1,kind+' reaches full heat');assert.deepEqual(tiers,[1,2,3,4],kind+' announces each tier once');}
 const easy=createQuickGame('flappy',3),hot=createQuickGame('flappy',3);hot.gates=FULL_HEAT.flappy;assert.ok(hot.heat===1&&easy.heat===0);
 const snake=createQuickGame('snake',3),fast=createQuickGame('snake',3);fast.coins=FULL_HEAT.snake;assert.ok(fast.interval<snake.interval);
});
test('Cross traffic speeds up the further up the street a lane is',()=>{
 for(const seed of [0,42]){let early=0,late=0,n=0;for(let row=1;row<400;row++){const lane=crossLane(row,seed);if(lane.type==='park')continue;if(row<20)early=Math.max(early,lane.speed);if(row>=FULL_HEAT.cross)late=Math.max(late,lane.speed);n++;}
  assert.ok(late>early*1.3,`seed ${seed}: late lanes faster`);assert.ok(crossLane(200,seed).type==='park'||crossLane(200,seed).speed<=1.25*1.55+1e-9);}
});
test('Maze rivals speed up while a level is cleared and in timed runs',()=>{
 const g=new MazeGame('classic',seededRandom(5),{worldSeed:5});g.start();const start=g.heat;const total=g.pellets.size;let i=0;for(const key of [...g.pellets.keys()]){if(i++>total/2)break;g.pellets.delete(key);}
 assert.ok(g.heat>start,'clearing pellets adds heat');g.level=4;assert.equal(g.heat,1,'full heat by level 4');
 const r=new MazeGame('rush',seededRandom(6),{worldSeed:6});r.start();r.time=30;assert.ok(r.heat>=.5,'half the clock is at least half heat');
});
test('Heat needs no new save fields: a resumed run keeps its heat and stays quiet',()=>{
 const g=createQuickGame('runner',9);g.start();for(let i=0;i<400;i++){g.lane=g.rows[0].safe;g.tick(.02);}g.events=[];const h=restoreQuick(JSON.parse(JSON.stringify(snapshotQuick(g,'runner'))));
 assert.ok(h);assert.equal(h.heat,g.heat);h.start();h.lane=h.rows[0].safe;h.tick(.001);assert.equal(h.events.filter(e=>e.type==='heat').length,0);
});
