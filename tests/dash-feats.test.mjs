import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerGame,RUNNER,FEATS,runnerMult} from '../dist/runner-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';

// One row with a crate in the DAWG's lane, about to be crossed.
const crateRow=g=>{g.rows=[{id:++g.spawned,z:.01,safe:0,obstacles:[{lane:g.lane,type:'crate'}],power:null,prize:-1,got:2}];g.jump=.4;g.slide=0;};

test('Dash first person: tricks pay a quarter more, the rest of the score is untouched',()=>{
 const a=new RunnerGame(()=>.5),b=new RunnerGame(()=>.5);a.start();b.start();b.fp=true;for(const g of [a,b]){crateRow(g);g.tick(.001);}
 assert.equal(a.bonus,RUNNER.points.dodge);assert.equal(b.bonus,Math.round(RUNNER.points.dodge*RUNNER.firstPerson));assert.equal(b.fpTricks,1);assert.equal(a.fpTricks,0);
 assert.equal(b.events.find(e=>e.type==='dodge').fp,true);assert.equal(b.score,Math.floor(b.distance)+b.coins*25+b.bonus);assert.equal(a.distance,b.distance);assert.equal(a.coins,b.coins);
 b.streak=RUNNER.perMult*2;crateRow(b);const before=b.bonus;b.tick(.001);assert.equal(b.bonus-before,Math.round(RUNNER.points.dodge*runnerMult(RUNNER.perMult*2+1)*RUNNER.firstPerson));
});
test('Dash feats: every feat can be earned, once per run, and is saved',()=>{
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEATS.map(f=>f.id)).size,FEATS.length);for(const f of FEATS)assert.match(f.id,/^runner\.[a-z0-9]+$/);
 const set={'runner.dodge25':g=>g.dodged=25,'runner.near5':g=>g.nears=5,'runner.prize3':g=>g.prizes=3,'runner.flow5':g=>g.streak=RUNNER.perMult*(RUNNER.maxMult-1),'runner.streak20':g=>g.bestStreak=20,'runner.km':g=>g.distance=1000,'runner.marathon':g=>g.distance=2500,'runner.gold100':g=>g.coins=100,'runner.clean':g=>g.distance=800,'runner.helmet':g=>g.fpTricks=15};
 for(const f of FEATS){const g=new RunnerGame(()=>.5);g.start();g.checkFeats();assert.deepEqual(g.feats,[],f.id);set[f.id](g);g.checkFeats();g.checkFeats();assert.ok(g.feats.includes(f.id),f.id);assert.equal(g.events.filter(e=>e.type==='feat'&&e.id===f.id).length,1);}
 const hit=new RunnerGame(()=>.5);hit.start();hit.hits=1;hit.distance=900;hit.checkFeats();assert.ok(!hit.feats.includes('runner.clean'));
 // Earned by play: fifteen first-person dodges in a row also builds the flow to ×5.
 const g=createQuickGame('runner',5);g.start();g.fp=true;for(let i=0;i<15;i++){crateRow(g);g.tick(.001);}assert.ok(g.feats.includes('runner.helmet'));assert.ok(g.feats.includes('runner.flow5'));
 const snap=snapshotQuick(g,'runner'),back=restoreQuick(JSON.parse(JSON.stringify(snap)));assert.ok(back);assert.deepEqual(back.feats,g.feats);assert.equal(back.fpTricks,15);assert.deepEqual(snapshotQuick(back,'runner'),snap);
 assert.equal(restoreQuick({...snap,feats:['runner.nope']}),null);assert.equal(restoreQuick({...snap,feats:[g.feats[0],g.feats[0]]}),null);assert.equal(restoreQuick({...snap,fpTricks:-1}),null);
 const old={...snap};delete old.feats;delete old.fpTricks;const legacy=restoreQuick(old);assert.ok(legacy,'a save from before the feats still loads');assert.deepEqual(legacy.feats,[]);assert.equal(legacy.fpTricks,0);
});
