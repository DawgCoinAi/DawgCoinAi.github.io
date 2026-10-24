import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadePack} from '../dist/arcade-pack.js';

// Minimal DOM doubles exercise controller wiring, not browser layout or touch feel.
function harness(){
 const nodes=new Map(),listeners=new Map(),saved=new Map(),records=[],best={};
 const context=new Proxy({measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(t,k)=>t[k]||(()=>{})});
 class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.children=[];this.hidden=false;this.width=840;this.height=1120;this.events={};this.attrs={};this.style={setProperty(){}};const set=new Set();this.classList={add:(...a)=>a.forEach(x=>set.add(x)),remove:(...a)=>a.forEach(x=>set.delete(x)),contains:x=>set.has(x),toggle:(x,on)=>on?set.add(x):set.delete(x)};}
  addEventListener(k,fn){this.events[k]=fn;}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(...kids){this.children=kids;}append(...kids){this.children.push(...kids);}getContext(){return context;}focus(){}setPointerCapture(){}closest(){return this;}
 }
 const $=id=>{if(!nodes.has(id))nodes.set(id,new Node(id.includes('Canvas')?'canvas':'div'));return nodes.get(id);};
 const dirs=['up','down','left','right'].map(d=>{const n=new Node('button');n.dataset.packDir=d;return n;});
 globalThis.document={getElementById:$,querySelectorAll:()=>dirs,querySelector:()=>null,createElement:t=>new Node(t),body:new Node(),documentElement:new Node(),addEventListener:(k,fn)=>listeners.set('document:'+k,fn),hidden:false};
 globalThis.window={scrollY:20,innerWidth:390,innerHeight:760,matchMedia:()=>({matches:false}),scrollTo(){},addEventListener:(k,fn)=>listeners.set(k,fn),visualViewport:{width:390,height:760,offsetTop:0,offsetLeft:0,addEventListener(){}}};
 globalThis.getComputedStyle=()=>({paddingTop:'0',paddingBottom:'20',paddingLeft:'0',paddingRight:'0'});
 const io={read:(k,d)=>saved.get(k)??d,write:(k,v)=>saved.set(k,JSON.parse(JSON.stringify(v))),prefs:{fx:'low',haptics:false},sound(){},soundOn:()=>false,soundToggle(){},confirm:(_a,_b,_c,fn)=>fn(),best:k=>best[k]||0,record:(k,score,rep)=>{records.push({k,score,rep});best[k]=Math.max(best[k]||0,score);}};
 const pack=new ArcadePack({complete:false},io);return {pack,$,listeners,saved,records};
}
test('Quick-game controller launches, pauses, resumes and records one result per run',()=>{
 const {pack,$,records,listeners}=harness();pack.select('flappy');assert.equal($('packPanel').hidden,false);assert.equal($('storyPanel').hidden,true);$('packStart').onclick();assert.equal(pack.session,true);assert.ok(pack.countdown>0);pack.frame(pack.countdown+1);assert.equal(pack.game.status,'playing');assert.equal($('packOverlay').hidden,true);
 listeners.get('blur')();assert.equal(pack.game.status,'paused');assert.equal($('packOverlay').hidden,false);$('packStart').onclick();pack.frame(pack.countdown+1);assert.equal(pack.game.status,'playing');pack.game.score=80;pack.game.end('test collision');pack.frame(performance.now()+1700);pack.frame(performance.now()+1716);assert.equal(records.length,1);assert.equal(records[0].score,80);$('packHome').onclick();assert.equal(pack.session,false);assert.equal(document.body.classList.contains('pack-session'),false);
});
test('Game switching isolates controls and restores an unfinished quick run in memory',()=>{
 const {pack,$}=harness();pack.select('cross');pack.play();pack.frame(pack.countdown+1);const cross=pack.game;pack.input('up');assert.equal(cross.row,1);pack.select('flappy');assert.equal(cross.status,'paused');assert.equal(pack.session,false);assert.equal($('packDpad').hidden,true);pack.select('cross');assert.equal(pack.game,cross);assert.equal(pack.game.row,1);assert.equal($('packFlap').hidden,true);assert.equal($('packDpad').hidden,false);pack.select('story');assert.equal($('packPanel').hidden,true);assert.equal($('storyPanel').hidden,false);assert.ok($('storyChoices').children.length>0);pack.select(null);assert.equal($('storyPanel').hidden,true);assert.equal($('packPanel').hidden,true);
});
test('Adventure choice and item buttons save progress and only reward new endings',()=>{
 const {pack,$,saved,records}=harness();pack.select('story');const choice=id=>{const target={dataset:{choice:id},closest(){return this;}};$('storyChoices').onclick({target});};const item=id=>{const target={dataset:{item:id},closest(){return this;}};$('storyInventory').onclick({target});};
 pack.story.go(pack.story.episode.tokenRoom);choice('fountain');assert.ok(saved.get('story').inventory.includes('token'));pack.story.go(pack.story.episode.barRoom);item('token');assert.ok(saved.get('story').inventory.includes('coffee'));assert.equal($('storyInventory').children.some(b=>b.dataset.item==='coffee'),true);
 pack.story.room='roof';pack.story.flags.pass=true;choice('mic');assert.equal(saved.get('story').ending,'flop');assert.deepEqual(saved.get('storyEndings'),['flop']);assert.equal(records.at(-1).rep,200);$('storyReset').onclick();assert.equal(pack.story.room,'block');pack.story.room='roof';pack.story.flags.pass=true;choice('mic');assert.equal(records.length,2);assert.equal(records.at(-1).rep,0);assert.equal(pack.storyEnds.length,1);
});
test('Dash touch gestures steer without an extra tap jump, save on pause, and record each run once',()=>{
 const {pack,$,saved,records}=harness();pack.select('runner');pack.play();pack.frame(pack.countdown+1);const board=$('packCanvas');board.events.pointerdown({pointerId:1,clientX:100,clientY:100});board.events.pointermove({pointerId:1,clientX:160,clientY:100});board.events.pointerup({pointerId:1});assert.equal(pack.game.lane,2);assert.equal(pack.game.jump,0);board.events.pointerdown({pointerId:2,clientX:100,clientY:100});board.events.pointerup({pointerId:2});assert.ok(pack.game.jump>0);pack.pause();assert.ok(saved.get('packRuns').runner);const seed=pack.game.worldSeed;pack.game.start();pack.game.distance=450;pack.game.score=450;pack.game.rows=[{id:1,z:.01,safe:0,obstacles:[{lane:2,type:'block'}],power:null}];pack.frame(pack.last+16);pack.frame(pack.last+16);assert.equal(records.length,1);assert.equal(records[0].k,'runner');assert.match($('packResult').textContent,/450 METERS/);pack.play();assert.notEqual(pack.game.worldSeed,seed);assert.match($('packGoal').textContent,new RegExp(pack.game.worldSeed.toString(36).toUpperCase()));
});
test('Casebook follows a location and preserves an active puzzle when reviewing the same room',()=>{
 const {pack,$,saved}=harness();pack.select('story');pack.story.choose('poster');$('storyFollow').onclick();assert.equal(pack.story.room,pack.story.episode.tokenRoom);pack.story.choose('fountain');$('storyFollow').onclick();assert.equal(pack.story.room,pack.story.episode.barRoom);pack.story.use('token');$('storyFollow').onclick();assert.equal(pack.story.room,pack.story.episode.djRoom);pack.story.use('coffee');pack.story.use('vinyl');assert.equal(pack.story.topic,'mixer');$('storyFollow').onclick();assert.equal(pack.story.topic,'mixer');assert.equal(saved.get('story').topic,'mixer');assert.ok($('storyJournal').children.length>=3);
});
