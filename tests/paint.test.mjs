import test from 'node:test';
import assert from 'node:assert/strict';
import {PaintGame,PAINT,STAGES,TIERS,stageAt,tierOf,paintCity,CREWS,PERSONA,LANDMARKS,FEATS,LEAGUES,leagueFor,TWISTS,DAILY_TWIST,validPaintSnapshot,PAINT_FIELDS,resumePaint} from '../dist/paint-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

const TPS=PAINT.tps;
const fresh=seed=>{const g=new PaintGame(seededRandom(seed),seed);g.start();return g;};
// A match with every rival benched (popped and never respawning), so one rule can be checked alone.
const solo=seed=>{const g=fresh(seed);for(const p of g.players.slice(1)){p.alive=false;p.respawnAt=1e9;}return g;};
// Strings steer then move you one cell; numbers move you that many cells.
const walk=(g,...moves)=>{for(const m of moves){if(typeof m==='string'){g.move(m);g.advance(g.you);}else for(let i=0;i<m;i++)g.advance(g.you);}};
const own=(g,k)=>g.owner.filter(o=>o===k).length;
// Puts a crew mid-trail: the trail runs through the given cells and the crew stands on the last one.
const lay=(g,p,cells,dir)=>{p.alive=true;p.respawnAt=1e9;p.trail=cells.map(([x,y])=>g.idx(x,y));for(const i of p.trail)g.trail[i]=p.k;[p.x,p.y]=cells.at(-1);p.px=p.x;p.py=p.y;p.dir=dir;};
const state=g=>JSON.stringify({o:g.owner,p:g.players.map(p=>[p.x,p.y,p.dir,p.alive,p.trail,p.cells,p.cuts,p.captures,p.pts,p.shield,p.dash,p.cool,p.prog]),u:g.pickups,s:g.score,t:g.steps,ph:g.phase});
const snapOf=g=>{const s={version:1,kind:'paint',worldSeed:g.worldSeed,score:g.score,time:g.time,randomState:g.random.getState()};for(const k of PAINT_FIELDS)s[k]=JSON.parse(JSON.stringify(g[k]));return s;};
// A trail from the home block's top edge up, across and back down its right side, one step (left) short of closing: 13 trail cells round 7 more.
const boxTrail=h=>[[h.x,h.y-2],[h.x,h.y-3],[h.x,h.y-4],[h.x,h.y-5],[h.x+1,h.y-5],[h.x+2,h.y-5],[h.x+3,h.y-5],[h.x+3,h.y-4],[h.x+3,h.y-3],[h.x+3,h.y-2],[h.x+3,h.y-1],[h.x+3,h.y],[h.x+2,h.y]];
// A trail all the way round a block, starting beside a patch of your paint at its top-left corner.
const ringTrail=(g,b)=>{const sx=b.x-1,sy=b.y-1,ring=[];g.owner[g.idx(sx,sy)]=0;g.recount();for(let x=sx+1;x<=b.x+b.w;x++)ring.push([x,sy]);for(let y=sy+1;y<=b.y+b.h;y++)ring.push([b.x+b.w,y]);for(let x=b.x+b.w-1;x>=sx;x--)ring.push([x,b.y+b.h]);for(let y=b.y+b.h-1;y>sy+1;y--)ring.push([sx,y]);return ring;};

test('The city comes from the seed: 30×37, districts with streets on every side, three landmarks, 3–4 rival crews',()=>{
 for(const seed of [0,1,2,3,42,999,123456]){const c=paintCity(seed);assert.equal(c.W,30);assert.equal(c.H,37);assert.ok(c.rivals>=3&&c.rivals<=4);assert.equal(c.homes.length,c.rivals+1);assert.ok(c.blocks.length>=10,'a city of blocks');
  assert.deepEqual(c.blocks.filter(b=>b.landmark).map(b=>b.kind).sort(),[...LANDMARKS].sort());
  for(const h of c.homes)for(let y=h.y-3;y<=h.y+3;y++)for(let x=h.x-3;x<=h.x+3;x++)assert.ok(!c.walls[y*c.W+x],'home plaza '+seed+' is open');
  // Every block has open street all the way round it, so it can be circled; and the ring road is clear.
  for(const b of c.blocks){for(let x=b.x-1;x<=b.x+b.w;x++)for(const y of [b.y-1,b.y+b.h])assert.ok(!c.walls[y*c.W+x]);for(let y=b.y-1;y<=b.y+b.h;y++)for(const x of [b.x-1,b.x+b.w])assert.ok(!c.walls[y*c.W+x]);
   for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){assert.equal(c.block[y*c.W+x],b.id);assert.equal(c.weight[y*c.W+x],b.landmark?PAINT.landmarkWeight:1);}}
  for(let x=0;x<c.W;x++)assert.ok(!c.walls[x]&&!c.walls[(c.H-1)*c.W+x]);
  assert.equal(c.total,c.W*c.H+3*9*(PAINT.landmarkWeight-1));assert.deepEqual(paintCity(seed).walls,c.walls);}
 assert.notDeepEqual(paintCity(1).walls,paintCity(2).walls);
 const g=fresh(7);assert.equal(g.players.length,g.city.rivals+1);assert.ok(g.players.slice(1).every(p=>CREWS.some(c=>c.name===p.name&&PERSONA[p.ai])));assert.equal(new Set(g.players.map(p=>p.color)).size,g.players.length);assert.ok(g.players.every(p=>p.cells===9));assert.equal(g.score,0);
});

