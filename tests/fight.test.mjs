import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,stepAuto,replay,hashState,K,FEATS,FEAT_IDS,DAILY_TWIST,freshSave,validFightSave,trialDone} from '../dist/fight-engine.js';
import {FIGHTERS,FIGHTER_IDS,fighter,IN,SLOTS,STAGES,STAGE_IDS,FINISHERS,FINISHER_IDS,finishersFor,MOD_IDS,trialsFor,STARTERS,TOWER} from '../dist/fight-roster.js';
import {CINES,CINE_IDS,CINE_DUR,DIRECTOR} from '../dist/fight-cine.js';
import {validMoment,momentFor,momentText,MOMENT_KINDS} from '../dist/fight-replay.js';
import {POSE,CLIP,N} from '../dist/fight-poses.js';
import {parseBackup} from '../dist/progress-backup.js';
import {GAME_IDS} from '../dist/games.js';

const {U,D,L,R,A,B,S,G}=IN;
// A match with both sides driven by the test, skipped past the intro, fighters placed where asked.
const duel=(p=['biscuit','moxie'],o={})=>{const g=createMatch({seed:7,p,cpu:[0,0],human:[0],...o});while(g.phase==='intro')step(g);for(let i=0;i<12;i++)step(g,0,o.guard||0);if(o.gap!==undefined){g.f[0].x=-o.gap/2;g.f[1].x=o.gap/2;}return g;};
// Run a script: fn(i, g) → [in0, in1] for n frames; collects the events.
const run=(g,n,fn=()=>[0,0])=>{const ev=[];for(let i=0;i<n&&g.phase!=='over';i++){const [a,b]=fn(i,g)||[0,0];ev.push(...step(g,a||0,b||0));}return ev;};
const tap=(bits,at=0,len=2)=>i=>i>=at&&i<at+len?bits:0;
const has=(ev,type)=>ev.some(e=>e.type===type);
const mulberry=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};

test('The same seed and input log always replays the same match',()=>{
 const r=mulberry(11),log=[];let held=0;for(let i=0;i<900;i++){if(i%7===0)held=[0,R,R,R|A,A,B,D|A,L,G,U|R,S,R|S,D|B,A|B][Math.floor(r()*14)];log.push([held,0]);}
 const cfg={seed:4242,p:['zip','tank'],stage:'docks',cpu:[0,4]},a=replay(cfg,log),b=replay(cfg,log);
 assert.equal(hashState(a),hashState(b));assert.equal(a.frame,b.frame);assert.deepEqual(a.f.map(f=>[f.x,f.y,f.hp,f.meter,f.st]),b.f.map(f=>[f.x,f.y,f.hp,f.meter,f.st]));
 const c=replay({...cfg,seed:4243},log);assert.notEqual(hashState(a),hashState(c),'another seed gives the rival other ideas');
 assert.ok(a.f[0].hp<a.f[0].max||a.f[1].hp<a.f[1].max,'something happened in 15 seconds');
});

