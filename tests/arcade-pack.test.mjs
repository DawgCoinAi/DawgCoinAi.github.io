import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {GAME_IDS} from '../dist/games.js';
import {FlappyGame,CrossGame,crossLane,laneObjects,stepPack,packLayout} from '../dist/pack-engine.js';
import {StoryGame,ENDINGS} from '../dist/story-engine.js';
import {TradeGame,validTradeState} from '../dist/engine.js';

test('Flappy starts on input, freezes on pause, and scores each gate exactly once',()=>{
 const g=new FlappyGame(()=>.5);assert.equal(g.flap(),false);g.start();assert.equal(g.flap(),true);g.pause();const y=g.y;stepPack(g,.2);assert.equal(g.y,y);g.start();g.vy=0;g.y=250;g.obstacles=[{x:20,width:66,center:250,gap:200,passed:false}];g.tick(.001);assert.equal(g.gates,1);assert.equal(g.score,15);assert.equal(g.perfect,1);g.tick(.001);assert.equal(g.score,15);
});
test('Flappy obstacles, floor, and ceiling end a run without giving repeated results',()=>{
 for(const type of ['tower','floor']){const g=new FlappyGame(()=>.5);g.start();g.vy=0;g.y=type==='floor'?515:80;if(type==='tower')g.obstacles=[{x:100,width:66,center:250,gap:180,passed:false}];g.tick(.01);assert.equal(g.status,'over',type);const events=g.events.length;g.tick(1);g.flap();assert.equal(g.events.length,events);}
});
test('A rhythm-playing Flappy bot can clear successive gates without teleporting',()=>{
 const g=new FlappyGame(()=>.5);g.start();for(let i=0;i<60*45&&g.status==='playing';i++){const next=g.obstacles.find(o=>o.x+o.width>g.x-14),target=next?.center||270;if(g.y>target+8&&g.vy>0)g.flap();stepPack(g,1/60);}assert.equal(g.status,'playing');assert.ok(g.gates>=20);assert.ok(g.score>=200);assert.ok(g.obstacles.length<5);
});
test('Cross movement is bounded, hop-limited, and only new rows earn points',()=>{
 const g=new CrossGame();assert.equal(g.move('up'),false);g.start();assert.equal(g.move('up'),true);assert.equal(g.score,10);assert.equal(g.move('up'),true);assert.equal(g.row,1,'a press mid-hop waits for the landing');g.buffer=null;g.hop=0;assert.equal(g.move('down'),true);g.hop=0;assert.equal(g.move('up'),true);assert.equal(g.score,10);g.hop=0;g.x=0;assert.equal(g.move('left'),false);assert.equal(g.move('bogus'),false);
});
test('Cross roads collide, floating decks carry the player, water misses fail',()=>{
 const road=new CrossGame();road.start();road.row=1;const lane=crossLane(1),o=laneObjects(lane,.001).find(o=>o.x>=0&&o.x<7);road.x=o.x+.5;road.tick(.001);assert.equal(road.status,'over');
 const river=new CrossGame();river.start();river.row=7;const water=crossLane(7),log=laneObjects(water,0).find(o=>o.x>=0&&o.x<5);river.x=log.x+1;const x=river.x;river.tick(.01);assert.equal(river.status,'playing');assert.ok(river.x>x);river.x=log.x+water.length+.6;river.tick(.001);assert.equal(river.status,'over');
});
test('Cross gold is collected once, safe parks exist, and idle timer pauses',()=>{
 const g=new CrossGame();g.start();g.row=5;g.x=crossLane(5).coin;g.tick(.01);assert.equal(g.coins,1);assert.equal(g.score,25);g.tick(.01);assert.equal(g.score,25);for(let r=0;r<=100;r+=5)assert.equal(crossLane(r).type,'park');g.pause();const t=g.time;stepPack(g,.2);assert.equal(g.time,t);g.start();for(let i=0;i<15*60;i++)stepPack(g,1/60);assert.equal(g.status,'over');
});
test('Quick games preserve frame-rate-independent physics and pause long interruptions',()=>{
 const results=[];for(const fps of [15,30,60,120]){const g=new FlappyGame(()=>.5);g.start();g.flap();for(let i=0;i<fps;i++)stepPack(g,1/fps);results.push(g.y);const y=g.y;stepPack(g,.8);assert.equal(g.status,'paused');assert.equal(g.y,y);}assert.ok(Math.max(...results)-Math.min(...results)<.01);
});
test('Quick-game viewport calculation keeps board and 44px+ controls within safe areas',()=>{
 for(const [w,h,top,bottom]of [[320,568,0,0],[360,640,0,24],[390,664,0,0],[393,852,47,34],[412,915,24,24],[430,932,59,34],[600,800,0,0],[768,1024,24,20],[640,360,0,0],[844,390,0,21],[1024,768,24,20]]){const l=packLayout(w,h,{top,bottom});assert.ok(l.stageWidth>=170,`${w}x${h}`);assert.ok(l.stageHeight+56+(l.landscape?0:92)+16+24+top+bottom<=h+1);assert.ok(l.stageWidth+(l.landscape?168:0)+24<=w);}
});
function prepareRooftop(){const s=new StoryGame();assert.equal(s.go('roof'),false);s.choose('poster');s.choose('fountain');s.go('diner');s.use('token');assert.ok(s.has('coffee'));s.go('shop');s.use('coffee');assert.ok(s.has('vinyl'));s.use('vinyl');s.choose('mix-BASS');assert.deepEqual(s.mix,[]);s.choose('mix-MOON');s.choose('mix-BASS');s.choose('mix-BARK');assert.ok(s.flags.mixed);assert.ok(s.has('demo'));s.go('club');s.choose('brick');s.choose('woof');s.choose('brick');s.choose('moon');s.choose('brick');assert.ok(!s.flags.pass);s.use('comb');s.choose('brick');assert.ok(s.flags.pass);assert.equal(s.go('roof'),true);return s;}
test('Adventure puzzles form a complete, recoverable path to all three endings',()=>{
 for(const ending of Object.keys(ENDINGS)){const s=prepareRooftop();if(ending==='headliner')s.use('demo');if(ending==='flop')s.choose('mic');if(ending==='connection'){s.choose('nova');s.choose('brag');assert.ok(!s.actions().some(a=>a.id==='sunrise'));s.choose('apologize');s.choose('sunrise');}assert.equal(s.ending,ending);assert.equal(s.actions().length,0);assert.equal(s.go('block'),false);assert.ok(StoryGame.valid(s.save()));}
});
test('Story save restores inventory, finished puzzles, and endings without duplicate items',()=>{
 const s=prepareRooftop();const snapshot=JSON.parse(JSON.stringify(s.save()));const restored=new StoryGame(snapshot);assert.deepEqual(restored.save(),snapshot);restored.choose('nova');restored.choose('listen');restored.choose('sunrise');assert.equal(new StoryGame(restored.save()).ending,'connection');const fresh=new StoryGame();fresh.choose('fountain');fresh.choose('fountain');assert.equal(fresh.inventory.filter(x=>x==='token').length,1);assert.equal(fresh.choose('mix-MOON'),false);assert.equal(fresh.use('demo'),false);assert.equal(StoryGame.valid({...snapshot,inventory:['__proto__']}),false);
});
test('Street Hustle weighted cost basis survives partial sales, encounters, and reloads',()=>{
 const t=new TradeGame(()=>.99);t.prices[5]=20;t.buy(5,4);t.prices[5]=40;t.buy(5,2);assert.equal(t.cost[5],160);assert.equal(t.averageCost(5),160/6);t.sell(5,3);assert.equal(t.bag[5],3);assert.ok(Math.abs(t.cost[5]-80)<.001);assert.equal(t.cash,1760);const restored=new TradeGame(()=>0,t.save());restored.travel(1);assert.equal(restored.bag[5],2);assert.ok(Math.abs(restored.averageCost(5)-160/6)<.001);restored.sellAll();assert.equal(restored.used,0);assert.equal(restored.cost[5],0);
});
test('Trade save validation rejects malformed states and old saves migrate safely',()=>{
 const t=new TradeGame(()=>.99);t.buy(5,2);const saved=t.save();assert.ok(validTradeState(saved));delete saved.cost;delete saved.costEstimated;const legacy=new TradeGame(()=>.5,saved);assert.ok(legacy.costEstimated);assert.equal(legacy.cost[5],legacy.bag[5]*legacy.prices[5]);for(const mutation of [{cash:-1},{day:31},{capacity:31},{bag:[999,0,0,0,0,0]},{heat:101},{prices:[0,1,1,1,1,1]},{logs:[{day:1,message:{}}]}]){assert.equal(validTradeState({...saved,...mutation}),false);}const state=t.save();state.bag[5]=0;state.logs[0].message='mutated';assert.equal(t.bag[5],2);assert.notEqual(t.logs[0].message,'mutated');
});
test('Night 30 refuses further travel without bypassing explicit cash-out',()=>{
 const t=new TradeGame(()=>.99);for(let d=2;d<=30;d++)t.travel(t.district===0?1:0);const before=t.save();assert.equal(t.travel(4),false);assert.deepEqual(t.save(),before);t.buy(5,'max');const worth=t.netWorth;assert.equal(t.finish(),true);assert.equal(t.netWorth,worth);const final=t.save();assert.equal(t.finish(),false);assert.equal(t.sellAll(),0);assert.deepEqual(t.save(),final);
});
test('Travel risk uses post-cooling heat; cash losses leave the bank protected',()=>{
 const t=new TradeGame(()=>.99);t.heat=50;assert.equal(t.travelRisk(2),.32+44/250);t.deposit();t.cash=1000;t.random=()=>0;t.travel(1);assert.equal(t.cash,880);assert.equal(t.bank,1808);assert.equal(t.debt,2575);assert.equal(t.day,2);
});
test('Trading sequences never overspend or duplicate money, inventory or final settlement',()=>{
 let seed=17;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let run=0;run<25;run++){const t=new TradeGame(rand);for(let i=0;i<100;i++){const worth=t.netWorth,op=Math.floor(rand()*6),item=Math.floor(rand()*6);if(op===0){t.buy(item,'max');assert.equal(t.netWorth,worth);}if(op===1){t.sell(item,'max');assert.equal(t.netWorth,worth);}if(op===2){t.deposit();assert.equal(t.netWorth,worth);}if(op===3){t.withdraw();assert.equal(t.netWorth,worth);}if(op===4){t.repay();assert.equal(t.netWorth,worth);}if(op===5)t.travel(Math.floor(rand()*5));assert.ok(validTradeState(t.save()));assert.ok(t.used<=t.capacity);assert.ok(t.cash>=0);}const worth=t.netWorth;t.finish();assert.equal(t.netWorth,worth);assert.equal(t.used,0);}
});
test('All new game controls have unique DOM targets and complete shipped assets',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const file of ['arcade-pack.js','app.js','mobile.js']){const code=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');for(const [,id]of code.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),file+': '+id);}for(const f of ['pack-engine.js','pack-renderer.js','story-engine.js','arcade-pack.js','arcade-pack.css'])assert.ok(existsSync(new URL('../dist/'+f,import.meta.url)));assert.equal([...html.matchAll(/data-mode="/g)].length,GAME_IDS.length);for(const v of ['viewPlay','viewRankings','viewFriends','viewChat','viewMe'])assert.ok(ids.includes(v),v);assert.equal(html.match(/<nav class="app-nav"[^]*?<\/nav>/)[0].match(/data-view="/g).length,5);
 for(const m of html.matchAll(/--poster:url\(([^)]+)\)/g))assert.ok(existsSync(new URL('../dist/'+m[1],import.meta.url)),m[1]);
});

