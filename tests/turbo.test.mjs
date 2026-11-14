import test from 'node:test';
import assert from 'node:assert/strict';
import {TurboGame,TRICKS,TURBO,TURBO_FIELDS,turboChunk,chunkAt,courseFrame,frameIn,floorIn,deckHeight,railHeight,halfWidthIn,laneX,validTurboSnapshot,turboPilot} from '../dist/turbo-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';

const DT=1/120,LW=TURBO.lane;
const fresh=(seed=5)=>{const g=new TurboGame(Math.random,seed);g.start();return g;};
const step=(g,seconds)=>{for(let t=0;t<seconds&&g.status==='playing';t+=DT)g.tick(DT);};
const run=(g,seconds,opts)=>{const seen={};for(let t=0;t<seconds&&g.status==='playing';t+=DT){if(opts!==false)turboPilot(g,opts);g.tick(DT);for(const e of g.events)seen[e.type]=(seen[e.type]||0)+1;g.events=[];}return seen;};
// The first chunk of a kind on a seed, and a pup parked just before a point on it.
const find=(kind,seed=5,from=0)=>{for(let k=from;k<400;k++){const c=turboChunk(seed,k);if(c.kind===kind)return c;}throw new Error('no '+kind);};
const park=(g,s,lane=0)=>{g.s=s;g.distance=s;g.cp=Math.floor(s/TURBO.checkpoint)+1;g.lane=lane;g.x=laneX(chunkAt(g.worldSeed,s),lane);g.h=0;g.vy=0;g.grounded=true;g.clock=40;g.rivals.forEach((r,i)=>{r.s=s+300+i*40;});g.events=[];return g;};
const types=g=>g.events.map(e=>e.type);

