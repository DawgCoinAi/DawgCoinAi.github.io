// Rules added with the maze rebuild: chains, cornering, rival habits, campaign twists,
// Rush's clock economy and the Daily's modifiers. Engines are seeded, so every case is exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MazeGame,DIRS,MAZE_THEMES,TWIST_INFO,RIVALS,twistsFor,SHUTTER_PERIOD,SHUTTER_OPEN} from '../dist/engine.js';
import {seededRandom,dailyChallenge} from '../dist/mobile-core.js';
import {snapshotMaze,restoreMaze} from '../dist/checkpoint.js';

const still=g=>g.ghosts.forEach(e=>e.cooldown=100000);
const steps=(g,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)g.tick(1/60);};
const seeded=(mode,seed,level=1,extra={})=>{const g=new MazeGame(mode,seededRandom(seed),{worldSeed:seed,startLevel:level,...extra});return g;};
const put=(a,x,y,dir=a.dir)=>Object.assign(a,{x,y,tx:x,ty:y,progress:0,moving:false,dir});
const key=(x,y)=>x+','+y;
// Every tile the DAWG can reach by legal moves, honouring one-way gates (shutters as they are now).
function reach(g,from=[10,15]){const seen=new Set([key(...from)]),q=[from];for(let i=0;i<q.length;i++){const[x,y]=q[i];for(const d of g.options({x,y})){const a=x+DIRS[d][0],b=y+DIRS[d][1],k=key(a,b);if(!seen.has(k)){seen.add(k);q.push([a,b]);}}}return seen;}