test('Flappy: the sky is a soft ceiling, hitboxes forgive a graze, perfect streaks pay more',()=>{
 const sky=new FlappyGame(()=>.5);sky.start();sky.obstacles=[{x:900,width:66,center:250,gap:200,passed:false}];sky.y=12;sky.vy=-300;sky.tick(.01);assert.equal(sky.status,'playing');assert.equal(sky.y,24);assert.equal(sky.vy>=0,true);
 const graze=new FlappyGame(()=>.5);graze.start();graze.vy=0;graze.y=250-100+13;graze.obstacles=[{x:100,width:66,center:250,gap:200,passed:false}];graze.tick(.001);assert.equal(graze.status,'playing','a 1px graze of the drawn body is forgiven');graze.y=250-100+11;graze.vy=0;graze.tick(.001);assert.equal(graze.status,'over');
 const g=new FlappyGame(()=>.5);g.start();const gate=()=>{g.vy=0;g.y=250;g.obstacles=[{x:20,width:66,center:250,gap:200,passed:false}];g.tick(.001);};
 gate();assert.equal(g.score,15);gate();assert.equal(g.score,15+20);gate();assert.equal(g.score,35+25);assert.equal(g.streak,3);for(let i=0;i<4;i++)gate();assert.equal(g.score,60+30+35+35+35,'the streak bonus tops out at +25');
 g.vy=0;g.y=250;g.obstacles=[{x:20,width:66,center:300,gap:200,passed:false}];g.tick(.001);assert.equal(g.streak,0);assert.equal(g.bestStreak,7);assert.equal(g.events.at(-1).bonus,0);
});
test('Cross: buffered hops, deck exits snap to a cell, close calls and the idle warning',()=>{
 const g=new CrossGame();g.start();g.move('up');g.move('left');assert.equal(g.buffer,'left');
 // Land on row 1 away from traffic, then the buffered hop plays by itself.
 const safe=r=>{const objs=laneObjects(crossLane(r),g.time+.13);for(let x=0;x<=8;x++)if(!objs.some(o=>x+.24>o.x-1.2&&x-.24<o.x+o.width+1.2))return x;return null;};
 const sx=safe(1);if(sx!==null){g.x=sx;stepPack(g,.14);assert.equal(g.status,'playing');assert.equal(g.buffer,null);assert.equal(g.hop>0,true);assert.equal(g.x,sx-1>=0?sx-1:sx);}
 const deck=new CrossGame();deck.start();deck.row=8;deck.furthest=8;assert.equal(crossLane(8).type,'river');assert.equal(crossLane(9).type,'road');deck.x=3.37;deck.move('up');assert.equal(deck.x,3);assert.equal(deck.from.x,3.37);
 const side=new CrossGame();side.start();side.row=7;side.furthest=7;side.x=3.37;side.move('up');assert.equal(side.x,3.37,'deck to deck keeps its place');
 const close=new CrossGame();close.start();close.row=0;const lane=crossLane(1),car=laneObjects(lane,.13).find(o=>o.x>1&&o.x<7);close.x=car.x-.5;close.move('up');close.x=car.x-.5;stepPack(close,.135);
 if(close.status==='playing'){assert.equal(close.close,1);assert.equal(close.score,15);assert.ok(close.events.some(e=>e.type==='close'));}
 const idle=new CrossGame();idle.start();for(let i=0;i<10.5*60;i++)stepPack(idle,1/60);assert.equal(idle.events.filter(e=>e.type==='hurry').length,1);assert.equal(idle.status,'playing');for(let i=0;i<5*60;i++)stepPack(idle,1/60);assert.equal(idle.status,'over');assert.equal(idle.cause,'idle');
 const hit=new CrossGame();hit.start();hit.row=1;const o=laneObjects(crossLane(1),.001).find(o=>o.x>=0&&o.x<7);hit.x=o.x+.5;hit.tick(.001);assert.equal(hit.cause,'car');
});

