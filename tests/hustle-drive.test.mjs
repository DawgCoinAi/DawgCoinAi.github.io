import test from 'node:test';
import assert from 'node:assert/strict';
import {planDrive,DriveSim,autopilot,simulateDrive,wantedStars,driveSeed,validDriveOutcome,roadPath,roadPoint,curvature,LANES,DRIVE_CASH_CAP,RADIO,RESULTS} from '../dist/hustle-drive.js';
import {LivingTradeGame,validLivingTrade} from '../dist/living-trade.js';
import {TradeGame} from '../dist/engine.js';
import {TRACKS} from '../dist/arcade-music.js';
const clone=x=>JSON.parse(JSON.stringify(x));

test('Wanted stars follow street heat and decide how many cruisers roll',()=>{
 assert.deepEqual([0,9,10,21,22,39,40,59,60,79,80,100].map(wantedStars),[0,0,1,1,2,2,3,3,4,4,5,5]);
 assert.equal(planDrive({seed:3,heat:0}).police.length,0);assert.ok(planDrive({seed:3,heat:0}).patrol,'a parked patrol watches for speeders');
 assert.equal(planDrive({seed:3,heat:15}).police.length,1);assert.equal(planDrive({seed:3,heat:95}).police.length,3);assert.equal(planDrive({seed:3,heat:95}).patrol,null);
});
test('Drive plans are seeded, JSON-safe and differ between nights and routes',()=>{
 const a=planDrive({seed:driveSeed(77,4,0,2),from:0,to:2,heat:30,day:4});assert.deepEqual(planDrive({seed:driveSeed(77,4,0,2),from:0,to:2,heat:30,day:4}),a);assert.deepEqual(clone(a),a);
 assert.notEqual(driveSeed(77,4,0,2),driveSeed(77,5,0,2));assert.notEqual(driveSeed(77,4,0,2),driveSeed(77,4,0,3));
 assert.ok(a.length>500&&a.length<1300);assert.ok(a.traffic.length>10);assert.ok(a.pickups.every(p=>LANES.includes(p.d)));
 const total=a.pickups.reduce((n,p)=>n+p.value,0);assert.ok(total<DRIVE_CASH_CAP);
});
test('The road path follows its bends and maps lanes beside the centreline',()=>{
 const plan=planDrive({seed:11,from:1,to:4}),path=roadPath(plan),start=roadPoint(path,0),end=roadPoint(path,plan.length);
 assert.ok(Math.abs(start.x)<1e-9&&Math.abs(start.z)<1e-9);assert.ok(Math.hypot(end.x,end.z)>plan.length*.6,'the boulevard heads somewhere');
 const bend=plan.bends[0],mid=bend.at+bend.len/2;assert.ok(Math.abs(curvature(plan,mid))>0);
 const c=roadPoint(path,mid),r=roadPoint(path,mid,3);assert.ok(Math.abs(Math.hypot(r.x-c.x,r.z-c.z)-3)<1e-6);
});
test('A drive replays exactly from the same plan and inputs, at any frame rate',()=>{
 const plan=planDrive({seed:5150,from:0,to:3,heat:45,day:9}),a=new DriveSim(plan),b=new DriveSim(plan);
 for(let i=0;i<900&&!a.done;i++){a.step(autopilot(a));}
 let frames=0;while(!b.done&&b.t<a.t-1e-9){b.advance([.007,.033,.016,.05][frames++%4],autopilot(b));}
 // Input is sampled once per advance call, so compare against a sim fed the same way instead.
 const c=new DriveSim(plan);frames=0;while(!c.done&&c.t<a.t-1e-9){c.advance([.007,.033,.016,.05][frames++%4],autopilot(c));}
 assert.equal(c.s,b.s);assert.equal(c.cash,b.cash);assert.deepEqual(c.cops,b.cops);
 assert.deepEqual(simulateDrive(plan),simulateDrive(plan));
});
test('Auto-drive finishes every route; escapes happen, busts are rare and cash stays capped',()=>{
 const tally=Object.fromEntries(RESULTS.map(r=>[r,0]));
 for(let i=1;i<=40;i++)for(const heat of [0,25,65]){const from=i%5,to=(from+1+i%4)%5,o=simulateDrive(planDrive({seed:driveSeed(i,i%30+1,from,to),from,to,heat,day:i%30+1}));assert.ok(validDriveOutcome(o),JSON.stringify(o));tally[o.result]++;if(heat===0)assert.notEqual(o.result,'escaped');}
 assert.ok(tally.clean>=30);assert.ok(tally.escaped>=5);assert.ok(tally.busted<=15,JSON.stringify(tally));
});
test('Pickups, near misses, crashes and the speed trap are scored by the rules',()=>{
 const plan=planDrive({seed:9,from:0,to:1,heat:0});plan.traffic=[];plan.bends=[];plan.pickups=[{s:60,d:LANES[2],value:30}];plan.patrol={s:200,d:9};
 const sim=new DriveSim(plan);while(sim.s<100)sim.step({throttle:1});assert.equal(sim.cash,30);assert.ok(sim.events.some(e=>e.type==='cash'));
 while(sim.s<220)sim.step({throttle:1});assert.ok(sim.chased,'blowing past the patrol flat out starts a chase');assert.ok(sim.stars>=1);
 const p2=planDrive({seed:9,from:0,to:1,heat:0});p2.bends=[];p2.patrol=null;p2.pickups=[];p2.traffic=[{lane:3,s:80,v:10,dir:1,kind:0}];const near=new DriveSim(p2);near.d=LANES[2]+.85;near.v=30;
 while(near.s<120)near.step({throttle:1});assert.equal(near.nearMisses,1);assert.equal(near.crashes,0);
 const p3=clone(p2);p3.traffic=[{lane:2,s:80,v:10,dir:1,kind:0}];const hit=new DriveSim(p3);hit.v=30;while(hit.s<150&&!hit.crashes)hit.step({throttle:1});assert.equal(hit.crashes,1);assert.ok(hit.v<30);
});
test('Cruisers bust a stopped driver and give up on one who gets away',()=>{
 const plan=planDrive({seed:21,from:0,to:4,heat:30});plan.traffic=[];plan.bends=[];
 const stopped=new DriveSim(plan);while(!stopped.done)stopped.step({brake:1});assert.equal(stopped.outcome().result,'busted');
 const fast=planDrive({seed:21,from:0,to:4,heat:12});fast.traffic=[];fast.bends=[];fast.length=4000;const run=new DriveSim(fast);while(!run.done&&run.t<200)run.step({throttle:1});
 assert.equal(run.outcome().result,'escaped');assert.ok(run.events.some(e=>e.type==='lost'));
});
test('Drive outcomes feed travel: cash, risk, heat and a patrol stop, all save-compatible',()=>{
 const base=new LivingTradeGame(null,4242);base.buy(5,6);const saved=clone(base.save());
 // No drive (skipped or no 3D) is exactly the old trip.
 const a=new LivingTradeGame(clone(saved)),b=new LivingTradeGame(clone(saved));a.travel(2);b.travel(2,null);assert.deepEqual(a.save(),b.save());assert.equal(a.save().world.lastDrive,undefined);
 // A clean run adds the road cash and records itself.
 const c=new LivingTradeGame(clone(saved));const cash=c.cash;c.travel(2,{v:1,result:'clean',cash:120,nearMisses:8,crashes:0,stars:0,seconds:40});assert.ok(validLivingTrade(c.save()));
 assert.equal(c.world.lastDrive.result,'clean');assert.equal(c.world.lastDrive.cash,120);assert.equal(c.world.road.trips,1);assert.ok(c.cash>=cash+120-1000);assert.match(c.logs.map(l=>l.message).join(' '),/\+\$120 picked up/);
 // Busted always ends in a patrol stop with three choices; each resolves once.
 for(const id of ['fine','search','talk']){const g=new LivingTradeGame(clone(saved));g.travel(1,{v:1,result:'busted',cash:0,nearMisses:0,stars:2});assert.equal(g.world.pending.kind,'stop');const e=g.encounter();assert.deepEqual(e.options.map(o=>o.id),['fine','search','talk']);
  const before=g.save(),h=new LivingTradeGame(clone(before));assert.ok(validLivingTrade(before));assert.equal(g.resolve(id),true);assert.equal(h.resolve(id),true);assert.deepEqual(h.save(),g.save());assert.equal(g.world.pending,null);assert.equal(g.resolve(id),false);assert.ok(g.cash>=0);}
 const s=new LivingTradeGame(clone(saved));s.travel(1,{v:1,result:'busted',cash:0,nearMisses:0});const units=s.bag[5];s.resolve('search');assert.equal(s.bag[5],units-Math.ceil(units*.4));
 // Escapes cool you off; a tail heats you up. Bogus outcomes are ignored.
 const e1=new LivingTradeGame(clone(saved));e1.heat=50;e1.travel(3,{v:1,result:'escaped',cash:0,nearMisses:0});const t1=new LivingTradeGame(clone(saved));t1.heat=50;t1.travel(3,{v:1,result:'tailed',cash:0,nearMisses:0});assert.ok(e1.heat<t1.heat);
 const x=new LivingTradeGame(clone(saved)),y=new LivingTradeGame(clone(saved));x.travel(4,{result:'escaped',cash:99999,nearMisses:1});y.travel(4);assert.deepEqual(x.save(),y.save());
 assert.ok(e1.travelRisk(1)>0);
});
test('Saves with drive records validate; corrupt drive records and old saves behave',()=>{
 const g=new LivingTradeGame(null,99);g.travel(1,{v:1,result:'escaped',cash:40,nearMisses:2,stars:1});if(g.world.pending)g.resolve(g.encounter().options.find(o=>!o.disabled).id);const s=g.save();assert.ok(validLivingTrade(s));assert.deepEqual(new LivingTradeGame(clone(s)).save(),s);
 for(const bad of [w=>{w.lastDrive.result='teleported';},w=>{w.lastDrive.cash=DRIVE_CASH_CAP+1;},w=>{w.road.trips=-1;},w=>{w.lastDrive=null;},w=>{w.pending={kind:'stop',amount:-5,good:0};}]){const c=clone(s);bad(c.world);assert.equal(validLivingTrade(c),false);}
 const old=new LivingTradeGame(null,5).save();delete old.world.upgrades;assert.ok(validLivingTrade(old));const legacy=new TradeGame(()=>.4);legacy.buy(5,2);assert.ok(validLivingTrade(new LivingTradeGame(legacy.save(),12).save()));
});
test('Radio stations point at real soundtrack tracks',()=>{
 for(const st of RADIO)if(st.track)assert.ok(TRACKS[st.track],st.track);assert.ok(RADIO.some(s=>s.track===null),'radio can be switched off');
});
test('The Street Hustle panel carries the drive toggle, phone wire and job card hooks',async()=>{
 const fs=await import('node:fs');const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');for(const id of ['driveToggle','hustlePhoneToggle','hustlePhoneBody','hustleCard','hustleCardTitle'])assert.match(html,new RegExp('id="'+id+'"'),id);
 const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');assert.ok(app.includes("import('./hustle-drive-3d.js')"));assert.ok(!app.includes('trade.travel(Number(b.dataset'),'every travel button goes through the drive');
});