test('Same seed and inputs, same match; a different seed is a different match',()=>{
 const play=seed=>{const g=fresh(seed);const script=['up','up','left','dash','left','down','down','right'];for(let i=0;i<PAINT.seconds*60/2;i++){if(i%23===0)g.move(script[(i/23|0)%script.length]);g.tick(1/60);}return state(g);};
 assert.equal(play(11),play(11));assert.notEqual(play(11),play(12));
});

test('Leaving your paint lays a trail; coming back floods the loop, concave shapes included',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0];you.dir='up';
 walk(g,2);assert.equal(you.trail.length,1,'the first cell outside the paint starts the trail');assert.equal(g.trail[g.idx(you.x,you.y)],0);
 // Up to 4 above the home, right 3, down 3, then left back onto the block: a 4×4 box above and beside the home.
 walk(g,'up','up','right',2,'down',2,'left','left');assert.equal(you.trail.length,0,'back on your own paint: loop closed');assert.equal(g.trail.filter(t=>t>=0).length,0);
 for(let y=h.y-4;y<=h.y-1;y++)for(let x=h.x;x<=h.x+3;x++)assert.equal(g.owner[g.idx(x,y)],0,'cell '+x+','+y+' claimed');assert.equal(own(g,0),9+14);
 const claim=g.events.find(e=>e.type==='claim');assert.equal(claim.area,14);assert.equal(claim.gained.length,14);assert.equal(claim.pts,14*PAINT.loopPts);assert.equal(g.score,140);assert.equal(you.loops,1);
 // A concave loop: left 2, up 3, right 5, then a staircase (down, left, down, left) back onto the paint, leaving a notch.
 const c=solo(3),cy=c.you,ch=c.city.homes[0];cy.dir='left';walk(c,2,'up',2,'right',4,'down','left','down','left');
 assert.equal(cy.trail.length,0,'loop closed');for(let y=ch.y-3;y<=ch.y-1;y++)for(let x=ch.x-2;x<=ch.x+2;x++)assert.equal(c.owner[c.idx(x,y)],0,'concave fill '+x+','+y);assert.equal(c.owner[c.idx(ch.x+3,ch.y-3)],0);
 assert.equal(c.owner[c.idx(ch.x+3,ch.y-2)],0,'the staircase step is trail, so painted');assert.equal(c.owner[c.idx(ch.x+3,ch.y-1)],-1,'the notch stays unpainted');assert.equal(own(c,0),9+15,'the box, the step cell and the first trail cell beside the home: no leak');
});

test('Circling a building floods it too; a landmark weighs four a cell and pays a bonus',()=>{
 const g=solo(3),you=g.you,W=g.city.W,b=g.city.blocks.find(b=>!b.landmark),ring=ringTrail(g,b);
 lay(g,you,ring,'up');const before=you.cells;g.events=[];walk(g,2);
 assert.equal(you.trail.length,0);for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)assert.equal(g.owner[y*W+x],0,'building cell '+x+','+y);assert.equal(g.blockOwner(b),0);
 const e=g.events.find(e=>e.type==='claim');assert.deepEqual(e.blocks,[b.id]);assert.deepEqual(e.landmarks,[]);assert.equal(you.cells-before,ring.length+1+b.w*b.h,'the ring and the whole footprint');assert.equal(e.area,you.cells-before);
 assert.equal(e.tier,tierOf(e.area));assert.equal(e.pts,Math.round(e.area*PAINT.loopPts*TIERS[e.tier].mult));
 // The same round a landmark: 9 cells that weigh 36, and 400 on top.
 const s=solo(3),m=s.city.blocks.find(b=>b.landmark),sy=s.you,r2=ringTrail(s,m);
 lay(s,sy,r2,'up');const b4=sy.cells;s.events=[];walk(s,2);const c=s.events.find(e=>e.type==='claim');
 assert.deepEqual(c.landmarks,[m.id]);assert.equal(sy.cells-b4,r2.length+1+9*PAINT.landmarkWeight);assert.equal(c.pts,Math.round(c.area*PAINT.loopPts*TIERS[tierOf(c.area)].mult)+PAINT.landmarkPts);
 assert.ok(Math.abs(s.shares()[0]-sy.cells/s.city.total)<1e-12);
});

