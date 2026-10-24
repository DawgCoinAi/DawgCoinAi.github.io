import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {medalState} from '../dist/results.js';
import {needsOnboarding,STARTERS} from '../dist/onboarding.js';
import {currentStreak,shortRule,wallFor,freshArcade} from '../dist/unlocks.js';
import {rewriteHtml,stylesheetsOf} from '../scripts/build-app.mjs';

test('Medals: earned count, label and the gap to the next one',()=>{
 assert.deepEqual(medalState(0,[50,150,300]),{earned:0,label:'NO MEDAL YET',next:50,toNext:50,targets:[50,150,300]});
 assert.equal(medalState(150,[50,150,300]).label,'SILVER MEDAL');assert.equal(medalState(150,[50,150,300]).toNext,150);
 const gold=medalState(999,[50,150,300]);assert.equal(gold.earned,3);assert.equal(gold.next,undefined);assert.equal(gold.toNext,0);
});
test('Onboarding shows only to brand-new players, and every starter game is open on day one',()=>{
 assert.equal(needsOnboarding({},false),true);assert.equal(needsOnboarding({runs:0,classic:0},false),true);
 assert.equal(needsOnboarding({runs:1},false),false);assert.equal(needsOnboarding({flappy:20},false),false);assert.equal(needsOnboarding({},true),false);
 const a=freshArcade();for(const id of STARTERS)assert.ok(wallFor(id,a).open,id+' is open from the start');
});
test('Current streak counts back from today, or from yesterday until today is played',()=>{
 assert.deepEqual(currentStreak(['2026-10-22','2026-10-23','2026-10-24'],'2026-10-24'),{days:3,today:true});
 assert.deepEqual(currentStreak(['2026-10-22','2026-10-23'],'2026-10-24'),{days:2,today:false});
 assert.deepEqual(currentStreak(['2026-10-20','2026-10-22'],'2026-10-24'),{days:0,today:false});
 assert.deepEqual(currentStreak([],'2026-10-24'),{days:0,today:false});
 assert.deepEqual(currentStreak(['2026-02-28','2026-03-01'],'2026-03-01'),{days:2,today:true},'month boundaries');
});
test('Locked cards say what opens them',()=>{
 assert.equal(shortRule('snake'),'LV 3 · 20 MIN · 2-DAY STREAK');assert.equal(shortRule('trade'),'LV 6 · 1 H · CHALLENGE');assert.equal(shortRule('pinball'),'LV 8 · 100 MIN · 3-DAY STREAK');assert.equal(shortRule('classic'),'');assert.equal(shortRule('daily'),'');
});
test('Deploy build swaps every stylesheet and the entry module for the bundled files',()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),sheets=stylesheetsOf(html);
 assert.ok(sheets.length>=10&&sheets.includes('ui.css')&&sheets.at(-1)==='ui.css','ui.css loads last');
 for(const s of sheets)assert.ok(fs.existsSync(new URL('../dist/'+s,import.meta.url)),s);
 const out=rewriteHtml(html);assert.equal(stylesheetsOf(out).length,1);assert.match(out,/<link rel="stylesheet" href="app\.min\.css">/);assert.match(out,/<script type="module" src="bundle\/app\.js">/);assert.doesNotMatch(out,/src="app\.js"/);
 assert.throws(()=>rewriteHtml('<html></html>'),/did not match/);
 const yml=fs.readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');assert.ok(yml.indexOf('build-app.mjs dist')<yml.indexOf('stamp-build.mjs dist'),'bundle before stamping');
});
