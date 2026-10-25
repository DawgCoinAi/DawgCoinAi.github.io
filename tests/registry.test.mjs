import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GAMES,GAME_IDS,PACK_IDS,VIEWS,viewFor,canSwitchView,nextView} from '../dist/games.js';
import {DISCIPLINES} from '../dist/dawg-career.js';
import {STAMPS} from '../dist/passport.js';
import {QUICK_MODES} from '../dist/pack-checkpoint.js';
import {parseBackup} from '../dist/progress-backup.js';

test('Every registered game has a tab, an XP discipline and a passport stamp',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),tabs=[...html.matchAll(/data-mode="([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual([...tabs].sort(),[...GAME_IDS].sort(),"every game has exactly one card");for(const id of GAME_IDS)assert.match(html,new RegExp(`id="tab-${id}"`));
 assert.deepEqual(DISCIPLINES.map(d=>d.id).sort(),[...GAME_IDS].sort());assert.deepEqual(STAMPS.map(s=>s.id).sort(),[...GAME_IDS].sort());
 assert.equal(new Set(GAME_IDS).size,GAME_IDS.length);for(const g of GAMES){assert.ok(['maze','pack','trade'].includes(g.kind));assert.ok(g.views.every(v=>VIEWS.includes(v)));if(g.views.length)assert.ok(g.views.includes('2d'),g.id+' plays in 2D too');}
});
test('Pack games in the registry all have quick-game checkpoints, except the story',()=>{
 for(const id of PACK_IDS)if(id!=='story')assert.ok(QUICK_MODES.includes(id),id);
});
test('Camera choices fall back to each game’s default and only switch where supported',()=>{
 assert.equal(viewFor('runner',{}),'first','first person is the default');assert.equal(viewFor('runner',{runner:'third'}),'third');assert.equal(viewFor('runner',{runner:'sideways'}),'first');
 assert.equal(viewFor('flappy',{}),'first');assert.equal(viewFor('cross',{cross:'first'}),'third');assert.equal(canSwitchView('runner'),true);assert.equal(canSwitchView('trade'),false);
});
test('Backups accept saved camera choices and reject unknown ones',()=>{
 const ok={format:'dawg-arcade-backup',version:1,saves:{settings:{controls:'stick',cameras:{runner:'first'}}}};assert.ok(parseBackup(JSON.stringify(ok)));
 for(const cameras of [{runner:'sideways'},{trade:'first'},[]])assert.throws(()=>parseBackup(JSON.stringify({...ok,saves:{settings:{cameras}}})),/invalid settings/);
});
test('First-person grid controls turn relative to the way the player faces',async()=>{
 const {relativeTurn}=await import('../dist/games.js');
 assert.equal(relativeTurn('up','left'),'left');assert.equal(relativeTurn('up','right'),'right');assert.equal(relativeTurn('right','left'),'up');assert.equal(relativeTurn('right','right'),'down');
 assert.equal(relativeTurn('down','left'),'right');assert.equal(relativeTurn('left','right'),'up');assert.equal(relativeTurn('left','up'),'left','up keeps going forward');assert.equal(relativeTurn('down','down'),'up','down turns around');
 for(const f of ['up','down','left','right']){let d=f;for(let i=0;i<4;i++)d=relativeTurn(d,'left');assert.equal(d,f,'four left turns come full circle');}
 const {viewFor}=await import('../dist/games.js');for(const id of ['classic','rush','daily'])assert.equal(viewFor(id,{}),'first');
});
test('The view button cycles through each game’s cameras, ending in 2D',()=>{
 assert.equal(nextView('runner',{}),'third');assert.equal(nextView('runner',{runner:'third'}),'2d');assert.equal(nextView('runner',{runner:'2d'}),'first');
 assert.equal(nextView('cross',{}),'2d');assert.equal(nextView('cross',{cross:'2d'}),'third');assert.equal(viewFor('kart',{kart:'2d'}),'2d');
});