test('Enclosing rival paint repaints it; a rival caught on newly enclosed ground mid-trail is captured, one on your old paint is not',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0],r=g.players[1];
 // Rival paint, and the rival itself mid-trail, inside the box above your home.
 const pocket=[[h.x+1,h.y-4],[h.x+2,h.y-4]];for(const [x,y] of pocket)g.owner[g.idx(x,y)]=1;g.recount();lay(g,r,[[h.x+2,h.y-3],[h.x+1,h.y-3]],'up');
 lay(g,you,boxTrail(h),'left');const rivalCells=own(g,1);g.events=[];walk(g,1);
 assert.equal(you.trail.length,0);for(const [x,y] of pocket)assert.equal(g.owner[g.idx(x,y)],0,'rival paint repainted');assert.ok(own(g,1)<rivalCells);
 assert.equal(r.alive,false,'the rival inside was popped');assert.equal(you.captures,1);assert.equal(r.trail.length,0);
 const c=g.events.find(e=>e.type==='claim');assert.equal(c.captured,1);assert.equal(c.taken,2);assert.equal(c.close,true,'a rival two cells from your trail: a close call, worth half as much again');assert.equal(c.pts,Math.round(c.area*PAINT.loopPts*TIERS[c.tier].mult*1.5)+PAINT.capturePts);assert.ok(g.events.some(e=>e.type==='capture'&&e.victim===1&&e.you));assert.ok(g.freeze>0,'a capture is a hit-stop moment');
 // A rival sitting safely in its own paint inside the loop is repainted, not captured.
 const s=solo(5),sy=s.you,sh=s.city.homes[0],sr=s.players[1];sr.alive=true;sr.respawnAt=1e9;sr.x=sr.px=sh.x+2;sr.y=sr.py=sh.y-3;for(let x=sh.x+1;x<=sh.x+2;x++)s.owner[s.idx(x,sh.y-3)]=1;s.recount();
 lay(s,sy,boxTrail(sh),'left');walk(s,1);assert.equal(sy.trail.length,0);assert.equal(s.owner[s.idx(sh.x+2,sh.y-3)],0);assert.equal(sr.alive,true);assert.equal(sy.captures,0);
 // A rival trailing across paint you already own is not captured by a loop closed somewhere else.
 const t=solo(5),ty=t.you,th=t.city.homes[0],tr=t.players[1];lay(t,tr,[[th.x-1,th.y+2],[th.x-1,th.y+1],[th.x-1,th.y]],'up');lay(t,ty,boxTrail(th),'left');walk(t,1);
 assert.equal(ty.trail.length,0);assert.equal(tr.alive,true,'still standing on your home block');assert.equal(ty.captures,0);
});

test('Crossing an open trail cuts it: the owner pops and respawns at home, the cutter scores and its paint splashes out',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0],r=g.players[1];
 // The rival's trail runs along the row four above your home; you walk straight up into it.
 lay(g,r,Array.from({length:7},(_,i)=>[h.x-3+i,h.y-4]),'right');you.dir='up';g.events=[];walk(g,4);
 assert.equal(r.alive,false);assert.equal(r.trail.length,0);assert.ok(g.trail.every(t=>t!==1));assert.equal(you.cuts,1);assert.equal(r.pops,1);
 const cut=g.events.find(e=>e.type==='cut');assert.ok(cut.you&&cut.victim===1&&cut.trail.length===7,'the cut carries the trail that dissolved');
 const sp=g.events.find(e=>e.type==='splash');assert.equal(sp.why,'cut');assert.ok(sp.cells.length>=9);for(const [dx,dy] of [[0,0],[2,0],[-2,0],[0,-2],[1,1],[-1,-1]])assert.equal(g.owner[g.idx(h.x+dx,h.y-4+dy)],0,'splash '+dx+','+dy);assert.equal(g.owner[g.idx(h.x+2,h.y-6)],-1,'outside the splash');
 assert.equal(you.trail.length,0,'standing in your own splash closes the loop you had out');assert.ok(g.score>=PAINT.cutPts);assert.ok(g.freeze>0);
 assert.equal(r.respawnAt,g.steps+Math.round(PAINT.respawn*TPS));
 // Two and a half seconds later the rival is back on its home cell with its 3×3.
 you.alive=false;you.respawnAt=1e9;g.freeze=0;g.events=[];for(let i=0;i<Math.round(PAINT.respawn*TPS);i++)g.step();assert.equal(r.alive,true);const back=g.events.find(e=>e.type==='respawn'&&e.k===1);assert.deepEqual([back.x,back.y],[g.city.homes[1].x,g.city.homes[1].y]);assert.ok(own(g,1)>=9);
 // Crossing your own trail pops you, with no points, and ends your streak.
 const s=solo(5),y=s.you;y.dir='up';y.streak=4;walk(s,4,'right','down','left');assert.equal(y.alive,false);assert.equal(y.trail.length,0);assert.equal(y.streak,0);assert.equal(s.score,0);assert.ok(s.events.some(e=>e.type==='pop'&&e.onYou));
});

test('A shield saves you from one cut: the trail turns to paint and you carry on',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0],r=g.players[1];r.shield=true;const cells=Array.from({length:7},(_,i)=>[h.x-3+i,h.y-4]);lay(g,r,cells,'right');you.dir='up';g.events=[];walk(g,4);
 assert.equal(r.alive,true);assert.equal(r.shield,false,'the shield is spent');assert.equal(r.trail.length,0);for(const [x,y] of cells)assert.equal(g.owner[g.idx(x,y)],1,'the trail became paint');assert.equal(you.cuts,0);assert.equal(you.alive,true);assert.ok(g.events.some(e=>e.type==='shield'&&e.k===1));
 assert.equal(you.trail.at(-1),g.idx(you.x,you.y));assert.ok(validPaintSnapshot(snapOf(g)));
 // The second cut lands.
 lay(g,r,[[you.x-1,you.y-2],[you.x,you.y-2],[you.x+1,you.y-2]],'right');walk(g,2);assert.equal(r.alive,false);
 // Your own shield saves you from your own trail too.
 const s=solo(5),y=s.you;y.dir='up';y.shield=true;walk(s,4,'right','down','left');assert.equal(y.alive,true);assert.equal(y.shield,false);assert.equal(y.trail.length,0);assert.ok(own(s,0)>9);
});

