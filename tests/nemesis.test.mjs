import test from 'node:test';
import assert from 'node:assert/strict';
import {NemesisGame,NEM,MOVES,tileOf,posClass,beatLength,phaseOf,habitLine,validProfile,validNemesisSnapshot,NEMESIS_FIELDS} from '../dist/nemesis-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick,QUICK_MODES} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

const beat=g=>{g.tick(g.beatLen-g.t+1e-6);};
const safe=g=>g.options().filter(([m,t])=>!g.marks.includes(t)&&t!==g.guess);
// Players: one with a fixed preference order, one that picks any unmarked step at random.
const habitual=g=>{const o=g.options().filter(([m,t])=>!g.marks.includes(t)),order=[3,4,1,2,0];o.sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));return o[0]?.[0]??0;};
const randomly=(g,r)=>{const o=g.options().filter(([m,t])=>!g.marks.includes(t));return o.length?o[Math.floor(r()*o.length)][0]:0;};
const play=(seed,pick,max=400)=>{const g=new NemesisGame(seededRandom(seed),seed),r=seededRandom(seed+99);g.start();while(g.status==='playing'&&g.beat<max){const m=pick(g,r);if(m)g.move(MOVES[m]);beat(g);g.events=[];}return g;};

test('The floor, the tempo and the phases',()=>{
 assert.equal(posClass(2,2),0);assert.equal(posClass(0,2),1);assert.equal(posClass(4,4),2);assert.equal(tileOf(4,4),24);assert.ok(beatLength(0)>beatLength(80));assert.equal(beatLength(1e4),NEM.beat1);
 assert.equal(phaseOf(5).sweep,false);assert.equal(phaseOf(16).sweep,true);assert.equal(phaseOf(22).sweep,false);assert.equal(phaseOf(80).blackout,true);assert.equal(phaseOf(112).mirror,true);assert.equal(phaseOf(119).mirror,false);
});

test('Every beat is fair: there is always a step that is neither marked nor the guess',()=>{
 for(let seed=1;seed<=6;seed++){const g=new NemesisGame(seededRandom(seed),seed),r=seededRandom(seed*7);g.start();for(let i=0;i<260&&g.status==='playing';i++){assert.ok(safe(g).length>=1,`seed ${seed} beat ${g.beat}`);assert.ok(!g.marks.includes(g.guess));const s=safe(g),pick=s[Math.floor(r()*s.length)][0];if(pick)g.move(MOVES[pick]);beat(g);g.events=[];}}
});

test('One step a beat; walls stop you without using it; standing on a mark costs a heart',()=>{
 const g=new NemesisGame(seededRandom(3),3);g.start();g.guess=-1;g.marks=[];assert.ok(g.move('left'));assert.equal(g.c,1);assert.equal(g.move('left'),false,'one step per beat');
 beat(g);g.c=0;g.r=0;g.marks=[];g.guess=-1;assert.equal(g.move('up'),false);assert.equal(g.moved,false,'a bump is not a step');assert.ok(g.move('right'));
 const h=new NemesisGame(seededRandom(4),4);h.start();h.guess=-1;h.marks=[h.tile];h.events=[];beat(h);assert.equal(h.hearts,NEM.hearts-1);assert.equal(h.events.find(e=>e.type==='hit').how,'blasted');assert.equal(h.mult,1);
});

test('It learns a habit, arms a guess on it, and says exactly what it noticed',()=>{
 const g=new NemesisGame(seededRandom(5),5);g.start();
 // Teach it: in the open, after going left, this player goes right; after right, left.
 const ctxL=3*3+0,ctxR=4*3+0;g.counts[ctxL][4]=12;g.counts[ctxR][3]=12;g.c=2;g.r=2;g.last=3;g.beat=40;let armed=false;for(let i=0;i<20&&!armed;i++){g.plan();armed=g.guess>=0;}
 assert.ok(armed,'confident enough to guess');assert.equal(g.guessMove,4);assert.equal(g.guess,tileOf(3,2));assert.ok(!g.marks.includes(g.guess),'the guess is never shown');assert.ok(g.read>.6);
 g.events=[];const hearts=g.hearts;g.move('right');beat(g);const hit=g.events.find(e=>e.type==='hit');assert.equal(hit.how,'predicted');assert.equal(g.hearts,hearts-1);assert.equal(g.preds,1);assert.match(hit.line,/After going left in the open, you go right \d+% of the time\. It noticed\./);
 assert.equal(habitLine({after:0,where:2,move:0,pct:80}),'After standing still in a corner, you stand still 80% of the time. It noticed.');
});