test('Frame data is sane for every move of every fighter',()=>{
 assert.ok(FIGHTERS.length>=10);assert.equal(new Set(FIGHTER_IDS).size,FIGHTER_IDS.length);
 const arche=new Set(FIGHTERS.map(f=>f.arche));for(const a of ['RUSHDOWN','ZONER','GRAPPLER','COUNTER','TRICKSTER','HEAVY','SPEEDSTER','WEAPON','BOSS'])assert.ok(arche.has(a),a);
 for(const F of FIGHTERS){assert.ok(F.hp>=850&&F.hp<=1300,F.id);assert.ok(F.walk>.03&&F.walk<.09);assert.ok(F.intro&&F.win&&F.ending&&F.bio);assert.equal(F.specials.length,4,F.id+' has four specials');assert.equal(F.fins.length,3);
  for(const [id,m]of Object.entries(F.moves)){const tag=F.id+'/'+id;
   assert.ok(Number.isInteger(m.s)&&m.s>=1,tag+' startup');assert.ok(Number.isInteger(m.a)&&m.a>=0,tag+' active');assert.ok(Number.isInteger(m.r)&&m.r>=0,tag+' recovery');assert.ok(m.s+m.a+m.r>=10||m.air,tag+' takes time');
   assert.ok(m.dmg>=0&&m.dmg*m.hits<=360,tag+' damage '+m.dmg*m.hits);assert.ok(['high','mid','low','over','throw'].includes(m.lv),tag);assert.ok(m.y[1]>m.y[0],tag);assert.ok(m.hits>=1);if(m.hits>1){assert.ok(m.gap>=1,tag);assert.ok(m.s+1+(m.hits-1)*m.gap<=m.s+m.a||m.fall,tag+' fits its hits in the active window');}
   assert.ok(CLIP[m.anim],tag+' has an animation: '+m.anim);for(const c of m.cancel)assert.ok(c==='sp'||c==='su'||F.moves[c],tag+' cancels into '+c);
   if(m.kind==='normal'&&m.dmg>0&&m.lv!=='throw'&&!m.air)assert.ok(m.hs-(m.a+m.r)<=8,tag+' is not wildly plus on hit');
   if(m.lv!=='throw'&&m.dmg>0&&!m.air)assert.ok(m.bs-m.r<=4,tag+' is not plus enough on block to loop');
   if(m.counter)assert.ok(F.moves[m.counter.then],tag+' counter follow-up exists');if(m.proj){assert.ok(m.proj.life>0&&m.proj.dmg>0&&m.proj.hits>=1,tag);}
   if(m.ex)assert.equal(m.cost,100,tag);if(m.kind==='super'&&!m.hidden)assert.equal(m.cost,200,tag);}
  // Every special has an input (a motion and an easy direction), an amped version and a name.
  F.specials.forEach((id,i)=>{assert.ok(F.moves[id].name&&F.moves[id+'+'],F.id+'/'+id);assert.equal(F.moves[id].slot,i);assert.ok(SLOTS[i].motion&&SLOTS[i].easy);});
  assert.equal(new Set(F.specials.map(id=>F.moves[id].name)).size,4);assert.ok(F.moves[F.super].kind==='super');
  assert.equal(trialsFor(F).length,3);for(const t of trialsFor(F))for(const m of t.moves)assert.ok(F.moves[m],t.id);
 }
 for(const v of Object.values(POSE))assert.equal(v.length,N);
});

test('Specials come out from both the classic motion and the easy input, and motions hit harder',()=>{
 const sp=(keys)=>{const g=duel(['biscuit','tank'],{gap:1.2});const ev=run(g,40,i=>[keys(i),0]);return {g,ev,mv:ev.find(e=>e.type==='move'&&e.kind==='special')};};
 assert.equal(sp(tap(S,2)).mv.id,'rush','SPECIAL alone is slot one');
 assert.equal(sp(i=>i<12?(i>=2?R:0)|(i>=4&&i<6?S:0):0).mv.id,'step','toward + SPECIAL');
 assert.equal(sp(i=>i<12?(i>=2?L:0)|(i>=4&&i<6?S:0):0).mv.id,'crumb','away + SPECIAL');
 assert.equal(sp(i=>i<12?(i>=2?D:0)|(i>=4&&i<6?S:0):0).mv.id,'rise','down + SPECIAL');
 const classic=sp(i=>i<3?D:i<5?D|R:i<9?R|(i>=6?A:0):0);assert.equal(classic.mv.id,'rush','↓ → + LIGHT');
 const easy=sp(tap(S,2)),dmg=x=>x.ev.find(e=>e.type==='hit').dmg;assert.ok(dmg(classic)>dmg(easy),'the motion input is worth 10% more');
 const dd=sp(i=>i<2?D:i<4?0:i<8?D|(i>=5?A:0):0);assert.equal(dd.mv.id,'rise','↓ ↓ + LIGHT');
});