test('Pickups: a paint bomb floods the streets around it (and closes your loop), a shield is held; drops are seeded and capped',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0];g.pickups.push({id:1,x:h.x,y:h.y-5,kind:'bomb'});g.pickupId=1;you.dir='up';g.events=[];walk(g,5);
 const sp=g.events.find(e=>e.type==='splash');assert.equal(sp.why,'bomb');assert.equal(g.pickups.length,0);assert.ok(g.events.some(e=>e.type==='pickup'&&e.kind==='bomb'&&e.you));
 for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=h.x+dx,y=h.y-5+dy,inside=dx*dx+dy*dy<=PAINT.bomb**2+.3;if(g.open(x,y)&&inside)assert.equal(g.owner[g.idx(x,y)],0,'bomb '+dx+','+dy);}
 assert.equal(you.trail.length,0,'the trail you had out is closed by the flood');assert.ok(g.score>=PAINT.pickupPts);assert.ok(you.cells>9+25);
 const s=solo(3),y=s.you;s.pickups.push({id:1,x:h.x,y:h.y-2,kind:'shield'});s.pickupId=1;y.dir='up';walk(s,2);assert.equal(y.shield,true);assert.equal(s.pickups.length,0);
 // Drops: first one at 8 s, never more than three on the map, always on an open street.
 const d=solo(4);d.you.alive=false;d.you.respawnAt=1e9;let drops=0;for(let i=0;i<60*TPS;i++){d.step();for(const e of d.events)if(e.type==='drop'){drops++;assert.ok(d.open(e.x,e.y));assert.ok(['bomb','shield'].includes(e.kind));if(drops===1)assert.equal(d.steps,8*TPS);}d.events=[];assert.ok(d.pickups.length<=PAINT.maxPickups);}
 assert.equal(drops,PAINT.maxPickups,'nobody is collecting, so the map fills to the cap and stops');
 // Rivals pick them up too.
 let got=0;for(const seed of [1,2]){const m=fresh(seed);m.you.alive=false;m.you.respawnAt=1e9;while(m.steps<100*TPS){m.step();got+=m.events.filter(e=>e.type==='pickup'&&e.k>0).length;m.events=[];}}assert.ok(got>3,'rivals collected '+got);
});

test('You run faster on your own paint, and a dash is a burst on a five-second cooldown',()=>{
 const cellsIn=(g,ticks)=>{const y=g.you;let n=0,at=y.x+','+y.y;for(let i=0;i<ticks;i++){g.step();const now=y.x+','+y.y;if(now!==at){n++;at=now;}}return n;};
 // On open ground: 6.2 cells a second.
 const a=solo(3);a.you.dir='left';a.owner.fill(-1);a.recount();const plain=cellsIn(a,TPS);assert.ok(Math.abs(plain-PAINT.speed)<=1,'plain '+plain);
 // On your own paint: a quarter faster.
 const b=solo(3);b.you.dir='left';for(let x=0;x<b.city.W;x++)b.owner[b.idx(x,b.you.y)]=0;b.recount();const fast=cellsIn(b,TPS);assert.ok(Math.abs(fast-PAINT.speed*PAINT.boost)<=1,'on paint '+fast);assert.ok(fast>plain);
 // Dash: a burst, then the cooldown.
 const d=solo(3);d.you.dir='left';d.owner.fill(-1);d.recount();assert.equal(d.move('dash'),true);assert.ok(d.events.some(e=>e.type==='dash'&&e.you));assert.equal(d.dash(),false,'cooling down');
 const burst=cellsIn(d,Math.round(PAINT.dashTime*TPS));assert.ok(burst>=6,'dash covered '+burst);assert.equal(d.you.dash,0);
 assert.equal(d.you.cool,PAINT.dashCool*TPS-Math.round(PAINT.dashTime*TPS),'the cooldown runs from the moment you dash');d.you.cool=1;assert.equal(d.dash(),false);d.step();assert.equal(d.dash(),true,'ready again after five seconds');
 const dead=solo(3);dead.you.alive=false;assert.equal(dead.dash(),false);
});

test('Steering: U-turns onto your trail are ignored, two turns queue, and a turn waits for its street to open',()=>{
 const g=solo(3),you=g.you;you.dir='up';assert.equal(g.move('down'),true);walk(g,1);assert.equal(you.dir,'down','inside your own paint you can turn around');you.dir='up';walk(g,3);assert.ok(you.trail.length);assert.equal(g.move('down'),false);
 assert.equal(g.move('sideways'),false);assert.equal(g.press('left',false),false);assert.equal(g.press('right',true),true);
 // Two quick turns: left, then up again.
 const q=solo(3),y=q.you;y.dir='up';q.move('left');q.move('up');const at=[y.x,y.y];walk(q,2);assert.deepEqual([y.x,y.y],[at[0]-1,at[1]-1]);assert.equal(y.dir,'up');assert.equal(y.queued,null);
 // Calling a corner early: running along a building, a turn into it waits until the wall ends.
 const far=solo(3),f=far.you,fb=far.city.blocks.find(b=>!b.landmark&&b.w>=4);f.x=f.px=fb.x+fb.w-3;f.y=f.py=fb.y-1;f.dir='right';far.move('down');walk(far,2);assert.equal(f.dir,'right','still running along the wall');assert.equal(f.queued,'down');
 walk(far,2);assert.equal(f.dir,'down','turned at the corner');assert.equal(f.x,fb.x+fb.w);assert.equal(f.y,fb.y);
});

