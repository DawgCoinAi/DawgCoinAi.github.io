import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DISCOVERIES,nextDiscovery} from '../dist/discoveries.js';

const ctx=o=>({runs:0,level:1,minutes:0,streak:0,bests:0,open:['classic','runner','flappy','daily'],hasName:false,hasEmail:false,owner:false,...o});

test('Features are introduced one at a time, in the order they are earned',()=>{
 assert.equal(nextDiscovery(ctx(),[]),null,'nothing before the first run');
 assert.equal(nextDiscovery(ctx({runs:1}),[]).id,'dawg');
 assert.equal(nextDiscovery(ctx({runs:1}),['dawg']),null,'one card per moment');
 assert.equal(nextDiscovery(ctx({runs:2}),['dawg']).id,'views');
 assert.equal(nextDiscovery(ctx({runs:3,bests:1}),['dawg','views']).id,'share');
 assert.equal(nextDiscovery(ctx({runs:6,level:3,bests:1}),['dawg','views','share','rankings','unlocks','daily']).id,'friends');
 assert.equal(nextDiscovery(ctx({level:5,hasEmail:true}),DISCOVERIES.map(d=>d.id).filter(d=>d!=='cloud'&&d!=='passport'&&d!=='league')),null,'no cloud nudge once an email is on the account');
 assert.equal(nextDiscovery(ctx({open:['classic','trade']}),DISCOVERIES.map(d=>d.id).filter(d=>d!=='hustle')).id,'hustle');
 assert.equal(nextDiscovery(ctx({owner:true}),DISCOVERIES.map(d=>d.id).filter(d=>d!=='owner')).id,'owner');
 assert.equal(nextDiscovery(ctx({owner:false,runs:99,level:99,bests:12,open:['trade','story']}),DISCOVERIES.map(d=>d.id).filter(d=>d!=='owner')),null,'owner tools stay hidden from players');
});
test('Every discovery has copy, a unique id, and a destination the app knows',()=>{
 const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),ids=new Set();
 for(const d of DISCOVERIES){assert.ok(d.id&&d.title&&d.text.length>40&&d.cta&&d.icon,d.id);assert.ok(!ids.has(d.id));ids.add(d.id);
  if(d.go&&!['trade','story','daily'].includes(d.go))assert.ok(app.includes(`where==='${d.go}'`),d.go+' is handled');}
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');for(const id of ['discoveryDialog','discoveryGo','discoveryLater','discoveryList','discoveryCount'])assert.match(html,new RegExp(`id="${id}"`));
});