test('Guarding: high, low and overhead, chip damage, Snap Guard, and throws beat a guard',()=>{
 const g=duel(['biscuit','moxie'],{gap:1,guard:G});let ev=run(g,30,i=>[tap(A,2)(i),G]);assert.ok(has(ev,'block'));assert.equal(g.f[1].hp,g.f[1].max,'normals do no chip');
 const low=duel(['biscuit','moxie'],{gap:1});ev=run(low,30,i=>[i>=2&&i<4?D|A:i<4?D:0,G]);assert.ok(has(ev,'hit'),'a low hits a standing guard');
 const low2=duel(['biscuit','moxie'],{gap:1,guard:G|D});ev=run(low2,30,i=>[i>=2&&i<4?D|A:i<4?D:0,G|D]);assert.ok(has(ev,'block'));
 const over=duel(['biscuit','moxie'],{gap:1});ev=run(over,50,i=>[i>=2&&i<4?R|B:i<4?R:0,G|D]);assert.ok(has(ev,'hit'),'an overhead hits a low guard');
 const chip=duel(['biscuit','moxie'],{gap:1,guard:G});ev=run(chip,60,i=>[tap(S,2)(i),G]);assert.ok(chip.f[1].hp<chip.f[1].max&&chip.f[1].hp>chip.f[1].max-40,'specials chip a little');
 const snap=duel(['biscuit','moxie'],{gap:1});ev=run(snap,40,(i,gg)=>[tap(A,2)(i),gg.f[0].st==='atk'&&gg.f[0].mt>=2?G:0]);assert.ok(has(ev,'snap'),'guarding at the last moment is a Snap Guard');
 const thr=duel(['biscuit','moxie'],{gap:.9});ev=run(thr,80,i=>[tap(A|B,2)(i),G]);assert.ok(has(ev,'grab')&&has(ev,'throw'));assert.ok(thr.f[1].hp<thr.f[1].max-90);
});

test('Throws can be slipped, and grapplers have grabs that cannot',()=>{
 const g=duel(['biscuit','moxie'],{gap:.9}),ev=run(g,60,(i,gg)=>[tap(A|B,2)(i),gg.f[1].st==='thrown'&&gg.f[1].t>=2&&gg.f[1].t<5?A|B:0]);assert.ok(has(ev,'tech'));assert.equal(g.f[1].hp,g.f[1].max);assert.ok(g.feats.length===0,'only the player earns feats');
 const b=duel(['bruno','moxie'],{gap:1}),ev2=run(b,100,(i,gg)=>[i<8?(i>=2?L:0)|(i>=4&&i<6?S:0):0,gg.f[1].st==='thrown'?A|B:0]);assert.ok(has(ev2,'throw')&&!has(ev2,'tech'),'a command grab cannot be slipped');assert.ok(b.f[1].max-b.f[1].hp>=150);
});

test('Launchers juggle, combos scale their damage, and no simple loop is infinite',()=>{
 const g=duel(['biscuit','tank'],{gap:.9});g.f[1].hp=g.f[1].max=5000;
 const ev=run(g,140,(i,gg)=>[i<4?D|(i>=2?B:0):gg.f[0].st==='idle'&&gg.f[1].vy<0&&gg.f[1].y<1.5&&gg.f[1].y>.1&&i%4<2?A:0,0]),hits=ev.filter(e=>e.type==='hit');
 assert.ok(hits[0].launch,'↓ + HEAVY launches');assert.ok(hits.length>=2&&hits[1].combo>=2,'and the next hit juggles');
 // One-two-hook: each hit is worth less than its raw damage as the combo grows.
 const c=duel(['biscuit','tank'],{gap:.9}),e2=run(c,70,i=>[tap(A,2)(i)|tap(A,12)(i)|tap(A,24)(i),0]).filter(e=>e.type==='hit'),F=fighter('biscuit').moves;
 assert.equal(e2.length,3);assert.equal(e2[0].dmg,F['5L'].dmg);assert.ok(e2[1].dmg<F['5LL'].dmg&&e2[2].dmg<F['5LLL'].dmg*.85,'scaling');assert.ok(trialDone(c,0,['5L','5LL','5LLL'])||c.f[1].ch===0);
 // Mash any one button (or any special) for ten seconds: the combo counter must stay bounded.
 for(const F2 of FIGHTERS)for(const keys of [A,B,D|A,D|B,S,R|S,L|S,D|S,A|B]){const m=duel([F2.id,'tank'],{gap:.9});m.f[1].hp=m.f[1].max=99999;let top=0;run(m,600,i=>{top=Math.max(top,m.f[1].ch);return [i%9<3?keys:keys&(U|D|L|R),0];});assert.ok(top<=K.CAP+16,F2.id+' loop with '+keys+' reached '+top);assert.ok(m.f[1].max-m.f[1].hp<9000);}
});