test('A building or the edge of town slides you along it instead of stalling you with a trail out',()=>{
 const g=solo(3),you=g.you;you.x=you.px=6;you.y=you.py=1;you.dir='left';you.prev='up';let slides=0;g.events=[];for(let i=0;i<12&&!slides;i++){walk(g,1);slides+=g.events.filter(e=>e.type==='slide').length;}
 assert.ok(you.alive);assert.equal(you.x,0,'ran to the west edge');assert.equal(you.y,0);assert.equal(you.dir,'up','and turned the way it was last heading');assert.equal(slides,1);walk(g,1);assert.equal(you.dir,'right','then along the north edge');
 // Straight into a building: you slide round it.
 const w=solo(3),p=w.you,b=w.city.blocks.find(b=>!b.landmark);p.x=p.px=b.x-3;p.y=p.py=b.y+1;p.dir='right';p.prev=null;walk(w,4);assert.ok(w.open(p.x,p.y));assert.equal(p.x,b.x-1);assert.ok(p.dir==='up'||p.dir==='down');
 // Boxed in on every side but your own trail: nothing to slide to, so you hold (and bump).
 const s=solo(5),y=s.you;lay(s,y,[[0,1],[1,1],[1,0],[0,0]],'up');s.events=[];assert.equal(s.advance(y),false);assert.deepEqual([y.x,y.y],[0,0]);assert.ok(s.events.some(e=>e.type==='bump'));
 assert.equal(g.trailThreat(),Infinity,'no rivals, no threat');
});

test('Bigger loops and unbroken streaks multiply the points, and the final push pays double',()=>{
 assert.deepEqual([0,14,15,39,40,89,90,500].map(tierOf),[0,0,1,1,2,2,3,3]);for(let i=1;i<TIERS.length;i++){assert.ok(TIERS[i].min>TIERS[i-1].min);assert.ok(TIERS[i].mult>TIERS[i-1].mult);}
 const loop=(g)=>{const h=g.city.homes[0],W=g.city.W;g.owner.forEach((o,i)=>{if(o===0&&Math.max(Math.abs(i%W-h.x),Math.abs(Math.floor(i/W)-h.y))>1)g.owner[i]=-1;});g.recount();lay(g,g.you,boxTrail(h),'left');g.events=[];walk(g,1);return g.events.find(e=>e.type==='claim');};
 const g=solo(3),a=loop(g);assert.equal(a.area,20);assert.equal(a.tier,1);assert.equal(a.pts,20*PAINT.loopPts*1.5);assert.equal(a.streak,1);
 const b=loop(g);assert.equal(b.pts,Math.round(20*PAINT.loopPts*1.5*1.1),'second loop in a row: +10%');g.you.streak=30;const c=loop(g);assert.equal(c.pts,20*PAINT.loopPts*1.5*2,'the streak bonus tops out at double');
 g.you.streak=0;g.steps=PAINT.finalFrom*TPS;assert.equal(g.final,true);const d=loop(g);assert.equal(d.pts,20*PAINT.loopPts*1.5*2,'double points in the final push');
});

test('The match has a difficulty curve, an underdog boost, and stays contested without the churn',()=>{
 assert.equal(stageAt(0),0);assert.equal(stageAt(PAINT.seconds*TPS-1),STAGES.length-1);assert.equal(STAGES[0].hunt,0,'no hunting in the warm-up');assert.equal(STAGES[0].dash,false);assert.equal(STAGES.at(-1).rate,1);assert.equal(STAGES.at(-1).from,PAINT.seconds-30,'the final push is the last 30 seconds');
 for(let i=1;i<STAGES.length;i++){assert.ok(STAGES[i].from>STAGES[i-1].from);assert.ok(STAGES[i].rate>STAGES[i-1].rate);assert.ok(STAGES[i].legs>STAGES[i-1].legs);assert.ok(STAGES[i].hunt>STAGES[i-1].hunt);assert.ok(STAGES[i].drop<=STAGES[i-1].drop);}
 // A rival's pace follows the stage.
 const g=fresh(2),r=g.players[1],v=()=>g.speedOf(r)/(g.owner[g.idx(r.x,r.y)]===r.k?PAINT.boost:1);const early=v();g.steps=100*TPS;const mid=v();assert.ok(early<mid&&mid<PAINT.speed);assert.ok(Math.abs(early-PAINT.speed*STAGES[0].rate*PERSONA[r.ai].pace)<1e-9);
 // Underdog: from 40 s the crew in last place runs 15% faster and its dash recharges twice as fast.
 const u=solo(3);assert.equal(u.dog,-1,'no underdog in the opening');u.steps=PAINT.underdogFrom*TPS;u.recount();assert.equal(u.dog,u.rank().at(-1).k);assert.ok(u.dog>0);const dog=u.players[u.dog],plain=PAINT.speed*STAGES[u.stage].rate*PERSONA[dog.ai].pace*PAINT.boost;
 assert.ok(Math.abs(u.speedOf(dog)/plain-PAINT.underdogPace)<1e-9);dog.alive=true;assert.equal(u.dash(dog),true);assert.equal(dog.cool,Math.round(PAINT.dashCool*TPS/2));
 // Whole matches with you benched: the opening leaves the city mostly open, the last minute still
 // changes hands, and crews are popped a handful of times, not dozens.
 for(const seed of [1,2,3]){const m=fresh(seed);m.you.alive=false;m.you.respawnAt=1e9;let open30=0,lateSteals=0;const stages=[];
  while(m.status==='playing'){m.step();for(const e of m.events){if(e.type==='stage')stages.push(e.stage);if(e.type==='claim'&&m.steps>120*TPS)lateSteals+=e.taken;}m.events=[];if(m.steps===30*TPS&&m.phase==='play')open30=1-m.shares().reduce((a,b)=>a+b,0);
   for(const p of m.players){assert.ok(m.open(p.x,p.y),'crew '+p.name+' at '+p.x+','+p.y);}}
  assert.deepEqual(stages,[1,2,3]);assert.ok(open30>.5,'seed '+seed+': '+open30.toFixed(2)+' of the city still unpainted at 30 s');assert.ok(lateSteals>60,'seed '+seed+': '+lateSteals+' cells changed hands in the last minute');
  const pops=m.players.slice(1).map(p=>p.pops);assert.ok(Math.max(...pops)<=12&&pops.reduce((a,b)=>a+b,0)/pops.length<=7,'seed '+seed+' pops '+pops);assert.ok(m.players.slice(1).every(p=>p.loops>20),'rivals close loops');}
});

