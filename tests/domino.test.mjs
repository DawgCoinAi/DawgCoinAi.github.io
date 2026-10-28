import test from 'node:test';
import assert from 'node:assert/strict';
import {DominoGame,DOMINO,LEVELS,DOMINO_SOLUTIONS,DOMINO_FIELDS,validDominoSnapshot,resolve,cells,encodeCode,decodeCode} from '../dist/domino-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';

const fresh=(level=0)=>{const g=new DominoGame(()=>.5,1);g.level=level;g.setup();g.start();g.events=[];return g;};
// Runs the chain to its end; returns the win or fail event.
const chain=g=>{let ev=null;while(g.status==='playing'&&g.phase==='run'){g.step();ev=g.events.find(e=>e.type==='win'||e.type==='fail')||ev;g.events=[];}return ev;};
const settle=g=>{for(let i=0;i<DOMINO.fps*2&&g.status==='playing'&&g.phase!=='place';i++)g.step();g.events=[];};
const PIECES=['domino','ball','rampR','rampL','spring','fanR','fanL'];

test('Every room is well formed: inside the walls, a bone on something, a bin, a small palette',()=>{
 assert.ok(LEVELS.length>=8&&LEVELS.length<=10);
 for(const lv of LEVELS){assert.ok(lv.palette.length>=1&&lv.palette.length<=3,lv.name+' palette');for(const p of lv.palette)assert.ok(PIECES.includes(p),lv.name+' piece '+p);
  assert.ok(lv.bin.x>=0&&lv.bin.x+lv.bin.w<=lv.W,lv.name+' bin inside');assert.ok(lv.boxes.some(b=>lv.bone.x>=b.x&&lv.bone.x<=b.x+b.w&&Math.abs(b.y+b.h+DOMINO.boneR-lv.bone.y)<.02),lv.name+' bone rests on a surface');
  for(const d of lv.doms)assert.ok(lv.boxes.some(b=>d.x>=b.x&&d.x<=b.x+b.w&&Math.abs(b.y+b.h-d.y)<1e-9),lv.name+' domino at '+d.x+' stands on a surface');
  assert.ok(lv.doms.some(d=>d.start)||lv.palette.some(p=>p.startsWith('fan')),lv.name+' has something to start the chain');}
});

test('The stored solutions clear every room in one run; fewer pieces and faster chains score more',()=>{
 const g=fresh(0);const scores=[];
 for(let L=0;L<LEVELS.length;L++){assert.equal(g.level,L);assert.equal(g.phase,'place');assert.ok(g.setPlaced(DOMINO_SOLUTIONS[L]),LEVELS[L].name+' solution placements are legal');assert.ok(g.go());
  const ev=chain(g);assert.equal(ev?.type,'win',LEVELS[L].name+' '+JSON.stringify(ev));scores.push(ev.points);assert.equal(ev.code,encodeCode(L,DOMINO_SOLUTIONS[L]));
  const unused=LEVELS[L].palette.length-DOMINO_SOLUTIONS[L].length;assert.equal(ev.points,Math.max(200,1000+unused*400+Math.max(0,600-Math.round(ev.time*40))));settle(g);}
 assert.equal(g.status,'over');assert.match(g.reason,/dynasty/i);assert.equal(g.cleared,LEVELS.length);assert.equal(g.score,scores.reduce((a,b)=>a+b,0));assert.ok(g.score>=11000,'gold is reachable: '+g.score);
 assert.equal(g.codes.length,LEVELS.length);
});

test('The chain is deterministic: the same placements give the same chain, step for step',()=>{
 const runs=[0,1].map(()=>{const g=fresh(3);g.setPlaced(DOMINO_SOLUTIONS[3]);g.go();const trail=[];while(g.phase==='run'){g.step();if(g.sim.t*DOMINO.fps%12<1)trail.push(JSON.stringify(g.sim));}return {trail,t:g.sim.t,phase:g.phase};});
 assert.equal(runs[0].phase,'won');assert.deepEqual(runs[0],runs[1]);
 // The seed only names the world; it never touches the physics.
 const a=new DominoGame(()=>.1,7),b=new DominoGame(()=>.9,99);for(const g of [a,b]){g.level=1;g.setup();g.start();g.setPlaced(DOMINO_SOLUTIONS[1]);g.go();chain(g);}assert.deepEqual(a.sim,b.sim);
});