test('Howl meter builds from fighting and pays for amped specials and supers',()=>{
 const g=duel(['biscuit','tank'],{gap:.9});run(g,60,i=>[tap(A,2)(i)|tap(A,12)(i)|tap(A,24)(i),0]);assert.ok(g.f[0].meter>10&&g.f[1].meter>5&&g.f[0].meter>g.f[1].meter);
 const poor=duel(['biscuit','tank'],{gap:.9});let ev=run(poor,30,tapPair(A|S,2));assert.ok(!ev.some(e=>e.type==='super'),'no meter, no super');
 const rich=duel(['biscuit','tank'],{gap:.9});rich.f[0].meter=300;ev=run(rich,120,tapPair(A|S,2));assert.ok(has(ev,'super'));assert.equal(Math.round(rich.f[0].meter),100,'a super costs two bars');assert.ok(rich.f[1].max-rich.f[1].hp>200,'and hurts');
 const ex=duel(['biscuit','tank'],{gap:.9});ex.f[0].meter=120;ev=run(ex,60,tapPair(B|S,2));assert.equal(ev.find(e=>e.type==='move'&&e.kind==='special').id,'rush+');assert.ok(ex.f[0].meter<95);
 const none=duel(['biscuit','tank'],{gap:.9});ev=run(none,60,tapPair(B|S,2));assert.equal(ev.find(e=>e.type==='move'&&e.kind==='special').id,'rush','without a bar the plain special comes out');
});
function tapPair(bits,at){return i=>[i>=at&&i<at+2?bits:0,0];}

test('Counters, armour, projectiles and teleports do what their archetypes promise',()=>{
 const m=duel(['mochi','biscuit'],{gap:1});let ev=run(m,80,i=>[i<8?(i>=2?L:0)|(i>=4&&i<6?S:0):0,tap(B,6)(i)]);assert.ok(has(ev,'counter'),'Still Water catches a strike');assert.ok(m.f[1].hp<m.f[1].max&&m.f[0].hp===m.f[0].max);
 const t=duel(['tank','biscuit'],{gap:1.3});ev=run(t,70,i=>[tap(S,2)(i),tap(A,5)(i)]);assert.ok(has(ev,'armor'),'Rig Charge takes a hit and keeps coming');assert.ok(ev.some(e=>e.type==='hit'&&e.side===1));
 const z=duel(['moxie','tank'],{gap:5});ev=run(z,90,i=>[tap(S,2)(i),0]);assert.ok(has(ev,'proj')&&ev.some(e=>e.type==='hit'&&e.proj==='paint'),'Tag Shot crosses the stage');
 const j=duel(['jinx','tank'],{gap:3});const before=Math.sign(j.f[1].x-j.f[0].x);run(j,30,i=>[i<8?(i>=2?D:0)|(i>=4&&i<6?S:0):0,0]);assert.equal(Math.sign(j.f[1].x-j.f[0].x),-before,'Blink ends up behind the rival');
});