test('The whistle divides the city: held ground and your podium place pay out, then the podium, then the end',()=>{
 const g=fresh(9);g.auto=true;let over=0,whistle=null,before=0;while(g.status==='playing'){if(g.phase==='play')before=g.score;g.tick(1/60);for(const e of g.events){if(e.type==='over')over++;if(e.type==='whistle')whistle={e,score:g.score,state:state(g)};}g.events=[];}
 assert.equal(over,1);assert.equal(g.steps,PAINT.seconds*TPS);assert.equal(g.status,'over');assert.ok(whistle);const place=g.rank().indexOf(g.you)+1;assert.equal(whistle.e.place,place);
 assert.equal(whistle.e.standings.length,g.players.length);assert.deepEqual(whistle.e.standings.map(s=>s.place),g.players.map((_,i)=>i+1));assert.ok(Math.abs(whistle.e.standings.reduce((a,s)=>a+s.share,0)-g.shares().reduce((a,b)=>a+b,0))<1e-9);
 assert.equal(g.score,before+g.you.cells*PAINT.heldPts+(PAINT.placePts[place-1]||0));assert.equal(state(g),whistle.state,'nothing moves during the podium');
 assert.match(g.reason,/^\d+% of the city is yours: (1st|2nd|3rd|4th|5th) of \d crews\./);const share=+g.reason.match(/^(\d+)%/)[1];assert.equal(share,Math.round(g.you.cells/g.city.total*100));
 assert.equal(g.move('up'),false);g.tick(1);assert.equal(g.steps,PAINT.seconds*TPS,'nothing moves after the whistle');
});

test('A Paint the Town match saves mid-match and comes back exactly; bad saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('paint'));const g=createQuickGame('paint',21);g.start();for(let i=0;i<1500;i++){if(i%19===0)g.move(['up','left','down','right','dash'][(i/19|0)%5]);g.tick(1/30);}g.events=[];
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'paint')));assert.ok(validPaintSnapshot(snap));assert.ok(PAINT_FIELDS.every(k=>k in snap));
 const back=restoreQuick(snap);assert.ok(back);assert.equal(back.status,'paused');assert.equal(state(back),state(g));assert.deepEqual(back.trail,g.trail);assert.equal(back.dog,g.dog);
 back.start();for(let i=0;i<900;i++){g.tick(1/30);back.tick(1/30);}assert.equal(state(back),state(g),'the restored match continues identically');
 const wall=g.city.walls.indexOf(1),wx=wall%g.city.W,wy=Math.floor(wall/g.city.W),P=f=>({...snap,players:snap.players.map((p,k)=>k?p:f(p))});
 for(const bad of [{...snap,steps:-1},{...snap,steps:PAINT.seconds*TPS+1},{...snap,score:snap.score+1},{...snap,phase:'podium'},{...snap,phase:'party'},{...snap,freeze:99},{...snap,owner:snap.owner.map((o,i)=>i===wall?(o+2)%3-1:o)},{...snap,owner:snap.owner.slice(1)},{...snap,owner:snap.owner.map(()=>9)},{...snap,players:snap.players.slice(1)},
  P(p=>({...p,x:99})),P(p=>({...p,x:wx,y:wy,px:wx,py:wy})),P(p=>({...p,trail:[wall]})),P(p=>({...p,cells:p.cells+1})),P(p=>({...p,prog:1.5})),P(p=>({...p,dash:999})),P(p=>({...p,cool:-1})),P(p=>({...p,shield:'yes'})),P(p=>({...p,dir:'north'})),P(p=>({...p,plan:{leg:9}})),P(p=>({...p,pts:p.pts+10})),
  {...snap,pickups:[{id:1,x:wx,y:wy,kind:'bomb'}],pickupId:1},{...snap,pickups:[{id:1,x:1,y:1,kind:'nuke'}],pickupId:1},{...snap,pickups:'none'},{...snap,nextPickup:-5},
  // A save from the old 28×36 game: the wrong shape, refused cleanly.
  {version:1,kind:'paint',worldSeed:21,score:90,time:1,randomState:1,steps:8,acc:0,owner:new Array(28*36).fill(-1),players:snap.players.map(p=>({k:p.k,x:p.x,y:p.y,dir:p.dir,queued:null,trail:[],alive:true,respawnAt:0,cells:9,captures:0,cuts:0,pops:0,plan:null}))}])assert.equal(restoreQuick(bad),null,JSON.stringify(bad).slice(0,90));
 assert.equal(resumePaint(restoreQuick(snap)).trail.filter(t=>t>=0).length,snap.players.reduce((n,p)=>n+p.trail.length,0));
 // Saves taken all through a match (the podium included) are valid: buildings are always owned whole.
 const m=fresh(5);m.auto=true;let podium=0;while(m.status==='playing'){m.step();m.events=[];if(m.steps%211===0||m.phase==='podium'&&!podium){const s=snapOf(m);assert.ok(validPaintSnapshot(s),'snapshot at step '+m.steps+' '+m.phase);if(m.phase==='podium'){podium=1;const r=restoreQuick(s);assert.ok(r);r.start();while(r.status==='playing')r.step();assert.equal(r.status,'over');assert.equal(r.score,m.score);}}}
 assert.equal(podium,1);
});

