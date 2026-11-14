import test from 'node:test';
import assert from 'node:assert/strict';
import {DominoGame,DOMINO,LEVELS,WORLDS,FEATS,TWISTS,DAILY_TWIST,DOMINO_SOLUTIONS,DOMINO_ALTS,DOMINO_FIELDS,validDominoSnapshot,validProgress,resolve,snap,cells,encodeCode,decodeCode,pieceOf,mirrorPlaced} from '../dist/domino-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';

// Every simulation here is one chain of a few seconds: this machine's Node dislikes long loops.
const fresh=(level=0)=>{const g=new DominoGame(()=>.5,1);g.unlocked=LEVELS.length;g.level=level;g.setup();g.start();g.events=[];return g;};
// Runs the chain to its end; returns the win or fail event (and keeps every event seen).
const chain=(g,seen=[])=>{let ev=null;while(g.status==='playing'&&g.phase==='run'){g.step();for(const e of g.events){seen.push(e);if(e.type==='win'||e.type==='fail')ev=e;}g.events=[];}return ev;};
const settle=g=>{for(let i=0;i<DOMINO.fps*4&&g.status==='playing'&&g.phase!=='place';i++)g.step();g.events=[];};
const solve=(L,placed=DOMINO_SOLUTIONS[L])=>{const g=fresh(L);assert.ok(g.setPlaced(placed),LEVELS[L].name+' placements are legal');assert.ok(g.go());return {g,ev:chain(g)};};

test('Fifteen portrait rooms in three shops, each well formed, each teaching one idea then combining',()=>{
 assert.equal(LEVELS.length,15);assert.equal(WORLDS.length,3);for(let w=0;w<3;w++)assert.equal(LEVELS.filter(l=>l.world===w).length,5);
 for(const lv of LEVELS){assert.equal(lv.W,10);assert.equal(lv.H,16);assert.ok(lv.H>lv.W,'tall rooms');assert.ok(lv.palette.length>=1&&lv.palette.length<=4,lv.name+' palette');for(const p of lv.palette)assert.ok(pieceOf(p),lv.name+' piece '+p);assert.ok(lv.par>=1&&lv.par<=lv.palette.length,lv.name+' par');
  assert.ok(lv.bin.x>=0&&lv.bin.x+lv.bin.w<=lv.W,lv.name+' bin inside');for(const d of lv.doms)assert.ok(lv.boxes.some(b=>d.x>=b.x&&d.x<=b.x+b.w&&Math.abs(b.y+b.h-d.y)<1e-9),lv.name+' domino at '+d.x+' stands on a surface');
  // The contraption uses the height of the room: something sits in the top half and the bin is near the floor.
  assert.ok([...lv.doms,...lv.balls,lv.bone].some(o=>o.y>8),lv.name+' reaches the top half');}
 assert.deepEqual(LEVELS.slice(0,4).map(l=>l.palette),[['domino'],['rampR'],['rampR','rampL'],['springR']]);
 // The new toys each get a room of their own before they are mixed.
 assert.ok(LEVELS[5].palette.includes('fanR')&&LEVELS[6].palette.includes('gloveR')&&LEVELS[7].saws.length===1&&LEVELS[10].switches.length===1&&LEVELS[10].doors.length===1&&LEVELS[11].boxes.some(b=>b.belt));
 assert.ok(LEVELS[14].doors.length&&LEVELS[14].switches.length&&LEVELS[14].boxes.some(b=>b.belt)&&LEVELS[14].palette.length===4,'the finale mixes them');
});