test('Rounds, the timer and the match',()=>{
 const g=duel(['biscuit','moxie'],{gap:.9});assert.ok(g.timer<=K.ROUND&&g.timer>K.ROUND-30);g.f[1].hp=1;let ev=run(g,10,i=>[tap(A,1)(i),0]);assert.ok(has(ev,'ko'));assert.deepEqual(g.wins,[1,0]);assert.equal(g.phase,'ko');
 run(g,K.KO+K.INTRO+40);assert.equal(g.round,2);assert.equal(g.phase,'fight');assert.equal(g.f[1].hp,g.f[1].max,'health resets, meter carries over');
 g.timer=3;g.f[0].hp=500;ev=run(g,5);assert.ok(ev.some(e=>e.type==='time'&&e.winner===1),'time up: more health wins the round');assert.deepEqual(g.wins,[1,1]);
 run(g,K.KO+K.INTRO+40);assert.equal(g.round,3);g.f[0].x=-.45;g.f[1].x=.45;g.f[1].hp=1;ev=run(g,10,i=>[tap(A,1)(i),0]);assert.ok(ev.some(e=>e.type==='ko'&&e.match));
 const s=duel(['biscuit','moxie'],{mod:'sudden'});assert.equal(s.need,1);assert.equal(s.f[0].max,500);
 const tr=duel(['biscuit','moxie'],{training:true,gap:.9});tr.f[1].hp=1;run(tr,400,i=>[i%10<2?A:0,0]);assert.equal(tr.phase,'fight','nobody is knocked out in training');assert.equal(tr.timer,K.ROUND,'and the clock is stopped');
});

// Win the deciding round so the finishing window opens with the fighters `gap` apart.
const toFinish=(p,stage='rooftop',simple=true,gap=1)=>{const g=createMatch({seed:3,p,stage,cpu:[0,0],human:[0],simple:[simple,true]});while(g.phase==='intro')step(g);g.wins[0]=1;g.f[0].x=-.45;g.f[1].x=.45;g.f[1].hp=1;run(g,10,i=>[tap(A,1)(i),0]);const ev=run(g,K.KO+30);assert.ok(has(ev,'finishwin'));assert.equal(g.phase,'finish');g.f[0].x=-gap/2;g.f[1].x=gap/2;return g;};
test('The finishing window: every finisher of every fighter and stage can be performed',()=>{
 assert.ok(STAGES.length>=5);assert.equal(FINISHERS.length,FIGHTERS.length*3+STAGES.length+1);assert.equal(new Set(FINISHER_IDS).size,FINISHER_IDS.length);
 for(const F of FIGHTERS){const list=finishersFor(F.id,'rooftop');assert.equal(list.length,5);
  for(const [k,dir]of [[0,D],[1,R],[2,L],[3,U]]){const g=toFinish([F.id,'moxie']),ev=run(g,12,i=>[i<8?dir|(i>=3&&i<5?S:0):0,0]),e=ev.find(x=>x.type==='finisher');assert.ok(e,F.id+' slot '+k);assert.equal(e.id,list[k].id);assert.equal(g.phase,'cine');
   run(g,Math.round(CINE_DUR[e.id]*60)+5);assert.equal(g.phase,'over');assert.equal(g.result.finisher,e.id);assert.equal(g.result.winner,0);assert.ok(validMoment(momentFor(g)),'its recipe is a valid chat moment');}
  // Classic inputs: three taps and a button, at the right range.
  for(const f of list.slice(0,3)){const [dirs,btn]=f.seq.split(' '),gap=f.range==='close'?1:f.range==='far'?4.5:2.4,g=toFinish([F.id,'moxie'],'rooftop',false,gap),keys={F:R,B:L,D:D,U:U},seq=[];for(const d of dirs){seq.push(keys[d],keys[d],0,0);}seq.push(btn==='A'?A:B,btn==='A'?A:B);
   const ev=run(g,seq.length+2,i=>[seq[i]||0,0]);assert.equal(ev.find(x=>x.type==='finisher')?.id,f.id,F.id+' '+f.seq+' at '+f.range);}}
 for(const st of STAGES){const g=toFinish(['biscuit','moxie'],st.id),ev=run(g,12,i=>[i<8?U|(i>=3&&i<5?S:0):0,0]);assert.equal(ev.find(x=>x.type==='finisher').id,st.dive.id);}
 const rub=toFinish(['biscuit','moxie']);let ev=run(rub,12,i=>[i<8?G|(i>=3&&i<5?S:0):0,0]);assert.equal(ev.find(x=>x.type==='finisher').kind,'rub');
 const far=toFinish(['biscuit','moxie'],'rooftop',false,4.5);ev=run(far,16,i=>[[D,D,0,0,R,R,0,0,D,D,0,0,B,B][i]||0,0]);assert.ok(has(ev,'finrange')&&far.phase==='finish','too far for a close-range finisher');
 const plain=toFinish(['biscuit','moxie']);ev=run(plain,150,i=>[tap(B,2)(i),0]);assert.ok(has(ev,'plain'));assert.equal(plain.phase,'over');assert.equal(plain.result.finisher,null);
 const idle=toFinish(['biscuit','moxie']);run(idle,K.FINISH+5);assert.equal(idle.phase,'over','the window closes on its own');
});

