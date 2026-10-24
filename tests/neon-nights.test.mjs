import test from 'node:test';
import assert from 'node:assert/strict';
import {MazeGame,DIRS,mapForLevel,ARCADE_DISTRICTS} from '../dist/engine.js';
import {THEMES} from '../dist/renderer.js';

const keepRivalsAway=g=>g.ghosts.forEach(e=>e.cooldown=100000);
const tickFor=(g,seconds)=>{for(let i=0;i<seconds*60;i++)g.tick(1/60);};
function allReachable(g){
 const seen=new Set(['10,15']),q=[[10,15]];
 for(let i=0;i<q.length;i++){const[x,y]=q[i];for(const[dx,dy]of Object.values(DIRS)){const a=x+dx,b=y+dy,k=`${a},${b}`;if(!g.wall(a,b)&&!seen.has(k)){seen.add(k);q.push([a,b]);}}}
 return seen;
}
test('Three unique district layouts have reachable coins, valid spawns, and repeat correctly',()=>{
 const layouts=new Set();
 for(let level=1;level<=6;level++){
  const g=new MazeGame();g.level=level;g.loadLevel();const seen=allReachable(g);
  assert.equal(g.map.length,23);assert.ok(g.map.every(row=>row.length===21));
  for(const k of g.pellets.keys())assert.ok(seen.has(k),`Level ${level}: ${k}`);
  for(const actor of [g.player,...g.ghosts])assert.ok(!g.wall(actor.x,actor.y));
  assert.equal(g.district,ARCADE_DISTRICTS[(level-1)%3]);
  layouts.add(g.map.join('\n'));
 }
 assert.equal(layouts.size,3);assert.deepEqual(mapForLevel(1),mapForLevel(4));
});
test('Dash activates only in play, shields against a rival, and must recharge',()=>{
 const g=new MazeGame();assert.equal(g.dash(),false);g.start();keepRivalsAway(g);
 assert.equal(g.dash(),true);assert.equal(g.dash(),false);assert.equal(g.stats.dashes,1);
 g.invincible=0;Object.assign(g.ghosts[0],{x:10,y:15,tx:10,ty:15,moving:false,cooldown:0});
 g.tick(.001);assert.equal(g.lives,3);assert.equal(g.status,'playing');
 keepRivalsAway(g);tickFor(g,1);assert.equal(g.dashTime,0);assert.equal(g.dash(),false);
 tickFor(g,5.1);assert.equal(g.dashCooldown,0);assert.equal(g.dash(),true);assert.equal(g.stats.dashes,2);
});
test('Dash movement is faster, stays in corridors, and pause freezes recharge',()=>{
 const normal=new MazeGame(),boosted=new MazeGame();
 for(const g of [normal,boosted]){g.start();keepRivalsAway(g);}
 boosted.dash();tickFor(normal,.3);tickFor(boosted,.3);
 assert.ok(boosted.position(boosted.player).x<normal.position(normal.player).x);
 assert.ok(!boosted.wall(boosted.player.x,boosted.player.y));
 boosted.pause();const cooldown=boosted.dashCooldown,duration=boosted.dashTime;
 tickFor(boosted,5);assert.equal(boosted.dashCooldown,cooldown);assert.equal(boosted.dashTime,duration);
 assert.equal(boosted.dash(),false);
});
test('Loot is accessible, expires after 12 active seconds, and pauses with the game',()=>{
 const g=new MazeGame('classic',()=>.5);g.start();keepRivalsAway(g);g.spawnLoot();
 assert.ok(!g.wall(g.loot.x,g.loot.y));assert.ok(allReachable(g).has(`${g.loot.x},${g.loot.y}`));
 assert.equal(g.loot.value,500);g.pause();tickFor(g,20);assert.equal(g.loot.time,12);
 g.start();tickFor(g,12.2);assert.equal(g.loot,null);assert.ok(g.events.some(e=>e.type==='lootExpired'));
});
test('Loot scores once and is collectible even when its coin was already eaten',()=>{
 const g=new MazeGame();g.start();g.pellets.delete('10,15');
 g.loot={x:10,y:15,time:10,value:500};g.collect();assert.equal(g.score,500);assert.equal(g.stats.loot,1);assert.equal(g.loot,null);
 g.collect();assert.equal(g.score,500);assert.equal(g.stats.loot,1);
});
test('Each maze spawns at most two gold bags at the intended collection thresholds',()=>{
 const g=new MazeGame('classic',()=>.5);g.start();
 const spots=[...g.pellets.keys()].map(k=>k.split(',').map(Number));
 for(let i=0;i<spots.length;i++){
  const[x,y]=spots[i];g.player.x=x;g.player.y=y;g.collect();
  if(i===78)assert.equal(g.lootSpawns,0);
  if(i===79){assert.equal(g.lootSpawns,1);g.loot=null;}
  if(i===158)assert.equal(g.lootSpawns,1);
  if(i===159){assert.equal(g.lootSpawns,2);g.loot=null;}
 }
 assert.equal(g.lootSpawns,2);assert.equal(g.status,'level');
});
test('All cosmetic palettes have distinct colors and ordered unlock thresholds',()=>{
 assert.deepEqual(Object.values(THEMES).map(t=>t.unlock),[0,300,900,1800]);
 assert.equal(new Set(Object.values(THEMES).map(t=>t.color)).size,4);
 for(const t of Object.values(THEMES))assert.match(t.color,/^#[0-9a-f]{6}$/i);
});
