import test from 'node:test';
import assert from 'node:assert/strict';
import {BarkGame,BARK,roofRadius,validBarkSnapshot,BARK_FIELDS,ordinalSuffix} from '../dist/bark-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

const run=(g,s,input={})=>{Object.assign(g.input,input);for(let t=0;t<s;t+=1/60)g.tick(1/60);};
// A plain bot for the player: stay central, face the nearest rival, bark when close.
const bot=g=>{const you=g.you,n=g.nearest(you),I=g.input;I.left=you.x>.5;I.right=you.x<-.5;I.up=you.y>.5;I.down=you.y<-.5;if(n){const dx=n.x-you.x,dy=n.y-you.y,d=Math.hypot(dx,dy);if(d<3){I.left=dx<0;I.right=dx>0;I.up=dy<0;I.down=dy>0;}I.bark=d<3.2&&you.charge<.9;}else I.bark=false;};

test('Twenty on the roof, the ring holds for the grace period then shrinks to its minimum',()=>{
 const g=new BarkGame(seededRandom(1),1);assert.equal(g.dawgs.length,BARK.count);assert.equal(g.alive,BARK.count);assert.equal(g.you.k,0);assert.ok(g.dawgs.slice(1).every(d=>['brawler','bully','coward','drifter'].includes(d.style)));
 assert.equal(roofRadius(0),BARK.radius);assert.equal(roofRadius(BARK.grace),BARK.radius);assert.ok(roofRadius(50)<BARK.radius);assert.ok(Math.abs(roofRadius(BARK.length)-BARK.minRadius)<1e-9);
});

test('A charged bark throws a rival in the cone, further with more charge, and recoils you',()=>{
 const g=new BarkGame(seededRandom(2),2);g.start();const you=g.you,r=g.dawgs[1];for(const d of g.dawgs)if(d.k>1)d.alive=false;g.alive=2;you.x=0;you.y=0;you.face=0;r.x=2;r.y=0;r.vx=r.vy=0;r.style='coward';r.think=99;
 g.events=[];you.charge=.3;g.bark(you);const weak=r.vx;assert.ok(weak>0,'pushed away along the bark');assert.ok(you.vx<0,'recoil');assert.ok(g.events.some(e=>e.type==='hit'&&e.k===1));
 r.vx=0;you.cool=0;you.charge=1;g.events=[];g.bark(you);assert.ok(r.vx>weak*1.8,'a full charge hits much harder');assert.ok(g.events.find(e=>e.type==='bark').mega);
 r.x=-2;r.vx=0;you.cool=0;you.charge=1;g.events=[];g.bark(you);assert.equal(r.vx,0,'behind you is safe');
});

test('Off the roof is out, knock-offs are credited, and the last one standing wins',()=>{
 const g=new BarkGame(seededRandom(3),3);g.start();for(const d of g.dawgs){if(d.k>1){d.alive=false;}}g.alive=2;const r=g.dawgs[1];r.x=BARK.radius-.5;r.y=0;r.vx=0;r.hitBy=0;r.hitT=g.time;g.you.x=0;g.you.y=0;r.think=99;r.style='coward';r.vx=12;
 run(g,2);assert.equal(r.alive,false);assert.equal(g.kos,1);assert.equal(g.place,1);assert.equal(g.status,'over');assert.match(g.reason,/Last bark standing/);assert.equal(g.score,Math.floor(g.time)*5+g.bonus);
 const l=new BarkGame(seededRandom(4),4);l.start();l.you.x=BARK.radius+1;run(l,2);assert.equal(l.status,'over');assert.equal(l.place,BARK.count);assert.match(l.reason,/20th of 20/);assert.equal(ordinalSuffix(2),'nd');assert.equal(ordinalSuffix(12),'th');
});

test('Matches are deterministic for a seed and end by the clock at the latest',()=>{
 const a=new BarkGame(seededRandom(9),9),b=new BarkGame(seededRandom(9),9);for(const g of [a,b]){g.start();while(g.status==='playing'&&g.time<20){bot(g);g.tick(1/60);}}
 assert.deepEqual(a.dawgs.map(d=>[d.x,d.y,d.alive]),b.dawgs.map(d=>[d.x,d.y,d.alive]));assert.equal(a.score,b.score);
 const g=new BarkGame(seededRandom(5),5);g.start();while(g.status==='playing'){bot(g);g.tick(1/60);}assert.ok(g.time<=BARK.length+.05);assert.ok(g.place>=1&&g.place<=BARK.count);assert.ok(g.alive>=1);
});

test('The AI fights: across a few seeds rivals knock each other off and barks land',()=>{
 let outs=0,hits=0;for(let s=11;s<15;s++){const g=new BarkGame(seededRandom(s),s);g.start();g.you.alive=false;g.alive--;g.you.fall=BARK.fall;for(let t=0;t<40&&g.status==='playing';t+=1/60){g.tick(1/60);for(const e of g.events){if(e.type==='out')outs++;if(e.type==='hit')hits++;}g.events=[];}}
 assert.ok(outs>=4,'rivals go off the roof: '+outs);assert.ok(hits>40,'barks land: '+hits);
});

test('Rooftop runs save mid-match and come back exactly; bad saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('bark'));const g=createQuickGame('bark',21);g.start();for(let t=0;t<6;t+=1/60){bot(g);g.tick(1/60);}g.events=[];
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'bark')));assert.ok(validBarkSnapshot(snap));const back=restoreQuick(snap);assert.ok(back);assert.equal(back.status,'paused');
 for(const k of BARK_FIELDS)assert.deepEqual(back[k],g[k],k);back.start();for(let t=0;t<3;t+=1/60){bot(back);back.tick(1/60);bot(g);g.tick(1/60);}assert.deepEqual(back.dawgs.map(d=>[d.x,d.y]),g.dawgs.map(d=>[d.x,d.y]));
 for(const bad of [{...snap,score:snap.score+1},{...snap,alive:5},{...snap,dawgs:snap.dawgs.slice(1)},{...snap,input:{up:1}}])assert.equal(restoreQuick(bad),null);
});
