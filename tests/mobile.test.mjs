import test from 'node:test';
import assert from 'node:assert/strict';
import {MazeGame} from '../dist/engine.js';
import {mobileLayout,stickDirection,clampStick,dailyChallenge,seededRandom,medalFor,dailyResult,advanceGame} from '../dist/mobile-core.js';
import {snapshotMaze,restoreMaze} from '../dist/checkpoint.js';

test('Portrait and landscape layouts fit the full maze, HUD and controls inside safe areas',()=>{
 const devices=[
  [320,568,{top:20}],[360,640,{}],[375,667,{}],[390,844,{top:47,bottom:34}],[393,852,{top:59,bottom:34}],
  [412,915,{top:24,bottom:24}],[430,932,{top:59,bottom:34}],[768,1024,{top:24,bottom:20}],[800,1280,{top:24,bottom:24}],
  [568,320,{}],[667,375,{}],[844,390,{left:47,right:47,bottom:21}],[915,412,{left:24,right:24,bottom:24}],
  [1024,768,{top:24,bottom:20}],[1280,800,{top:24,bottom:24}]
 ];
 for(const[w,h,safe]of devices){
  const l=mobileLayout(w,h,safe);assert.ok(l.totalHeight<=h+1,`${w}×${h}: height ${l.totalHeight}`);
  const usedWidth=l.cabinetWidth+(l.landscape?288+24:0)+16+(safe.left||0)+(safe.right||0);
  assert.ok(usedWidth<=w+1,`${w}×${h}: width ${usedWidth}`);assert.ok(l.boardWidth>=200,`${w}×${h}: readable maze`);assert.equal(l.controls,144);
 }
});
test('Joystick supports all directions, a dead zone, and stable diagonal turns',()=>{
 assert.equal(stickDirection(5,6),null);assert.equal(stickDirection(40,0),'right');assert.equal(stickDirection(-40,0),'left');
 assert.equal(stickDirection(0,-40),'up');assert.equal(stickDirection(0,40),'down');
 assert.equal(stickDirection(30,32,'right'),'right');assert.equal(stickDirection(30,40,'right'),'down');
 assert.equal(stickDirection(31,30,'up'),'down');assert.equal(stickDirection(NaN,30),null);
 const p=clampStick(100,100);assert.ok(Math.abs(Math.hypot(p.x,p.y)-38)<1e-8);assert.deepEqual(clampStick(3,4),{x:3,y:4});
});
test('Daily seeds and rules repeat for a date and change on another date',()=>{
 const a=dailyChallenge('2026-10-17'),b=dailyChallenge('2026-10-17'),c=dailyChallenge('2026-10-18');
 assert.deepEqual(a,b);assert.notEqual(a.seed,c.seed);assert.ok(a.startLevel>=1&&a.startLevel<=3);
 const x=seededRandom(a.seed),y=seededRandom(b.seed);assert.deepEqual(Array.from({length:30},()=>x()),Array.from({length:30},()=>y()));
 const state=x.getState(),expected=x();x.setState(state);assert.equal(x(),expected);
});
test('Daily medals reward each milestone only once and preserve the best score',()=>{
 const targets=[800,1600,2800];assert.equal(medalFor(799,targets),0);assert.equal(medalFor(800,targets),1);
 let r=dailyResult(null,900,targets);assert.equal(r.reward,100);assert.equal(r.record.medal,1);
 r=dailyResult(r.record,850,targets);assert.equal(r.reward,0);assert.equal(r.record.best,900);
 r=dailyResult(r.record,3000,targets);assert.equal(r.reward,400);assert.equal(r.record.medal,3);
 r=dailyResult(r.record,3100,targets);assert.equal(r.reward,0);assert.equal(r.record.best,3100);assert.equal(r.record.runs,4);
 assert.equal(dailyResult(null,2800,targets).reward,500);
});
test('Daily games apply their rule variant and use the timed game clock',()=>{
 const d=dailyChallenge('2026-10-17'),g=new MazeGame('daily',seededRandom(d.seed),d);
 assert.equal(g.level,d.startLevel);assert.equal(g.dashRecharge,d.dashRecharge);assert.equal(g.rivalSpeed,d.rivalSpeed);
 g.start();g.dash();assert.equal(g.dashCooldown,d.dashRecharge);g.spawnLoot();assert.equal(g.loot.value,Math.round((400+g.level*100)*d.lootMultiplier));
 g.time=.01;g.tick(.02);assert.equal(g.status,'over');assert.equal(g.time,0);
});
test('Timing stays consistent at 15, 30, 60 and 120 frames per second',()=>{
 for(const fps of [15,30,60,120]){
  const g=new MazeGame('rush');g.start();g.ghosts.forEach(a=>a.cooldown=10000);
  for(let i=0;i<fps*10;i++)advanceGame(g,1/fps);assert.ok(Math.abs(g.time-50)<.0001,`${fps} FPS: ${g.time}`);
  for(let i=0;i<fps*51;i++)advanceGame(g,1/fps);assert.equal(g.status,'over');assert.equal(g.time,0);
 }
});
test('A long interrupted frame pauses instead of advancing unseen gameplay',()=>{
 const g=new MazeGame('rush');g.start();advanceGame(g,2);assert.equal(g.status,'paused');assert.equal(g.time,60);assert.equal(g.events.at(-1).type,'interrupted');
});
test('Arcade checkpoints restore exact coins, actors, score and power state paused',()=>{
 const g=new MazeGame();g.start();g.dash();for(let i=0;i<160;i++)g.tick(1/60);
 const s=snapshotMaze(g),r=restoreMaze(s);assert.ok(r);assert.equal(r.game.status,'paused');
 assert.equal(r.game.score,g.score);assert.equal(r.game.level,g.level);assert.deepEqual([...r.game.pellets],[...g.pellets]);
 assert.deepEqual(r.game.player,g.player);assert.deepEqual(r.game.ghosts,g.ghosts);assert.deepEqual(r.game.stats,g.stats);
 assert.equal(r.game.dashCooldown,g.dashCooldown);assert.equal(r.game.power,g.power);
});
test('Daily checkpoints retain random state and cannot resume on a different day',()=>{
 const d=dailyChallenge('2026-10-17'),g=new MazeGame('daily',seededRandom(d.seed),d);g.start();
 for(let i=0;i<180;i++)g.tick(1/60);const saved=snapshotMaze(g,d),r=restoreMaze(saved,d.day);
 assert.ok(r);assert.equal(r.game.time,g.time);assert.equal(r.game.random(),g.random());assert.equal(r.game.dashRecharge,d.dashRecharge);
 assert.equal(restoreMaze(saved,'2026-10-18'),null);
});
test('Broken saves and completed runs are not restored as active games',()=>{
 assert.equal(restoreMaze(null),null);assert.equal(restoreMaze({version:3}),null);
 const g=new MazeGame();g.start();const s=snapshotMaze(g);s.player.x=0;assert.equal(restoreMaze(s),null);
 g.status='over';assert.equal(snapshotMaze(g),null);
});