test('Every finisher id resolves to choreography that stamps, cuts and fits its length',()=>{
 assert.deepEqual([...CINE_IDS].sort(),[...FINISHER_IDS].sort());
 const blocked=/fatal|finish him|flawless|kombat|brutal/i;
 for(const id of CINE_IDS){const c=CINES[id],calls=[],rec=new Proxy({},{get:(o,k)=>(...a)=>{calls.push([k,...a]);return {kind:a[1]};}});
  assert.ok(c.dur>=5&&c.dur<=9,id+' lasts '+c.dur);c.run(rec);
  for(const [k]of calls)assert.ok(DIRECTOR.includes(k),id+' uses an unknown direction: '+String(k));
  const times=calls.map(x=>Math.max(x[1],typeof x[2]==='number'&&['move','grow','spin','circle','dolly','follow'].includes(x[0])?x[2]:0));assert.ok(Math.max(...times)<=c.dur,id+' ends by '+c.dur);assert.ok(Math.min(...times)>=0);
  assert.ok(calls.filter(x=>x[0]==='stamp').length>=1,id+' gets its announcer stamp');assert.ok(calls.filter(x=>x[0]==='cam').length>=3,id+' cuts the camera');assert.ok(calls.some(x=>x[0]==='snd'));assert.ok(calls.filter(x=>x[0]==='pose').length>=3);
  for(const x of calls)for(const v of x)if(typeof v==='string')assert.ok(!blocked.test(v),id+' keeps its own vocabulary');
  for(const x of calls.filter(y=>y[0]==='pose'))assert.ok(POSE[x[3]],id+' pose '+x[3]);}
});

test('Rivals play a whole match at every level without stalling',()=>{
 const lv=[];for(let l=1;l<=5;l++){const g=createMatch({seed:900+l,p:[STARTERS[l%8],STARTERS[(l+3)%8]],stage:STAGE_IDS[l%5],cpu:[l,l]});let n=0,moves=0,blocks=0;while(g.phase!=='over'&&n<16000){for(const e of stepAuto(g)){if(e.type==='move')moves++;if(e.type==='block'||e.type==='snap')blocks++;}n++;}
  assert.equal(g.phase,'over','level '+l+' finished in '+n+' frames');assert.ok(g.result.winner===0||g.result.winner===1);assert.ok(moves>20,'they attack');lv.push(blocks/moves);}
 assert.ok(lv[4]>lv[0],'the top level guards more than the bottom one');
 // A passive human loses to a contender, and a low-level rival leaves gaps: it idles between attacks.
 const g=createMatch({seed:5,p:['biscuit','zip'],cpu:[0,3]});let n=0;while(g.phase!=='over'&&n<16000){stepAuto(g,0);n++;}assert.equal(g.result.winner,1);
});

