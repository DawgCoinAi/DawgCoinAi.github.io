import test from 'node:test';
import assert from 'node:assert/strict';
import {PaintGame,PAINT,paintCity,CREWS,validPaintSnapshot,PAINT_FIELDS,resumePaint} from '../dist/paint-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

const fresh=seed=>{const g=new PaintGame(seededRandom(seed),seed);g.start();return g;};
// A match with every rival benched (popped and never respawning), so one rule can be checked alone.
const solo=seed=>{const g=fresh(seed);for(const p of g.players.slice(1)){p.ai=null;p.alive=false;p.respawnAt=1e9;}return g;};
// Strings steer then step once; numbers step that many times.
const walk=(g,...moves)=>{for(const m of moves){if(typeof m==='string'){g.move(m);g.step();}else for(let i=0;i<m;i++)g.step();}};
const own=(g,k)=>g.owner.filter(o=>o===k).length;
// Puts a crew mid-trail: the trail runs through the given cells and the crew stands on the last one.
const lay=(g,p,cells,dir)=>{p.alive=true;p.respawnAt=1e9;p.trail=cells.map(([x,y])=>g.idx(x,y));for(const i of p.trail)g.trail[i]=p.k;[p.x,p.y]=cells.at(-1);p.dir=dir;};
const state=g=>JSON.stringify({o:g.owner,p:g.players.map(p=>[p.x,p.y,p.dir,p.alive,p.trail,p.cells,p.cuts,p.captures]),s:g.score,t:g.steps});

test('The city comes from the seed: 28×36, building blocks clear of every home, 3–5 rivals',()=>{
 for(const seed of [0,1,2,3,42,999,123456]){const c=paintCity(seed);assert.equal(c.W,PAINT.cols);assert.equal(c.H,PAINT.rows);assert.ok(c.blocks.length>=4);assert.ok(c.rivals>=3&&c.rivals<=5);assert.equal(c.homes.length,c.rivals+1);
  for(const h of c.homes)for(let y=h.y-2;y<=h.y+2;y++)for(let x=h.x-2;x<=h.x+2;x++)assert.ok(!c.walls[y*c.W+x],'home '+seed+' has room');
  assert.deepEqual(paintCity(seed).walls,c.walls);}
 assert.notDeepEqual(paintCity(1).walls,paintCity(2).walls);
 const g=fresh(7);assert.equal(g.players.length,g.city.rivals+1);assert.ok(g.players.slice(1).every(p=>CREWS.some(c=>c.name===p.name)));assert.ok(g.players.every(p=>p.cells===9));assert.equal(g.score,90);
});

test('Same seed and inputs, same match; a different seed is a different match',()=>{
 const play=seed=>{const g=fresh(seed);const script=['up','up','left','left','down','down','right'];for(let i=0;i<PAINT.seconds*PAINT.fps/2;i++){if(i%7===0)g.move(script[(i/7|0)%script.length]);g.tick(7/120);}return state(g);};
 assert.equal(play(11),play(11));assert.notEqual(play(11),play(12));
});

test('Leaving your paint lays a trail; coming back claims the enclosed cells, concave shapes included',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0];you.dir='up';
 walk(g,2);assert.equal(you.trail.length,1,'the first cell outside the paint starts the trail');assert.equal(g.trail[g.idx(you.x,you.y)],0);
 // Up to 4 above the home, right 3, down 3, then left back onto the block: a 4×4 box above and beside the home.
 walk(g,'up','up','right',2,'down',2,'left','left');assert.equal(you.trail.length,0,'back on your own paint: loop closed');assert.equal(g.trail.filter(t=>t>=0).length,0);
 for(let y=h.y-4;y<=h.y-1;y++)for(let x=h.x;x<=h.x+3;x++)assert.equal(g.owner[g.idx(x,y)],0,'cell '+x+','+y+' claimed');assert.equal(own(g,0),9+14);assert.equal(g.score,23*PAINT.cellPts);
 // A concave loop: left 2, up 3, right 5, then a staircase (down, left, down, left) back onto the paint, leaving a notch.
 const c=solo(3),cy=c.you,ch=c.city.homes[0];cy.dir='left';walk(c,2,'up',2,'right',4,'down','left','down','left');
 assert.equal(cy.trail.length,0,'loop closed');for(let y=ch.y-3;y<=ch.y-1;y++)for(let x=ch.x-2;x<=ch.x+2;x++)assert.equal(c.owner[c.idx(x,y)],0,'concave fill '+x+','+y);assert.equal(c.owner[c.idx(ch.x+3,ch.y-3)],0);
 assert.equal(c.owner[c.idx(ch.x+3,ch.y-2)],0,'the staircase step is trail, so painted');assert.equal(c.owner[c.idx(ch.x+3,ch.y-1)],-1,'the notch stays unpainted');assert.equal(own(c,0),9+15,'the box, the step cell and the first trail cell beside the home: no leak');
});

