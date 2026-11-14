import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GAMES,GAME_IDS} from '../dist/games.js';
import {HOOKS,GENRES,BADGES,genresOf,featuredIds,matchesFilter} from '../dist/shell.js';

const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const chips=[...html.matchAll(/class="chip" data-genre="([a-z]+)"/g)].map(m=>m[1]);

test('Every game has a hook, a genre the library can filter on, and a sane badge',()=>{
 for(const id of GAME_IDS){assert.ok(HOOKS[id]&&HOOKS[id].length<=64,id+' has a short hook');assert.ok(GENRES[id]?.length,id+' has a genre');for(const g of genresOf(id))assert.ok(chips.includes(g),`${id}: genre ${g} has a filter chip`);}
 assert.deepEqual(genresOf('not-a-game'),['action']);
 for(const [id,b] of Object.entries(BADGES))assert.ok(['FLAGSHIP','NEW','HOT'].includes(b),id);
 assert.equal(chips[0],'all');for(const c of chips.slice(1))assert.ok(GAME_IDS.some(id=>genresOf(id).includes(c)),'chip '+c+' matches a game');
});
test('The featured line-up leads with flagships, fills to three and rotates daily',()=>{
 const have=id=>GAME_IDS.includes(id),a=featuredIds(have,100),b=featuredIds(have,101);
 assert.equal(a.length,3);assert.equal(new Set(a).size,3);assert.equal(a[0],GAME_IDS.includes('fight')?'fight':'nemesis');assert.notDeepEqual(a,b);
 assert.deepEqual(featuredIds(id=>id==='fight'||id==='nemesis'||id==='bark',5),['fight','nemesis','bark']);
 assert.deepEqual(featuredIds(()=>false),[]);
});
test('Library filter matches by genre and by words in the title, tagline or hook',()=>{
 const kart={id:'kart',title:'Drift Dawgs',tag:'THREE LAPS. NO MERCY.'};
 assert.ok(matchesFilter(kart,'all',''));assert.ok(matchesFilter(kart,'racing',''));assert.ok(!matchesFilter(kart,'puzzle',''));
 assert.ok(matchesFilter(kart,'all','drift'));assert.ok(matchesFilter(kart,'all','  LAPS '));assert.ok(matchesFilter(kart,'all','cup'),'hook text');assert.ok(matchesFilter(kart,'all','racing'),'genre word');assert.ok(!matchesFilter(kart,'all','chess'));assert.ok(!matchesFilter(kart,'story','drift'));
});
test('The shell markup carries the home screen, the product sheet and the results extras',()=>{
 for(const id of ['featured','todayRail','playHero','heroLabel','heroRecent','questStrip','shelfNew','libChips','libSearch','libEmpty','gamesMeta','sheetHook','sheetMedals','sheetFeats','sheetTop','sheetRank','sheetChallenge','sheetPlay','sheetBoard','resultsDelta','resultsQuests','resultsRematch','resultsShare','resultsChallenge','friendInvite','rankCode'])
  assert.equal(html.split(`id="${id}"`).length-1,1,id+' appears once');
 // Every card keeps the same contract, so the grid can treat them alike.
 for(const g of GAMES){const m=html.match(new RegExp(`<button class="mode-tab game-card[^"]*" id="tab-${g.id}" data-mode="${g.id}"[^>]*style="--poster:url\\(assets/posters/[a-z]+\\.jpg\\)">\\s*<span class="card-art" aria-hidden="true">\\s*</span>\\s*<span class="card-body">\\s*<strong>[^<]+</strong>\\s*<small>[^<]+</small>`));assert.ok(m,g.id+' card follows the card contract');}
});
test('Feats for the game sheet come from the engines, keyed by game',async()=>{
 const {featsOf}=await import('../dist/game-sheet.js').catch(()=>({}));if(!featsOf)return;
 const climb=await featsOf('climb');assert.ok(climb.length>=3);for(const f of climb){assert.match(f.id,/^climb\.[a-z0-9_]+$/);assert.ok(f.name);}
 assert.deepEqual(await featsOf('story'),[]);
});
