import test from 'node:test';
import assert from 'node:assert/strict';
import {proceduralMaze,reachableGrid,snakeGarden,seededRandom} from '../dist/world.js';
import {MazeGame,TradeGame} from '../dist/engine.js';
import {snapshotMaze,restoreMaze} from '../dist/checkpoint.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {crossLane,stepPack} from '../dist/pack-engine.js';
import {LivingTradeGame,validLivingTrade} from '../dist/living-trade.js';
import {LivingStoryGame,createStory,validStorySave} from '../dist/living-story.js';
import {StoryGame} from '../dist/story-engine.js';
import {parseBackup} from '../dist/progress-backup.js';
const clone=x=>JSON.parse(JSON.stringify(x));

test('300 generated mazes have reachable coins, powers and actors, with stable seeds and distinct layouts',()=>{
 const layouts=new Set();for(let seed=1;seed<=100;seed++)for(let level=1;level<=3;level++){
  const map=proceduralMaze(seed,level),blocked=new Set();map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')blocked.add(x+','+y);}));const seen=reachableGrid(21,23,blocked,{x:10,y:15});
  assert.equal(seen.size,21*23-blocked.size,`seed ${seed}, level ${level}`);for(const p of ['10,9','9,11','11,11','10,5'])assert.ok(seen.has(p));assert.equal(map.join('').split('o').length-1,4);assert.deepEqual(map,proceduralMaze(seed,level));layouts.add(map.join(''));
 }assert.equal(layouts.size,300);
});
test('Generated maze checkpoint restores both layout and future random decisions',()=>{
 const g=new MazeGame('classic',seededRandom(8123),{worldSeed:8123});g.start();g.tick(.1);const a=snapshotMaze(g),restored=restoreMaze(clone(a));assert.ok(restored);const h=restored.game;assert.deepEqual(h.map,g.map);assert.equal(h.random(),g.random());g.status=h.status='level';g.nextLevel();h.nextLevel();assert.deepEqual(h.map,g.map);assert.equal(h.level,2);
});
test('100 Snake gardens remain connected, protect the spawn, and never hide food inside stone',()=>{
 const layouts=new Set();for(let seed=1;seed<=100;seed++){
  const g=createQuickGame('snake',seed),blocked=new Set(g.rocks.map(p=>p.x+','+p.y));layouts.add(JSON.stringify(g.rocks));assert.equal(reachableGrid(15,18,blocked,{x:7,y:9}).size,270-blocked.size);assert.ok(g.rocks.length>=8);assert.ok(!g.body.some(p=>blocked.has(p.x+','+p.y)));assert.ok(!blocked.has(g.food.x+','+g.food.y));g.start();const restored=restoreQuick(clone(snapshotQuick(g,'snake')));assert.deepEqual(restored.rocks,g.rocks);
 }assert.equal(layouts.size,100);
});
test('Snake stone collisions end a run and corrupted checkpoints cannot put the head in a stone',()=>{
 const g=createQuickGame('snake',883);g.start();const rock=g.rocks.find(r=>r.x>2);g.body=[{x:rock.x-1,y:rock.y},{x:rock.x-2,y:rock.y},{x:rock.x-3,y:rock.y}];g.dir='right';g.tick(g.interval);assert.equal(g.status,'over');assert.match(g.reason,/garden wall/);
 const h=createQuickGame('snake',883);h.start();const s=snapshotQuick(h,'snake');s.food={...h.rocks[0]};assert.equal(restoreQuick(s),null);
});
test('Cross seeds change road types and traffic while preserving a safe park every five rows',()=>{
 const layouts=new Set();for(let seed=1;seed<=100;seed++){const lanes=Array.from({length:100},(_,i)=>crossLane(i,seed));layouts.add(JSON.stringify(lanes));for(let i=0;i<100;i+=5)assert.equal(lanes[i].type,'park');const g=createQuickGame('cross',seed);g.start();g.time=11;const h=restoreQuick(snapshotQuick(g,'cross'));assert.equal(h.worldSeed,seed);assert.deepEqual(crossLane(9,h.worldSeed),lanes[9]);}assert.equal(layouts.size,100);
});
test('Flappy moving gates have bounded drift and save their exact future motion',()=>{
 const g=createQuickGame('flappy',91);g.gates=12;g.obstacles=[];g.spawn(480);assert.ok(g.obstacles[0].amplitude>0);g.start();g.time=8;g.tick(1/120);const h=restoreQuick(snapshotQuick(g,'flappy'));assert.ok(h);h.start();for(let i=0;i<30;i++){g.tick(1/120);h.tick(1/120);}assert.deepEqual(h.obstacles,g.obstacles);assert.equal(h.y,g.y);
 for(let seed=1;seed<=50;seed++){const f=createQuickGame('flappy',seed);f.gates=40;for(let i=0;i<20;i++)f.spawn(480+i*260);for(let i=1;i<f.obstacles.length;i++){const o=f.obstacles[i];assert.ok(Math.abs(o.baseCenter-f.obstacles[i-1].center)<=105);assert.ok(o.amplitude<=32,"wobble stays within the save validator limit");assert.ok(o.center>=150&&o.center<=395);}}
});
test('30 generated Flappy worlds can each clear at least 20 gates using timed input alone',()=>{
 for(let seed=1;seed<=30;seed++){const g=createQuickGame('flappy',seed);g.start();for(let i=0;i<60*45&&g.status==='playing';i++){const next=g.obstacles.find(o=>o.x+o.width>g.x-14),target=next?.center||270;if(g.y>target+8&&g.vy>0)g.flap();stepPack(g,1/60);}assert.equal(g.status,'playing',`seed ${seed}`);assert.ok(g.gates>=20);}
});
function resolveSafely(g){if(g.world.pending){const e=g.encounter();g.resolve(e.options.find(o=>o.id==='leave'||o.id==='yield')?.id||e.options.find(o=>!o.disabled).id);}}
test('100 living-market campaigns preserve accounting and exact continuation across every night',()=>{
 const starts=new Set();for(let seed=1;seed<=100;seed++){
  let g=new LivingTradeGame(null,seed);starts.add(JSON.stringify(g.world.markets));const rng=seededRandom(seed+400);assert.ok(validLivingTrade(g.save()));
  for(let night=1;night<30;night++){
   resolveSafely(g);for(let j=0;j<6;j++){const good=Math.floor(rng()*6),cash=g.cash,units=g.bag[good],price=g.prices[good],stock=g.stock[good];if(rng()<.55){const n=g.buy(good,rng()<.5?'max':5);assert.equal(g.cash,cash-n*price);assert.equal(g.bag[good],units+n);assert.equal(g.stock[good],stock-n);}else{const n=g.sell(good,'max');assert.equal(g.cash,cash+n*price);assert.equal(g.bag[good],units-n);}}
   if(night%7===0)g.deposit();if(night%7===1)g.withdraw();g.deliver();g.talk();const before=clone(g.save()),h=new LivingTradeGame(before);assert.deepEqual(h.save(),before);const destination=(g.district+1+Math.floor(rng()*4))%5;assert.equal(g.travel(destination),true);assert.equal(h.travel(destination),true);assert.deepEqual(h.save(),g.save());assert.equal(g.debt,Math.ceil(before.debt*1.03));assert.equal(g.bank,Math.floor(before.bank*1.005));assert.ok(validLivingTrade(g.save()));resolveSafely(g);assert.ok(g.cash>=0&&g.used<=g.capacity);g=new LivingTradeGame(g.save());
  }assert.equal(g.day,30);assert.equal(g.travel((g.district+1)%5),false);const worth=g.netWorth;assert.equal(g.finish(),true);assert.equal(g.netWorth,worth);const final=g.save();assert.equal(g.finish(),false);assert.deepEqual(g.save(),final);
 }assert.equal(starts.size,100);
});
test('Encounters cannot be bypassed, rerolled on reload, or awarded twice',()=>{
 const g=new LivingTradeGame(null,42);g.buy(5,5);g.world.pending={kind:'toll',amount:70,good:0};const before=g.save();for(const action of [()=>g.buy(5,2),()=>g.sellAll(),()=>g.repay(),()=>g.deposit(),()=>g.withdraw(),()=>g.upgrade(),()=>g.deliver(),()=>g.talk(),()=>g.travel(1),()=>g.finish()]){action();assert.deepEqual(g.save(),before);}
 const h=new LivingTradeGame(clone(before));assert.equal(g.resolve('bluff'),true);assert.equal(h.resolve('bluff'),true);assert.deepEqual(h.save(),g.save());const after=g.save();assert.equal(g.resolve('bluff'),false);assert.deepEqual(g.save(),after);
});
test('Finite stock, pressure, contracts and deadlines create consequences without duplicate rewards',()=>{
 const g=new LivingTradeGame(null,55);g.cash=20000;g.stock[5]=3;assert.equal(g.buy(5,'max'),3);assert.equal(g.buy(5,1),0);assert.ok(g.world.markets[0].pressure[5]>0);g.sell(5,3);assert.equal(g.stock[5],3);
 g.world.contract={good:5,quantity:3,destination:0,deadline:2,reward:300,status:'open'};g.buy(5,3);const cash=g.cash;assert.equal(g.deliver(),true);assert.equal(g.cash,cash+300);assert.equal(g.bag[5],0);assert.equal(g.cost[5],0);assert.equal(g.world.reputation,12);assert.equal(g.deliver(),false);assert.equal(g.cash,cash+300);
 g.world.contract={good:5,quantity:3,destination:0,deadline:1,reward:300,status:'open'};g.travel(1);assert.equal(g.world.contract.status,'expired');resolveSafely(g);g.travel(2);assert.equal(g.world.contract.status,'open');assert.ok(g.world.contract.deadline>g.day);
});
test('Old trade campaigns retain balances and inventory while joining the living economy',()=>{
 const old=new TradeGame(()=>.5);old.buy(5,4);old.deposit();const before=old.save(),g=new LivingTradeGame(before,77);for(const key of ['cash','bank','debt','day','bag','prices','cost','district'])assert.deepEqual(g.save()[key],before[key]);assert.ok(validLivingTrade(g.save()));const broken=g.save();broken.world.markets[0].stock[0]=-1;assert.equal(validLivingTrade(broken),false);
});
function solveStory(seed,ending,favor=true){
 let s=new LivingStoryGame(null,seed),e=s.episode;s.choose('poster');if(favor){s.choose('favor');s.choose('badge-'+['red','blue','gold'].find(c=>c!==e.favor));s.choose('favor');s.choose('badge-'+e.favor);assert.ok(s.flags.favor);}
 s.go(e.tokenRoom);s.choose('fountain');s.go(e.barRoom);s.use('token');s.go(e.djRoom);s.use('coffee');s.use('vinyl');const wrong=e.recipe.find(w=>w!==e.recipe[0]);s.choose('mix-'+wrong);assert.deepEqual(s.mix,[]);s.choose('mix-'+e.recipe[0]);assert.ok(validStorySave(s.save()));s=createStory(clone(s.save()));e=s.episode;s.choose('mix-'+e.recipe[1]);s.choose('mix-'+e.recipe[2]);assert.ok(s.flags.mixed);
 s.go('club');s.use('comb');s.choose('brick');const invalid=s.actions().find(a=>a.id!=='password-'+e.password);s.choose(invalid.id);s.choose('brick');s.choose('password-'+e.password);s.choose('brick');assert.ok(s.flags.pass);s.go('roof');if(ending==='connection'){s.choose('nova');s.choose('connect-'+['curious','playful','grounded'].find(m=>m!==e.mood));assert.ok(!s.flags.kind);s.choose('nova');s.choose('connect-'+e.mood);s.choose('sunrise');}else s.choose(ending==='headliner'?'play':'mic');assert.equal(s.ending,ending);assert.ok(validStorySave(s.save()));return s;
}
test('300 generated adventures have recoverable puzzles and paths to all three endings',()=>{
 const episodes=new Set(),epilogues=new Set();for(let seed=1;seed<=100;seed++)for(const ending of ['headliner','connection','flop']){const s=solveStory(seed,ending);episodes.add(JSON.stringify(s.episode));epilogues.add(s.result.text);assert.ok(s.has('souvenir'));assert.equal(s.inventory.filter(i=>i==='souvenir').length,1);assert.deepEqual(createStory(s.save()).save(),s.save());}assert.equal(episodes.size,100);assert.ok(epilogues.size>150);
});
test('Optional story favor adds one bonus, and original saved chapters remain playable',()=>{
 const a=solveStory(123,'headliner'),b=solveStory(123,'headliner',false);assert.equal(a.result.score,b.result.score+150);assert.notEqual(a.result.text,b.result.text);const old=new StoryGame();old.choose('fountain');const restored=createStory(old.save());assert.ok(restored instanceof StoryGame);assert.deepEqual(restored.save(),old.save());
});
test('Portable backups accept living worlds and reject corrupted economy or story state',()=>{
 const trade=new LivingTradeGame(null,88),story=new LivingStoryGame(null,99),base={format:'dawg-arcade-backup',version:1,saves:{trade:{version:1,state:trade.save()},story:story.save()}};assert.deepEqual(parseBackup(JSON.stringify(base)),base);const bad=clone(base);bad.saves.trade.state.world.pending={kind:'toll',amount:-2,good:0};assert.throws(()=>parseBackup(JSON.stringify(bad)));const badStory=clone(base);badStory.saves.story.mix=['WRONG'];assert.throws(()=>parseBackup(JSON.stringify(badStory)));
});