test('Enclosing a rival’s paint repaints it; a rival caught inside on its trail is captured',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0],r=g.players[1];
 // Park some rival paint, and the rival itself mid-trail, in the box above your home.
 const pocket=[[h.x,h.y-3],[h.x+2,h.y-3]];for(const [x,y] of pocket)g.owner[g.idx(x,y)]=1;g.recount();lay(g,r,[[h.x+2,h.y-2],[h.x+1,h.y-2]],'up');
 // Your trail already runs round a 4×4 box above the home; one step left closes it with the rival inside.
 lay(g,you,[[h.x,h.y-2],[h.x,h.y-3],[h.x,h.y-4],[h.x+1,h.y-4],[h.x+2,h.y-4],[h.x+3,h.y-4],[h.x+3,h.y-3],[h.x+3,h.y-2],[h.x+3,h.y-1],[h.x+2,h.y-1]],'left');
 const rivalCells=own(g,1);walk(g,1);
 assert.equal(you.trail.length,0);for(const [x,y] of pocket)assert.equal(g.owner[g.idx(x,y)],0,'rival paint repainted');assert.ok(own(g,1)<rivalCells);
 assert.equal(r.alive,false,'the rival inside was popped');assert.equal(you.captures,1);assert.equal(r.trail.length,0);assert.equal(g.score,own(g,0)*PAINT.cellPts+PAINT.capturePts);
 const ev=g.events.map(e=>e.type);assert.ok(ev.includes('capture')&&ev.includes('claim'));
 // A rival sitting safely inside its own paint is not captured by a loop around it, only repainted.
 const s=solo(5),sy=s.you,sh=s.city.homes[0],sr=s.players[1];sr.alive=true;sr.respawnAt=1e9;sr.x=sh.x+2;sr.y=sh.y-3;sr.dir='left';for(let x=sh.x+1;x<=sh.x+2;x++)s.owner[s.idx(x,sh.y-3)]=1;s.recount();
 lay(s,sy,[[sh.x,sh.y-2],[sh.x,sh.y-3],[sh.x,sh.y-4],[sh.x+1,sh.y-4],[sh.x+2,sh.y-4],[sh.x+3,sh.y-4],[sh.x+3,sh.y-3],[sh.x+3,sh.y-2],[sh.x+3,sh.y-1],[sh.x+2,sh.y-1]],'left');walk(s,1);
 assert.equal(sy.trail.length,0);assert.equal(s.owner[s.idx(sh.x+1,sh.y-3)],0);assert.equal(s.owner[s.idx(sh.x+2,sh.y-3)],0);assert.equal(sr.alive,true);assert.equal(sy.captures,0);assert.equal(own(s,1),9);
});

test('Crossing an open trail cuts it: the owner pops, loses the trail, and respawns at home after 2 s',()=>{
 const g=solo(3),you=g.you,h=g.city.homes[0],r=g.players[1];
 // The rival's trail runs along the row three above your home; you walk straight up into it.
 lay(g,r,Array.from({length:7},(_,i)=>[h.x-3+i,h.y-3]),'right');
 you.dir='up';walk(g,3);assert.equal(you.y,h.y-3);assert.equal(r.alive,false);assert.equal(r.trail.length,0);assert.ok(g.trail.every(t=>t!==1));assert.equal(you.cuts,1);assert.equal(g.score,own(g,0)*PAINT.cellPts+PAINT.cutPts);
 assert.ok(g.events.some(e=>e.type==='cut'&&e.k===0&&e.victim===1));assert.equal(r.respawnAt,g.steps+PAINT.respawn*PAINT.fps);
 // Two seconds later the rival is back on its home cell with its 3×3.
 you.alive=false;you.respawnAt=1e9;walk(g,PAINT.respawn*PAINT.fps);assert.equal(r.alive,true);const back=g.events.find(e=>e.type==='respawn'&&e.k===1);assert.deepEqual([back.x,back.y],[g.city.homes[1].x,g.city.homes[1].y]);assert.ok(Math.abs(r.x-back.x)+Math.abs(r.y-back.y)<=1,'and already moving again');assert.ok(own(g,1)>=9);
 // Crossing your own trail pops you too, with no points.
 const s=solo(5),y=s.you;y.dir='up';walk(s,3,'right','down','left');assert.equal(y.alive,false);assert.equal(y.trail.length,0);assert.equal(s.score,own(s,0)*PAINT.cellPts);assert.ok(s.events.some(e=>e.type==='pop'&&e.onYou));
});

