import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameServer} from '../start.mjs';
import {SnakeGame} from '../dist/snake-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {makeBackup,parseBackup,applyBackup,SAVE_PREFIX} from '../dist/progress-backup.js';
import {TradeGame} from '../dist/engine.js';
import {StoryGame} from '../dist/story-engine.js';

test('Snake buffers one legal turn, grows on gold, and freezes while paused',()=>{
 const g=new SnakeGame(()=>0);g.start();assert.equal(g.move('left'),false);g.food={x:7,y:8};assert.equal(g.move('up'),true);assert.equal(g.move('left'),false);g.tick(.24);assert.deepEqual(g.body[0],{x:7,y:8});assert.equal(g.body.length,4);assert.equal(g.score,25);assert.equal(g.coins,1);assert.ok(!g.body.some(p=>p.x===g.food.x&&p.y===g.food.y));g.pause();const s=JSON.stringify(g);g.tick(5);assert.equal(JSON.stringify(g),s);
});
test('Snake detects walls and self collisions but permits a vacating tail cell',()=>{
 const wall=new SnakeGame();wall.start();wall.body=[{x:14,y:8},{x:13,y:8},{x:12,y:8}];wall.tick(.24);assert.equal(wall.status,'over');
 const tail=new SnakeGame();tail.start();tail.body=[{x:1,y:1},{x:1,y:2},{x:2,y:2},{x:2,y:1}];tail.food={x:10,y:10};tail.tick(.24);assert.equal(tail.status,'playing');assert.deepEqual(tail.body[0],{x:2,y:1});
 const self=new SnakeGame();self.start();self.body=[{x:1,y:1},{x:1,y:2},{x:2,y:2},{x:2,y:1},{x:3,y:1}];self.food={x:10,y:10};self.tick(.24);assert.equal(self.status,'over');
});
test('All quick modes survive serialized checkpoints and resume the exact simulation',()=>{
 for(const kind of ['flappy','cross','snake','runner']){const a=createQuickGame(kind,123);a.start();if(kind==='flappy')a.flap();if(kind==='snake')a.move('up');a.tick(.03);const snap=snapshotQuick(a,kind),b=restoreQuick(JSON.parse(JSON.stringify(snap)));assert.ok(b,kind);assert.equal(b.status,'paused');assert.deepEqual(snapshotQuick(b,kind),snap);b.start();a.tick(.02);b.tick(.02);assert.deepEqual(snapshotQuick(b,kind),snapshotQuick(a,kind));if(kind!=='cross')assert.equal(a.random(),b.random());a.end('done');assert.equal(snapshotQuick(a,kind),null);}
});
test('Quick checkpoint validation rejects corrupt or nonfinite game state',()=>{
 const g=createQuickGame('snake',1);g.start();const s=snapshotQuick(g,'snake');assert.equal(restoreQuick({...s,body:[...s.body,s.body[0]]}),null);assert.equal(restoreQuick({...s,score:Infinity}),null);assert.equal(restoreQuick({...s,food:s.body[0]}),null);assert.equal(restoreQuick({...s,randomState:-1}),null);assert.equal(restoreQuick(null),null);
 const f=createQuickGame('flappy');f.start();assert.equal(restoreQuick({...snapshotQuick(f,'flappy'),obstacles:[null]}),null);
});
function storage(seed={}){const map=new Map(Object.entries(seed));return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('Progress backup round-trips trade, adventure, records and quick runs without unrelated keys',()=>{
 const a=storage({'unrelated-app':'keep me'}),g=createQuickGame('snake',4);g.start();const trade=new TradeGame(()=>.8);trade.buy(5,3);
 const values={records:{snake:125,trade:-42},profile:{rep:300,theme:'mint'},settings:{fx:'low',controls:'pad',hand:'left',haptics:false},sound:false,trade:{version:1,state:trade.save()},story:new StoryGame().save(),storyEndings:[],packRuns:{snake:snapshotQuick(g,'snake')}};
 for(const [k,v]of Object.entries(values))a.setItem(SAVE_PREFIX+k,JSON.stringify(v));const b=makeBackup(a,new Date('2026-10-17T12:00:00Z'));assert.deepEqual(b.saves,values);assert.equal('unrelated-app'in b.saves,false);const out=storage({'unrelated-app':'safe'});applyBackup(out,parseBackup(JSON.stringify(b)));for(const[k,v]of Object.entries(values))assert.deepEqual(JSON.parse(out.getItem(SAVE_PREFIX+k)),v);assert.equal(out.getItem('unrelated-app'),'safe');
});
test('Import validates before writes and restores old progress on a partial storage failure',()=>{
 const s=storage({[SAVE_PREFIX+'records']:'{"classic":123}',[SAVE_PREFIX+'profile']:'{"rep":42}'}),before=[...s.map];assert.throws(()=>applyBackup(s,{format:'dawg-arcade-backup',version:1,saves:{records:{classic:-9}}}),/invalid/);assert.deepEqual([...s.map],before);
 const oldSet=s.setItem;let calls=0;s.setItem=(k,v)=>{if(++calls===2)throw Error('quota');return oldSet(k,v);};assert.throws(()=>applyBackup(s,{format:'dawg-arcade-backup',version:1,saves:{records:{snake:100},profile:{rep:99}}}),/restored/);assert.deepEqual([...s.map],before);assert.throws(()=>parseBackup('{broken'),/JSON/);assert.throws(()=>parseBackup(JSON.stringify({format:'dawg-arcade-backup',version:1,saves:{unknown:{}}})),/invalid/);
});
test('Node launcher serves game modules and bundled fonts; blocks traversal and write requests',async()=>{
 const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const index=await fetch(base+'/');assert.equal(index.status,200);assert.match(await index.text(),/Neon Snake/);assert.equal(index.headers.get('cache-control'),'no-store');const js=await fetch(base+'/app.js');assert.match(js.headers.get('content-type'),/javascript/);const font=await fetch(base+'/assets/fonts/body.woff');assert.equal(font.status,200);assert.equal(font.headers.get('content-type'),'font/woff');const model=await fetch(base+'/assets/atelier/DAWG-Atelier-Example.glb');assert.equal(model.status,200);assert.equal(model.headers.get('content-type'),'model/gltf-binary');const modelBytes=new Uint8Array(await model.arrayBuffer());assert.equal(new TextDecoder().decode(modelBytes.slice(0,4)),'glTF');const fashion=await fetch(base+'/dawg-atelier.js');assert.equal(fashion.status,200);for(const path of ['/dash-presentation.js','/dawg-gpu.js','/dawg-graphics-model.js','/dawg-normal-map.js','/vendor/three.js','/vendor/pixi.js']){const module=await fetch(base+path);assert.equal(module.status,200,path);assert.match(module.headers.get('content-type'),/javascript/);assert.ok((await module.text()).length>100);}const head=await fetch(base+'/index.html',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal((await fetch(base+'/no-file')).status,404);assert.equal((await fetch(base+'/assets/')).status,404);assert.equal((await fetch(base+'/',{method:'POST'})).status,405);assert.equal((await fetch(base+'/%2e%2e%2fpackage.json')).status,403);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