test('Every room: nothing placed fails, the stored solution wins, and so does a second, different one',()=>{
 for(let L=0;L<LEVELS.length;L++){const none=solve(L,[]);assert.equal(none.ev?.type,'fail',LEVELS[L].name+' must not solve itself');
  const a=solve(L);assert.equal(a.ev?.type,'win',LEVELS[L].name+' solution '+JSON.stringify(a.ev));assert.equal(a.ev.code,encodeCode(L,DOMINO_SOLUTIONS[L]));assert.equal(a.ev.stars,3,LEVELS[L].name+' solution is three stars');assert.ok(DOMINO_SOLUTIONS[L].length<=LEVELS[L].par);
  const b=solve(L,DOMINO_ALTS[L]);assert.equal(b.ev?.type,'win',LEVELS[L].name+' second solution');assert.notDeepEqual(DOMINO_ALTS[L],DOMINO_SOLUTIONS[L]);
  const cellsOf=s=>s.map(p=>{const q=resolve(LEVELS[L],p.i,p.gx,p.gy,s);return [p.i,q.x??q.x1,q.y??q.y1].join(':');}).sort().join('|');assert.notEqual(cellsOf(DOMINO_ALTS[L]),cellsOf(DOMINO_SOLUTIONS[L]),LEVELS[L].name+' second solution really is elsewhere');}
});

test('The chain is deterministic and the seed never touches the physics',()=>{
 const runs=[0,1].map(()=>{const g=fresh(8);g.setPlaced(DOMINO_SOLUTIONS[8]);g.go();const trail=[];while(g.phase==='run'){g.step();if(Math.round(g.sim.t*DOMINO.fps)%12===0)trail.push(JSON.stringify(g.sim));}return {trail,t:g.sim.t,phase:g.phase};});
 assert.equal(runs[0].phase,'won');assert.deepEqual(runs[0],runs[1]);
 const a=new DominoGame(()=>.1,7),b=new DominoGame(()=>.9,99);for(const g of [a,b]){g.unlocked=9;g.level=6;g.setup();g.start();g.setPlaced(DOMINO_SOLUTIONS[6]);g.go();chain(g);}assert.deepEqual(a.sim,b.sim);
});

test('Stars: one for the bone, one for par pieces, one for a first try; test runs are free and unlimited',()=>{
 // Room 13 (Remix) has par 2 and two pieces; room 15 offers four with par 3.
 const g=fresh(0);assert.ok(g.go(),'GO with nothing placed is allowed');const miss=chain(g);assert.equal(miss.type,'fail');assert.match(miss.why,/stopped short/i);assert.equal(g.phase,'failed');settle(g);assert.equal(g.phase,'place');assert.equal(g.sim,null);assert.equal(g.attempts,1);
 for(let i=0;i<4;i++){g.go();chain(g);settle(g);}assert.equal(g.status,'playing','failing never ends the run');assert.equal(g.attempts,5);
 g.setPlaced(DOMINO_SOLUTIONS[0]);g.go();const win=chain(g);assert.equal(win.type,'win');assert.equal(win.stars,2,'par but not first try');assert.equal(win.first,false);assert.equal(win.attempts,6);assert.equal(win.points,400+300*2+Math.max(0,300-Math.round(win.time*20)));assert.match(win.tease,/first try/i);
 const clean=solve(1);assert.equal(clean.ev.stars,3);assert.equal(clean.ev.points,400+900+Math.max(0,300-Math.round(clean.ev.time*20)));assert.match(clean.ev.tease,/3 more rooms to The Kennel/);
 // Over par: Platinum with all four pieces placed still clears, for two stars.
 const fat=fresh(14),s=DOMINO_SOLUTIONS[14],extra=snap(fat.lv,2,9,12,s);assert.ok(extra);assert.ok(fat.setPlaced([...s,{i:2,...extra}]));fat.go();const over=chain(fat);assert.equal(over.type,'win');assert.equal(over.par,false);assert.equal(over.stars,2);assert.match(over.tease,/3 pieces or fewer/);
 // Replaying a room in the same run only banks the improvement.
 settle(g);assert.equal(g.level,1);assert.ok(g.jump(0));const before=g.score;g.setPlaced(DOMINO_ALTS[0]);g.go();const again=chain(g);assert.equal(again.stars,3);assert.equal(g.stars[0],3);assert.equal(again.points,g.score-before);assert.ok(again.points>0&&again.points<=300+300);
});

test('Skipping opens up after three tries; the run ends after the last room with a line worth sharing',()=>{
 const g=fresh(13);assert.equal(g.canSkip(),false);assert.equal(g.skip(),false);for(let i=0;i<3;i++){g.go();chain(g);settle(g);}assert.ok(g.canSkip());assert.ok(g.skip());assert.equal(g.level,14);assert.equal(g.stars[13],0);assert.equal(g.score,0);
 g.setPlaced(DOMINO_SOLUTIONS[14]);g.go();assert.equal(chain(g).type,'win');settle(g);assert.equal(g.status,'over');assert.match(g.reason,/1 room, 3★, fastest chain \d+\.\d s/);assert.equal(g.cleared,1);
});