test('Every feat can be earned, each is announced once, and feats ride in the save',()=>{
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEATS.map(f=>f.id)).size,FEATS.length);assert.ok(FEATS.every(f=>/^paint\.[a-z0-9]+$/.test(f.id)&&f.name&&f.text));
 const earned=new Set(),note=g=>{for(const e of g.events)if(e.type==='feat'){assert.ok(!earned.has(e.id)||true);earned.add(e.id);}assert.deepEqual(g.events.filter(e=>e.type==='feat').map(e=>e.id),g.feats);};
 // One enormous loop round the ring road: every building and all three landmarks, a monster, mid-dash.
 const g=solo(3),you=g.you,{W,H}=g.city,ring=ringTrail(g,{x:2,y:2,w:W-4,h:H-4});for(const i of g.owner.keys())if(g.owner[i]===0&&i!==g.idx(1,1))g.owner[i]=-1;g.recount();lay(g,you,ring,'up');you.streak=you.loops=9;you.dash=5;g.events=[];walk(g,2);note(g);
 for(const id of ['paint.block','paint.landmark','paint.trio','paint.monster','paint.streak','paint.dash'])assert.ok(g.feats.includes(id),id);
 // The same loop again awards nothing twice.
 const n=g.feats.length;g.award('paint.block');g.award('paint.nope');assert.equal(g.feats.length,n);
 // Nerves of Steel and Boxed In: the capture loop, with the rival two cells from your trail.
 const c=solo(3),h=c.city.homes[0],r=c.players[1];lay(c,r,[[h.x+2,h.y-3],[h.x+1,h.y-3]],'up');lay(c,c.you,boxTrail(h),'left');c.events=[];walk(c,1);note(c);assert.ok(c.events.find(e=>e.type==='claim').close);assert.ok(c.feats.includes('paint.nerve')&&c.feats.includes('paint.capture'));
 // Cut Above: three cuts.
 const k=solo(3),kh=k.city.homes[0],kr=k.players[1];k.you.dir='up';for(let i=0;i<3;i++){const y=k.you.y-2;lay(k,kr,[[k.you.x-1,y],[k.you.x,y],[k.you.x+1,y]],'right');k.events=[];walk(k,2);note(k);assert.equal(k.feats.includes('paint.cut3'),i===2);}assert.equal(k.you.cuts,3);
 // Splash Zone: a bomb with your trail out. Second Coat: a shield takes a cut for you.
 const b=solo(3),bh=b.city.homes[0];b.pickups.push({id:1,x:bh.x,y:bh.y-5,kind:'bomb'});b.pickupId=1;b.you.dir='up';walk(b,5);note(b);assert.ok(b.feats.includes('paint.bomb'));
 const s=solo(5);s.you.dir='up';s.you.shield=true;walk(s,4,'right','down','left');note(s);assert.ok(s.feats.includes('paint.shield'));
 // The whistle: Untouchable, Town Painter, Majority Rule.
 const w=solo(3);for(const i of w.owner.keys())if(w.owner[i]<0&&i%2)w.owner[i]=0;for(const bl of w.city.blocks)for(let y=bl.y;y<bl.y+bl.h;y++)for(let x=bl.x;x<bl.x+bl.w;x++)w.owner[w.idx(x,y)]=0;w.recount();w.steps=PAINT.seconds*TPS-1;w.you.alive=false;w.you.respawnAt=1e9;w.events=[];w.step();note(w);
 for(const id of ['paint.clean','paint.win','paint.crown'])assert.ok(w.feats.includes(id),id);
 assert.deepEqual([...earned].sort(),FEATS.map(f=>f.id).sort(),'every feat was earned somewhere above');
 // Feats are saved and validated.
 const snap=snapOf(g);assert.ok(validPaintSnapshot(snap));assert.deepEqual(restoreQuick(snap).feats,g.feats);
 for(const bad of [{...snap,feats:['paint.block','paint.block']},{...snap,feats:['paint.cheat']},{...snap,feats:null},{...snap,league:7},{...snap,daily:'yes'}])assert.equal(restoreQuick(bad),null);
});