test('Cursor, drop, pick up, blocked spots, and holding to GO',()=>{
 const g=fresh(0),c=cells(g.lv);assert.deepEqual(g.cursor,{gx:c.gx/2,gy:c.gy/2});
 g.press('right',true);assert.equal(g.cursor.gx,c.gx/2+1,'a press moves one cell at once');for(let i=0;i<DOMINO.fps*.5;i++)g.tick(1/DOMINO.fps);assert.ok(g.cursor.gx>c.gx/2+2,'holding repeats');g.press('right',false);
 g.cursor={...DOMINO_SOLUTIONS[0][0]};assert.equal(g.preview().kind,'place');assert.ok(g.act());assert.equal(g.placed.length,1);assert.equal(g.events.at(-1).type,'place');
 assert.equal(g.preview().kind,'pickup');assert.ok(g.act());assert.equal(g.placed.length,0);assert.equal(g.events.at(-1).type,'pickup');
 g.cursor={gx:18,gy:9};g.events=[];assert.equal(g.preview().kind,'blocked','on top of the bone');assert.equal(g.act(),false);assert.equal(g.events.at(-1).type,'nope');
 g.cursor={gx:DOMINO_SOLUTIONS[0][0].gx,gy:DOMINO_SOLUTIONS[0][0].gy+4};assert.equal(resolve(g.lv,0,g.cursor.gx,g.cursor.gy).y,4.3,'a domino drops onto the shelf below the cursor');assert.ok(g.act());
 assert.equal(g.aim(g.cursor.gx,g.cursor.gy),true,'pointing at the cursor again acts (picks the piece back up)');assert.equal(g.placed.length,0);assert.equal(g.aim(5,5),false);assert.deepEqual(g.cursor,{gx:5,gy:5});
 g.setPlaced(DOMINO_SOLUTIONS[0]);g.press('act',true);for(let i=0;i<DOMINO.fps*.2;i++)g.tick(1/DOMINO.fps);g.press('act',false);assert.equal(g.phase,'place','a short press is a drop, not GO');
 g.press('act',true);for(let i=0;i<DOMINO.fps*.6;i++)g.tick(1/DOMINO.fps);assert.equal(g.phase,'run','holding starts the chain');g.press('act',false);assert.equal(g.press('left',true),true);assert.equal(g.placed.length,1);
 assert.equal(chain(g)?.type,'win');
});

test('A chain that fizzles burns a fuse and hands the pieces back; ten fizzles end the run',()=>{
 const g=fresh(0);assert.ok(g.go(),'GO with nothing placed is allowed');const ev=chain(g);assert.equal(ev.type,'fail');assert.equal(g.fuses,DOMINO.fuses-1);assert.equal(g.phase,'failed');settle(g);assert.equal(g.phase,'place');assert.equal(g.sim,null);
 g.setPlaced([{i:0,gx:3,gy:2}]);g.go();chain(g);settle(g);assert.deepEqual(g.placed,[{i:0,gx:3,gy:2}],'placed pieces stay where they were');
 for(let i=0;i<DOMINO.fuses;i++){if(g.status!=='playing')break;g.go();chain(g);settle(g);}assert.equal(g.status,'over');assert.equal(g.fuses,0);assert.match(g.reason,/fuses/i);
});

test('Share codes round-trip and refuse junk',()=>{
 for(let L=0;L<LEVELS.length;L++){const code=encodeCode(L,DOMINO_SOLUTIONS[L]);assert.match(code,/^D[0-9a-z](-[0-2][0-9a-z]{2})*$/);assert.deepEqual(decodeCode(code),{level:L,placed:DOMINO_SOLUTIONS[L]});
  const g=fresh(L);assert.ok(g.setPlaced(decodeCode(code).placed));assert.equal(g.lastCode(),'');}
 for(const bad of ['','D','X0-0a9','D0-0a9-0b9','Dz-0a9','D0-9a9','D0-0zz',null,42,'D0-0a9 ;drop'])assert.equal(decodeCode(bad),null,String(bad));
 assert.deepEqual(decodeCode('D0'),{level:0,placed:[]});
});

test('Runs save mid-chain and come back exactly; bad saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('domino'));const g=createQuickGame('domino',5);g.start();g.setPlaced(DOMINO_SOLUTIONS[0]);g.go();for(let i=0;i<DOMINO.fps*.8;i++)g.step();g.events=[];
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'domino')));assert.ok(validDominoSnapshot(snap));assert.equal(snap.phase,'run');for(const k of DOMINO_FIELDS)assert.ok(k in snap,k);
 const back=restoreQuick(snap);assert.ok(back);assert.equal(back.status,'paused');back.start();assert.deepEqual(back.sim,g.sim);
 const a=chain(g),b=chain(back);assert.equal(a.type,'win');assert.deepEqual(b,a);assert.deepEqual(back.sim,g.sim);assert.equal(back.score,g.score);
 // Between chains, saves carry the placements and the cursor.
 const p=createQuickGame('domino',5);p.start();p.setPlaced(DOMINO_SOLUTIONS[0]);p.cursor={gx:4,gy:7};const ps=JSON.parse(JSON.stringify(snapshotQuick(p,'domino')));assert.equal(ps.sim,null);const pb=restoreQuick(ps);assert.deepEqual(pb.placed,DOMINO_SOLUTIONS[0]);assert.deepEqual(pb.cursor,{gx:4,gy:7});
 for(const bad of [{...snap,level:LEVELS.length},{...snap,fuses:0},{...snap,score:9},{...snap,cleared:1},{...snap,placed:[{i:0,gx:1,gy:1}]},{...snap,placed:[{i:0,gx:10,gy:9},{i:0,gx:11,gy:9}]},{...snap,sim:{...snap.sim,balls:[]}},{...snap,sim:{...snap.sim,doms:snap.sim.doms.map(d=>({...d,a:9}))}},{...snap,phase:'place'},{...snap,phase:'flying'},{...ps,sim:snap.sim},{...snap,cursor:{gx:-1,gy:0}},{...snap,codes:['D0']}])assert.equal(restoreQuick(bad),null,JSON.stringify(bad).slice(0,80));
});