test('Stage hazards, the Underdawg comeback and the daily twist',()=>{
 const g=duel(['mochi','biscuit'],{stage:'rooftop'});g.f[0].x=4.6;g.f[1].x=5.6;const ev=run(g,80,i=>[tap(S,2)(i),0]);assert.ok(has(ev,'wall')&&has(ev,'hazard'),'Flowing Palm slams them into the billboard');assert.ok(g.feats.includes('fight.wall'));
 const u=duel(['biscuit','moxie'],{gap:1});u.f[0].hp=200;const e2=run(u,40,i=>[tap(G|S,2)(i),0]);assert.ok(has(e2,'underdawg'));assert.ok(u.f[0].ud>0&&u.f[0].udUsed);const again=run(u,60,i=>[tap(G|S,30)(i),0]);assert.ok(!has(again,'underdawg'),'once a round');
 const a=DAILY_TWIST(20261114),b=DAILY_TWIST(20261114),c=DAILY_TWIST(20261115);assert.deepEqual(a,b);assert.ok(FIGHTER_IDS.includes(a.fighter)&&FIGHTER_IDS.includes(a.rival)&&a.fighter!==a.rival&&STAGE_IDS.includes(a.stage)&&MOD_IDS.includes(a.mod));assert.notDeepEqual(a,c);
 const glass=duel(['biscuit','tank'],{gap:.9,mod:'glass'}),h=run(glass,20,i=>[tap(A,2)(i),0]).find(e=>e.type==='hit');assert.equal(h.dmg,Math.round(fighter('biscuit').moves['5L'].dmg*1.5));
 assert.equal(TOWER.length,8);assert.equal(TOWER[7].boss,'king');
});

test('Each feat can be earned',()=>{
 assert.ok(FEATS.length>=12);assert.equal(new Set(FEAT_IDS).size,FEAT_IDS.length);for(const f of FEATS){assert.ok(f.id.startsWith('fight.')&&f.name&&f.text);}
 const got=new Set(),note=g=>g.feats.forEach(f=>got.add(f));
 // A clean two-round sweep with a finisher: debut, untouched, sweep, curtain.
 let g=toFinish(['biscuit','moxie']);run(g,12,i=>[i<8?D|(i>=3&&i<5?S:0):0,0]);run(g,600);note(g);
 g=toFinish(['biscuit','moxie'],'docks');run(g,12,i=>[i<8?U|(i>=3&&i<5?S:0):0,0]);note(g);g=toFinish(['biscuit','moxie']);run(g,12,i=>[i<8?G|(i>=3&&i<5?S:0):0,0]);note(g);
 g=duel(['biscuit','moxie'],{gap:.9});g.f[0].hp=40;g.f[1].hp=1;run(g,10,i=>[tap(A,1)(i),0]);note(g);                                  // whisker
 g=duel(['biscuit','tank'],{gap:1});g.f[1].hp=g.f[1].max=9000;g.f[0].meter=300;run(g,140,tapPair(A|S,2));note(g);                       // combo8
 g=duel(['duchess','tank'],{gap:.9});g.f[1].hp=g.f[1].max=9000;run(g,160,(i,gg)=>{const a=gg.f[0],d=gg.f[1];return [i<4?D|(i>=2?B:0):a.mv==='5LLL'&&a.conn?(i%4<2?S:0):((a.mv==='5L'||a.mv==='5LL')&&a.conn||d.vy<0&&d.y<1.5&&d.y>.1)&&i%4<2?A:0,0];});note(g); // juggle: launcher, one-two-hook, special
 g=duel(['moxie','biscuit'],{gap:1});for(let k=0;k<3;k++)run(g,50,(i,gg)=>[gg.f[1].st==='atk'&&gg.f[1].mt>=2?G:0,tap(A,2)(i)]);note(g); // snap
 g=duel(['moxie','biscuit'],{gap:.9});run(g,60,(i,gg)=>[gg.f[0].st==='thrown'&&gg.f[0].t>=2&&gg.f[0].t<5?A|B:0,tap(A|B,2)(i)]);note(g); // tech
 g=duel(['biscuit','moxie'],{gap:1});g.f[0].hp=200;run(g,40,i=>[tap(G|S,2)(i),0]);g.f[1].hp=1;g.f[0].x=-.45;g.f[1].x=.45;g.f[1].st='idle';g.f[1].inv=0;run(g,40,i=>[tap(A,1)(i),0]);note(g); // underdawg
 g=duel(['biscuit','moxie'],{gap:1});g.f[0].meter=300;g.f[1].hp=1;run(g,80,tapPair(A|S,2));note(g);                                    // super
 g=duel(['mochi','biscuit'],{stage:'rooftop'});g.f[0].x=4.6;g.f[1].x=5.6;run(g,80,i=>[tap(S,2)(i),0]);note(g);                          // wall
 g=duel(['biscuit','tank'],{gap:1});g.f[1].hp=g.f[1].max=9000;for(let k=0;k<3;k++){g.f[0].x=-.45;g.f[1].x=.45;run(g,70,i=>[tap(A,4)(i),tap(B,1)(i)]);}note(g);        // read
 for(const f of FEATS)if(f.id!=='fight.tower'&&f.id!=='fight.daily')assert.ok(got.has(f.id),f.id+' was not earned');
});