test('Magnetism: a piece dropped near a legal spot clicks into it; carrying follows the finger when nothing fits',()=>{
 const g=fresh(0),lv=g.lv,sol=DOMINO_SOLUTIONS[0][0],q=resolve(lv,0,sol.gx,sol.gy);
 // Well off the gap, above the shelf or below its top edge: still lands in one of the two cells that work.
 for(const [dx,dy] of [[.2,.1],[-.4,.9],[.3,1.4],[0,-.3]]){const s=snap(lv,0,q.x+dx,q.y+dy);assert.ok(s,'snap '+dx+','+dy);const p=resolve(lv,0,s.gx,s.gy);assert.equal(p.y,q.y);assert.ok(Math.abs(p.x-q.x)<=.5);}
 assert.equal(snap(lv,0,5,15.9),null,'nothing to stand on within reach up there');
 assert.ok(g.grab(0));assert.equal(g.carry(q.x+.2,q.y+.8),true);assert.deepEqual(g.cursor,{gx:sol.gx,gy:sol.gy});assert.equal(g.preview().kind,'place');
 assert.equal(g.carry(5,15.9),false);assert.deepEqual(g.cursor,{gx:10,gy:31});assert.equal(g.preview().kind,'blocked');
 g.carry(q.x,q.y+.5);assert.ok(g.release());assert.deepEqual(g.placed,[{i:0,gx:sol.gx,gy:sol.gy}]);
 // Standing pieces always get the cell just above their surface, so one spot has one name (and one code).
 const r=fresh(1),ramp=snap(r.lv,0,5.1,11.9);assert.deepEqual(ramp,{gx:10,gy:24});
});

test('The forecast shows what a piece will do: a ramp rolls things down its slope, a tilted spring throws, a domino sweeps',()=>{
 const g=fresh(1);g.grab(0);g.point(10,24);const f=g.forecast();assert.ok(f?.pts?.length>10);assert.ok(f.pts.at(-1)[0]>f.pts[0][0]+1.5,'rolls right');assert.ok(f.pts.at(-1)[1]<f.pts[0][1],'and down');
 const s=fresh(3);s.grab(0);s.point(8,1);const fs=s.forecast();assert.ok(Math.max(...fs.pts.map(p=>p[1]))>4,'thrown high');assert.ok(fs.pts.at(-1)[0]>4+2,'and to the right');
 const d=fresh(0);d.grab(0);d.point(9,25);const fd=d.forecast();assert.equal(fd.arcs.length,2);assert.ok(Math.abs(fd.arcs[0].at(-1)[0]-(4.5+DOMINO.domH))<1e-9);
 d.point(1,1);assert.equal(d.preview().kind,'place');d.point(3,26);assert.equal(d.forecast()?.arcs.length,2);d.release(false);assert.equal(d.forecast()?.arcs?.length,2,'the keyboard cursor previews too');d.go();assert.equal(d.forecast(),null);
});

test('Cursor keys, drop, pick up, blocked spots, and holding to GO',()=>{
 const g=fresh(0),c=cells(g.lv);assert.deepEqual(g.cursor,{gx:c.gx/2,gy:c.gy/2});
 g.press('right',true);assert.equal(g.cursor.gx,c.gx/2+1,'a press moves one cell at once');for(let i=0;i<DOMINO.fps*.5;i++)g.tick(1/DOMINO.fps);assert.ok(g.cursor.gx>c.gx/2+2,'holding repeats');g.press('right',false);assert.equal(g.keyed,true);
 g.cursor={...DOMINO_SOLUTIONS[0][0]};assert.equal(g.preview().kind,'place');assert.ok(g.act());assert.equal(g.placed.length,1);assert.equal(g.events.at(-1).type,'place');
 assert.equal(g.preview().kind,'pickup');assert.ok(g.act());assert.equal(g.placed.length,0);assert.equal(g.events.at(-1).type,'pickup');
 const bone=g.lv.bone;g.cursor={gx:Math.round(bone.x/.5),gy:Math.ceil(bone.y/.5)};g.events=[];assert.equal(g.preview().kind,'blocked','on top of the bone');assert.equal(g.act(),false);assert.equal(g.events.at(-1).type,'nope');
 g.setPlaced(DOMINO_SOLUTIONS[0]);g.press('act',true);for(let i=0;i<DOMINO.fps*.2;i++)g.tick(1/DOMINO.fps);g.press('act',false);assert.equal(g.phase,'place','a short press is a drop, not GO');
 g.press('act',true);for(let i=0;i<DOMINO.fps*.6;i++)g.tick(1/DOMINO.fps);assert.equal(g.phase,'run','holding starts the chain');g.press('act',false);assert.equal(chain(g)?.type,'win');
});

