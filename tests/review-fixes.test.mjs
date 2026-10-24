import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBackup,parseBackup,SAVE_PREFIX} from '../dist/progress-backup.js';
import {TradeGame,validTradeState} from '../dist/engine.js';
import {LivingTradeGame,validLivingTrade} from '../dist/living-trade.js';
const storage=values=>{const map=new Map(Object.entries(values));return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};

test('Export skips damaged sections instead of blocking the whole backup',()=>{
 const s=storage({[SAVE_PREFIX+'records']:'{"classic":12}',[SAVE_PREFIX+'story']:'{broken',[SAVE_PREFIX+'profile']:'{"rep":-1}'});
 const b=makeBackup(s);assert.deepEqual(b.saves,{records:{classic:12}});assert.deepEqual(b.skipped,['profile','story']);
 assert.deepEqual(parseBackup(JSON.stringify(b)).saves,b.saves);
 assert.equal('skipped'in makeBackup(storage({[SAVE_PREFIX+'sound']:'true'})),false);
 assert.throws(()=>makeBackup(storage({[SAVE_PREFIX+'story']:'{broken'})),/no valid progress/);
});
test('Trade validators reject null entries instead of throwing',()=>{
 const old=new TradeGame(()=>.5).save();assert.ok(validTradeState(old));assert.equal(validTradeState({...old,logs:[null]}),false);
 const living=new LivingTradeGame().save();assert.ok(validLivingTrade(living));
 const bad=structuredClone(living);bad.world.rivals[0]=null;assert.equal(validLivingTrade(bad),false);
 assert.throws(()=>parseBackup(JSON.stringify({format:'dawg-arcade-backup',version:1,saves:{trade:{version:1,state:bad}}})),/invalid trade data/);
});