test('The course is a pure function of the seed, built from contiguous chunks',()=>{
 for(const seed of [1,42,9001]){let end=0;const kinds=new Set();
  for(let k=0;k<120;k++){const c=turboChunk(seed,k);assert.equal(c.s0,end);end+=c.len;kinds.add(c.kind);if(k)assert.notEqual(c.kind,turboChunk(seed,k-1).kind,'no piece twice running');
   for(const o of [...c.coins,...c.hazards,...c.rings,...c.pads,...c.ramps,...c.springs])assert.ok(o.s>=c.s0&&o.s<=c.s0+c.len+40,`${c.kind} object inside its chunk`);}
  assert.deepEqual([0,1,2,3].map(k=>turboChunk(seed,k).kind),['start','rows','jump','loop'],'every run opens the same thrilling way');
  for(const kind of ['sweep','hill','jump','rail','split','pipe','spring','twist','loop','rows'])assert.ok(kinds.has(kind),kind+' appears');
  assert.equal(turboChunk(seed,0).hazards.length,0,'the start is clear');}
 const a=turboChunk(7,20),b=turboChunk(7,20);assert.deepEqual({...a,P:null},{...b,P:null});
 assert.notDeepEqual(turboChunk(7,9).coins,turboChunk(8,9).coins);
});
test('The ribbon is continuous in space: no jumps, tears or flips between chunks, loops and corkscrews included',()=>{
 for(const seed of [3,77]){let prev=courseFrame(seed,0),low=1e9,high=-1e9;
  for(let s=.5;s<9000;s+=.5){const f=courseFrame(seed,s),d=Math.hypot(f.p[0]-prev.p[0],f.p[1]-prev.p[1],f.p[2]-prev.p[2]);assert.ok(d>.2&&d<.95,`step ${d} at ${s}`);
   const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];assert.ok(dot(f.u,prev.u)>.98&&dot(f.t,prev.t)>.98,'frame turns smoothly at '+s);assert.ok(Math.abs(dot(f.u,f.t))<1e-9&&Math.abs(dot(f.r,f.t))<1e-9&&Math.abs(Math.hypot(...f.u)-1)<1e-9,'orthonormal');
   low=Math.min(low,f.p[1]);high=Math.max(high,f.p[1]);prev=f;}
  assert.ok(low>-40&&high<80,'the course stays in its band of sky');assert.ok(Math.abs(courseFrame(seed,9000).psi)<1.6,'and never doubles back');}
 // A loop comes back level, a little to one side; a corkscrew comes back upright.
 const loop=find('loop'),a=frameIn(loop,loop.loop[0]),b=frameIn(loop,loop.loop[1]);assert.ok(Math.abs(b.th-a.th-Math.PI*2)<1e-9);assert.ok(Math.abs(Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2])-TURBO.loopShift)<1.5&&Math.abs(b.p[1]-a.p[1])<1.5);
 const top=frameIn(loop,(loop.loop[0]+loop.loop[1])/2);assert.ok(top.u[1]<-.9&&top.p[1]-a.p[1]>14,'upside down at the top');
 const tw=find('twist'),m=frameIn(tw,(tw.twist[0]+tw.twist[1])/2);assert.ok(m.u[1]<-.99,'a corkscrew turns right over');assert.ok(frameIn(tw,tw.twist[1]+.01).u[1]>.99);
});
test('Every hazard row leaves a way through, and nothing is placed where the pup cannot react',()=>{
 for(const seed of [1,2,3])for(let k=0;k<150;k++){const c=turboChunk(seed,k),rows=new Map();
  for(const h of c.hazards){if(h.type==='block'&&h.lane!==null){const key=Math.round(h.s);rows.set(key,(rows.get(key)||new Set()).add(h.lane));}assert.ok(h.s-c.s0>=17,'room to react at the start of a chunk');
   if(c.loop)assert.fail('no hazards in a loop chunk');if(c.twist)assert.fail('no hazards in a corkscrew chunk');}
  for(const lanes of rows.values())assert.ok(lanes.size<=2,'a row of barriers never closes all three lanes');
  for(const [a,b]of c.gaps)assert.ok(c.ramps.some(r=>r.lane===null&&r.s<a&&a-r.s<6),'every gap has a full-width kicker');
  for(const d of c.decks){assert.ok(d.gaps.length>=1&&d.gaps.every(([a,b])=>b-a<=9.01&&a>d.s0+TURBO.deckUp+10&&b<d.s1-10));assert.ok(c.ramps.some(r=>r.d),'the high road ends in a launch');assert.ok(c.coins.filter(o=>o.h>TURBO.deckH).length>c.coins.filter(o=>o.h<3).length,'more gold up top');}}
});
test('Runs are deterministic, and the autopilot outlasts a pup that never steers',()=>{
 const a=fresh(11),b=fresh(11);run(a,60);run(b,60);assert.deepEqual(TURBO_FIELDS.map(k=>a[k]),TURBO_FIELDS.map(k=>b[k]));assert.equal(a.score,b.score);
 let cps=0;for(const seed of [1,2,3,4]){const g=fresh(seed),seen=run(g,90);assert.equal(g.status,'playing',`seed ${seed} still running at 90 s`);assert.ok(g.distance>2500&&g.hits<12,`seed ${seed}: ${g.distance} m, ${g.hits} hits`);cps+=g.cp-1;
  assert.ok(Number.isFinite(g.s+g.x+g.h+g.v+g.vy+g.clock));assert.equal(g.score,Math.floor(g.distance)+g.bonus);assert.ok(g.x>=-TURBO.pipeHalf&&g.x<=TURBO.pipeHalf);
  for(const need of ['coin','pad','air','flip','loop','checkpoint','overtake'])assert.ok(seen[need]>0,`seed ${seed} saw ${need}`);}
 assert.ok(cps>=16);
 const idle=fresh(3);run(idle,400,false);assert.equal(idle.status,'over');assert.match(idle.reason,/Out of time/);const good=fresh(3);run(good,400);assert.ok(good.distance>idle.distance*1.5,'steering goes much further');assert.ok(idle.hits/idle.distance>3*good.hits/good.distance,'and takes far fewer hits per meter');
});
test('Lanes: three on the deck, eased sideways, and the edges hold',()=>{
 const g=fresh();g.tick(DT);assert.equal(g.move('left'),true);assert.equal(g.lane,-1);assert.equal(g.move('left'),false,'no lane beyond the edge');assert.ok(types(g).includes('edge'));
 step(g,.3);assert.equal(g.x,-LW);g.move('right');g.move('right');assert.equal(g.lane,1);step(g,.08);assert.ok(g.x>-LW&&g.x<LW,'the pup slides across, it does not teleport');step(g,.4);assert.equal(g.x,LW);
 assert.deepEqual(g.laneRange(),[-1,1]);
});
test('Jump, coyote time, buffering, roll and stomp',()=>{
 const g=fresh();g.tick(DT);assert.ok(g.move('up'));assert.equal(g.vy,TURBO.jump);assert.equal(g.grounded,false);
 let top=0;while(!g.grounded){g.tick(DT);top=Math.max(top,g.h);}assert.ok(top>2&&top<2.4,'a jump clears a barrier: '+top);assert.ok(types(g).includes('land'));
 // Pressed a moment before touching down: remembered, and the pup jumps as it lands.
 const j=fresh();j.tick(DT);j.move('up');while(!(j.vy<0&&j.h<.5))j.tick(DT);assert.equal(j.move('up'),false);assert.ok(j.jumpBuffer>0);j.events=[];step(j,.12);assert.ok(types(j).includes('jump'),'buffered jump fired');assert.ok(!j.grounded);
 // Running off a rail's end or a deck gap leaves a moment to still jump.
 const s=park(fresh(),find('split').decks[0].gaps[0][0]-1,find('split').decks[0].side*2);s.h=TURBO.deckH;s.v=30;while(s.grounded)s.tick(DT);assert.ok(s.coyote>0);assert.ok(s.move('up'),'coyote jump');assert.equal(s.vy,TURBO.jump);
 const r=fresh();r.tick(DT);const v=r.v;assert.ok(r.move('down'));assert.equal(r.rolling,TURBO.rollTime);assert.ok(r.v>v,'a roll is a little spin dash');
 const st=fresh();st.tick(DT);st.move('up');step(st,.2);st.move('down');assert.equal(st.vy,TURBO.stomp);st.events=[];while(!st.grounded)st.tick(DT);assert.ok(types(st).includes('slam'));
});
test('Momentum: flow, slopes, boost pads, the turbo meter and its limits',()=>{
 const g=fresh();step(g,6);assert.ok(Math.abs(g.v-g.cruise)<1.5,'settles at cruise');g.flow=0;const slow=g.cruise;g.flow=1;assert.ok(g.cruise>slow+5,'flow raises the cruising speed');
 // Downhill is faster than uphill on the same hill.
 const hill=find('hill'),u=fresh(),d=fresh();const up=hill.pitchA>0?.2:.7,down=hill.pitchA>0?.7:.2;park(u,hill.s0+hill.len*up);park(d,hill.s0+hill.len*down);u.v=d.v=30;u.flow=d.flow=0;for(let i=0;i<30;i++){u.tick(DT);d.tick(DT);}assert.ok(d.v>u.v+.5,`${d.v} vs ${u.v}`);
 const pad=turboChunk(5,0).pads[0],p=park(fresh(),pad.s-1);p.v=24;const fuel=p.fuel;step(p,.1);assert.ok(types(p).includes('pad'));assert.ok(p.v>=p.cruise+9&&p.fuel>fuel);
 // Turbo burns the meter while held, lifts the top speed, and has to be earned back when empty.
 const t=park(fresh(),10,1);t.fuel=.5;t.v=26;assert.ok(t.press('boost',true));assert.ok(t.boosting);step(t,1);assert.ok(t.v>t.cruise+10,'turbo speed '+t.v);assert.ok(t.fuel<.25);t.press('boost',false);step(t,.6);assert.equal(t.boosting,false);
 t.fuel=.05;t.events=[];assert.equal(t.press('boost',true),false);assert.ok(types(t).includes('empty'));t.fuelUp(5);assert.equal(t.fuel,1);
 const e=park(fresh(),10,1);e.fuel=.2;e.press('boost',true);step(e,1);assert.equal(e.fuel,0);assert.equal(e.boosting,false,'an empty meter cuts out');assert.ok(e.v<=TURBO.maxSpeed);
});
test('Tricks: flips need air, pay more in a chain, and the landing is judged',()=>{
 const launch=()=>{const g=park(fresh(),30);g.gold=0;g.launch(22);g.h=.01;g.events=[];return g;};
 const g=launch();step(g,.1);assert.ok(g.move('up'));assert.ok(g.flip>0);assert.equal(g.move('up'),false,'one flip at a time');step(g,TURBO.flipTime+.02);assert.equal(g.flips,1);const paid=()=>g.events.filter(e=>e.type==='flip').map(e=>e.points);assert.deepEqual(paid(),[TRICKS.flip]);
 g.move('up');step(g,TURBO.flipTime+.02);assert.equal(g.flips,2);assert.equal(paid()[1],TRICKS.flip*2*g.combo,'the second flip is worth double, times the combo');assert.ok(g.combo>=2);
 const v=g.v;g.events=[];while(!g.grounded)g.tick(DT);assert.ok(types(g).includes('clean'));assert.ok(g.v>v);
 // Land the instant a flip comes round for a perfect; land mid-flip and the pup stumbles.
 const p=launch();const T=2*22/TURBO.gravity;step(p,T-TURBO.flipTime-.1);p.move('up');p.events=[];while(!p.grounded)p.tick(DT);assert.ok(types(p).includes('perfect'),types(p).join());
 const s=launch();step(s,T-.2);s.move('up');const sv=s.v;s.combo=4;s.comboTime=2;s.events=[];while(!s.grounded)s.tick(DT);assert.ok(types(s).includes('stumble'));assert.ok(s.v<sv*.8);assert.equal(s.combo,0);assert.equal(s.hits,0,'a stumble is not a hit');
 // The combo multiplies, tops out, feeds the turbo and runs out.
 const c=park(fresh(),10);c.fuel=0;for(let i=0;i<14;i++)c.trick('ring');assert.equal(c.combo,14);assert.equal(c.events.at(-1).points,TRICKS.ring*TURBO.maxCombo);assert.ok(c.fuel>.9);assert.equal(c.bestCombo,14);c.events=[];step(c,TURBO.comboWindow+.1);assert.equal(c.combo,0);assert.ok(types(c).includes('combobreak'));
});
test('Set pieces: the kicker clears its gap, hoops and overtakes pay, loops and corkscrews hold the pup',()=>{
 const jump=find('jump'),ramp=jump.ramps[0],[a,b]=jump.gaps[0];
 for(const v0 of [TURBO.minSpeed,30,TURBO.maxSpeed]){const g=park(fresh(),ramp.s-1);g.v=v0;step(g,.3);assert.ok(!g.grounded&&g.v>=ramp.vmin);let peak=0;while(!g.grounded){g.tick(DT);peak=Math.max(peak,g.h);}assert.ok(g.s>b,`landed past the gap from ${v0} m/s`);assert.ok(peak>3.5);assert.equal(g.hits,0);}
 const r=park(fresh(),ramp.s-2);r.gold=5;run(r,2.5,{turbo:false});assert.ok(r.collected.some(id=>id.includes(':r')),'flew a hoop');
 // Stomp into the gap: a fall costs gold and time on the clock, not the run.
 const f=park(fresh(),ramp.s-2);f.gold=10;step(f,.25);f.move('down');step(f,1.2);assert.equal(f.status,'playing');assert.equal(f.hits,1);assert.ok(f.gold<10);assert.ok(f.s>b&&f.grounded);
 const loop=find('loop'),l=park(fresh(),loop.loop[0]-3);step(l,.4);assert.ok(l.locked);assert.equal(l.move('up'),false,'no jumping off a loop');assert.ok(l.move('left'),'but lanes still work');l.events=[];step(l,3);assert.equal(l.loops,1);assert.ok(types(l).includes('loop'));
 const tw=find('twist'),t=park(fresh(),tw.twist[0]-3);t.events=[];step(t,5);assert.ok(types(t).includes('twist'));
 const o=park(fresh(),200);o.rivals[0].s=o.s+6;o.rivals[0].lane=0;o.rivals[0].x=0;o.v=26;o.events=[];step(o,.2);assert.ok(types(o).includes('draft'),'slipstream behind a rival');step(o,2);assert.equal(o.passed,1);
});
test('Rails grind, half-pipe walls ride, and the high road is a real second route',()=>{
 const rc=find('rail'),rail=rc.rails[0],g=park(fresh(),rail.s0-2,rail.lane);g.gold=0;step(g,.6);assert.ok(g.grind,'riding the rail');assert.ok(Math.abs(g.h-railHeight(rail,g.s))<1e-9);const hits=g.hits;g.events=[];step(g,1);assert.equal(g.hits,hits,'spikes under the rail cannot reach');assert.ok(types(g).includes('grind'));assert.ok(g.gold>3);
 const under=park(fresh(),rail.s0+12,rail.lane===1?0:rail.lane+1);under.move(rail.lane<under.lane?'left':'right');step(under,.5);assert.ok(under.h<.5&&!under.grind,'stepping in under the rail stays on the deck');
 g.move(rail.lane===1?'left':'right');step(g,.15);assert.equal(g.grind,false);
 const pc=find('pipe'),w=park(fresh(),pc.pipe[0]+20,1);assert.deepEqual(w.laneRange(),[-2,2]);assert.ok(halfWidthIn(pc,w.s)>TURBO.wallX);w.move('right');step(w,.5);assert.equal(w.wall,1);assert.equal(w.x,TURBO.wallX);assert.ok(types(w).includes('wall'));
 const hw=w.hits;w.s=pc.pipe[0]+30;step(w,2);assert.equal(w.hits,hw,'the wall is the clean line');w.s=pc.pipe[1]-1;step(w,.6);assert.ok(Math.abs(w.lane)<=1&&Math.abs(w.x)<=LW+1e-9,'the wall folds back into the deck');
 const sc=find('split'),d=sc.decks[0],hi=park(fresh(),d.s0-3,d.side),lo=park(fresh(),d.s0-3,0);step(hi,1.6);step(lo,1.6);assert.ok(Math.abs(hi.h-TURBO.deckH)<1e-6,'the outer lane climbs to the high road');assert.equal(lo.h,0);assert.ok(hi.onDeck);
 assert.deepEqual(hi.laneRange(),d.side>0?[-1,3]:[-3,1]);hi.move(d.side>0?'right':'left');step(hi,.3);assert.equal(hi.lane,d.side*2);
 // Run off a gap and the pup drops to the low road unhurt.
 const drop=park(fresh(),d.gaps[0][0]-2,d.side*2);drop.h=TURBO.deckH;drop.v=20;while(drop.grounded)drop.tick(DT);while(!drop.grounded)drop.tick(DT);assert.ok(drop.h<1&&drop.hits===0&&Math.abs(drop.lane)<=1,`${drop.h} ${drop.hits} ${drop.lane}`);
 assert.equal(floorIn(sc,d.s0+60,d.side*LW*2,TURBO.deckH),TURBO.deckH);assert.equal(floorIn(sc,d.s0+60,d.side*LW*2,0),0);assert.equal(deckHeight(d,d.gaps[0][0]+1),null);
});
test('Hits never end the run: they cost gold, speed, flow and combo; with no gold they cost time',()=>{
 let block;for(let k=4;!block;k++){const ch=turboChunk(5,k);if(ch.kind==='rows')block=ch.hazards.find(h=>h.type==='block');}const g=park(fresh(),block.s-3,block.lane);g.gold=30;g.v=30;g.flow=.8;g.combo=5;g.comboTime=3;const clock=g.clock;step(g,.2);
 assert.equal(g.hits,1);assert.equal(g.status,'playing');assert.ok(g.gold>0&&g.gold<30);assert.ok(g.v<16);assert.ok(g.flow<.05);assert.equal(g.combo,0);assert.ok(g.invuln>1);assert.ok(Math.abs(g.clock-(clock-.2))<.05,'gold paid for it');
 assert.equal(g.hurt('again'),false,'invulnerable for a moment');step(g,2.5);assert.ok(g.v>g.cruise-4,'and quickly back up to speed');
 const broke=park(fresh(),block.s-3,block.lane);broke.gold=0;const c0=broke.clock;step(broke,.2);assert.equal(broke.hits,1);assert.ok(broke.clock<c0-3,'no gold: three seconds off the clock');
 // The same barrier: jumped clean, and a close call when shaved.
 const j=park(fresh(),block.s-8,block.lane);j.v=30;j.move('up');step(j,.5);assert.equal(j.hits,0);
 const n=park(fresh(),block.s-1,block.lane);n.x+=1.6;n.lane=block.lane;n.events=[];n.tick(DT*8);if(n.hits===0)assert.ok(types(n).includes('near'));
 // Bars want a roll, bots want a roll, a stomp or turbo.
 const bar={id:'9:h9',type:'bar',s:0,lane:null},bot={id:'9:h8',type:'bot',s:0,lane:0,amp:0,sp:1,ph:0};
 const withHazard=(h,setup)=>{const q=park(fresh(),30);const ch=chunkAt(5,30),keep=ch.hazards;ch.hazards=[{...h,s:32}];try{setup(q);step(q,.15);}finally{ch.hazards=keep;}return q;};
 assert.equal(withHazard(bar,()=>{}).hits,1);const limbo=withHazard(bar,q=>q.move('down'));assert.equal(limbo.hits,0);assert.equal(limbo.events.find(e=>e.type==='limbo').points,TRICKS.limbo);
 assert.equal(withHazard(bot,()=>{}).hits,1);const sm=withHazard(bot,q=>q.move('down'));assert.equal(sm.hits,0);assert.equal(sm.smashes,1);assert.deepEqual(sm.smashed,['9:h8']);
 const tb=withHazard(bot,q=>{q.fuel=1;q.press('boost',true);});assert.equal(tb.smashes,1,'turbo ploughs through bots');
});
test('The clock: checkpoints add time, a little less each one, and running out ends the run',()=>{
 const g=park(fresh(),TURBO.checkpoint-5);g.clock=10;g.v=30;const bonus=g.bonus;step(g,.4);assert.equal(g.cp,2);const e=g.events.find(e=>e.type==='checkpoint');assert.equal(e.add,22);assert.ok(Math.abs(g.clock-(10+22-.4))<.05);assert.equal(g.bonus-bonus>=500,true);
 const far=park(fresh(),TURBO.checkpoint*20-5);far.clock=10;step(far,.4);assert.equal(far.events.find(e=>e.type==='checkpoint').add,10,'late checkpoints give the minimum');
 const cap=park(fresh(),TURBO.checkpoint-5);cap.clock=55;step(cap,.4);assert.ok(cap.clock<=TURBO.clockMax);
 const out=park(fresh(),50);out.clock=.05;step(out,.2);assert.equal(out.status,'over');assert.equal(out.clock,0);assert.ok(types(out).includes('over'));out.tick(DT);assert.equal(out.move('up'),false);
 assert.equal(out.score,Math.floor(out.distance)+out.bonus);
});
test('Checkpoints: a run saves and resumes exactly; corrupt and old saves are refused',()=>{
 const g=createQuickGame('turbo',77);g.start();run(g,35);assert.equal(g.status,'playing');const snap=snapshotQuick(g,'turbo');assert.ok(snap);assert.ok(validTurboSnapshot(snap));
 const back=restoreQuick(JSON.parse(JSON.stringify(snap)));assert.ok(back);assert.equal(back.status,'paused');for(const k of TURBO_FIELDS)assert.deepEqual(back[k],g[k],k);
 // The restored run plays on identically.
 back.start();g.boostHeld=false;back.draft=g.draft;run(g,20);run(back,20);assert.equal(back.s,g.s);assert.equal(back.score,g.score);assert.equal(back.gold,g.gold);
 for(const [k,v]of [['s',-1],['s',NaN],['x',40],['lane',9],['h',900],['v',500],['v',0],['fuel',2],['flip',3],['clock',999],['cp',0],['gold',-4],['grounded','yes'],['collected',['nope']],['collected','x'],['smashed',[5]],['rivals',[]],['rivals',[{id:0,s:1,lane:5,x:0,gen:0},{id:1,s:1,lane:0,x:0,gen:0},{id:2,s:1,lane:0,x:0,gen:0}]],['score',snap.score+1],['distance',snap.distance+TURBO.checkpoint*3],['combo',1e9]])
  assert.equal(restoreQuick({...JSON.parse(JSON.stringify(snap)),[k]:v}),null,`${k}=${JSON.stringify(v)} refused`);
 // A save from the old side-scrolling Turbo Pup.
 const old={version:1,worldSeed:9,kind:'turbo',score:812,time:40,randomState:1,x:700,y:0,vx:14,vy:0,grounded:true,coyote:0,rolling:0,stomping:false,brake:0,turbo:.5,jumpBuffer:0,combo:0,comboTime:0,rings:2,invuln:0,loop:null,gold:11,bonus:112,distance:700,bots:1,loops:1,collected:[],defeated:[]};
 assert.equal(restoreQuick(old),null);assert.equal(validTurboSnapshot(null),false);assert.equal(validTurboSnapshot({}),false);
});
test('Feats: every one can be earned, each fires once, and they ride in the save',async()=>{
 const {FEATS,FEAT_IDS,STAGES,stageName,RIVALS,DAILY_TWIST}=await import('../dist/turbo-engine.js');
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEAT_IDS).size,FEATS.length);for(const f of FEATS)assert.match(f.id,/^turbo\.[a-z0-9]+$/);assert.ok(FEATS.every(f=>f.name&&f.text));
 const earned=new Set(),got=(g,id)=>{assert.ok(g.feats.includes(id),id+' earned');assert.equal(g.events.filter(e=>e.type==='feat'&&e.id===id).length<=1,true);earned.add(id);};
 // Three flips off one launch.
 let g=park(fresh(),30);g.launch(34);g.h=.01;step(g,.1);for(let i=0;i<3;i++){g.move('up');step(g,TURBO.flipTime+.03);}while(!g.grounded)g.tick(DT);got(g,'turbo.flip3');
 // Three perfect landings.
 g=park(fresh(),30);for(let i=0;i<3;i++){g.launch(22);g.h=.01;step(g,2*22/TURBO.gravity-TURBO.flipTime-.1);g.move('up');while(!g.grounded)g.tick(DT);}got(g,'turbo.perfect3');
 g=park(fresh(),10);for(let i=0;i<10;i++)g.trick('ring');got(g,'turbo.combo10');g.trick('ring');assert.equal(g.events.filter(e=>e.type==='feat').length,1,'a feat fires once');
 // A clean zone, then the tour and the lap by distance.
 g=park(fresh(),TURBO.checkpoint-5);step(g,.4);got(g,'turbo.clean');const d=park(fresh(),TURBO.checkpoint-5);d.zoneHits=1;d.hits=1;step(d,.4);assert.ok(!d.feats.includes('turbo.clean'));assert.equal(d.zoneHits,0);
 g=park(fresh(),TURBO.checkpoint*3-5);step(g,.4);got(g,'turbo.tour');g=park(fresh(),TURBO.checkpoint*4-5);step(g,.4);got(g,'turbo.lap');
 // The high road, on-ramp to launch; dropping in half way does not count.
 const sc=find('split'),dk=sc.decks[0];g=park(fresh(),dk.s0-3,dk.side);g.gold=50;let guard=0;while(g.s<dk.s1+5&&guard++<4000){for(const [a]of dk.gaps)if(g.grounded&&a-g.s>0&&a-g.s<g.v*.12)g.move('up');g.tick(DT);}got(g,'turbo.highroad');
 const late=park(fresh(),dk.s1-20,dk.side*2);late.h=TURBO.deckH;step(late,1.2);assert.ok(!late.feats.includes('turbo.highroad'));
 const rc=find('rail'),rail=rc.rails[0];g=park(fresh(),rail.s0-2,rail.lane);step(g,2.2);got(g,'turbo.rail');
 const pc=find('pipe');g=park(fresh(),pc.pipe[0]+18,2);step(g,3);got(g,'turbo.wall');
 g=park(fresh(),300);for(let i=0;i<10;i++){g.rivals[0].s=g.s+1;g.rivals[0].x=g.x;g.v=45;step(g,.2);}got(g,'turbo.pack');
 g=park(fresh(),turboChunk(5,0).pads[0].s-1,1);g.fuel=1;g.flow=1;g.v=47;g.press('boost',true);step(g,.2);assert.ok(!g.feats.includes('turbo.mach'),'not in the first zone, even with turbo and a pad');let lp;for(let k=60;!lp;k++)lp=turboChunk(5,k).pads.find(p=>p.lane===null&&!p.d);g=park(fresh(),lp.s-1);g.fuel=1;g.flow=1;g.v=53;g.press('boost',true);step(g,.2);got(g,'turbo.mach');
 g=park(fresh(),30);for(let i=0;i<5;i++)g.smash({id:'9:h'+i});got(g,'turbo.bots');
 assert.deepEqual([...earned].sort(),[...FEAT_IDS].sort(),'every feat is reachable');
 // Feats are saved, and a save with an unknown or repeated feat is refused.
 const q=createQuickGame('turbo',9);q.start();run(q,8);q.feat('turbo.combo10');const snap=snapshotQuick(q,'turbo');assert.ok(restoreQuick(JSON.parse(JSON.stringify(snap))).feats.includes('turbo.combo10'));
 assert.equal(restoreQuick({...snap,feats:['turbo.nope']}),null);assert.equal(restoreQuick({...snap,feats:['turbo.combo10','turbo.combo10']}),null);assert.ok(restoreQuick({...snap,feats:[]}));
 // The ladder and the result line.
 assert.equal(STAGES.length,4);assert.equal(stageName(1),'NEON DOWNTOWN');assert.equal(stageName(5),'NEON DOWNTOWN · LAP 2');assert.equal(RIVALS.length,3);
 const o=park(fresh(),1500);o.topSpeed=50;o.bestCombo=6;o.clock=.02;step(o,.2);assert.match(o.reason,/short of AURORA REACH/);assert.match(o.reason,/ZONE 3 · STORM SKYWAY · 15\d\d m · top speed 260 km\/h · best combo ×6/);
 // Daily twists: a pure function of the seed, off unless the run is marked daily.
 assert.deepEqual(DAILY_TWIST(1234),DAILY_TWIST(1234));assert.ok(new Set([1,2,3,4,5,6,7,8,9,10,11,12].map(s=>DAILY_TWIST(s).id)).size>=3);
 const seedFor=id=>{for(let s=1;;s++)if(DAILY_TWIST(s).id===id)return s;};
 const plain=new TurboGame(Math.random,seedFor('feather')),light=new TurboGame(Math.random,seedFor('feather'));light.daily=true;assert.equal(plain.twist,'');assert.equal(plain.gravity,TURBO.gravity);assert.ok(light.gravity<TURBO.gravity);
 const air=g=>{g.start();g.tick(DT);g.move('up');let t=0;while(!g.grounded){g.tick(DT);t+=DT;}return t;};assert.ok(air(light)>air(plain)+.15);
 const wind=new TurboGame(Math.random,seedFor('tailwind'));wind.daily=true;assert.equal(wind.pace,new TurboGame(Math.random,1).pace+4);
 const rush=new TurboGame(Math.random,seedFor('goldrush'));rush.daily=true;rush.start();rush.fuel=0;const plainG=fresh(seedFor('goldrush'));plainG.fuel=0;step(rush,1.2);step(plainG,1.2);assert.ok(rush.gold>0&&rush.fuel>plainG.fuel*1.8);
 const dsnap=snapshotQuick(Object.assign(createQuickGame('turbo',seedFor('feather')),{daily:true,status:'playing'}),'turbo');assert.equal(restoreQuick(dsnap).daily,true);
});