test('The campaign introduces one twist per district, then stacks them, with a boss every fifth level',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(l=>twistsFor('classic',l)),[[],['portals'],['gates'],['dark'],['boss'],['shutters']]);
 for(let l=7;l<=30;l++){const t=twistsFor('classic',l);assert.ok(t.length>=2,`level ${l} stacks twists`);assert.equal(t.includes('boss'),l%5===0);assert.equal(new Set(t).size,t.length);for(const k of t)assert.ok(TWIST_INFO[k]);}
 assert.deepEqual(twistsFor('rush',4),[]);assert.deepEqual(twistsFor('daily',1,'fog'),['dark']);assert.deepEqual(twistsFor('daily',1,'treasure'),['treasure']);assert.deepEqual(twistsFor('daily',1,'nope'),[]);
 const g=seeded('classic',77);assert.deepEqual([1,2,3,4,5].map(l=>{g.level=l;return g.district.theme;}),['market','arcade','docks','garden','market']);
 assert.equal(MAZE_THEMES.length,4);assert.equal(RIVALS.length,4);
});
test('Twist furniture is seeded: the same seed builds the same gates, tunnels, shutters and chests',()=>{
 for(const level of [2,3,6,9]){const a=seeded('classic',4242,level),b=seeded('classic',4242,level),c=seeded('classic',4243,level);
  assert.deepEqual([...a.gates],[...b.gates]);assert.deepEqual([...a.portals],[...b.portals]);assert.deepEqual(a.shutters,b.shutters);
  assert.notDeepEqual([[...a.gates],[...a.portals],a.shutters],[[...c.gates],[...c.portals],c.shutters]);}
 const d=seeded('daily',99,1,{twist:'treasure'});assert.equal(d.chests.length,5);assert.deepEqual(d.chests,seeded('daily',99,1,{twist:'treasure'}).chests);
});
test('One-way gates never cut the maze off: every coin stays reachable on 60 seeds, and gates refuse the wrong way',()=>{
 let gates=0;
 for(let seed=1;seed<=60;seed++){const g=seeded('classic',seed*7919,3);gates+=g.gates.size;const seen=reach(g);for(const k of g.pellets.keys())assert.ok(seen.has(k),`seed ${seed}: ${k}`);
  // And the way home: the spawn is reachable from every corner.
  for(const c of [[1,1],[19,1],[19,21],[1,21]])assert.ok(reach(g,c).has('10,15'),`seed ${seed}: back from ${c}`);
  for(const [k,dir] of g.gates){const[x,y]=k.split(',').map(Number),[dx,dy]=DIRS[dir];assert.ok(!g.wall(x,y));
   assert.ok(g.options({x:x-dx,y:y-dy}).includes(dir),'enter with the arrow');assert.ok(!g.options({x:x+dx,y:y+dy}).some(d=>DIRS[d][0]===-dx&&DIRS[d][1]===-dy),'never against it');}}
 assert.ok(gates>=120,'most levels get several gates');
});
test('Reversing mid-step cannot back the DAWG through a one-way gate',()=>{
 const g=seeded('classic',5150,3),[k,dir]=[...g.gates][0],[x,y]=k.split(',').map(Number),[dx,dy]=DIRS[dir],back={up:'down',down:'up',left:'right',right:'left'}[dir];
 g.start();still(g);Object.assign(g.player,{x,y,tx:x+dx,ty:y+dy,moving:true,progress:.4,dir});g.direction(back);
 assert.equal(g.player.dir,dir);assert.deepEqual([g.player.x,g.player.y],[x,y]);
});
test('Teleport tunnels carry the DAWG to the twin tile, collect both coins, and rivals never use them',()=>{
 const g=seeded('classic',31337,2);assert.equal(g.portals.size,4);const[[k,exit]]=[...g.portals],[x,y]=k.split(',').map(Number);
 assert.deepEqual(g.portals.get(key(exit.x,exit.y)),{x,y,pair:exit.pair});assert.ok(Math.abs(exit.x-x)+Math.abs(exit.y-y)>=9,'twins are far apart');
 g.start();still(g);const from=g.options({x,y})[0],[dx,dy]=DIRS[from];put(g.player,x+dx,y+dy);const back={up:'down',down:'up',left:'right',right:'left'}[from];g.events=[];
 g.move(g.player,1,()=>back,()=>g.arrive());
 assert.deepEqual([g.player.x,g.player.y],[exit.x,exit.y]);assert.ok(g.events.some(e=>e.type==='teleport'));assert.ok(!g.pellets.has(k));assert.ok(!g.pellets.has(key(exit.x,exit.y)));
 const r=g.ghosts[0];put(r,x+dx,y+dy,back);r.cooldown=0;g.move(r,1,()=>back);assert.deepEqual([r.x,r.y],[x,y],'a rival just walks across');
});
test('Shutter doors open and close on a timer, are walls while shut, and never close on anyone',()=>{
 const g=seeded('classic',2024,6);assert.ok(g.shutters.length>=3);const s=g.shutters[0];g.start();still(g);put(g.player,10,15);g.wanted='up';
 assert.ok(g.wall(s.x,s.y),'shut before the clock starts');g.tick(1/60);assert.ok(!g.wall(s.x,s.y),'open during the open window');
 for(const k of g.pellets.keys())assert.ok(!g.shutterIndex.has(k),'no coins inside a doorway');
 steps(g,SHUTTER_OPEN);assert.ok(g.wall(s.x,s.y),'shut again');steps(g,SHUTTER_PERIOD-SHUTTER_OPEN);assert.ok(!g.wall(s.x,s.y));
 // Park a rival in the doorway: that shutter waits, the others close.
 const r=g.ghosts[1];put(r,s.x,s.y);steps(g,SHUTTER_OPEN);assert.ok(!g.wall(s.x,s.y),'held open for the rival');assert.ok(g.wall(g.shutters[1].x,g.shutters[1].y));
 put(r,10,9);g.tick(1/60);assert.ok(g.wall(s.x,s.y),'closes once the doorway is clear');
 assert.ok(g.events.some(e=>e.type==='shutter'&&e.open)&&g.events.some(e=>e.type==='shutter'&&!e.open));
});
test('In a blackout rivals lose the DAWG beyond seven tiles and hunt again up close',()=>{
 const g=seeded('classic',808,4);assert.ok(g.dark);g.start();const r=g.ghosts[0];r.cooldown=0;put(g.player,1,1);put(r,19,21);g.ghostDirection(r);assert.equal(r.mood,'lost');
 put(r,3,1);g.ghostDirection(r);assert.equal(r.mood,'stalk');assert.deepEqual(r.aim,{x:1,y:1});
 assert.ok(!seeded('classic',808,1).dark);
});
test('Each rival has its own habit: stalk, ambush ahead, patrol a loop, panic up close',()=>{
 const g=new MazeGame('classic',()=>.9);g.start();const[shade,pounce,beat,jitters]=g.ghosts;put(g.player,10,15,'left');
 put(shade,19,1);g.ghostDirection(shade);assert.equal(shade.mood,'stalk');assert.deepEqual(shade.aim,{x:10,y:15});
 put(pounce,19,1);g.ghostDirection(pounce);assert.equal(pounce.mood,'ambush');assert.deepEqual(pounce.aim,{x:6,y:15},'four tiles ahead of the DAWG');
 put(beat,17,1);beat.wp=1;g.ghostDirection(beat);assert.equal(beat.mood,'patrol');assert.deepEqual(beat.aim,{x:19,y:1});
 put(beat,19,2);g.ghostDirection(beat);assert.equal(beat.wp,2,'reaching a corner moves on to the next');
 put(beat,10,11);g.ghostDirection(beat);assert.equal(beat.mood,'alert','spots the DAWG within five tiles');
 put(jitters,1,1);g.ghostDirection(jitters);assert.equal(jitters.mood,'charge');
 put(jitters,10,13);g.ghostDirection(jitters);assert.equal(jitters.mood,'panic');assert.notDeepEqual(jitters.aim,{x:10,y:15});
 assert.ok(g.rivalPace(jitters,0)>g.rivalPace(shade,0),'a panicking rival bolts');put(beat,17,1);beat.mood='patrol';assert.ok(g.rivalPace(beat,0)<g.rivalPace(shade,0),'a patrol strolls');
 g.power=5;g.ghostDirection(shade);assert.equal(shade.mood,'scared');
});
test('Eating without a gap builds a chain that pays every tenth coin and breaks after 1.6 quiet seconds',()=>{
 const g=new MazeGame();g.start();still(g);const spots=[...g.pellets].filter(([,v])=>v==='.').map(([k])=>k.split(',').map(Number));
 for(let i=0;i<9;i++){put(g.player,...spots[i]);g.collect();}assert.equal(g.chain,9);assert.equal(g.score,90);
 g.events=[];put(g.player,...spots[9]);g.collect();assert.equal(g.score,120,'the tenth coin pays 10 plus a 20 chain bonus');assert.deepEqual(g.events.find(e=>e.type==='chain'),{type:'chain',chain:10,bonus:20,x:spots[9][0],y:spots[9][1]});
 assert.equal(g.events.find(e=>e.type==='pellet').chain,10);g.options=()=>[];
 steps(g,1.5);assert.equal(g.chain,10);steps(g,.2);assert.equal(g.chain,0);assert.ok(g.events.some(e=>e.type==='chainEnd'&&e.chain===10));assert.equal(g.bestChain,10);
});
test('A clean buffered turn at a corner earns a short burst of speed',()=>{
 const run=turn=>{const g=new MazeGame();g.start();still(g);put(g.player,5,15,'left');g.wanted='left';let boosted=false;for(let i=0;i<40;i++){if(turn&&i===2)g.direction('up');g.tick(1/60);boosted||=g.corner>0;}return {boosted,g};};
 const a=run(true),b=run(false);assert.ok(a.boosted,'turning up at the next junction triggers the burst');assert.ok(!b.boosted,'running straight does not');assert.equal(a.g.player.dir,'up');
});
test('A rival that closes within a tile and then loses the DAWG pays a close-call bonus, on a cooldown',()=>{
 const g=new MazeGame();g.start();g.invincible=0;still(g);put(g.player,5,15);g.wanted='down';const r=g.ghosts[0];r.cooldown=1e5;
 put(r,6,15);r.cooldown=0;g.ghostDirection=()=>null;g.tick(1/60);assert.ok(r.close);assert.equal(g.score,0);
 put(r,9,15);g.events=[];g.tick(1/60);assert.equal(g.score,50);assert.ok(g.events.some(e=>e.type==='escape'));
 put(r,6,15);g.tick(1/60);put(r,9,15);g.tick(1/60);assert.equal(g.score,50,'no second payout inside the cooldown');
});
test('The boss shrugs off tackles, takes three beast-mode catches, then stays down for the level',()=>{
 const g=seeded('classic',606,5);g.start();const boss=g.ghosts[0];assert.ok(boss.boss);assert.equal(boss.hp,3);still(g);
 const meet=()=>{boss.cooldown=0;put(boss,g.player.x,g.player.y);};
 g.invincible=0;g.dashCooldown=0;g.dash();meet();g.events=[];g.tick(1/60);assert.ok(g.events.some(e=>e.type==='clang'));assert.equal(g.lives,3);assert.equal(boss.hp,3);assert.ok(!g.events.some(e=>e.type==='tackle'));
 for(let hp=2;hp>=0;hp--){g.power=5;g.dashTime=0;meet();g.events=[];g.tick(1/60);assert.equal(boss.hp,hp);assert.ok(g.events.some(e=>e.type==='bossHit'&&e.hp===hp));}
 assert.ok(g.events.some(e=>e.type==='bossDown'&&e.bonus===2000));assert.ok(boss.cooldown>20,'out for the count');
 g.power=0;g.invincible=0;g.ghosts[1].cooldown=0;put(g.ghosts[1],g.player.x,g.player.y);g.tick(1/60);assert.equal(g.lives,2);assert.ok(g.ghosts[0].boss&&g.ghosts[0].hp===0&&g.ghosts[0].cooldown>20,'a lost life does not revive the boss');
});
test('Rush: the multiplier climbs while moving, drops when standing, and multiplies coins',()=>{
 const g=seeded('rush',12);g.start();still(g);assert.equal(g.mult,1);
 for(let i=0;i<60*7;i++){if(!g.player.moving){const o=g.options(g.player);g.direction(o.includes(g.player.dir)?g.player.dir:o[0]);}g.tick(1/60);}
 assert.equal(g.mult,3,'two steps up after six seconds of movement');assert.ok(g.events.filter(e=>e.type==='mult').length===2);
 const spot=[...g.pellets].find(([,v])=>v==='.')[0].split(',').map(Number),before=g.score;g.chain=0;put(g.player,...spot);g.collect();assert.equal(g.score-before,30);
 g.ghostDirection=()=>null;g.options=()=>[];g.events=[];steps(g,.7);assert.equal(g.mult,1);assert.ok(g.events.some(e=>e.type==='multLost'));
});
test('Rush: chains and catches buy time, a cleared block reloads without stopping, and the last ten seconds pay double',()=>{
 const g=seeded('rush',34);g.start();still(g);g.time=40;const spots=[...g.pellets].filter(([,v])=>v==='.').map(([k])=>k.split(',').map(Number));
 for(let i=0;i<30;i++){put(g.player,...spots[i]);g.collect();}assert.equal(g.time,42);assert.ok(g.events.some(e=>e.type==='extend'&&e.why==='chain'&&e.seconds===2));
 g.power=5;const r=g.ghosts[0];r.cooldown=0;put(r,g.player.x,g.player.y);g.tick(1/60);assert.ok(Math.abs(g.time-(45-1/60))<1e-6,'a catch adds three seconds');
 g.time=89.5;g.addTime(5);assert.equal(g.time,90,'the clock is capped at 90');
 // Clear the block: Rush rolls straight into the next one.
 g.time=30;const level=g.level,score=g.score;for(const k of [...g.pellets.keys()].slice(1))g.pellets.delete(k);const last=[...g.pellets.keys()][0].split(',').map(Number);put(g.player,...last);g.events=[];g.collect();
 assert.equal(g.status,'playing');assert.equal(g.level,level+1);assert.ok(g.pellets.size>100);assert.equal(g.time,38);assert.ok(g.score>=score+500);assert.ok(g.events.some(e=>e.type==='level'&&e.auto));
 // Frenzy.
 g.time=10.01;g.events=[];g.tick(1/60);assert.ok(g.frenzy);assert.equal(g.events.filter(e=>e.type==='frenzy').length,1);g.tick(1/60);assert.equal(g.events.filter(e=>e.type==='frenzy').length,1);
 g.mult=2;g.chain=0;const coin=[...g.pellets].find(([,v])=>v==='.')[0].split(',').map(Number),before=g.score;put(g.player,...coin);g.collect();assert.equal(g.score-before,40);
 g.power=0;const cool=seeded('rush',34);cool.start();assert.ok(g.rivalPace(g.ghosts[0],.5)>cool.rivalPace(cool.ghosts[0],.5),'rivals are faster in the frenzy');
 const c=seeded('classic',34);c.start();c.addTime(5);assert.equal(c.time,60,'the campaign has no clock to extend');
});
test('Daily: one 90 second maze; clearing it ends the run with a time bonus',()=>{
 const g=seeded('daily',55);assert.equal(g.timeLimit,90);assert.equal(g.time,90);g.start();still(g);g.time=41.4;
 for(const k of [...g.pellets.keys()].slice(1))g.pellets.delete(k);const last=[...g.pellets.keys()][0].split(',').map(Number),score=g.score;put(g.player,...last);g.events=[];g.collect();
 assert.equal(g.status,'over');assert.deepEqual(g.events.find(e=>e.type==='dailyClear'),{type:'dailyClear',bonus:820,seconds:41});assert.ok(g.score>=score+10+500+820);
 const fresh=seeded('daily',55);fresh.start();fresh.time=45;assert.ok(Math.abs(fresh.heat-.5)<1e-9,'heat follows the 90 second clock');
});
test('Daily twists: mirror swaps left and right for twelve announced seconds; double fields six rivals; treasure pays a jackpot',()=>{
 const m=seeded('daily',70,1,{twist:'mirror'});m.start();still(m);steps(m,21.9);m.events=[];steps(m,.2);assert.ok(m.events.some(e=>e.type==='mirrorSoon'));assert.ok(!m.mirrored);
 m.direction('left');assert.equal(m.wanted,'left');steps(m,3);assert.ok(m.mirrored);assert.ok(m.events.some(e=>e.type==='mirrorOn'));
 m.direction('left');assert.equal(m.wanted,'right');m.direction('right');assert.equal(m.wanted,'left');m.direction('up');assert.equal(m.wanted,'up');
 steps(m,12);assert.ok(!m.mirrored);assert.ok(m.events.some(e=>e.type==='mirrorOff'));m.direction('left');assert.equal(m.wanted,'left');
 const d=seeded('daily',71,1,{twist:'double',tackleBonus:200});assert.equal(d.ghosts.length,6);assert.deepEqual(d.ghosts.map(g=>g.type),[0,1,2,3,4,5]);for(const r of d.ghosts)assert.ok(!d.wall(r.x,r.y));
 d.start();d.invincible=0;still(d);d.dash();const r=d.ghosts[5];r.cooldown=0;put(r,d.player.x,d.player.y);d.tick(1/60);assert.equal(d.score,200);assert.deepEqual([r.x,r.y],[10,5]);assert.equal(r.type,5);
 const t=seeded('daily',72,1,{twist:'treasure'});t.start();still(t);assert.equal(t.chests.length,5);const seen=reach(t);let score=0;
 for(const c of [...t.chests]){assert.ok(seen.has(key(c.x,c.y)));t.pellets.delete(key(c.x,c.y));put(t.player,c.x,c.y);t.collect();score+=300;}
 assert.equal(t.score,score+1500);assert.equal(t.chests.length,0);assert.ok(t.events.some(e=>e.type==='jackpot'));
});
test('Today\'s challenge always names a twist the engine knows, and all five come round',()=>{
 const seen=new Set();for(let d=1;d<=28;d++){const c=dailyChallenge('2026-11-'+String(d).padStart(2,'0'));assert.ok(['fog','mirror','double','treasure','rocket'].includes(c.twist));assert.ok(c.name&&c.description);seen.add(c.twist);
  const g=new MazeGame('daily',seededRandom(c.seed),{...c,worldSeed:c.seed});assert.equal(g.tackleBonus,c.tackleBonus);assert.equal(g.twists.length,c.twist==='fog'?1:1);assert.equal(g.dashRecharge,c.dashRecharge);}
 assert.equal(seen.size,5);
});
test('Checkpoints carry the new state: shutters, chests, boss health, chain and multiplier, and old saves still load',()=>{
 const g=seeded('classic',2024,6);g.start();steps(g,2);const r=restoreMaze(snapshotMaze(g));assert.ok(r);assert.deepEqual(r.game.shutterState,g.shutterState);assert.equal(r.game.twistClock,g.twistClock);assert.equal(r.game.chain,g.chain);
 for(const s of g.shutters)assert.equal(r.game.wall(s.x,s.y),g.wall(s.x,s.y));
 const b=seeded('classic',606,5);b.start();still(b);b.power=5;b.ghosts[0].cooldown=0;put(b.ghosts[0],b.player.x,b.player.y);b.tick(1/60);b.ghosts.forEach(a=>a.cooldown=Math.min(a.cooldown,20));const rb=restoreMaze(snapshotMaze(b));assert.ok(rb);assert.equal(rb.game.ghosts[0].hp,2);assert.ok(rb.game.ghosts[0].boss);assert.equal(rb.game.bossHp,2);
  const day=['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08'].map(d=>dailyChallenge(d)).find(d=>d.twist==='treasure');
 const tg=new MazeGame('daily',seededRandom(day.seed),{...day,worldSeed:day.seed});tg.start();still(tg);const chest=tg.chests[0];put(tg.player,chest.x,chest.y);tg.collect();tg.ghosts.forEach(a=>a.cooldown=20);const rt=restoreMaze(snapshotMaze(tg,day),day.day);assert.ok(rt);assert.equal(rt.game.chests.length,4);assert.equal(rt.game.time,tg.time);
 const bad=snapshotMaze(tg,day);bad.chests.push({x:1,y:1},{x:1,y:1});assert.equal(restoreMaze(bad,day.day),null);
 // A save written before the rebuild has none of the new fields.
 const old=seeded('classic',9001,2);old.start();steps(old,1);const s=snapshotMaze(old);for(const k of ['chain','chainTime','bestChain','mult','moveTime','idleTime','escapeCool','corner','twistClock','shutterState','chests','bossHp'])delete s[k];for(const a of s.ghosts){delete a.wp;delete a.mood;delete a.aim;delete a.close;}
 const ro=restoreMaze(s);assert.ok(ro);assert.equal(ro.game.chain,0);assert.equal(ro.game.portals.size,4);ro.game.start();steps(ro.game,3);assert.ok(['playing','over'].includes(ro.game.status));
 const dbl=['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10'].map(d=>dailyChallenge(d)).find(d=>d.twist==='double');
 const dg=new MazeGame('daily',seededRandom(dbl.seed),{...dbl,worldSeed:dbl.seed});dg.start();steps(dg,2);const rd=restoreMaze(snapshotMaze(dg,dbl),dbl.day);assert.ok(rd);assert.equal(rd.game.ghosts.length,6);
 const short=snapshotMaze(dg,dbl);short.ghosts.length=4;assert.equal(restoreMaze(short,dbl.day),null);
});
test('A seeded run is deterministic through every twist: same inputs, same score and positions',()=>{
 const run=()=>{const g=seeded('classic',123456,7);g.start();const inputs=['up','left','down','right'];for(let i=0;i<60*12&&g.status==='playing';i++){if(i%37===0)g.direction(inputs[(i/37)%4]);if(i===200)g.dash();g.tick(1/60);}return JSON.stringify([g.score,g.player,g.ghosts,g.shutterState,g.lives,[...g.pellets].length]);};
 assert.equal(run(),run());
});
test('Street level plays slower, so the view bonus scales coins and chains but never catches or the clock',()=>{
 const run=bonus=>{const g=seeded('rush',34);g.start();still(g);g.viewBonus=bonus;const spots=[...g.pellets].filter(([,v])=>v==='.').map(([k])=>k.split(',').map(Number));for(let i=0;i<10;i++){put(g.player,...spots[i]);g.collect();}return g;};
 const flat=run(1),street=run(1.8);assert.equal(flat.score,120);assert.equal(street.score,216);assert.equal(street.time,flat.time);
 street.power=5;const r=street.ghosts[0];r.cooldown=0;put(r,street.player.x,street.player.y);street.tick(1/60);assert.equal(street.score,416,'a catch pays the same in every view');
 assert.equal(new MazeGame().viewBonus,1);const s=snapshotMaze(street);assert.equal(s.viewBonus,undefined,'the bonus is set by the view each frame, not saved');
});
test('Feats: at least eight per mode, stable ids, and every one can be earned exactly once per run',async()=>{
 const {FEATS,FEAT_IDS,RUN_KEYS,stageFor}=await import('../dist/engine.js');
 assert.equal(new Set(FEAT_IDS).size,FEAT_IDS.length);for(const m of ['classic','rush','daily'])assert.ok(FEATS.filter(f=>f.mode===m).length>=8,m);
 for(const f of FEATS){assert.match(f.id,/^(classic|rush|daily)\.[a-z0-9]+$/);assert.ok(f.name&&f.text);}
 // The state that earns each feat, set the way play would leave it.
 const earn={'classic.clean':g=>g.run.cleanClears=1,'classic.chain30':g=>g.bestChain=30,'classic.sweep':g=>g.run.sweep=4,'classic.tackle3':g=>g.run.tackles=3,'classic.close5':g=>g.run.escapes=5,'classic.tunnels':g=>g.run.teleports=5,'classic.bags':g=>g.run.levelLoot=2,'classic.docks':g=>g.level=3,'classic.warden':g=>g.run.bosses=1,'classic.stage6':g=>g.level=6,
  'rush.x5':g=>g.mult=5,'rush.chain40':g=>g.bestChain=40,'rush.clear':g=>g.stats.clears=1,'rush.overtime':g=>g.run.extended=10,'rush.frenzy':g=>g.run.frenzyScore=500,'rush.clean':g=>{g.status='over';g.stats.dots=60;},'rush.hunter':g=>g.stats.caught=4,'rush.tackle3':g=>g.run.tackles=3,'rush.3k':g=>g.score=3000,'rush.6k':g=>g.score=6000,
  'daily.clear':g=>g.run.dailyClear=1,'daily.fast':g=>{g.run.dailyClear=1;g.time=20;},'daily.clean':g=>{g.status='over';g.stats.dots=60;},'daily.chain30':g=>g.bestChain=30,'daily.twist':g=>{g.dailyTwist='treasure';g.run.jackpot=1;},'daily.close3':g=>g.run.escapes=3,'daily.bag':g=>g.stats.loot=1,'daily.hunter':g=>g.stats.caught=3,'daily.2k':g=>g.score=2000,'daily.4k':g=>g.score=4000};
 for(const f of FEATS){const g=seeded(f.mode,17);g.start();g.time=5;g.checkFeats();assert.ok(!g.feats.includes(f.id),f.id+' is not free');assert.ok(earn[f.id],f.id+' has a path');earn[f.id](g);g.events=[];g.checkFeats();assert.ok(g.feats.includes(f.id),f.id);assert.equal(g.events.filter(e=>e.type==='feat'&&e.id===f.id).length,1);g.checkFeats();assert.equal(g.feats.filter(x=>x===f.id).length,1);}
 for(const [twist,set] of [['fog',g=>g.stats.caught=1],['mirror',g=>g.run.mirrorDone=1],['double',g=>g.run.tackles=3],['rocket',g=>g.run.tackles=4]]){const g=seeded('daily',17,1,{twist});g.start();g.checkFeats();assert.ok(!g.feats.includes('daily.twist'));set(g);g.checkFeats();assert.ok(g.feats.includes('daily.twist'),twist);}
 assert.equal(RUN_KEYS.length,new Set(RUN_KEYS).size);
 // The ladder names every stage and what it adds.
 assert.deepEqual(stageFor(1),{level:1,name:'Opening Night',district:'Night Market',theme:'market',twists:[]});assert.equal(stageFor(5).name,'The Warden');assert.deepEqual(stageFor(5).twists,['boss']);assert.equal(stageFor(3).district,'Harbour Docks');assert.notEqual(stageFor(13).name,stageFor(1).name);
});
test('Feats are earned through real play and survive a checkpoint; bad feat lists are refused',()=>{
 const g=seeded('classic',31337,2);g.start();still(g);const tiles=[...g.portals.keys()].map(k=>k.split(',').map(Number));
 for(let i=0;i<5;i++){const [x,y]=tiles[i%tiles.length],from=g.options({x,y})[0],[dx,dy]=DIRS[from],back={up:'down',down:'up',left:'right',right:'left'}[from];put(g.player,x+dx,y+dy);g.move(g.player,1,()=>back,()=>g.arrive());}
 g.invincible=0;for(let i=0;i<3;i++){g.dashCooldown=0;g.dash();const r=g.ghosts[i];r.cooldown=0;put(r,g.player.x,g.player.y);g.tick(1/60);r.cooldown=20;}
 assert.ok(g.feats.includes('classic.tunnels'));assert.ok(g.feats.includes('classic.tackle3'));g.ghosts.forEach(a=>a.cooldown=Math.min(a.cooldown,20));
 const s=snapshotMaze(g),r=restoreMaze(s);assert.ok(r);assert.deepEqual(r.game.feats,g.feats);assert.deepEqual(r.game.run,g.run);r.game.events=[];r.game.start();r.game.tick(1/60);assert.equal(r.game.events.filter(e=>e.type==='feat').length,0,'restored feats are not announced again');
 for(const bad of [['nope'],['classic.tunnels','classic.tunnels'],['rush.x5'],'classic.tunnels'])assert.equal(restoreMaze({...s,feats:bad}),null);
 assert.equal(restoreMaze({...s,run:{tackles:-1}}),null);assert.equal(restoreMaze({...s,run:{hax:1}}),null);
 const old={...s};delete old.feats;delete old.run;const ro=restoreMaze(old);assert.ok(ro);assert.deepEqual(ro.game.feats,[]);
 // A clean district and a clean daily clear through the real clear path.
 const c=seeded('classic',9);c.start();still(c);for(const k of [...c.pellets.keys()].slice(1))c.pellets.delete(k);put(c.player,...[...c.pellets.keys()][0].split(',').map(Number));c.collect();assert.ok(c.feats.includes('classic.clean'));
 const d=seeded('daily',9);d.start();still(d);d.time=40;for(const k of [...d.pellets.keys()].slice(1))d.pellets.delete(k);put(d.player,...[...d.pellets.keys()][0].split(',').map(Number));d.events=[];d.collect();assert.ok(d.feats.includes('daily.clear')&&d.feats.includes('daily.fast'));assert.ok(d.events.findIndex(e=>e.type==='feat')<d.events.findIndex(e=>e.type==='over'),'feats land before the run ends');
});