test('The save validates, travels in a backup, and the game is registered',()=>{
 const s=freshSave();assert.ok(validFightSave(s));assert.ok(validFightSave(null));
 const full={...s,tower:8,cleared:['biscuit'],fins:['biscuit:thunder_fetch','you:belly_rub','tank:shipped'],trials:['zip.t2'],wins:9,king:true,feats:['fight.debut'],daily:{day:20261114,won:true,streak:3}};assert.ok(validFightSave(full));
 for(const bad of [{...s,v:2},{...s,tower:9},{...s,fins:['nobody:thunder_fetch']},{...s,fins:['biscuit:nope']},{...s,fins:['biscuit:thunder_fetch','biscuit:thunder_fetch']},{...s,trials:['zip.t9']},{...s,feats:['fight.nope']},{...s,last:'nobody'},{...s,extra:1},{...s,daily:{day:1}},{...s,simple:'yes'},[],'x',{...s,diff:0}])assert.equal(validFightSave(bad),false,JSON.stringify(bad).slice(0,60));
 assert.ok(parseBackup(JSON.stringify({format:'dawg-arcade-backup',version:1,saves:{fight:full}})));assert.throws(()=>parseBackup(JSON.stringify({format:'dawg-arcade-backup',version:1,saves:{fight:{...s,tower:99}}})));
 assert.ok(GAME_IDS.includes('fight'));
});

test('Chat moments: every real finisher recipe is accepted and junk is rejected',()=>{
 assert.deepEqual(MOMENT_KINDS,['finisher']);let n=0;
 for(const F of FIGHTERS)for(const st of STAGE_IDS)for(const f of finishersFor(F.id,st)){const d={v:1,winner:F.id,loser:F.id==='moxie'?'biscuit':'moxie',move:f.id,stage:st,seed:12345,side:n%2};assert.ok(validMoment(d),F.id+' '+f.id+' '+st);n++;
  const json=JSON.stringify(d);assert.ok(json.length<=1500);for(const v of Object.values(d))assert.ok(typeof v==='number'||typeof v==='string'&&v.length<=40,'flat and small');
  const t=momentText(d,{perfect:true,round:3});assert.ok(t.title.length<=60&&t.text.length<=120&&!/[<>]/.test(t.title+t.text));}
 assert.ok(n>=250);
 const ok={v:1,winner:'biscuit',loser:'moxie',move:'thunder_fetch',stage:'rooftop',seed:1};assert.ok(validMoment(ok));
 const look=[0,0,0,0,0,0,10,20,30,0,0,0,0,0,0,0,0];assert.ok(validMoment({...ok,winner:'you',move:'bath_time',look}));
 for(const bad of [null,[],'x',{...ok,v:2},{...ok,winner:'goro'},{...ok,loser:7},{...ok,move:'fresh_coat'},{...ok,move:'last_train'},{...ok,move:'<script>'},{...ok,stage:'moon'},{...ok,seed:-1},{...ok,seed:1.5},{...ok,seed:'1'},{...ok,side:2},{...ok,html:'<b>'},{...ok,look},{...ok,winner:'you',move:'bath_time',look:[...look.slice(1),99999]},{...ok,winner:'you',move:'bath_time',look:{a:1}},{...ok,move:{id:'thunder_fetch'}}])assert.equal(validMoment(bad),false,JSON.stringify(bad)?.slice(0,70));
});
