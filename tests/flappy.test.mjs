import test from 'node:test';
import assert from 'node:assert/strict';
import {FlappyGame,FLAPPY,FLAPPY_FEATS,FLAPPY_DAILY_TWIST,stepPack} from '../dist/pack-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';

const fresh=()=>{const g=new FlappyGame(()=>.5);g.start();return g;};
// Puts one gate just behind DAWG so the next tick scores it.
const gate=(g,y=250,center=250)=>{g.vy=0;g.y=y;g.obstacles=[{x:20,width:66,center,gap:200,passed:false}];g.tick(.001);};
const bot=(g,frames,each)=>{for(let i=0;i<frames&&g.status==='playing';i++){const o=g.obstacles.find(o=>o.x+o.width>g.x-14);if(g.y>(o?.center||270)+8&&g.vy>0)g.flap();each?.(i);stepPack(g,1/60);}return g;};

test('Flappy dive: drops hard, burns forward, has a cooldown, and threading a gate pays extra',()=>{
 const g=fresh();g.vy=-200;const slow=g.speed;assert.equal(g.dive(),true);assert.equal(g.vy,330);assert.ok(g.boost>0);assert.equal(g.speed,slow*FLAPPY.boostSpeed);assert.equal(g.dive(),false,'cooling down');
 gate(g,200);assert.equal(g.score,25,'10 for the gate, 15 for threading it');assert.equal(g.threads,1);assert.ok(g.events.some(e=>e.type==='score'&&e.threaded&&!e.perfect));
 g.diveCd=0;g.dive();gate(g);assert.equal(g.score,25+10+5+25,'a perfect thread pays 25 on top of the ring');assert.equal(g.perfectThreads,1);
 const h=fresh();h.dive();h.obstacles=[{x:9000,width:66,center:250,gap:200,passed:false}];for(let i=0;i<150;i++){h.y=200;h.vy=0;h.tick(.01);}assert.equal(h.boost,0);assert.equal(h.diveCd,0);
 const crash=fresh();crash.dive();crash.y=80;crash.obstacles=[{x:100,width:66,center:250,gap:180,passed:false}];crash.tick(.001);assert.match(crash.reason,/Dived straight into a tower/);
});
test('Flappy gold: each coin pays 5, a complete line pays 20 more, and the fireworks pay double',()=>{
 const g=fresh();g.obstacles=[{x:900,width:66,center:250,gap:200,passed:false}];g.vy=0;g.y=250;g.coins=[{x:110,y:250,line:1,size:2,got:false},{x:114,y:252,line:1,size:2,got:false},{x:300,y:250,line:2,size:4,got:false}];g.tick(.001);
 assert.equal(g.gold,2);assert.equal(g.lines,1);assert.equal(g.score,30);assert.equal(g.events.filter(e=>e.type==='gold').length,2);assert.equal(g.events.find(e=>e.line).line,20);g.tick(.001);assert.equal(g.score,30,'collected once');
 const rush=fresh();rush.gates=24;assert.equal(rush.zone,3);rush.obstacles=[{x:900,width:66,center:250,gap:200,passed:false}];rush.vy=0;rush.y=250;rush.coins=[{x:110,y:250,line:1,size:4,got:false}];rush.tick(.001);assert.equal(rush.score,10);assert.equal(rush.rushGold,1);
});
test('Flappy winds: a thermal carries DAWG up at a capped rate, a downdraft adds weight',()=>{
 const run=(f,vy)=>{const g=fresh();g.obstacles=[{x:900,width:66,center:250,gap:200,passed:false}];g.winds=f?[{x:90,w:70,f}]:[];g.y=300;g.vy=vy;g.tick(.01);return g;};
 const calm=run(0,100),up=run(-1,100),down=run(1,100);assert.ok(up.vy<calm.vy&&down.vy>calm.vy);assert.equal(up.lift,-1);assert.equal(down.lift,1);assert.equal(calm.lift,0);
 assert.equal(run(-1,-304).vy,-140,'the lift is capped, so a burn inside a thermal cannot launch you');
 const g=bot(createQuickGame('flappy',7),1);g.start();bot(g,60*40);
 assert.equal(g.status,'playing');assert.ok(g.gold>0,'a generated world lays gold on the way');assert.ok(g.winds.every(w=>w.w===70&&Math.abs(w.f)===1));
});
test('Flappy ladder: a new sky every eight gates, named, with the next one counted down',()=>{
 const g=fresh();assert.equal(g.stageName,'GOLDEN HOUR');assert.equal(g.toNext,8);g.gates=7;gate(g);assert.equal(g.stage,1);assert.equal(g.zone,1);assert.equal(g.stageName,'NEON NIGHT');assert.deepEqual(g.events.find(e=>e.type==='zone'),{type:'zone',zone:1});
 g.gates=33;assert.equal(g.stageName,'GOLDEN HOUR II');assert.equal(g.toNext,7);g.obstacles=[{x:900,width:66,center:250,gap:200,passed:false}];g.y=515;g.vy=0;g.tick(.01);assert.equal(g.status,'over');assert.match(g.reason,/You reached GOLDEN HOUR II, gate 33/);
});
test('Flappy first person pays a quarter more',()=>{const g=fresh();g.fp=true;gate(g,200);assert.equal(g.score,13);assert.equal(g.fpGates,1);gate(g);assert.equal(g.score,13+13+6);});
test('Flappy feats: every feat can be earned, once per run, and is saved',()=>{
 assert.ok(FLAPPY_FEATS.length>=8);assert.equal(new Set(FLAPPY_FEATS.map(f=>f.id)).size,FLAPPY_FEATS.length);for(const f of FLAPPY_FEATS)assert.match(f.id,/^flappy\.[a-z0-9]+$/);
 const set={'flappy.needle':g=>g.streak=5,'flappy.threader':g=>g.threads=3,'flappy.bullseye':g=>g.perfectThreads=1,'flappy.lines':g=>g.lines=5,'flappy.gold50':g=>g.gold=50,'flappy.rush':g=>g.rushGold=12,'flappy.saved':g=>g.saved=1,'flappy.storm':g=>g.gates=24,'flappy.fullday':g=>g.gates=32,'flappy.helmet':g=>g.fpGates=10};
 for(const f of FLAPPY_FEATS){const g=fresh();g.checkFeats();assert.deepEqual(g.feats,[],f.id);set[f.id](g);g.checkFeats();g.checkFeats();assert.ok(g.feats.includes(f.id),f.id);assert.equal(g.events.filter(e=>e.type==='feat'&&e.id===f.id).length,1);}
 // Earned by play: five rings in a row, three dives through gates, and a shield that saves the run.
 const g=fresh();for(let i=0;i<5;i++)gate(g);assert.ok(g.feats.includes('flappy.needle'));for(let i=0;i<3;i++){g.diveCd=0;g.dive();gate(g);}assert.ok(g.feats.includes('flappy.threader'));assert.ok(g.feats.includes('flappy.bullseye'));
 assert.equal(g.shield,true);g.boost=0;g.vy=0;g.y=80;g.obstacles=[{x:100,width:66,center:250,gap:180,passed:false}];g.tick(.001);assert.equal(g.shield,false);assert.equal(g.status,'playing');g.ghost=0;gate(g);assert.ok(g.feats.includes('flappy.saved'));
 const snap=snapshotQuick(g,'flappy'),back=restoreQuick(JSON.parse(JSON.stringify(snap)));assert.deepEqual(back.feats,g.feats);assert.equal(restoreQuick({...snap,feats:['flappy.nope']}),null);assert.equal(restoreQuick({...snap,feats:[g.feats[0],g.feats[0]]}),null);
});
test('Flappy saves: the new state round-trips, saves from before the rebuild still load, bad values are rejected',()=>{
 const g=createQuickGame('flappy',91);g.start();bot(g,60*12,i=>{if(i===300)g.dive();});assert.equal(g.status,'playing');
 const snap=snapshotQuick(g,'flappy'),back=restoreQuick(JSON.parse(JSON.stringify(snap)));assert.ok(back);assert.deepEqual(snapshotQuick(back,'flappy'),{...snap});back.start();for(let i=0;i<120;i++){g.tick(1/120);back.tick(1/120);}assert.deepEqual(snapshotQuick(back,'flappy'),snapshotQuick(g,'flappy'));
 const old={...snap};for(const k of ['coins','winds','gold','lines','lineSeq','boost','diveCd','threads','fp','daily','feats','perfectThreads','rushGold','saved','hurt','fpGates'])delete old[k];const legacy=restoreQuick(old);assert.ok(legacy);assert.deepEqual(legacy.coins,[]);assert.deepEqual(legacy.feats,[]);assert.equal(legacy.gold,0);
 for(const bad of [{coins:[{x:1,y:1,line:1,size:1,got:false}]},{winds:[{x:10,w:70,f:2}]},{boost:5},{diveCd:-1},{threads:snap.gates+1},{fp:'yes'},{coins:'none'}])assert.equal(restoreQuick({...snap,...bad}),null,JSON.stringify(bad));
});
test('Flappy is seed-true, and a daily run plays its twist',()=>{
 const play=(seed,daily)=>{const g=createQuickGame('flappy',seed);g.daily=daily;g.start();return bot(g,60*20);};
 assert.deepEqual(snapshotQuick(play(77,false),'flappy'),snapshotQuick(play(77,false),'flappy'));assert.notDeepEqual(play(77,false).obstacles,play(78,false).obstacles);
 const ids=new Set();for(let s=0;s<8;s++){const t=FLAPPY_DAILY_TWIST(s);ids.add(t.id);assert.ok(t.name&&t.text);}assert.equal(ids.size,4);
 const tail=createQuickGame('flappy',4),plain=createQuickGame('flappy',4);tail.daily=true;assert.equal(tail.twist.id,'tailwind');assert.equal(plain.twist,null);assert.ok(Math.abs(tail.speed-plain.speed*1.1)<1e-9);tail.start();gate(tail,200);assert.equal(tail.score,12);
 const night=createQuickGame('flappy',7);night.daily=true;assert.equal(night.twist.id,'nightshift');assert.equal(night.zone,1);
 const rush=createQuickGame('flappy',5);rush.daily=true;assert.equal(rush.twist.id,'goldrush');rush.start();rush.obstacles=[{x:900,width:66,center:250,gap:200,passed:false}];rush.winds=[];rush.vy=0;rush.y=250;rush.coins=[{x:110,y:250,line:1,size:4,got:false}];rush.tick(.001);assert.equal(rush.score,10);
 const s=snapshotQuick(play(4,true),'flappy');assert.equal(s.daily,true);assert.equal(restoreQuick(s).daily,true);
});