test('Flappy: three perfect rings earn a shield that breaks on a tower instead of ending the run',()=>{
 const g=new FlappyGame(()=>.5);g.start();const gate=()=>{g.vy=0;g.y=250;g.obstacles=[{x:20,width:66,center:250,gap:200,passed:false}];g.tick(.001);};
 gate();gate();assert.equal(g.shield,false);gate();assert.equal(g.shield,true);assert.ok(g.events.some(e=>e.type==='shield'&&e.got));
 g.vy=0;g.y=80;g.obstacles=[{x:100,width:66,center:250,gap:180,passed:false}];g.tick(.001);assert.equal(g.status,'playing');assert.equal(g.shield,false);assert.equal(g.streak,0);assert.ok(g.ghost>.8);
 g.vy=0;g.y=80;g.tick(.001);assert.equal(g.status,'playing','phasing through the tower that broke the shield');g.ghost=0;g.vy=0;g.y=80;g.obstacles=[{x:100,width:66,center:250,gap:180,passed:false}];g.tick(.001);assert.equal(g.status,'over');
});
test('Cross: the blackout waits for the first hop, climbs with the heat and never trails by more than four rows',()=>{
 const g=new CrossGame();g.start();for(let i=0;i<120;i++)g.tick(1/60);assert.equal(g.sweep,-6,'it does not move before you do');
 g.row=20;g.furthest=20;g.x=4;g.idle=0;g.tick(1/60);assert.equal(g.sweep,16);
 const c=new CrossGame();c.start();c.row=5;c.furthest=5;c.x=8;c.sweep=4.99;c.collected.add(5);c.tick(.05);assert.equal(c.status,'over');assert.equal(c.cause,'sweep');
});