test('Drag and drop: grab off the tray or out of the room, carry, release; a bad drop goes back',()=>{
 const g=fresh(4),sol=DOMINO_SOLUTIONS[4];assert.equal(g.lv.palette.length,3);
 assert.ok(g.grab(1));assert.equal(g.held.i,1);assert.equal(g.nextIndex(),1);g.point(sol[1].gx,sol[1].gy);assert.equal(g.preview().kind,'place');assert.ok(g.release());assert.deepEqual(g.placed,[{i:1,gx:sol[1].gx,gy:sol[1].gy}]);assert.equal(g.held,null);
 assert.ok(g.grab(0));g.point(sol[0].gx,sol[0].gy);assert.ok(g.release());assert.equal(g.placed.length,2);
 const q=resolve(g.lv,0,sol[0].gx,sol[0].gy,g.placed);assert.equal(g.pieceNear(q.x,q.y+.3),0);assert.equal(g.pieceNear(5,2),-1);
 assert.ok(g.grab(0));assert.equal(g.placed.length,1,'lifted out of the room');g.point(1,31);assert.equal(g.preview().kind,'blocked');g.events=[];assert.equal(g.release(),false);assert.equal(g.placed.length,2);assert.deepEqual(g.placed.find(p=>p.i===0),{i:0,gx:sol[0].gx,gy:sol[0].gy});assert.equal(g.events.at(-1).type,'nope');
 g.grab(0);assert.equal(g.release(false),false);assert.equal(g.placed.length,1);g.grab(0);g.point(sol[0].gx,sol[0].gy);g.release();g.grab(2);g.point(sol[2].gx,sol[2].gy);assert.ok(g.go(),'GO while carrying drops first');assert.equal(g.placed.length,3);assert.equal(chain(g)?.type,'win');
 const c=fresh(4);c.setPlaced(sol);assert.ok(c.clearPlaced());assert.equal(c.placed.length,0);assert.equal(c.clearPlaced(),false);assert.equal(c.select(7),false);assert.ok(c.select(2));assert.equal(c.nextIndex(),2);
});

test('Juice hooks: knocks count up along a run, a near miss leaves a marker, the last approach runs in slow motion',()=>{
 const seen=[],{g,ev}=((g)=>{g.setPlaced(DOMINO_SOLUTIONS[0]);g.go();return {g,ev:chain(g,seen)};})(fresh(0));assert.equal(ev.type,'win');
 const knocks=seen.filter(e=>e.type==='knock').map(e=>e.n);assert.ok(knocks.length>=10);assert.deepEqual(knocks,knocks.map((_,i)=>i),'each knock carries its place in the run');
 assert.ok(seen.some(e=>e.type==='slow'),'slow motion near the bin');assert.ok(seen.some(e=>e.type==='bone'));
 // Slow motion: the engine takes fewer steps per second of real time while the bone closes in.
 const s=fresh(0);s.setPlaced(DOMINO_SOLUTIONS[0]);s.go();let slowSteps=0,n=0;while(s.phase==='run'&&n++<3000){const t0=s.sim.t,was=s.sim.slow;s.tick(1/60);if(was&&s.phase==='run')slowSteps=Math.max(slowSteps,Math.round((s.sim.t-t0)*DOMINO.fps));}assert.ok(slowSteps>=1&&slowSteps<=1,'about a third speed: '+slowSteps);
 // Bath Day with the glove one cell out: the bone lands just outside the bin.
 const m=fresh(11);m.setPlaced([{i:0,gx:15,gy:13}]);m.go();const miss=chain(m);assert.equal(miss.type,'fail');assert.ok(m.marker&&Number.isFinite(m.marker.x));assert.equal(typeof miss.near,'boolean');settle(m);assert.ok(m.marker,'the marker stays while you rebuild');m.go();assert.equal(m.marker,null);
 const sw=[];const t=fresh(10);t.setPlaced(DOMINO_SOLUTIONS[10]);t.go();chain(t,sw);assert.ok(sw.some(e=>e.type==='switch')&&sw.some(e=>e.type==='door'));
 const gl=[];const k=fresh(6);k.setPlaced(DOMINO_SOLUTIONS[6]);k.go();chain(k,gl);assert.ok(gl.some(e=>e.type==='glove'&&e.hit>=1));
 const sp=[];const p=fresh(3);p.setPlaced(DOMINO_SOLUTIONS[3]);p.go();chain(p,sp);assert.ok(sp.some(e=>e.type==='spring'&&e.dir===1));
});

