import test from 'node:test';
import assert from 'node:assert/strict';
import {TurboGame,TRICKS,TURBO,turboChunk,chunkAt,groundAt} from '../dist/turbo-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';

// A fair autopilot: rides kicker ramps, jumps gaps and spikes, rolls into bots.
function pilot(g){const s=g.worldSeed,look=g.x+g.vx*.35,ch=chunkAt(s,look),ch2=chunkAt(s,g.x+1),here=chunkAt(s,g.x);
 const ramped=here.ramp&&g.x<here.ramp.x1+.5||ch.ramp&&look>ch.ramp.x0-8;
 const danger=!ramped&&(groundAt(s,look)===null||[ch,ch2].some(c=>c.spikes.some(([a,b])=>look>a-1&&g.x<b)));
 if(danger&&g.grounded)g.move('up');else if([ch,ch2].some(c=>c.bots.some(b=>Math.abs(b.x-look)<3))&&g.grounded)g.move('down');}
const play=(g,seconds,steer=true)=>{for(let t=0;t<seconds&&g.status==='playing';t+=1/120){if(steer)pilot(g);g.tick(1/120);}};

test('The course is a pure function of the seed, built from contiguous chunks',()=>{
 for(const seed of [1,42,9001]){let end=0;for(let k=0;k<60;k++){const c=turboChunk(seed,k);assert.equal(c.x0,end);end+=c.len;assert.ok(c.coins.every(o=>o.x>=c.x0-1&&o.x<=c.x0+c.len+12));}
  assert.equal(turboChunk(seed,0).kind,'flat');assert.equal(turboChunk(seed,1).kind,'flat');assert.equal(turboChunk(seed,8).kind,'loop');
  for(let x=0;x<2000;x+=7.3){const g=groundAt(seed,x);assert.ok(g===null||Number.isFinite(g));}}
 assert.deepEqual(turboChunk(7,20),turboChunk(7,20));
});
test('A careful player survives long runs, takes loops and smashes bots; an idle one does not',()=>{
 let loops=0,bots=0;for(let seed=1;seed<=20;seed++){const g=new TurboGame(Math.random,seed);g.start();play(g,120);assert.equal(g.status,'playing',`seed ${seed}: ${g.reason}`);assert.ok(g.distance>1500);loops+=g.loops;bots+=g.bots;
  assert.ok(Number.isFinite(g.x+g.y+g.vx+g.vy));assert.equal(g.score,Math.floor(g.distance)+g.bonus);}
 assert.ok(loops>20&&bots>20);
 const idle=new TurboGame(Math.random,3);idle.start();play(idle,120,false);assert.equal(idle.status,'over');
});
test('Controls: jump, roll, stomp, boost and brake',()=>{
 const g=new TurboGame(Math.random,5);g.start();g.tick(.01);
 assert.ok(g.move('up'));assert.equal(g.vy,TURBO.jump);assert.equal(g.move('up'),false,'no double jump');
 assert.ok(g.move('down'));assert.ok(g.stomping);assert.ok(g.vy<=TURBO.stomp);
 const b=new TurboGame(Math.random,5);b.start();const v=b.vx;assert.ok(b.move('right'));assert.ok(b.vx>v);assert.equal(b.move('right'),false,'boost cools down');
 assert.ok(b.move('left'));assert.ok(b.brake>0);assert.ok(b.move('down')||true);
});
test('Getting hit with gold scatters it and grants a moment of safety; without gold the run ends',()=>{
 const g=new TurboGame(Math.random,5);g.start();g.gold=10;g.hurt('test');assert.equal(g.status,'playing');assert.equal(g.gold,0);assert.equal(g.scatter.length,10);assert.ok(g.invuln>0);
 g.hurt('again');assert.equal(g.status,'playing','invulnerable');g.invuln=0;g.hurt('broke');assert.equal(g.status,'over');
});
test('Turbo runs pause and resume exactly, and corrupt saves are refused',()=>{
 const g=createQuickGame('turbo',77);g.start();play(g,25);g.pause();const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'turbo'))),h=restoreQuick(snap);
 assert.ok(h);g.start();h.start();for(let i=0;i<600;i++){pilot(g);pilot(h);g.tick(1/120);h.tick(1/120);}
 assert.equal(h.x,g.x);assert.equal(h.score,g.score);assert.equal(h.status,g.status);
 for(const patch of [{vx:999},{score:snap.score+1},{collected:['<x>']},{gold:-1},{loop:{cx:1,phi:9,v0:10}}])assert.equal(restoreQuick({...snap,...patch}),null,JSON.stringify(patch));
});
test('Held jumps go higher, the turbo meter is fed by gold and tricks, and tricks chain into combos',()=>{
 const g=new TurboGame(Math.random,5);g.start();g.tick(.01);
 assert.ok(g.press('up',true));assert.equal(g.vy,TURBO.jump);g.press('up',false);assert.equal(g.vy,TURBO.shortHop,'letting go early cuts the jump');
 const h=new TurboGame(Math.random,5);h.start();h.tick(.01);h.press('up',true);for(let i=0;i<10;i++)h.tick(1/60);assert.ok(h.vy>TURBO.shortHop,'held, the jump keeps its lift');
 const b=new TurboGame(Math.random,5);b.start();assert.equal(b.turbo,.5);assert.ok(b.move('right'));assert.ok(b.turbo<.2);assert.equal(b.move('right'),false,'the meter is spent');b.fuel(.3);assert.ok(b.move('right'),'refilled by gold and tricks');assert.equal(b.boostCooldown>0,true);
 const c=new TurboGame(Math.random,5);c.start();c.trick('bot');c.trick('bot');c.trick('loop');assert.equal(c.combo,3);assert.equal(c.bonus,TRICKS.bot+TRICKS.bot*2+TRICKS.loop*3);assert.ok(c.events.some(e=>e.type==='combo'&&e.n===3));
 c.tick(TURBO.comboWindow+.1);assert.equal(c.combo,0);assert.ok(c.events.some(e=>e.type==='combobreak'));
 const ringed=[];for(let k=0;k<40;k++){const ch=turboChunk(5,k);for(const r of ch.rings){ringed.push(r);const gy=groundAt(5,r.x);assert.ok(gy===null||r.y>gy+1.5,'rings hang well above the track');}}assert.ok(ringed.length>3,'the course has rings');
});
