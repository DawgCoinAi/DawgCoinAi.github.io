import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorldSim,autopilot,driveUntilParked,STOPS,NODES,EDGES,HOPS,RECTS,ALLEYS,rectAt,routeTo,routeLength,lineOfSight,districtAt,evadeTime,EXPRESS_BONUS,TOP_SPEED,CAR_R} from '../dist/hustle-world.js';
import {LivingTradeGame,validLivingTrade,FEATS,CHAPTERS,chapterOf,dailyContract} from '../dist/living-trade.js';
import {validDriveOutcome,DRIVE_CASH_CAP} from '../dist/hustle-drive.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const run=(sim,seconds,input)=>{for(let i=0;i<seconds*60;i++)sim.step(typeof input==='function'?input(sim):input);};

test('The city is one connected grid with every stop on drivable ground in its own district',()=>{
 assert.ok(HOPS.every(row=>row.every(d=>d<99)),'every junction reaches every other');assert.equal(NODES.length,25);assert.ok(EDGES.length>=30);
 for(const s of STOPS){assert.ok(rectAt(s.x,s.z,CAR_R),s.name+' is reachable');if(s.kind==='market')assert.equal(districtAt(s.x,s.z),s.district,s.name);}
 assert.deepEqual(STOPS.filter(s=>s.kind==='market').map(s=>s.district),[0,1,2,3,4]);assert.equal(STOPS.filter(s=>s.kind==='garage').length,2);
 for(const a of ALLEYS)assert.ok(rectAt((a.x0+a.x1)/2,(a.z0+a.z1)/2,1)&&!rectAt((a.x0+a.x1)/2,(a.z0+a.z1)/2,1,true),'cruisers cannot use alleys');
 assert.equal(lineOfSight(0,0,100,0),true);assert.equal(lineOfSight(-70,-70,0,-70),false,'no sight line through a block');
 const r=routeTo(56,8,STOPS[2]);assert.ok(r.length>=3&&routeLength(r)>300);
});
test('The car accelerates, tops out, brakes, reverses and slides on the handbrake',()=>{
 const sim=new WorldSim({seed:3});sim.cars=[];sim.cops=[];sim.leaving=0;sim.x=-100;sim.z=1.75;sim.h=Math.PI/2;
 run(sim,2,{throttle:1});assert.ok(sim.speed>14&&sim.speed<24,'0-45 mph in two seconds: '+sim.speed);const z=sim.z;assert.ok(Math.abs(z-1.75)<.01,'tracks straight');
 run(sim,.75,{brake:1});assert.ok(sim.speed<1.5,'stops from 40 mph in under a second');run(sim,2,{brake:1});assert.ok(sim.vf<-3,'brake becomes reverse');
 const fast=new WorldSim({seed:3});fast.cars=[];fast.cops=[];fast.leaving=0;fast.x=-250;fast.z=1.75;fast.h=Math.PI/2;fast.vx=30;
 run(fast,.5,{throttle:1,steer:1,handbrake:true});assert.ok(fast.drifting&&Math.abs(fast.slip)>3,'handbrake breaks the rear loose');
 const grip=new WorldSim({seed:3});grip.cars=[];grip.cops=[];grip.leaving=0;grip.x=-250;grip.z=1.75;grip.h=Math.PI/2;grip.vx=20;run(grip,.4,{throttle:1,steer:.5});assert.equal(grip.drifting,false,'a normal turn grips');
 const top=new WorldSim({seed:3});top.cars=[];top.cops=[];top.leaving=0;top.x=-270;top.z=1.75;top.h=Math.PI/2;run(top,9,{throttle:1});assert.ok(top.topSpeed<=TOP_SPEED+.01&&top.topSpeed>36);
});
test('Buildings stop you: the car never leaves the streets, and a square hit costs speed',()=>{
 const sim=new WorldSim({seed:5});sim.cars=[];sim.cops=[];sim.leaving=0;sim.x=70;sim.z=0;sim.h=0;sim.vz=-25;
 run(sim,1.5,{throttle:1});assert.ok(rectAt(sim.x,sim.z,CAR_R-.01),'still on the street');assert.ok(sim.trip.crashes>=1);assert.ok(sim.events.some(e=>e.type==='crash'&&e.wall));assert.ok(sim.speed<12);
});
test('The same seed and inputs replay exactly, at any frame rate',()=>{
 const a=new WorldSim({seed:99,heat:30}),b=new WorldSim({seed:99,heat:30});a.gps=b.gps=3;
 for(let i=0;i<600;i++){a.step(autopilot(a));b.step(autopilot(b));}assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.deepEqual(clone(a.cars),clone(b.cars));assert.deepEqual(clone(a.cops),clone(b.cops));
 const c=new WorldSim({seed:99}),d=new WorldSim({seed:99});let n=0;for(const dt of [.016,.033,.007,.05,.016,.02])n+=c.advance(dt,{throttle:1});for(let i=0;i<n;i++)d.step({throttle:1});assert.equal(c.x,d.x);
});
test('Auto-drive reaches dealers and spray shops and pulls up without a scratch on most trips',()=>{
 let crashes=0;for(const [from,to] of [[0,1],[0,2],[1,4],[2,3],[3,0],[4,5],[2,6]]){const sim=new WorldSim({seed:from*7+to+1,district:from});sim.gps=to;const t=driveUntilParked(sim,autopilot,200);assert.ok(t>0,`${from}→${to} arrives`);assert.equal(sim.parked,to);crashes+=sim.trip.crashes;assert.ok(sim.events.some(e=>e.type==='parked'));}
 assert.ok(crashes<=4,'crashes '+crashes);
});
test('Pulling up at another dealer hands the trade a valid trip outcome; express runs pay a capped bonus',()=>{
 const sim=new WorldSim({seed:11,district:0});sim.cars=[];sim.cops=[];const r=sim.startRun(3);assert.ok(r.par>20);assert.equal(sim.gps,3);
 sim.trip.cash=30;sim.trip.nearMisses=2;sim.x=STOPS[3].x;sim.z=STOPS[3].z;sim.parked=3;const out=sim.arrive();assert.ok(validDriveOutcome(out));assert.equal(out.result,'clean');assert.equal(out.cash,30+EXPRESS_BONUS);assert.equal(out.express,EXPRESS_BONUS);assert.equal(sim.trip.cash,0,'a new trip starts');
 const late=new WorldSim({seed:11});late.cars=[];late.cops=[];late.startRun(3);late.run.t=late.run.par+1;late.world(1/60);assert.ok(late.run.late);late.parked=3;assert.equal(late.arrive().express,0);
 const rich=new WorldSim({seed:11});rich.addCash(9999);assert.equal(rich.trip.cash,DRIVE_CASH_CAP);
});
test('Heat brings cruisers: spotted when wanted, lost by breaking line of sight, busted when boxed in',()=>{
 const sim=new WorldSim({seed:21,heat:45});assert.equal(sim.stars,3);sim.cars=[];sim.leaving=0;sim.x=-100;sim.z=1.75;sim.h=Math.PI/2;
 const cop=sim.cops[0];cop.x=-130;cop.z=1.75;cop.h=Math.PI/2;sim.step({});assert.ok(sim.chase,'a patrol with a sight line starts the chase');assert.equal(sim.chase.stars,3);assert.ok(sim.events.some(e=>e.type==='spotted'));
 assert.equal(sim.canPark(STOPS[0]),false,'dealers will not serve you mid-chase');assert.equal(sim.canPark(STOPS[5]),false,'nor a spray shop while they can see you');
 // Sit still with a cruiser on the bumper: busted.
 run(sim,8,{});assert.equal(sim.busted,true);const o=sim.bustOutcome();assert.ok(validDriveOutcome(o));assert.equal(o.result,'busted');assert.equal(o.cash,0);sim.release();assert.equal(sim.busted,false);assert.equal(sim.chase,null);assert.ok(sim.calm>0);
 // Out of sight long enough: they give up, and the trip counts as an escape.
 const esc=new WorldSim({seed:22,heat:12});esc.cars=[];esc.leaving=0;esc.startChase(esc.cops[0],'wanted');for(const c of esc.cops){c.x=280;c.z=280;}esc.x=-70;esc.z=-70;esc.h=0;
 run(esc,evadeTime(1)/1.8+.5,{});assert.equal(esc.chase,null,'hiding in an alley shakes them faster');assert.ok(esc.trip.escaped);assert.ok(esc.events.some(e=>e.type==='lost'));esc.parked=0;assert.equal(esc.arrive().result,'escaped');
 // A respray ends a chase only if nobody watched you roll in.
 const g=new WorldSim({seed:23,heat:30});g.startChase(g.cops[0],'wanted');g.chase.seen=true;assert.equal(g.respray(),false);g.chase.seen=false;assert.equal(g.respray(),true);assert.equal(g.chase,null);assert.ok(g.trip.escaped);
 // Three stars and up: roadblocks across the street ahead.
 const rb=new WorldSim({seed:24,heat:70});rb.x=-120;rb.z=1.75;rb.h=Math.PI/2;assert.equal(rb.roadblock(),true);assert.equal(rb.blocks[0].cars.length,3);assert.ok(rb.blocks[0].cars.every(q=>Math.abs(q.z)<8));
});
test('A calm night: no chase without heat unless you speed past a patrol; near misses and cash drops pay',()=>{
 const sim=new WorldSim({seed:31,heat:0});sim.cars=[];sim.leaving=0;sim.x=-100;sim.z=1.75;sim.h=Math.PI/2;const cop=sim.cops[0];cop.x=-90;cop.z=-1.75;cop.h=-Math.PI/2;sim.step({});assert.equal(sim.chase,null);
 sim.vx=36;sim.speed=36;cop.x=sim.x+8;sim.step({throttle:1});assert.ok(sim.chase&&sim.chase.why==='speeding');
 const p=new WorldSim({seed:32});p.cars=[];p.cops=[];p.leaving=0;p.pickups=[{x:-60,z:1.75,value:25,taken:false}];p.x=-100;p.z=1.75;p.h=Math.PI/2;run(p,4,{throttle:1});assert.equal(p.trip.cash,25);
 const n=new WorldSim({seed:33});n.cops=[];n.leaving=0;n.cars=[n.cars[0]];Object.assign(n.cars[0],{a:11,b:12,u:60,lane:5.25,v:0,vmax:0,mode:'edge',stun:99,x:-80,z:5.25,h:Math.PI/2});n.x=-125;n.z=1.75;n.h=Math.PI/2;n.vx=24;run(n,2.5,{throttle:1});assert.equal(n.trip.nearMisses,1);assert.equal(n.trip.crashes,0);assert.ok(n.trip.cash>=10);
});
test('Mid-drive busts, resprays and the parked spot are engine rules that save and validate',()=>{
 const g=new LivingTradeGame(null,4242);g.buy(5,6);g.heat=50;const day=g.day;assert.equal(g.pulledOver({v:1,result:'busted',cash:0,nearMisses:3,stars:3}),true);assert.equal(g.day,day,'no night passes');assert.equal(g.world.pending.kind,'stop');assert.equal(g.world.road.busts,1);assert.ok(validLivingTrade(g.save()));assert.equal(g.pulledOver(),false,'not twice');g.resolve('search');
 const cash=g.cash,cost=g.resprayCost;assert.equal(cost,150+Math.round(g.heat)*8);const heat=g.heat;assert.equal(g.respray(),true);assert.equal(g.cash,cash-cost);assert.equal(g.heat,Math.max(0,heat-35));assert.equal(g.respray(),false,'once a night');assert.ok(g.feats.includes('trade.respray'));
 assert.equal(g.setSpot({x:12.4,z:-140.2,h:1.5707}),true);const s=g.save();assert.ok(validLivingTrade(s));assert.deepEqual(s.world.spot,{x:12,z:-140,h:1.57});assert.deepEqual(new LivingTradeGame(clone(s)).save(),s);
 for(const bad of [w=>{w.spot.x=9999;},w=>{w.spot=null;},w=>{w.lastSpray=0;},w=>{w.feats=['trade.nope'];},w=>{w.feats=['trade.respray','trade.respray'];},w=>{w.best={escape:9,deal:0};},w=>{w.daily='tomorrow';}]){const c=clone(s);bad(c.world);assert.equal(validLivingTrade(c),false);}
 const old=new LivingTradeGame(null,5).save();assert.equal(old.world.spot,undefined);assert.equal(old.world.feats,undefined);assert.ok(validLivingTrade(old));const sim=new WorldSim({seed:old.world.seed,district:old.district,spot:old.world.spot||null});assert.equal(sim.stopHere().id,old.district,'an old save starts at its dealer');
});
test('Every feat can be earned, once, and the earned list survives a save',()=>{
 const ids=FEATS.map(f=>f.id);assert.ok(ids.length>=8);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.every(id=>/^trade\.[a-z]+$/.test(id)));
 const g=new LivingTradeGame(null,77);g.cash=200000;g.events.length=0;
 g.buy(5,5);g.prices[5]+=50;g.sell(5,5);assert.ok(g.feats.includes('trade.firstflip'));
 g.stock[0]=20;g.buy(0,10);g.prices[0]=Math.max(g.prices[0],600);g.sell(0,10);assert.ok(g.feats.includes('trade.bigdeal'));assert.ok(g.best.deal>=5000);
 g.repay();assert.equal(g.debt,0);assert.ok(g.feats.includes('trade.debtfree'));
 g.world.contract={good:5,quantity:3,destination:g.district,deadline:30,reward:300,status:'open'};g.stock[5]=30;g.buy(5,3);assert.equal(g.deliver(),true);assert.ok(g.feats.includes('trade.delivery'));
 for(const p of ['scout','quiet','courier'])assert.equal(g.buyPerk(p),true);assert.ok(g.feats.includes('trade.fullkit'));
 assert.equal(g.respray(),true);assert.ok(g.feats.includes('trade.respray'));
 const day='2026-11-14',d=dailyContract(day);assert.deepEqual(dailyContract(day),d);assert.notDeepEqual(dailyContract('2026-11-15'),d);g.district=d.destination;g.prices=g.world.markets[g.district].prices;g.stock[d.good]=40;g.buy(d.good,d.quantity);const cash=g.cash;assert.equal(g.deliverDaily(day),true);assert.equal(g.cash,cash+d.reward);assert.equal(g.deliverDaily(day),false,'one daily drop per date');assert.ok(g.feats.includes('trade.daily'));
 g.travel((g.district+1)%5,{v:1,result:'escaped',cash:50,nearMisses:6,crashes:0,stars:3,seconds:40,express:100});assert.ok(['trade.escape','trade.ghost','trade.threader','trade.express'].every(id=>g.feats.includes(id)));assert.equal(g.best.escape,3);
 if(g.world.pending)g.resolve(g.encounter().options.find(o=>!o.disabled).id);g.world.pending={kind:'stop',amount:60,good:0};g.world.reputation=999;g.random=()=>0;assert.equal(g.resolve('talk'),true);assert.ok(g.feats.includes('trade.smooth'));
 assert.ok(g.netWorth>=50000);g.standing();assert.ok(g.feats.includes('trade.kingpin'));
 assert.deepEqual([...g.feats].sort(),[...ids].sort(),'all feats earned');const fired=g.events.filter(e=>e.type==='feat').map(e=>e.id);assert.equal(new Set(fired).size,fired.length);assert.equal(fired.length,ids.length);
});
test('Reputation climbs a named ladder; each chapter makes new orders pay more',()=>{
 assert.equal(CHAPTERS.length,6);assert.equal(chapterOf(0).name,'Block Pup');assert.equal(chapterOf(0).toNext,12);assert.equal(chapterOf(12).name,'Strip Runner');assert.equal(chapterOf(999).next,null);
 const a=new LivingTradeGame(null,9),b=new LivingTradeGame(null,9);b.world.reputation=60;a.offerContract();b.offerContract();assert.ok(b.world.contract.reward>a.world.contract.reward);
 const g=new LivingTradeGame(null,9);g.events.length=0;g.world.reputation=11;g.world.contract={good:5,quantity:3,destination:g.district,deadline:30,reward:300,status:'open'};g.stock[5]=30;g.buy(5,3);g.deliver();assert.ok(g.events.some(e=>e.type==='chapter'&&e.name==='Strip Runner'));assert.equal(g.chapter.index,1);
});
test('The Street Hustle panel is a phone with five apps over a drivable city',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');for(const id of ['hustleStage','hustlePhone','hustlePhoneToggle','hustlePhoneBody','hustleEnter','hustleMap','driveToggle','resprayButton','dailyDeliver','hustleFeats','hustleRank','marketRows','tradeEncounter'])assert.match(html,new RegExp('id="'+id+'"'),id);
 for(const tab of ['market','msgs','map','bank','garage']){assert.match(html,new RegExp('data-hp-tab="'+tab+'"'));assert.match(html,new RegExp('data-screen="'+tab+'"'));}
 const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),phone=fs.readFileSync(new URL('../dist/hustle-phone.js',import.meta.url),'utf8');assert.ok(app.includes("from './hustle-phone.js'"));assert.ok(phone.includes("import('./hustle-world-3d.js')"),'the city loads on demand');assert.ok(!app.includes('trade.travel(Number(b.dataset'),'travel goes through the GPS');
});