test('Progress: a new run starts at the furthest room reached; any reached room can be reopened; junk is refused',()=>{
 const g=new DominoGame(()=>.5,3);assert.equal(g.level,0);assert.ok(g.loadProgress({furthest:6,stars:[3,3,2,1,3,2]}));assert.equal(g.level,6);assert.equal(g.unlocked,6);assert.equal(g.best[2],2);g.start();
 assert.ok(g.jump(2));assert.equal(g.level,2);assert.equal(g.jump(7),false,'not reached yet');assert.ok(g.jump(6));g.setPlaced(DOMINO_SOLUTIONS[6]);g.go();chain(g);assert.equal(g.unlocked,7);assert.deepEqual(g.exportProgress(),{furthest:7,stars:[3,3,2,1,3,2,3,0,0,0,0,0,0,0,0]});
 assert.equal(g.jump(3),false,'not while the chain runs');settle(g);assert.equal(g.level,7);
 const done=new DominoGame(()=>.5,3);done.loadProgress({furthest:15,stars:Array(15).fill(3)});assert.equal(done.level,14,'everything cleared: start on the finale');
 for(const bad of [null,{},{furthest:-1,stars:[]},{furthest:16,stars:[]},{furthest:2,stars:[4]},{furthest:2,stars:'333'},{furthest:1.5,stars:[]},{furthest:2,stars:Array(16).fill(1)}]){assert.equal(validProgress(bad),false);assert.equal(new DominoGame().loadProgress(bad),false);}
 // Loading into a run already under way only widens what is unlocked.
 const mid=fresh(2);mid.unlocked=2;mid.time=5;mid.loadProgress({furthest:9,stars:[]});assert.equal(mid.level,2);assert.equal(mid.unlocked,9);
});

test('Share codes round-trip and refuse junk',()=>{
 for(let L=0;L<LEVELS.length;L++)for(const S of [DOMINO_SOLUTIONS,DOMINO_ALTS]){const code=encodeCode(L,S[L]);assert.match(code,/^D[0-9a-e](-[0-3][0-9a-z]{2})*$/);assert.deepEqual(decodeCode(code),{level:L,placed:S[L]});const g=fresh(L);assert.ok(g.setPlaced(decodeCode(code).placed));assert.equal(g.lastCode(),'');}
 for(const bad of ['','D','X0-09p','D0-09p-0ap','Df-09p','D0-99p','D0-0zz','D0-09',null,42,'D0-09p ;drop'])assert.equal(decodeCode(bad),null,String(bad));
 assert.deepEqual(decodeCode('D0'),{level:0,placed:[]});
});