test('A U-turn onto your own trail is ignored; inside your own paint you can turn around',()=>{
 const g=solo(3),you=g.you;you.dir='up';assert.equal(g.move('down'),true);g.step();assert.equal(you.dir,'down');you.dir='up';walk(g,3);assert.ok(you.trail.length);assert.equal(g.move('down'),false);assert.equal(g.move('left'),true);
 assert.equal(g.move('sideways'),false);assert.equal(g.press('left',false),false);assert.equal(g.press('right',true),true);
});

test('The clock ends the match after three minutes with the share, the rank and the score',()=>{
 const g=fresh(9);let over=0;while(g.status==='playing'){g.tick(1/60);for(const e of g.events)if(e.type==='over')over++;g.events=[];}
 assert.equal(over,1);assert.equal(g.steps,PAINT.seconds*PAINT.fps);assert.ok(Math.abs(g.time-PAINT.seconds)<1e-9);assert.equal(g.status,'over');
 assert.match(g.reason,/^\d+% of the city is yours: (1st|2nd|3rd|4th|5th|6th) of \d crews\./);assert.equal(g.score,g.you.cells*PAINT.cellPts+g.you.captures*PAINT.capturePts+g.you.cuts*PAINT.cutPts);
 const share=+g.reason.match(/^(\d+)%/)[1];assert.equal(share,Math.round(g.you.cells/g.city.open*100));const place=+g.reason.match(/: (\d)/)[1];assert.equal(place,g.rank().indexOf(g.you)+1);
 g.tick(1);assert.equal(g.steps,PAINT.seconds*PAINT.fps,'nothing moves after the whistle');
});

test('Rivals paint, cut and capture, and never walk into a building or off the grid',()=>{
 for(const seed of [1,2,3]){const g=fresh(seed);let claims=0,cuts=0;while(g.status==='playing'){g.tick(.1);for(const e of g.events){if(e.type==='claim'&&e.k)claims++;if((e.type==='cut'||e.type==='capture')&&e.k)cuts++;}g.events=[];
   for(const p of g.players){assert.ok(g.open(p.x,p.y),'crew '+p.name+' at '+p.x+','+p.y);for(const i of p.trail)assert.ok(!g.city.walls[i]);}}
  assert.ok(claims>50,'rivals close loops');assert.ok(cuts>0,'rivals cut trails');assert.ok(g.players.slice(1).every(p=>p.cells>0||!p.alive));}
});

test('A Paint the Town match saves mid-match and comes back exactly; bad saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('paint'));const g=createQuickGame('paint',21);g.start();for(let i=0;i<400;i++){if(i%9===0)g.move(['up','left','down','right'][(i/9|0)%4]);g.tick(.1);}g.events=[];
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'paint')));assert.ok(validPaintSnapshot(snap));assert.ok(PAINT_FIELDS.every(k=>k in snap));
 const back=restoreQuick(snap);assert.ok(back);assert.equal(back.status,'paused');assert.equal(state(back),state(g));assert.deepEqual(back.trail,g.trail);
 back.start();for(let i=0;i<300;i++){g.tick(.1);back.tick(.1);}assert.equal(state(back),state(g),'the restored match continues identically');
 const wall=g.city.walls.indexOf(1);
 for(const bad of [{...snap,steps:-1},{...snap,steps:PAINT.seconds*PAINT.fps+1},{...snap,score:snap.score+1},{...snap,owner:snap.owner.map((o,i)=>i===wall?0:o)},{...snap,owner:snap.owner.slice(1)},{...snap,players:snap.players.slice(1)},{...snap,players:snap.players.map((p,k)=>k?p:{...p,x:99})},{...snap,players:snap.players.map((p,k)=>k?p:{...p,trail:[wall]})},{...snap,players:snap.players.map((p,k)=>k?p:{...p,cells:p.cells+1})}])assert.equal(restoreQuick(bad),null,JSON.stringify(bad).slice(0,80));
 assert.equal(resumePaint(restoreQuick(snap)).trail.filter(t=>t>=0).length,snap.players.reduce((n,p)=>n+p.trail.length,0));
});