test('Leagues are a ladder: your best score picks one, each pays more with faster rivals and a twist, and the result teases the next',()=>{
 assert.deepEqual([0,5999,6000,13999,14000,23999,24000,1e6].map(leagueFor),[0,0,1,1,2,2,3,3]);for(let i=1;i<LEAGUES.length;i++){assert.ok(LEAGUES[i].need>LEAGUES[i-1].need);assert.ok(LEAGUES[i].mult>LEAGUES[i-1].mult);assert.ok(LEAGUES[i].pace>LEAGUES[i-1].pace);assert.ok(LEAGUES[i].name&&LEAGUES[i].twist);}
 const loopPts=league=>{const g=solo(3);g.setLeague(league);lay(g,g.you,boxTrail(g.city.homes[0]),'left');g.events=[];walk(g,1);return g.events.find(e=>e.type==='claim').pts;};
 assert.equal(loopPts(0),300);assert.equal(loopPts(1),375);assert.equal(loopPts(3),600);
 const a=fresh(2),b=fresh(2);b.league=3;assert.ok(Math.abs(b.speedOf(b.players[1])/a.speedOf(a.players[1])-LEAGUES[3].pace)<1e-9);assert.equal(b.speedOf(b.you),a.speedOf(a.you),'your own pace never changes');
 // The league is fixed once the match is under way, and bad values are ignored.
 const g=fresh(4);assert.equal(g.setLeague(2),2);assert.equal(g.setLeague(9),2);g.step();assert.equal(g.setLeague(0),2);
 // Twists: Night Market drops pickups sooner; Neon Heights starts everyone shielded; The Crown doubles the whole last minute.
 const gap=league=>{const m=new PaintGame(seededRandom(4),4);m.setLeague(league);m.start();for(const p of m.players){p.alive=false;p.respawnAt=1e9;}while(m.steps<8*TPS)m.step();return m.nextPickup-m.steps;};assert.ok(gap(1)<gap(0));
 const n=new PaintGame(seededRandom(4),4);n.setLeague(2);n.start();assert.ok(n.players.every(p=>p.shield));const plain=fresh(4);assert.ok(plain.players.every(p=>!p.shield));
 const c=fresh(4);c.league=3;c.steps=(PAINT.seconds-60)*TPS;assert.equal(c.final,true);plain.steps=c.steps;assert.equal(plain.final,false);
 // The result names the league and what is next.
 const end=league=>{const m=new PaintGame(seededRandom(6),6);m.setLeague(league);m.start();m.auto=true;while(m.status==='playing')m.step();return m;};
 const low=end(0);assert.match(low.reason,/Biggest loop \d+, \d+ loops?, \d+ cuts?, \d+ captures?, \d+ feats?\. BACK ALLEY league: (NIGHT MARKET unlocked!|[\d,]+ more in one match unlocks NIGHT MARKET\.)$/);
 assert.match(end(3).reason,/THE CROWN league, the top of the ladder\.$/);
});

test('Today’s course: the seed picks one twist, and it only applies to a daily match',()=>{
 assert.ok(TWISTS.length>=3);const seen=new Set();for(let s=0;s<60;s++){const t=DAILY_TWIST(s);assert.ok(TWISTS.includes(t));assert.equal(DAILY_TWIST(s),t);seen.add(t.id);}assert.equal(seen.size,TWISTS.length,'every twist turns up');
 const seedFor=id=>{for(let s=1;s<500;s++)if(DAILY_TWIST(s).id===id)return s;},daily=id=>{const s=seedFor(id),g=new PaintGame(seededRandom(s),s);g.daily=true;g.start();return g;};
 const plain=fresh(seedFor('rush'));assert.equal(plain.twist,null);const rush=daily('rush');assert.equal(rush.twist.id,'rush');assert.ok(Math.abs(rush.speedOf(rush.you)/plain.speedOf(plain.you)-1.15)<1e-9);
 assert.ok(daily('shields').players.every(p=>p.shield));
 for(const [id,kind] of [['bombs','bomb'],['shields','shield']]){const g=daily(id);for(const p of g.players){p.alive=false;p.respawnAt=1e9;}const kinds=[];for(let i=0;i<40*TPS;i++){g.step();for(const e of g.events)if(e.type==='drop')kinds.push(e.kind);g.events=[];g.pickups.length=0;}assert.ok(kinds.length>=3&&kinds.every(k=>k===kind),id+' dropped '+kinds);}
 const gold=daily('gold'),m=gold.city.blocks.find(b=>b.landmark);for(const p of gold.players.slice(1)){p.alive=false;p.respawnAt=1e9;}lay(gold,gold.you,ringTrail(gold,m),'up');gold.events=[];walk(gold,2);const c=gold.events.find(e=>e.type==='claim');assert.equal(c.pts,Math.round(c.area*PAINT.loopPts*TIERS[c.tier].mult)+PAINT.landmarkPts*3);
 // A daily match is as deterministic as any other, and the flag is saved.
 const run=()=>{const g=daily('bombs');for(let i=0;i<600;i++){if(i%31===0)g.move(['up','right','down','left'][(i/31|0)%4]);g.tick(1/30);}return g;};assert.equal(state(run()),state(run()));assert.equal(restoreQuick(snapOf(run())).daily,true);
});