test('Feats: eleven, each one earnable, awarded once a run with its name, and kept in the save',()=>{
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEATS.map(f=>f.id)).size,FEATS.length);for(const f of FEATS){assert.match(f.id,/^domino\.[a-z0-9]+$/);assert.ok(f.name&&f.text&&typeof f.test==='function');}
 const earned=new Set(),g=fresh(0);g.unlocked=0;const seen=[];
 // One clean run through all fifteen rooms with the stored solutions (alternates where they are quicker).
 for(let L=0;L<LEVELS.length;L++){assert.equal(g.level,L);g.setPlaced(L===5?DOMINO_ALTS[L]:DOMINO_SOLUTIONS[L]);g.go();assert.equal(chain(g,seen).type,'win',LEVELS[L].name);settle(g);}
 assert.equal(g.status,'over');assert.match(g.reason,/A dynasty: all 15 rooms, 45 of 45★, fastest chain 2\.0 s/);
 const feats=seen.filter(e=>e.type==='feat');for(const e of feats){assert.ok(!earned.has(e.id),'once: '+e.id);earned.add(e.id);assert.equal(e.name,FEATS.find(f=>f.id===e.id).name);}
 assert.deepEqual(g.feats,feats.map(e=>e.id));
 // The comeback needs a near miss first: Top Dog with the ramp one cell out leaves the bone on the rim.
 const c=fresh(9);c.setPlaced([{i:0,gx:5,gy:25},{i:1,gx:14,gy:5}]);c.go();const miss=chain(c);assert.equal(miss.type,'fail');assert.equal(miss.near,true,'bone '+c.marker.x+','+c.marker.y);assert.match(miss.why,/so close/i);settle(c);c.setPlaced(DOMINO_SOLUTIONS[9]);c.go();const cs=[];assert.equal(chain(c,cs).type,'win');for(const e of cs)if(e.type==='feat')earned.add(e.id);
 assert.deepEqual(FEATS.map(f=>f.id).filter(id=>!earned.has(id)),[],'every feat was earned');
});

test('Room of the day: the seed picks a room and a twist, mirrored rooms still solve, house rules apply',()=>{
 assert.equal(TWISTS.length,4);const rooms=new Set(),rules=new Set();let mirrors=0;
 for(let seed=1;seed<400;seed++){const t=DAILY_TWIST(seed);assert.deepEqual(t,DAILY_TWIST(seed));assert.ok(t.room>=1&&t.room<LEVELS.length);assert.ok(TWISTS.some(x=>x.id===t.rule));rooms.add(t.room);rules.add(t.rule);if(t.mirror)mirrors++;}
 assert.equal(rooms.size,LEVELS.length-1,'every room past the tutorial comes up');assert.equal(rules.size,4);assert.ok(mirrors>100);
 const find=ok=>{for(let seed=1;seed<5000;seed++){const t=DAILY_TWIST(seed);if(ok(t))return seed;}throw new Error('no seed');};
 // A mirrored day: the room is flipped, the flipped solution clears it, and the run is that one room.
 const ms=find(t=>t.mirror&&t.rule==='mirror'&&t.room===13),g=createQuickGame('domino',ms);assert.equal(g.daily,false);g.daily=true;assert.equal(g.level,13);assert.equal(g.lv.mirrored,true);assert.equal(g.lv.palette[1],'rampL');assert.equal(g.jump(0),false);g.start();
 assert.ok(g.setPlaced(mirrorPlaced(g.lv,DOMINO_SOLUTIONS[13])));g.go();assert.equal(chain(g).type,'win');settle(g);assert.equal(g.status,'over');assert.match(g.reason,/Room of the day \(Remix, Mirror room\) cleared with 3★ in 1 try, chain \d\.\d s/);
 // Lights low: no forecast. Tight budget: the tray locks at par.
 const b=createQuickGame('domino',find(t=>t.rule==='blind'&&!t.mirror));b.daily=true;b.start();b.grab(0);b.carry(5,8);assert.equal(b.forecast(),null);
 const t=createQuickGame('domino',find(x=>x.rule==='budget'&&!x.mirror&&x.room===14));t.daily=true;t.start();assert.ok(t.setPlaced(DOMINO_SOLUTIONS[14]));t.cursor=snap(t.lv,2,9,12,t.placed);t.events=[];assert.equal(t.act(),false);assert.match(t.events.at(-1).why,/budget/i);
 // Same seed, same day, for everyone; daily saves round-trip mirrored.
 const s=createQuickGame('domino',ms);s.daily=true;s.start();s.setPlaced(mirrorPlaced(s.lv,DOMINO_SOLUTIONS[13]));const snapd=JSON.parse(JSON.stringify(snapshotQuick(s,'domino')));assert.equal(snapd.daily,true);const back=restoreQuick(snapd);assert.ok(back);assert.equal(back.daily,true);assert.equal(back.lv.mirrored,true);assert.deepEqual(back.placed,s.placed);
});

