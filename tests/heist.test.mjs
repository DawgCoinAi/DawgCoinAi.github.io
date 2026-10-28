import test from 'node:test';
import assert from 'node:assert/strict';
import {HeistGame,HEISTS,HEIST,LOOP_FRAMES,heistMap,guardAt,encode,decode,validHeistSnapshot,HEIST_FIELDS} from '../dist/heist-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';
import {SOLUTIONS,frames} from './heist-solutions.mjs';

const setInput=(g,b)=>{g.input={up:!!(b&1),down:!!(b&2),left:!!(b&4),right:!!(b&8)};};
// Plays one crew member's script until their loop ends; returns the first notable event.
function playMember(g,script){const fr=frames(script);let f=0;while(g.status==='playing'){setInput(g,fr[f]??0);g.step();f++;const ev=g.events;g.events=[];const e=ev.find(e=>['alarm','clear','planfail','loop'].includes(e.type));if(e)return e;}return null;}

test('Every heist parses: one start, a van, loot, and a plate for every door and a switch for every laser',()=>{
 for(let i=0;i<HEISTS.length;i++){const m=heistMap(i);assert.ok(m.start&&m.van.length&&m.loot.length,m.name);assert.ok(m.rows.every(r=>r.length===m.W),m.name+' rows line up');
  for(const d of m.doors)assert.ok(m.plates.some(p=>p.id===d.id),m.name+' door has a plate');for(const l of m.lasers)assert.ok(m.switches.some(s=>s.id===l.id),m.name+' laser has a switch');assert.ok(m.crew>=2&&m.crew<=5);}
});

test('A scripted crew pulls off all five heists in one run, each in its crew limit',()=>{
 const g=new HeistGame(()=>.5,1);g.start();
 for(let L=0;L<HEISTS.length;L++){const sol=SOLUTIONS[L];assert.ok(sol.length<=HEISTS[L].crew);let last=null;for(const s of sol){last=playMember(g,s);assert.notEqual(last?.type,'alarm',HEISTS[L].name+' '+JSON.stringify(last));if(last?.type==='clear')break;}assert.equal(last?.type,'clear',HEISTS[L].name);}
 assert.equal(g.status,'over');assert.equal(g.cleared,5);assert.match(g.reason,/Every heist/);assert.ok(g.score>10000);
});

test('Past loops replay their inputs exactly, and the world they act on is shared',()=>{
 const g=new HeistGame(()=>.5,1);g.start();assert.equal(playMember(g,SOLUTIONS[0][0]).type,'loop');assert.equal(g.recs.length,1);assert.equal(decode(g.recs[0]).length,LOOP_FRAMES);
 // Loop two: the ghost walks to the plate again, so the door opens for you.
 for(let f=0;f<90;f++){setInput(g,0);g.step();}const m=heistMap(0),ghost=g.members[0];assert.equal(Math.floor(ghost.x),m.plates[0].c);assert.equal(Math.floor(ghost.y),m.plates[0].r);assert.deepEqual(g.open,[true]);
});

test('Getting caught throws the take away; ruining a past self’s take is a paradox',()=>{
 const g=new HeistGame(()=>.5,1);g.level=1;g.setup();g.start();
 const e=playMember(g,[['down',.28],['right',2.78]]);assert.equal(e.type,'alarm');assert.equal(e.how,'laser');assert.equal(e.ghost,false);assert.equal(g.recs.length,0);assert.equal(g.takes,1);assert.equal(g.frame,0,'the loop restarts');
 // Kennel Reserve: loop one leans on the closed door all loop. Loop two holds the plate, the door opens, and past you strolls into the guard.
 const v=new HeistGame(()=>.5,1);v.level=4;v.setup();v.start();assert.equal(playMember(v,[['down',.28],['right',29.7]]).type,'loop');
 const p=playMember(v,[['right',.64],['down',.56],['wait',28]]);assert.equal(p.type,'alarm');assert.equal(p.ghost,true);assert.equal(p.k,0);assert.match(p.line,/past|Paradox|yourself/);
});

test('Running out of crew costs a life; three failed plans end the run',()=>{
 const g=new HeistGame(()=>.5,1);g.start();for(let i=0;i<HEIST.lives*HEISTS[0].crew;i++)playMember(g,[['wait',1]]);assert.equal(g.status,'over');assert.equal(g.lives,0);assert.match(g.reason,/fell apart/);
});

test('Guards walk their loop and look the way they walk',()=>{const gd=heistMap(2).guards[0],a=guardAt(gd,0),b=guardAt(gd,gd.total/gd.speed);assert.ok(Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9);assert.equal(a.a,0,'starts facing right');assert.ok(Math.abs(guardAt(gd,3).a-Math.PI/2)<1e-9,'then down the right side');});

test('Heist runs save mid-loop and come back exactly; bad saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('heist'));assert.deepEqual(decode(encode([0,0,3,3,3,8])),[0,0,3,3,3,8]);
 const g=createQuickGame('heist',5);g.start();playMember(g,SOLUTIONS[0][0]);const fr=frames(SOLUTIONS[0][1]);for(let f=0;f<100;f++){setInput(g,fr[f]);g.step();}g.events=[];
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'heist')));assert.ok(validHeistSnapshot(snap));const back=restoreQuick(snap);assert.ok(back);assert.equal(back.status,'paused');
 for(let k=0;k<g.members.length;k++){assert.ok(Math.abs(back.members[k].x-g.members[k].x)<1e-9&&Math.abs(back.members[k].y-g.members[k].y)<1e-9,'member '+k);}
 back.start();for(let f=100;f<fr.length+60;f++){setInput(back,fr[f]??0);back.step();}assert.equal(back.level,1,'the restored run finishes the heist');
 for(const bad of [{...snap,level:9},{...snap,recs:[[[0,5]]]},{...snap,cur:[99]},{...snap,lives:0}])assert.equal(restoreQuick(bad),null);
});
