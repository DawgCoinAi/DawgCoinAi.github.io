import test from 'node:test';
import assert from 'node:assert/strict';
import {dayKey,weekKey,dailyQuests,weeklyQuests,freshQuests,rollover,progress,applyRun,applyFeatNow,applySocial,validQuests,REWARD} from '../dist/quests.js';

const open=['runner','flappy','climb','heist','nemesis','bark'];
const info=id=>({title:id.toUpperCase(),best:id==='runner'?4000:0,par:2500});
const at=(y,m,d)=>new Date(y,m-1,d,12);

test('Today’s quests are the same for everyone, differ by day, and scale to your own best',()=>{
 const a=dailyQuests('2026-11-14',open,info),b=dailyQuests('2026-11-14',[...open].reverse(),info);assert.deepEqual(a,b,'same picks whatever order the games are listed in');assert.equal(a.length,3);
 assert.equal(a[0].id,'featured');assert.ok(open.includes(a[0].game));assert.equal(a[1].id,'score');assert.notEqual(a[1].game,a[0].game);
 const days=new Set(Array.from({length:14},(_,i)=>dailyQuests('2026-11-'+String(i+1).padStart(2,'0'),open,info)[0].game));assert.ok(days.size>=3,'the featured game moves around');
 const mine=dailyQuests('2026-11-14',['runner','flappy'],id=>({title:id,best:id==='runner'?4000:0,par:2500})),score=mine[1];assert.equal(score.target,score.game==='runner'?2800:500,'70% of your best, or a fifth of par if you have none');
 assert.equal(dayKey(at(2026,3,5)),'2026-03-05');assert.equal(weekKey(at(2026,11,14)),'W2026-11-09','weeks start on Monday');assert.equal(weekKey(at(2026,11,9)),'W2026-11-09');
});

test('Runs move the quests along, pay rep once, and finishing all three starts a streak',()=>{
 const now=at(2026,11,14),q=dailyQuests(dayKey(now),open,info);let s=freshQuests(),all=[];
 const run=(game,score,extra={})=>{const r=applyRun(s,{game,score,...extra},q,now);s=r.state;all.push(...r.completed);return r.completed;};
 const first=run(q[0].game,10);assert.ok(first.some(c=>c.id==='featured'));assert.equal(s.rep,REWARD.featured);assert.equal(run(q[0].game,10).filter(c=>c.id==='featured').length,0,'paid once');
 run(q[1].game,q[1].target-1);assert.equal(s.scored,false);const hit=run(q[1].game,q[1].target);assert.ok(hit.some(c=>c.id==='score'));
 for(const g of open)run(g,1,{feats:['runner.flow5']});assert.ok(all.some(c=>c.all),'all three done');assert.equal(s.streak,1);assert.equal(s.lastAll,'2026-11-14');assert.ok(validQuests(s));
 const p=progress(s,q);assert.ok(p.daily.every(x=>x.done));assert.equal(p.weekly[0].have,s.weekRuns);
});

test('The streak survives consecutive days and breaks on a missed one; days and weeks roll over',()=>{
 let s={...freshQuests(),day:'2026-11-14',lastAll:'2026-11-14',streak:4,runs:9,games:['runner'],done:['featured'],week:'W2026-11-09',weekRuns:12};
 const next=rollover(s,at(2026,11,15));assert.equal(next.streak,4);assert.equal(next.runs,0);assert.deepEqual(next.done,[]);assert.equal(next.weekRuns,12,'same week keeps its count');
 const missed=rollover(s,at(2026,11,16));assert.equal(missed.streak,0);assert.equal(missed.weekRuns,0,'a new week starts fresh');
});

test('Feats count once ever, weekly quests track bests and time with friends',()=>{
 const now=at(2026,11,14),q=dailyQuests(dayKey(now),open,info);let r=applyFeatNow(freshQuests(),'nemesis.outsmart5',q,now);assert.equal(r.state.feats.length,1);assert.equal(r.state.rep,REWARD.feat+(q[2].id==='feat'?REWARD.third:0));
 const again=applyFeatNow(r.state,'nemesis.outsmart5',q,now);assert.equal(again.state.feats.length,1);assert.equal(again.completed.filter(c=>c.feat).length,0);
 assert.equal(applyFeatNow(freshQuests(),'<script>',q,now).state.feats.length,0,'junk ids are ignored');
 let s=freshQuests();for(const g of ['runner','climb','heist'])s=applyRun(s,{game:g,score:5,best:true},q,now).state;assert.deepEqual(s.weekBests,['runner','climb','heist']);assert.ok(s.weekDone.includes('weekBests'));
 for(let i=0;i<3;i++)s=applySocial(s,q,now).state;assert.ok(s.weekDone.includes('weekSocial'));assert.equal(weeklyQuests().length,3);
});

test('Saved quest state is validated',()=>{
 assert.ok(validQuests(freshQuests()));for(const bad of [null,{...freshQuests(),v:2},{...freshQuests(),day:'tomorrow'},{...freshQuests(),games:['x','x']},{...freshQuests(),feats:['bad id']},{...freshQuests(),streak:-1},{...freshQuests(),rep:1.5}])assert.equal(validQuests(bad),false);
});