test('Dodging an armed guess is an outsmart: multiplier up and points',()=>{
 const g=new NemesisGame(seededRandom(6),6);g.start();g.counts[0*3+0][3]=15;g.c=2;g.r=2;g.last=0;g.beat=60;let tries=0;do{g.plan();}while(g.guess<0&&tries++<30);assert.ok(g.guess>=0);
 const s=safe(g);assert.ok(s.length);g.events=[];const before=g.bonus;if(s[0][0])g.move(MOVES[s[0][0]]);beat(g);assert.equal(g.outs,1);assert.equal(g.mult,2);assert.ok(g.events.some(e=>e.type==='outsmart'));assert.ok(g.bonus>=before+100+20);assert.equal(g.score,g.bonus);
});

test('Habits get you killed: a predictable player falls far sooner than an unpredictable one',()=>{
 let h=0,r=0;for(let seed=1;seed<=5;seed++){const a=play(seed,habitual),b=play(seed,randomly);h+=a.beat;r+=b.beat;assert.equal(a.status,'over');assert.ok(a.preds>=2,'mostly predicted, seed '+seed);}
 assert.ok(r>h*1.8,`random ${r} vs habitual ${h}`);
});

test('Bones are bait: taking one pays, a rigged one costs a heart, and it counts how often you bite',()=>{
 const g=new NemesisGame(seededRandom(7),7);g.start();g.marks=[];g.guess=-1;g.c=2;g.r=2;g.bone={t:tileOf(3,2),ttl:3,rigged:false};g.baitOffered=1;g.events=[];g.move('right');assert.equal(g.bone,null);assert.equal(g.baitTaken,1);assert.equal(g.bonus,100);
 g.moved=false;g.bone={t:tileOf(4,2),ttl:3,rigged:true};g.events=[];g.move('right');assert.equal(g.hearts,NEM.hearts-1);assert.equal(g.events.find(e=>e.type==='hit').how,'baited');assert.equal(g.baited,1);
});

test('MIRROR swaps left and right; the game is deterministic for a seed',()=>{
 const g=new NemesisGame(seededRandom(8),8);g.start();g.beat=112;g.c=2;g.r=2;assert.ok(g.phase.mirror);g.move('left');assert.equal(g.c,3);
 const a=play(11,randomly,60),b=play(11,randomly,60);for(const k of NEMESIS_FIELDS)assert.deepEqual(a[k],b[k],k);assert.equal(a.score,b.score);
});

test('It remembers you between runs, faded; and the verdict reads your file back',()=>{
 const g=play(2,habitual);const p=g.exportProfile();assert.ok(validProfile(p));assert.equal(p.runs,1);assert.match(g.reason,/beats\. Predicted \d+, outsmarted it \d+/);assert.ok(g.dossier().length>=1);
 const n=new NemesisGame(seededRandom(9),9);assert.ok(n.loadProfile(JSON.parse(JSON.stringify(p))));assert.equal(n.runs,1);const total=c=>c.flat().reduce((a,b)=>a+b,0);assert.ok(Math.abs(total(n.counts)-total(p.counts)/2)<.5,'memory fades by half');
 for(const bad of [null,{v:2},{...p,counts:p.counts.slice(1)},{...p,baitTaken:99,baitOffered:1},{...p,runs:-1}])assert.equal(new NemesisGame(seededRandom(1),1).loadProfile(bad),false);
});

test('Runs save mid-beat and come back exactly; bad saves are refused',()=>{
 assert.ok(QUICK_MODES.includes('nemesis'));const g=createQuickGame('nemesis',31),r=seededRandom(5);g.start();for(let i=0;i<25;i++){const m=randomly(g,r);if(m)g.move(MOVES[m]);beat(g);}g.tick(.1);g.events=[];
 const snap=JSON.parse(JSON.stringify(snapshotQuick(g,'nemesis')));assert.ok(validNemesisSnapshot(snap));const back=restoreQuick(snap);assert.ok(back);for(const k of NEMESIS_FIELDS)assert.deepEqual(back[k],JSON.parse(JSON.stringify(g[k])),k);
 back.start();const r1=seededRandom(77),r2=seededRandom(77);for(let i=0;i<10;i++){for(const [x,rr] of [[back,r1],[g,r2]]){const m=randomly(x,rr);if(m)x.move(MOVES[m]);beat(x);}}assert.deepEqual(back.marks,g.marks);assert.equal(back.score,g.score);
 for(const bad of [{...snap,score:snap.score+5},{...snap,c:9},{...snap,marks:[1,1]},{...snap,guess:snap.marks[0]??0,marks:[snap.marks[0]??0]},{...snap,hearts:0}])assert.equal(restoreQuick(bad),null);
});
