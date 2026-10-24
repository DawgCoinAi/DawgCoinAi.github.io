import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {stepPack} from '../dist/pack-engine.js';
import {STAMPS,updatePassport,validPassport} from '../dist/passport.js';
import {LivingTradeGame,TRADE_PERKS,validLivingTrade} from '../dist/living-trade.js';
import {LivingStoryGame} from '../dist/living-story.js';
import {StoryGame} from '../dist/story-engine.js';
import {storyJournal} from '../dist/story-journal.js';
import {parseBackup} from '../dist/progress-backup.js';
const clone=v=>JSON.parse(JSON.stringify(v));
function runner(seed=78){const g=createQuickGame('runner',seed);g.start();return g;}
function place(g,type,lane=g.lane){g.rows=[{id:1,z:.01,safe:(lane+1)%3,obstacles:[{lane,type}],power:null}];}

test('Runner handles lane bounds, turn cooldown, mutually exclusive jumps and slides, and pause',()=>{
 const g=runner();assert.equal(g.move('left'),true);assert.equal(g.move('left'),false);g.tick(.13);assert.equal(g.move('left'),false);assert.equal(g.move('right'),true);assert.equal(g.move('up'),true);assert.equal(g.move('down'),false);g.pause();const before=snapshotQuick(g,'runner');g.tick(3);assert.deepEqual(snapshotQuick(g,'runner'),before);g.start();g.tick(.9);assert.equal(g.move('down'),true);assert.equal(g.move('up'),false);
});
test('Crates require a jump, arches a slide, and blocks a different lane; results fire once',()=>{
 for(const [type,action,alive] of [['crate','up',true],['crate','down',false],['bar','down',true],['bar','up',false],['block','up',false],['block','left',true]]){const g=runner();place(g,type);g.move(action);g.tick(.01);assert.equal(g.status,alive?'playing':'over',type+action);if(!alive){g.tick(1);g.end('again');assert.equal(g.events.filter(e=>e.type==='over').length,1);}}
});
test('Runner shield absorbs one hit, magnets collect across lanes, and pickups score once',()=>{
 const g=runner();g.shield=1;place(g,'block');g.tick(.01);assert.equal(g.status,'playing');assert.equal(g.shield,0);assert.equal(g.hits,1);g.magnet=5;place(g,'crate');g.move('up');g.tick(.01);assert.equal(g.coins,1);const coins=g.coins;g.tick(.1);assert.equal(g.coins,coins);assert.equal(g.score,Math.floor(g.distance)+g.coins*25);
 const h=runner();h.rows=[{id:7,z:.01,safe:1,obstacles:[{lane:0,type:'bar'}],power:'shield'}];h.tick(.01);assert.equal(h.shield,1);h.rows=[{id:14,z:.01,safe:1,obstacles:[{lane:0,type:'bar'}],power:'magnet'}];h.tick(.01);assert.equal(h.magnet,10);place(h,'block');h.tick(.01);assert.equal(h.status,'playing');place(h,'block');h.tick(.01);assert.equal(h.status,'over');
});
test('100 seeded runner worlds retain an open route and can be played for 90 seconds by lane input alone',()=>{
 const patterns=new Set();for(let seed=1;seed<=100;seed++){const g=runner(seed);patterns.add(JSON.stringify(g.rows));for(let frame=0;frame<90*60;frame++){const next=g.rows[0];if(next.z<35&&g.lane!==next.safe)g.move(next.safe<g.lane?'left':'right');stepPack(g,1/60);assert.equal(g.status,'playing','seed '+seed);for(const row of g.rows)assert.ok(!row.obstacles.some(o=>o.lane===row.safe));}assert.ok(g.distance>2500);assert.ok(g.coins>40);assert.ok(g.rows.length<=6);}assert.equal(patterns.size,100);
});
test('Runner checkpoint keeps exact movement, powers, patterns and random continuation',()=>{
 const g=runner(182);g.move('left');g.move('up');g.magnet=4;g.shield=1;stepPack(g,.1);const s=snapshotQuick(g,'runner'),h=restoreQuick(clone(s));assert.ok(h);assert.equal(h.status,'paused');assert.deepEqual(snapshotQuick(h,'runner'),s);h.start();for(let i=0;i<80;i++){g.tick(1/120);h.tick(1/120);}assert.deepEqual(snapshotQuick(h,'runner'),snapshotQuick(g,'runner'));assert.equal(g.random(),h.random());
 const bad=clone(s);bad.rows[0].safe=bad.rows[0].obstacles[0].lane;assert.equal(restoreQuick(bad),null);assert.equal(restoreQuick({...s,score:s.score+1}),null);assert.equal(restoreQuick({...s,magnet:Infinity}),null);assert.equal(restoreQuick({...s,jump:.5,slide:.5}),null);
});
test('Runner speed and distance are stable across frame rates and long stalls pause',()=>{
 const states=[];for(const fps of [15,30,60,120]){const g=runner(3);for(let i=0;i<fps*2;i++)stepPack(g,1/fps);states.push(g.distance);}assert.ok(Math.max(...states)-Math.min(...states)<.002);const g=runner();stepPack(g,2);assert.equal(g.status,'paused');assert.equal(g.distance,0);
});
test('Passport credits existing records, grants each reward once, and completes only after all nine stamps',()=>{
 let result=updatePassport(null,{classic:500,trade:-50,story:750});assert.equal(result.reward,200);assert.deepEqual(result.state.stamps,['classic','story']);assert.ok(validPassport(result.state));assert.equal(updatePassport(result.state,{classic:500,story:1000}).reward,0);const records=Object.fromEntries(STAMPS.map(s=>[s.id,s.target]));result=updatePassport(result.state,records);assert.equal(result.reward,1000);assert.equal(result.state.complete,true);assert.equal(updatePassport(result.state,records).reward,0);assert.equal(validPassport({version:1,stamps:['runner','runner'],complete:false}),false);assert.equal(validPassport({version:1,stamps:[],complete:true}),false);
});
test('Campaign upgrades charge once, respect encounters and persist without changing previous random state',()=>{
 const g=new LivingTradeGame(null,44);g.cash=10000;const risk=g.travelRisk(2);assert.ok(g.buyPerk('scout'));assert.equal(g.cash,9100);assert.ok(Math.abs(g.travelRisk(2)-(risk-.06))<1e-9);assert.equal(g.buyPerk('scout'),false);assert.equal(g.buyPerk('missing'),false);g.world.pending={kind:'favor',amount:100,good:0};const before=g.save();assert.equal(g.buyPerk('quiet'),false);assert.deepEqual(g.save(),before);g.resolve('leave');g.buyPerk('quiet');g.heat=0;const n=g.buy(5,5);assert.ok(Math.abs(g.heat-n*.35*.6)<1e-9);const prior=g.heat;g.sell(5,'max');assert.ok(Math.abs(g.heat-prior-n*.15*.6)<1e-9);const s=g.save(),h=new LivingTradeGame(clone(s));assert.deepEqual(h.save(),s);assert.equal(g.random(),h.random());
});
test('Courier perk increases the active order and future orders once; old worlds migrate',()=>{
 const g=new LivingTradeGame(null,99),h=new LivingTradeGame(g.save());g.cash=10000;const reward=g.world.contract.reward;assert.equal(g.buyPerk('courier'),true);assert.equal(g.world.contract.reward,Math.round(reward*1.15));assert.equal(g.buyPerk('courier'),false);g.offerContract();h.offerContract();assert.ok(Math.abs(g.world.contract.reward-h.world.contract.reward*1.15)<=1);const old=g.save();delete old.world.upgrades;assert.ok(validLivingTrade(old));assert.deepEqual(new LivingTradeGame(old).world.upgrades,[]);const bad=g.save();bad.world.upgrades=['scout','scout'];assert.equal(validLivingTrade(bad),false);
});
test('Casebook records only found clues and gives usable next locations without mutating the story',()=>{
 for(let seed=1;seed<=30;seed++){const s=new LivingStoryGame(null,seed),initial=s.save();let j=storyJournal(s);assert.equal(j.notes.length,1);assert.equal(j.lead.room,'block');assert.deepEqual(s.save(),initial);s.choose('poster');j=storyJournal(s);assert.equal(j.lead.room,s.episode.tokenRoom);assert.match(j.notes[1].text,new RegExp(s.episode.password));s.go(j.lead.room);s.choose('fountain');assert.equal(storyJournal(s).lead.room,s.episode.barRoom);s.go(s.episode.barRoom);s.use('token');assert.equal(storyJournal(s).lead.room,s.episode.djRoom);s.end('flop');assert.equal(storyJournal(s).lead,null);}
 const old=new StoryGame();old.choose('poster');assert.ok(storyJournal(old).notes.some(n=>n.text.includes('MOON')));
});
test('Backups carry the runner and passport alongside the upgraded trading campaign',()=>{
 const g=runner(),t=new LivingTradeGame(null,42);t.cash=10000;t.buyPerk('quiet');const passport=updatePassport(null,{runner:400}).state,b={format:'dawg-arcade-backup',version:1,saves:{passport,records:{runner:400},packRuns:{runner:snapshotQuick(g,'runner')},trade:{version:1,state:t.save()}}};assert.deepEqual(parseBackup(JSON.stringify(b)),b);const bad=clone(b);bad.saves.passport.stamps.push('runner');assert.throws(()=>parseBackup(JSON.stringify(bad)));
});