test('Runs save mid-chain and come back exactly; corrupt and pre-pegboard saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('domino'));const g=createQuickGame('domino',5);g.unlocked=13;g.level=12;g.setup();g.start();g.setPlaced(DOMINO_SOLUTIONS[12]);g.go();for(let i=0;i<DOMINO.fps*1.6;i++)g.step();g.events=[];
 const snap1=JSON.parse(JSON.stringify(snapshotQuick(g,'domino')));assert.ok(validDominoSnapshot(snap1));assert.equal(snap1.phase,'run');for(const k of DOMINO_FIELDS)assert.ok(k in snap1,k);assert.ok(DOMINO_FIELDS.includes('feats'));
 const back=restoreQuick(snap1);assert.ok(back);assert.equal(back.status,'paused');back.start();assert.deepEqual(back.sim,g.sim);
 const a=chain(g),b=chain(back);assert.equal(a.type,'win');assert.deepEqual(b,a);assert.deepEqual(back.sim,g.sim);assert.equal(back.score,g.score);assert.deepEqual(back.feats,g.feats);
 // After the win the save carries stars, points and feats.
 const won=JSON.parse(JSON.stringify(snapshotQuick(g,'domino')));assert.equal(won.phase,'won');assert.ok(restoreQuick(won));assert.ok(won.feats.length>=2);
 // Between chains, saves carry the placements, the cursor and the miss marker.
 const p=createQuickGame('domino',5);p.start();p.go();chain(p);settle(p);p.setPlaced(DOMINO_SOLUTIONS[0]);p.cursor={gx:4,gy:7};const ps=JSON.parse(JSON.stringify(snapshotQuick(p,'domino')));assert.equal(ps.sim,null);assert.equal(ps.attempts,1);const pb=restoreQuick(ps);assert.deepEqual(pb.placed,DOMINO_SOLUTIONS[0]);assert.deepEqual(pb.cursor,{gx:4,gy:7});assert.deepEqual(pb.marker,p.marker);
 const bads=[{...snap1,level:LEVELS.length},{...snap1,rev:1},{...snap1,rev:undefined},{...snap1,score:9},{...snap1,unlocked:3},{...snap1,stars:snap1.stars.map(()=>4)},{...snap1,pts:[...snap1.pts.slice(0,-1),5]},{...snap1,feats:['domino.nope']},{...snap1,feats:['domino.first','domino.first']},{...snap1,placed:[{i:0,gx:1,gy:40}]},{...snap1,placed:[{i:0,gx:11,gy:19},{i:0,gx:12,gy:19}]},
  {...snap1,sim:{...snap1.sim,balls:[]}},{...snap1,sim:{...snap1.sim,doms:snap1.sim.doms.map(d=>({...d,a:9}))}},{...snap1,sim:{...snap1.sim,sw:[2]}},{...snap1,sim:{...snap1.sim,saws:[{a:0,av:0}]}},{...snap1,phase:'place'},{...snap1,phase:'flying'},{...ps,sim:snap1.sim},{...snap1,cursor:{gx:-1,gy:0}},{...snap1,codes:[42]},{...snap1,marker:{x:'a',y:1,near:0}},{...snap1,daily:'yes'},{...snap1,fastest:-1}];
 for(const bad of bads)assert.equal(restoreQuick(bad),null,JSON.stringify(bad).slice(0,90));
 // A save from the old landscape rooms (fuses, no rev) is rejected cleanly rather than half-loaded.
 assert.equal(restoreQuick({version:1,kind:'domino',worldSeed:5,score:0,time:1,randomState:1,level:0,fuses:10,cleared:0,phase:'place',phaseT:0,placed:[],cursor:{gx:16,gy:10},fails:0,sim:null,codes:[],runT:0,input:{up:false,down:false,left:false,right:false,act:false},holdT:{},actT:-1}),null);
});
