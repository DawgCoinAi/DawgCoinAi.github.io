import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GAMES,GAME_IDS,PACK_IDS,viewFor,canSwitchView} from '../dist/games.js';
import {DISCIPLINES} from '../dist/dawg-career.js';
import {STAMPS} from '../dist/passport.js';
import {QUICK_MODES} from '../dist/pack-checkpoint.js';
import {parseBackup} from '../dist/progress-backup.js';

test('Every registered game has a tab, an XP discipline and a passport stamp',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),tabs=[...html.matchAll(/data-mode="([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual(tabs,GAME_IDS);for(const id of GAME_IDS)assert.match(html,new RegExp(`id="tab-${id}"`));
 assert.deepEqual(DISCIPLINES.map(d=>d.id).sort(),[...GAME_IDS].sort());assert.deepEqual(STAMPS.map(s=>s.id).sort(),[...GAME_IDS].sort());
 assert.equal(new Set(GAME_IDS).size,GAME_IDS.length);for(const g of GAMES){assert.ok(['maze','pack','trade'].includes(g.kind));assert.ok(g.views.every(v=>['third','first'].includes(v)));}
});
test('Pack games in the registry all have quick-game checkpoints, except the story',()=>{
 for(const id of PACK_IDS)if(id!=='story')assert.ok(QUICK_MODES.includes(id),id);
});
test('Camera choices fall back to each game’s default and only switch where supported',()=>{
 assert.equal(viewFor('runner',{}),'third');assert.equal(viewFor('runner',{runner:'first'}),'first');assert.equal(viewFor('runner',{runner:'sideways'}),'third');
 assert.equal(viewFor('flappy',{flappy:'first'}),'third');assert.equal(canSwitchView('runner'),true);assert.equal(canSwitchView('trade'),false);
});
test('Backups accept saved camera choices and reject unknown ones',()=>{
 const ok={format:'dawg-arcade-backup',version:1,saves:{settings:{controls:'stick',cameras:{runner:'first'}}}};assert.ok(parseBackup(JSON.stringify(ok)));
 for(const cameras of [{runner:'sideways'},{trade:'first'},[]])assert.throws(()=>parseBackup(JSON.stringify({...ok,saves:{settings:{cameras}}})),/invalid settings/);
});
